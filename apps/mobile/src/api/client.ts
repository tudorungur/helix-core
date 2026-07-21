import { getIdToken } from "../auth/authStore";
import { apiConfig } from "./config";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Thin fetch wrapper shared by every API module in this folder — attaches the Cognito ID token
// (Section 6's authorizer checks it), JSON-encodes the body, and turns a non-2xx response into a
// thrown ApiError instead of a resolved value the caller has to remember to check.
export async function apiRequest<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await getIdToken();
  if (!token) throw new ApiError(401, "Nu ești autentificat");

  const response = await fetch(`${apiConfig.baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, payload?.message ?? `Cerere eșuată (${response.status})`);
  }
  return payload as T;
}
