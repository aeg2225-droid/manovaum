// ==========================================================
// «Открой когда»: клиентский модуль для Supabase
// Подключение: <script type="module"> import * as api from './couple-api.js'; </script>
// ==========================================================

// Заполните из Supabase → Project Settings → API
// ВАЖНО: здесь только anon key. service_role ключ сюда НЕ вставлять никогда.
const SUPABASE_URL = 'https://YOUR-PROJECT-ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';

const TOKEN_KEY = 'ow_session_token';
const DEVICE_KEY = 'ow_device_id';

// ---------- служебное ----------

function deviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

async function rpc(name, args = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(args),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    // Ошибки из SQL приходят в поле message: invalid_credentials, too_many_devices и т.д.
    const code = data?.message || `HTTP ${res.status}`;
    const err = new Error(code);
    err.code = code;
    throw err;
  }
  return data;
}

function token() {
  return localStorage.getItem(TOKEN_KEY);
}

// ---------- вход и выход ----------

export async function login(login, password) {
  const rows = await rpc('login_couple', {
    p_login: login.trim(),
    p_password: password,
    p_device: deviceId(),
  });
  const row = rows[0];
  localStorage.setItem(TOKEN_KEY, row.session_token);
  return { isAdmin: row.admin_flag };
}

export async function logout() {
  if (token()) {
    await rpc('logout_couple', { p_token: token() }).catch(() => {});
  }
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn() {
  return !!token();
}

// ---------- истории и сообщения (своей пары) ----------

export function getStories() {
  return rpc('get_stories', { p_token: token() });
}

export function createStory(title) {
  return rpc('create_story', { p_token: token(), p_title: title });
}

export function getMessages(storyId, since = null) {
  return rpc('get_messages', {
    p_token: token(),
    p_story: storyId,
    p_since: since,
  });
}

export function postMessage(storyId, body) {
  return rpc('post_message', {
    p_token: token(),
    p_story: storyId,
    p_body: body,
    p_device: deviceId(),
  });
}

/**
 * Обновление «почти в реальном времени» (раз в 3 секунды).
 * onNew получает только новые сообщения. Возвращает функцию остановки.
 */
export function watchMessages(storyId, onNew, intervalMs = 3000) {
  let last = null;
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    try {
      const fresh = await getMessages(storyId, last);
      if (fresh.length) {
        last = fresh[fresh.length - 1].created_at;
        onNew(fresh);
      }
    } catch (e) {
      console.warn('watchMessages:', e.message);
    }
    if (!stopped) setTimeout(tick, intervalMs);
  };

  tick();
  return () => { stopped = true; };
}

// ---------- администрирование ----------

export function adminCreateCouple() {
  return rpc('admin_create_couple', { p_token: token() });
}

export function adminListCouples() {
  return rpc('admin_list_couples', { p_token: token() });
}

export function adminSetBlocked(coupleId, blocked) {
  return rpc('admin_set_blocked', {
    p_token: token(),
    p_couple: coupleId,
    p_blocked: blocked,
  });
}

export function adminDeleteCouple(coupleId) {
  return rpc('admin_delete_couple', {
    p_token: token(),
    p_couple: coupleId,
  });
}
