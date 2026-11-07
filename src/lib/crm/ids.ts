const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"

/** Short, prefixed, URL-safe ids such as `con_k3x9q2m1v8ta`. */
export function newId(prefix: string, length = 12) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  let id = ""
  for (const b of bytes) id += alphabet[b % alphabet.length]
  return `${prefix}_${id}`
}
