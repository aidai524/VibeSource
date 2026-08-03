import { ActionLink } from "@/components/action-link";
import { CriteriaRail } from "@/components/criteria-rail";
import { LockIcon } from "@/components/icons";
import { QualificationSteps } from "@/components/qualification-steps";
import { SiteHeader } from "@/components/site-header";
import { getRuntimeConfiguration } from "@/server/features";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const { submissionAvailable } = getRuntimeConfiguration();

  return (
    <>
      <SiteHeader />
      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__copy">
            <h1 id="hero-title">
              <span>发现真正能看源码、</span>
              <span>能运行、能复用的</span>
              <span>AI 产品</span>
            </h1>
            <p>
              每一个产品都公开源代码，并提供真实体验或部署路径。
              我们正在人工核验首批 50–100 个项目。
            </p>
            <div className="hero__actions">
              <ActionLink href={submissionAvailable ? "/submit" : "#criteria"}>
                {submissionAvailable ? "提交候选产品" : "查看收录标准"}
              </ActionLink>
              <ActionLink href="#about" variant="outline">
                为什么先做人工审核
              </ActionLink>
            </div>
          </div>
          <CriteriaRail />
        </section>

        <section
          className="catalogSection"
          id="criteria"
          aria-labelledby="catalog-title"
        >
          <div className="catalogStatusFrame">
            <div className="catalogIntro">
              <h2 id="catalog-title">首批目录正在核验中</h2>
              <p>公开源码、真实体验、许可证与数据来源，缺一不可。</p>
            </div>
            <div className="availability">
              {submissionAvailable ? (
                <span className="availability__marker" aria-hidden="true">
                  LOCAL
                </span>
              ) : (
                <LockIcon />
              )}
              <span>
                {submissionAvailable
                  ? "提交入口已在受控本地模式开放；所有提交默认待审核"
                  : "提交入口将在审核闭环上线后开放"}
              </span>
            </div>
          </div>
          <QualificationSteps />
        </section>

        <section className="aboutSection" id="about" aria-labelledby="about-title">
          <p className="aboutSection__index" aria-hidden="true">
            ABOUT / 01
          </p>
          <div>
            <h2 id="about-title">为什么先做人工审核</h2>
            <p>
              自动检查可以收集仓库、许可证与公开指标，却不能替代对真实体验、
              复用条件和宣传内容的判断。首批目录保持人工核验，等每一步都有来源、
              记录和失败状态后，再开放社区提交。
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
