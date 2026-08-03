import { describe, expect, it } from "vitest";

import {
  isPrivateOrLocalHostname,
  normalizeRepositoryUrl,
  normalizeSubmissionInput,
  SubmissionValidationError,
  validateExperienceUrl,
  type SubmissionInput,
} from "@/domain/submission";

const validInput: SubmissionInput = {
  productName: "  Open Agent Studio  ",
  summary: "  An open-source workspace for building inspectable AI agents.  ",
  repositoryUrl: " HTTPS://GitHub.com/Example-Org/Open-Agent.git/?tab=readme ",
  experienceUrl: " https://demo.example.com/try#quick-start ",
  aiInvolvement:
    "  AI assists implementation and is also exposed as a product capability.  ",
  techStack: "  Next.js, TypeScript, SQLite  ",
  licenseName: "  Apache-2.0  ",
  reuseNotes:
    "  Clone the repository, configure local environment variables, and run the documented setup.  ",
};

describe("submission input", () => {
  it("trims bounded strings and normalizes repository and experience URLs", () => {
    expect(normalizeSubmissionInput(validInput)).toEqual({
      productName: "Open Agent Studio",
      summary: "An open-source workspace for building inspectable AI agents.",
      repositoryUrl: "https://github.com/example-org/open-agent",
      experienceUrl: "https://demo.example.com/try",
      aiInvolvement:
        "AI assists implementation and is also exposed as a product capability.",
      techStack: "Next.js, TypeScript, SQLite",
      licenseName: "Apache-2.0",
      reuseNotes:
        "Clone the repository, configure local environment variables, and run the documented setup.",
    });
  });

  it.each([
    "http://github.com/owner/repo",
    "https://gitlab.com/owner/repo",
    "https://github.com/owner",
    "https://github.com/owner/repo/issues",
    "https://user@github.com/owner/repo",
    "https://github.com:8443/owner/repo",
  ])("rejects a non-canonical GitHub repository URL: %s", (url) => {
    expect(() => normalizeRepositoryUrl(url)).toThrowError(
      SubmissionValidationError,
    );
  });

  it.each([
    "http://demo.example.com",
    "https://localhost/app",
    "https://preview.local/app",
    "https://127.0.0.1/app",
    "https://10.0.0.4/app",
    "https://172.16.10.2/app",
    "https://192.168.1.5/app",
    "https://[::1]/app",
    "https://[fd00::1]/app",
    "https://[fe80::1]/app",
  ])("rejects a non-public experience URL: %s", (url) => {
    expect(() => validateExperienceUrl(url)).toThrowError(
      SubmissionValidationError,
    );
  });

  it("recognizes explicit local and private address forms without DNS access", () => {
    expect(isPrivateOrLocalHostname("LOCALHOST.")).toBe(true);
    expect(isPrivateOrLocalHostname("192.168.10.3")).toBe(true);
    expect(isPrivateOrLocalHostname("[::ffff:127.0.0.1]")).toBe(true);
    expect(isPrivateOrLocalHostname("demo.example.com")).toBe(false);
  });

  it("reports the field for trimmed minimum and maximum length failures", () => {
    try {
      normalizeSubmissionInput({ ...validInput, productName: " x " });
      throw new Error("Expected productName validation to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(SubmissionValidationError);
      expect((error as SubmissionValidationError).field).toBe("productName");
    }

    try {
      normalizeSubmissionInput({
        ...validInput,
        summary: ` ${"x".repeat(501)} `,
      });
      throw new Error("Expected summary validation to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(SubmissionValidationError);
      expect((error as SubmissionValidationError).field).toBe("summary");
    }
  });

  it("requires every contract field to be a string", () => {
    const inputWithMissingField = { ...validInput } as Record<string, unknown>;
    delete inputWithMissingField.reuseNotes;

    expect(() => normalizeSubmissionInput(inputWithMissingField)).toThrowError(
      expect.objectContaining({ field: "reuseNotes" }),
    );
  });
});
