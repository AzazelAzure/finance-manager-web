# Privacy Policy

**The Hive Financial Manager** | thehivemanager.com  
**Version:** 1.0  
**Effective date:** 2026-06-27  
**Last updated:** 2026-06-27  

---

## Layered Notice (NPC Circular 2023-04 — At-Setup Summary)

Before you create an account, here is a plain-language summary of what we collect and why. The full policy is below.

**Who we are:** The Hive Financial Manager ("Hive," "we," "us"), operated by Patrick Proctor, Philippines.

**What we collect:** Your username, email address, and the financial data you enter into the app. We do not collect your real name, phone number, or payment card details at this time.

**Where your data goes:** Your account and financial data are stored on servers located in the United States (Phoenix, Arizona), operated by Namecheap. Your data also travels through Cloudflare's network for security and delivery. No other third parties receive your data. We do not sell or share your personal information.

**Why we collect it:** To operate your account and provide the budgeting service you requested.

**Your rights:** You may access, correct, delete, or object to the processing of your personal data at any time by contacting us at privacy@thehivemanager.com.

**Data Protection Officer:** Patrick Proctor — privacy@thehivemanager.com

*Full policy below.*

---

## 1. Who We Are

**Personal Information Controller:**  
The Hive Financial Manager  
Operated by: Patrick Proctor  
Email: support@thehivemanager.com  
Philippines  

**Data Protection Officer (DPO):**  
Patrick Proctor  
privacy@thehivemanager.com  

The DPO is the point of contact for all data privacy inquiries, data subject rights requests, and breach notifications. If you have questions about how your personal data is handled, contact the DPO directly.

---

## 2. Scope of This Policy

This Privacy Policy applies to all personal data collected and processed by The Hive Financial Manager ("Hive," "the app," "the service") through the web application at thehivemanager.com and its associated Progressive Web App (PWA).

This policy does not apply to third-party websites or services linked from the app. Those third parties have their own privacy policies, for which we are not responsible.

---

## 3. Personal Data We Collect

### 3.1 Data You Provide Directly

| Data | Description | Stored server-side? |
|---|---|---|
| Username | Your chosen account identifier. Not required to be your real name. | Yes |
| Email address | Used for account authentication and operator contact. | Yes |
| Password | Stored as a one-way cryptographic hash (Argon2id). Your raw password is never stored or transmitted after the initial authentication request. | Yes (hash only) |
| Financial transaction data | Income entries, expenses, categories, tags, payment sources, budgets, savings goals, and upcoming expenses that you enter into the app. | Yes — **dual-write model** (see §3.2) |

We do not collect your real name, phone number, national ID, or payment card details.

### 3.2 How Your Financial Data Is Stored — Dual-Write Model

When you enter financial data into Hive while connected to the internet, that data is written simultaneously to two locations:

1. **Our server** (Namecheap VPS, Phoenix AZ, USA) — the primary store, used to sync your data across sessions and devices.
2. **Your device** (browser IndexedDB via Dexie.js) — a local copy used for offline access and PWA performance. This copy is device-specific and is not transmitted to us.

This means **we do receive and store your financial transaction data on our servers.** The local Dexie copy is a mirror for your offline use only. If you clear your browser storage, the local copy is deleted, but your server-side data remains intact until you delete your account.

The local Dexie copy persists in your browser until you clear your browser storage or delete your account. There is no automatic time-based purge of the local copy — it is overwritten by newer data from the server on reconnection. Once local storage encryption is deployed, the local copy will be encrypted at rest using XSalsa20-Poly1305; until then, the local copy is not encrypted at rest.

### 3.3 Data Generated Automatically

| Data | Description | Stored server-side? |
|---|---|---|
| Pseudonymous security identifier | A salted, one-way SHA-256 hash of your IP address (16 hexadecimal characters). Not linked to your identity. Used only for security event correlation (rate limiting, abuse detection). | Yes — 90-day rolling retention `pending infrastructure deploy` |
| User UUID | A pseudonymous reference used in operational logs and aggregate analytics. Not linked to your name or email in any log. | Yes |
| User agent class | Classified as one of: user, bot, crawler, unknown. The raw user agent string is not stored. | Yes — aggregate counts only |
| API endpoint and response data | Normalized request paths (with any UUIDs or IDs stripped) and HTTP response codes. Used for service performance monitoring. | Yes — aggregate only |
| Daily and monthly active user counts | Aggregate counts only. No individual-level tracking. | Yes |
| Invite chain events | Pairs of UUIDs (inviter and invitee) used to understand how the app spreads. No names or email addresses are stored in these records. | Yes |
| Diagnostic / error logs | Per-UUID log files generated when the app reports a diagnostic event. These logs do not contain your name, email, or financial data. They are keyed by a random UUID and are accessible only to the operator. | Yes — 14-day retention, 10MB rotation |

> **Note on PII in general logs:** Certain internal operational log entries (not the diagnostic error logs described above) may currently include your username in plain text. This is a known gap being resolved as part of the next security hardening sprint. Until resolved, access to these logs is restricted to the operator only.

### 3.4 Data We Do Not Collect

- Real name, phone number, national ID, or government identifier
- Payment card numbers or bank account credentials
- Raw IP addresses (we hash them immediately — see pseudonymous security identifier above)
- Biometric data
- Precise geolocation
- Device identifiers beyond user agent classification
- Any data from children under 18 (see §11)

---

## 4. How We Use Your Data

| Purpose | Data used | Legal basis (GDPR Art 6 — CYA) | PH-DPA basis |
|---|---|---|---|
| Providing the budgeting service | Username, email, financial transaction data | Contract — necessary to deliver the requested service | Consent + legitimate purpose |
| Authentication and account security | Email, hashed password, pseudonymous security identifier | Contract; legitimate interest (security) | Legitimate purpose |
| Service reliability and performance monitoring | UUID, endpoint data, aggregate counts, diagnostic logs | Legitimate interest — service reliability | Legitimate purpose |
| Abuse and fraud prevention | Pseudonymous security identifier (hashed IP), user agent class | Legitimate interest — security of the service | Legitimate purpose |
| Communicating service changes or security notices | Email | Legitimate interest — necessary communication | Legitimate purpose |
| Spending projection and budgeting analysis | Your financial transaction data (historical patterns only) | Contract — this is a core feature of the service | Legitimate purpose |

We do not use your data for advertising, profiling for commercial targeting, or any purpose not listed here.

### 4.1 Note on Predictive Budgeting

The app includes a predictive budgeting feature that analyzes your historical transaction data to produce spending projections and burn-rate estimates. These projections are **informational only** and are produced using statistical analysis of data you have entered. They do not constitute financial advice, and no automated decision with legal or similarly significant effect is made about you. See the Terms of Service for the full financial disclaimer.

---

## 5. Data Sharing and Third-Party Processors

We do not sell, rent, or share your personal data with any third party for commercial purposes.

We use the following third-party processors, who process your data only to the extent necessary to provide their services to us:

| Processor | Role | Data they receive | Location |
|---|---|---|---|
| Namecheap (phoenixNAP VPS) | Server hosting — stores all server-side account and financial data | All server-side data listed in §3 | Phoenix, Arizona, USA |
| Cloudflare | Content delivery, DDoS protection, traffic routing | Your raw IP address, request metadata, and Cloudflare-generated identifiers (CF-Ray) | Singapore point of presence (primary); global network |

No other third-party processors are used. We do not use third-party analytics services, advertising networks, or external error logging services.

> **Coming soon (Google OAuth):** When Google OAuth login is implemented, Google will be added to this table as a processor. Their privacy policy will apply to the authentication flow.

> **Coming soon (GCash / Maya / payment processor):** When payment processing is implemented, the relevant processor(s) will be added here.

---

## 6. International Data Transfers

Your personal data is transferred to and stored in the United States (Namecheap/phoenixNAP, Phoenix AZ). The Philippines and the United States do not have a mutual adequacy arrangement.

As the Personal Information Controller, we remain responsible under RA 10173 Section 21 for personal data transferred to third-party processors, domestically or internationally, and we require comparable protection through contractual means.

**Reference:** NPC Advisory No. 2024-01 (Model Contractual Clauses for Cross-Border Data Transfers).

Your data also passes through Cloudflare's global network, which may involve routing through servers in multiple jurisdictions. Cloudflare processes data under its own privacy policy and Data Processing Addendum, which includes standard contractual protections.

---

## 7. Data Retention

| Data | Retention period | Notes |
|---|---|---|
| Account data (username, email, hashed password) | Until account deletion | Deleted immediately upon account deletion request |
| Financial transaction data (server-side) | Until account deletion | All financial data is deleted upon account deletion via our account deletion mechanism |
| Local Dexie copy (device-side) | No automatic purge — persists until browser storage is cleared or account deleted | Device-side only; not controlled by the operator after write; overwritten by server sync on reconnection |
| Pseudonymous security identifier (hashed IP) | 90-day rolling `pending infrastructure deploy` | Non-recoverable hash; used for security event correlation only |
| Diagnostic / error logs | 14 days, 10MB rotation | UUID-keyed; no PII; operator access only |
| Aggregate analytics (DAU/MAU, invite chain, endpoint stats) | Indefinite | No individual-level data; purely aggregate/pseudonymous |

When you delete your account, all of the above server-side personal data — including your username, email, hashed password, and all financial transaction data — is deleted immediately via our account deletion mechanism. UUID-keyed diagnostic logs are not deleted on account deletion because they contain no personal data that can be linked to your identity.

---

## 8. Your Rights

Regardless of where you are located, you have the following rights with respect to your personal data:

| Right | What it means |
|---|---|
| Right of access | You may request a copy of the personal data we hold about you. |
| Right to correction | You may request that inaccurate personal data be corrected. |
| Right to deletion / erasure | You may request that your personal data be deleted. You can also delete your account directly from within the app. |
| Right to object | You may object to the processing of your personal data for a specific purpose. |
| Right to data portability | You may request your personal data in a structured, machine-readable format. |
| Right to withdraw consent | Where processing is based on consent, you may withdraw that consent at any time without affecting the lawfulness of prior processing. |
| Right to file a complaint | Philippine residents may file a complaint with the National Privacy Commission (NPC) at www.privacy.gov.ph. |

**To exercise any of these rights**, contact the DPO at privacy@thehivemanager.com. We will respond within 30 calendar days. Complex requests may be extended by an additional 30 days with notice.

We do not sell or share your personal information with third parties for commercial purposes. You do not need to opt out of anything we are not doing.

**California residents:** We do not sell or share your personal information as defined under the California Consumer Privacy Act (CCPA/CPRA). You have the rights listed above plus the right to non-discrimination for exercising your privacy rights.

**Do-Not-Track:** Our servers do not respond to browser Do-Not-Track signals because we do not engage in cross-site behavioral tracking. Our analytics are server-side, aggregate, and pseudonymous.

---

## 9. Security

We implement the following technical and organizational security measures:

- **TLS/HTTPS:** All traffic between your browser and our servers is encrypted in transit. Cloudflare enforces HTTPS for all connections.
- **Password hashing:** Your password is stored as a one-way Argon2id hash. Your raw password is never stored.
- **Authentication tokens:** Access tokens will be stored in memory only (not localStorage); refresh tokens will be stored in an HttpOnly, Secure, SameSite=Strict cookie. Until cookie-based refresh token authentication is deployed, tokens are stored in localStorage, which carries elevated XSS risk. No PII is included in any JWT payload.
- **Local storage encryption:** The local Dexie.js copy of your financial data will be encrypted at rest using XSalsa20-Poly1305 with an in-memory, API-derived key. Until local storage encryption is deployed, the local copy is not encrypted at rest.
- **IP pseudonymization:** Raw IP addresses are immediately converted to a non-recoverable salted SHA-256 hash. The raw IP is not logged or stored.
- **Cloudflare DDoS and WAF protection:** Network-level security filtering is applied to all inbound traffic.
- **Access controls:** Diagnostic logs and operational data are accessible to the operator only.

No method of transmission over the internet or method of electronic storage is 100% secure. While we use commercially reasonable security measures, we cannot guarantee absolute security. You are responsible for maintaining the security of your account credentials and device.

---

## 10. Cookies and Local Storage

This app uses strictly necessary cookies (authentication session management, CSRF protection) and functional local storage (Dexie.js for offline financial data access). We do not use advertising or tracking cookies.

See our **Cookie Policy** for the complete list of cookies and storage items in use, their purposes, and your choices.

---

## 11. Children's Privacy

The Hive Financial Manager is intended for users aged 18 and older. We do not knowingly collect personal data from anyone under the age of 18. Age is self-declared during account creation and is not independently verified.

We do not knowingly collect personal data from children under the age of 13. If we become aware that a user is under 18, we will delete their account and all associated data promptly.

If you believe a minor has created an account, please contact us at privacy@thehivemanager.com.

---

## 12. Breach Notification

In the event of a personal data breach:

- We will notify the National Privacy Commission (NPC) within 72 hours of discovery where the breach involves sensitive personal information or poses a risk of identity fraud or serious harm to data subjects.
- We will notify affected data subjects via their registered email address or in-app notification without undue delay where required.
- Breach coordination is handled by the DPO (privacy@thehivemanager.com).

---

## 13. Policy Updates

We will update this Privacy Policy when:

- We add new features that collect or process personal data
- Legal or regulatory requirements change
- Our data practices change in any material way

For material changes, we will provide notice via in-app notification and email to your registered address before the new version takes effect. Continued use of the app after the effective date constitutes acceptance of the updated policy.

Previous versions of this policy will remain accessible with their effective date ranges.

---

## 14. NPC Registration Status

As of the effective date of this policy, The Hive Financial Manager does not meet the mandatory NPC registration thresholds under NPC Circular 2022-04 (fewer than 250 employees; processing data of fewer than 1,000 individuals). Patrick Proctor has been designated as Data Protection Officer regardless of registration status, as required.

When our user base approaches 500 meaningful accounts, we will re-assess whether the volume and sensitivity of financial data we process triggers the 1,000-individual threshold.

---

## 15. Contact

**For general support:**  
support@thehivemanager.com

**For data privacy inquiries, data subject rights requests, and breach reports:**  
Patrick Proctor, Data Protection Officer  
privacy@thehivemanager.com

**National Privacy Commission (Philippines):**  
www.privacy.gov.ph
