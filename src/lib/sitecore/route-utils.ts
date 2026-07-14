import { NextResponse } from "next/server";
import { SitecoreApiError } from "./client";

/** Turns any thrown error into a JSON response with a sensible status code. */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof SitecoreApiError) {
    return NextResponse.json(
      { error: err.detail || err.message, status: err.status, url: err.url },
      { status: err.status >= 400 && err.status < 600 ? err.status : 502 },
    );
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Reads a required query param or throws a 400-style error. */
export function requireParam(params: URLSearchParams, name: string): string {
  const value = params.get(name);
  if (!value) throw new SitecoreApiError(400, `Missing required query param: ${name}`, "");
  return value;
}
