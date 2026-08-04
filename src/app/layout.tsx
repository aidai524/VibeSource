import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import "./workflow.css";

export const metadata: Metadata = {
  title: "VibeSource — AI 原生开源产品发现平台",
  description:
    "发现真正能看源码、能运行、能复用的 AI 产品。每个产品都公开源码，并提供真实体验或部署路径。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
