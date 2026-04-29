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

## Docker (ecosystem / proxy verification)

The parent **finance_manager** monorepo wires this app into `docker-compose.yml` and `docker-compose.bluegreen.yml` as **`web`** (single stack) or **`web-blue` / `web-green`** (blue/green). The **proxy** service exposes `https` on the host (e.g. `8443:443`) and routes `jsdevtesting.thehivemanager.com` / `jsdevprodtest.thehivemanager.com` to the **active** color’s static container, alongside API and Reflex.

- **Build-time API URL:** set `VITE_API_BASE_URL` in the parent `.env` or pass a compose `build.args` value (default `https://api.thehivemanager.com`).
- **Build:** from the monorepo root, e.g. `podman compose build web` (or `web-blue` / `web-green` in blue/green). Do not rely on `npm run dev` / Vite for this path — the image serves `dist/` with nginx.
- For smoke checks on the host, `scripts/fm_server_beta.sh` `deploy` / `smoke` include the `web-$color` service.

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

**4. If you see Cloudflare 502 on `jsdevtesting` / `jsdevprodtest`**

Vite serves **plain HTTP** on **5173** / **4173**. The tunnel’s **private “Service” URL** in Zero Trust must use **`http://`**, not **`https://`**:

| Hostname | Service (origin) to set |
|----------|-------------------------|
| `jsdevtesting…` | **`http://127.0.0.1:5173`** |
| `jsdevprodtest…` | **`http://127.0.0.1:4173`** |

If you set **`https://127.0.0.1:…`**, `cloudflared` attempts a **TLS** handshake; Vite does not speak TLS on those ports, so the connection fails and Cloudflare shows **502 Bad Gateway**. **`noTLSVerify` only helps when the origin already uses HTTPS** (e.g. self-signed) — it does **not** make a plain-HTTP Vite process accept `https://` on the same port.

**5. CORS** — the API must allow `https://jsdevtesting.thehivemanager.com` and `https://jsdevprodtest.thehivemanager.com` in `CORS_ALLOWED_ORIGINS` (browser Origin is still **https**; only the loopback hop to Vite is **http**). If login shows **ERR_NETWORK** but the API works from Reflex, see the API doc [CORS_PRODUCTION_TROUBLESHOOTING.md](https://github.com/AzazelAzure/finance-manager-api/blob/main/docs/CORS_PRODUCTION_TROUBLESHOOTING.md) (Cloudflare often caches a bad **OPTIONS** preflight for `api.thehivemanager.com`).

**6. Plan gates B2 + B3 together** — Open **`https://<your-tunnel-hostname>/`**, sign in against **`https://api.thehivemanager.com`**, confirm dashboard / snapshot.

## VPS: `dev@159.198.75.194` (Cloudflare → localhost)

When the **full compose / blue–green** stack (including `web-*`) is up on the host, prefer **HTTPS via the proxy** to `https://jsdev…` and avoid running **both** the host `vps-serve.sh` ports and the proxy on the same host without coordinating ports.

The beta host can otherwise run **Vite on the VPS** (no Docker) so tunnel private URLs stay **`http://127.0.0.1:5173`** and **`http://127.0.0.1:4173`** without touching the Reflex `docker compose` stack.

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
