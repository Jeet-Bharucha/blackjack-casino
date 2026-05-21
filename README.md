# ♠ Blackjack Casino Royale

A full-stack online Blackjack casino web application with real payments, tournaments, a cosmetics shop, leaderboards, VIP tiers, and more.

🌐 **Live Site:** [blackjack-casino-inky.vercel.app](https://blackjack-casino-inky.vercel.app)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Database | MySQL (Railway) |
| Real-time | Socket.IO |
| Payments | Stripe Checkout |
| Email | Resend API |
| Auth | JWT (JSON Web Tokens), bcryptjs |
| Deployment | Railway (backend), Vercel (frontend) |
| Version Control | Git, GitHub |

---

## Features

### 🎮 Gameplay
- Full Blackjack game with Hit, Stand, Double Down, Split, and Insurance
- Real-time multiplayer support via Socket.IO
- Card flip animations and chip sound effects (customizable)
- Win animations triggered on victories

### 👤 Accounts & Auth
- User registration with age verification (must be 21+)
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
- View and verify user accounts
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
├── verify-age.html         # Age & identity verification
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
| **Railway** | Hosts the Node.js backend + MySQL database |
| **Vercel** | Hosts the static frontend HTML/CSS/JS |
| **Stripe** | Processes real payments |
| **Resend** | Sends transactional emails |

---

## Environment Variables (Railway)

| Variable | Description |
|----------|-------------|
| `DB_HOST` | MySQL internal host |
| `DB_PORT` | MySQL port |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name |
| `JWT_SECRET` | Secret key for JWT tokens |
| `STRIPE_SECRET_KEY` | Stripe secret API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `RESEND_API_KEY` | Resend email API key |
| `APP_URL` | Frontend URL (Vercel) |

---

## Resume Description

> **Blackjack Casino Royale** — Full-stack web application built with Node.js, Express, MySQL, and Socket.IO. Features include real-time multiplayer, Stripe payment integration, JWT authentication, a cosmetics shop with 50+ items, VIP progression system, tournament system, and automated email invoicing via Resend API. Deployed on Railway (backend) and Vercel (frontend).

---

## License

This project is for educational and portfolio purposes only. Not intended for real gambling.

---

*Built with ♠ by Jeet Bharucha*
