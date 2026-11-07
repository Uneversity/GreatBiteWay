import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthButton } from "@/components/AuthButton";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shark Pathways · MDC",
  description: "Dive into your career and education pathway, starting at Miami Dade College.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-sky-950">
        <header className="absolute inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-4 text-white">
          <Link href="/" className="font-semibold tracking-tight">
            🦈 Shark Pathways
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/dive">Find my major</Link>
            <Link href="/majors">Browse majors</Link>
            <Suspense fallback={null}>
              <AuthButton />
            </Suspense>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
