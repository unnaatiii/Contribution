import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import GlobalPageEffects from "@/components/GlobalPageEffects";
import { AnalysisSessionProvider } from "@/components/AnalysisSessionProvider";
import { LayoutGroup } from "framer-motion";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DevImpact AI — Developer Contribution Analysis",
  description: "AI-powered dashboard that evaluates developer contributions based on real impact, not just lines of code.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col app-bg-saas text-slate-50 antialiased">
        <GlobalPageEffects />
        <AnalysisSessionProvider>
          <LayoutGroup id="devimpact-ui">
            <div className="relative z-10 flex min-h-full flex-1 flex-col">{children}</div>
          </LayoutGroup>
        </AnalysisSessionProvider>
      </body>
    </html>
  );
}
