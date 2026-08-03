import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { SubmissionForm } from "@/components/submission-form";
import { getRuntimeConfiguration } from "@/server/features";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "提交候选产品 — VibeSource",
  description: "提交 AI 原生开源产品候选，所有记录默认进入人工审核。",
};

export default function SubmitPage() {
  const configuration = getRuntimeConfiguration();

  return (
    <>
      <SiteHeader />
      <main className="workflowPage" id="top">
        <header className="workflowHero">
          <div>
            <p className="eyebrow">SUBMIT / M2.2b1</p>
            <h1>提交候选产品，<br />先进入人工审核。</h1>
          </div>
          <div className="workflowHero__aside">
            <strong>当前验证边界</strong>
            <p>提交时只校验字段和 URL 形状；GitHub 与 Demo 证据只会在本地编辑明确操作后请求。</p>
          </div>
        </header>

        <section className="truthStrip" aria-label="提交处理方式">
          <div><span>01</span><strong>服务端校验</strong><p>客户端不能写入“已核验”状态。</p></div>
          <div><span>02</span><strong>真实持久化</strong><p>唯一待审核记录和初始事件原子保存。</p></div>
          <div><span>03</span><strong>不自动发布</strong><p>当前编辑只能拒绝并记录理由。</p></div>
        </section>

        {configuration.submissionAvailable ? (
          <SubmissionForm />
        ) : (
          <section className="unavailablePanel" aria-labelledby="submission-unavailable-title">
            <p className="eyebrow">SUBMISSION / DISABLED</p>
            <h2 id="submission-unavailable-title">提交入口当前未开放</h2>
            <p>{configuration.unavailableReason}</p>
            <p>这是有意的失败关闭状态，不会显示一个无法保存数据的假表单。</p>
          </section>
        )}
      </main>
    </>
  );
}
