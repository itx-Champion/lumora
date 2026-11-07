/**
 * The current time for a server render. Server components run once per request,
 * so reading the clock here is deterministic for that response.
 */
export function requestTime() {
  return Date.now()
}
