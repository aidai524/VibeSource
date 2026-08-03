"use client";

import { useState, type FormEvent } from "react";

import type {
  DemoEvidenceAttempt,
  DemoEvidenceView,
} from "@/domain/demo-evidence";
import type { EditorRole } from "@/domain/editor-identity";
import type {
  GitHubEvidenceAttempt,
  GitHubEvidenceView,
} from "@/domain/github-evidence";
import type {
  LicensePolicyReason,
  LicensePolicyView,
} from "@/domain/license-policy";
import type { EditorIdentityMode } from "@/server/features";

function editorHeaders(token: string): HeadersInit | undefined {
  return token
    ? { "x-vibesource-editor-token": token }
    : undefined;
}

type PendingSubmission = {
  readonly id: string;
  readonly version: number;
  readonly status: "pending_review";
  readonly evidenceStatus: "not_checked";
  readonly productName: string;
  readonly summary: string;
  readonly repositoryUrl: string;
  readonly experienceUrl: string;
  readonly aiInvolvement: string;
  readonly techStack: string;
  readonly licenseName: string;
  readonly reuseNotes: string;
  readonly createdAt: string;
  readonly githubEvidence: GitHubEvidenceView;
  readonly demoEvidence: DemoEvidenceView;
  readonly licensePolicy: LicensePolicyView;
};

type QueueResponse = {
  readonly items?: readonly PendingSubmission[];
  readonly capabilities?: {
    readonly githubEvidenceRefresh?: boolean;
    readonly demoEvidenceRefresh?: boolean;
    readonly rejectSubmission?: boolean;
    readonly licenseReview?: boolean;
    readonly role?: EditorRole;
  };
  readonly message?: string;
};

type ReviewCardProps = {
  readonly submission: PendingSubmission;
  readonly token: string;
  readonly githubEvidenceRefreshAvailable: boolean;
  readonly demoEvidenceRefreshAvailable: boolean;
  readonly rejectAvailable: boolean;
  readonly onRejected: (id: string, message: string) => void;
  readonly onStatus: (message: string) => void;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function DemoSnapshot({ attempt }: { readonly attempt: DemoEvidenceAttempt }) {
  if (attempt.outcome !== "success") return null;
  return (
    <div className="githubEvidence__snapshot">
      <p className="githubEvidence__provenance">
        当前时点响应头 · {formatDate(attempt.observedAt)} · {attempt.checkVersion}
      </p>
      <dl className="githubEvidence__facts">
        <div><dt>HTTP</dt><dd>{attempt.httpStatus}</dd></div>
        <div><dt>请求方法</dt><dd>{attempt.method}</dd></div>
        <div><dt>响应耗时</dt><dd>{number(attempt.responseTimeMs)} ms</dd></div>
        <div><dt>固定公网地址</dt><dd>{attempt.resolvedAddress} / IPv{attempt.resolvedFamily}</dd></div>
        <div className="githubEvidence__factWide"><dt>Content-Type</dt><dd>{attempt.contentType ?? "未提供"}</dd></div>
      </dl>
      <p className="githubEvidence__rate">
        <a href={attempt.sourceUrl} target="_blank" rel="noreferrer">打开开发者提交的体验地址</a>
      </p>
    </div>
  );
}

function DemoEvidencePanel({
  submissionId,
  initialEvidence,
  token,
  refreshAvailable,
  onStatus,
}: {
  readonly submissionId: string;
  readonly initialEvidence: DemoEvidenceView;
  readonly token: string;
  readonly refreshAvailable: boolean;
  readonly onStatus: (message: string) => void;
}) {
  const [evidence, setEvidence] = useState(initialEvidence);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [requestError, setRequestError] = useState("");
  const latestFailure = evidence.latestAttempt?.outcome === "error" ? evidence.latestAttempt : null;
  const usable = evidence.latestUsableAttempt;
  const stateLabel = {
    not_checked: "尚未请求",
    observed: "已响应",
    stale: "旧快照",
    error: "验证失败",
  }[evidence.state];

  async function refresh() {
    setIsRefreshing(true);
    setRequestError("");
    onStatus("正在请求并保存 Demo 当前时点响应头证据…");
    try {
      const response = await fetch(
        `/api/editor/submissions/${encodeURIComponent(submissionId)}/demo-evidence/refresh`,
        { method: "POST", headers: editorHeaders(token) },
      );
      const payload = await response.json() as { readonly demoEvidence?: DemoEvidenceView; readonly message?: string };
      if (!response.ok || !payload.demoEvidence) {
        const message = payload.message ?? "Demo 证据验证请求失败。";
        setRequestError(message);
        onStatus(message);
        return;
      }
      setEvidence(payload.demoEvidence);
      onStatus(payload.message ?? "Demo 证据状态已更新。");
    } catch {
      const message = "无法连接审核服务，本次 Demo 尝试没有保存。";
      setRequestError(message);
      onStatus(message);
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <section className="githubEvidence" aria-labelledby={`demo-evidence-${submissionId}`} aria-busy={isRefreshing}>
      <div className="githubEvidence__header">
        <div><p className="eyebrow">DEMO / RESPONSE HEADERS</p><h3 id={`demo-evidence-${submissionId}`}>Demo 可用性证据</h3></div>
        <span className={`evidenceState evidenceState--${evidence.state}`}>{stateLabel}</span>
      </div>
      {evidence.state === "not_checked" ? (
        <p className="githubEvidence__empty">尚未请求体验地址；链接仍是开发者声明。</p>
      ) : null}
      {latestFailure ? (
        <div className="githubEvidence__failure" role="status">
          <strong>{evidence.state === "stale" ? "最新验证失败，下面保留的是旧快照。" : "没有可用的 Demo 快照。"}</strong>
          <p>{latestFailure.errorMessage} · {formatDate(latestFailure.observedAt)} · {latestFailure.errorCode}{latestFailure.httpStatus ? ` · HTTP ${latestFailure.httpStatus}` : ""}</p>
        </div>
      ) : null}
      {usable ? <DemoSnapshot attempt={usable} /> : null}
      <div className="githubEvidence__action">
        <p>
          {refreshAvailable
            ? "每次点击只发起一次固定到已验证公网 IP 的 HTTPS GET，收到响应头后停止；不跟随跳转，不读取正文，也不会批准或发布。"
            : "当前环境没有启用实时验证；页面不会伪装请求或自动访问体验地址。"}
        </p>
        {refreshAvailable ? (
          <button className="button button--outline" type="button" onClick={refresh} disabled={isRefreshing}>
            {isRefreshing ? "验证 Demo（请求中…）" : evidence.state === "not_checked" ? "请求并保存 Demo 响应头" : "重新验证 Demo"}
          </button>
        ) : null}
      </div>
      {requestError ? <p className="formField__error" role="alert">{requestError}</p> : null}
    </section>
  );
}

function ClaimRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="claimRow">
      <dt>{label}<span>开发者自述</span></dt>
      <dd>{value}</dd>
    </div>
  );
}

function number(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

const licenseReasonLabels: Record<LicensePolicyReason, string> = {
  github_evidence_missing: "尚未取得 GitHub 当前时点证据。",
  github_evidence_not_current: "GitHub 最近刷新失败或证据已经过期，需要重新刷新。",
  repository_not_public: "仓库当前证据不是公开状态。",
  license_not_detected: "GitHub Licensee 未从 LICENSE 文件检测到已知许可证。",
  spdx_id_missing: "GitHub 检测结果没有可用的 SPDX 标识。",
  spdx_not_osi_approved: "检测到的 SPDX 标识不在当前 OSI-approved 政策快照中。",
  developer_declaration_mismatch: "开发者声明与 GitHub 检测标识或名称不一致。",
  machine_checks_passed: "当前机器条件一致，可以进入人工许可证复核。",
};

function LicensePolicyPanel({ policy }: { readonly policy: LicensePolicyView }) {
  const stateLabel = {
    not_ready: "证据未就绪",
    needs_manual_review: "需要人工判断",
    ready_for_manual_review: "可进入人工复核",
  }[policy.state];
  const stateClass = policy.state === "ready_for_manual_review"
    ? "observed"
    : policy.state === "not_ready" ? "not_checked" : "stale";

  return (
    <section className="githubEvidence" aria-label="许可证资格策略">
      <div className="githubEvidence__header">
        <div><p className="eyebrow">LICENSE / POLICY GATE</p><h3>许可证资格策略</h3></div>
        <span className={`evidenceState evidenceState--${stateClass}`}>{stateLabel}</span>
      </div>
      <div className="githubEvidence__snapshot">
        <p className="githubEvidence__provenance">
          派生判断 · {policy.policyVersion}
          {policy.basedOnGitHubObservedAt ? ` · 基于 ${formatDate(policy.basedOnGitHubObservedAt)}` : ""}
        </p>
        <dl className="githubEvidence__facts">
          <div><dt>检测 SPDX</dt><dd>{policy.detectedSpdxId ?? "尚无"}</dd></div>
          <div><dt>OSI 快照</dt><dd>{policy.osiApproved === null ? "尚不能判断" : policy.osiApproved ? "存在" : "不存在"}</dd></div>
          <div><dt>声明一致</dt><dd>{policy.developerDeclarationMatches === null ? "尚不能判断" : policy.developerDeclarationMatches ? "一致" : "不一致"}</dd></div>
          <div><dt>快照规模</dt><dd>{number(policy.source.approvedIdentifierCount)} 个标识</dd></div>
        </dl>
        <ul>
          {policy.reasons.map((reason) => <li key={reason}>{licenseReasonLabels[reason]}</li>)}
        </ul>
        <p className="githubEvidence__rate">
          <a href={policy.source.url} target="_blank" rel="noreferrer">SPDX {policy.source.licenseListVersion} 政策来源</a>
          {` · 发布于 ${policy.source.releaseDate.slice(0, 10)}`}
        </p>
      </div>
      <div className="githubEvidence__action">
        <p>这里只检查当前证据、OSI-approved 快照和声明一致性；不判断双许可证、依赖许可证、权利归属或法律有效性，也不会批准发布。</p>
      </div>
    </section>
  );
}

function EvidenceSnapshot({ attempt }: { readonly attempt: GitHubEvidenceAttempt }) {
  if (attempt.outcome !== "success") {
    return null;
  }
  const repository = attempt.repository;
  const license =
    repository.licenseDetection === "detected"
      ? [repository.licenseSpdxId, repository.licenseName]
          .filter(Boolean)
          .join(" · ") || "GitHub 检测到许可证文件"
      : "GitHub 未检测到已知许可证";

  return (
    <div className="githubEvidence__snapshot">
      <p className="githubEvidence__provenance">
        当前时点快照 · {formatDate(attempt.observedAt)} · GitHub API {attempt.apiVersion}
      </p>
      <dl className="githubEvidence__facts">
        <div><dt>仓库</dt><dd><a href={repository.htmlUrl} target="_blank" rel="noreferrer">{repository.fullName}</a></dd></div>
        <div><dt>可见性</dt><dd>{repository.isPrivate ? "私有" : repository.visibility}</dd></div>
        <div><dt>Stars</dt><dd>{number(repository.stars)}</dd></div>
        <div><dt>Forks</dt><dd>{number(repository.forks)}</dd></div>
        <div><dt>Open issues</dt><dd>{number(repository.openIssues)}</dd></div>
        <div><dt>默认分支</dt><dd>{repository.defaultBranch}</dd></div>
        <div><dt>最近 push</dt><dd>{formatDate(repository.pushedAt)}</dd></div>
        <div><dt>仓库形态</dt><dd>{repository.archived ? "已归档" : "未归档"} · {repository.isFork ? "Fork" : "非 Fork"}</dd></div>
        <div className="githubEvidence__factWide"><dt>许可证检测</dt><dd>{license}</dd></div>
      </dl>
      <p className="githubEvidence__rate">
        <a href={attempt.sourceUrl} target="_blank" rel="noreferrer">查看证据来源</a>
        {attempt.rateLimit.remaining === null
          ? " · 限流余量未知"
          : ` · 本次响应后余量 ${attempt.rateLimit.remaining}/${attempt.rateLimit.limit ?? "?"}`}
        {attempt.rateLimit.resetAt ? ` · 重置于 ${formatDate(attempt.rateLimit.resetAt)}` : ""}
      </p>
    </div>
  );
}

function GitHubEvidencePanel({
  submissionId,
  initialEvidence,
  token,
  refreshAvailable,
  onStatus,
  onLicensePolicy,
}: {
  readonly submissionId: string;
  readonly initialEvidence: GitHubEvidenceView;
  readonly token: string;
  readonly refreshAvailable: boolean;
  readonly onStatus: (message: string) => void;
  readonly onLicensePolicy: (policy: LicensePolicyView) => void;
}) {
  const [evidence, setEvidence] = useState(initialEvidence);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [requestError, setRequestError] = useState("");
  const latestFailure =
    evidence.latestAttempt?.outcome === "error" ? evidence.latestAttempt : null;
  const usable = evidence.latestUsableAttempt;
  const stateLabel = {
    not_checked: "尚未请求",
    observed: "已观察",
    stale: "旧快照",
    error: "刷新失败",
  }[evidence.state];

  async function refresh() {
    setIsRefreshing(true);
    setRequestError("");
    onStatus("正在请求并保存 GitHub 当前时点证据…");
    try {
      const response = await fetch(
        `/api/editor/submissions/${encodeURIComponent(submissionId)}/github-evidence/refresh`,
        {
          method: "POST",
          headers: editorHeaders(token),
        },
      );
      const payload = (await response.json()) as {
        readonly githubEvidence?: GitHubEvidenceView;
        readonly licensePolicy?: LicensePolicyView;
        readonly message?: string;
      };
      if (!response.ok || !payload.githubEvidence) {
        const message = payload.message ?? "GitHub 证据刷新请求失败。";
        setRequestError(message);
        onStatus(message);
        return;
      }
      setEvidence(payload.githubEvidence);
      if (payload.licensePolicy) onLicensePolicy(payload.licensePolicy);
      onStatus(payload.message ?? "GitHub 证据状态已更新。");
    } catch {
      const message = "无法连接审核服务，本次 GitHub 尝试没有保存。";
      setRequestError(message);
      onStatus(message);
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <section className="githubEvidence" aria-labelledby={`github-evidence-${submissionId}`} aria-busy={isRefreshing}>
      <div className="githubEvidence__header">
        <div>
          <p className="eyebrow">GITHUB / POINT-IN-TIME</p>
          <h3 id={`github-evidence-${submissionId}`}>GitHub 仓库证据</h3>
        </div>
        <span className={`evidenceState evidenceState--${evidence.state}`}>{stateLabel}</span>
      </div>

      {evidence.state === "not_checked" ? (
        <p className="githubEvidence__empty">尚未向 GitHub 请求仓库数据。开发者声明仍然只是声明。</p>
      ) : null}
      {latestFailure ? (
        <div className="githubEvidence__failure" role="status">
          <strong>{evidence.state === "stale" ? "最新刷新失败，下面保留的是旧快照。" : "没有可用的仓库快照。"}</strong>
          <p>{latestFailure.errorMessage} · {formatDate(latestFailure.observedAt)} · {latestFailure.errorCode}{latestFailure.httpStatus ? ` · HTTP ${latestFailure.httpStatus}` : ""}</p>
        </div>
      ) : null}
      {usable ? <EvidenceSnapshot attempt={usable} /> : null}

      <div className="githubEvidence__action">
        <p>
          {refreshAvailable
            ? "每次点击会发起一次未认证的公开 GitHub API 请求并追加保存结果；不会批准或发布产品。"
            : "当前环境没有启用实时刷新；页面不会伪装请求或自动抓取。"}
        </p>
        {refreshAvailable ? (
          <button className="button button--outline" type="button" onClick={refresh} disabled={isRefreshing}>
            {isRefreshing ? "刷新 GitHub 证据（请求中…）" : evidence.state === "not_checked" ? "请求并保存 GitHub 证据" : "刷新 GitHub 证据"}
          </button>
        ) : null}
      </div>
      {requestError ? <p className="formField__error" role="alert">{requestError}</p> : null}
    </section>
  );
}

function ReviewCard({ submission, token, githubEvidenceRefreshAvailable, demoEvidenceRefreshAvailable, rejectAvailable, onRejected, onStatus }: ReviewCardProps) {
  const [reason, setReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [error, setError] = useState("");
  const [licensePolicy, setLicensePolicy] = useState(submission.licensePolicy);

  async function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRejecting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/editor/submissions/${encodeURIComponent(submission.id)}/reject`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...editorHeaders(token),
          },
          body: JSON.stringify({ reason, expectedVersion: submission.version }),
        },
      );
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? "拒绝操作失败，请刷新队列后重试。");
        return;
      }

      onRejected(submission.id, `已拒绝 ${submission.productName}，理由和编辑身份已写入审计事件。`);
    } catch {
      setError("无法连接审核服务，记录没有被更改。");
    } finally {
      setIsRejecting(false);
    }
  }

  return (
    <article className="reviewCard" aria-labelledby={`submission-${submission.id}`}>
      <header className="reviewCard__header">
        <div>
          <p className="eyebrow">PENDING / VERSION {submission.version}</p>
          <h2 id={`submission-${submission.id}`}>{submission.productName}</h2>
        </div>
        <span className="statusBadge statusBadge--pending">待人工审核</span>
      </header>

      <div className="evidenceWarning">
        <strong>整体仍未核验</strong>
        <p>GitHub 与 Demo 时点证据不能替代许可证法律判断和人工审核，不能据此批准发布。</p>
      </div>

      <GitHubEvidencePanel
        submissionId={submission.id}
        initialEvidence={submission.githubEvidence}
        token={token}
        refreshAvailable={githubEvidenceRefreshAvailable}
        onStatus={onStatus}
        onLicensePolicy={setLicensePolicy}
      />

      <LicensePolicyPanel policy={licensePolicy} />

      <DemoEvidencePanel
        submissionId={submission.id}
        initialEvidence={submission.demoEvidence}
        token={token}
        refreshAvailable={demoEvidenceRefreshAvailable}
        onStatus={onStatus}
      />

      <dl className="claimList">
        <ClaimRow label="产品简介" value={submission.summary} />
        <div className="claimRow">
          <dt>源码地址<span>开发者提交地址</span></dt>
          <dd><a href={submission.repositoryUrl} target="_blank" rel="noreferrer">{submission.repositoryUrl}</a></dd>
        </div>
        <div className="claimRow">
          <dt>体验路径<span>开发者提交地址</span></dt>
          <dd><a href={submission.experienceUrl} target="_blank" rel="noreferrer">{submission.experienceUrl}</a></dd>
        </div>
        <ClaimRow label="AI 参与" value={submission.aiInvolvement} />
        <ClaimRow label="技术栈" value={submission.techStack} />
        <ClaimRow label="许可证声明" value={submission.licenseName} />
        <ClaimRow label="部署与复用" value={submission.reuseNotes} />
      </dl>

      <p className="reviewCard__meta">提交于 {formatDate(submission.createdAt)} · {submission.id}</p>

      {rejectAvailable ? (
        <form className="rejectForm" onSubmit={reject}>
          <label htmlFor={`reason-${submission.id}`}>拒绝理由 <span aria-hidden="true">*</span></label>
          <textarea
            id={`reason-${submission.id}`}
            name="reason"
            required
            minLength={10}
            maxLength={500}
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
            aria-describedby={`reason-hint-${submission.id}${error ? ` reason-error-${submission.id}` : ""}`}
            aria-invalid={error ? "true" : undefined}
          />
          <p className="formField__hint" id={`reason-hint-${submission.id}`}>
            10–500 个字符；理由会与服务器端编辑身份、前后状态和时间一起保存。
          </p>
          {error ? <p className="formField__error" id={`reason-error-${submission.id}`}>{error}</p> : null}
          <button className="button button--danger" type="submit" disabled={isRejecting}>
            {isRejecting ? "拒绝并记录（处理中…）" : "拒绝并记录理由"}
          </button>
        </form>
      ) : (
        <div className="githubEvidence__action">
          <p>当前角色没有拒绝候选产品的权限；页面不会显示无法执行的操作。</p>
        </div>
      )}
    </article>
  );
}

export function ReviewConsole({
  identityMode,
}: {
  readonly identityMode: EditorIdentityMode;
}) {
  const [token, setToken] = useState("");
  const [items, setItems] = useState<readonly PendingSubmission[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [githubEvidenceRefreshAvailable, setGitHubEvidenceRefreshAvailable] = useState(false);
  const [demoEvidenceRefreshAvailable, setDemoEvidenceRefreshAvailable] = useState(false);
  const [rejectAvailable, setRejectAvailable] = useState(false);
  const [editorRole, setEditorRole] = useState<EditorRole | null>(null);

  async function loadQueue(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setIsLoading(true);
    setError("");
    setStatusMessage("正在读取待审核队列…");

    try {
      const response = await fetch("/api/editor/submissions", {
        headers: editorHeaders(token),
        cache: "no-store",
      });
      const payload = (await response.json()) as QueueResponse;
      if (!response.ok || !payload.items) {
        const message = payload.message ?? "无法读取审核队列。";
        setError(message);
        setStatusMessage(message);
        return;
      }

      setItems(payload.items);
      setGitHubEvidenceRefreshAvailable(
        payload.capabilities?.githubEvidenceRefresh === true,
      );
      setDemoEvidenceRefreshAvailable(
        payload.capabilities?.demoEvidenceRefresh === true,
      );
      setRejectAvailable(payload.capabilities?.rejectSubmission === true);
      setEditorRole(payload.capabilities?.role ?? null);
      setStatusMessage(`审核队列已载入，共 ${payload.items.length} 条待审核记录。`);
    } catch {
      const message = "无法连接审核服务。";
      setError(message);
      setStatusMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function signInWithGitHub() {
    setError("");
    setStatusMessage("正在跳转到 GitHub 身份验证…");
    try {
      const { authClient } = await import("@/client/auth-client");
      await authClient.signIn.social({
        provider: "github",
        callbackURL: "/editor/submissions",
      });
    } catch {
      const message = "无法启动 GitHub 身份验证。";
      setError(message);
      setStatusMessage(message);
    }
  }

  return (
    <>
      <div className="srOnly" role="status" aria-live="polite">{statusMessage}</div>
      {identityMode === "local-token" ? (
      <form className="editorGate" onSubmit={loadQueue}>
        <div>
          <label htmlFor="editor-token">本地编辑凭证</label>
          <p id="editor-token-hint">仅保存在当前页面内存，不写入 URL、localStorage 或数据库。</p>
        </div>
        <input
          id="editor-token"
          name="editorToken"
          type="password"
          required
          minLength={16}
          autoComplete="off"
          spellCheck={false}
          value={token}
          onChange={(event) => setToken(event.currentTarget.value)}
          aria-describedby={`editor-token-hint${error ? " editor-token-error" : ""}`}
          aria-invalid={error ? "true" : undefined}
        />
        <button className="button button--primary" type="submit" disabled={isLoading}>
          {isLoading ? "读取队列（处理中…）" : "读取待审核队列"}
        </button>
        {error ? <p className="formField__error" id="editor-token-error" role="alert">{error}</p> : null}
      </form>
      ) : (
        <section className="editorGate" aria-labelledby="github-editor-login-title">
          <div>
            <h2 id="github-editor-login-title">GitHub 编辑身份</h2>
            <p>登录只证明账号身份；还必须在应用数据库中存在未撤销的编辑角色授权。</p>
          </div>
          <button className="button button--primary" type="button" onClick={signInWithGitHub}>
            使用 GitHub 登录
          </button>
          <button className="button button--secondary" type="button" onClick={() => loadQueue()} disabled={isLoading}>
            {isLoading ? "验证会话（处理中…）" : "验证现有会话"}
          </button>
          {error ? <p className="formField__error" role="alert">{error}</p> : null}
        </section>
      )}

      {items ? (
        <section className="reviewQueue" aria-labelledby="review-queue-title">
          <div className="reviewQueue__heading">
            <div><p className="eyebrow">QUEUE / LIVE</p><h2 id="review-queue-title">待审核队列</h2></div>
            <span>{editorRole ? `${editorRole} · ` : ""}{items.length} 条</span>
          </div>
          {items.length === 0 ? (
            <div className="emptyPanel"><h3>当前没有待审核记录</h3><p>这里不会用样例卡片填充空状态。</p></div>
          ) : (
            items.map((submission) => (
              <ReviewCard
                key={submission.id}
                submission={submission}
                token={token}
                githubEvidenceRefreshAvailable={githubEvidenceRefreshAvailable}
                demoEvidenceRefreshAvailable={demoEvidenceRefreshAvailable}
                rejectAvailable={rejectAvailable}
                onStatus={setStatusMessage}
                onRejected={(id, message) => {
                  setItems((current) => current?.filter((item) => item.id !== id) ?? []);
                  setStatusMessage(message);
                }}
              />
            ))
          )}
        </section>
      ) : null}
    </>
  );
}
