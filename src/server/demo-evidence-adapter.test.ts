import { describe, expect, it, vi } from "vitest";

import {
  createPinnedRequestOptions,
  DemoEvidenceAdapter,
  DemoTransportError,
  isPublicInternetAddress,
} from "@/server/demo-evidence-adapter";

const fixedNow = () => new Date("2026-08-03T04:05:06.000Z");
const publicAddress = { address: "93.184.216.34", family: 4 as const };

describe("DemoEvidenceAdapter", () => {
  it.each([
    ["93.184.216.34", true],
    ["8.8.8.8", true],
    ["127.0.0.1", false],
    ["10.0.0.4", false],
    ["169.254.169.254", false],
    ["192.168.1.3", false],
    ["192.0.2.8", false],
    ["::1", false],
    ["fc00::1", false],
    ["fe80::1", false],
    ["2001:db8::1", false],
    ["100::1", false],
    ["2002:7f00:1::", false],
    ["::ffff:127.0.0.1", false],
    ["2606:4700:4700::1111", true],
  ])("classifies %s public=%s", (address, expected) => {
    expect(isPublicInternetAddress(address)).toBe(expected);
  });

  it("refuses the whole hostname when any resolved address is unsafe", async () => {
    const probe = vi.fn();
    const adapter = new DemoEvidenceAdapter({
      now: fixedNow,
      resolve: async () => [publicAddress, { address: "127.0.0.1", family: 4 }],
      probe,
    });
    await expect(adapter.observe("https://demo.example.com/try")).resolves.toMatchObject({
      outcome: "error",
      errorCode: "unsafe_address",
      resolvedAddress: null,
    });
    expect(probe).not.toHaveBeenCalled();
  });

  it("records one successful header-only probe against the selected public address", async () => {
    const probe = vi.fn().mockResolvedValue({
      httpStatus: 200,
      contentType: "text/html; charset=utf-8",
      responseTimeMs: 83,
    });
    const adapter = new DemoEvidenceAdapter({
      now: fixedNow,
      resolve: async () => [publicAddress],
      probe,
      timeoutMs: 1_234,
    });
    const result = await adapter.observe("https://demo.example.com/try?mode=qa");
    expect(result).toMatchObject({
      outcome: "success",
      sourceUrl: "https://demo.example.com/try?mode=qa",
      httpStatus: 200,
      resolvedAddress: publicAddress.address,
      responseTimeMs: 83,
      errorCode: null,
    });
    expect(probe).toHaveBeenCalledOnce();
    expect(probe).toHaveBeenCalledWith(new URL("https://demo.example.com/try?mode=qa"), publicAddress, 1_234);
  });

  it.each([
    [302, "redirect_blocked"],
    [404, "http_error"],
  ] as const)("stores HTTP %i as %s without retrying", async (status, code) => {
    const probe = vi.fn().mockResolvedValue({ httpStatus: status, contentType: null, responseTimeMs: 20 });
    const adapter = new DemoEvidenceAdapter({ now: fixedNow, resolve: async () => [publicAddress], probe });
    await expect(adapter.observe("https://demo.example.com/")).resolves.toMatchObject({
      outcome: "error",
      errorCode: code,
      httpStatus: status,
      resolvedAddress: publicAddress.address,
    });
    expect(probe).toHaveBeenCalledOnce();
  });

  it.each([
    ["timeout", "timeout"],
    ["tls_error", "tls_error"],
    ["network_error", "network_error"],
  ] as const)("preserves the structured %s transport failure", async (transportCode, expected) => {
    const probe = vi.fn().mockRejectedValue(new DemoTransportError("safe message", { code: transportCode }));
    const adapter = new DemoEvidenceAdapter({ now: fixedNow, resolve: async () => [publicAddress], probe });
    await expect(adapter.observe("https://demo.example.com/")).resolves.toMatchObject({
      outcome: "error",
      errorCode: expected,
      errorMessage: "safe message",
    });
  });

  it("records DNS failure without calling the network transport", async () => {
    const probe = vi.fn();
    const adapter = new DemoEvidenceAdapter({
      now: fixedNow,
      resolve: async () => { throw new Error("do not persist this resolver detail"); },
      probe,
    });
    await expect(adapter.observe("https://demo.example.com/")).resolves.toMatchObject({
      outcome: "error",
      errorCode: "dns_resolution_failed",
      errorMessage: "The Demo hostname could not be resolved.",
    });
    expect(probe).not.toHaveBeenCalled();
  });
});

describe("pinned HTTPS request options", () => {
  it("keeps Host and TLS identity while pinning socket lookup and disabling pooling", () => {
    const options = createPinnedRequestOptions(
      new URL("https://demo.example.com:8443/path?q=1"),
      publicAddress,
      8_000,
    );
    expect(options).toMatchObject({
      protocol: "https:",
      hostname: "demo.example.com",
      servername: "demo.example.com",
      port: "8443",
      path: "/path?q=1",
      method: "GET",
      agent: false,
      rejectUnauthorized: true,
      timeout: 8_000,
      maxHeaderSize: 16_384,
    });
    const callback = vi.fn();
    options.lookup?.("demo.example.com", { all: false }, callback);
    expect(callback).toHaveBeenCalledWith(null, publicAddress.address, 4);
  });
});
