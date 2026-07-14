"use client";

/** Client-side fetch helpers for our own /api routes (never talks to Sitecore directly). */

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

export async function del<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "DELETE" });
  return handle<T>(res);
}

/** SWR fetcher for GET endpoints. */
export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  return handle<T>(res);
}

async function handle<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = (data && (data.error as string)) || res.statusText;
    throw new Error(message);
  }
  return data as T;
}
