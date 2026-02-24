# ANONYMOUS

A text-based anonymous community. Post, comment, and vote with no identity attached.

## Stack
- **Frontend**: HTML, CSS, Bootstrap, Vanilla JS
- **Backend**: Node.js, Express
- **Database**: SQLite via `sql.js` (pure JavaScript, zero native compilation)
- **Auth**: bcrypt password hashing, express-session

## Local Development

```bash
cd server
npm install
npm run dev
```

Then open **http://localhost:3000**

## Environment Variables

Create `server/.env` (copy from `server/.env.example`):

| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | ✅ | Long random string for session signing |
| `PORT` | optional | Defaults to `3000` |
| `NODE_ENV` | optional | Set to `production` for HTTPS-only cookies |
| `DB_PATH` | optional | Path to SQLite file. Defaults to `server/anonymous.db` |

## Deploy to Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Set **Root Directory** to `server`
4. Add environment variables:
   - `SESSION_SECRET` = a long random string
   - `NODE_ENV` = `production`
5. Add a **Volume** in Railway → mount path `/data`
6. Add env var: `DB_PATH` = `/data/anonymous.db`
7. Deploy ✅

## Features
- Anonymous registration (OTP email verification)
- Create posts, comment, like/dislike
- Delete own posts and comments from profile
- No user identity is ever exposed to others
