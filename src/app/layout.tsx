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
    default: "Lumora — Your company's knowledge, answered by AI",
    template: "%s · Lumora",
  },
  description:
    "Lumora turns your documents, wikis and tools into an AI agent that answers with citations and gets work done.",
  keywords: ["AI agent", "RAG", "knowledge base", "AI assistant", "SaaS"],
  openGraph: {
    type: "website",
    siteName: "Lumora",
    title: "Lumora — Your company's knowledge, answered by AI",
    description:
      "An AI agent that answers from your documents with citations and takes action in your tools.",
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
