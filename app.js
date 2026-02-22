/**
 * ANONYMOUS – Shared App Utilities
 * Mock data layer using localStorage (to be replaced by backend).
 * NO sensitive data is exposed to other users.
 */

'use strict';

/* ================================================================
   STORAGE KEYS
   ================================================================ */
const KEYS = {
  USERS: 'anon_users',
  SESSION: 'anon_session',     // { userId, username, joined }
  POSTS: 'anon_posts',
  COMMENTS: 'anon_comments',
  VOTES: 'anon_votes',         // { postId_userId: 'like'|'dislike' }
};

/* ================================================================
   GENERIC HELPERS
   ================================================================ */
function getStore(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}
function setStore(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}
function getStoreObj(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; }
  catch { return {}; }
}
function setStoreObj(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function timestamp() {
  return new Date().toISOString();
}
function formatDate(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/* ================================================================
   AUTH
   ================================================================ */
const Auth = {
  /** Returns current session object or null */
  session() {
    try { return JSON.parse(localStorage.getItem(KEYS.SESSION)) || null; }
    catch { return null; }
  },

  /** Returns true if a user is logged in */
  isLoggedIn() {
    return !!this.session();
  },

  /**
   * Pre-check uniqueness of username and email WITHOUT creating an account.
   * Returns { ok: true } or { ok: false, field: 'username'|'email', error: string }
   */
  preCheck(username, email) {
    const users = getStore(KEYS.USERS);
    username = username.trim();
    email = email.trim().toLowerCase();
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return { ok: false, field: 'username', error: 'Username already taken.' };
    }
    if (users.find(u => u.email === email)) {
      return { ok: false, field: 'email', error: 'An account with this email already exists.' };
    }
    return { ok: true };
  },

  /**
   * Register a new user.
   * Returns { ok: true } or { ok: false, error: string }
   */
  register(username, email, password) {
    const users = getStore(KEYS.USERS);

    // Normalise
    username = username.trim();
    email = email.trim().toLowerCase();

    // Uniqueness checks
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return { ok: false, error: 'Username already taken.' };
    }
    if (users.find(u => u.email === email)) {
      return { ok: false, error: 'An account with this email already exists.' };
    }

    // Simple hash (NOT production-safe – placeholder for backend bcrypt)
    const pwHash = btoa(password + '_anon_salt_placeholder');

    const newUser = {
      id: uid(),
      username,
      email,
      pwHash,
      joined: timestamp(),
    };
    users.push(newUser);
    setStore(KEYS.USERS, users);
    return { ok: true };
  },

  /**
   * Log in.
   * Returns { ok: true } or { ok: false, error: string }
   */
  login(usernameOrEmail, password) {
    const users = getStore(KEYS.USERS);
    const val = usernameOrEmail.trim().toLowerCase();

    const user = users.find(
      u => u.username.toLowerCase() === val || u.email === val
    );
    if (!user) return { ok: false, error: 'Invalid credentials.' };

    const pwHash = btoa(password + '_anon_salt_placeholder');
    if (user.pwHash !== pwHash) return { ok: false, error: 'Invalid credentials.' };

    // Store session (no sensitive data – just userId, username, joined)
    localStorage.setItem(KEYS.SESSION, JSON.stringify({
      userId: user.id,
      username: user.username,
      joined: user.joined,
    }));
    return { ok: true };
  },

  logout() {
    localStorage.removeItem(KEYS.SESSION);
    window.location.href = 'welcome.html';
  },
};

/* ================================================================
   POSTS
   ================================================================ */
const Posts = {
  getAll() {
    return getStore(KEYS.POSTS).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  getById(id) {
    return getStore(KEYS.POSTS).find(p => p.id === id) || null;
  },

  getByUser(userId) {
    return getStore(KEYS.POSTS)
      .filter(p => p.authorId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  create(title, body) {
    const session = Auth.session();
    if (!session) return { ok: false, error: 'Not logged in.' };
    if (!title.trim()) return { ok: false, error: 'Title cannot be empty.' };
    if (!body.trim()) return { ok: false, error: 'Body cannot be empty.' };

    const posts = getStore(KEYS.POSTS);
    const post = {
      id: uid(),
      authorId: session.userId,  // stored but NEVER shown to others
      title: title.trim(),
      body: body.trim(),
      likes: 0,
      dislikes: 0,
      createdAt: timestamp(),
    };
    posts.push(post);
    setStore(KEYS.POSTS, posts);
    return { ok: true, post };
  },

  search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return this.getAll();
    return this.getAll().filter(p =>
      p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q)
    );
  },

  /**
   * Delete a post (and cascade-delete its comments + votes).
   * Only the author can delete.
   */
  delete(postId) {
    const session = Auth.session();
    if (!session) return { ok: false, error: 'Not logged in.' };

    const posts = getStore(KEYS.POSTS);
    const idx = posts.findIndex(p => p.id === postId);
    if (idx === -1) return { ok: false, error: 'Post not found.' };
    if (posts[idx].authorId !== session.userId) return { ok: false, error: 'Not your post.' };

    posts.splice(idx, 1);
    setStore(KEYS.POSTS, posts);

    // Cascade: remove all comments on this post
    const comments = getStore(KEYS.COMMENTS).filter(c => c.postId !== postId);
    setStore(KEYS.COMMENTS, comments);

    // Cascade: remove votes for this post
    const votes = getStoreObj(KEYS.VOTES);
    Object.keys(votes).forEach(k => { if (k.startsWith(postId + '_')) delete votes[k]; });
    setStoreObj(KEYS.VOTES, votes);

    return { ok: true };
  },
};

/* ================================================================
   COMMENTS
   ================================================================ */
const Comments = {
  getByPost(postId) {
    return getStore(KEYS.COMMENTS)
      .filter(c => c.postId === postId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },

  getByUser(userId) {
    return getStore(KEYS.COMMENTS)
      .filter(c => c.authorId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  create(postId, body) {
    const session = Auth.session();
    if (!session) return { ok: false, error: 'Not logged in.' };
    if (!body.trim()) return { ok: false, error: 'Comment cannot be empty.' };

    const comments = getStore(KEYS.COMMENTS);
    const comment = {
      id: uid(),
      postId,
      authorId: session.userId,  // stored but NEVER shown to others
      body: body.trim(),
      createdAt: timestamp(),
    };
    comments.push(comment);
    setStore(KEYS.COMMENTS, comments);
    return { ok: true, comment };
  },

  /**
   * Delete a comment. Only the author can delete.
   */
  delete(commentId) {
    const session = Auth.session();
    if (!session) return { ok: false, error: 'Not logged in.' };

    const comments = getStore(KEYS.COMMENTS);
    const idx = comments.findIndex(c => c.id === commentId);
    if (idx === -1) return { ok: false, error: 'Comment not found.' };
    if (comments[idx].authorId !== session.userId) return { ok: false, error: 'Not your comment.' };

    comments.splice(idx, 1);
    setStore(KEYS.COMMENTS, comments);
    return { ok: true };
  },
};

/* ================================================================
   VOTES
   ================================================================ */
const Votes = {
  get(postId) {
    const store = getStoreObj(KEYS.VOTES);
    const session = Auth.session();
    if (!session) return { like: 0, dislike: 0, mine: null };
    const key = `${postId}_${session.userId}`;
    const posts = getStore(KEYS.POSTS);
    const post = posts.find(p => p.id === postId);
    return {
      like: post ? post.likes : 0,
      dislike: post ? post.dislikes : 0,
      mine: store[key] || null,
    };
  },

  vote(postId, type) {
    const session = Auth.session();
    if (!session) return;
    const store = getStoreObj(KEYS.VOTES);
    const posts = getStore(KEYS.POSTS);
    const idx = posts.findIndex(p => p.id === postId);
    if (idx === -1) return;

    const key = `${postId}_${session.userId}`;
    const prev = store[key] || null;

    // Undo if same
    if (prev === type) {
      if (type === 'like') posts[idx].likes = Math.max(0, posts[idx].likes - 1);
      else posts[idx].dislikes = Math.max(0, posts[idx].dislikes - 1);
      delete store[key];
    } else {
      // Remove previous vote
      if (prev === 'like') posts[idx].likes = Math.max(0, posts[idx].likes - 1);
      if (prev === 'dislike') posts[idx].dislikes = Math.max(0, posts[idx].dislikes - 1);
      // Apply new vote
      if (type === 'like') posts[idx].likes += 1;
      if (type === 'dislike') posts[idx].dislikes += 1;
      store[key] = type;
    }

    setStore(KEYS.POSTS, posts);
    setStoreObj(KEYS.VOTES, store);
  },
};

/* ================================================================
   GUARD: Require Login
   ================================================================ */
function requireLogin() {
  if (!Auth.isLoggedIn()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

/* ================================================================
   GUARD: Redirect if Already Logged In
   ================================================================ */
function redirectIfLoggedIn(dest = 'index.html') {
  if (Auth.isLoggedIn()) {
    window.location.href = dest;
  }
}
