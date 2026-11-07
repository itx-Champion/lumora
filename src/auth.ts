import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import GitHub from "next-auth/providers/github"
import { z } from "zod"

const demoCredentials = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.email().max(120),
  /** Per-browser id, so visitors who keep the default email still get separate sandboxes. */
  sandbox: z.uuid().optional(),
})

export const githubEnabled = Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET)

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    // One-click demo access: anyone can open a private sample workspace with a name and email.
    Credentials({
      id: "demo",
      name: "Demo workspace",
      credentials: { name: {}, email: {}, sandbox: {} },
      authorize: async (credentials) => {
        const parsed = demoCredentials.safeParse(credentials)
        if (!parsed.success) return null
        const { name, email, sandbox } = parsed.data
        const normalized = email.toLowerCase()
        return { id: sandbox ? `demo:${sandbox}` : normalized, name, email: normalized }
      },
    }),
    ...(githubEnabled ? [GitHub] : []),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: "/login" },
  trustHost: true,
  callbacks: {
    // Expose the stable identity (demo sandbox id or GitHub id) to the server.
    session: ({ session, token }) => {
      if (token.sub && session.user) session.user.id = token.sub
      return session
    },
    authorized: ({ auth, request }) => {
      const isApp = request.nextUrl.pathname.startsWith("/app")
      if (isApp) return Boolean(auth?.user)
      return true
    },
  },
})
