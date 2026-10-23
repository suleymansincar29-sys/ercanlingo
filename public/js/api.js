// Sunucu API istemcisi.
const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'Europe/Istanbul'; } })();

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'X-Timezone': tz };
  if (method !== 'GET') { headers['X-Ercanlingo'] = '1'; headers['Content-Type'] = 'application/json'; }
  let res;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'Sunucuya bağlanılamadı. İnternet bağlantını kontrol et.');
  }
  let data = null;
  try { data = await res.json(); } catch { /* boş yanıt */ }
  if (!res.ok) throw new ApiError(res.status, data?.error || 'Bir hata oluştu.');
  return data;
}

export const timezone = tz;
