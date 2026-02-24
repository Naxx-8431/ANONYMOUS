/**
 * ANONYMOUS – Frontend API Client
 * Replaces the localStorage mock. All calls go to the Express backend.
 */
'use strict';

/* ── Shared fetch helper ────────────────────────────────────────── */
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  try { return await res.json(); }
  catch { return { ok: false, error: 'Invalid server response.' }; }
}

/* ================================================================
   AUTH
   ================================================================ */
const Auth = {
  async register(username, email, password) {
    return apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  },

  async login(ident, password) {
    return apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ ident, password }),
    });
  },

  async logout() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    window.location.href = 'welcome.html';
  },

  async me() {
    const data = await apiFetch('/api/auth/me');
    return (data.ok && data.user) ? data.user : null;
  },

  async preCheck(username, email) {
    return apiFetch('/api/auth/precheck', {
      method: 'POST',
      body: JSON.stringify({ username, email }),
    });
  },
};

/* ================================================================
   POSTS
   ================================================================ */
const Posts = {
  async getAll() {
    const data = await apiFetch('/api/posts');
    return data.ok ? data.posts : [];
  },

  async search(q) {
    const data = await apiFetch(`/api/posts/search?q=${encodeURIComponent(q)}`);
    return data.ok ? data.posts : [];
  },

  async getById(id) {
    const data = await apiFetch(`/api/posts/${id}`);
    return data.ok ? data.post : null;
  },

  async create(title, body) {
    return apiFetch('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ title, body }),
    });
  },

  async delete(id) {
    return apiFetch(`/api/posts/${id}`, { method: 'DELETE' });
  },

  async getMyPosts() {
    const data = await apiFetch('/api/profile/posts');
    return data.ok ? data.posts : [];
  },
};

/* ================================================================
   COMMENTS
   ================================================================ */
const Comments = {
  async getByPost(postId) {
    const data = await apiFetch(`/api/posts/${postId}/comments`);
    return data.ok ? data.comments : [];
  },

  async create(postId, body) {
    return apiFetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  },

  async delete(id) {
    return apiFetch(`/api/comments/${id}`, { method: 'DELETE' });
  },

  async getMyComments() {
    const data = await apiFetch('/api/profile/comments');
    return data.ok ? data.comments : [];
  },
};

/* ================================================================
   VOTES
   ================================================================ */
const Votes = {
  async vote(postId, type) {
    return apiFetch(`/api/posts/${postId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    });
  },
};

/* ================================================================
   GUARDS  (async – all page scripts must call these)
   ================================================================ */
async function requireLogin() {
  const user = await Auth.me();
  if (!user) { window.location.href = 'login.html'; return null; }
  return user;
}

async function redirectIfLoggedIn(dest = 'index.html') {
  const user = await Auth.me();
  if (user) window.location.href = dest;
}

/* ================================================================
   UTILS  (kept for rendering)
   ================================================================ */
function formatDate(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}
