import Image from "next/image";
import Link from "next/link";

import { ArrowRightIcon } from "@/components/icons";
import { MobileMenu } from "@/components/mobile-menu";
import { navigationItems } from "@/lib/content";
import { getRuntimeConfiguration } from "@/server/features";

export function SiteHeader() {
  const { submissionAvailable } = getRuntimeConfiguration();
  const action = submissionAvailable
    ? {
        href: "/submit",
        desktopLabel: "提交候选产品",
        mobileLabel: "提交",
      }
    : {
        href: "/#criteria",
        desktopLabel: "查看收录标准",
        mobileLabel: "收录标准",
      };

  return (
    <header className="siteHeader">
      <div className="siteHeader__inner">
        <Link className="brand" href="/" aria-label="VibeSource 首页">
          <Image
            className="brand__mark"
            src="/assets/vibesource-mark.png"
            alt=""
            width={52}
            height={52}
            priority
          />
          <span className="brand__wordmark">VibeSource</span>
        </Link>

        <nav className="desktopNav" aria-label="主导航">
          {navigationItems.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <Link className="headerCriteria" href={action.href}>
          <span className="headerCriteria__desktopLabel">
            {action.desktopLabel}
          </span>
          <span className="headerCriteria__mobileLabel">
            {action.mobileLabel}
          </span>
          <ArrowRightIcon />
        </Link>

        <MobileMenu />
      </div>
    </header>
  );
}
