# Cookie and Storage Policy

**The Hive Financial Manager** | thehivemanager.com  
**Version:** 1.0  
**Effective date:** 2026-06-27  
**Last updated:** 2026-06-27  

---

## 1. What This Policy Covers

This Cookie and Storage Policy explains what cookies and browser storage technologies The Hive Financial Manager ("Hive," "we," "us") uses, why we use them, and what choices you have.

"Cookies" are small text files stored in your browser. We also use browser technologies that behave similarly — specifically IndexedDB (used by Dexie.js) and the Service Worker Cache API. This policy covers all of these.

---

## 2. Our Storage Footprint — Summary

Hive has a minimal storage footprint. We use **no advertising cookies, no third-party analytics cookies, and no cross-site tracking technologies.** Our storage use falls into two categories:

| Category | Items | Consent required? |
|---|---|---|
| **Strictly necessary** | Authentication session, CSRF protection, consent preference | No — exempt from consent, but disclosed here |
| **Functional** | Local financial data (Dexie.js IndexedDB), offline cache (Service Worker) | Disclosed as necessary to deliver the service you requested |

There are no marketing, analytics, or advertising storage items currently in use.

---

## 3. Strictly Necessary Storage

Strictly necessary items are essential to the secure operation of the service. You cannot use the app without them. They are exempt from consent requirements but are disclosed here in full.

### 3.1 Authentication Token

After T05 is deployed, authentication will work as follows:

- **Access token:** Stored in memory only (a JavaScript variable). It is not written to localStorage, cookies, or any persistent storage. It is lost when you close the browser tab and is recovered silently on your next visit.
- **Refresh token:** Stored in an `HttpOnly; Secure; SameSite=Strict` cookie scoped to the `/auth/refresh` endpoint. Because it is `HttpOnly`, it is inaccessible to JavaScript — this protects it from cross-site scripting (XSS) attacks.

| Item | Type | Purpose | Duration | Party |
|---|---|---|---|---|
| Refresh token cookie | `HttpOnly` cookie | Maintains your authenticated session | Per refresh rotation policy | First-party |

**Until T05 is deployed:** Authentication tokens are currently stored in `localStorage`. No personally identifiable information is included in the token payload. This is disclosed accurately here pending the security hardening sprint.

### 3.2 CSRF Protection Token

`[PENDING T05]` — CSRF tokens on state-changing routes will be implemented as part of the T05 security hardening sprint, which introduces cookie-based refresh token authentication. CSRF tokens protect against cross-site request forgery attacks.

| Item | Type | Purpose | Duration | Party |
|---|---|---|---|---|
| CSRF token | Session cookie | Protects state-changing requests against cross-site forgery | Session (cleared on tab close) | First-party |

### 3.3 Consent Preference Store

We store your consent preferences so that you are not asked for the same consent each time you visit.

| Item | Type | Purpose | Duration | Party |
|---|---|---|---|---|
| Consent preference record | localStorage | Records the timestamp, version, and categories of your consent choices | 1 year | First-party |

---

## 4. Functional Storage

Functional storage is used to deliver features you have specifically requested. It is not used for tracking, advertising, or analytics.

### 4.1 Dexie.js Local Financial Data (IndexedDB)

The app uses Dexie.js, a wrapper around the browser's built-in IndexedDB database, to store a copy of your financial data locally on your device. This is the foundation of the app's offline capability (PWA).

| Item | Type | Purpose | Duration | Party |
|---|---|---|---|---|
| Dexie IndexedDB stores (`outbox`, `caches`, `meta`) | IndexedDB | Local copy of your financial data for offline access and PWA performance | No automatic purge — persists until browser storage cleared or account deleted | First-party |

**Key facts about the Dexie copy:**

- **Dual-write model:** Your financial data is written to our servers AND to your local Dexie database simultaneously when you are online. The server copy is the primary store. The Dexie copy is a local mirror.
- **Operator does not receive the Dexie copy:** Once written to your device, the local copy is not transmitted back to us. It exists solely on your device.
- **No automatic purge:** The local copy is not automatically deleted on a time schedule. It persists on your device until you clear browser storage or delete your account. When you reconnect to the server, the local copy is updated with the latest server data.
- **Browser storage clearing:** If you clear your browser storage, the Dexie copy is deleted. Your server-side data is not affected.

`[PENDING T06]` Once T06 is deployed, the Dexie local copy will be encrypted at rest using XSalsa20-Poly1305. The encryption key will be derived from the API session and held in memory only — it will never be written to localStorage or cookies. Until T06 is deployed, the local copy is not encrypted at rest.

### 4.2 Service Worker Cache

The PWA uses a Service Worker to cache app assets (HTML, CSS, JavaScript, images) so that the app loads quickly and can function without a network connection.

| Item | Type | Purpose | Duration | Party |
|---|---|---|---|---|
| Service Worker cache | Cache API | Caches static app assets for offline use and performance | Managed by Service Worker lifecycle; cleared on app update or cache invalidation | First-party |

The Service Worker cache stores only app code and static assets — it does not store your personal financial data. Financial data offline access is handled by Dexie.js (§4.1).

---

## 5. What We Do Not Use

To be explicit about our current storage footprint:

- **No advertising cookies** — we do not serve advertising
- **No third-party analytics cookies** — our analytics are server-side, aggregate, and pseudonymous (no client-side tracking cookie is set)
- **No social media tracking pixels**
- **No cross-site tracking identifiers**
- **No Sentry, Datadog, or other external error logging services** (diagnostics are server-side and UUID-keyed)

---

## 6. Third-Party Cookies

We do not set third-party cookies. However, Cloudflare, which handles traffic routing and DDoS protection, may set its own identifiers as part of its service. These are operational in nature (security, bot detection) and are governed by Cloudflare's privacy policy.

`[PLACEHOLDER: When OAuth login is implemented (e.g., Google), the OAuth provider may set its own cookies during the authentication flow. These will be disclosed here at that time.]`

---

## 7. Your Choices

### 7.1 Consent

On your first visit, you will be shown a consent notice describing our storage use. You may acknowledge and continue, or you may choose not to create an account.

Because all storage items we currently use are either strictly necessary or functional (necessary to deliver the service), there is currently no meaningful "reject" choice beyond choosing not to use the service. We disclose this honestly. We will not implement a fake "reject" option that does not actually prevent storage writes.

If we add non-essential cookies in the future (for example, analytics or advertising), we will update the consent interface to allow you to accept or reject those categories separately.

### 7.2 Withdrawing Consent

You may withdraw your consent for functional Dexie local storage at any time by:

1. Requesting account deletion (which deletes your server-side data)
2. Clearing your browser storage (which deletes the local Dexie copy)

To clear browser storage: in most browsers, go to Settings → Privacy → Clear browsing data → Cached data and local storage.

`[PENDING design: a Dexie opt-out mechanism accessible from within the app settings will be implemented before policy publication — open item N4.]`

### 7.3 Browser Controls

You can configure your browser to block cookies or local storage. Note that blocking strictly necessary items will prevent you from logging in or using the app.

### 7.4 "Do Not Sell" — CCPA

We do not sell or share your personal information. You do not need to opt out of anything we do not do.

### 7.5 Global Privacy Control (GPC)

Our servers do not engage in cross-site data sharing or behavioral advertising, so GPC signals do not change the way we process your data. We are disclosing this response to GPC as required by applicable law.

---

## 8. Policy Updates

We will update this policy when:

- We add new cookies or storage items
- We remove items currently in use
- A placeholder section is filled because the corresponding feature is implemented

The effective date is shown at the top of this document. For material changes, we will notify you via in-app notice and email before the new version takes effect.

---

## 9. Contact

For questions about this policy or our storage practices, contact:

**Data Protection Officer**  
Patrick Proctor  
privacy@thehivemanager.com

---

## Appendix — Complete Storage Inventory

| Item | Type | Category | Purpose | Duration | Party | Consent |
|---|---|---|---|---|---|---|
| Refresh token cookie `[PENDING T05]` | HttpOnly cookie | Strictly necessary | Authentication session | Rotation policy | First | Exempt |
| Auth token in localStorage `[Until T05]` | localStorage | Strictly necessary | Authentication (interim) | Session/persistent | First | Exempt |
| CSRF token `[PENDING T05]` | Session cookie | Strictly necessary | Request forgery protection | Session | First | Exempt |
| Consent preference record | localStorage | Strictly necessary | Store consent choices | 1 year | First | Exempt |
| Dexie IndexedDB (`outbox`, `caches`, `meta`) | IndexedDB | Functional | Local financial data for offline access | No auto-purge; until browser storage cleared | First | Functional disclosure |
| Service Worker cache | Cache API | Functional | Static asset caching for PWA | SW lifecycle | First | Functional disclosure |
| `[PLACEHOLDER: OAuth provider cookie]` | Cookie (third-party) | Strictly necessary | OAuth authentication flow | Provider-defined | Third | TBD at implementation |

---

*The Hive Financial Manager — Cookie and Storage Policy v1.0 — DRAFT — 2026-06-27*  
*For attorney review before publication.*
