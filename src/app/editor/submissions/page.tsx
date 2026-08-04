import type { Metadata } from "next";

import { ReviewConsole } from "@/components/review-console";
import { SiteHeader } from "@/components/site-header";
import { getRuntimeConfiguration } from "@/server/features";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "编辑审核 — VibeSource",
  description: "受控审核队列、数据库会话、角色权限与显式外部证据刷新。",
};

export default function EditorSubmissionsPage() {
  const configuration = getRuntimeConfiguration();

  return (
    <>
      <SiteHeader />
      <main className="workflowPage" id="top">
        <header className="workflowHero workflowHero--compact">
          <div>
            <p className="eyebrow">EDITOR / CONTROLLED ACCESS</p>
            <h1>人工审核，<br />不越过证据边界。</h1>
          </div>
          <div className="workflowHero__aside">
            <strong>{configuration.editorIdentityMode === "external-oidc" ? "GitHub 身份 + 应用角色" : "本地授权验证"}</strong>
            <p>{configuration.editorIdentityMode === "external-oidc" ? "数据库会话验证账号，应用角色决定权限；任何证据刷新仍需人工明确点击。" : "本地 token 只用于验证角色权限契约；它不是生产身份，也不会自动批准产品。"}</p>
          </div>
        </header>

        {configuration.editorAvailable ? (
          <ReviewConsole identityMode={configuration.editorIdentityMode} />
        ) : (
          <section className="unavailablePanel" aria-labelledby="editor-unavailable-title">
            <p className="eyebrow">EDITOR / DISABLED</p>
            <h2 id="editor-unavailable-title">编辑审核尚未配置</h2>
            <p>本地模式需要 token、actor 和角色；生产模式需要 HTTPS 基础 URL、GitHub OAuth 凭证、至少 32 字符秘密和 PostgreSQL 连接串。</p>
            <p>配置不完整时 API 同样失败关闭，不会只隐藏页面按钮。</p>
          </section>
        )}
      </main>
    </>
  );
}
