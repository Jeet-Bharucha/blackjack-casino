'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'multiplayer.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'multiplayer-polish.css'), 'utf8');

test('multiplayer page loads responsive polish after shared theme and parses', () => {
  const theme=html.indexOf('href="luxury-theme.css"');
  const polish=html.indexOf('href="multiplayer-polish.css"');
  assert.ok(theme>0 && polish>theme,'Specific mobile rules must override shared luxury CSS');
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean);
  assert.ok(scripts.length>0);
  scripts.forEach(script => new vm.Script(script,{filename:'multiplayer.html'}));
});

test('mobile hands are not clipped: current player is full-width and other seats remain inspectable', () => {
  for(const snippet of [
    '@media(max-width:700px)',
    '.mp-seat.my-seat{',
    'order:-1;grid-column:1/-1;',
    '.mp-seat.my-seat .mini-card{',
    '.mp-seat:not(.my-seat) .seat-cards{',
    'overflow-x:auto',
    'height:auto',
    'overflow:visible'
  ])assert.ok(styles.includes(snippet),'Missing mobile rule '+snippet);
  assert.match(styles,/\.luxury-multi \.mp-dealer-zone \.mini-card/);
  assert.match(styles,/prefers-reduced-motion:reduce/);
  assert.doesNotMatch(styles,/\.mp-seat\.my-seat\s*\{[^}]*display:none/);
});

test('betting chips are always below the player cards on narrow phones', () => {
  // Previously, constrained viewport heights made the chip betting controls
  // cover the last row of cards. Explicit auto-height grid rows prevent that.
  assert.match(styles, /@media\(max-width:700px\)/);
  assert.match(styles, /\.luxury-multi \.table-area\{\s*display:grid/);
  assert.match(styles, /grid-template-rows:max-content max-content/);
  assert.match(styles, /\.luxury-multi \.mp-table\{\s*position:relative;grid-row:1/);
  assert.match(styles, /\.luxury-multi \.mp-controls\{\s*position:relative;grid-row:2/);
  assert.match(styles, /\.luxury-multi \.game-layout\{\s*display:block;flex:none/);
  assert.match(styles, /height:auto!important;max-height:none/);
  assert.match(styles, /\.luxury-multi \.layout\{\s*display:block/);
});

test('live state reconciliation preserves card elements across socket updates', () => {
  // Minimal DOM simulation so the card reconciler can be exercised without
  // opening a real game connection or changing persisted player accounts.
  class FakeNode {
    constructor(tag) {
      this.tag=tag; this.children=[]; this.parent=null; this.dataset={};
      this._className='';this._text='';this.attributes={};
      this.classes=new Set();
      this.classList={
        contains:name=>this.classes.has(name),
        add:name=>this.classes.add(name),
        remove:name=>this.classes.delete(name)
      };
      this.style={setProperty:(name,value)=>{this.attributes[name]=value;}};
    }
    set className(value){this._className=value;this.classes=new Set(value.split(/\s+/));}
    get className(){return this._className;}
    set textContent(value){this._text=value;}
    get textContent(){return this._text;}
    append(...nodes){nodes.forEach(node=>this.appendChild(node));}
    appendChild(node){node.parent=this;this.children.push(node);return node;}
    insertBefore(node,existing){
      const index=this.children.indexOf(existing);
      if(index===-1)return this.appendChild(node);
      node.parent=this;this.children.splice(index,0,node);return node;
    }
    remove(){if(!this.parent)return;const index=this.parent.children.indexOf(this);if(index>=0)this.parent.children.splice(index,1);this.parent=null;}
    replaceChildren(...children){this.children.forEach(c=>c.parent=null);this.children=[];this.append(...children);}
    querySelector(css){
      return this.children.find(c=>c.classList.contains(css.slice(1)))||null;
    }
    setAttribute(k,v){this.attributes[k]=v;}
  }
  const script=html.slice(html.indexOf('function paintMiniCard('),html.indexOf('\nfunction handTotal('));
  assert.match(script,/function syncMiniCards\(/);
  const context={document:{createElement:tag=>new FakeNode(tag)},RED_SUITS:new Set(['♥','♦'])};
  vm.createContext(context);
  vm.runInContext(script,context,{timeout:1000});
  const holder=new FakeNode('div');
  const score=new FakeNode('span');score.className='mp-score';holder.appendChild(score);
  const first={rank:'K',suit:'♠'},hidden={rank:'?',suit:'?'};
  context.syncMiniCards(holder,[first,hidden],true);
  assert.equal(holder.children.length,3);
  const originalCards=holder.children.slice(0,2);
  assert.strictEqual(holder.children.at(-1),score,'Dealer score must be preserved');
  assert.equal(originalCards[0].dataset.cardKey,'K|♠');
  context.syncMiniCards(holder,[first,hidden],true);
  assert.strictEqual(holder.children[0],originalCards[0],'Unchanged cards must not be replaced');
  assert.strictEqual(holder.children[1],originalCards[1],'Hidden card must not be replaced');
  context.syncMiniCards(holder,[first,{rank:'8',suit:'♥'}],true);
  assert.strictEqual(holder.children[1],originalCards[1],'Dealer reveal must update existing card');
  assert.equal(holder.children[1].dataset.cardKey,'8|♥');
  assert.ok(holder.children[1].classList.contains('mp-card-flip'),'Dealer reveal should animate once');
  context.syncMiniCards(holder,[],true);
  assert.deepEqual(holder.children,[score],'Clear old round without deleting the score');
});

test('all five seats render independently without erasing the row on each update', () => {
  assert.match(html,/state\.seats\.forEach\(\(seat, i\) =>/);
  assert.match(html,/row\.querySelector\('\[data-seat="/);
  assert.match(html,/syncMiniCards\(cardsEl, cards, !firstPaint\)/);
  assert.match(html,/syncMiniCards\(dHand, state\.dealerCards, !firstPaint\)/);
  const render=html.slice(html.indexOf('function renderTable(state)'),html.indexOf('function phaseLabel(phase)'));
  assert.doesNotMatch(render,/row\.innerHTML\s*=\s*['"]{2}/);
  assert.doesNotMatch(render,/dHand\.innerHTML\s*=\s*['"]{2}/);
  assert.match(html,/seat\.connected === false/);
});
