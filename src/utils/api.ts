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
