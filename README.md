# finance_manager_web

React + TypeScript + Vite frontend for Finance Manager (beta rollout track).

## Environment

Create a `.env` or `.env.local` in this directory (not committed). Vite exposes only variables prefixed with `VITE_`.

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Base URL for the Django API (no trailing slash). **Lane A (local API):** e.g. `http://127.0.0.1:8000`. **Lane B (prod API):** e.g. `https://api.thehivemanager.com`. |

The browser Origin (e.g. `http://localhost:5173` or `https://jsdevtesting.thehivemanager.com`) must be allowed by the API `CORS_ALLOWED_ORIGINS` or logins will fail in ways that look like generic network errors.

## Scripts

- `npm ci` — clean install from lockfile (CI and first clone).
- `npm run dev` — Vite dev server (default port 5173).
- `npm run build` — production bundle to `dist/`.

## Lane A — local API (SQLite) + Vite (optional)

Use this for fast UI work without touching production. The API defaults to **SQLite** when Postgres-style `DB_*` variables are not set (see `finance_manager_api` settings).

**1. API (from `../finance_manager_api` in the ecosystem clone):**

```bash
cd ../finance_manager_api   # or your path to the API repo
test -f .env || cp .env.example .env   # set SECRET_KEY; keep DEBUG=True for local
uv sync --group dev
python manage.py migrate
python manage.py createsuperuser   # one-time; use the username/password you will enter in the web UI
python manage.py runserver 0.0.0.0:8000
```

**2. Web — point the browser at the local API**

Create `.env.local` in this directory:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

**3. Run Vite**

```bash
npm run dev
```

Open `http://localhost:5173` and sign in. Default API `CORS_ALLOWED_ORIGINS` includes that Origin; if you still see CORS or network errors, confirm the API process is bound to `8000` and that `VITE_API_BASE_URL` has no trailing slash.

**Runtime:** If another agent needs the same local ports, coordinate via `design_docs/30_Releases/Runtime_Signup_Sheet.md` in the design-docs submodule.

## Lane B — `jsdevtesting.thehivemanager.com` via Cloudflare Tunnel (local)

Use this to hit the **real HTTPS hostname** in the browser while the app and `cloudflared` run on your machine. The API stays **`https://api.thehivemanager.com`** (set `VITE_API_BASE_URL` accordingly in `.env.local`).

**1. Env for prod API from tunnel origin**

```bash
# .env.local
VITE_API_BASE_URL=https://api.thehivemanager.com
```

**2. Start the app (pick one)**

| Mode | Command | **Cloudflare “private” / service URL** (aka localhost pointer) |
|------|---------|------------------------------------------------------------------|
| **Dev (HMR)** | `npm run dev` | **`http://127.0.0.1:5173`** (Vite default port) |
| **Built assets** | `npm run build` then `npm run preview` | **`http://127.0.0.1:4173`** (Vite default preview port; see `vite.config.ts` `preview.port`) |

**3. Cloudflare Tunnel / Zero Trust public hostname**

- **Public hostname:** `jsdevtesting.thehivemanager.com` (or your agreed FQDN).
- **Type:** HTTP.
- **Service / origin URL (what you asked for):** one of the URLs in the table above. Prefer **`http://127.0.0.1:5173`** for day‑to‑day dev, or **`http://127.0.0.1:4173`** to test the production bundle.

`http://localhost:...` and `http://127.0.0.1:...` are equivalent for `cloudflared` on the same host; `127.0.0.1` avoids a few IPv6/localhost gotchas on Linux.

**4. CORS** — the API must allow `https://jsdevtesting.thehivemanager.com` in `CORS_ALLOWED_ORIGINS` (default in this repo’s API settings includes it on the feature branch; prod must match after deploy). Same for **`https://jsdevprodtest.thehivemanager.com`** when using the preview port tunnel.

## VPS: `dev@159.198.75.194` (Cloudflare → localhost)

The beta host can run **Vite on the VPS** (no Docker) so tunnel private URLs stay **`http://127.0.0.1:5173`** and **`http://127.0.0.1:4173`** without touching the Reflex `docker compose` stack.

1. **One-time:** Node via [nvm](https://github.com/nvm-sh/nvm) in `dev`’s home; `git pull` or rsync this repo to e.g. `/home/dev/finance_manager_web`.
2. **Env:** `/home/dev/finance_manager_web/.env.local` with `VITE_API_BASE_URL=https://api.thehivemanager.com`.
3. **Install + build:** `npm ci && npm run build`.
4. **Run (background):** `./scripts/vps-serve.sh start` — dev on `127.0.0.1:5173`, preview on `127.0.0.1:4173`. `stop` / `status` are supported. Logs under `logs/vite-*.log`.

If the full ecosystem is cloned, coordinate with `design_docs/30_Releases/Runtime_Signup_Sheet.md` when another agent owns `fm_docker.sh` on the same host.

---

## React + TypeScript + Vite (template)

This template provides a minimal setup to get React working with Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
