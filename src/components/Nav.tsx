"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "개요" },
  { href: "/models", label: "모델" },
  { href: "/benchmarks", label: "벤치마크" },
  { href: "/leaderboards", label: "리더보드" },
  { href: "/github", label: "GitHub" },
  { href: "/sources", label: "출처" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight text-fg"
        >
          {/* Same geometry as src/app/icon.svg, inlined so the mark costs no
              request and follows the accent token if the palette changes. */}
          <svg
            viewBox="0 0 32 32"
            aria-hidden
            className="h-5 w-5 shrink-0 text-accent"
          >
            <rect width="32" height="32" rx="7" fill="currentColor" />
            <g fill="#ffffff">
              <rect x="6.5" y="7.75" width="19" height="5" rx="1.2" />
              <rect x="13.5" y="7.75" width="5" height="16.5" rx="1.2" />
            </g>
          </svg>
          <span>
            tech<span className="text-accent">/</span>trends
          </span>
        </Link>

        <nav
          aria-label="주요 메뉴"
          className="scroll-thin -mx-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1"
        >
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-accent-dim/60 font-medium text-accent"
                    : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
