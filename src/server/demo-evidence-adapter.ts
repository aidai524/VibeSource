import { promises as dns } from "node:dns";
import * as https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

import {
  DEMO_EVIDENCE_CHECK_VERSION,
  type DemoEvidenceErrorCode,
  type DemoEvidenceFailure,
  type DemoEvidenceResult,
  type DemoEvidenceSuccess,
} from "@/domain/demo-evidence";
import { normalizeExperienceUrl } from "@/domain/submission";

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_HEADER_SIZE = 16_384;

type ResolvedAddress = { readonly address: string; readonly family: 4 | 6 };
type ProbeResult = {
  readonly httpStatus: number;
  readonly contentType: string | null;
  readonly responseTimeMs: number;
};

export interface DemoTransportErrorOptions {
  readonly code: DemoEvidenceErrorCode;
  readonly httpStatus?: number | null;
  readonly contentType?: string | null;
  readonly responseTimeMs?: number | null;
}

export class DemoTransportError extends Error {
  readonly code: DemoEvidenceErrorCode;
  readonly httpStatus: number | null;
  readonly contentType: string | null;
  readonly responseTimeMs: number | null;

  constructor(message: string, options: DemoTransportErrorOptions) {
    super(message);
    this.name = "DemoTransportError";
    this.code = options.code;
    this.httpStatus = options.httpStatus ?? null;
    this.contentType = options.contentType ?? null;
    this.responseTimeMs = options.responseTimeMs ?? null;
  }
}

type Resolver = (hostname: string) => Promise<readonly ResolvedAddress[]>;
type Probe = (
  url: URL,
  address: ResolvedAddress,
  timeoutMs: number,
) => Promise<ProbeResult>;

export interface DemoEvidenceAdapterDependencies {
  readonly resolve?: Resolver;
  readonly probe?: Probe;
  readonly now?: () => Date;
  readonly timeoutMs?: number;
}

const nonPublicAddresses = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) nonPublicAddresses.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b:1::", 48], ["100::", 64],
  ["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["5f00::", 16],
  ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) nonPublicAddresses.addSubnet(network, prefix, "ipv6");

function isPublicIpv4(address: string): boolean {
  return isIP(address) === 4 && !nonPublicAddresses.check(address, "ipv4");
}

function ipv4FromMappedIpv6(address: string): string | null {
  const normalized = address.toLowerCase();
  const dotted = normalized.match(/^(?:::ffff:|::)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return dotted[1];
  const hex = normalized.match(/^(?:::ffff:|::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return null;
  const high = Number.parseInt(hex[1], 16);
  const low = Number.parseInt(hex[2], 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

function isPublicIpv6(address: string): boolean {
  if (isIP(address) !== 6) return false;
  const normalized = address.toLowerCase().split("%")[0];
  const mapped = ipv4FromMappedIpv6(normalized);
  if (mapped !== null) return isPublicIpv4(mapped);
  return !nonPublicAddresses.check(normalized, "ipv6");
}

export function isPublicInternetAddress(address: string): boolean {
  return isIP(address) === 4
    ? isPublicIpv4(address)
    : isIP(address) === 6 && isPublicIpv6(address);
}

async function defaultResolve(hostname: string): Promise<readonly ResolvedAddress[]> {
  const literalFamily = isIP(hostname);
  if (literalFamily === 4 || literalFamily === 6) {
    return [{ address: hostname, family: literalFamily }];
  }
  const resolved = await dns.lookup(hostname, { all: true, order: "verbatim" });
  return resolved.flatMap(({ address, family }) =>
    family === 4 || family === 6 ? [{ address, family }] : [],
  );
}

export function createPinnedRequestOptions(
  url: URL,
  pinned: ResolvedAddress,
  timeoutMs: number,
): https.RequestOptions {
  const lookup: LookupFunction = (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [pinned]);
    } else {
      callback(null, pinned.address, pinned.family);
    }
  };

  return {
    protocol: "https:",
    hostname: url.hostname,
    port: url.port || 443,
    path: `${url.pathname}${url.search}`,
    method: "GET",
    servername: isIP(url.hostname) === 0 ? url.hostname : undefined,
    agent: false,
    rejectUnauthorized: true,
    lookup,
    timeout: timeoutMs,
    maxHeaderSize: MAX_HEADER_SIZE,
    headers: {
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
      "user-agent": "VibeSource-M2.2b1-local-verifier",
    },
  };
}

function transportError(error: unknown): DemoTransportError {
  if (error instanceof DemoTransportError) return error;
  const code = error instanceof Error && "code" in error
    ? String((error as NodeJS.ErrnoException).code ?? "")
    : "";
  const isTls =
    code.startsWith("CERT_") ||
    code.startsWith("ERR_TLS") ||
    ["DEPTH_ZERO_SELF_SIGNED_CERT", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"].includes(code);
  return new DemoTransportError(
    isTls
      ? "The Demo TLS certificate could not be verified."
      : "The Demo request failed before response headers were received.",
    { code: isTls ? "tls_error" : "network_error" },
  );
}

export function probePinnedHttps(
  url: URL,
  pinned: ResolvedAddress,
  timeoutMs: number,
): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const request = https.request(createPinnedRequestOptions(url, pinned, timeoutMs), (response) => {
      const responseTimeMs = Math.max(0, Math.round(performance.now() - startedAt));
      const httpStatus = response.statusCode;
      const contentType = typeof response.headers["content-type"] === "string"
        ? response.headers["content-type"].slice(0, 300)
        : null;
      response.destroy();
      if (httpStatus === undefined) {
        reject(new DemoTransportError("The Demo returned no HTTP status.", {
          code: "invalid_response",
          contentType,
          responseTimeMs,
        }));
        return;
      }
      resolve({ httpStatus, contentType, responseTimeMs });
    });
    request.once("timeout", () => {
      request.destroy(new DemoTransportError("The Demo request timed out.", { code: "timeout" }));
    });
    request.once("error", (error) => reject(transportError(error)));
    request.end();
  });
}

function failure(
  sourceUrl: string,
  observedAt: string,
  code: DemoEvidenceErrorCode,
  message: string,
  details: Partial<Omit<DemoEvidenceFailure, "outcome" | "sourceUrl" | "checkVersion" | "observedAt" | "method" | "errorCode" | "errorMessage">> = {},
): DemoEvidenceFailure {
  return {
    outcome: "error",
    sourceUrl,
    checkVersion: DEMO_EVIDENCE_CHECK_VERSION,
    observedAt,
    method: "GET",
    httpStatus: details.httpStatus ?? null,
    contentType: details.contentType ?? null,
    resolvedAddress: details.resolvedAddress ?? null,
    resolvedFamily: details.resolvedFamily ?? null,
    responseTimeMs: details.responseTimeMs ?? null,
    errorCode: code,
    errorMessage: message.slice(0, 500),
  };
}

export class DemoEvidenceAdapter {
  private readonly resolve: Resolver;
  private readonly probe: Probe;
  private readonly now: () => Date;
  private readonly timeoutMs: number;

  constructor(dependencies: DemoEvidenceAdapterDependencies = {}) {
    this.resolve = dependencies.resolve ?? defaultResolve;
    this.probe = dependencies.probe ?? probePinnedHttps;
    this.now = dependencies.now ?? (() => new Date());
    this.timeoutMs = dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async observe(experienceUrl: string): Promise<DemoEvidenceResult> {
    const sourceUrl = normalizeExperienceUrl(experienceUrl);
    const url = new URL(sourceUrl);
    let addresses: readonly ResolvedAddress[];
    try {
      addresses = await this.resolve(url.hostname);
    } catch {
      return failure(sourceUrl, this.now().toISOString(), "dns_resolution_failed", "The Demo hostname could not be resolved.");
    }
    if (addresses.length === 0) {
      return failure(sourceUrl, this.now().toISOString(), "dns_resolution_failed", "The Demo hostname resolved to no usable address.");
    }
    if (addresses.some(({ address }) => !isPublicInternetAddress(address))) {
      return failure(sourceUrl, this.now().toISOString(), "unsafe_address", "The Demo hostname resolved to a non-public or reserved address.");
    }

    const pinned = addresses[0];
    try {
      const response = await this.probe(url, pinned, this.timeoutMs);
      const observedAt = this.now().toISOString();
      const base = {
        sourceUrl,
        checkVersion: DEMO_EVIDENCE_CHECK_VERSION as typeof DEMO_EVIDENCE_CHECK_VERSION,
        observedAt,
        method: "GET" as const,
        httpStatus: response.httpStatus,
        contentType: response.contentType,
        resolvedAddress: pinned.address,
        resolvedFamily: pinned.family,
        responseTimeMs: response.responseTimeMs,
      };
      if (response.httpStatus >= 200 && response.httpStatus < 300) {
        const success: DemoEvidenceSuccess = { ...base, outcome: "success", errorCode: null, errorMessage: null };
        return success;
      }
      const redirect = response.httpStatus >= 300 && response.httpStatus < 400;
      return failure(
        sourceUrl,
        observedAt,
        redirect ? "redirect_blocked" : "http_error",
        redirect
          ? `The Demo returned HTTP ${response.httpStatus}; redirects are not followed.`
          : `The Demo returned HTTP ${response.httpStatus}.`,
        base,
      );
    } catch (error) {
      const typed = transportError(error);
      return failure(sourceUrl, this.now().toISOString(), typed.code, typed.message, {
        httpStatus: typed.httpStatus,
        contentType: typed.contentType,
        resolvedAddress: pinned.address,
        resolvedFamily: pinned.family,
        responseTimeMs: typed.responseTimeMs,
      });
    }
  }
}
