'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {version,sessionMatches}=require('../session-utils');

test('normalize MySQL/TiDB numeric token_version values',()=>{
  assert.equal(version(1),1);
  assert.equal(version('1'),1);
  assert.equal(version(0),0);
  assert.equal(version('0'),0);
  assert.equal(version(undefined),0);
  assert.equal(version('01'),null);
  assert.equal(version(-1),null);
  assert.equal(version('one'),null);
});
test('accept new session after password reset when database returns a string',()=>{
  const account={is_banned:0,token_version:'1'};
  assert.equal(sessionMatches(account,{v:1}),true);
  assert.equal(sessionMatches(account,{v:0}),false);
});
test('do not accept banned, missing, or malformed account sessions',()=>{
  assert.equal(sessionMatches({is_banned:1,token_version:0},{v:0}),false);
  assert.equal(sessionMatches({is_banned:'1',token_version:'2'},{v:2}),false);
  assert.equal(sessionMatches(null,{v:0}),false);
  assert.equal(sessionMatches({is_banned:0,token_version:1},{v:'invalid'}),false);
});
