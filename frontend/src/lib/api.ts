export type ApiSuccess<T> = {
  success: true;
  statusCode: number;
  data: T;
  message?: string;
};

export type ApiFailure = {
  success: false;
  error: { code?: string; message: string };
};

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export class ApiClientError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, opts?: { code?: string; status?: number }) {
    super(message);
    this.name = "ApiClientError";
    this.code = opts?.code;
    this.status = opts?.status;
  }
}

const DEFAULT_BASE_URL = "http://localhost:5000/api/v1";

export const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL?.toString?.() || DEFAULT_BASE_URL;

function getToken() {
  return localStorage.getItem("holoid_access_token");
}

export function setToken(token: string | null) {
  if (!token) localStorage.removeItem("holoid_access_token");
  else localStorage.setItem("holoid_access_token", token);
}

export async function apiRequest<T>(
  path: string,
  opts?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    auth?: boolean;
    signal?: AbortSignal;
  }
): Promise<ApiSuccess<T>> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  const token = opts?.auth ? getToken() : null;

  const res = await fetch(url, {
    method: opts?.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
    signal: opts?.signal,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  let payload: ApiEnvelope<T> | null = null;
  let bodyText: string | null = null;

  if (isJson) {
    try {
      payload = await res.json();
    } catch (err) {
      // JSON parsing failed despite content-type; capture raw text for diagnostics
      try {
        bodyText = await res.text();
      } catch (e) {
        bodyText = null;
      }
      payload = null;
    }
  } else {
    // non-json response — capture plain text for error messages
    try {
      bodyText = await res.text();
    } catch (e) {
      bodyText = null;
    }
  }

  if (!res.ok) {
    const message =
      (payload && "success" in payload && !payload.success && payload.error?.message) ||
      bodyText ||
      res.statusText ||
      "Request failed";
    const code =
      payload && "success" in payload && !payload.success ? payload.error?.code : undefined;
    throw new ApiClientError(message, { code, status: res.status });
  }

  if (!payload || !("success" in payload) || payload.success !== true) {
    const message = bodyText || "Unexpected API response";
    throw new ApiClientError(message, { status: res.status });
  }

  return payload;
}

