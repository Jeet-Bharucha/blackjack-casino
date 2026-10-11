'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'../..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const engine=require('../solo-engine');

test('randomized server Blackjack rounds obey basic payout and state invariants',()=>{
  for(let j=0;j<140;j++){
    const bet=[1,5,10,25,100,500,100000][j%7];
    const game=engine.create(bet);
    const first=engine.view(game,1000000);
    assert.equal(first.baseBet,bet);
    assert.ok(first.hands.length>=1);
    if(first.phase!=='finished'){
      assert.equal(first.dealerCards[1].rank,'?','Dealer hole card must remain private');
    }
    let steps=0;
    while(game.phase!=='finished'&&steps++<30){
      if(game.phase==='insurance')engine.play(game,'insurance_no',1000000);
      else if(game.phase==='playing'){
        const hand=game.hands[game.active];
        engine.play(game,engine.total(hand.cards)>=16?'stand':'hit',1000000);
      }else assert.fail('Unexpected phase '+game.phase);
    }
    assert.equal(game.phase,'finished','Game did not settle');
    assert.ok(steps<30,'Unexpectedly long round');
    const view=engine.view(game,1000000);
    assert.equal(view.phase,'finished');
    assert.ok(view.dealerCards.every(c=>c.rank!=='?'));
    const result=game.outcome;
    assert.ok(result.payout>=0);
    assert.ok(Number.isSafeInteger(result.payout));
    assert.equal(result.stake,bet);
    assert.equal(result.net,result.payout-result.stake);
    assert.equal(result.payout,result.hands.reduce((n,h)=>n+h.payout,0));
  }
});

test('authenticated API is private; backend source and secrets are not served as static files',()=>{
  const server=read('backend/server.js');
  for(const value of [
    "app.disable('x-powered-by')",
    "res.set('Cache-Control','no-store')",
    "res.set('X-Content-Type-Options','nosniff')",
    "node_modules",
    "\\.env",
    "app.use(express.static",
    "allowRequest:(req, callback)",
    "maxHttpBufferSize:100_000"
  ])assert.ok(server.includes(value),'Missing server protection: '+value);
  assert.doesNotMatch(server,/cors:\s*\{\s*origin:\s*['"]\*['"]/);
  assert.match(server,/allowedOrigins\.includes\(req\.headers\.origin\)/);
});

test('active self-exclusion and account status are checked on HTTP and socket paths',()=>{
  const server=read('backend/server.js');
  assert.match(server,/SELECT is_banned,token_version,self_excluded_until FROM users WHERE id=\?/);
  assert.match(server,/Self-exclusion is active\. You cannot play until/);
  assert.match(server,/socket\.on\('create_table',async/);
  assert.match(server,/Session expired or account unavailable/);
  assert.match(server,/Self-exclusion is active/);
});

test('weekly rewards cannot be claimed twice under concurrency',()=>{
  const server=read('backend/server.js');
  const weekly=server.slice(server.indexOf("app.post('/api/weekly-bonus'"),server.indexOf('// ── SERVER-AUTHORITATIVE SOLO BLACKJACK'));
  assert.match(weekly,/UPDATE users SET balance=balance\+\?, last_weekly_bonus=UTC_TIMESTAMP\(\)/);
  assert.match(weekly,/last_weekly_bonus IS NULL OR last_weekly_bonus<=DATE_SUB/);
  assert.match(weekly,/claimed\.affectedRows !== 1/);
  assert.doesNotMatch(weekly,/await db\.execute\('UPDATE users SET balance=balance\+\?, last_weekly_bonus=NOW\(\) WHERE id=\?'/);
});

test('multiplayer reconnect reserves a seat, validates identity and resumes state',()=>{
  const server=read('backend/server.js');
  const client=read('multiplayer.html');
  assert.match(server,/returning!==-1\?returning/);
  assert.match(server,/seat\.reconnectTimer=setTimeout\(/);
  assert.match(server,/seat\.socketId=null/);
  assert.match(server,/seat\.socketId=socket\.id/);
  assert.match(server,/table\.seats\[freeSeat\]\.balance/);
  assert.match(server,/connected:!!s\.socketId/);
  assert.match(server,/times\.length>=5/);
  assert.match(server,/table\.chat\.length>50/);
  assert.match(client,/myTurn = socket\.connected && state\.phase === 'playing'/);
  assert.match(client,/myBet = \['betting','playing','dealing'\]/);
  assert.match(client,/seat\.connected === false/);
  assert.doesNotMatch(client,/h\.payout-r\.handResults\[0\]\.payout/);
  for(const [,script] of client.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
    if(script.trim())new vm.Script(script);
  }
});

test('retention and public sharing are opt-in, game-state read-only',()=>{
  const client=read('challenges-client.js');
  const html=read('blackjack.html');
  const js=read('share-royale.js');
  new vm.Script(client);new vm.Script(js);
  assert.match(client,/refreshMissionSummary/);
  assert.match(client,/bj:round-complete/);
  assert.match(html,/id="missionSummary"/);
  assert.match(html,/100% FREE PLAY/);
  for(const file of ['index.html','landing.html']){
    const page=read(file);
    assert.match(page,/shareRoyaleGame\(this\)/);
    assert.match(page,/Adults 21\+ only/);
    assert.match(page,/src="share-royale\.js"/);
  }
  assert.match(js,/navigator\.share/);
  assert.match(js,/navigator\.clipboard/);
  assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|analytics|tracker/);
});
