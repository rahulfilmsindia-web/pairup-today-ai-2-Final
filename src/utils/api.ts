export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
  const headers = new Headers(init.headers);
  if (!headers.has('Authorization') && typeof window !== 'undefined') {
    const token = url.startsWith('/api/admin/')
      ? localStorage.getItem('pairup_admin_token')
      : localStorage.getItem('pairup_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, { credentials: 'include', ...init, headers });
}

export async function safeJsonParse(res: Response): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const data = await res.json();
      return { ok: res.ok, status: res.status, data: data || {}, error: data?.error };
    } catch {
      // JSON syntax error fallback
    }
  }
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    if (res.status === 502 || res.status === 504) {
      return { ok: false, status: res.status, data: {}, error: 'Server gateway is temporarily busy or updating (502). Please retry in a few seconds.' };
    }
    if (res.status === 503) {
      return { ok: false, status: res.status, data: {}, error: 'Service is temporarily busy. Please retry in a moment.' };
    }
    if (res.status === 404) {
      return { ok: false, status: res.status, data: {}, error: 'The requested service endpoint was not found (404).' };
    }
    return { ok: false, status: res.status, data: {}, error: text && text.length < 200 && !text.includes('<') ? text : `Server request error (${res.status}). Please try again.` };
  }
  return { ok: res.ok, status: res.status, data: {} };
}
