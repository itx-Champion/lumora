// Next.js 16 renamed Middleware to Proxy. Auth.js decides access in the `authorized` callback.
export { auth as proxy } from "@/auth"

export const config = {
  matcher: ["/app/:path*"],
}
