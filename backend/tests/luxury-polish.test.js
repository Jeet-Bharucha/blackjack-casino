'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('premium theme loads on marketing, solo, and multiplayer pages',()=>{
  const css=read('luxury-theme.css');
  for(const [page,cls] of [
    ['index.html','luxury-front'],['landing.html','luxury-front'],
    ['blackjack.html','luxury-solo'],['multiplayer.html','luxury-multi'],
  ]){
    const html=read(page);
    assert.match(html,/href="luxury-theme\.css"/);
    assert.ok(html.includes('class="' + cls + '"'), page+' missing theme class');
  }
  for(const cls of ['.luxury-front','.luxury-solo','.luxury-multi'])
    assert.ok(css.includes(cls),cls+' CSS missing');
});

test('solo table uses real, keyboard accessible chip buttons and retains all actions on narrow screens',()=>{
  const html=read('blackjack.html');
  const css=read('luxury-theme.css');
  for(const value of [1,5,10,25,100]){
    assert.match(html,new RegExp('<button type="button" class="chip chip-'+value+'"'));
    assert.match(html,new RegExp('onclick="placeBet\\('+value+'\\)"'));
  }
  for(const id of ['dealBtn','hitBtn','standBtn','doubleBtn','splitBtn']){
    assert.ok(html.includes('id="'+id+'"'),id+' missing');
  }
  assert.match(css,/\.luxury-solo \.action-row \.btn-double,\.luxury-solo \.action-row \.btn-split\{display:block\}/);
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/id="luxuryHelpPanel"/);
  assert.match(html,/id="luxuryVolume"/);
});

test('UI includes user-selected volume, reduced-motion and shortcut logic but never game results',()=>{
  const ui=read('luxury-ui.js'), solo=read('solo-client.js'), html=read('blackjack.html');
  new vm.Script(ui,{filename:'luxury-ui.js'});
  new vm.Script(solo,{filename:'solo-client.js'});
  assert.match(ui,/bj_reduce_motion/);
  assert.match(ui,/bj_volume/);
  assert.match(ui,/bjBusy/);
  assert.match(ui,/!button\.disabled/);
  assert.doesNotMatch(ui,/\/api\/|payout\s*=|Math\.random/);
  assert.match(html,/masterGain\.connect\(audioCtx\.destination\)/);
  assert.match(solo,/document\.body\.classList\.toggle\('game-pending', yes\)/);
  assert.match(solo,/await updateTable\(data, \{animate: true\}\)/);
});

test('all modified browser scripts remain syntactically valid',()=>{
  for(const page of ['blackjack.html','multiplayer.html','index.html','landing.html']){
    const html=read(page);
    const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
      .map(match=>match[1]).filter(script=>script.trim());
    for(const src of scripts)new vm.Script(src,{filename:page});
    assert.ok(scripts.length>0,page+' missing script');
  }
});

test('free-play labels never imply cash balance or Stripe checkout',()=>{
  const game=read('blackjack.html'), multiplayer=read('multiplayer.html');
  assert.match(game,/Free Play Only/);
  assert.match(game,/chips';/);
  assert.match(multiplayer,/chips';/);
  assert.doesNotMatch(game,/buyChipsModal|Stripe|checkoutUrl/);
  assert.doesNotMatch(multiplayer,/Stripe|checkoutUrl/);
});
