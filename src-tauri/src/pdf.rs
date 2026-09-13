// src-tauri/src/pdf.rs — FR-CHAT-18: HTML string → PDF bytes.
//
// macOS: offscreen WKWebView + createPDF tiled into A4 pages, merged with PDFKit.
// printOperationWithPrintInfo paginates correctly but runOperation() deadlocks
// the main thread (beach ball, invoke never returns). createPDF is async and
// does not paginate — each call is one page of the given rect.
// Other platforms: not implemented; the UI hides the button there.

use tauri::command;

const A4_WIDTH: f64 = 595.28;
const A4_HEIGHT: f64 = 841.89;

#[derive(Debug, Clone, Copy)]
struct BlockBox {
    top: f64,
    bottom: f64,
}

/// Place page starts so a cut that would split a block moves up to that
/// block's top. Blocks taller than a page are sliced. Used by the macOS
/// exporter; tested here because createPDF itself ignores CSS break-inside.
fn snap_page_starts(height: f64, page_h: f64, blocks: &[BlockBox]) -> Vec<f64> {
    let height = height.max(page_h);
    let min_slice = page_h * 0.35;
    let mut starts = vec![0.0];
    let mut y = 0.0;
    while y + page_h < height - 0.5 {
        let limit = y + page_h;
        let mut best: Option<f64> = None;
        for b in blocks {
            if b.bottom - b.top > page_h - 1.0 {
                continue;
            }
            if b.top > y + min_slice && b.top < limit && b.bottom > limit {
                best = Some(best.map_or(b.top, |t| t.max(b.top)));
            }
        }
        let snap = best.filter(|&s| s > y + 8.0).unwrap_or(limit);
        starts.push(snap);
        y = snap;
    }
    starts
}

#[command]
pub async fn create_pdf(html: String) -> Result<Vec<u8>, String> {
    #[cfg(target_os = "macos")]
    {
        tauri::async_runtime::spawn_blocking(move || macos::html_to_pdf(html))
            .await
            .map_err(|e| e.to_string())?
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = html;
        Err("PDF export is not available on this platform yet".into())
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use std::cell::{Cell, RefCell};
    use std::sync::mpsc::{self, Sender};

    use block2::RcBlock;
    use dispatch::Queue;
    use objc2::rc::{Allocated, Retained};
    use objc2::runtime::{AnyObject, NSObject, NSObjectProtocol, ProtocolObject};
    use objc2::{define_class, msg_send, AnyThread, DefinedClass, MainThreadMarker, MainThreadOnly, Message};
    use objc2_core_foundation::{CGPoint, CGRect, CGSize};
    use objc2_foundation::{NSData, NSError, NSNumber, NSString};
    use objc2_pdf_kit::PDFDocument;
    use objc2_web_kit::{
        WKNavigation, WKNavigationDelegate, WKPDFConfiguration, WKWebView, WKWebViewConfiguration,
    };

    struct Ivars {
        tx: RefCell<Option<Sender<Result<Vec<u8>, String>>>>,
        web_view: RefCell<Option<Retained<WKWebView>>>,
        keep: RefCell<Option<Retained<PdfDelegate>>>,
        content_height: Cell<f64>,
        page_starts: RefCell<Vec<f64>>,
        next_page: Cell<usize>,
        slices: RefCell<Vec<Vec<u8>>>,
    }

    define_class!(
        #[unsafe(super(NSObject))]
        #[thread_kind = MainThreadOnly]
        #[ivars = Ivars]
        struct PdfDelegate;

        unsafe impl NSObjectProtocol for PdfDelegate {}

        unsafe impl WKNavigationDelegate for PdfDelegate {
            #[unsafe(method(webView:didFinishNavigation:))]
            fn did_finish(&self, web_view: &WKWebView, _nav: Option<&WKNavigation>) {
                measure_then_paginate(self, web_view);
            }

            #[unsafe(method(webView:didFailNavigation:withError:))]
            fn did_fail(
                &self,
                _web_view: &WKWebView,
                _nav: Option<&WKNavigation>,
                error: &NSError,
            ) {
                fail(self, error.localizedDescription().to_string());
            }

            #[unsafe(method(webView:didFailProvisionalNavigation:withError:))]
            fn did_fail_provisional(
                &self,
                _web_view: &WKWebView,
                _nav: Option<&WKNavigation>,
                error: &NSError,
            ) {
                fail(self, error.localizedDescription().to_string());
            }
        }
    );

    impl PdfDelegate {
        fn init_with_tx(
            this: Allocated<Self>,
            tx: Sender<Result<Vec<u8>, String>>,
        ) -> Retained<Self> {
            let this = this.set_ivars(Ivars {
                tx: RefCell::new(Some(tx)),
                web_view: RefCell::new(None),
                keep: RefCell::new(None),
                content_height: Cell::new(super::A4_HEIGHT),
                page_starts: RefCell::new(vec![0.0]),
                next_page: Cell::new(0),
                slices: RefCell::new(Vec::new()),
            });
            unsafe { msg_send![super(this), init] }
        }
    }

    fn cleanup(this: &PdfDelegate) {
        this.ivars().web_view.take();
        this.ivars().keep.take();
    }

    fn fail(this: &PdfDelegate, msg: String) {
        if let Some(tx) = this.ivars().tx.take() {
            let _ = tx.send(Err(msg));
        }
        cleanup(this);
    }

    const HEIGHT_JS: &str = "Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight)";

    const LAYOUT_JS: &str = r#"(function () {
  var total = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight);
  var nodes = document.body.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, table, figure, img, hr");
  var blocks = [];
  for (var i = 0; i < nodes.length; i++) {
    var r = nodes[i].getBoundingClientRect();
    if (r.height < 1) continue;
    var top = r.top + (window.scrollY || 0);
    blocks.push({ top: top, bottom: top + r.height });
  }
  return JSON.stringify({ height: total, blocks: blocks });
})()"#;

    fn measure_then_paginate(this: &PdfDelegate, web_view: &WKWebView) {
        let this_keep = this.retain();
        let view = web_view.retain();
        let js = NSString::from_str(HEIGHT_JS);
        let handler = RcBlock::new(move |result: *mut AnyObject, _err: *mut NSError| {
            let mut height = super::A4_HEIGHT;
            if !result.is_null() {
                let obj = unsafe { &*result };
                if let Some(num) = obj.downcast_ref::<NSNumber>() {
                    height = num.as_f64().max(super::A4_HEIGHT);
                }
            }
            let frame = CGRect::new(
                CGPoint::new(0.0, 0.0),
                CGSize::new(super::A4_WIDTH, height),
            );
            view.setFrame(frame);
            view.setNeedsLayout(true);
            view.layoutSubtreeIfNeeded();
            this_keep.ivars().content_height.set(height);
            collect_layout_then_capture(&this_keep, &view);
        });
        unsafe {
            web_view.evaluateJavaScript_completionHandler(&js, Some(&*handler));
        }
        let _ = handler;
    }

    fn collect_layout_then_capture(this: &PdfDelegate, web_view: &WKWebView) {
        let this_keep = this.retain();
        let view = web_view.retain();
        let js = NSString::from_str(LAYOUT_JS);
        let fallback_height = this.ivars().content_height.get();
        let handler = RcBlock::new(move |result: *mut AnyObject, _err: *mut NSError| {
            let mut height = fallback_height;
            let mut blocks: Vec<super::BlockBox> = Vec::new();
            if !result.is_null() {
                let obj = unsafe { &*result };
                if let Some(s) = obj.downcast_ref::<NSString>() {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s.to_string()) {
                        if let Some(h) = v.get("height").and_then(|x| x.as_f64()) {
                            height = h.max(super::A4_HEIGHT);
                        }
                        if let Some(arr) = v.get("blocks").and_then(|x| x.as_array()) {
                            for b in arr {
                                let top = b.get("top").and_then(|x| x.as_f64()).unwrap_or(0.0);
                                let bottom = b.get("bottom").and_then(|x| x.as_f64()).unwrap_or(top);
                                blocks.push(super::BlockBox { top, bottom });
                            }
                        }
                    }
                }
            }
            this_keep.ivars().content_height.set(height);
            let starts = super::snap_page_starts(height, super::A4_HEIGHT, &blocks);
            this_keep.ivars().page_starts.replace(starts);
            this_keep.ivars().next_page.set(0);
            this_keep.ivars().slices.borrow_mut().clear();
            capture_next_page(&this_keep, &view);
        });
        unsafe {
            web_view.evaluateJavaScript_completionHandler(&js, Some(&*handler));
        }
        let _ = handler;
    }

    fn capture_next_page(this: &PdfDelegate, web_view: &WKWebView) {
        let height = this.ivars().content_height.get();
        let i = this.ivars().next_page.get();
        let starts = this.ivars().page_starts.borrow().clone();
        if i >= starts.len() {
            finish(this);
            return;
        }

        let y_doc = starts[i];
        let next = starts.get(i + 1).copied().unwrap_or(height);
        let slice_h = (next - y_doc).clamp(1.0, super::A4_HEIGHT);
        let y = if web_view.isFlipped() {
            y_doc
        } else {
            (height - y_doc - slice_h).max(0.0)
        };

        let pdf_config = unsafe { WKPDFConfiguration::new(MainThreadMarker::from(web_view)) };
        unsafe {
            pdf_config.setRect(CGRect::new(
                CGPoint::new(0.0, y),
                CGSize::new(super::A4_WIDTH, slice_h),
            ));
        }

        let this_keep = this.retain();
        let view = web_view.retain();
        let handler = RcBlock::new(move |data: *mut NSData, err: *mut NSError| {
            if data.is_null() {
                let msg = unsafe {
                    if !err.is_null() {
                        (&*err).localizedDescription().to_string()
                    } else {
                        "PDF generation returned no data".into()
                    }
                };
                fail(&this_keep, msg);
                return;
            }
            let bytes = unsafe { (&*data).to_vec() };
            this_keep.ivars().slices.borrow_mut().push(bytes);
            this_keep.ivars().next_page.set(i + 1);
            capture_next_page(&this_keep, &view);
        });

        unsafe {
            web_view.createPDFWithConfiguration_completionHandler(
                Some(&pdf_config),
                &*handler,
            );
        }
        let _ = handler;
    }

    fn merge_slices(slices: &[Vec<u8>]) -> Result<Vec<u8>, String> {
        let dest = unsafe { PDFDocument::init(PDFDocument::alloc()) };
        for (index, bytes) in slices.iter().enumerate() {
            let data = NSData::with_bytes(bytes);
            let Some(src) = (unsafe { PDFDocument::initWithData(PDFDocument::alloc(), &data) })
            else {
                return Err(format!("Could not parse PDF page {}", index + 1));
            };
            let Some(page) = (unsafe { src.pageAtIndex(0) }) else {
                return Err(format!("PDF slice {} has no pages", index + 1));
            };
            unsafe {
                dest.insertPage_atIndex(&page, index as usize);
            }
        }
        let Some(out) = (unsafe { dest.dataRepresentation() }) else {
            return Err("Could not serialize merged PDF".into());
        };
        Ok(out.to_vec())
    }

    fn finish(this: &PdfDelegate) {
        let slices = this.ivars().slices.replace(Vec::new());
        let result = merge_slices(&slices);
        if let Some(tx) = this.ivars().tx.take() {
            let _ = tx.send(result);
        }
        cleanup(this);
    }

    pub fn html_to_pdf(html: String) -> Result<Vec<u8>, String> {
        let (tx, rx) = mpsc::channel();
        Queue::main().exec_async(move || {
            start(html, tx);
        });
        rx.recv().unwrap_or(Err("PDF generation was cancelled".into()))
    }

    fn start(html: String, tx: Sender<Result<Vec<u8>, String>>) {
        let mtm = MainThreadMarker::new().expect("WKWebView requires the main thread");
        let config = unsafe { WKWebViewConfiguration::new(mtm) };
        let frame = CGRect::new(
            CGPoint::new(0.0, 0.0),
            CGSize::new(super::A4_WIDTH, super::A4_HEIGHT),
        );
        let web_view = unsafe {
            WKWebView::initWithFrame_configuration(WKWebView::alloc(mtm), frame, &config)
        };

        let delegate = PdfDelegate::init_with_tx(PdfDelegate::alloc(mtm), tx);
        unsafe {
            web_view.setNavigationDelegate(Some(ProtocolObject::from_ref(&*delegate)));
        }
        delegate.ivars().web_view.replace(Some(web_view.clone()));
        delegate.ivars().keep.replace(Some(delegate.clone()));

        let ns_html = NSString::from_str(&html);
        unsafe {
            web_view.loadHTMLString_baseURL(&ns_html, None);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn even_tiling_when_no_blocks() {
        let starts = snap_page_starts(2000.0, 800.0, &[]);
        assert_eq!(starts, vec![0.0, 800.0, 1600.0]);
    }

    #[test]
    fn snaps_up_to_block_that_would_be_split() {
        let blocks = [BlockBox {
            top: 700.0,
            bottom: 900.0,
        }];
        let starts = snap_page_starts(1600.0, 800.0, &blocks);
        assert_eq!(starts[0], 0.0);
        assert_eq!(starts[1], 700.0);
    }

    #[test]
    fn does_not_snap_blocks_taller_than_a_page() {
        let blocks = [BlockBox {
            top: 100.0,
            bottom: 1200.0,
        }];
        let starts = snap_page_starts(1600.0, 800.0, &blocks);
        assert_eq!(starts, vec![0.0, 800.0]);
    }

    #[test]
    fn single_page_document_has_one_start() {
        let starts = snap_page_starts(500.0, A4_HEIGHT, &[]);
        assert_eq!(starts, vec![0.0]);
    }

    #[test]
    fn cascade_of_blocks_near_page_boundaries() {
        let blocks = [
            BlockBox { top: 750.0, bottom: 900.0 },
            BlockBox { top: 1500.0, bottom: 1700.0 },
        ];
        let starts = snap_page_starts(2400.0, 800.0, &blocks);
        assert_eq!(starts[0], 0.0);
        assert_eq!(starts[1], 750.0);
        assert_eq!(starts[2], 1500.0);
    }

    #[test]
    fn block_entirely_within_a_page_does_not_trigger_snap() {
        let blocks = [BlockBox { top: 200.0, bottom: 400.0 }];
        let starts = snap_page_starts(1600.0, 800.0, &blocks);
        assert_eq!(starts, vec![0.0, 800.0]);
    }
}
