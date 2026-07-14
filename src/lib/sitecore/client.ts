import "server-only";
import { getAccessToken, invalidateToken } from "./token";

export interface SitecoreFetchOptions {
  /** Environment host name, e.g. "cm.tenant.sitecorecloud.io" (no scheme). */
  host: string;
  /** Path beginning with "/". */
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  /** JSON body (object) — serialized and sent as application/json. */
  jsonBody?: unknown;
  /** Raw binary body forwarded as-is (chunk transfer). */
  binaryBody?: ArrayBuffer | Uint8Array;
  /** Extra headers. */
  headers?: Record<string, string>;
  /** Whether to expect a binary response (returns Response instead of parsing). */
  rawResponse?: boolean;
}

export class SitecoreApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public url: string,
  ) {
    super(`Sitecore API ${status} at ${url}: ${detail}`);
    this.name = "SitecoreApiError";
  }
}

function normalizeHost(host: string): string {
  return host.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function buildUrl(host: string, path: string, query?: SitecoreFetchOptions["query"]): string {
  const url = new URL(`https://${normalizeHost(host)}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/**
 * Authenticated fetch against a Sitecore environment. Attaches the cached JWT,
 * retries once on 401 after refreshing the token, and normalizes errors.
 * Returns the raw `Response` when `rawResponse` is set (for binary streams).
 */
export async function sitecoreFetch(opts: SitecoreFetchOptions): Promise<Response> {
  if (!opts.host) throw new SitecoreApiError(400, "Missing host", opts.path);

  const url = buildUrl(opts.host, opts.path, opts.query);

  const doFetch = async (token: string): Promise<Response> => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...opts.headers,
    };

    const method = opts.method ?? "GET";
    let body: BodyInit | undefined;
    if (opts.jsonBody !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.jsonBody);
    } else if (opts.binaryBody !== undefined) {
      headers["Content-Type"] = "application/octet-stream";
      body = opts.binaryBody as BodyInit;
    } else if (method === "POST" || method === "PUT") {
      // Body-less POST/PUT: send an explicit empty body so fetch emits
      // Content-Length: 0. Without it the Sitecore edge (Cloudflare/IIS)
      // rejects the request with HTTP 411 Length Required.
      body = "";
    }

    return fetch(url, {
      method,
      headers,
      body,
      cache: "no-store",
    });
  };

  let token = await getAccessToken();
  let res = await doFetch(token);

  if (res.status === 401) {
    invalidateToken();
    token = await getAccessToken(true);
    res = await doFetch(token);
  }

  if (!res.ok && !opts.rawResponse) {
    const detail = await res.text().catch(() => "");
    throw new SitecoreApiError(res.status, detail || res.statusText, url);
  }

  return res;
}

/** Convenience wrapper that parses a JSON response. */
export async function sitecoreJson<T>(opts: SitecoreFetchOptions): Promise<T> {
  const res = await sitecoreFetch(opts);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
