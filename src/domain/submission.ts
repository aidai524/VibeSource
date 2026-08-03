import { isIP } from "node:net";

export const SUBMISSION_FIELD_LIMITS = {
  productName: { min: 2, max: 80 },
  summary: { min: 20, max: 500 },
  repositoryUrl: { min: 1, max: 2048 },
  experienceUrl: { min: 1, max: 2048 },
  aiInvolvement: { min: 20, max: 1000 },
  techStack: { min: 2, max: 500 },
  licenseName: { min: 2, max: 120 },
  reuseNotes: { min: 20, max: 2000 },
} as const;

export const IDEMPOTENCY_KEY_LIMITS = { min: 8, max: 200 } as const;
export const REVIEW_ACTOR_LIMITS = { min: 1, max: 160 } as const;
export const REVIEW_REASON_LIMITS = { min: 10, max: 500 } as const;

export type AiInvolvement = string;
export type EvidenceStatus = "not_checked";
export type SubmissionStatus = "pending_review" | "rejected";
export type ReviewEventType = "submitted" | "rejected";

export interface SubmissionInput {
  productName: string;
  summary: string;
  repositoryUrl: string;
  experienceUrl: string;
  aiInvolvement: AiInvolvement;
  techStack: string;
  licenseName: string;
  reuseNotes: string;
}

export type NormalizedSubmissionInput = Readonly<SubmissionInput>;

export interface Submission extends NormalizedSubmissionInput {
  id: string;
  status: SubmissionStatus;
  evidenceStatus: EvidenceStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewEvent {
  id: string;
  submissionId: string;
  eventType: ReviewEventType;
  fromStatus: SubmissionStatus | null;
  toStatus: SubmissionStatus;
  actor: string;
  reason: string;
  createdAt: string;
}

export interface RejectSubmissionInput {
  actor: string;
  reason: string;
  expectedVersion: number;
}

export type SubmissionValidationField =
  | keyof SubmissionInput
  | "idempotencyKey"
  | "actor"
  | "reason"
  | "expectedVersion"
  | "submissionId";

export class SubmissionValidationError extends Error {
  readonly code = "validation_error";

  constructor(
    readonly field: SubmissionValidationField,
    message: string,
  ) {
    super(message);
    this.name = "SubmissionValidationError";
  }
}

export type SubmissionConflictReason = "repository" | "version" | "state";

export class SubmissionConflictError extends Error {
  readonly code = "submission_conflict";

  constructor(
    readonly reason: SubmissionConflictReason,
    message: string,
  ) {
    super(message);
    this.name = "SubmissionConflictError";
  }
}

export class SubmissionNotFoundError extends Error {
  readonly code = "submission_not_found";

  constructor(readonly submissionId: string) {
    super(`Submission ${submissionId} was not found.`);
    this.name = "SubmissionNotFoundError";
  }
}

export class SubmissionStateError extends SubmissionConflictError {
  constructor(message: string) {
    super("state", message);
    this.name = "SubmissionStateError";
  }
}

function requireRecord(
  value: unknown,
  field: SubmissionValidationField,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SubmissionValidationError(
      field,
      "Input must be an object.",
    );
  }

  return value as Record<string, unknown>;
}

export function normalizeBoundedString(
  value: unknown,
  field: SubmissionValidationField,
  limits: { min: number; max: number },
): string {
  if (typeof value !== "string") {
    throw new SubmissionValidationError(field, `${field} must be a string.`);
  }

  const normalized = value.trim();
  if (normalized.length < limits.min) {
    throw new SubmissionValidationError(
      field,
      `${field} must contain at least ${limits.min} characters after trimming.`,
    );
  }
  if (normalized.length > limits.max) {
    throw new SubmissionValidationError(
      field,
      `${field} must contain no more than ${limits.max} characters.`,
    );
  }

  return normalized;
}

export function normalizeRepositoryUrl(value: unknown): string {
  const rawUrl = normalizeBoundedString(
    value,
    "repositoryUrl",
    SUBMISSION_FIELD_LIMITS.repositoryUrl,
  );

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SubmissionValidationError(
      "repositoryUrl",
      "repositoryUrl must be a valid URL.",
    );
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname.toLowerCase().replace(/\.$/, "") !== "github.com" ||
    parsed.port !== "" ||
    parsed.username !== "" ||
    parsed.password !== ""
  ) {
    throw new SubmissionValidationError(
      "repositoryUrl",
      "repositoryUrl must use https://github.com without credentials or a port.",
    );
  }

  const pathMatch = parsed.pathname.match(/^\/([^/]+)\/([^/]+)\/?$/);
  if (!pathMatch) {
    throw new SubmissionValidationError(
      "repositoryUrl",
      "repositoryUrl must identify exactly one GitHub owner and repository.",
    );
  }

  const owner = pathMatch[1];
  const repository = pathMatch[2].replace(/\.git$/i, "");
  const validOwner =
    owner.length <= 39 &&
    /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(owner);
  const validRepository =
    repository.length >= 1 &&
    repository.length <= 100 &&
    /^[a-zA-Z0-9._-]+$/.test(repository) &&
    !/^\.+$/.test(repository);

  if (!validOwner || !validRepository) {
    throw new SubmissionValidationError(
      "repositoryUrl",
      "repositoryUrl contains an invalid GitHub owner or repository name.",
    );
  }

  return `https://github.com/${owner.toLowerCase()}/${repository.toLowerCase()}`;
}

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return null;
  }

  const bytes = parts.map((part) => Number(part));
  if (
    bytes.some(
      (part, index) =>
        !Number.isInteger(part) ||
        part < 0 ||
        part > 255 ||
        String(part) !== parts[index],
    )
  ) {
    return null;
  }

  return bytes;
}

function isPrivateIpv4(bytes: readonly number[]): boolean {
  const [first, second] = bytes;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

function parseIpv6(hostname: string): number[] | null {
  let input = hostname.toLowerCase();
  if (input.startsWith("[") && input.endsWith("]")) {
    input = input.slice(1, -1);
  }

  if (input.includes(".")) {
    const finalColon = input.lastIndexOf(":");
    const ipv4 = parseIpv4(input.slice(finalColon + 1));
    if (finalColon === -1 || ipv4 === null) {
      return null;
    }
    input = `${input.slice(0, finalColon)}:${(
      ipv4[0] * 256 +
      ipv4[1]
    ).toString(16)}:${(ipv4[2] * 256 + ipv4[3]).toString(16)}`;
  }

  const halves = input.split("::");
  if (halves.length > 2) {
    return null;
  }

  const left = halves[0] === "" ? [] : halves[0].split(":");
  const right =
    halves.length === 1 || halves[1] === "" ? [] : halves[1].split(":");
  const omittedCount = 8 - left.length - right.length;
  if (
    (halves.length === 1 && omittedCount !== 0) ||
    (halves.length === 2 && omittedCount < 1)
  ) {
    return null;
  }

  const groups = [
    ...left,
    ...Array.from({ length: omittedCount }, () => "0"),
    ...right,
  ];
  if (
    groups.length !== 8 ||
    groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))
  ) {
    return null;
  }

  return groups.flatMap((group) => {
    const value = Number.parseInt(group, 16);
    return [value >> 8, value & 0xff];
  });
}

function isPrivateIpv6(bytes: readonly number[]): boolean {
  const isUnspecified = bytes.every((byte) => byte === 0);
  const isLoopback =
    bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1;
  const isUniqueLocal = (bytes[0] & 0xfe) === 0xfc;
  const isLinkLocal = bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80;
  const isIpv4Mapped =
    bytes.slice(0, 10).every((byte) => byte === 0) &&
    bytes[10] === 0xff &&
    bytes[11] === 0xff;
  const isIpv4Compatible = bytes.slice(0, 12).every((byte) => byte === 0);

  return (
    isUnspecified ||
    isLoopback ||
    isUniqueLocal ||
    isLinkLocal ||
    ((isIpv4Mapped || isIpv4Compatible) && isPrivateIpv4(bytes.slice(12)))
  );
}

export function isPrivateOrLocalHostname(hostname: string): boolean {
  const normalized = hostname
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\.$/, "");

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized === "local" ||
    normalized.endsWith(".localdomain")
  ) {
    return true;
  }

  const ipVersion = isIP(normalized);
  if (ipVersion === 4) {
    const bytes = parseIpv4(normalized);
    return bytes === null || isPrivateIpv4(bytes);
  }
  if (ipVersion === 6) {
    const bytes = parseIpv6(normalized);
    return bytes === null || isPrivateIpv6(bytes);
  }

  return false;
}

export function validateExperienceUrl(value: unknown): string {
  const rawUrl = normalizeBoundedString(
    value,
    "experienceUrl",
    SUBMISSION_FIELD_LIMITS.experienceUrl,
  );

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SubmissionValidationError(
      "experienceUrl",
      "experienceUrl must be a valid URL.",
    );
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname === "" ||
    parsed.username !== "" ||
    parsed.password !== ""
  ) {
    throw new SubmissionValidationError(
      "experienceUrl",
      "experienceUrl must be an https URL without embedded credentials.",
    );
  }

  if (isPrivateOrLocalHostname(parsed.hostname)) {
    throw new SubmissionValidationError(
      "experienceUrl",
      "experienceUrl must not target localhost, a .local host, or a private IP address.",
    );
  }

  parsed.hash = "";
  return parsed.toString();
}

export const normalizeExperienceUrl = validateExperienceUrl;

export function normalizeSubmissionInput(
  input: unknown,
): NormalizedSubmissionInput {
  const record = requireRecord(input, "productName");

  return {
    productName: normalizeBoundedString(
      record.productName,
      "productName",
      SUBMISSION_FIELD_LIMITS.productName,
    ),
    summary: normalizeBoundedString(
      record.summary,
      "summary",
      SUBMISSION_FIELD_LIMITS.summary,
    ),
    repositoryUrl: normalizeRepositoryUrl(record.repositoryUrl),
    experienceUrl: validateExperienceUrl(record.experienceUrl),
    aiInvolvement: normalizeBoundedString(
      record.aiInvolvement,
      "aiInvolvement",
      SUBMISSION_FIELD_LIMITS.aiInvolvement,
    ),
    techStack: normalizeBoundedString(
      record.techStack,
      "techStack",
      SUBMISSION_FIELD_LIMITS.techStack,
    ),
    licenseName: normalizeBoundedString(
      record.licenseName,
      "licenseName",
      SUBMISSION_FIELD_LIMITS.licenseName,
    ),
    reuseNotes: normalizeBoundedString(
      record.reuseNotes,
      "reuseNotes",
      SUBMISSION_FIELD_LIMITS.reuseNotes,
    ),
  };
}

export function normalizeIdempotencyKey(value: unknown): string {
  return normalizeBoundedString(
    value,
    "idempotencyKey",
    IDEMPOTENCY_KEY_LIMITS,
  );
}

export function normalizeRejectSubmissionInput(
  input: unknown,
): RejectSubmissionInput {
  const record = requireRecord(input, "reason");
  const expectedVersion = record.expectedVersion;
  if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1) {
    throw new SubmissionValidationError(
      "expectedVersion",
      "expectedVersion must be a positive integer.",
    );
  }

  return {
    actor: normalizeBoundedString(
      record.actor,
      "actor",
      REVIEW_ACTOR_LIMITS,
    ),
    reason: normalizeBoundedString(
      record.reason,
      "reason",
      REVIEW_REASON_LIMITS,
    ),
    expectedVersion: Number(expectedVersion),
  };
}
