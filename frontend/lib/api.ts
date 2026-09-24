/**
 * Composition Protocol — Frontend HTTP API Client
 *
 * Provides a type-safe fetch wrapper communicating with the Express backend (:4000).
 * Enforces JSON serialization, cache: "no-store" for real-time ledger polling,
 * and structured error unwrapping for atomic revert and governance rejections.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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
  const url = `${API_URL}${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store", // Prevents Next.js / browser caching to guarantee live ACS state
    });

    const data = await res.json();
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

