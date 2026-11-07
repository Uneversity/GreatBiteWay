import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Fraunces, IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";
import { AuthButton } from "@/components/AuthButton";
import "./globals.css";

// Editorial pairing: Fraunces for display, Source Serif for reading, Plex Mono for instrument labels.
const display = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz", "SOFT"] });
const body = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"], axes: ["opsz"] });
const mono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Shark Pathways · MDC",
  description: "Dive into your career and education pathway, starting at Miami Dade College.",
};

const NAV = [
  { href: "/majors", label: "explore majors" },
  { href: "/dive", label: "major finder" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-sky-950">
        <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-white/10 bg-[#040b16] px-5 text-white sm:px-8">
          <Link href="/" className="font-display flex items-center gap-3 text-lg font-semibold tracking-tight">
            <span aria-hidden className="inline-block h-2.5 w-2.5 bg-cyan-300" />
            Shark Pathways
          </Link>
          <nav className="flex items-center gap-1 font-mono text-[11px] tracking-[0.14em] text-white/75 uppercase">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hidden px-3 py-1 transition hover:text-white sm:inline">
                [ {n.label} ]
              </Link>
            ))}
            <span className="px-2">
              <Suspense fallback={null}>
                <AuthButton />
              </Suspense>
            </span>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
