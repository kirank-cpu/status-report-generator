// Shared fetch wrapper for the backend API. In dev, calls hit /api and Vite
// proxies them to the server; in production set VITE_API_URL to the API origin.

const BASE = import.meta.env.VITE_API_URL || '/api';

export async function request(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  return res.status === 204 ? null : res.json();
}

// Like `request`, but never throws on non-2xx — returns { ok, status, body }.
// Used where a non-200 carries meaningful data (e.g. a 409 lock conflict whose
// body names the current owner).
export async function requestRaw(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let body = null;
  try {
    body = res.status === 204 ? null : await res.json();
  } catch {
    /* non-JSON body */
  }
  return { ok: res.ok, status: res.status, body };
}
