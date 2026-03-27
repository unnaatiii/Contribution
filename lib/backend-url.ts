/**
 * Base URL for the Express API (devimpact-backend). Browser-visible via NEXT_PUBLIC_*.
 * Default matches local `npm run dev` for the backend on port 8000.
 */
export const backendBase =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "")) ||
  "http://localhost:8000";

/** Full URL for an API path (e.g. `apiPath` = `/api/load-base`). */
export function backendApiUrl(apiPath: string): string {
  const p = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  return `${backendBase}${p}`;
}
