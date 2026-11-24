import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, deriveGame, submitThrow, nextTurn, undo, correctThrow, normalizeThrow, CRICKET_TARGETS } from '../web/js/engine.js';

const make=(extra={})=>createGame({players:['A','B'],mode:'x01',startScore:301,checkout:'double',...extra});
const hit=(g,n,m=1)=>submitThrow(g,{number:n,multiplier:n===0?0:m});
const turn=(g,darts)=>{for(const [n,m=1] of darts){if(deriveGame(g).turnFinished)break;hit(g,n,m);}nextTurn(g);};

test('validates segments, bull and misses; rejects impossible throws',()=>{
  for(const dart of [{number:20,multiplier:3},{number:25,multiplier:2},{number:0,multiplier:0}])assert.deepEqual(normalizeThrow(dart),dart);
  for(const dart of [{number:25,multiplier:3},{number:0,multiplier:1},{number:21,multiplier:1},{number:2.5,multiplier:1}])assert.throws(()=>normalizeThrow(dart));
});
test('supports one to six players and rejects invalid setup',()=>{
  assert.equal(deriveGame(make({players:['Solo']})).players.length,1);
  assert.equal(deriveGame(make({players:['1','2','3','4','5','6']})).players.length,6);
  assert.throws(()=>make({players:[]}));assert.throws(()=>make({players:[' ']}));assert.throws(()=>make({players:Array(7).fill('P')}));
});
test('X01 scoring, three-dart turn lock and player rotation',()=>{
  const g=make();hit(g,20,3);hit(g,20,3);hit(g,20,3);
  assert.equal(deriveGame(g).players[0].remaining,121);
  assert.throws(()=>hit(g,1));assert.equal(nextTurn(g),true);
  assert.equal(deriveGame(g).current,1);assert.equal(deriveGame(g).throws.length,0);
});
test('six players cycle to the next round',()=>{
  const g=make({players:['1','2','3','4','5','6']});
  for(let i=0;i<6;i++){assert.equal(deriveGame(g).current,i);turn(g,[[0],[0],[0]]);}
  assert.equal(deriveGame(g).round,2);assert.equal(deriveGame(g).current,0);
});
test('double-out bust restores the entire turn including previous darts',()=>{
  const g=make({players:['A']});turn(g,[[20,3],[20,3],[20,3]]);turn(g,[[20,3],[20,3],[0]]);
  assert.equal(deriveGame(g).players[0].remaining,121); // last turn leaves 1 and busts
  assert.equal(deriveGame(g).history.at(-1).bust,true);
});
test('overshoot bust, non-double zero bust, valid double checkout',()=>{
  const g=make({players:['A']});turn(g,[[20,3],[20,3],[20,3]]);turn(g,[[20,3],[19,3],[0]]);
  assert.equal(deriveGame(g).players[0].remaining,4);
  hit(g,5);assert.equal(deriveGame(g).bust,true);assert.equal(deriveGame(g).players[0].remaining,4);nextTurn(g);
  hit(g,4);assert.equal(deriveGame(g).bust,true);nextTurn(g);
  hit(g,2,2);assert.equal(deriveGame(g).winner,0);
});
test('straight-out may finish on a single',()=>{
  const g=make({players:['A'],checkout:'straight'});turn(g,[[20,3],[20,3],[20,3]]);turn(g,[[20,3],[20,3],[0]]);
  hit(g,1);assert.equal(deriveGame(g).winner,0);
});
test('inner bull is a valid double-out',()=>{
  const g=make({players:['A']});turn(g,[[20,3],[20,3],[20,3]]);turn(g,[[20],[1],[25,2]]);
  assert.equal(deriveGame(g).players[0].remaining,50);hit(g,25,2);assert.equal(deriveGame(g).winner,0);
});
test('Cricket awards only excess hits while an opponent is open',()=>{
  const g=make({mode:'cricket'});turn(g,[[20,3],[20,2],[14,3]]);
  let s=deriveGame(g);assert.equal(s.players[0].marks[20],3);assert.equal(s.players[0].score,40);
  turn(g,[[20,3],[20,3],[0]]);hit(g,20,3);
  s=deriveGame(g);assert.equal(s.players[1].score,0);assert.equal(s.players[0].score,40);
});
test('Cricket bull uses 25 points per excess mark and inner bull gives two marks',()=>{
  const g=make({mode:'cricket'});hit(g,25,2);hit(g,25,2);
  const s=deriveGame(g);assert.equal(s.players[0].marks[25],3);assert.equal(s.players[0].score,25);
});
test('Cricket requires closing all targets and matching opponents points',()=>{
  const g=make({mode:'cricket'});turn(g,[[20,3],[20,3],[0]]); // A 60 points
  turn(g,[[20,3],[19,3],[18,3]]);turn(g,[[0],[0],[0]]);
  turn(g,[[17,3],[16,3],[15,3]]);turn(g,[[0],[0],[0]]);
  hit(g,25,2);hit(g,25,1);
  assert.equal(deriveGame(g).winner,null);
  hit(g,19,3); // A still has 19 open, B scores 57
  nextTurn(g);turn(g,[[0],[0],[0]]);hit(g,19,1);
  assert.equal(deriveGame(g).winner,1);
});
test('solo Cricket wins on closing every target',()=>{
  const g=make({mode:'cricket',players:['Solo']});
  for(const n of CRICKET_TARGETS){if(n===25){hit(g,n,2);if(deriveGame(g).turnFinished)nextTurn(g);hit(g,n,1);}else hit(g,n,3);if(deriveGame(g).turnFinished&&deriveGame(g).winner===null)nextTurn(g);}
  assert.equal(deriveGame(g).winner,0);assert.equal(deriveGame(g).players[0].score,0);
});
test('Around the Clock advances once for any multiplier, ignores bull, finishes on 20',()=>{
  const g=make({mode:'clock',players:['Solo']});hit(g,25,2);assert.equal(deriveGame(g).players[0].target,1);
  for(let n=1;n<=20;n++){if(deriveGame(g).turnFinished)nextTurn(g);hit(g,n,3);}
  assert.equal(deriveGame(g).winner,0);
});
test('undo across a turn boundary restores the previous player and last dart',()=>{
  const g=make();turn(g,[[20,3],[5],[1]]);assert.equal(deriveGame(g).current,1);
  undo(g);const s=deriveGame(g);assert.equal(s.current,0);assert.equal(s.throws.length,2);assert.equal(s.players[0].remaining,236);
});
test('correction replays later throws when still valid',()=>{
  const g=make();hit(g,20,3);hit(g,5);hit(g,1);
  const id=deriveGame(g).throws[0].id;const result=correctThrow(g,id,{number:20,multiplier:1});
  assert.equal(result.truncated,false);assert.equal(deriveGame(g).players[0].remaining,275);assert.equal(deriveGame(g).throws.length,3);
});
test('correction to an earlier bust discards now-invalid later darts',()=>{
  const g=make({players:['A']});turn(g,[[20,3],[20,3],[20,3]]);turn(g,[[20,3],[19,3],[0]]);
  hit(g,1);hit(g,0);
  const id=deriveGame(g).throws[0].id;const result=correctThrow(g,id,{number:20,multiplier:3});
  assert.equal(result.truncated,true);assert.equal(deriveGame(g).throws.length,1);assert.equal(deriveGame(g).bust,true);assert.equal(deriveGame(g).players[0].remaining,4);
});
test('paused game rejects input and state changes',()=>{
  const g=make();hit(g,20);g.paused=true;
  assert.throws(()=>hit(g,1));assert.equal(undo(g),false);assert.equal(nextTurn(g),false);
});
test('duplicate input IDs cannot count a throw twice',()=>{
  const g=make();const d={number:20,multiplier:3,id:'camera-frame-1',source:'camera'};
  assert.equal(submitThrow(g,d),true);assert.equal(submitThrow(g,d),false);assert.equal(deriveGame(g).players[0].remaining,241);
});
