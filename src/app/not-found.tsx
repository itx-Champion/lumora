import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { LogoMark } from "@/components/shared/logo"

export default function NotFound() {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="absolute inset-0 -z-10 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <LogoMark className="size-12" />
      <p className="mt-8 font-mono text-sm text-muted-foreground">404</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">
        Not in the <span className="text-gradient font-serif font-normal italic">knowledge base</span>
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        We searched every passage and couldn&apos;t find this page. It may have moved or never existed.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background"
      >
        <ArrowLeft className="size-4" /> Back home
      </Link>
    </main>
  )
}
