import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import "./globals.css";

const title = "tech/trends — AI model, benchmark & repo dashboard";
const description =
  "A dense, honest snapshot of the frontier: which models shipped when, what they cost, how they score, and what is trending on GitHub.";

export const metadata: Metadata = {
  title: {
    default: title,
    template: "%s · tech/trends",
  },
  description,
  applicationName: "tech/trends",
  keywords: [
    "AI models",
    "LLM benchmarks",
    "model pricing",
    "context window",
    "leaderboard",
    "GitHub trending",
  ],
  openGraph: {
    type: "website",
    siteName: "tech/trends",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col bg-bg text-fg">
        <Nav />
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-1 px-4 py-6 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              Model and benchmark figures are curated by hand and go stale.
              Always check the linked source before you quote a number.
            </p>
            <p className="tabular-nums">tech/trends</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
