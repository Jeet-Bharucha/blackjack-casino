'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync,existsSync}=require('node:fs');
const {join}=require('node:path');

const backend=join(__dirname,'..');
const root=join(backend,'..');
const server=readFileSync(join(backend,'server.js'),'utf8');
const pkg=JSON.parse(readFileSync(join(backend,'package.json'),'utf8'));
const lock=JSON.parse(readFileSync(join(backend,'package-lock.json'),'utf8'));

test('Stripe runtime and paid-chip endpoints are absent',()=>{
  assert.ok(!('stripe' in pkg.dependencies));
  assert.ok(!('stripe' in lock.packages[''].dependencies));
  assert.ok(!('node_modules/stripe' in lock.packages));
  for(const forbidden of [
    "require('stripe')",
    '/api/stripe-webhook',
    '/api/buy-coins',
    '/api/verify-payment',
    '/api/subscribe',
    'stripe.checkout.sessions',
    'ENABLE_REAL_MONEY_PURCHASES',
    'receiptEmailHTML'
  ])assert.equal(server.includes(forbidden),false,`Payment integration remains: ${forbidden}`);
});

test('virtual-chip play, cosmetics and free bonus routes are intact',()=>{
  for(const route of [
    '/api/solo/start','/api/solo/action','/api/daily-bonus',
    '/api/cosmetics/buy','/api/challenges/claim'
  ])assert.ok(server.includes(route),`Required free-play route absent: ${route}`);
});

test('free-play user interface cannot begin a checkout',()=>{
  const game=readFileSync(join(root,'blackjack.html'),'utf8');
  const responsible=readFileSync(join(root,'responsible.html'),'utf8');
  assert.match(game,/Free Play Only/);
  assert.doesNotMatch(game,/buyChipsModal|checkoutUrl|buyChips\(/);
  assert.doesNotMatch(responsible,/checkoutUrl|\/subscribe|VIP membership/);
  assert.equal(existsSync(join(root,'success.html')),false);
});

test('policy pages describe virtual-only chips and no cash prizes',()=>{
  const terms=readFileSync(join(root,'terms.html'),'utf8');
  const privacy=readFileSync(join(root,'privacy.html'),'utf8');
  assert.match(terms,/No Cash Prizes/);
  assert.match(privacy,/does not sell virtual chips/);
  assert.doesNotMatch(terms,/Stripe/);
  assert.doesNotMatch(privacy,/Stripe/);
});
