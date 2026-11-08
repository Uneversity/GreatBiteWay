"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  // The home page is the major finder too, so it counts as "here".
  { href: "/majors", label: "explore majors", match: ["/majors"] },
  { href: "/dive", label: "major finder", match: ["/dive", "/"] },
];

/** The header links; the one for `pathname` is shown lit and can't be clicked. */
export function NavItems({ pathname }: { pathname: string | null }) {
  return NAV.map((n) =>
    pathname !== null && n.match.includes(pathname) ? (
      <span key={n.href} aria-current="page" className="hidden cursor-default px-3 py-1 text-white sm:inline">
        [ {n.label} ]
      </span>
    ) : (
      <Link key={n.href} href={n.href} className="hidden px-3 py-1 transition hover:text-white sm:inline">
        [ {n.label} ]
      </Link>
    ),
  );
}

/**
 * Disables the link to the page you're already on, so it can't reload it.
 * Render inside <Suspense fallback={<NavItems pathname={null} />}>: with Cache
 * Components, usePathname() is runtime data on dynamic routes.
 */
export function NavLinks() {
  return <NavItems pathname={usePathname()} />;
}
