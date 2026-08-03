import type { Metadata } from "next";

import { ReviewConsole } from "@/components/review-console";
import { SiteHeader } from "@/components/site-header";
import { getRuntimeConfiguration } from "@/server/features";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "本地编辑审核 — VibeSource",
  description: "受控本地审核队列与显式 GitHub 时点证据刷新。",
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
            <p>凭证由服务器环境变量提供；GitHub 与 Demo 证据只在编辑明确点击后追加保存，许可证策略只生成复核建议，不会自动批准。</p>
          </div>
        </header>

        {configuration.editorAvailable ? (
          <ReviewConsole />
        ) : (
          <section className="unavailablePanel" aria-labelledby="editor-unavailable-title">
            <p className="eyebrow">EDITOR / DISABLED</p>
            <h2 id="editor-unavailable-title">本地编辑审核尚未配置</h2>
            <p>需要受控提交模式、绝对数据库路径、至少 16 字符的编辑凭证和服务器端编辑 ID。</p>
            <p>配置不完整时 API 同样失败关闭，不会只隐藏页面按钮。</p>
          </section>
        )}
      </main>
    </>
  );
}
