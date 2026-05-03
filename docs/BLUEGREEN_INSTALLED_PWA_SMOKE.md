# Blue/green + installed PWA — operator smoke notes

**Audience:** HitM and agents validating the flagship web stack behind the **HTTPS :8443** proxy (`deploy/BLUEGREEN_SWITCHOVER.md`).

## Hostname rules (avoid wrong-origin installs)

- **Production PWA installs** must use the **production app origin** you intend users to bookmark (apex or `www` as configured on the proxy). An installed PWA is **scoped to its origin**; service worker, cookies, and `localStorage` do not cross origins.
- **`jsdevtesting.thehivemanager.com`** and **`api-jsdevtesting.thehivemanager.com`** are for **pre-cutover / inactive-color** full-stack checks. Treat them as **separate origins** from production. Do not ask beta users to “install from staging” unless you explicitly accept a **second** installed app and session boundary.
- After **`switch`** promotes a color, confirm the **active** `server_name` blocks still match the hostname you used for the install. Mixed hostname tests (staging cookie on prod host) waste time and confuse session state.

## Post-`switch` installed PWA (Chrome certified)

1. Note **active color** before and after: `./scripts/fm_server_beta.sh status` (on the VPS app root, with compose env loaded per project docs).
2. Open the **already installed** PWA (not only an ephemeral browser tab).
3. Expect **update UX** (`registration.waiting`): user should see **“Update available — Reload”** (or equivalent) and reload without a broken chunk loop.
4. If the shell is blank offline, confirm **second visit** after SW activation (D4): navigations use **network-first** in Workbox; first offline visit may still fail until shell is cached.

## Cookie / session boundary

- Auth tokens live in **browser storage** for the SPA. Staging and production are different sites; logging into both yields **two independent sessions**.

## Related

- Research checklist (parent **finance_manager** workspace): `plans/S1/S1.B/pwa-install-offline-sync-research/README.md` §3.1  
- D4 execution template (same): `plans/S1/S1.B/pwa-install-offline-sync-research/D4_SMOKE_CHECKLIST_AND_ADR.md` §3.6
