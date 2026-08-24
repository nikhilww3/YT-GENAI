# ZeroFare (YT-GENAI)

Free interview-prep app. Upload a resume + job description → Gemini generates questions,
match score, skill gaps, a prep roadmap, and a LaTeX-compiled tailored resume PDF.

## Layout

- `Backend/` — Express 5 + Mongoose. Entry: `Backend/server.js` (**listens on port 3000**).
  - `src/controllers` · `src/routes` · `src/models` · `src/middlewares` · `src/services` (Gemini, PDF) · `src/templates` (LaTeX .hbs)
- `Frontend/` — React 19 + Vite 8 + SCSS. Features live in `src/features/{auth,interview}/`.

## Running it

```bash
cd Backend  && npm run dev     # nodemon, port 3000
cd Frontend && npm run dev     # vite dev server
cd Frontend && npm run lint    # eslint
cd Frontend && npm run build   # must stay green before you call a change done
```

There is no backend test suite (`npm test` is a stub). Verify backend changes by running it.

## Conventions that matter

- **All frontend→backend calls go through the shared axios instances**:
  `src/features/auth/services/auth.api.js` and `src/features/interview/services/interview.api.js`,
  both with `baseURL: "http://localhost:3000"` and `withCredentials: true`.
  Never hardcode a URL or `import.meta.env.VITE_API_URL` in a component or hook — that is exactly
  how the username checker silently drifted to port 5000 and reported every name as taken.
- **Three-state availability/loading flags.** `null` means *unknown*, not *false*. Render `null`
  as nothing (or as an error message), never as a negative result.
- Auth is cookie/JWT based via `src/middlewares/auth.middleware.js`; `register`/`login` in
  `auth.api.js` intentionally let errors propagate so the UI can show the real backend message.
- Secrets live in `Backend/.env` (gitignored, and I am blocked from reading it). If something
  can't reach a service, suspect a missing env var before suspecting the code.

## Working agreements

- Prefer small, verifiable changes. After touching the frontend, run `npm run build`.
- Don't commit unless asked.
- Ignore the stray `backups/ cache/ file-history/ history.jsonl projects/ sessions/ shell-snapshots/
  tasks/ telemetry/ session-env/` directories at the repo root — they are leaked Claude Code state,
  not project source. They are gitignored.
