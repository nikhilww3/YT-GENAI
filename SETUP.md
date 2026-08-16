# YT-GENAI — Local Setup Guide

Use this guide whenever you reopen the project after a long break or set it up on a new machine.

## Prerequisites

Install these once on your machine:

| Tool | Version (tested) | Install |
|------|------------------|---------|
| **Node.js** | v18+ (you have v24) | [nodejs.org](https://nodejs.org/) |
| **npm** | comes with Node | included with Node |
| **MongoDB** | local or Atlas | [mongodb.com](https://www.mongodb.com/try/download/community) or [Atlas free tier](https://www.mongodb.com/cloud/atlas) |

Check versions:

```bash
node -v
npm -v
```

---

## Project structure

```
YT-GENAI/
├── Backend/     # Express API (port 3000)
├── Frontend/    # React + Vite app (port 5173)
└── SETUP.md     # this file
```

---

## First-time setup (or after a long break)

### 1. Backend environment variables

```bash
cd Backend
cp .env.example .env
```

Edit `.env` and set:

```env
MONGO_URL=mongodb://127.0.0.1:27017/yt-genai   # or your Atlas URL
JWT_SECRET=your-long-random-secret-here
```

> **Never commit `.env`** — it contains secrets. Only `.env.example` (placeholders) goes in git.

### 2. Install dependencies

Run in **both** folders:

```bash
# Backend
cd Backend
npm install

# Frontend
cd ../Frontend
npm install
```

`node_modules/` is not committed. Always run `npm install` after cloning or if packages look missing.

### 3. Start MongoDB (if using local DB)

**macOS (Homebrew):**

```bash
brew services start mongodb-community
```

**Or run once:**

```bash
mongod --dbpath /path/to/your/data
```

Skip this step if `MONGO_URL` points to MongoDB Atlas.

---

## Running the app

Open **two terminals**:

**Terminal 1 — Backend:**

```bash
cd Backend
npm run dev
```

Expected output:

```
Connect to Database
Server is running on port 3000
```

**Terminal 2 — Frontend:**

```bash
cd Frontend
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

---

## Ports & URLs

| Service  | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:3000 |
| Auth API | http://localhost:3000/api/auth |

Frontend talks to Backend at `http://localhost:3000` (see `Frontend/src/features/auth/services/auth.api.js`).

---

## Quick health checks

**Backend is up:**

```bash
curl http://localhost:3000/api/auth/get-me
# Expected: {"message":"token not provided"}
```

**MongoDB connected:** look for `Connect to Database` in the Backend terminal.

---

## Common issues

### `npm install` fails or packages missing

```bash
rm -rf node_modules package-lock.json
npm install
```

Do this inside `Backend/` or `Frontend/` separately.

### Backend starts but no DB connection

- Check `MONGO_URL` in `Backend/.env`
- Ensure MongoDB is running (local) or Atlas IP whitelist allows your IP
- Atlas: verify username, password, and cluster URL

### CORS errors in browser

Backend allows `http://localhost:5173` only. If Vite uses a different port, update `Backend/src/app.js`:

```js
app.use(cors({
    origin: "http://localhost:5173",  // match your Vite port
    credentials: true
}))
```

### Port already in use

```bash
lsof -i :3000   # Backend
lsof -i :5173   # Frontend
kill <PID>
```

---

## Useful commands

```bash
# Backend — production start (no auto-reload)
cd Backend && node server.js

# Backend — dev with auto-reload
cd Backend && npm run dev

# Frontend — dev server
cd Frontend && npm run dev

# Frontend — production build
cd Frontend && npm run build
```

---

## Checklist after reopening the project

- [ ] `node -v` works
- [ ] `Backend/.env` exists with `MONGO_URL` and `JWT_SECRET`
- [ ] `npm install` in `Backend/` and `Frontend/`
- [ ] MongoDB running (local or Atlas)
- [ ] Backend on port 3000
- [ ] Frontend on port 5173
