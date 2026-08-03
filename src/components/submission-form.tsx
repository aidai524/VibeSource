"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEventHandler,
  type FormEvent,
  type KeyboardEvent,
} from "react";

type FieldName =
  | "productName"
  | "summary"
  | "repositoryUrl"
  | "experienceUrl"
  | "aiInvolvement"
  | "techStack"
  | "licenseName"
  | "reuseNotes";

type FieldErrors = Partial<Record<FieldName, string>>;

type SubmissionResult = {
  readonly id: string;
  readonly status: "pending_review";
  readonly version: number;
  readonly createdAt: string;
  readonly evidenceStatus: "not_checked";
};

type ApiError = {
  readonly message?: string;
  readonly issues?: FieldErrors;
};

type SharedFieldProps = {
  readonly error?: string;
  readonly hint: string;
  readonly label: string;
  readonly maxLength: number;
  readonly minLength?: number;
  readonly name: FieldName;
  readonly onChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  readonly placeholder?: string;
};

function fieldDescription(name: FieldName, hasError: boolean): string {
  return hasError ? `${name}-hint ${name}-error` : `${name}-hint`;
}

function TextField({
  error,
  hint,
  label,
  maxLength,
  minLength,
  name,
  onChange,
  placeholder,
  type = "text",
}: SharedFieldProps & { readonly type?: "text" | "url" }) {
  return (
    <div className="formField">
      <label htmlFor={name}>{label} <span aria-hidden="true">*</span></label>
      <input
        id={name}
        name={name}
        type={type}
        required
        minLength={minLength}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={fieldDescription(name, Boolean(error))}
        onChange={onChange}
      />
      <p className="formField__hint" id={`${name}-hint`}>{hint}</p>
      {error ? <p className="formField__error" id={`${name}-error`}>{error}</p> : null}
    </div>
  );
}

function TextAreaField({
  error,
  hint,
  label,
  maxLength,
  minLength,
  name,
  onChange,
  placeholder,
  rows = 5,
}: SharedFieldProps & { readonly rows?: number }) {
  return (
    <div className="formField">
      <label htmlFor={name}>{label} <span aria-hidden="true">*</span></label>
      <textarea
        id={name}
        name={name}
        required
        minLength={minLength}
        maxLength={maxLength}
        placeholder={placeholder}
        rows={rows}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={fieldDescription(name, Boolean(error))}
        onChange={onChange}
      />
      <p className="formField__hint" id={`${name}-hint`}>{hint}</p>
      {error ? <p className="formField__error" id={`${name}-error`}>{error}</p> : null}
    </div>
  );
}

function formValues(form: HTMLFormElement): Record<FieldName, string> {
  const data = new FormData(form);

  return {
    productName: String(data.get("productName") ?? ""),
    summary: String(data.get("summary") ?? ""),
    repositoryUrl: String(data.get("repositoryUrl") ?? ""),
    experienceUrl: String(data.get("experienceUrl") ?? ""),
    aiInvolvement: String(data.get("aiInvolvement") ?? ""),
    techStack: String(data.get("techStack") ?? ""),
    licenseName: String(data.get("licenseName") ?? ""),
    reuseNotes: String(data.get("reuseNotes") ?? ""),
  };
}

export function SubmissionForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const idempotencyKey = useRef(crypto.randomUUID());
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);

  useEffect(() => {
    const firstInvalid = formRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    firstInvalid?.focus();
  }, [fieldErrors]);

  const clearFieldError: ChangeEventHandler<
    HTMLInputElement | HTMLTextAreaElement
  > = (event) => {
    const name = event.currentTarget.name as FieldName;
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});
    setFormError("");
    setStatusMessage("正在保存候选产品…");

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey.current,
        },
        body: JSON.stringify(formValues(event.currentTarget)),
      });
      const payload = (await response.json()) as SubmissionResult & ApiError;

      if (!response.ok) {
        if (payload.issues) setFieldErrors(payload.issues);
        const message = payload.message ?? "提交失败，请检查后重试。";
        setFormError(message);
        setStatusMessage(message);
        return;
      }

      setResult(payload);
      setStatusMessage(`提交成功，编号 ${payload.id}，当前状态为待人工审核。`);
    } catch {
      const message = "无法连接提交服务。你的内容仍保留在表单中，可以稍后重试。";
      setFormError(message);
      setStatusMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (
      event.target instanceof HTMLTextAreaElement &&
      (event.metaKey || event.ctrlKey) &&
      event.key === "Enter"
    ) {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  }

  if (result) {
    return (
      <section className="submissionSuccess" aria-labelledby="submission-success-title">
        <p className="eyebrow">SUBMISSION / SAVED</p>
        <h2 id="submission-success-title">已进入人工审核队列</h2>
        <dl className="resultFacts">
          <div><dt>提交编号</dt><dd>{result.id}</dd></div>
          <div><dt>状态</dt><dd><span className="statusBadge statusBadge--pending">待人工审核</span></dd></div>
          <div><dt>外部证据</dt><dd>尚未检查</dd></div>
        </dl>
        <p>
          这条记录已经真实写入本地审核库，但尚未检查 GitHub 仓库公开性、
          许可证或体验入口，也不会自动出现在公开目录。
        </p>
        <div className="submissionSuccess__actions">
          <button
            className="button button--outline"
            type="button"
            onClick={() => {
              setResult(null);
              setStatusMessage("");
              idempotencyKey.current = crypto.randomUUID();
              requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("input")?.focus());
            }}
          >
            提交另一个候选产品
          </button>
          <Link className="textLink" href="/">返回首页</Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="srOnly" role="status" aria-live="polite">{statusMessage}</div>
      <form
        className="submissionForm"
        ref={formRef}
        onSubmit={handleSubmit}
        onKeyDown={handleFormKeyDown}
      >
        <div className="formSection">
          <div className="formSection__heading">
            <span>01</span>
            <div><h2>产品基本信息</h2><p>先说明它是什么，不写无法验证的增长承诺。</p></div>
          </div>
          <TextField
            name="productName"
            label="产品名称"
            hint="2–80 个字符。"
            minLength={2}
            maxLength={80}
            placeholder="例如：VibeSource"
            error={fieldErrors.productName}
            onChange={clearFieldError}
          />
          <TextAreaField
            name="summary"
            label="产品简介"
            hint="20–500 个字符，说明解决的问题与目标用户。"
            minLength={20}
            maxLength={500}
            placeholder="它解决什么问题，谁会使用它？"
            error={fieldErrors.summary}
            onChange={clearFieldError}
          />
        </div>

        <div className="formSection">
          <div className="formSection__heading">
            <span>02</span>
            <div><h2>源码与体验路径</h2><p>提交时只做格式校验，不会自动访问这些地址。</p></div>
          </div>
          <TextField
            name="repositoryUrl"
            label="GitHub 仓库地址"
            hint="必须是 https://github.com/owner/repository 形状；公开性尚未核验。"
            maxLength={2048}
            type="url"
            placeholder="https://github.com/owner/repository"
            error={fieldErrors.repositoryUrl}
            onChange={clearFieldError}
          />
          <TextField
            name="experienceUrl"
            label="Demo、在线服务或部署说明"
            hint="必须使用 HTTPS；可达性与部署成功尚未核验。"
            maxLength={2048}
            type="url"
            placeholder="https://example.com/demo"
            error={fieldErrors.experienceUrl}
            onChange={clearFieldError}
          />
          <TextField
            name="licenseName"
            label="许可证声明"
            hint="填写仓库声明的许可证；没有时填写“未声明”，平台不会推断可复用权利。"
            minLength={2}
            maxLength={120}
            placeholder="例如：MIT；或：未声明"
            error={fieldErrors.licenseName}
            onChange={clearFieldError}
          />
        </div>

        <div className="formSection">
          <div className="formSection__heading">
            <span>03</span>
            <div><h2>AI 参与与复用说明</h2><p>先保存原始说明，不提前套入尚未决定的分类。</p></div>
          </div>
          <TextAreaField
            name="aiInvolvement"
            label="AI 如何参与"
            hint="20–1000 个字符，分别说明开发过程和产品能力中的 AI 参与。"
            minLength={20}
            maxLength={1000}
            placeholder="哪些部分由 AI 完成、哪些由人确认？产品本身是否提供 AI 能力？"
            error={fieldErrors.aiInvolvement}
            onChange={clearFieldError}
          />
          <TextAreaField
            name="techStack"
            label="技术栈"
            hint="2–500 个字符；这是开发者自述，尚未从仓库提取。"
            minLength={2}
            maxLength={500}
            rows={3}
            placeholder="例如：Next.js、TypeScript、SQLite"
            error={fieldErrors.techStack}
            onChange={clearFieldError}
          />
          <TextAreaField
            name="reuseNotes"
            label="部署与二次开发说明"
            hint="20–2000 个字符，说明关键步骤、限制和需要自行配置的服务。"
            minLength={20}
            maxLength={2000}
            placeholder="如何运行、部署或复用？有哪些尚未解决的限制？"
            error={fieldErrors.reuseNotes}
            onChange={clearFieldError}
          />
        </div>

        {formError ? <div className="formAlert" role="alert">{formError}</div> : null}

        <div className="formSubmitBar">
          <p>提交即写入本地审核库；不会自动公开，也不会触发外部请求。</p>
          <button className="button button--primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "提交审核（处理中…）" : "提交审核"}
          </button>
        </div>
      </form>
    </>
  );
}
