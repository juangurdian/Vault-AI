import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "BeastAI - Ultimate Local AI",
  description: "Offline-first custom AI platform with intelligent routing, deep research, and multimodal capabilities",
  keywords: ["AI", "local", "offline", "LLM", "chat", "research", "vision"],
  authors: [{ name: "BeastAI" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-[#0a0a12]">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} h-full overflow-hidden antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
