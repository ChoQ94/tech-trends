import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import "./globals.css";

const title = "tech/trends — AI 모델·벤치마크·저장소 대시보드";
const description =
  "프런티어의 현재 상태를 촘촘하고 정직하게 정리했습니다. 어떤 모델이 언제 나왔고, 가격은 얼마이고, 점수는 어떤지, 그리고 GitHub에서는 무엇이 뜨고 있는지.";

export const metadata: Metadata = {
  title: {
    default: title,
    template: "%s · tech/trends",
  },
  description,
  applicationName: "tech/trends",
  keywords: [
    "AI 모델",
    "LLM 벤치마크",
    "모델 가격",
    "컨텍스트 윈도우",
    "리더보드",
    "GitHub 트렌딩",
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
    <html lang="ko" className="h-full">
      <body className="flex min-h-full flex-col bg-bg text-fg">
        <Nav />
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-1 px-4 py-6 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              모델과 벤치마크 수치는 사람이 직접 정리한 것이라 시간이 지나면
              낡습니다. 수치를 인용하기 전에 링크된 출처를 반드시 확인하십시오.
            </p>
            <p className="tabular-nums">tech/trends</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
