'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const {validateAvatar,MAX_AVATAR_BYTES}=require('../avatar-utils');

function dataURL(mime,bytes) {
  return 'data:image/'+mime+';base64,'+Buffer.from(bytes).toString('base64');
}
const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
const jpeg=Buffer.from([255,216,255,224,0,16,74,70,73,70]);
const gif=Buffer.from('GIF89a\\x01\\x00\\x01\\x00','binary');
const webp=Buffer.from('RIFFxxxxWEBP','ascii');

test('avatar allows removal and small known raster signatures',()=>{
  assert.equal(validateAvatar(null),null);
  assert.equal(validateAvatar(''),null);
  for(const [mime,bytes] of [['png',png],['jpeg',jpeg],['gif',gif],['webp',webp]]) {
    const input=dataURL(mime,bytes);
    assert.equal(validateAvatar(input),input);
  }
});
test('reject SVG, HTML, mismatched MIME, invalid base64 and oversized avatars',()=>{
  assert.throws(()=>validateAvatar(dataURL('svg+xml',Buffer.from('<svg></svg>'))),/JPEG|PNG|GIF|WebP/);
  assert.throws(()=>validateAvatar('data:text/html;base64,PGgxPg=='),/JPEG|PNG|GIF|WebP/);
  assert.throws(()=>validateAvatar(dataURL('png',jpeg)),/does not match/);
  assert.throws(()=>validateAvatar(dataURL('jpeg',png)),/does not match/);
  assert.throws(()=>validateAvatar('data:image/png;base64,%%%%'),/JPEG|PNG|GIF|WebP/);
  assert.throws(()=>validateAvatar('data:image/png;base64,AA==\\n'),/JPEG|PNG|GIF|WebP/);
  assert.throws(()=>validateAvatar(123),/small JPEG/);
  assert.throws(()=>validateAvatar(dataURL('png',Buffer.concat([png,Buffer.alloc(MAX_AVATAR_BYTES)]))),/150 KB/);
});
test('profile validates both display name types and avatar types',()=>{
  const source=read('backend/server.js');
  assert.match(source,/typeof displayName !== 'string'/);
  assert.match(source,/validateAvatar\(avatar\)/);
  assert.match(source,/catch \(error\) \{ return res\.status\(400\)/);
  assert.match(source,/await db\.execute\(\`UPDATE users SET/);
});
test('multiplayer state omits repeated base64 avatar and chat history payloads',()=>{
  const source=read('backend/server.js');
  const state=source.slice(source.indexOf('function tablePublicState('),source.indexOf('function getTableList()'));
  assert.ok(state.length>0);
  assert.doesNotMatch(state,/avatar:s\.avatar|chat:t\.chat/);
  assert.match(state,/bet:s\.bet/);
  assert.match(state,/hands:s\.hands/);
  assert.match(state,/balance:s\.balance/);
  assert.match(state,/connected:!!s\.socketId/);
  assert.match(state,/inviteCode:t\.inviteCode/);
  assert.match(state,/dealerCards:t\.phase==='playing'\?/);
  // Dealer hole card stays masked until the round is over.
  assert.match(state,/\{rank:'\?',suit:'\?'\}/);
  const client=read('multiplayer.html');
  assert.doesNotMatch(client,/state\.chat|seat\.avatar|seat\.vipTier/);
});
test('practice deck uses crypto randomness; auth throttles remain bounded',()=>{
  const source=read('backend/server.js');
  const shuffle=source.slice(source.indexOf('function buildShoe('),source.indexOf('function cardValue('));
  assert.match(shuffle,/crypto\.randomInt\(i\+1\)/);
  assert.doesNotMatch(shuffle,/Math\.random\(\)/);
  assert.match(source,/lastCounterPrune/);
  assert.match(source,/while \(requestCounters\.size > 10000\)/);
});
test('password reset codes have TTL, account cooldown, memory limits and concurrency guard',()=>{
  const s=read('backend/server.js');
  assert.match(s,/const MAX_RESET_CODES = 1000/);
  assert.match(s,/function pruneResetCodes\(/);
  assert.match(s,/sentAt: now/);
  assert.match(s,/now-\(existing\.sentAt\|\|0\)<60000/);
  assert.match(s,/resetCodes\.size>=MAX_RESET_CODES/);
  assert.match(s,/if\(entry\.processing\)/);
  assert.match(s,/entry\.processing=true/);
  assert.match(s,/entry\.processing=false/);
  assert.match(s,/if\(!\/\^\\d\{6\}\$\/\.test\(code\.trim\(\)\)/);
  assert.match(s,/signal: AbortSignal\.timeout\(10000\)/);
});
