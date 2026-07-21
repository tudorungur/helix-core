import { getIdToken, refreshIdToken } from "../auth/authStore";
import { apiConfig } from "./config";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function send(path: string, token: string, options: { method?: string; body?: unknown }) {
  return fetch(`${apiConfig.baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

// Thin fetch wrapper shared by every API module in this folder — attaches the Cognito ID token
// (Section 6's authorizer checks it), JSON-encodes the body, and turns a non-2xx response into a
// thrown ApiError instead of a resolved value the caller has to remember to check.
export async function apiRequest<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await getIdToken();
  if (!token) throw new ApiError(401, "Nu ești autentificat");

  let response = await send(path, token, options);

  // A 401 here means API Gateway's JWT authorizer rejected the token before the Lambda even ran
  // (ID tokens expire after 1h, nothing proactively refreshed one) — try exactly once with a
  // refreshed token before giving up, rather than surfacing a stale-token failure as if it were a
  // real authorization problem.
  if (response.status === 401) {
    const refreshed = await refreshIdToken();
    if (refreshed) response = await send(path, refreshed, options);
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, payload?.message ?? `Cerere eșuată (${response.status})`);
  }
  return payload as T;
}
