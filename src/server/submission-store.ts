import type { DemoEvidenceResult, DemoEvidenceView } from "@/domain/demo-evidence";
import type { GitHubEvidenceResult, GitHubEvidenceView } from "@/domain/github-evidence";
import type {
  RejectSubmissionInput,
  ReviewEvent,
  Submission,
  SubmissionInput,
} from "@/domain/submission";

type MaybePromise<T> = T | Promise<T>;

export interface SubmissionStoreRepository {
  createSubmission(
    input: SubmissionInput,
    idempotencyKey: string,
  ): MaybePromise<Submission>;
  getSubmission(id: string): MaybePromise<Submission | null>;
  listPending(): MaybePromise<Submission[]>;
  recordGitHubEvidenceAttempt(
    submissionId: string,
    actor: string,
    result: GitHubEvidenceResult,
  ): MaybePromise<GitHubEvidenceView>;
  getGitHubEvidence(submissionId: string): MaybePromise<GitHubEvidenceView>;
  recordDemoEvidenceAttempt(
    submissionId: string,
    actor: string,
    result: DemoEvidenceResult,
  ): MaybePromise<DemoEvidenceView>;
  getDemoEvidence(submissionId: string): MaybePromise<DemoEvidenceView>;
  rejectSubmission(
    id: string,
    input: RejectSubmissionInput,
  ): MaybePromise<Submission>;
  listReviewEvents(submissionId: string): MaybePromise<ReviewEvent[]>;
}
