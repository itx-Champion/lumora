import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SmoothScroll } from "@/components/shared/smooth-scroll";
import { themeInitScript } from "@/lib/theme-script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Lumora — AI agent, CRM and help desk for support and sales teams",
    template: "%s · Lumora",
  },
  description:
    "Lumora answers from your documents with citations, runs your support inbox and sales pipeline, and lets AI agents act on your CRM through tools and an MCP server.",
  keywords: ["AI agent", "RAG", "CRM", "help desk", "MCP server", "knowledge base", "SaaS"],
  openGraph: {
    type: "website",
    siteName: "Lumora",
    title: "Lumora — AI agent, CRM and help desk",
    description:
      "Answers with citations, an AI-native CRM and help desk, team roles and audit log, and an MCP server for Claude and Cursor.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0a12" },
    { media: "(prefers-color-scheme: light)", color: "#fbfbfe" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          <SmoothScroll />
          {children}
        </TooltipProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
