import "server-only";

/**
 * Server-only access to Sitecore automation-client configuration.
 * Secrets live in `.env.local` and must never be exposed to the browser.
 */
export function getSitecoreConfig() {
  const clientId = process.env.SITECORE_CLIENT_ID;
  const clientSecret = process.env.SITECORE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing SITECORE_CLIENT_ID / SITECORE_CLIENT_SECRET. Set them in .env.local.",
    );
  }

  return {
    clientId,
    clientSecret,
    authUrl: process.env.SITECORE_AUTH_URL ?? "https://auth.sitecorecloud.io/oauth/token",
    audience: process.env.SITECORE_AUTH_AUDIENCE ?? "https://api.sitecorecloud.io",
    defaultSourceHost: process.env.SITECORE_SOURCE_HOST ?? "",
    defaultDestHost: process.env.SITECORE_DEST_HOST ?? "",
  };
}

/** Public (non-secret) defaults safe to send to the browser for prefilling forms. */
export function getPublicDefaults() {
  return {
    sourceHost: process.env.SITECORE_SOURCE_HOST ?? "",
    destHost: process.env.SITECORE_DEST_HOST ?? "",
  };
}
