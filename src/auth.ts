import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import GitHub from "next-auth/providers/github"
import { z } from "zod"

const demoCredentials = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.email().max(120),
})

export const githubEnabled = Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET)

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    // One-click demo access: anyone can open a private sample workspace with a name and email.
    Credentials({
      id: "demo",
      name: "Demo workspace",
      credentials: { name: {}, email: {} },
      authorize: async (credentials) => {
        const parsed = demoCredentials.safeParse(credentials)
        if (!parsed.success) return null
        const { name, email } = parsed.data
        return { id: email.toLowerCase(), name, email: email.toLowerCase() }
      },
    }),
    ...(githubEnabled ? [GitHub] : []),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: "/login" },
  trustHost: true,
  callbacks: {
    authorized: ({ auth, request }) => {
      const isApp = request.nextUrl.pathname.startsWith("/app")
      if (isApp) return Boolean(auth?.user)
      return true
    },
  },
})
