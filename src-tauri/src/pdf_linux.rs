// src-tauri/src/pdf_linux.rs — FR-CHAT-21: HTML → PDF via WebKitGTK print-to-file.

use std::cell::{Cell, RefCell};
use std::ffi::CStr;
use std::path::{Path, PathBuf};
use std::rc::Rc;
use std::sync::mpsc::{SyncSender, TryRecvError};
use std::time::{Duration, Instant};

use gtk::glib;
use gtk::prelude::*;
use gtk::{
    OffscreenWindow, PageSetup, PaperSize, PrintSettings, Unit, PRINT_SETTINGS_OUTPUT_FILE_FORMAT,
    PRINT_SETTINGS_OUTPUT_URI,
};
use tauri::AppHandle;
use webkit2gtk::{
    HardwareAccelerationPolicy, LoadEvent, PrintOperation, Settings as WebKitSettings,
    SettingsExt, WebView, WebViewExt, PrintOperationExt,
};

/// Offscreen page size in CSS pixels: A4 at 96 dpi, matching the PDF paper.
const A4_WIDTH_PX: i32 = 794;
const A4_HEIGHT_PX: i32 = 1123;
/// GTK paper name for the output page (PWG 5101.1).
const PAPER_A4: &str = "iso_a4";
/// Upper bound for load + print; past it the export reports a timeout.
const PDF_TIMEOUT: Duration = Duration::from_secs(60);
const CANCELLED: &str = "PDF generation was cancelled";

pub fn html_to_pdf_with_app(app: AppHandle, html: String) -> Result<Vec<u8>, String> {
    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    app.run_on_main_thread(move || {
        let result = html_to_pdf(html);
        let _ = tx.send(result);
    })
    .map_err(|e| e.to_string())?;
    rx.recv().map_err(|_| CANCELLED.to_string())?
}

fn html_to_pdf(html: String) -> Result<Vec<u8>, String> {
    // Tao already initialized GTK. gtk-rs tracks that separately, so the first
    // call from this crate still has to mark the main thread as initialized.
    if !gtk::is_initialized_main_thread() {
        gtk::init().map_err(|e| e.to_string())?;
    }
    let out_path = temp_pdf_path();
    let (tx, rx) = std::sync::mpsc::sync_channel(1);

    let settings = WebKitSettings::default();
    settings.set_hardware_acceleration_policy(HardwareAccelerationPolicy::Never);
    let webview = WebView::builder().settings(&settings).build();
    let window = OffscreenWindow::new();
    window.set_default_size(A4_WIDTH_PX, A4_HEIGHT_PX);
    window.add(&webview);
    webview.set_size_request(A4_WIDTH_PX, A4_HEIGHT_PX);
    window.show_all();

    // PrintOperation is dropped at the end of start_print unless something
    // else holds it. Dropping it before `finished` cancels the job and drops
    // the sender, which the caller sees as "PDF generation was cancelled".
    let op_slot: Rc<RefCell<Option<PrintOperation>>> = Rc::new(RefCell::new(None));
    let started = Cell::new(false);
    let out_for_load = out_path.clone();
    let tx_slot = Rc::new(RefCell::new(Some(tx)));
    let tx_for_load = tx_slot.clone();
    let op_for_load = op_slot.clone();
    webview.connect_load_changed(move |view, event| {
        if event != LoadEvent::Finished {
            return;
        }
        if started.replace(true) {
            return;
        }
        let Some(sender) = tx_for_load.borrow_mut().take() else {
            return;
        };
        start_print(view, &out_for_load, sender, &op_for_load);
    });

    webview.load_html(&html, None);

    let result = wait_for_pdf(&rx)?;
    drop(op_slot);
    let _ = std::fs::remove_file(&out_path);
    result
}

/// `try_recv` takes the message out of the channel. A later `recv` then sees
/// a disconnected sender and reports a cancellation that already succeeded.
fn wait_for_pdf(
    rx: &std::sync::mpsc::Receiver<Result<Vec<u8>, String>>,
) -> Result<Result<Vec<u8>, String>, String> {
    let deadline = Instant::now() + PDF_TIMEOUT;
    loop {
        match rx.try_recv() {
            Ok(value) => return Ok(value),
            Err(TryRecvError::Disconnected) => {
                return Err(CANCELLED.into());
            }
            Err(TryRecvError::Empty) => {
                if Instant::now() >= deadline {
                    return Err("PDF generation timed out".into());
                }
                let _ = glib::MainContext::default().iteration(false);
                std::thread::sleep(Duration::from_millis(10));
            }
        }
    }
}

struct PrintDelivery {
    sent: Cell<bool>,
    tx: SyncSender<Result<Vec<u8>, String>>,
}

impl PrintDelivery {
    fn send_once(&self, value: Result<Vec<u8>, String>) {
        if self.sent.replace(true) {
            return;
        }
        let _ = self.tx.send(value);
    }
}

fn start_print(
    webview: &WebView,
    out_path: &Path,
    tx: SyncSender<Result<Vec<u8>, String>>,
    op_slot: &RefCell<Option<PrintOperation>>,
) {
    let printer = match file_printer_name() {
        Ok(name) => name,
        Err(err) => {
            let _ = tx.send(Err(err));
            return;
        }
    };
    let uri = match glib::filename_to_uri(out_path, None) {
        Ok(uri) => uri,
        Err(err) => {
            let _ = tx.send(Err(err.to_string()));
            return;
        }
    };

    let print_settings = PrintSettings::new();
    print_settings.set_printer(&printer);
    print_settings.set(PRINT_SETTINGS_OUTPUT_FILE_FORMAT, Some("pdf"));
    print_settings.set(PRINT_SETTINGS_OUTPUT_URI, Some(uri.as_str()));

    let page = PageSetup::new();
    page.set_paper_size(&PaperSize::new(Some(PAPER_A4)));
    page.set_top_margin(0.0, Unit::Mm);
    page.set_bottom_margin(0.0, Unit::Mm);
    page.set_left_margin(0.0, Unit::Mm);
    page.set_right_margin(0.0, Unit::Mm);

    let op = PrintOperation::new(webview);
    op.set_print_settings(&print_settings);
    op.set_page_setup(&page);

    let delivery = Rc::new(PrintDelivery {
        sent: Cell::new(false),
        tx,
    });
    let failed_delivery = delivery.clone();
    op.connect_failed(move |_, err| {
        failed_delivery.send_once(Err(err.to_string()));
    });

    let out_path_buf = out_path.to_path_buf();
    op.connect_finished(move |_| {
        if delivery.sent.get() {
            return;
        }
        delivery.send_once(
            std::fs::read(&out_path_buf).map_err(|e| e.to_string()),
        );
    });

    op_slot.replace(Some(op.clone()));
    op.print();
}

fn file_printer_name() -> Result<String, String> {
    use std::ffi::CString;
    let domain = CString::new("gtk30").map_err(|e| e.to_string())?;
    let msg = CString::new("Print to File").map_err(|e| e.to_string())?;
    unsafe {
        let ptr = gettext_sys::dgettext(domain.as_ptr(), msg.as_ptr());
        if ptr.is_null() {
            return Err("Could not resolve GTK file printer name".into());
        }
        Ok(CStr::from_ptr(ptr).to_string_lossy().into_owned())
    }
}

fn temp_pdf_path() -> PathBuf {
    let mut path = std::env::temp_dir();
    path.push(format!(
        "buddy-export-{}-{}.pdf",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    ));
    path
}

#[cfg(test)]
mod tests {
    /// Needs a display (X11 or Wayland). Without one it returns early, so a
    /// headless run proves nothing: run it under `xvfb-run -a cargo test`.
    #[test]
    fn generates_pdf_when_a_display_is_available() {
        if std::env::var("DISPLAY").is_err() && std::env::var("WAYLAND_DISPLAY").is_err() {
            eprintln!("skipped: no display (run under xvfb-run)");
            return;
        }
        let bytes = super::html_to_pdf(
            "<html><body><h1>Hi</h1><p>Linux PDF export.</p></body></html>".into(),
        )
        .expect("pdf");
        assert!(bytes.starts_with(b"%PDF"), "not a PDF");
        assert!(bytes.len() > 500, "pdf too small: {}", bytes.len());
    }
}
