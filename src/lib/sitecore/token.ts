import "server-only";
import { getSitecoreConfig } from "./config";

interface CachedToken {
  accessToken: string;
  /** Epoch ms when the token expires. */
  expiresAt: number;
}

let cache: CachedToken | null = null;
let inflight: Promise<CachedToken> | null = null;

/** Refresh a little early to avoid using a token that expires mid-request. */
const EXPIRY_SKEW_MS = 60_000;

async function requestToken(): Promise<CachedToken> {
  const { clientId, clientSecret, authUrl, audience } = getSitecoreConfig();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    audience,
  });

  const res = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Token request failed (${res.status}): ${detail || res.statusText}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in?: number };
  const expiresInMs = (json.expires_in ?? 24 * 60 * 60) * 1000;

  return {
    accessToken: json.access_token,
    expiresAt: Date.now() + expiresInMs,
  };
}

/**
 * Returns a valid JWT, cached in module memory for its lifetime (~24h).
 * Concurrent callers share a single in-flight request.
 */
export async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cache && cache.expiresAt - EXPIRY_SKEW_MS > Date.now()) {
    return cache.accessToken;
  }

  if (!inflight) {
    inflight = requestToken()
      .then((t) => {
        cache = t;
        return t;
      })
      .finally(() => {
        inflight = null;
      });
  }

  const token = await inflight;
  return token.accessToken;
}

/** Returns token metadata for the auth-test endpoint (no secret exposed). */
export async function testToken(): Promise<{ ok: true; expiresAt: string }> {
  const token = await getAccessToken(true);
  // getAccessToken(true) refreshed the cache; read expiry from it.
  const expiresAt = cache ? new Date(cache.expiresAt).toISOString() : "";
  // Touch token so it is obviously used; never return the JWT itself.
  void token;
  return { ok: true, expiresAt };
}

/** Clears the cached token (used when a request gets a 401). */
export function invalidateToken() {
  cache = null;
}
