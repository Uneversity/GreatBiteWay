import Link from "next/link";
import { Ocean } from "@/components/Ocean";
import { Shark } from "@/components/Shark";

export default function Home() {
  return (
    <Ocean depth={0}>
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 text-center">
        <Shark className="w-48" />
        <h1 className="text-4xl font-bold sm:text-5xl">Where will your dive take you?</h1>
        <p className="max-w-xl text-lg text-white/85">
          Build a step-by-step pathway from Miami Dade College to the career you want.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/dive" className="rounded-full bg-white px-6 py-3 font-semibold text-sky-900">
            I&apos;m not sure yet, help me decide
          </Link>
          <Link href="/majors" className="rounded-full border border-white px-6 py-3 font-semibold">
            I know my major
          </Link>
        </div>
      </main>
    </Ocean>
  );
}
