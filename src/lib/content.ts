export const navigationItems = [
  { href: "/", label: "发现" },
  { href: "/#criteria", label: "收录标准" },
  { href: "/#about", label: "关于" },
] as const;

export type CriterionIcon = "code" | "run" | "provenance";

export type EligibilityCriterion = {
  readonly id: string;
  readonly index: string;
  readonly title: string;
  readonly description: string;
  readonly requirement: string;
  readonly icon: CriterionIcon;
};

export const eligibilityCriteria: readonly EligibilityCriterion[] = [
  {
    id: "source",
    index: "01",
    title: "公开源码",
    description: "必须可访问、可审查",
    requirement: "REQUIRED: SOURCE_CODE_PUBLIC",
    icon: "code",
  },
  {
    id: "experience",
    index: "02",
    title: "真实体验",
    description: "提供可运行演示或部署路径",
    requirement: "REQUIRED: LIVE_DEMO_OR_DEPLOY_PATH",
    icon: "run",
  },
  {
    id: "provenance",
    index: "03",
    title: "来源可追溯",
    description: "许可证明确，数据来源透明",
    requirement: "REQUIRED: LICENSE_AND_DATA_PROVENANCE",
    icon: "provenance",
  },
] as const;
