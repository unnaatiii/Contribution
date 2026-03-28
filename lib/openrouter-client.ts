/**
 * Optional OpenRouter key sent with `/api/analyze` from the browser.
 * Prefer configuring OPENROUTER_API_KEY on devimpact-backend only; use this for local dev if needed.
 */
export function optionalOpenRouterKeyForApi(): string | undefined {
  const raw =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_OPENROUTER_API_KEY : undefined;
  if (raw == null || typeof raw !== "string") return undefined;
  let v = raw.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  v = v.replace(/\s+/g, "");
  if (!v || v.length < 10) return undefined;
  return v;
}
