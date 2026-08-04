import { describe, expect, it, vi } from "vitest";

import { GITHUB_API_VERSION } from "@/domain/github-evidence";
import { GitHubEvidenceAdapter } from "@/server/github-evidence-adapter";

const repositoryResponse = {
  id: 10270250,
  full_name: "facebook/react",
  html_url: "https://github.com/facebook/react",
  visibility: "public",
  private: false,
  archived: false,
  fork: false,
  default_branch: "main",
  pushed_at: "2026-08-02T08:30:00Z",
  stargazers_count: 240000,
  forks_count: 49000,
  open_issues_count: 1000,
  license: {
    key: "mit",
    name: "MIT License",
    spdx_id: "MIT",
    url: "https://api.github.com/licenses/mit",
  },
};

function adapterFor(response: Response) {
  const fetchImpl = vi.fn(async () => response) as unknown as typeof fetch;
  return {
    fetchImpl,
    adapter: new GitHubEvidenceAdapter({
      fetchImpl,
      now: () => new Date("2026-08-03T03:00:00.000Z"),
    }),
  };
}

describe("GitHubEvidenceAdapter", () => {
  it("captures a strict public repository snapshot and provenance", async () => {
    const { adapter, fetchImpl } = adapterFor(
      Response.json(repositoryResponse, {
        headers: {
          "x-ratelimit-limit": "60",
          "x-ratelimit-remaining": "59",
          "x-ratelimit-reset": "1785733200",
        },
      }),
    );

    const result = await adapter.observe("https://github.com/Facebook/React");

    expect(result).toMatchObject({
      outcome: "success",
      sourceUrl: "https://api.github.com/repos/facebook/react",
      apiVersion: GITHUB_API_VERSION,
      observedAt: "2026-08-03T03:00:00.000Z",
      httpStatus: 200,
      rateLimit: { limit: 60, remaining: 59 },
      repository: {
        repositoryId: "10270250",
        fullName: "facebook/react",
        isPrivate: false,
        stars: 240000,
        licenseDetection: "detected",
        licenseSpdxId: "MIT",
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.github.com/repos/facebook/react",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "x-github-api-version": GITHUB_API_VERSION,
        }),
        redirect: "manual",
      }),
    );
  });

  it("records a public not-found response without parsing untrusted body text", async () => {
    const { adapter } = adapterFor(
      Response.json(
        { message: "Not Found", injected: "must not be stored" },
        { status: 404 },
      ),
    );

    await expect(
      adapter.observe("https://github.com/example/missing"),
    ).resolves.toMatchObject({
      outcome: "error",
      errorCode: "not_found",
      httpStatus: 404,
      repository: null,
    });
  });

  it("distinguishes a rate limit response and captures the reset window", async () => {
    const { adapter } = adapterFor(
      new Response("rate limited", {
        status: 403,
        headers: {
          "x-ratelimit-limit": "60",
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": "1785733200",
        },
      }),
    );

    await expect(
      adapter.observe("https://github.com/facebook/react"),
    ).resolves.toMatchObject({
      outcome: "error",
      errorCode: "rate_limited",
      rateLimit: { limit: 60, remaining: 0 },
    });
  });

  it("does not follow repository redirects into an unrecorded second request", async () => {
    const { adapter, fetchImpl } = adapterFor(
      new Response(null, {
        status: 301,
        headers: { location: "https://api.github.com/repositories/10270250" },
      }),
    );

    await expect(
      adapter.observe("https://github.com/facebook/react"),
    ).resolves.toMatchObject({
      outcome: "error",
      errorCode: "github_http_error",
      httpStatus: 301,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fails truthfully when a successful response has the wrong shape", async () => {
    const { adapter } = adapterFor(Response.json({ id: 1 }));

    await expect(
      adapter.observe("https://github.com/facebook/react"),
    ).resolves.toMatchObject({
      outcome: "error",
      errorCode: "invalid_response",
      httpStatus: 200,
    });
  });

  it("fails once without retrying when the network rejects", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("socket details must not leak");
    }) as unknown as typeof fetch;
    const adapter = new GitHubEvidenceAdapter({ fetchImpl });

    const result = await adapter.observe("https://github.com/facebook/react");

    expect(result).toMatchObject({
      outcome: "error",
      errorCode: "network_error",
      errorMessage: "GitHub request failed before a response was received.",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("aborts and records a timeout without retrying", async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    ) as unknown as typeof fetch;
    const adapter = new GitHubEvidenceAdapter({ fetchImpl, timeoutMs: 1 });

    await expect(
      adapter.observe("https://github.com/facebook/react"),
    ).resolves.toMatchObject({ outcome: "error", errorCode: "timeout" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
