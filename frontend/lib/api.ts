/**
 * Settleflow — Frontend HTTP API Client
 *
 * Provides a type-safe fetch wrapper communicating with the Express backend (:4000).
 * Enforces JSON serialization, cache: "no-store" for real-time ledger polling,
 * and structured error unwrapping for atomic revert and governance rejections.
 */

export function resolveApiUrl(): string {
  // If explicitly configured in environment, use it
  let url = process.env.NEXT_PUBLIC_API_URL;

  // In the browser: if no URL configured or it defaulted to localhost while deployed on Render,
  // automatically target the live deployed backend service.
  if (typeof window !== "undefined") {
    if (!url || url.includes("localhost")) {
      if (window.location.hostname.includes("onrender.com")) {
        return "https://settleflow-backend-zcp7.onrender.com";
      }
    }
  }

  if (!url) return "http://localhost:4000";
  url = url.trim().replace(/\/+$/, "");
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = url.includes("localhost") ? `http://${url}` : `https://${url}`;
  }
  return url;
}

export const API_URL = resolveApiUrl();

/**
 * Perform an authenticated or unauthenticated JSON request to the protocol backend.
 *
 * @template T - Expected JSON response shape
 * @param path - API subpath (e.g. "/compositions", "/audit/money-shot")
 * @param init - Optional RequestInit overrides (method, headers, body)
 * @returns Parsed JSON response of type T
 * @throws Error containing server error message (e.g. atomic revert or below threshold)
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = resolveApiUrl();
  const url = `${baseUrl}${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store", // Prevents Next.js / browser caching to guarantee live ACS state
    });

    const text = await res.text();
    let data: { error?: string } & Record<string, unknown> = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      // Non-JSON body (proxy error page, cold-start HTML) — surface a readable message
      throw new Error(
        `The API returned an unexpected response for ${path} (HTTP ${res.status}). It may still be starting up — retry in a moment.`,
      );
    }
    if (!res.ok) {
      // Unpack structured backend error (e.g. 409 Conflict with atomic revert details)
      throw new Error(data.error ?? `Request to ${path} failed with HTTP status ${res.status}`);
    }
    return data as T;
  } catch (err) {
    // Re-throw with descriptive context for UI error alerts
    throw err instanceof Error ? err : new Error(String(err));
  }
}

