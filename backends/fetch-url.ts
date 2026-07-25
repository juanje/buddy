// backends/fetch-url.ts — FR-NET-01: fetch URL content (web→markdown, PDF, image).

import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import TurndownService from "turndown";
import { Type } from "typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";

import { toIsoDay } from "../shared/dates";
import { DOWNLOADS_DIR, FETCH_MAX_BYTES, FETCH_TIMEOUT_MS } from "../shared/defaults";
import { extractPdfText } from "./pdf-extract";

export type FetchContentKind = "html" | "pdf" | "image";

export type FetchHttpClient = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

export interface FetchToolOptions {
  fetchImpl?: FetchHttpClient;
  fetchTimeoutMs?: number;
  now?: () => Date;
}

export interface FetchToolDetails {
  savedPath: string;
  contentType: string;
  url: string;
  imageBase64?: string;
  imageMimeType?: string;
}

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

export function resolveFetchContentKind(
  contentType: string | null,
  url: string,
): FetchContentKind {
  const normalized = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (normalized.startsWith("image/")) return "image";
  if (normalized === "application/pdf") return "pdf";
  if (normalized.includes("html")) return "html";

  const ext = extname(new URL(url).pathname).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  return "html";
}

export function slugifyDownloadName(titleOrPath: string, url?: string): string {
  const fromTitle = titleOrPath
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (fromTitle) return fromTitle.slice(0, 80);

  if (url) {
    try {
      const pathname = new URL(url).pathname;
      const base = basename(pathname, extname(pathname))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (base) return base.slice(0, 80);
    } catch {
      // fall through
    }
  }
  return "download";
}

export function buildDownloadFilename(isoDay: string, slug: string, ext: string): string {
  const normalizedExt = ext.startsWith(".") ? ext : `.${ext}`;
  return `${isoDay}_${slug}${normalizedExt}`;
}

export function formatFetchHttpError(status: number, url: string): string {
  return `Failed to fetch ${url}: HTTP ${status}`;
}

export function formatFetchSizeError(maxBytes: number): string {
  const maxMb = Math.round(maxBytes / (1024 * 1024));
  return `Failed to fetch URL: response exceeds ${maxMb} MB limit`;
}

export function formatFetchTimeoutError(url: string): string {
  return `Failed to fetch ${url}: request timed out`;
}

export function htmlToMarkdown(html: string, pageUrl: string): string {
  const { document } = parseHTML(html);
  const readable = new Readability(document as unknown as Document, { charThreshold: 0 }).parse();
  const title = readable?.title?.trim() ?? document.title?.trim() ?? "";
  const contentHtml = readable?.content ?? document.body?.innerHTML ?? html;
  const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  const body = turndown.turndown(contentHtml).trim();
  if (title && body) return `# ${title}\n\n${body}`;
  if (title) return `# ${title}`;
  return body || "(No readable content extracted)";
}

function ensureDownloadsDir(rootDir: string): string {
  const downloadsDir = join(rootDir, DOWNLOADS_DIR);
  mkdirSync(downloadsDir, { recursive: true });
  return downloadsDir;
}

function extensionForKind(kind: FetchContentKind, contentType: string | null, url: string): string {
  if (kind === "pdf") return ".pdf";
  if (kind === "html") return ".md";
  const normalized = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (normalized === "image/jpeg" || normalized === "image/jpg") return ".jpg";
  if (normalized === "image/png") return ".png";
  if (normalized === "image/gif") return ".gif";
  if (normalized === "image/webp") return ".webp";
  const ext = extname(new URL(url).pathname).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext) ? ext : ".png";
}

function imageMimeType(ext: string, contentType: string | null): string {
  const normalized = contentType?.split(";")[0]?.trim().toLowerCase();
  if (normalized?.startsWith("image/")) return normalized;
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    default:
      return "image/png";
  }
}

async function readResponseBody(response: Response, maxBytes: number): Promise<Buffer> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new Error(formatFetchSizeError(maxBytes));
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxBytes) {
    throw new Error(formatFetchSizeError(maxBytes));
  }
  return buffer;
}

export async function fetchUrlContent(
  url: string,
  rootDir: string,
  options?: FetchToolOptions,
): Promise<{ text: string; details: FetchToolDetails }> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.fetchTimeoutMs ?? FETCH_TIMEOUT_MS;
  const now = options?.now ?? (() => new Date());

  let response: Response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return { text: formatFetchTimeoutError(url), details: { savedPath: "", contentType: "", url } };
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      return { text: formatFetchTimeoutError(url), details: { savedPath: "", contentType: "", url } };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { text: `Failed to fetch ${url}: ${message}`, details: { savedPath: "", contentType: "", url } };
  }

  if (!response.ok) {
    return {
      text: formatFetchHttpError(response.status, url),
      details: { savedPath: "", contentType: response.headers.get("content-type") ?? "", url },
    };
  }

  let buffer: Buffer;
  try {
    buffer = await readResponseBody(response, FETCH_MAX_BYTES);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { text: message, details: { savedPath: "", contentType: "", url } };
  }

  const contentType = response.headers.get("content-type");
  const kind = resolveFetchContentKind(contentType, url);
  const downloadsDir = ensureDownloadsDir(rootDir);
  const isoDay = toIsoDay(now());
  const ext = extensionForKind(kind, contentType, url);

  if (kind === "html") {
    const html = buffer.toString("utf8");
    const markdown = htmlToMarkdown(html, url);
    const { document } = parseHTML(html);
    const slug = slugifyDownloadName(document.title ?? "", url);
    const filename = buildDownloadFilename(isoDay, slug, ext);
    const savedPath = join(downloadsDir, filename);
    writeFileSync(savedPath, markdown, "utf8");
    const relPath = join(DOWNLOADS_DIR, filename);
    return {
      text: markdown,
      details: { savedPath: relPath, contentType: contentType ?? "text/html", url },
    };
  }

  if (kind === "pdf") {
    const slug = slugifyDownloadName("", url);
    const filename = buildDownloadFilename(isoDay, slug, ext);
    const savedPath = join(downloadsDir, filename);
    writeFileSync(savedPath, buffer);
    const relPath = join(DOWNLOADS_DIR, filename);
    const extracted = await extractPdfText(savedPath);
    const text = extracted
      ? `<document name="${filename}">\n${extracted}\n</document>`
      : `Downloaded PDF saved to ${relPath} (text extraction failed).`;
    return {
      text,
      details: { savedPath: relPath, contentType: contentType ?? "application/pdf", url },
    };
  }

  const slug = slugifyDownloadName("", url);
  const filename = buildDownloadFilename(isoDay, slug, ext);
  const savedPath = join(downloadsDir, filename);
  writeFileSync(savedPath, buffer);
  const relPath = join(DOWNLOADS_DIR, filename);
  const mimeType = imageMimeType(ext, contentType);
  return {
    text: `Downloaded image saved to ${relPath}.`,
    details: {
      savedPath: relPath,
      contentType: mimeType,
      url,
      imageBase64: buffer.toString("base64"),
      imageMimeType: mimeType,
    },
  };
}

export function buildFetchTools(rootDir: string, options?: FetchToolOptions): ToolDefinition[] {
  return [
    defineTool({
      name: "fetch_url",
      label: "Fetch URL",
      description:
        "Fetch content from a URL. Returns web pages as markdown, PDFs as extracted text, and images as saved files with vision metadata. Use when the user shares a URL or asks you to read a web page.",
      parameters: Type.Object({
        url: Type.String({ description: "The URL to fetch" }),
      }),
      async execute(_callId, args) {
        const result = await fetchUrlContent(args.url, rootDir, options);
        return {
          content: [{ type: "text", text: result.text }],
          details: result.details,
        };
      },
    }),
  ];
}

export function fetchToolNames(tools: ToolDefinition[]): string[] {
  return tools.map((tool) => tool.name);
}

/** Invoke fetch_url and return text + details (tests + BDD). */
export async function executeFetchTool(
  tools: ToolDefinition[],
  name: string,
  args: { url: string },
): Promise<{ text: string; details: unknown }> {
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) throw new Error(`Fetch tool not found: ${name}`);

  const result = await tool.execute(
    "test-call",
    args,
    new AbortController().signal,
    () => {},
    {} as never,
  );
  const textBlock = result.content.find((block) => block.type === "text");
  return {
    text: textBlock?.type === "text" ? textBlock.text : "",
    details: result.details,
  };
}
