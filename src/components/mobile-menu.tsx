"use client";

import Link from "next/link";
import { useState } from "react";

import { navigationItems } from "@/lib/content";

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mobileMenu">
      <button
        className="mobileMenu__button"
        type="button"
        aria-expanded={isOpen}
        aria-controls="mobile-navigation"
        aria-label={isOpen ? "关闭导航" : "打开导航"}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span />
        <span />
        <span />
      </button>
      {isOpen ? (
        <nav
          className="mobileMenu__panel"
          id="mobile-navigation"
          aria-label="移动导航"
        >
          {navigationItems.map((item) => (
            <Link
              href={item.href}
              key={item.href}
              onClick={() => setIsOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
