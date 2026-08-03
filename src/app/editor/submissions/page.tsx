import type { Metadata } from "next";

import { ReviewConsole } from "@/components/review-console";
import { SiteHeader } from "@/components/site-header";
import { getRuntimeConfiguration } from "@/server/features";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "本地编辑审核 — VibeSource",
  description: "受控本地审核队列、角色权限与显式外部证据刷新。",
};

export default function EditorSubmissionsPage() {
  const configuration = getRuntimeConfiguration();

  return (
    <>
      <SiteHeader />
      <main className="workflowPage" id="top">
        <header className="workflowHero workflowHero--compact">
          <div>
            <p className="eyebrow">EDITOR / LOCAL ONLY</p>
            <h1>人工审核，<br />不越过证据边界。</h1>
          </div>
          <div className="workflowHero__aside">
            <strong>不是生产身份系统</strong>
            <p>本地 token 只用于验证角色权限契约；GitHub 与 Demo 证据只在有权限的编辑明确点击后追加保存，不会自动批准。</p>
          </div>
        </header>

        {configuration.editorAvailable ? (
          <ReviewConsole />
        ) : (
          <section className="unavailablePanel" aria-labelledby="editor-unavailable-title">
            <p className="eyebrow">EDITOR / DISABLED</p>
            <h2 id="editor-unavailable-title">本地编辑审核尚未配置</h2>
            <p>需要受控提交模式、绝对数据库路径、local-token 身份模式、有效角色、至少 16 字符的编辑凭证和服务器端编辑 ID。</p>
            <p>配置不完整时 API 同样失败关闭，不会只隐藏页面按钮。</p>
          </section>
        )}
      </main>
    </>
  );
}
