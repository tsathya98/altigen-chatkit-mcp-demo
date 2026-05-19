import type { Metadata } from "next";
import Script from "next/script";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Altigen Pharma · Operations Console",
  description:
    "An operations console for Altigen Pharma — KPIs, clinical trials, and a knowledge-aware assistant. Built for Think Thursday.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        {/* Registers the <openai-chatkit> custom element. The npm package
            @openai/chatkit is types-only; the runtime ships from the CDN. */}
        <Script
          src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"
          strategy="beforeInteractive"
        />
        {children}
        {/* Persistent app shell — mounted once, survives route changes so
            ChatKit sessions and Realtime voice connections aren't orphaned
            when navigating from / to /sandbox. */}
        <AppShell />
      </body>
    </html>
  );
}
