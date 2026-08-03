import Link from "next/link";
import type { ReactNode } from "react";

import { ArrowRightIcon } from "@/components/icons";

type ActionLinkProps = {
  readonly children: ReactNode;
  readonly href: string;
  readonly variant?: "solid" | "outline" | "text";
};

export function ActionLink({
  children,
  href,
  variant = "solid",
}: ActionLinkProps) {
  return (
    <Link className={`actionLink actionLink--${variant}`} href={href}>
      <span>{children}</span>
      <ArrowRightIcon className="actionLink__icon" />
    </Link>
  );
}
