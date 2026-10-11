# Security & performance review — 2026-10-11

This review examines the public GitHub source and proposes fixes in the accompanying pull request. It is **not** a penetration test, browser speed measurement, cloud configuration audit, or evidence that the site is legally/advertising compliant.

## Security and performance changes staged in this PR

| Area | Issue found in source | Proposed fix |
| --- | --- | --- |
| Profile image upload | `/api/profile` accepted any `data:image/*` string, including SVG, without decoding limits or checking signatures. A user-controlled large image can inflate DB/storage and leaderboard responses. | Reject SVG and non-raster data, cap decoded JPEG/PNG/GIF/WebP uploads to 150 KiB, check raster signatures, reject unexpected types with HTTP 400, and limit all incoming JSON to 256 KiB. The current profile page compresses pictures to 200px JPEG, compatible with this limit. **Already stored avatars are not altered or deleted.** |
| Multiplayer network use | Every `table_update` transmitted embedded avatar data and up to 50 chat messages for up to five players, even though the multiplayer UI doesn't read them. | Send only the state the client consumes, retaining cards, balances, phases, turn, invite codes, masked dealer card, connection state, and independent chat events. |
| Client runtime | Chat appended an unlimited number of DOM messages in prolonged sessions. | Retain the newest 100 chat messages in the browser without affecting play. |
| Practice-table shuffling | Multiplayer used `Math.random`; server-controlled solo already uses `crypto.randomInt`. | Use `crypto.randomInt` for the Fisher–Yates shuffle. Card ranks and odds remain the same. |
| Password reset requests | Reset codes accumulated until individually consumed and repeat requests from different IPs could generate frequent emails. | Prune expired codes, cap pending reset entries at 1,000, limit resend attempts for one account to once per minute, validate six-digit codes, and prevent concurrent reuse. Codes are still email-only and expire after 15 minutes; plaintext codes are never stored. |
| Transient memory & hanging external requests | Per-IP request counters could grow with arbitrary remote addresses; the outbound email API had no timeout. | Cap counters to roughly 10,000 keys, periodically prune expired keys, and use a 10-second timeout for email delivery. |

## What the fixes deliberately do not touch

- No live database migration, reset, balance change, player account deletion or new real-money functionality.
- No JWT rotation or secret inspection performed automatically.
- No manual edits to existing avatar records (old large images remain large until users replace them).
- No new HTTP tracking/analytics/ads or email campaigns.

## Still needs the site owner's attention (important)

1. **Revoke historical secrets.** The public repository previously included a database password and Stripe-related credentials in Git history. Removing a tracked file **does not** invalidate or erase them. Rotate/revoke relevant TiDB/old Railway, Stripe and webhook credentials where applicable. Do not paste secrets into tickets, PRs or chat.
2. **Verify Render configuration.** Confirm that `JWT_SECRET`, `DB_PASSWORD`, `RESEND_API_KEY` and other sensitive values are in private Render environment settings, never served as files or included in client bundles. `JWT_SECRET` rotation will invalidate active logins—schedule it and notify players if you choose to rotate.
3. **Validate runtime.** After merge and Render redeploy, confirm `GET /api/health` returns `{"status":"ok"}`; test existing login, solo round, multiplayer private invite, avatar upload, password reset email and self-exclusion on disposable accounts. Test an invalid SVG avatar produces HTTP 400.
4. **Test load.** Have a handful of *consenting* test players use the same practice table and watch Socket.IO latency, Render CPU/RAM and DB query latency. This code-level optimization does not prove performance at a particular concurrency level.
5. **Deployment limits.** Per-IP and reset-code maps are **in process memory**, so they reset after a Render restart and are not shared across multiple processes. For multi-instance production, use shared Redis or similar for distributed limits and durable password-reset state; that architecture is not included here.
6. **Dependencies.** Keep GitHub Dependabot alerts and security updates enabled; evaluate its proposed PRs before merging. Installing the latest packages blindly can introduce breaking changes.
7. **Policies.** This remains a 21+ self-reported-age free-play demonstration, with no cash rewards. Complete a legal/privacy/advertising policy review before public marketing or adding monetization.

## Deployment acceptance checks

`backend/npm test` on GitHub Actions; Vercel frontend build; Render automatic redeploy; manual phone/table smoke checks. Review changes before merging.
