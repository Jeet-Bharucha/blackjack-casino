# ♠ Blackjack Casino Royale

A full-stack Blackjack portfolio game with trusted solo rounds, private practice tables, cosmetics, tournaments, leaderboards, and daily challenges. Real-money purchases are disabled by default.

🌐 **Live Site:** [blackjack-casino-inky.vercel.app](https://blackjack-casino-inky.vercel.app)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Database | TiDB Cloud (MySQL-compatible) |
| Real-time | Socket.IO |
| Payments | Disabled by default (optional integration) |
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

### 💳 Payments
- Stripe Checkout for chip packages ($0.99 – $9.99)
- Invoice email sent automatically after purchase
- Transaction history page

### 🛡️ Responsible Gambling
- Monthly deposit limits
- Self-exclusion (1 day to 90 days)
- Links to gambling support resources

### 📊 History & Transparency
- Full game history with hand-by-hand breakdown
- Win rate, biggest win, and profit/loss stats
- Transaction history for all purchases

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
├── success.html            # Payment success page
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
- Stripe account (optional for payments)
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
   STRIPE_SECRET_KEY=sk_test_...
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
| **Stripe** | Processes real payments |
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
| `STRIPE_SECRET_KEY` | Stripe secret API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `RESEND_API_KEY` | Resend email API key |
| `APP_URL` | Canonical frontend URL (Vercel) |
| `FRONTEND_ORIGINS` | Optional comma-separated list of allowed browser origins |
| `EMAIL_FROM` | Verified sender address for Resend password-reset messages |
| `ENABLE_REAL_MONEY_PURCHASES` | Defaults off; only consider enabling after legal/provider review |

---

## Resume Description

> **Blackjack Casino Royale** — Full-stack web application built with Node.js, Express, MySQL, and Socket.IO. Features include real-time multiplayer, Stripe payment integration, JWT authentication, a cosmetics shop with 50+ items, VIP progression system, tournament system, and automated email invoicing via Resend API. Deployed on Render (backend), TiDB Cloud (database), and Vercel (frontend).

---


## Secure free-play upgrade (October 2026)

- **Solo games are server-authoritative:** card draws, settlement, balance deductions, and history recording happen in the backend. Untrusted `/api/game/result` and `POST /api/game-history` endpoints return HTTP 410.
- **Crash recovery:** unfinished single-player rounds are stored in the `solo_games` table and resume on refresh or after backend restart.
- **Private multiplayer:** invitation codes, invite links and ready-up for 2+ players. Private/public live tables use a **separate temporary 1,000-chip practice stack**. They do not change account balances or rankings.
- **Season leaderboard:** `/api/leaderboard/season` ranks only `solo_results` recorded by the authoritative engine. Older untrusted historic rows do not count toward the season.
- **Daily challenges:** earn and claim virtual-chip bonuses from verified solo rounds via `/api/challenges` and `/api/challenges/claim` (one claim per challenge per UTC day).
- **Free-play payments:** checkout and subscriptions are disabled unless `ENABLE_REAL_MONEY_PURCHASES=true` and valid Stripe secrets are supplied. Do not enable real-money features without appropriate legal/payment provider review.
- **Authentication:** login throttling, password-reset codes delivered by email (never returned in responses), and token invalidation after password reset. Account resets require a working `RESEND_API_KEY` and approved `EMAIL_FROM`; otherwise the reset route reports that email is not configured.
- **Player experience:** saved mute setting, card-deal animations, reduced-motion support, and improved small-screen multiplayer layout.
- **Age gate:** registration uses a self-reported date of birth (21+). This **does not independently verify age**.

## Development checks

Run `cd backend && npm test` for game-engine unit tests. On a test deployment, verify `GET /api/health`, registration, gameplay, shop purchases with virtual chips, challenge claims, leaderboard, password reset email delivery, and multiplayer private invitations.

**Legacy data caution:** Existing ID/selfie images from the old verification flow may still be present in your database. The old upload endpoints have been removed, but images already stored or backed up were not deleted by these changes. Review and safely purge those records separately after confirming any retention obligations.

## License

This project is for educational and portfolio purposes only. Not intended for real gambling.

---

*Built with ♠ by Jeet Bharucha*
