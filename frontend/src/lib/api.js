const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

// Identificador de dispositivo para rate limiting (no es dato financiero)
function deviceId() {
  let id = localStorage.getItem('calc_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('calc_device_id', id);
  }
  return id;
}

/**
 * Cliente del backend. Devuelve siempre el JSON del servidor (el backend
 * responde errores amables en JSON); lanza solo en fallas de red.
 */
export async function api(path, { method = 'POST', body, token } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Device-Id': deviceId()
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({ error: true }));
  return { status: res.status, ...data };
}
