// tests/unit/url-safety.test.ts — NFR-SEC-12 SSRF rules.
//
// fetch_url is the only tool that leaves the machine and the URL comes from the
// agent, whose context is shaped by pages it already fetched. These cases are
// the point of the module (NFR-TEST-01).

import { describe, expect, it } from "vitest";

import {
  assertSafeUrl,
  isBlockedAddress,
  isBlockedHostname,
  UnsafeUrlError,
} from "../../backends/url-safety";

const PUBLIC_DNS = async () => ["93.184.216.34"];

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1",
    "127.1.2.3",
    "0.0.0.0",
    "10.0.0.5",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "100.64.0.1", // carrier-grade NAT
    "224.0.0.1", // multicast
    "255.255.255.255",
    "::1",
    "fe80::1", // link-local
    "fd00::1", // unique-local
    "::ffff:127.0.0.1", // IPv4-mapped loopback
  ])("blocks %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each(["93.184.216.34", "8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700::1111"])(
    "allows %s",
    (ip) => {
      expect(isBlockedAddress(ip)).toBe(false);
    },
  );
});

describe("isBlockedHostname", () => {
  it.each([
    "localhost",
    "LOCALHOST",
    "foo.localhost",
    "printer.local",
    "metadata.google.internal",
    "anything.internal",
    "host.localdomain",
  ])("blocks %s by name", (hostname) => {
    expect(isBlockedHostname(hostname)).toBe(true);
  });

  it.each(["example.com", "localhost.example.com", "mylocal.dev"])("allows %s", (hostname) => {
    expect(isBlockedHostname(hostname)).toBe(false);
  });
});

describe("assertSafeUrl", () => {
  it("accepts a public https URL", async () => {
    const url = await assertSafeUrl("https://example.com/article", PUBLIC_DNS);
    expect(url.hostname).toBe("example.com");
  });

  it.each([
    "file:///etc/passwd",
    "ftp://example.com/x",
    "data:text/html,<script>",
    "javascript:alert(1)",
  ])("rejects non-http scheme %s", async (raw) => {
    await expect(assertSafeUrl(raw, PUBLIC_DNS)).rejects.toThrow(UnsafeUrlError);
  });

  it.each(["http://127.0.0.1/", "http://[::1]/", "http://192.168.0.1/", "http://0.0.0.0/"])(
    "rejects the IP literal %s without resolving",
    async (raw) => {
      // The lookup would say "public"; the literal must be judged directly.
      await expect(assertSafeUrl(raw, PUBLIC_DNS)).rejects.toThrow(UnsafeUrlError);
    },
  );

  it("rejects localhost without trusting the resolver", async () => {
    await expect(assertSafeUrl("http://localhost:8080/admin", PUBLIC_DNS)).rejects.toThrow(
      /local or internal host/,
    );
  });

  it("rejects a public-looking name that resolves to a private address", async () => {
    const lookup = async () => ["10.1.2.3"];
    await expect(assertSafeUrl("https://sneaky.example.com/", lookup)).rejects.toThrow(
      /resolves to a local or private address/,
    );
  });

  it("rejects when any one of several answers is private", async () => {
    // One usable bad answer is enough; the client may pick it.
    const lookup = async () => ["93.184.216.34", "127.0.0.1"];
    await expect(assertSafeUrl("https://mixed.example.com/", lookup)).rejects.toThrow(
      UnsafeUrlError,
    );
  });

  it("rejects a host that does not resolve", async () => {
    const lookup = async () => {
      throw new Error("ENOTFOUND");
    };
    await expect(assertSafeUrl("https://nope.example.com/", lookup)).rejects.toThrow(
      /Could not resolve/,
    );
  });

  it("rejects an empty resolution", async () => {
    await expect(assertSafeUrl("https://empty.example.com/", async () => [])).rejects.toThrow(
      /Could not resolve/,
    );
  });

  it("rejects malformed input", async () => {
    await expect(assertSafeUrl("not a url", PUBLIC_DNS)).rejects.toThrow(UnsafeUrlError);
  });
});
