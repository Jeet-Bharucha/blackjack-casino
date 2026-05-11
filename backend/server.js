const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const mysql      = require('mysql2/promise');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const path       = require('path');
require('dotenv').config();

// ── EMAIL (Resend) ────────────────────────────────────
let resendApiKey = null;
if (process.env.RESEND_API_KEY) {
  resendApiKey = process.env.RESEND_API_KEY;
  console.log('✅ Email (Resend) ready');
} else {
  console.warn('⚠️  Email not configured — set RESEND_API_KEY in Railway Variables');
}

async function sendEmail({ to, subject, html }) {
  if (!resendApiKey) return;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Blackjack Casino <onboarding@resend.dev>', to, subject, html }),
    });
    if (!res.ok) { const e = await res.json(); console.warn('Resend error:', e.message); }
    else console.log('✅ Email sent to', to);
  } catch (e) { console.warn('Email send failed:', e.message); }
}

function receiptEmailHTML({ username, chips, amount, newBalance, pkg }) {
  return `
  <div style="background:#0d0500;padding:40px 20px;font-family:Georgia,serif;color:#f0f0f0;max-width:520px;margin:0 auto;border-radius:12px;">
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:40px;">♠</div>
      <h1 style="color:#ffd764;letter-spacing:6px;font-size:22px;margin:8px 0 4px;">BLACKJACK</h1>
      <p style="color:rgba(255,215,100,.4);font-size:12px;letter-spacing:2px;">Casino Royale</p>
    </div>
    <div style="background:rgba(76,255,145,.08);border:1px solid rgba(76,255,145,.3);border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
      <p style="color:rgba(76,255,145,.7);font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Payment Successful</p>
      <p style="color:#4cff91;font-size:42px;font-weight:700;margin:0;">+$${chips.toLocaleString()}</p>
      <p style="color:rgba(255,255,255,.4);font-size:13px;margin-top:6px;">chips added to your account</p>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr style="border-bottom:1px solid rgba(255,255,255,.06);">
        <td style="padding:10px 0;color:rgba(255,255,255,.4);font-size:13px;">Account</td>
        <td style="padding:10px 0;color:#f0f0f0;font-size:13px;text-align:right;">${username}</td>
      </tr>
      <tr style="border-bottom:1px solid rgba(255,255,255,.06);">
        <td style="padding:10px 0;color:rgba(255,255,255,.4);font-size:13px;">Package</td>
        <td style="padding:10px 0;color:#f0f0f0;font-size:13px;text-align:right;">${pkg}</td>
      </tr>
      <tr style="border-bottom:1px solid rgba(255,255,255,.06);">
        <td style="padding:10px 0;color:rgba(255,255,255,.4);font-size:13px;">Amount Charged</td>
        <td style="padding:10px 0;color:#ffd764;font-size:13px;text-align:right;">$${(amount/100).toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:rgba(255,255,255,.4);font-size:13px;">New Balance</td>
        <td style="padding:10px 0;color:#4cff91;font-size:15px;font-weight:700;text-align:right;">$${newBalance.toLocaleString()}</td>
      </tr>
    </table>
    <div style="text-align:center;">
      <a href="${process.env.APP_URL}/blackjack.html" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#c9a227,#ffd764);color:#1a0a00;border-radius:6px;font-weight:700;letter-spacing:2px;text-decoration:none;font-size:12px;">Back to the Table</a>
    </div>
    <p style="text-align:center;color:rgba(255,255,255,.15);font-size:11px;margin-top:24px;">For entertainment only · No real gambling · Blackjack Casino Royale</p>
  </div>`;
}

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

const PORT       = process.env.PORT       || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'blackjack_secret';

// ── STRIPE ────────────────────────────────────────────
const Stripe = require('stripe');
const stripe = process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('REPLACE_ME')
  ? Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
if (!stripe) console.warn('⚠️  Stripe not configured — set STRIPE_SECRET_KEY in .env');

app.use(cors());

// Stripe webhook needs raw body — must be registered BEFORE express.json()
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId  = parseInt(session.metadata?.userId);
    const chips   = parseInt(session.metadata?.chips);
    const pkg     = session.metadata?.package || 'chips';
    if (userId && chips) {
      try {
        await db.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [chips, userId]);
        console.log(`✅ Stripe: credited ${chips} chips to user ${userId}`);
        // Send receipt email
        const [rows] = await db.execute('SELECT username, email, balance FROM users WHERE id=?', [userId]);
        if (rows.length) {
          const u = rows[0];
          await sendEmail({
            to: u.email,
            subject: `🎉 Payment Confirmed — ${chips.toLocaleString()} chips added!`,
            html: receiptEmailHTML({ username: u.username, chips, amount: session.amount_total, newBalance: u.balance, pkg }),
          });
        }
      } catch (e) { console.error('DB error crediting chips:', e.message); }
    }
  }
  // Subscription activated / renewed
  if (['customer.subscription.created','customer.subscription.updated'].includes(event.type)) {
    const sub = event.data.object;
    const userId = parseInt(sub.metadata?.userId);
    if (userId && sub.status === 'active') {
      try {
        await db.execute('UPDATE users SET balance=balance+500 WHERE id=?', [userId]);
        console.log(`✅ VIP subscription active for user ${userId} — +500 chips`);
      } catch (e) { console.error('Subscription DB error:', e.message); }
    }
  }

  // Stripe Identity verified via webhook
  if (event.type === 'identity.verification_session.verified') {
    const session = event.data.object;
    const userId = parseInt(session.metadata?.userId);
    if (userId) {
      try {
        await db.execute("UPDATE users SET verify_status='verified', verified_at=NOW() WHERE id=?", [userId]);
        const [rows] = await db.execute('SELECT email, username FROM users WHERE id=?', [userId]);
        if (rows.length) {
          await sendEmail({
            to: rows[0].email,
            subject: '✅ Identity Verified — Welcome to Blackjack Casino!',
            html: `<div style="background:#0d0500;padding:40px;font-family:Georgia,serif;color:#f0f0f0;max-width:500px;margin:0 auto;border-radius:12px;text-align:center;">
              <div style="font-size:48px;margin-bottom:16px;">✅</div>
              <h1 style="color:#4cff91;">Verified, ${rows[0].username}!</h1>
              <p style="color:rgba(255,255,255,.5);margin:16px 0;">Your identity has been verified. You can now play!</p>
              <a href="${process.env.APP_URL}/blackjack.html" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#c9a227,#ffd764);color:#1a0a00;border-radius:6px;font-weight:700;text-decoration:none;">Play Now →</a>
            </div>`,
          });
        }
        console.log(`✅ Stripe Identity verified user ${userId}`);
      } catch (e) { console.error('Identity webhook error:', e.message); }
    }
  }

  res.json({ received: true });
});

app.use(express.json({ limit: '5mb' })); // allow base64 avatar uploads
app.use(express.static(path.join(__dirname, '..')));

// ── MYSQL ─────────────────────────────────────────────
let db;
async function connectDB() {
  db = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'blackjack',
    waitForConnections: true,
    connectionLimit: 10,
  });

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      username       VARCHAR(20)   NOT NULL UNIQUE,
      email          VARCHAR(255)  NOT NULL UNIQUE,
      password       VARCHAR(255)  NOT NULL,
      display_name   VARCHAR(30)   NULL,
      avatar         MEDIUMTEXT    NULL,
      balance        INT           NOT NULL DEFAULT 500,
      wins           INT           NOT NULL DEFAULT 0,
      losses         INT           NOT NULL DEFAULT 0,
      pushes         INT           NOT NULL DEFAULT 0,
      blackjacks     INT           NOT NULL DEFAULT 0,
      total_hands    INT           NOT NULL DEFAULT 0,
      total_wagered  INT           NOT NULL DEFAULT 0,
      total_won      INT           NOT NULL DEFAULT 0,
      biggest_win    INT           NOT NULL DEFAULT 0,
      streak         INT           NOT NULL DEFAULT 0,
      last_daily_bonus DATE        NULL,
      vip_tier       VARCHAR(20)   NOT NULL DEFAULT 'Bronze',
      win_streak     INT           NOT NULL DEFAULT 0,
      max_win_streak INT           NOT NULL DEFAULT 0,
      created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      date_of_birth  DATE          NULL,
      verify_status  VARCHAR(20)   NOT NULL DEFAULT 'unverified',
      is_admin       TINYINT(1)    NOT NULL DEFAULT 0,
      id_document         MEDIUMTEXT    NULL,
      selfie_photo        MEDIUMTEXT    NULL,
      verified_at         DATETIME      NULL,
      has_bonus_slot      TINYINT(1)    NOT NULL DEFAULT 0,
      has_insurance_boost TINYINT(1)    NOT NULL DEFAULT 0,
      last_bonus_slot_date DATE         NULL,
      equipped_badge      VARCHAR(50)   NULL,
      equipped_name_color VARCHAR(30)   NULL,
      equipped_border     VARCHAR(30)   NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS achievements (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      user_id         INT         NOT NULL,
      achievement_key VARCHAR(50) NOT NULL,
      unlocked_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_achievement (user_id, achievement_key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(100) NOT NULL,
      type        ENUM('hourly','daily','weekly') NOT NULL DEFAULT 'daily',
      buy_in      INT NOT NULL DEFAULT 500,
      prize_pool  INT NOT NULL DEFAULT 0,
      starts_at   DATETIME NOT NULL,
      ends_at     DATETIME NOT NULL,
      status      ENUM('upcoming','active','ended') NOT NULL DEFAULT 'upcoming',
      max_players INT NOT NULL DEFAULT 100,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tournament_entries (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      tournament_id  INT NOT NULL,
      user_id        INT NOT NULL,
      starting_chips INT NOT NULL DEFAULT 1000,
      current_chips  INT NOT NULL DEFAULT 1000,
      hands_played   INT NOT NULL DEFAULT 0,
      joined_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_entry (tournament_id, user_id),
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS cosmetics (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      type        VARCHAR(30)  NOT NULL,
      key_name    VARCHAR(50)  NOT NULL,
      name        VARCHAR(100) NOT NULL,
      description VARCHAR(255),
      price       INT NOT NULL DEFAULT 100,
      UNIQUE KEY uq_cosmetic (type, key_name)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_cosmetics (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      user_id      INT NOT NULL,
      cosmetic_id  INT NOT NULL,
      purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      is_equipped  TINYINT(1) NOT NULL DEFAULT 0,
      UNIQUE KEY uq_user_cosmetic (user_id, cosmetic_id),
      FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
      FOREIGN KEY (cosmetic_id) REFERENCES cosmetics(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS stripe_purchases (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      user_id      INT NOT NULL,
      session_id   VARCHAR(255) NOT NULL UNIQUE,
      chips        INT NOT NULL,
      pkg          VARCHAR(50),
      credited_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Seed default shop items (INSERT IGNORE = safe to re-run)
  await db.execute(`
    INSERT IGNORE INTO cosmetics (type, key_name, name, description, price) VALUES
    ('card_back','classic_red',   'Classic Red',    'The original red card back',              0),
    ('card_back','midnight_blue', 'Midnight Blue',  'Deep blue with gold trim',              500),
    ('card_back','emerald',       'Emerald',        'Luxury green felt pattern',             500),
    ('card_back','gold',          'Gold Royale',    'Shimmering 24K gold pattern',          1500),
    ('card_back','diamond',       'Diamond',        'Exclusive diamond-pattern card back',   3000),
    ('felt',     'green',         'Casino Green',   'Classic casino table felt',                0),
    ('felt',     'navy',          'Navy Blue',      'Elegant midnight navy felt',             750),
    ('felt',     'crimson',       'Crimson',        'Striking deep red felt',                 750),
    ('felt',     'black',         'Obsidian',       'Sleek all-black table',                 2000),
    ('felt',     'purple',        'Royal Purple',   'VIP royal purple table',                2000),
    ('chip',     'classic',       'Classic Chips',  'Standard casino chip design',              0),
    ('chip',     'neon',          'Neon Glow',      'Chips that glow in the dark',           1000),
    ('chip',     'gold',          'Gold Chips',     '24K gold plated chip design',           2500),
    ('chip',     'diamond',       'Diamond Chips',  'Crystal-clear diamond chip design',     5000),
    ('theme','vegas_night','Vegas Night','Neon-lit Vegas strip atmosphere',1500),
    ('theme','neon_city','Neon City','Cyberpunk neon city theme',2000),
    ('theme','egypt','Ancient Egypt','Pyramid and pharaoh atmosphere',2500),
    ('theme','space','Space Casino','Deal cards among the stars',3000),
    ('theme','pirate','Pirate Ship','High stakes on the high seas',2500),
    ('win_anim','confetti','Confetti Burst','Classic confetti celebration',0),
    ('win_anim','gold_coins','Gold Coins Rain','Golden coins rain down on wins',800),
    ('win_anim','fireworks','Fireworks Show','Spectacular fireworks display',1200),
    ('win_anim','lightning','Lightning Strike','Electric lightning bolt on wins',1500),
    ('win_anim','dragon','Dragon Fire','Epic dragon breathes fire on wins',3000),
    ('badge','high_roller','High Roller','Show your big spender status',500),
    ('badge','card_shark','Card Shark','You know how to play the game',500),
    ('badge','lucky_devil','Lucky Devil','Luck is always on your side',750),
    ('badge','the_ace','The Ace','You are the ace in the deck',1000),
    ('badge','whale','The Whale','Big money, big plays',2000),
    ('badge','legend','🌟 Legend','Reserved for the casino elite',5000),
    ('border','gold_crown','Gold Crown','Majestic gold crown border',1000),
    ('border','diamond_frame','Diamond Frame','Sparkling diamond border',2500),
    ('border','neon_glow','Neon Glow Border','Electric neon glow effect',1500),
    ('border','fire_ring','Fire Ring','Blazing fire border',2000),
    ('border','platinum','Platinum Ring','Sleek platinum border',3000),
    ('sticker','classic_pack','Classic Reactions','Basic reaction pack',0),
    ('sticker','hype_pack','Hype Pack','High energy reactions',750),
    ('sticker','savage_pack','Savage Pack','Troll your opponents',1000),
    ('name_color','gold','Gold Name','Your name shines in gold',500),
    ('name_color','crimson','Crimson Name','Bold red username',500),
    ('name_color','cyan','Cyan Name','Electric cyan username',500),
    ('name_color','neon_green','Neon Green Name','Matrix-style green',750),
    ('name_color','purple','Royal Purple Name','Regal purple username',750),
    ('name_color','rainbow','Rainbow Name','Animated rainbow username',3000),
    ('card_anim','classic','Classic Flip','Standard card deal animation',0),
    ('card_anim','slow_reveal','Slow Reveal','Dramatic slow card reveal',600),
    ('card_anim','spin_flip','Spin Flip','Cards spin in dramatically',1000),
    ('card_anim','bounce','Bounce In','Cards bounce onto the table',800),
    ('chip_sound','classic','Classic Casino','Traditional chip sounds',0),
    ('chip_sound','futuristic','Futuristic','Sci-fi electronic chip sounds',600),
    ('chip_sound','coin_drop','Coin Drop','Heavy gold coin dropping',400),
    ('chip_sound','bling','Bling','Luxury high-end sounds',800),
    ('dealer','classic_butler','Classic Butler','The traditional casino dealer',0),
    ('dealer','robot','Robot Dealer','A futuristic AI dealer',1000),
    ('dealer','pirate','Pirate','Arrr, place your bets!',1500),
    ('dealer','wizard','Wizard','A mystical card dealer',2000),
    ('dealer','ninja','Ninja','Silent but deadly dealer',2500),
    ('perk','bonus_slot','Extra Daily Bonus','Claim your daily bonus twice per day',3000),
    ('perk','insurance_boost','Insurance Boost','Improved insurance payout: 3:2 instead of 2:1',2500)
  `);

  // ALTER TABLE for existing deployments — safe to run every boot
  const alterColumns = [
    "ALTER TABLE users ADD COLUMN has_bonus_slot      TINYINT(1)  NOT NULL DEFAULT 0    AFTER verified_at",
    "ALTER TABLE users ADD COLUMN has_insurance_boost TINYINT(1)  NOT NULL DEFAULT 0    AFTER has_bonus_slot",
    "ALTER TABLE users ADD COLUMN last_bonus_slot_date DATE        NULL                  AFTER has_insurance_boost",
    "ALTER TABLE users ADD COLUMN equipped_badge      VARCHAR(50) NULL                  AFTER last_bonus_slot_date",
    "ALTER TABLE users ADD COLUMN equipped_name_color VARCHAR(30) NULL                  AFTER equipped_badge",
    "ALTER TABLE users ADD COLUMN equipped_border     VARCHAR(30) NULL                  AFTER equipped_name_color",
  ];
  for (const sql of alterColumns) {
    try { await db.execute(sql); } catch (e) { /* column already exists — ignore */ }
  }

  console.log('✅ MySQL connected and tables ready');
}
connectDB().catch(err => console.error('❌ MySQL connection failed:', err.message));

// ── TIER SYSTEM (points = total_won) ─────────────────
const TIERS = [
  { name: 'Bronze',   min: 0,      max: 75000,  color: '#cd7f32' },
  { name: 'Silver',   min: 75000,  max: 150000, color: '#aaa'    },
  { name: 'Gold',     min: 150000, max: 225000, color: '#c9a227' },
  { name: 'Platinum', min: 225000, max: 300000, color: '#e5e4e2' },
  { name: 'Diamond',  min: 300000, max: null,   color: '#89f'    },
];

function getVipTier(points) {
  if (points >= 300000) return 'Diamond';
  if (points >= 225000) return 'Platinum';
  if (points >= 150000) return 'Gold';
  if (points >= 75000)  return 'Silver';
  return 'Bronze';
}

function getTierProgress(points) {
  const idx = TIERS.findIndex(t => t.max === null || points < t.max);
  const tier = TIERS[Math.max(0, idx)];
  const pct  = tier.max ? Math.min(100, Math.round((points - tier.min) / (tier.max - tier.min) * 100)) : 100;
  return { tier: tier.name, points, pct, nextAt: tier.max, remaining: tier.max ? tier.max - points : 0, tiers: TIERS };
}

// ── ACHIEVEMENTS ──────────────────────────────────────
const ACHIEVEMENTS = {
  first_hand:      { name: 'First Hand',    desc: 'Play your first hand',        icon: '🃏' },
  first_blackjack: { name: 'Natural!',       desc: 'Get a natural blackjack',     icon: '⭐' },
  win_streak_3:    { name: 'Hot Streak',     desc: 'Win 3 hands in a row',        icon: '🔥' },
  win_streak_5:    { name: 'On Fire',        desc: 'Win 5 hands in a row',        icon: '💥' },
  win_streak_10:   { name: 'Unstoppable',    desc: 'Win 10 hands in a row',       icon: '👑' },
  high_roller:     { name: 'High Roller',    desc: 'Win with a $100+ bet',        icon: '💰' },
  comeback:        { name: 'Comeback Kid',   desc: 'Win when nearly broke',       icon: '💪' },
  veteran_100:     { name: 'Veteran',        desc: 'Play 100 hands',              icon: '🎖️' },
  veteran_500:     { name: 'Elite',          desc: 'Play 500 hands',              icon: '🏆' },
  rich:            { name: 'Millionaire',    desc: 'Reach $10,000 balance',       icon: '💎' },
  double_win:      { name: 'Doubling Down',  desc: 'Win a doubled hand',          icon: '✌️' },
  split_win:       { name: 'Split Decision', desc: 'Win after splitting',         icon: '⚡' },
};

function getDailyBonus(streak, vipTier = 'Bronze') {
  const base = streak >= 7 ? 500 : streak >= 6 ? 400 : streak >= 5 ? 300 : streak >= 4 ? 250 : streak >= 3 ? 200 : streak >= 2 ? 150 : 100;
  const multipliers = { Bronze: 1, Silver: 1.1, Gold: 1.25, Platinum: 1.5, Diamond: 2 };
  return Math.floor(base * (multipliers[vipTier] || 1));
}

const VIP_PERKS = {
  Bronze:   { dailyMultiplier: 1,   weeklyBonus: 0,    minBet: 1,   label: 'Standard access' },
  Silver:   { dailyMultiplier: 1.1, weeklyBonus: 0,    minBet: 1,   label: '+10% daily bonus' },
  Gold:     { dailyMultiplier: 1.25,weeklyBonus: 0,    minBet: 1,   label: '+25% daily bonus · High-Roller table' },
  Platinum: { dailyMultiplier: 1.5, weeklyBonus: 500,  minBet: 1,   label: '+50% daily bonus · $500 weekly bonus' },
  Diamond:  { dailyMultiplier: 2,   weeklyBonus: 1000, minBet: 1,   label: '×2 daily bonus · $1,000 weekly bonus · Private table' },
};

// ── AUTH MIDDLEWARE ───────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
}
function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

// ── HELPERS ───────────────────────────────────────────
function extractStats(u) {
  return {
    wins: u.wins, losses: u.losses, pushes: u.pushes,
    blackjacks: u.blackjacks, totalHands: u.total_hands,
    totalWagered: u.total_wagered, totalWon: u.total_won,
    biggestWin: u.biggest_win, streak: u.streak,
    winStreak: u.win_streak, maxWinStreak: u.max_win_streak,
    points: u.total_won,
  };
}

function publicUser(u, achievements = []) {
  return {
    username:           u.username,
    displayName:        u.display_name || u.username,
    avatar:             u.avatar || null,
    balance:            u.balance,
    vipTier:            u.vip_tier,
    tierProgress:       getTierProgress(u.total_won || 0),
    stats:              extractStats(u),
    achievements,
    createdAt:          u.created_at,
    verifyStatus:       u.verify_status || 'unverified',
    hasBonusSlot:       !!u.has_bonus_slot,
    hasInsuranceBoost:  !!u.has_insurance_boost,
    equippedBadge:      u.equipped_badge || null,
    equippedNameColor:  u.equipped_name_color || null,
    equippedBorder:     u.equipped_border || null,
  };
}

async function checkAndUnlockAchievements(userId, u, result, bet, newBalance) {
  const toCheck = [];
  if (u.total_hands === 1)                               toCheck.push('first_hand');
  if (result === 'blackjack')                            toCheck.push('first_blackjack');
  if (u.win_streak >= 3)                                 toCheck.push('win_streak_3');
  if (u.win_streak >= 5)                                 toCheck.push('win_streak_5');
  if (u.win_streak >= 10)                                toCheck.push('win_streak_10');
  if (bet >= 100 && ['win','dealer_bust','blackjack','double_win','split_win'].includes(result)) toCheck.push('high_roller');
  if (newBalance >= 10000)                               toCheck.push('rich');
  if (u.total_hands >= 100)                              toCheck.push('veteran_100');
  if (u.total_hands >= 500)                              toCheck.push('veteran_500');
  if (result === 'double_win')                           toCheck.push('double_win');
  if (result === 'split_win')                            toCheck.push('split_win');
  if (u.balance <= 200 && ['win','dealer_bust','blackjack'].includes(result)) toCheck.push('comeback');

  const unlocked = [];
  for (const key of toCheck) {
    if (!ACHIEVEMENTS[key]) continue;
    try {
      await db.execute('INSERT IGNORE INTO achievements (user_id, achievement_key) VALUES (?,?)', [userId, key]);
      const [rows] = await db.execute(
        'SELECT id FROM achievements WHERE user_id=? AND achievement_key=? AND unlocked_at > DATE_SUB(NOW(), INTERVAL 5 SECOND)',
        [userId, key]
      );
      if (rows.length) unlocked.push({ key, ...ACHIEVEMENTS[key] });
    } catch {}
  }
  return unlocked;
}

// ── AUTH ROUTES ───────────────────────────────────────
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, dateOfBirth } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });
    if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Username must be 3–20 characters' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    // Age verification — must be 21+
    if (!dateOfBirth) return res.status(400).json({ error: 'Date of birth is required' });
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    if (age < 21) return res.status(400).json({ error: 'You must be 21 or older to play. This platform is for adults only.' });

    const [existing] = await db.execute('SELECT id,username,email FROM users WHERE email=? OR username=?', [email.toLowerCase(), username]);
    if (existing.length) {
      return res.status(400).json({ error: existing[0].email === email.toLowerCase() ? 'Email already registered' : 'Username already taken' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
      'INSERT INTO users (username, email, password, balance, date_of_birth, verify_status) VALUES (?,?,?,500,?,?)',
      [username, email.toLowerCase(), hash, dateOfBirth, 'unverified']
    );
    const token = jwt.sign({ id: result.insertId, username }, JWT_SECRET, { expiresIn: '7d' });

    // Send welcome email
    await sendEmail({
      to: email,
      subject: '🃏 Welcome to Blackjack Casino Royale!',
      html: `<div style="background:#0d0500;padding:40px;font-family:Georgia,serif;color:#f0f0f0;max-width:500px;margin:0 auto;border-radius:12px;text-align:center;">
        <div style="font-size:40px;margin-bottom:10px;">♠</div>
        <h1 style="color:#ffd764;letter-spacing:4px;">Welcome, ${username}!</h1>
        <p style="color:rgba(255,255,255,.5);margin:16px 0;">Your account has been created. Complete age verification to start playing.</p>
        <div style="background:rgba(76,255,145,.08);border:1px solid rgba(76,255,145,.3);border-radius:8px;padding:18px;margin:24px 0;">
          <p style="color:#4cff91;font-size:24px;font-weight:700;margin:0;">$500 Free Chips</p>
          <p style="color:rgba(255,255,255,.4);font-size:13px;margin-top:4px;">Ready after verification</p>
        </div>
        <a href="${process.env.APP_URL}/verify-age.html" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#c9a227,#ffd764);color:#1a0a00;border-radius:6px;font-weight:700;letter-spacing:2px;text-decoration:none;">Verify My Age →</a>
      </div>`,
    });

    res.json({
      token,
      user: { username, displayName: username, avatar: null, balance: 500, vipTier: 'Bronze', tierProgress: getTierProgress(0), stats: {}, verifyStatus: 'unverified' },
      requiresVerification: true,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── AGE VERIFICATION ──────────────────────────────────
app.post('/api/verify-identity', auth, async (req, res) => {
  try {
    const { idDocument, selfiePhoto } = req.body;
    if (!idDocument || !selfiePhoto) return res.status(400).json({ error: 'Both ID document and selfie are required' });
    if (!idDocument.startsWith('data:image/') || !selfiePhoto.startsWith('data:image/'))
      return res.status(400).json({ error: 'Invalid image format' });

    await db.execute(
      'UPDATE users SET id_document=?, selfie_photo=?, verify_status=? WHERE id=?',
      [idDocument, selfiePhoto, 'pending', req.user.id]
    );

    // In a real app: send docs to admin or run AI face match here
    // For demo: auto-approve after 2 seconds (simulate review)
    setTimeout(async () => {
      try {
        await db.execute(
          'UPDATE users SET verify_status=?, verified_at=NOW() WHERE id=? AND verify_status=?',
          ['verified', req.user.id, 'pending']
        );
        const [rows] = await db.execute('SELECT email, username FROM users WHERE id=?', [req.user.id]);
        if (rows.length) {
          await sendEmail({
            to: rows[0].email,
            subject: '✅ Identity Verified — You can now play!',
            html: `<div style="background:#0d0500;padding:40px;font-family:Georgia,serif;color:#f0f0f0;max-width:500px;margin:0 auto;border-radius:12px;text-align:center;">
              <div style="font-size:48px;margin-bottom:16px;">✅</div>
              <h1 style="color:#4cff91;letter-spacing:3px;">Verified!</h1>
              <p style="color:rgba(255,255,255,.5);margin:16px 0;">Hi ${rows[0].username}, your identity has been verified. You can now access the casino.</p>
              <a href="${process.env.APP_URL}/blackjack.html" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#c9a227,#ffd764);color:#1a0a00;border-radius:6px;font-weight:700;letter-spacing:2px;text-decoration:none;">Play Now →</a>
            </div>`,
          });
        }
      } catch (e) { console.error('Auto-approve error:', e.message); }
    }, 2000);

    res.json({ success: true, status: 'pending', message: 'Documents submitted. Verification usually takes a few moments.' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/verify-status', auth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT verify_status, verified_at FROM users WHERE id=?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ status: rows[0].verify_status, verifiedAt: rows[0].verified_at });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.execute('SELECT * FROM users WHERE email=?', [email?.toLowerCase()]);
    if (!rows.length) return res.status(400).json({ error: 'Invalid email or password' });
    const u = rows[0];
    if (!await bcrypt.compare(password, u.password)) return res.status(400).json({ error: 'Invalid email or password' });
    if (u.is_banned) return res.status(403).json({ error: 'Your account has been suspended. Contact support.' });
    if (u.self_excluded_until && new Date(u.self_excluded_until) > new Date()) {
      const until = new Date(u.self_excluded_until).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      return res.status(403).json({ error: `You have self-excluded until ${until}. This is for your wellbeing.` });
    }
    const token = jwt.sign({ id: u.id, username: u.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: publicUser(u) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── FORGOT / RESET PASSWORD ───────────────────────────
const resetCodes = new Map(); // email -> { code, expires }

app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const [rows] = await db.execute('SELECT id, username FROM users WHERE email=?', [email.toLowerCase()]);
    if (!rows.length) return res.status(400).json({ error: 'No account found with that email' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 15 * 60 * 1000; // 15 minutes
    resetCodes.set(email.toLowerCase(), { code, expires, userId: rows[0].id });

    // In a real app this code would be emailed. We return it so the local app works.
    res.json({ success: true, resetCode: code, message: 'Reset code generated (shown here since no email service is configured)' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) return res.status(400).json({ error: 'All fields required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const entry = resetCodes.get(email.toLowerCase());
    if (!entry) return res.status(400).json({ error: 'No reset code found. Please request a new one.' });
    if (Date.now() > entry.expires) { resetCodes.delete(email.toLowerCase()); return res.status(400).json({ error: 'Reset code expired. Please request a new one.' }); }
    if (entry.code !== code.trim()) return res.status(400).json({ error: 'Incorrect reset code' });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.execute('UPDATE users SET password=? WHERE id=?', [hash, entry.userId]);
    resetCodes.delete(email.toLowerCase());
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/me', auth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE id=?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const [achRows] = await db.execute('SELECT achievement_key, unlocked_at FROM achievements WHERE user_id=?', [rows[0].id]);
    res.json(publicUser(rows[0], achRows));
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── PROFILE UPDATE ────────────────────────────────────
app.put('/api/profile', auth, async (req, res) => {
  try {
    const { displayName, avatar } = req.body;
    const updates = [], values = [];

    if (displayName !== undefined) {
      if (displayName && (displayName.length < 2 || displayName.length > 30))
        return res.status(400).json({ error: 'Display name must be 2–30 characters' });
      updates.push('display_name = ?'); values.push(displayName || null);
    }
    if (avatar !== undefined) {
      // Basic validation: must be a data URL or null
      if (avatar && !avatar.startsWith('data:image/'))
        return res.status(400).json({ error: 'Invalid image format' });
      updates.push('avatar = ?'); values.push(avatar || null);
    }

    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    values.push(req.user.id);
    await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id=?`, values);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── DELETE ACCOUNT ────────────────────────────────────
app.delete('/api/account', auth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password required to delete account' });

    const [rows] = await db.execute('SELECT * FROM users WHERE id=?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Account not found' });
    const u = rows[0];

    // Verify password
    const passwordMatches = await bcrypt.compare(password, u.password);
    if (!passwordMatches) return res.status(400).json({ error: 'Incorrect password — account not deleted' });

    // Send farewell email before deleting
    await sendEmail({
      to: u.email,
      subject: '👋 Your Blackjack Casino account has been deleted',
      html: `<div style="background:#0d0500;padding:40px;font-family:Georgia,serif;color:#f0f0f0;max-width:500px;margin:0 auto;border-radius:12px;text-align:center;">
        <div style="font-size:40px;margin-bottom:10px;">👋</div>
        <h1 style="color:#ffd764;letter-spacing:3px;">Account Deleted</h1>
        <p style="color:rgba(255,255,255,.5);margin:16px 0;">Hi ${u.username}, your account and all associated data have been permanently deleted.</p>
        <p style="color:rgba(255,255,255,.3);font-size:12px;">Final balance was $${u.balance.toLocaleString()} chips.</p>
        <p style="color:rgba(255,255,255,.3);font-size:11px;margin-top:20px;">If you ever change your mind, you're welcome to create a new account.</p>
      </div>`,
    });

    // Delete — cascades remove achievements, tournament_entries, user_cosmetics
    await db.execute('DELETE FROM users WHERE id=?', [u.id]);

    console.log(`🗑️  Account deleted: ${u.username} (id=${u.id})`);
    res.json({ success: true, message: 'Account permanently deleted' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── BUY COINS (Stripe Checkout) ───────────────────────
const CHIP_PACKAGES = {
  starter: { chips: 500,  price: 99,   label: '500 Chips',    popular: false },
  popular: { chips: 1000, price: 199,  label: '1,000 Chips',  popular: true  },
  big:     { chips: 2500, price: 499,  label: '2,500 Chips',  popular: false },
  mega:    { chips: 5000, price: 999,  label: '5,000 Chips',  popular: false },
};

app.post('/api/buy-coins', auth, async (req, res) => {
  const { package: pkg } = req.body;
  const pack = CHIP_PACKAGES[pkg];
  if (!pack) return res.status(400).json({ error: 'Invalid package' });

  // If Stripe isn't configured fall back to free (dev mode)
  if (!stripe) {
    await db.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [pack.chips, req.user.id]);
    const [rows] = await db.execute('SELECT balance FROM users WHERE id=?', [req.user.id]);
    return res.json({ balance: rows[0].balance, added: pack.chips, devMode: true });
  }

  try {
    const appUrl = process.env.APP_URL || 'https://blackjack-casino-production.up.railway.app';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: pack.price,
          product_data: {
            name: `Blackjack Casino — ${pack.label}`,
            description: `${pack.chips.toLocaleString()} chips added instantly to your account`,
            images: [],
          },
        },
        quantity: 1,
      }],
      metadata: { userId: String(req.user.id), chips: String(pack.chips), package: pkg },
      success_url: `${appUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${appUrl}/blackjack.html`,
    });
    res.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: 'Payment session failed. Try again.' });
  }
});

// Verify a completed Stripe session (called by success page)
app.get('/api/verify-payment', auth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: 'Missing session_id' });
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== 'paid') return res.status(400).json({ error: 'Payment not completed' });
    if (parseInt(session.metadata?.userId) !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const chips = parseInt(session.metadata?.chips);
    const pkg   = session.metadata?.package || 'chips';

    // Check if this session was already credited (idempotency)
    const [existing] = await db.execute('SELECT id FROM stripe_purchases WHERE session_id=?', [session_id]);
    if (!existing.length) {
      // Credit chips + record purchase
      await db.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [chips, req.user.id]);
      await db.execute('INSERT INTO stripe_purchases (user_id, session_id, chips, pkg) VALUES (?,?,?,?)',
        [req.user.id, session_id, chips, pkg]);

      // Send invoice email — non-blocking, never delays the response
      db.execute('SELECT username, email, balance FROM users WHERE id=?', [req.user.id])
        .then(([uRows]) => {
          if (uRows.length) {
            const u = uRows[0];
            sendEmail({
              to: u.email,
              subject: `🎉 Payment Confirmed — ${chips.toLocaleString()} chips added!`,
              html: receiptEmailHTML({ username: u.username, chips, amount: session.amount_total, newBalance: u.balance, pkg }),
            }).catch(err => console.error('Invoice email failed:', err.message));
          }
        }).catch(() => {});
    }

    const [rows] = await db.execute('SELECT balance FROM users WHERE id=?', [req.user.id]);
    res.json({ balance: rows[0].balance, chips, package: pkg });
  } catch (err) { console.error('verify-payment error:', err.message); res.status(500).json({ error: 'Could not verify payment' }); }
});

// ── DAILY BONUS ───────────────────────────────────────
app.post('/api/daily-bonus', auth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE id=?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const u = rows[0];
    const today = new Date().toISOString().slice(0,10);
    const lastBonus = u.last_daily_bonus ? u.last_daily_bonus.toISOString().slice(0,10) : null;
    const lastSlotDate = u.last_bonus_slot_date ? u.last_bonus_slot_date.toISOString().slice(0,10) : null;

    // First claim of the day
    if (lastBonus !== today) {
      const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
      const newStreak = lastBonus === yesterday ? u.streak + 1 : 1;
      const bonus = getDailyBonus(newStreak, u.vip_tier);
      await db.execute('UPDATE users SET balance=balance+?, streak=?, last_daily_bonus=? WHERE id=?', [bonus, newStreak, today, u.id]);
      const [updated] = await db.execute('SELECT balance FROM users WHERE id=?', [u.id]);
      return res.json({ bonus, newBalance: updated[0].balance, streak: newStreak, isSecondClaim: false });
    }

    // Second claim — only if user has bonus_slot perk and hasn't used it today
    if (u.has_bonus_slot && lastSlotDate !== today) {
      const bonus = getDailyBonus(u.streak, u.vip_tier);
      await db.execute('UPDATE users SET balance=balance+?, last_bonus_slot_date=? WHERE id=?', [bonus, today, u.id]);
      const [updated] = await db.execute('SELECT balance FROM users WHERE id=?', [u.id]);
      return res.json({ bonus, newBalance: updated[0].balance, streak: u.streak, isSecondClaim: true });
    }

    return res.status(400).json({ error: 'Already claimed today' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── ADMIN MIDDLEWARE ──────────────────────────────────
async function adminAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const [rows] = await db.execute('SELECT is_admin FROM users WHERE id=?', [payload.id]);
    if (!rows.length || !rows[0].is_admin) return res.status(403).json({ error: 'Admin access required' });
    req.user = payload; next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

// ── ADMIN ROUTES ──────────────────────────────────────
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    const [[totals]] = await db.execute('SELECT COUNT(*) as total, SUM(balance) as totalBalance, SUM(total_wagered) as wagered FROM users');
    const [[verified]] = await db.execute("SELECT COUNT(*) as c FROM users WHERE verify_status='verified'");
    const [[pending]]  = await db.execute("SELECT COUNT(*) as c FROM users WHERE verify_status='pending'");
    const [[banned]]   = await db.execute("SELECT COUNT(*) as c FROM users WHERE is_banned=1");
    const [[today]]    = await db.execute("SELECT COUNT(*) as c FROM users WHERE DATE(created_at)=CURDATE()");
    res.json({ totalUsers: totals.total, totalBalance: totals.totalBalance, totalWagered: totals.wagered, verified: verified.c, pending: pending.c, banned: banned.c, signupsToday: today.c });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : '%';
    const [rows] = await db.execute(
      `SELECT id, username, email, balance, vip_tier, verify_status, is_banned, is_admin, created_at, total_hands, total_wagered
       FROM users WHERE (username LIKE ? OR email LIKE ?) ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [search, search, limit, offset]
    );
    const [[{total}]] = await db.execute("SELECT COUNT(*) as total FROM users WHERE username LIKE ? OR email LIKE ?", [search, search]);
    res.json({ users: rows, total, page, pages: Math.ceil(total / limit) });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/admin/verification/:userId', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT username, email, date_of_birth, verify_status, id_document, selfie_photo, verified_at FROM users WHERE id=?', [req.params.userId]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/admin/users/:userId/verify', adminAuth, async (req, res) => {
  try {
    const { action } = req.body; // 'approve' or 'reject'
    const status = action === 'approve' ? 'verified' : 'rejected';
    await db.execute("UPDATE users SET verify_status=?, verified_at=IF(?='verified',NOW(),NULL) WHERE id=?", [status, status, req.params.userId]);
    if (action === 'approve') {
      const [rows] = await db.execute('SELECT email, username FROM users WHERE id=?', [req.params.userId]);
      if (rows.length) await sendEmail({ to: rows[0].email, subject: '✅ Identity Verified — Welcome to Blackjack Casino!', html: `<div style="background:#0d0500;padding:40px;font-family:Georgia,serif;color:#f0f0f0;text-align:center;border-radius:12px;"><div style="font-size:48px;margin-bottom:16px;">✅</div><h1 style="color:#4cff91;">Verified, ${rows[0].username}!</h1><p style="color:rgba(255,255,255,.5);margin:16px 0;">Your identity has been verified. You can now play!</p><a href="${process.env.APP_URL}/blackjack.html" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#c9a227,#ffd764);color:#1a0a00;border-radius:6px;font-weight:700;text-decoration:none;">Play Now →</a></div>` });
    }
    res.json({ success: true, status });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/admin/users/:userId/ban', adminAuth, async (req, res) => {
  try {
    const { ban } = req.body;
    await db.execute('UPDATE users SET is_banned=? WHERE id=?', [ban ? 1 : 0, req.params.userId]);
    res.json({ success: true, banned: !!ban });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/admin/users/:userId/admin', adminAuth, async (req, res) => {
  try {
    await db.execute('UPDATE users SET is_admin=? WHERE id=?', [req.body.isAdmin ? 1 : 0, req.params.userId]);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── VIP PERKS ─────────────────────────────────────────
app.get('/api/vip-perks', auth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT vip_tier, last_weekly_bonus FROM users WHERE id=?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const tier = rows[0].vip_tier || 'Bronze';
    const perks = VIP_PERKS[tier] || VIP_PERKS.Bronze;
    const lastWeekly = rows[0].last_weekly_bonus;
    const canClaimWeekly = perks.weeklyBonus > 0 && (!lastWeekly || Date.now() - new Date(lastWeekly) > 7 * 86400000);
    res.json({ tier, perks, canClaimWeekly, allTiers: VIP_PERKS });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/weekly-bonus', auth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT vip_tier, last_weekly_bonus FROM users WHERE id=?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const tier = rows[0].vip_tier || 'Bronze';
    const perks = VIP_PERKS[tier];
    if (!perks.weeklyBonus) return res.status(400).json({ error: 'Weekly bonus not available for your tier' });
    const lastWeekly = rows[0].last_weekly_bonus;
    if (lastWeekly && Date.now() - new Date(lastWeekly) < 7 * 86400000)
      return res.status(400).json({ error: 'Weekly bonus already claimed' });
    await db.execute('UPDATE users SET balance=balance+?, last_weekly_bonus=NOW() WHERE id=?', [perks.weeklyBonus, req.user.id]);
    const [updated] = await db.execute('SELECT balance FROM users WHERE id=?', [req.user.id]);
    res.json({ bonus: perks.weeklyBonus, newBalance: updated[0].balance, tier });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── GAME RESULT ───────────────────────────────────────
app.post('/api/game/result', auth, async (req, res) => {
  try {
    const { result, bet, payout } = req.body;
    if (!result || bet == null || payout == null) return res.status(400).json({ error: 'Missing fields' });

    const [rows] = await db.execute('SELECT * FROM users WHERE id=?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const u = rows[0];

    let { wins, losses, pushes, blackjacks, total_hands, total_wagered, total_won, biggest_win, balance, win_streak, max_win_streak } = u;
    total_hands += 1; total_wagered += bet;
    balance = Math.max(0, balance - bet + payout);

    const isWin = ['win','dealer_bust','blackjack','double_win','split_win'].includes(result);
    if (result === 'blackjack') {
      wins++; blackjacks++;
      const profit = payout - bet; total_won += profit; if (profit > biggest_win) biggest_win = profit;
      win_streak++;
    } else if (isWin) {
      wins++;
      const profit = payout - bet; total_won += profit; if (profit > biggest_win) biggest_win = profit;
      win_streak++;
    } else if (result === 'push') {
      pushes++; win_streak = 0;
    } else {
      losses++; win_streak = 0;
    }
    if (win_streak > max_win_streak) max_win_streak = win_streak;
    if (balance === 0) balance = 0; // let client handle buy-coins prompt

    const vip_tier = getVipTier(total_won);

    await db.execute(`
      UPDATE users SET balance=?,wins=?,losses=?,pushes=?,blackjacks=?,
        total_hands=?,total_wagered=?,total_won=?,biggest_win=?,
        win_streak=?,max_win_streak=?,vip_tier=?
      WHERE id=?
    `, [balance,wins,losses,pushes,blackjacks,total_hands,total_wagered,total_won,biggest_win,win_streak,max_win_streak,vip_tier,u.id]);

    const updatedUser = {...u,wins,losses,pushes,blackjacks,total_hands,total_wagered,total_won,biggest_win,win_streak,max_win_streak,balance};
    const newAchievements = await checkAndUnlockAchievements(u.id, updatedUser, result, bet, balance);

    res.json({ balance, vipTier: vip_tier, tierProgress: getTierProgress(total_won), stats: extractStats(updatedUser), newAchievements });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── PROFILE PAGE ──────────────────────────────────────
app.get('/api/profile/:username', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE username=?', [req.params.username]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const [achRows] = await db.execute('SELECT achievement_key, unlocked_at FROM achievements WHERE user_id=?', [rows[0].id]);
    res.json(publicUser(rows[0], achRows));
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── LEADERBOARD ───────────────────────────────────────
app.get('/api/leaderboard', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT username, display_name, avatar, balance, wins, losses, blackjacks, total_hands, total_won, vip_tier, equipped_badge, equipped_name_color
      FROM users ORDER BY balance DESC LIMIT 10
    `);
    res.json(rows.map((u,i) => ({
      rank: i+1, username: u.username, displayName: u.display_name || u.username,
      avatar: u.avatar, balance: u.balance, wins: u.wins, losses: u.losses,
      blackjacks: u.blackjacks, totalHands: u.total_hands, points: u.total_won,
      vipTier: u.vip_tier,
      winRate: u.total_hands > 0 ? Math.round(u.wins/u.total_hands*100) : 0,
      equippedBadge: u.equipped_badge || null,
      equippedNameColor: u.equipped_name_color || null,
    })));
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── MULTIPLAYER (unchanged) ───────────────────────────
const tables = new Map(), socketToTable = new Map(), socketToUser = new Map();
const SUITS=['♠','♥','♦','♣'], RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function buildShoe(n=6){ const s=[]; for(let d=0;d<n;d++) for(const su of SUITS) for(const r of RANKS) s.push({rank:r,suit:su}); for(let i=s.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[s[i],s[j]]=[s[j],s[i]];} return s; }
function cardValue(r){ if(['J','Q','K'].includes(r)) return 10; if(r==='A') return 11; return parseInt(r); }
function handTotal(cards){ let t=0,a=0; for(const c of cards){t+=cardValue(c.rank);if(c.rank==='A')a++;} while(t>21&&a>0){t-=10;a--;} return t; }
function drawCard(shoe){ if(shoe.length<52){const f=buildShoe();shoe.push(...f);} return shoe.pop(); }
function createTable(name){ return {id:Date.now().toString(36),name,seats:[null,null,null,null,null],phase:'waiting',shoe:buildShoe(),dealerCards:[],currentSeat:-1,betTimer:null,turnTimer:null,chat:[]}; }

function tablePublicState(t){ return {id:t.id,name:t.name,phase:t.phase,currentSeat:t.currentSeat,dealerCards:t.phase==='playing'?[t.dealerCards[0],{rank:'?',suit:'?'}]:t.dealerCards,seats:t.seats.map(s=>s?{username:s.username,displayName:s.displayName||s.username,avatar:s.avatar,vipTier:s.vipTier||'Bronze',bet:s.bet,hasBet:s.hasBet,done:s.done,hands:s.hands,balance:s.balance}:null),chat:t.chat.slice(-50),shoeSize:t.shoe.length}; }
function getTableList(){ return Array.from(tables.values()).map(t=>({id:t.id,name:t.name,phase:t.phase,playerCount:t.seats.filter(Boolean).length})); }
function broadcastTableList(){ io.emit('table_list',getTableList()); }
function broadcastTable(t){ io.to(t.id).emit('table_update',tablePublicState(t)); }

function startBetTimer(table){
  clearTimers(table); let secs=20;
  io.to(table.id).emit('game_message',{text:`Betting opens — ${secs}s`,type:'info'});
  table.betTimer=setInterval(()=>{ secs--; io.to(table.id).emit('timer',secs); if(secs<=0){clearTimers(table);dealRound(table);} },1000);
}
function clearTimers(t){ if(t.betTimer){clearInterval(t.betTimer);t.betTimer=null;} if(t.turnTimer){clearInterval(t.turnTimer);t.turnTimer=null;} }

function dealRound(table){
  const active=table.seats.filter(s=>s&&s.hasBet);
  if(!active.length){table.phase='waiting';broadcastTable(table);return;}
  table.phase='dealing'; table.dealerCards=[];
  for(const seat of table.seats){ if(!seat||!seat.hasBet) continue; seat.hands=[{cards:[drawCard(table.shoe),drawCard(table.shoe)],bet:seat.bet,doubled:false,done:false}]; seat.activeHand=0; seat.done=false; }
  table.dealerCards=[drawCard(table.shoe),drawCard(table.shoe)]; table.phase='playing'; broadcastTable(table);
  const dTotal=handTotal(table.dealerCards);
  if(dTotal===21){io.to(table.id).emit('game_message',{text:'Dealer has Blackjack!',type:'warn'}); setTimeout(()=>endRound(table),1000); return;}
  nextPlayerTurn(table,table.seats.findIndex(s=>s&&s.hasBet));
}

function nextPlayerTurn(table,fromSeat=0){
  clearTimers(table); let nextSeat=-1;
  for(let i=fromSeat;i<5;i++){if(table.seats[i]&&table.seats[i].hasBet&&!table.seats[i].done){nextSeat=i;break;}}
  if(nextSeat===-1){endRoundDealer(table);return;}
  table.currentSeat=nextSeat;
  io.to(table.id).emit('your_turn',{seatIndex:nextSeat});
  io.to(table.id).emit('game_message',{text:`${table.seats[nextSeat].username}'s turn`,type:'info'});
  broadcastTable(table);
  let secs=25;
  table.turnTimer=setInterval(()=>{ secs--; io.to(table.id).emit('turn_timer',{secs,seatIndex:nextSeat}); if(secs<=0){clearTimers(table);if(table.seats[nextSeat]) table.seats[nextSeat].done=true; nextPlayerTurn(table,nextSeat+1);} },1000);
}

async function endRoundDealer(table){
  table.currentSeat=-1; io.to(table.id).emit('game_message',{text:"Dealer's turn",type:'info'});
  while(handTotal(table.dealerCards)<17){await new Promise(r=>setTimeout(r,800)); table.dealerCards.push(drawCard(table.shoe)); broadcastTable(table);}
  setTimeout(()=>endRound(table),800);
}

async function endRound(table){
  const dTotal=handTotal(table.dealerCards), dBJ=dTotal===21&&table.dealerCards.length===2;
  const results=[];
  for(let i=0;i<5;i++){
    const seat=table.seats[i]; if(!seat||!seat.hasBet) continue;
    let totalPayout=0; const handResults=[];
    for(const hand of seat.hands){
      const pTotal=handTotal(hand.cards),pBJ=pTotal===21&&hand.cards.length===2&&seat.hands.length===1;
      let result,payout;
      if(pTotal>21){result='bust';payout=0;}
      else if(pBJ&&dBJ){result='push';payout=hand.bet;}
      else if(pBJ){result='blackjack';payout=Math.floor(hand.bet*2.5);}
      else if(dTotal>21){result='dealer_bust';payout=hand.bet*2;}
      else if(pTotal>dTotal){result='win';payout=hand.bet*2;}
      else if(pTotal===dTotal){result='push';payout=hand.bet;}
      else{result='lose';payout=0;}
      totalPayout+=payout; handResults.push({result,payout,total:pTotal});
    }
    seat.balance=Math.max(0,seat.balance+totalPayout);
    results.push({seatIndex:i,username:seat.username,handResults,newBalance:seat.balance});
    if(seat.userId&&db){try{await db.execute('UPDATE users SET balance=?,total_hands=total_hands+1 WHERE id=?',[seat.balance,seat.userId]);}catch(e){}}
  }
  table.phase='results'; broadcastTable(table);
  io.to(table.id).emit('round_results',{results,dealerTotal:dTotal,dealerCards:table.dealerCards});
  setTimeout(()=>{
    for(const seat of table.seats){if(!seat) continue; seat.bet=0;seat.hasBet=false;seat.hands=[];seat.done=false;}
    table.dealerCards=[]; table.phase=table.seats.some(Boolean)?'betting':'waiting'; broadcastTable(table);
    if(table.phase==='betting') startBetTimer(table); broadcastTableList();
  },6000);
}

io.on('connection',socket=>{
  socket.emit('table_list',getTableList());
  socket.on('auth',({token})=>{ const u=verifyToken(token); if(u) socketToUser.set(socket.id,u); });
  socket.on('get_tables',()=>socket.emit('table_list',getTableList()));
  socket.on('create_table',({name,token})=>{ const u=verifyToken(token); if(!u) return socket.emit('error_msg','Not authenticated'); if(socketToTable.has(socket.id)) return; const t=createTable(name||`${u.username}'s Table`); tables.set(t.id,t); broadcastTableList(); socket.emit('table_created',{tableId:t.id}); });
  socket.on('join_table',async({tableId,token})=>{
    const u=verifyToken(token); if(!u) return socket.emit('error_msg','Not authenticated');
    if(socketToTable.has(socket.id)) return socket.emit('error_msg','Already at a table');
    const table=tables.get(tableId); if(!table) return socket.emit('error_msg','Table not found');
    const freeSeat=table.seats.findIndex(s=>s===null); if(freeSeat===-1) return socket.emit('error_msg','Table is full');
    let balance=500,vipTier='Bronze',displayName=u.username,avatar=null;
    if(db){try{const [rows]=await db.execute('SELECT balance,vip_tier,display_name,avatar FROM users WHERE id=?',[u.id]); if(rows.length){balance=rows[0].balance;vipTier=rows[0].vip_tier;displayName=rows[0].display_name||u.username;avatar=rows[0].avatar;}}catch{}}
    table.seats[freeSeat]={socketId:socket.id,userId:u.id,username:u.username,displayName,avatar,vipTier,balance,bet:0,hasBet:false,hands:[],activeHand:0,done:false};
    socketToTable.set(socket.id,tableId); socketToUser.set(socket.id,u);
    socket.join(tableId); socket.emit('joined_table',{tableId,seatIndex:freeSeat,balance});
    io.to(tableId).emit('game_message',{text:`${displayName} joined`,type:'join'}); broadcastTable(table); broadcastTableList();
    if(table.phase==='waiting'&&table.seats.some(Boolean)){table.phase='betting';startBetTimer(table);}
  });
  socket.on('place_bet',({amount})=>{ const tableId=socketToTable.get(socket.id); if(!tableId) return; const table=tables.get(tableId); if(!table||table.phase!=='betting') return; const seat=table.seats.find(s=>s?.socketId===socket.id); if(!seat) return; if(amount<1||amount>seat.balance) return socket.emit('error_msg','Invalid bet'); seat.bet=amount; seat.hasBet=true; io.to(tableId).emit('game_message',{text:`${seat.displayName||seat.username} bet $${amount}`,type:'bet'}); broadcastTable(table); });
  socket.on('mp_hit',()=>{ const tableId=socketToTable.get(socket.id); if(!tableId) return; const table=tables.get(tableId); if(!table||table.phase!=='playing') return; const si=table.seats.findIndex(s=>s?.socketId===socket.id); if(si!==table.currentSeat) return; const seat=table.seats[si]; const hand=seat.hands[seat.activeHand]; hand.cards.push(drawCard(table.shoe)); const total=handTotal(hand.cards); broadcastTable(table); if(total>=21){hand.done=true;if(seat.activeHand+1<seat.hands.length){seat.activeHand++;}else{seat.done=true;clearTimers(table);nextPlayerTurn(table,si+1);}} });
  socket.on('mp_stand',()=>{ const tableId=socketToTable.get(socket.id); if(!tableId) return; const table=tables.get(tableId); if(!table||table.phase!=='playing') return; const si=table.seats.findIndex(s=>s?.socketId===socket.id); if(si!==table.currentSeat) return; const seat=table.seats[si]; seat.hands[seat.activeHand].done=true; clearTimers(table); if(seat.activeHand+1<seat.hands.length){seat.activeHand++;nextPlayerTurn(table,si);}else{seat.done=true;nextPlayerTurn(table,si+1);} });
  socket.on('mp_double',()=>{ const tableId=socketToTable.get(socket.id); if(!tableId) return; const table=tables.get(tableId); if(!table||table.phase!=='playing') return; const si=table.seats.findIndex(s=>s?.socketId===socket.id); if(si!==table.currentSeat) return; const seat=table.seats[si]; if(seat.balance<seat.bet) return socket.emit('error_msg','Insufficient balance'); const hand=seat.hands[seat.activeHand]; if(hand.cards.length!==2) return; seat.balance-=hand.bet; hand.bet*=2; hand.doubled=true; hand.cards.push(drawCard(table.shoe)); hand.done=true; seat.done=true; broadcastTable(table); clearTimers(table); nextPlayerTurn(table,si+1); });
  socket.on('send_chat',({message})=>{ const tableId=socketToTable.get(socket.id); if(!tableId) return; const table=tables.get(tableId); if(!table||!message?.trim()) return; const u=socketToUser.get(socket.id); const msg={username:u?.username||'Guest',message:message.trim().slice(0,120),time:Date.now()}; table.chat.push(msg); io.to(tableId).emit('new_chat',msg); });
  socket.on('leave_table',()=>leaveTable(socket));
  socket.on('disconnect',()=>leaveTable(socket));
  function leaveTable(socket){ const tableId=socketToTable.get(socket.id); if(!tableId) return; const table=tables.get(tableId); if(table){const si=table.seats.findIndex(s=>s?.socketId===socket.id); if(si!==-1){const name=table.seats[si].displayName||table.seats[si].username; table.seats[si]=null; io.to(tableId).emit('game_message',{text:`${name} left`,type:'leave'}); if(!table.seats.some(Boolean)){clearTimers(table);tables.delete(tableId);}else{broadcastTable(table);}}} socket.leave(tableId); socketToTable.delete(socket.id); socketToUser.delete(socket.id); broadcastTableList(); }
});

// ── TOURNAMENT SYSTEM ─────────────────────────────────
app.get('/api/tournaments', auth, async (req, res) => {
  try {
    await db.execute("UPDATE tournaments SET status='active' WHERE status='upcoming' AND starts_at<=NOW()");
    await db.execute("UPDATE tournaments SET status='ended'  WHERE status='active'   AND ends_at<=NOW()");
    const [active] = await db.execute(`
      SELECT t.*,
        (SELECT COUNT(*)        FROM tournament_entries WHERE tournament_id=t.id) as entrant_count,
        (SELECT te.current_chips FROM tournament_entries te WHERE te.tournament_id=t.id AND te.user_id=?) as my_chips,
        (SELECT te.hands_played  FROM tournament_entries te WHERE te.tournament_id=t.id AND te.user_id=?) as my_hands
      FROM tournaments t WHERE t.status IN ('upcoming','active') ORDER BY t.starts_at ASC
    `, [req.user.id, req.user.id]);
    const [recent] = await db.execute(`
      SELECT t.*,
        (SELECT COUNT(*) FROM tournament_entries WHERE tournament_id=t.id) as entrant_count,
        (SELECT te.current_chips FROM tournament_entries te WHERE te.tournament_id=t.id AND te.user_id=?) as my_chips
      FROM tournaments t WHERE t.status='ended' ORDER BY t.ends_at DESC LIMIT 5
    `, [req.user.id]);
    res.json({ active, recent });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/tournaments/:id', auth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM tournaments WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Tournament not found' });
    const [entry] = await db.execute('SELECT * FROM tournament_entries WHERE tournament_id=? AND user_id=?', [req.params.id, req.user.id]);
    const [lb] = await db.execute(`
      SELECT te.user_id, te.current_chips, te.hands_played, u.username, u.display_name, u.avatar, u.vip_tier
      FROM tournament_entries te JOIN users u ON u.id=te.user_id
      WHERE te.tournament_id=? ORDER BY te.current_chips DESC, te.hands_played ASC LIMIT 50
    `, [req.params.id]);
    res.json({ tournament: rows[0], myEntry: entry[0]||null, leaderboard: lb.map((r,i) => ({...r, rank: i+1})) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/tournaments/:id/join', auth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM tournaments WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Tournament not found' });
    const t = rows[0];
    if (t.status === 'ended') return res.status(400).json({ error: 'Tournament has ended' });
    const [existing] = await db.execute('SELECT id FROM tournament_entries WHERE tournament_id=? AND user_id=?', [t.id, req.user.id]);
    if (existing.length) return res.status(400).json({ error: 'Already joined this tournament' });
    const [[{count}]] = await db.execute('SELECT COUNT(*) as count FROM tournament_entries WHERE tournament_id=?', [t.id]);
    if (count >= t.max_players) return res.status(400).json({ error: 'Tournament is full' });
    const [userRows] = await db.execute('SELECT balance FROM users WHERE id=?', [req.user.id]);
    if (userRows[0].balance < t.buy_in) return res.status(400).json({ error: `Insufficient balance — buy-in is $${t.buy_in}` });
    await db.execute('UPDATE users SET balance=balance-? WHERE id=?', [t.buy_in, req.user.id]);
    await db.execute('UPDATE tournaments SET prize_pool=prize_pool+? WHERE id=?', [t.buy_in, t.id]);
    await db.execute('INSERT INTO tournament_entries (tournament_id, user_id, starting_chips, current_chips) VALUES (?,?,1000,1000)', [t.id, req.user.id]);
    const [upd] = await db.execute('SELECT balance FROM users WHERE id=?', [req.user.id]);
    res.json({ success: true, startingChips: 1000, newBalance: upd[0].balance });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/tournaments/:id/game-result', auth, async (req, res) => {
  try {
    const { bet, payout } = req.body;
    const [entryRows] = await db.execute('SELECT * FROM tournament_entries WHERE tournament_id=? AND user_id=?', [req.params.id, req.user.id]);
    if (!entryRows.length) return res.status(404).json({ error: 'Not entered in this tournament' });
    const [tRows] = await db.execute('SELECT status FROM tournaments WHERE id=?', [req.params.id]);
    if (!tRows.length || tRows[0].status !== 'active') return res.status(400).json({ error: 'Tournament is not active' });
    const entry = entryRows[0];
    const newChips = Math.max(0, entry.current_chips - bet + payout);
    await db.execute('UPDATE tournament_entries SET current_chips=?, hands_played=hands_played+1 WHERE tournament_id=? AND user_id=?', [newChips, req.params.id, req.user.id]);
    const [[{rank}]] = await db.execute('SELECT COUNT(*)+1 as rank FROM tournament_entries WHERE tournament_id=? AND current_chips>?', [req.params.id, newChips]);
    res.json({ currentChips: newChips, rank });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/tournaments', adminAuth, async (req, res) => {
  try {
    const { name, type, buyIn, startsAt, endsAt, maxPlayers } = req.body;
    if (!name || !startsAt || !endsAt) return res.status(400).json({ error: 'name, startsAt, endsAt required' });
    const [r] = await db.execute('INSERT INTO tournaments (name,type,buy_in,starts_at,ends_at,max_players) VALUES (?,?,?,?,?,?)',
      [name, type||'daily', buyIn||500, startsAt, endsAt, maxPlayers||100]);
    res.json({ success: true, id: r.insertId });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ── REFERRAL SYSTEM ───────────────────────────────────
function generateReferralCode(username) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = (username.slice(0,3) + 'XXX').slice(0,3).toUpperCase();
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

app.get('/api/my-referral', auth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT referral_code, username FROM users WHERE id=?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    let code = rows[0].referral_code;
    if (!code) {
      code = generateReferralCode(rows[0].username);
      await db.execute('UPDATE users SET referral_code=? WHERE id=?', [code, req.user.id]);
    }
    const [[{total}]] = await db.execute('SELECT COUNT(*) as total FROM users WHERE referred_by=?', [req.user.id]);
    const appUrl = process.env.APP_URL || 'https://blackjack-casino-production.up.railway.app';
    res.json({ code, referralUrl: `${appUrl}/index.html?ref=${code}`, totalReferred: total, bonusPerReferral: 100 });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/use-referral', auth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });
    const [myRows] = await db.execute('SELECT referred_by FROM users WHERE id=?', [req.user.id]);
    if (!myRows.length) return res.status(404).json({ error: 'Not found' });
    if (myRows[0].referred_by) return res.status(400).json({ error: 'You have already used a referral code' });
    const [refRows] = await db.execute('SELECT id, username FROM users WHERE referral_code=?', [code.toUpperCase()]);
    if (!refRows.length) return res.status(400).json({ error: 'Invalid referral code' });
    if (refRows[0].id === req.user.id) return res.status(400).json({ error: 'Cannot use your own referral code' });
    const BONUS = 100;
    await db.execute('UPDATE users SET balance=balance+?, referred_by=? WHERE id=?', [BONUS, refRows[0].id, req.user.id]);
    await db.execute('UPDATE users SET balance=balance+? WHERE id=?', [BONUS, refRows[0].id]);
    const [upd] = await db.execute('SELECT balance FROM users WHERE id=?', [req.user.id]);
    res.json({ success: true, bonus: BONUS, newBalance: upd[0].balance, referrer: refRows[0].username });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ── SUBSCRIPTION / VIP PASS ($4.99/month) ────────────
app.post('/api/subscribe', auth, async (req, res) => {
  if (!stripe) {
    await db.execute('UPDATE users SET balance=balance+500 WHERE id=?', [req.user.id]);
    const [upd] = await db.execute('SELECT balance FROM users WHERE id=?', [req.user.id]);
    return res.json({ devMode: true, message: 'Dev mode: +500 chips (VIP pass simulated)', newBalance: upd[0].balance });
  }
  try {
    const [rows] = await db.execute('SELECT email FROM users WHERE id=?', [req.user.id]);
    const appUrl = process.env.APP_URL || 'https://blackjack-casino-production.up.railway.app';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: 499,
          recurring: { interval: 'month' },
          product_data: {
            name: 'Blackjack Casino Royale — VIP Pass',
            description: '+500 chips on activation + renewal, exclusive table access, priority support',
          },
        },
        quantity: 1,
      }],
      metadata: { userId: String(req.user.id), type: 'vip_subscription' },
      customer_email: rows[0]?.email,
      success_url: `${appUrl}/blackjack.html?subscribed=1`,
      cancel_url:  `${appUrl}/blackjack.html`,
    });
    res.json({ checkoutUrl: session.url });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not create subscription' }); }
});

// ── COSMETICS SHOP ────────────────────────────────────
app.get('/api/cosmetics/shop', auth, async (req, res) => {
  try {
    const [items] = await db.execute('SELECT * FROM cosmetics ORDER BY type, price');
    const [owned] = await db.execute('SELECT cosmetic_id, is_equipped FROM user_cosmetics WHERE user_id=?', [req.user.id]);
    const [userRows] = await db.execute('SELECT has_bonus_slot, has_insurance_boost FROM users WHERE id=?', [req.user.id]);
    const u = userRows[0] || {};
    const ownedMap = {};
    owned.forEach(o => { ownedMap[o.cosmetic_id] = { owned: true, equipped: !!o.is_equipped }; });
    res.json(items.map(item => {
      let isOwned = !!ownedMap[item.id];
      let isEquipped = ownedMap[item.id]?.equipped || false;
      // Perks: check user columns instead of user_cosmetics
      if (item.type === 'perk') {
        if (item.key_name === 'bonus_slot')      isOwned = !!u.has_bonus_slot;
        if (item.key_name === 'insurance_boost') isOwned = !!u.has_insurance_boost;
        isEquipped = isOwned; // perks are "equipped" (active) once purchased
      }
      return { ...item, owned: isOwned, equipped: isEquipped };
    }));
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/cosmetics/buy', auth, async (req, res) => {
  try {
    const { cosmeticId } = req.body;
    const [items] = await db.execute('SELECT * FROM cosmetics WHERE id=?', [cosmeticId]);
    if (!items.length) return res.status(404).json({ error: 'Item not found' });
    const item = items[0];

    // Handle perks differently — they update user columns instead of user_cosmetics
    if (item.type === 'perk') {
      const col = item.key_name === 'bonus_slot' ? 'has_bonus_slot'
                : item.key_name === 'insurance_boost' ? 'has_insurance_boost'
                : null;
      if (!col) return res.status(400).json({ error: 'Unknown perk' });
      const [userRows] = await db.execute(`SELECT ${col}, balance FROM users WHERE id=?`, [req.user.id]);
      if (!userRows.length) return res.status(404).json({ error: 'Not found' });
      if (userRows[0][col]) return res.status(400).json({ error: 'You already own this perk' });
      if (userRows[0].balance < item.price) return res.status(400).json({ error: 'Insufficient balance' });
      await db.execute(`UPDATE users SET ${col}=1, balance=balance-? WHERE id=?`, [item.price, req.user.id]);
      const [updated] = await db.execute('SELECT balance FROM users WHERE id=?', [req.user.id]);
      return res.json({ success: true, newBalance: updated[0].balance, item });
    }

    const [owned] = await db.execute('SELECT id FROM user_cosmetics WHERE user_id=? AND cosmetic_id=?', [req.user.id, cosmeticId]);
    if (owned.length) return res.status(400).json({ error: 'Already owned' });
    const [userRows] = await db.execute('SELECT balance FROM users WHERE id=?', [req.user.id]);
    if (userRows[0].balance < item.price) return res.status(400).json({ error: 'Insufficient balance' });
    await db.execute('UPDATE users SET balance=balance-? WHERE id=?', [item.price, req.user.id]);
    await db.execute('INSERT INTO user_cosmetics (user_id, cosmetic_id) VALUES (?,?)', [req.user.id, cosmeticId]);
    const [upd] = await db.execute('SELECT balance FROM users WHERE id=?', [req.user.id]);
    res.json({ success: true, newBalance: upd[0].balance, item });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/cosmetics/equip', auth, async (req, res) => {
  try {
    const { cosmeticId } = req.body;
    const [items] = await db.execute('SELECT * FROM cosmetics WHERE id=?', [cosmeticId]);
    if (!items.length) return res.status(404).json({ error: 'Item not found' });
    const item = items[0];
    // Perks cannot be equipped/unequipped — they are always active
    if (item.type === 'perk') return res.status(400).json({ error: 'Perks are activated automatically on purchase' });
    const [owned] = await db.execute('SELECT id FROM user_cosmetics WHERE user_id=? AND cosmetic_id=?', [req.user.id, cosmeticId]);
    if (!owned.length) return res.status(400).json({ error: 'Item not owned' });
    // Unequip all items of this type first
    await db.execute(`
      UPDATE user_cosmetics uc JOIN cosmetics c ON c.id=uc.cosmetic_id
      SET uc.is_equipped=0 WHERE uc.user_id=? AND c.type=?
    `, [req.user.id, item.type]);
    await db.execute('UPDATE user_cosmetics SET is_equipped=1 WHERE user_id=? AND cosmetic_id=?', [req.user.id, cosmeticId]);
    // Also persist badge, name_color, and border to user table for quick access
    if (item.type === 'badge') {
      await db.execute('UPDATE users SET equipped_badge=? WHERE id=?', [item.key_name, req.user.id]);
    } else if (item.type === 'name_color') {
      await db.execute('UPDATE users SET equipped_name_color=? WHERE id=?', [item.key_name, req.user.id]);
    } else if (item.type === 'border') {
      await db.execute('UPDATE users SET equipped_border=? WHERE id=?', [item.key_name, req.user.id]);
    }
    res.json({ success: true, equipped: item });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/cosmetics/equipped', auth, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT c.type, c.key_name, c.name FROM user_cosmetics uc
      JOIN cosmetics c ON c.id=uc.cosmetic_id WHERE uc.user_id=? AND uc.is_equipped=1
    `, [req.user.id]);
    const equipped = { card_back: 'classic_red', felt: 'green', chip: 'classic', theme: 'default', win_anim: 'confetti', badge: null, border: null, sticker: 'classic_pack', name_color: null, card_anim: 'classic', chip_sound: 'classic', dealer: 'classic_butler' };
    rows.forEach(r => { equipped[r.type] = r.key_name; });
    res.json(equipped);
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// ── RESPONSIBLE GAMBLING ──────────────────────────────
app.get('/api/responsible/settings', auth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT deposit_limit, self_excluded_until FROM users WHERE id=?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const u = rows[0];
    const isExcluded = u.self_excluded_until && new Date(u.self_excluded_until) > new Date();
    res.json({ depositLimit: u.deposit_limit, selfExcludedUntil: u.self_excluded_until, isExcluded });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/responsible/deposit-limit', auth, async (req, res) => {
  try {
    const { limit } = req.body;
    if (limit !== null && limit !== undefined && (isNaN(limit) || Number(limit) < 0))
      return res.status(400).json({ error: 'Invalid limit amount' });
    await db.execute('UPDATE users SET deposit_limit=? WHERE id=?', [limit || null, req.user.id]);
    res.json({ success: true, depositLimit: limit || null });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/responsible/self-exclude', auth, async (req, res) => {
  try {
    const { days } = req.body;
    const allowed = [1,7,30,90,180,365];
    if (!days || !allowed.includes(parseInt(days)))
      return res.status(400).json({ error: 'Choose 1, 7, 30, 90, 180, or 365 days' });
    const until = new Date(Date.now() + parseInt(days) * 86400000);
    await db.execute('UPDATE users SET self_excluded_until=? WHERE id=?', [until, req.user.id]);
    const [rows] = await db.execute('SELECT email, username FROM users WHERE id=?', [req.user.id]);
    if (rows.length) {
      await sendEmail({
        to: rows[0].email,
        subject: '🔒 Self-Exclusion Activated',
        html: `<div style="background:#0d0500;padding:40px;font-family:Georgia,serif;color:#f0f0f0;max-width:500px;margin:0 auto;border-radius:12px;text-align:center;">
          <div style="font-size:40px;margin-bottom:10px;">🔒</div>
          <h1 style="color:#ffd764;">Self-Exclusion Active</h1>
          <p style="color:rgba(255,255,255,.5);">Hi ${rows[0].username}, your account has been excluded for <strong style="color:#fff">${days} day(s)</strong>.</p>
          <p style="color:rgba(255,255,255,.5);">Active until <strong style="color:#ffd764">${until.toLocaleDateString()}</strong>.</p>
          <p style="color:rgba(255,255,255,.3);font-size:12px;margin-top:20px;">Need support? National Problem Gambling Helpline: 1-800-522-4700</p>
        </div>`,
      });
    }
    res.json({ success: true, selfExcludedUntil: until, days: parseInt(days) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ── EMAIL CAMPAIGNS (Admin) ───────────────────────────
app.post('/api/admin/send-campaign', adminAuth, async (req, res) => {
  try {
    const { subject, html, segment } = req.body; // segment: 'all' | 'inactive' | 'vip'
    if (!subject || !html) return res.status(400).json({ error: 'subject and html required' });
    let query = 'SELECT email, username FROM users WHERE is_banned=0';
    if (segment === 'inactive') query += ' AND (last_daily_bonus IS NULL OR last_daily_bonus < DATE_SUB(NOW(), INTERVAL 7 DAY))';
    if (segment === 'vip')      query += " AND vip_tier IN ('Gold','Platinum','Diamond')";
    const [users] = await db.execute(query);
    let sent = 0;
    for (const u of users) {
      await sendEmail({ to: u.email, subject, html: html.replace(/\{\{username\}\}/g, u.username) });
      sent++;
      if (sent % 10 === 0) await new Promise(r => setTimeout(r, 500)); // rate-limit
    }
    res.json({ success: true, sent });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/send-reminders', adminAuth, async (req, res) => {
  try {
    const [users] = await db.execute(`
      SELECT email, username, streak FROM users
      WHERE is_banned=0 AND streak>0
        AND last_daily_bonus >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND last_daily_bonus < CURDATE()
    `);
    let sent = 0;
    for (const u of users) {
      await sendEmail({
        to: u.email,
        subject: `⏰ Don't lose your ${u.streak}-day streak!`,
        html: `<div style="background:#0d0500;padding:40px;font-family:Georgia,serif;color:#f0f0f0;max-width:500px;margin:0 auto;border-radius:12px;text-align:center;">
          <div style="font-size:40px;margin-bottom:10px;">🔥</div>
          <h1 style="color:#ffd764;">Your streak is at risk!</h1>
          <p style="color:rgba(255,255,255,.5);">Hey ${u.username}, you have a <strong style="color:#ff9900">${u.streak}-day streak!</strong></p>
          <p style="color:rgba(255,255,255,.5);">Claim your daily bonus today to keep it alive.</p>
          <a href="${process.env.APP_URL}/blackjack.html" style="display:inline-block;margin-top:20px;padding:12px 32px;background:linear-gradient(135deg,#c9a227,#ffd764);color:#1a0a00;border-radius:6px;font-weight:700;text-decoration:none;">Claim Bonus →</a>
        </div>`,
      });
      sent++;
      await new Promise(r => setTimeout(r, 100));
    }
    res.json({ success: true, sent });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ── STRIPE IDENTITY ───────────────────────────────────
app.post('/api/identity/start', auth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
  try {
    const session = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: { userId: String(req.user.id) },
      options: {
        document: {
          allowed_types: ['driving_license', 'passport', 'id_card'],
          require_matching_selfie: true,
        },
      },
    });
    await db.execute("UPDATE users SET verify_status='pending' WHERE id=?", [req.user.id]);
    res.json({ clientSecret: session.client_secret, sessionId: session.id });
  } catch (e) {
    console.error('Stripe Identity error:', e.message);
    res.status(500).json({ error: 'Could not start verification: ' + e.message });
  }
});

app.get('/api/identity/check/:sessionId', auth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
  try {
    const session = await stripe.identity.verificationSessions.retrieve(req.params.sessionId);
    if (session.status === 'verified') {
      await db.execute("UPDATE users SET verify_status='verified', verified_at=NOW() WHERE id=?", [req.user.id]);
    }
    res.json({ status: session.status });
  } catch (e) { res.status(500).json({ error: 'Could not check verification status' }); }
});

server.listen(PORT, () => console.log(`🃏 Blackjack server running on http://localhost:${PORT}`));
