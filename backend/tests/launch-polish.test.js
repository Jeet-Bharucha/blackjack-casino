'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'../..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');

const privatePages = [
  'login.html','blackjack.html','multiplayer.html','shop.html','profile.html',
  'leaderboard.html','tournament.html','history.html','transactions.html',
  'responsible.html','verify-age.html'
];
const interiorPages = [
  'shop.html','profile.html','leaderboard.html','tournament.html',
  'history.html','transactions.html','responsible.html','privacy.html','terms.html'
];

test('luxury interior pages, account login, and age gate share branded styling',()=>{
  const css=read('luxury-pages.css');
  for (const filename of interiorPages) {
    const html=read(filename);
    assert.match(html,/href="luxury-pages\.css"/,filename);
    assert.match(html,/class="luxury-page/,filename);
  }
  for (const filename of ['login.html','verify-age.html']){
    assert.match(read(filename),/class="luxury-auth/,filename);
    assert.match(read(filename),/href="luxury-pages\.css"/,filename);
  }
  for (const selector of [
    '.luxury-page .nav','.luxury-page .item-card',
    '.luxury-page .tourn-card','.luxury-page .profile-hero',
    '.luxury-page .lb-table','.luxury-auth .auth-card',
    '@media(max-width:800px)','@media(max-width:500px)',
    '@media(prefers-reduced-motion:reduce)'
  ])assert.ok(css.includes(selector),'Missing CSS: '+selector);
});

test('shop categories and auth tabs are real keyboard-operable controls',()=>{
  const shop=read('shop.html');
  assert.equal((shop.match(/<button type="button" class="cat-item/g)||[]).length,14);
  assert.match(shop,/aria-pressed/);
  assert.match(shop,/escapeShopText\(item\.description\)/);
  const login=read('login.html');
  assert.match(login,/role="tablist"/);
  assert.match(login,/type="button" role="tab"/);
  for (const id of ['loginEmail','loginPassword','regUsername','regEmail','regDob','regPassword'])
    assert.ok(login.includes('for="'+id+'"'),'Missing form label '+id);
  assert.match(login,/aria-label="Show password"/);
  assert.match(login,/function togglePw/);
});

test('tournament tabs, dialogs and server data rendering are polished safely',()=>{
  const html=read('tournament.html');
  assert.match(html,/role="tablist"/);
  assert.match(html,/role="tabpanel"/);
  assert.match(html,/aria-modal="true"/);
  assert.match(html,/escapeTournamentText\(t\.name\)/);
  assert.doesNotMatch(html,/onclick="viewLeaderboard\(\$\{t\.id\},'\$\{t\.name\}'\)"/);
  assert.match(html,/virtual chips|virtual-chip/);
  assert.doesNotMatch(html,/Join — Buy In \$/);
  assert.equal((html.match(/<main\b/g)||[]).length,(html.match(/<\/main>/g)||[]).length);
  assert.equal((html.match(/setInterval\(/g)||[]).length,1,'Only one tournament countdown should run');
});

test('user balances on main interior screens say virtual chips, not dollars',()=>{
  const targets={
    'shop.html':['id="navBalance">— chips','myBalance.toLocaleString()} chips'],
    'profile.html':['Virtual Chip Balance','toLocaleString()} <small'],
    'leaderboard.html':['id="myBalance">— chips','balance-cell'],
    'tournament.html':['id="navBalance">— chips','prize_pool).toLocaleString()} chips'],
    'history.html':['class="payout-pos','toLocaleString()} chips'],
    'transactions.html':['COSMETICS LEDGER','toLocaleString()} chips']
  };
  for (const [file,needles] of Object.entries(targets)){
    const html=read(file);
    for (const needle of needles)assert.ok(html.includes(needle),file+': '+needle);
  }
});

test('public homepage has SEO metadata, private views opt out of indexing',()=>{
  for(const page of ['index.html','landing.html']){
    const html=read(page);
    assert.match(html,/name="description"/);
    assert.match(html,/rel="canonical"/);
    assert.match(html,/property="og:title"/);
    assert.match(html,/virtual chips/);
  }
  for(const page of privatePages)assert.match(read(page),/name="robots" content="noindex,nofollow"/,page);
  const xml=read('sitemap.xml');
  assert.match(xml,/<urlset/);
  for(const page of ['privacy.html','terms.html'])
    assert.ok(xml.includes(page),'Sitemap missing '+page);
  assert.ok(read('robots.txt').includes('Sitemap:'));
});

test('marketing and account views keep their scripts syntactically sound',()=>{
  for(const file of [
    ...privatePages,'index.html','landing.html','privacy.html','terms.html'
  ]){
    const html=read(file);
    assert.match(html,/<html lang="en">/,file);
    for(const [,js] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
      if(js.trim())new vm.Script(js,{filename:file});
    }
    for(const [,src] of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)){
      if (/^(https?:|data:|#)/.test(src) || /^(?:\.{1,2}\/)?(?:login|blackjack|profile|history)\.html/.test(src))continue;
      if(/\.(?:js|css|svg|jpeg|jpg|png)$/.test(src))
        assert.ok(fs.existsSync(path.join(root,src)),file+' refers to missing asset '+src);
    }
  }
});

test('response headers protect privacy without breaking legacy inline scripts',()=>{
  const config=JSON.parse(read('vercel.json'));
  const headers=config.headers.flatMap(x=>x.headers);
  for(const key of ['X-Frame-Options','X-Content-Type-Options','Referrer-Policy','Permissions-Policy'])
    assert.ok(headers.some(x=>x.key===key),key+' missing');
  const freeplay=read('backend/server.js');
  assert.doesNotMatch(freeplay,/require\('stripe'\)|\/api\/buy-coins|\/api\/subscribe/);
});

test('homepage final call to action stays visible above its opaque background overlay',()=>{
  const html=read('index.html');
  const sharedCSS=read('luxury-theme.css');
  // Without an explicit stacking order, the absolutely positioned ::before
  // pseudo-element paints over the non-positioned title and buttons.
  assert.match(html,/\.footer-cta::before\s*\{[^}]*z-index:\s*0/s);
  assert.match(html,/\.footer-cta\s*>\s*\*\s*\{[^}]*position:\s*relative;\s*z-index:\s*1/s);
  assert.match(sharedCSS,/\.luxury-front \.footer-cta::before\s*\{/);
  const section=html.slice(html.indexOf('<section class="footer-cta">'),html.indexOf('</section>',html.indexOf('<section class="footer-cta">')));
  assert.match(section,/Ready to Play\?/);
  assert.match(section,/500 Free Chips/);
  assert.match(section,/Create Free Account/);
  assert.match(section,/Sign In/);
});
