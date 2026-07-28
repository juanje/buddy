// backends/url-safety.ts — SSRF protection for fetch_url (NFR-SEC-12).
//
// fetch_url is the only tool that leaves the machine, and the URL it receives
// comes from the agent — whose context is shaped by pages it already fetched.
// A URL is therefore attacker-influenced input, not a user intention.
//
// The check acts on the *resolved address*, not the spelling: a hostname the
// attacker controls can resolve to 127.0.0.1. It runs again on every redirect
// hop, because validating only the first URL is what makes redirect-based SSRF
// work.

import { lookup } from "node:dns/promises";

export class UnsafeUrlError extends Error {}

export type DnsLookupFn = (hostname: string) => Promise<string[]>;

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** Maximum redirect hops before giving up (NFR-SEC-12). */
export const MAX_REDIRECT_HOPS = 5;

function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

/** CIDR blocks that must never be reachable, as [network, prefix length]. */
const BLOCKED_IPV4_CIDRS: Array<[string, number]> = [
  ["0.0.0.0", 8], // "this network" — 0.0.0.0 routes to localhost on many stacks
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, includes cloud metadata at 169.254.169.254
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, includes 255.255.255.255
];

function isBlockedIpv4(ip: string): boolean {
  const address = ipv4ToNumber(ip);
  if (address === null) return false;
  for (const [network, prefix] of BLOCKED_IPV4_CIDRS) {
    const base = ipv4ToNumber(network);
    if (base === null) continue;
    const mask = prefix === 0 ? 0 : (-1 << (32 - prefix)) >>> 0;
    if ((address & mask) >>> 0 === (base & mask) >>> 0) return true;
  }
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().split("%")[0]!; // strip zone id
  if (normalized === "::1" || normalized === "::") return true;
  // IPv4-mapped (::ffff:127.0.0.1) must be judged by its IPv4 part.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mapped) return isBlockedIpv4(mapped[1]!);
  if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return true; // unique-local fc00::/7
  if (/^fe[89ab][0-9a-f]:/.test(normalized)) return true; // link-local fe80::/10
  return false;
}

/** True when an IP literal must never be contacted. */
export function isBlockedAddress(ip: string): boolean {
  return ip.includes(":") ? isBlockedIpv6(ip) : isBlockedIpv4(ip);
}

/** Hostnames refused by name, whatever DNS would answer. */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
]);
const BLOCKED_HOSTNAME_SUFFIXES = [".localhost", ".local", ".internal", ".localdomain"];

export function isBlockedHostname(hostname: string): boolean {
  const name = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(name)) return true;
  return BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

/**
 * Addresses refused even for a base URL the user typed deliberately.
 *
 * Loopback and private ranges are *not* here — see `assertSafeProviderBaseUrl`.
 * These are the ones no model server is ever reachable at, and where a request
 * carrying an Authorization header does real damage: cloud instance metadata
 * (169.254.169.254 and friends), the unspecified address, multicast, reserved.
 */
function isNeverAProviderAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const normalized = ip.toLowerCase().split("%")[0]!;
    if (normalized === "::") return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
    if (mapped) return isNeverAProviderAddress(mapped[1]!);
    return /^fe[89ab][0-9a-f]:/.test(normalized); // link-local
  }
  const value = ipv4ToNumber(ip);
  if (value === null) return false;
  for (const [network, prefix] of [
    ["0.0.0.0", 8], // unspecified
    ["169.254.0.0", 16], // link-local, includes cloud metadata
    ["224.0.0.0", 4], // multicast
    ["240.0.0.0", 4], // reserved
  ] as Array<[string, number]>) {
    const base = ipv4ToNumber(network)!;
    const mask = (-1 << (32 - prefix)) >>> 0;
    if ((value & mask) >>> 0 === (base & mask) >>> 0) return true;
  }
  return false;
}

const METADATA_HOSTNAMES = new Set([
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
]);

/**
 * Validate the base URL of a custom OpenAI-compatible provider (NFR-SEC-18).
 *
 * **This is deliberately weaker than `assertSafeUrl`, and the difference is the
 * threat model, not an oversight.** `fetch_url` receives URLs chosen by the
 * agent, whose context is shaped by pages it has already fetched — attacker
 * influence with no human in the loop, so loopback and private ranges are
 * refused outright. A provider base URL is typed by the user into a field that
 * exists for exactly this purpose, and the overwhelmingly common thing to type
 * is `http://localhost:11434/v1`: Ollama, LM Studio, llama.cpp, or a model
 * server on their own LAN. Applying the SSRF rules verbatim would refuse the
 * only reason the "custom" option exists.
 *
 * What is still refused is what a local model server is never behind: a
 * non-HTTP scheme, a malformed URL, and the link-local range that carries cloud
 * instance metadata — where an Authorization header does real harm and where
 * nobody is running an LLM.
 */
export async function assertSafeProviderBaseUrl(
  rawUrl: string,
  lookupFn: DnsLookupFn = defaultLookup,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError(`Not a valid URL: ${rawUrl}`);
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UnsafeUrlError(
      `The base URL must start with http:// or https:// (got "${url.protocol}").`,
    );
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (!hostname) {
    throw new UnsafeUrlError(`The base URL has no host: ${rawUrl}`);
  }
  if (METADATA_HOSTNAMES.has(hostname)) {
    throw new UnsafeUrlError(`Refusing to send credentials to ${hostname}.`);
  }

  if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) {
    if (isNeverAProviderAddress(hostname)) {
      throw new UnsafeUrlError(`Refusing to send credentials to ${hostname}.`);
    }
    return url;
  }

  // A name that is obviously local needs no resolution and should not be
  // punished for failing to resolve on a machine without mDNS.
  if (isBlockedHostname(hostname)) return url;

  let addresses: string[];
  try {
    addresses = await lookupFn(hostname);
  } catch {
    throw new UnsafeUrlError(`Could not resolve the base URL host: ${hostname}`);
  }
  if (addresses.length === 0) {
    throw new UnsafeUrlError(`Could not resolve the base URL host: ${hostname}`);
  }
  for (const address of addresses) {
    if (isNeverAProviderAddress(address)) {
      throw new UnsafeUrlError(
        `Refusing to send credentials to ${hostname} — it resolves to ${address}.`,
      );
    }
  }

  return url;
}

async function defaultLookup(hostname: string): Promise<string[]> {
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map((entry) => entry.address);
}

/**
 * Throw unless `rawUrl` is safe to request. Resolves the hostname so a name
 * pointing at a private address is rejected on its address, not its spelling.
 */
export async function assertSafeUrl(
  rawUrl: string,
  lookupFn: DnsLookupFn = defaultLookup,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError(`Not a valid URL: ${rawUrl}`);
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UnsafeUrlError(
      `Only http and https URLs can be fetched (got "${url.protocol}").`,
    );
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname) {
    throw new UnsafeUrlError(`URL has no host: ${rawUrl}`);
  }

  // Blocked by name, before any resolution. Relying on DNS to tell us that
  // "localhost" is local would make the rule only as trustworthy as the
  // resolver — and these names should never be fetched under any answer.
  if (isBlockedHostname(hostname)) {
    throw new UnsafeUrlError(`Refusing to fetch a local or internal host: ${hostname}`);
  }

  // An IP literal needs no resolution — judge it directly.
  if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) {
    if (isBlockedAddress(hostname)) {
      throw new UnsafeUrlError(`Refusing to fetch a local or private address: ${hostname}`);
    }
    return url;
  }

  let addresses: string[];
  try {
    addresses = await lookupFn(hostname);
  } catch {
    throw new UnsafeUrlError(`Could not resolve host: ${hostname}`);
  }

  if (addresses.length === 0) {
    throw new UnsafeUrlError(`Could not resolve host: ${hostname}`);
  }
  // Every resolved address must be public: one bad entry is enough to be used.
  for (const address of addresses) {
    if (isBlockedAddress(address)) {
      throw new UnsafeUrlError(
        `Refusing to fetch ${hostname} — it resolves to a local or private address (${address}).`,
      );
    }
  }

  return url;
}
