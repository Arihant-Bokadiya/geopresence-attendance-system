const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');

export async function apiRequest<T = any>(
  endpoint: string,
  options: Omit<RequestInit, 'body'> & { body?: any } = {}
): Promise<T> {
  const token = typeof window !== 'undefined'
    ? (sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token'))
    : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const body = options.body !== undefined
    ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
    : undefined;

  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${normalizedEndpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
    body,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error: any = new Error(data.detail || data.message || 'Request failed');
    error.status = response.status;
    error.data = data;
    error.code = data.code;
    error.distanceMeters = data.distanceMeters;
    error.allowedRadiusMeters = data.allowedRadiusMeters;
    throw error;
  }

  return data as T;
}

export { API_BASE_URL };
