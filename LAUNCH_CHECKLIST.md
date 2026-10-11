# Blackjack Casino Royale — launch QA checklist

This is an **entertainment-only, virtual-chip** Blackjack website. Chips, tournament prizes, and rewards have no monetary value. There are no purchases, cashouts, redeemable rewards, or paid tournament entries.

## Automated checks

GitHub Actions runs `cd backend && npm ci && npm test` on pull requests. The suite checks the server Blackjack engine, session validation, animation sequencing, no payment endpoints, mobile-control contract, and page launch/accessibility/SEO contracts. **Static tests do not substitute for visual browser testing.**

## Hands-on browser acceptance tests (complete before widespread promotion)

Use at least Chrome desktop, Safari iPhone or iOS simulator, and Chrome Android at widths **320, 375, 390, 768 and 1280 px**. Record pass/fail and screen captures where possible.

1. **Sign in / register / reset:** try a new account and a returning one. Confirm the 21+ self-reported DOB gate, form labels, keyboard tabs, reset code email and no login loops. Never disclose reset codes or passwords in logs or screenshots.
2. **Solo game:** bet 1/5/10/25/100 virtual chips. Watch player/dealer cards arrive one-by-one. Test Hit, Stand, Double, Split and Insurance when eligible. Observe dealer hole-card reveal, Blackjack payout and natural 21. Check chip balance matches backend, not visual guesswork.
3. **Interruptions:** reload mid-round; the hand should restore without re-dealing cards. Test back/forward navigation, a delayed or sleeping Render server, offline mode, and retry behavior. No double crediting from retrying.
4. **Mobile:** ensure no control is hidden or off-screen. Double and Split must remain visible at widths below 400 px. Navigation wraps properly, finger targets are comfortably sized, and no table or panel is clipped.
5. **Accessibility:** use keyboard-only navigation: chip buttons, deal actions, login/register tabs, 14 shop categories, tournament tabs and modal close. Test reduced-motion and mute/volume settings across reloads. Confirm dialogs and toasts remain usable on mobile.
6. **Friends:** create public/private multiplayer tables, copy an invitation, open it from another device, send a chat message, place temporary practice-chip bets, leave and reconnect. Private games must never change an account balance.
7. **Cosmetics and profiles:** filter each shop category, earn virtual chips, buy/equip a cosmetic with chips and view the updated balance. Edit your profile, upload a legitimate image, see achievement progress and visit a friend's public profile. Test balance too low, 503 server error and offline mode.
8. **Rankings and tournaments:** view all-time and verified-monthly leaderboards; tab among active/recent virtual-chip tournaments and open a leaderboard. Verify no dollar amounts or real-money prizes appear.
9. **History / policy:** check virtual-chip totals in play history and cosmetic ledger; review Privacy, Terms, self-exclusion and referral links. Test mobile data tables scrolling with keyboard and touch.
10. **Security and privacy:** ensure public source does not contain passwords/API keys. Revoke old Railway DB and Stripe test/webhook credentials shown in old Git history, even though current code no longer uses Stripe. Check the credential alerts after revocation. Verify Vercel headers and that authenticated pages opt out of search indexing. Deleting a file does not erase old commits.
11. **Hosting:** confirm the backend health endpoint `https://blackjack-casino-nob6.onrender.com/api/health` reports OK, and both Vercel and Render show their intended production commit. Check error logs; free Render instances may take time to wake after inactivity.
12. **Public release:** obtain appropriate local/legal and any advertising-platform policy review for simulated casino content. Avoid cash prizes, real-world rewards and purchases. Advertising/sponsorship income is not guaranteed.

## Notes

- This frontend polish does **not** change backend routes, account records, balances, RNG, payout math or player passwords.
- Search snippets and a sitemap make public pages easier to discover; they do not guarantee search rankings or ad network acceptance.
- For a launch, use a custom domain, support contact, real device testing and privacy/legal review when practical.

## Release follow-up checklist (phases 1–4)

- **Multiplayer reconnection:** join with two real sessions, start a round and simulate a 10-second Wi-Fi outage. Reconnect within 30 seconds and confirm the original practice balance, bet and cards; disconnect for longer than 30 seconds and confirm the seat is released. A Render restart still loses all practice tables by design.
- **Self-exclusion:** test with a disposable test account only. After excluding, an existing token must be rejected by protected HTTP routes and further socket room creation/join. **Do not test on anyone's primary account**, since early reversal is intentionally unavailable.
- **Reward concurrency:** using a **test** account eligible for a weekly bonus, send two requests at once and verify only one virtual-chip credit occurs. Never alter a real player's stored balance to manufacture a test.
- **Security regression:** confirm backend source/log URLs such as `/backend/server.js`, `/backend/server.log`, `/backend/.env` on **Render** return 404. Check Vercel separately, since GitHub itself is public. Revoke old database/Stripe credentials from historical git exposure.
- **Social sharing:** verify native share sheet on iOS/Android and clipboard fallback on desktop with user gesture; never auto-share or solicit contact lists.
- **Monetization:** follow `MONETIZATION_READINESS.md` for advertiser/publisher distinctions, no-prize legal review, operator contact, ad approval and domain authorization. Do not deploy ad tags before approved accounts.
