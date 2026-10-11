# ♠ Blackjack Casino Royale

A free-to-play Blackjack portfolio game with server-controlled solo rounds, practice tables with friends, cosmetics, tournaments, leaderboards, and daily challenges. Players cannot buy chips, cash out, or win prizes of monetary value.

🌐 **Live Site:** [blackjack-casino-inky.vercel.app](https://blackjack-casino-inky.vercel.app)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Database | TiDB Cloud (MySQL-compatible) |
| Real-time | Socket.IO |
| Payments | None: virtual chips and prizes have no monetary value |
| Email | Resend API |
| Auth | JWT (JSON Web Tokens), bcryptjs |
| Deployment | Render (backend), Vercel (frontend) |
| Version Control | Git, GitHub |

---

## Features

### 🎮 Gameplay
- Full Blackjack game with Hit, Stand, Double Down, Split, and Insurance
- Real-time multiplayer support via Socket.IO
- Card flip animations and chip sound effects (customizable)
- Win animations triggered on victories

### 👤 Accounts & Auth
- User registration with a self-reported date-of-birth age gate (21+), without ID or selfie uploads
- JWT-based login/logout
- Password reset via email (6-digit code)
- Account deletion with password confirmation

### 🏆 Progression
- VIP tier system: Bronze → Silver → Gold → Platinum → Diamond
- 12 unlockable achievements
- Daily login bonus with streak multiplier
- Global leaderboard with player rankings

### 🎨 Cosmetics Shop (50+ items)
- Card backs, table felt, chip designs
- Table themes (Vegas Night, Neon City, Egypt, Space, Pirate)
- Win animations, dealer avatars, card flip animations
- Profile badges/titles, avatar borders, name colors
- Reaction sticker packs for multiplayer
- Chip sound effects
- Functional perks (Extra Daily Bonus, Insurance Boost)

### 🏅 Tournaments
- Admin-created tournaments with buy-ins and prize pools
- Live leaderboard during active tournaments
- Recent results history

### 🆓 Free Play
- Free virtual chips through account signup, daily bonuses and challenges
- Cosmetic items can be earned with in-game chips only
- No purchases, subscriptions, cash prizes or withdrawals

### 🛡️ Responsible Gambling
- Free-play controls and self-exclusion (1 day to 90 days)
- Links to gambling support resources

### 📊 History & Transparency
- Full game history with hand-by-hand breakdown
- Win rate, biggest win, and profit/loss stats
- Virtual-chip cosmetics transaction history

### ⚙️ Admin Panel
- Create and manage tournaments
- View and manage user accounts without storing new ID or selfie submissions
- Manage cosmetics shop inventory

---

## Project Structure

```
BlackjackApp/
├── backend/
│   └── server.js          # Express API + Socket.IO server
├── blackjack.html          # Main game
├── index.html              # Landing page
├── login.html              # Login & Register
├── profile.html            # User profile
├── shop.html               # Cosmetics shop
├── tournament.html         # Tournaments
├── leaderboard.html        # Global leaderboard
├── history.html            # Game history
├── transactions.html       # Transaction history
├── responsible.html        # Responsible gambling tools
├── admin.html              # Admin panel
├── terms.html              # Terms of Service
├── privacy.html            # Privacy Policy
├── verify-age.html         # Legacy link: no ID upload, continue to game
├── cookie-banner.js        # Cookie consent banner
├── favicon.svg             # Gold spade favicon
├── vercel.json             # Vercel deployment config
└── package.json            # Root package for Railway
```

---

## Getting Started (Local Development)

### Prerequisites
- Node.js v18+
- MySQL database
- Resend account (optional for emails)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Jeet-Bharucha/blackjack-casino.git
   cd blackjack-casino
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Create a `.env` file in the `backend/` folder**
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=blackjack
   JWT_SECRET=your_jwt_secret
   RESEND_API_KEY=re_...
   APP_URL=http://localhost:4000
   ```

4. **Start the backend server**
   ```bash
   node server.js
   ```

5. **Open the frontend**
   Open `index.html` in your browser (or use Live Server in VS Code)

---

## Deployment

| Service | Purpose |
|---------|---------|
| **Render** | Hosts the Node.js backend | 
| **TiDB Cloud** | Hosts the MySQL-compatible database |
| **Vercel** | Hosts the static frontend HTML/CSS/JS |
| **Resend** | Sends transactional emails |

---

## Environment Variables (Render)

| Variable | Description |
|----------|-------------|
| `DB_HOST` | TiDB Cloud hostname |
| `DB_PORT` | 4000 for TiDB Cloud Starter |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name |
| `JWT_SECRET` | Secret key for JWT tokens |
| `RESEND_API_KEY` | Resend email API key |
| `APP_URL` | Canonical frontend URL (Vercel) |
| `FRONTEND_ORIGINS` | Optional comma-separated list of allowed browser origins |
| `EMAIL_FROM` | Verified sender address for Resend password-reset messages |

---

## Resume Description

> **Blackjack Casino Royale** — Full-stack web application built with Node.js, Express, MySQL, and Socket.IO. Features include server-authoritative Blackjack, real-time multiplayer, JWT authentication, a virtual-chip cosmetics shop, VIP progression, tournaments, and account recovery emails via Resend API. Deployed on Render (backend), TiDB Cloud (database), and Vercel (frontend).

---


## Secure free-play upgrade (October 2026)

- **Solo games are server-authoritative:** card draws, settlement, balance deductions, and history recording happen in the backend. Untrusted `/api/game/result` and `POST /api/game-history` endpoints return HTTP 410.
- **Crash recovery:** unfinished single-player rounds are stored in the `solo_games` table and resume on refresh or after backend restart.
- **Private multiplayer:** invitation codes, invite links and ready-up for 2+ players. Private/public live tables use a **separate temporary 1,000-chip practice stack**. They do not change account balances or rankings.
- **Season leaderboard:** `/api/leaderboard/season` ranks only `solo_results` recorded by the authoritative engine. Older untrusted historic rows do not count toward the season.
- **Daily challenges:** earn and claim virtual-chip bonuses from verified solo rounds via `/api/challenges` and `/api/challenges/claim` (one claim per challenge per UTC day).
- **No payment endpoints:** checkout, payment verification, subscriptions, webhook credits, and the payment SDK have been removed from active code. Neither the site nor API accepts paid chip purchases or cash redemptions.
- **Authentication:** login throttling, password-reset codes delivered by email (never returned in responses), and token invalidation after password reset. Account resets require a working `RESEND_API_KEY` and approved `EMAIL_FROM`; otherwise the reset route reports that email is not configured.
- **Player experience:** saved mute setting, card-deal animations, reduced-motion support, and improved small-screen multiplayer layout.
- **Age gate:** registration uses a self-reported date of birth (21+). This **does not independently verify age**.

## Development checks

Run `cd backend && npm test` for game-engine unit tests. On a test deployment, verify `GET /api/health`, registration, gameplay, shop purchases with virtual chips, challenge claims, leaderboard, password reset email delivery, and multiplayer private invitations.

**Legacy data caution:** Existing ID/selfie images from the old verification flow may still be present in your database. The old upload endpoints have been removed, but images already stored or backed up were not deleted by these changes. Review and safely purge those records separately after confirming any retention obligations.

## Publishing and possible monetization

The site is already publicly accessible via Vercel. Advertising, sponsorships or licensing the code **may** be possible, subject to publisher approvals and local rules for simulated casino-style games; ad network eligibility and revenue are **not guaranteed**. Do not sell or redeem chips, award cash or prizes for Blackjack outcomes, or enable paid entry without specialized legal and payment-provider review. Virtual chips are play-only and have no cash value.

The old `stripe_purchases` database table, if present in an older deployment, is left untouched for archival/retention purposes but is no longer written to or queried by the application. Removing the integration does not revoke old keys or purge Git history; revoke any previously exposed real secrets separately.

## Luxury interior and launch readiness (October 2026)

- Obsidian & Gold design now extends from the marketing page and game tables to the virtual-chip shop, player profiles, leaderboards, tournaments, game history, cosmetics ledger, account sign-in and policy pages.
- Updated responsive grids, navigable mobile tables, keyboard-operable shop filters, tournament/login tabs, accessible avatar upload, readable focus states and consistent no-cash virtual-chip labels.
- Improved resilience when cosmetics APIs fail, and avoided overlapping tournament countdown timers and several unsafe string interpolations.
- Added public-page search metadata, `robots.txt`, `sitemap.xml` and privacy-minded Vercel response headers. Account-only pages explicitly request `noindex`.
- See **[LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md)** before promoting the website. Automated tests and the Vercel deployment check **do not replace real-device browser QA**.
- The site remains free-play; launch and ad eligibility depend on platform policies, age restrictions and jurisdiction-specific review. Old credentials in Git history must be revoked separately.

## Release Phase 1–4: reliability, security, retention and promotion

- **Reliability:** reconnect a dropped practice-table seat for up to 30 seconds, preserve the same in-memory practice chips/cards, and show meaningful reconnecting states. Practice-table state cannot survive a Render process restart; production-grade persistence is a separate future architectural project.
- **Security:** shared REST/WebSocket origin list, protected backend static files, no-store authenticated API responses, stricter auth input checks, session enforcement of self-exclusion and rate-limited practice chat. Weekly bonuses now use atomic conditional credits.
- **Retention:** a daily mission claim-progress badge on the Blackjack table uses the existing, **server-verified** challenges. No backend odds or reward amounts changed.
- **Public growth:** optional share-with-friends buttons on the public homepages, and clearly visible 21+ entertainment-only/free-play messaging. Native share/clipboard is user-initiated; no tracking scripts.
- **Monetization:** see **[MONETIZATION_READINESS.md](MONETIZATION_READINESS.md)**. No ads, in-game sales, sponsor contracts or domain purchases were activated.
- **Checks:** see **[LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md)** and `backend/tests/reliability-phases.test.js`. Automated tests do not replace manual mobile QA or testing with two actual players.

## License

This project is for educational and portfolio purposes only. Not intended for real gambling.

---

*Built with ♠ by Jeet Bharucha*
