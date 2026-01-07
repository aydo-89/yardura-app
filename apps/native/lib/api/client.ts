import { API_BASE_URL } from '@/lib/config';

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  token?: string | null;
  timeoutMs?: number;
};

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function buildUrl(path: string): string {
  if (path.startsWith('http')) {
    return path;
  }
  const trimmedBase = API_BASE_URL.replace(/\/$/, '');
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}

function resolveTimeZone(): string | null {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof timeZone === 'string' && timeZone.length > 0 ? timeZone : null;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const url = buildUrl(path);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };
  const timeZone = resolveTimeZone();
  if (timeZone) {
    headers['X-Time-Zone'] = timeZone;
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const controller =
    typeof options.timeoutMs === 'number' && options.timeoutMs > 0
      ? new AbortController()
      : null;
  const timeoutId =
    controller && options.timeoutMs
      ? setTimeout(() => controller.abort(), options.timeoutMs)
      : null;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller?.signal,
    });
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Request timed out', 408);
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  const rawText = await response.text();
  let payload: any = null;
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = rawText;
    }
  }

  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  if (payload && typeof payload === 'object' && 'ok' in payload) {
    if (payload.ok === false) {
      throw new ApiError(
        payload.error || 'Request failed',
        response.status,
        payload,
      );
    }
    return (payload.data ?? payload) as T;
  }

  return payload as T;
}

type ApiUploadOptions = {
  method?: 'POST' | 'PATCH' | 'PUT';
  body: FormData;
  headers?: Record<string, string>;
  token?: string | null;
};

export async function apiUpload<T>(
  path: string,
  options: ApiUploadOptions,
): Promise<T> {
  const url = buildUrl(path);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };
  const timeZone = resolveTimeZone();
  if (timeZone) {
    headers['X-Time-Zone'] = timeZone;
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(url, {
    method: options.method ?? 'POST',
    headers,
    body: options.body,
  });

  const rawText = await response.text();
  let payload: any = null;
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = rawText;
    }
  }

  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  if (payload && typeof payload === 'object' && 'ok' in payload) {
    if (payload.ok === false) {
      throw new ApiError(
        payload.error || 'Request failed',
        response.status,
        payload,
      );
    }
    return (payload.data ?? payload) as T;
  }

  return payload as T;
}
