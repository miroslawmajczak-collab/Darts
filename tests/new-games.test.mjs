import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,deriveGame,submitThrow,nextTurn,undo,correctThrow,HALVE_TARGETS} from '../web/js/engine.js';
import {validateSettings,DEFAULTS} from '../server.mjs';
const make=(mode,extra={})=>createGame({mode,players:['A','B'],...extra});
const hit=(g,n,m=1)=>submitThrow(g,{number:n,multiplier:n===0?0:m});
const play=(g,darts)=>{for(const[n,m=1]of darts){if(deriveGame(g).turnFinished)break;hit(g,n,m);}return deriveGame(g);};
const turn=(g,darts)=>{play(g,darts);nextTurn(g);return deriveGame(g);};

test('Killer validates multiplayer and distinct numbered targets',()=>{
 assert.throws(()=>make('killer',{players:['A']}));
 for(const numbers of [[1,1],[0,2],[1,25],[1],[1,2.5]])assert.throws(()=>make('killer',{killerNumbers:numbers}));
 assert.deepEqual(make('killer',{killerNumbers:[4,12]}).options.killerNumbers,[4,12]);
});
test('Killer: only own numbered double arms; that dart does not remove a life',()=>{
 const g=make('killer');hit(g,20);hit(g,20,3);hit(g,20,2);
 const s=deriveGame(g);assert.equal(s.players[0].armed,true);assert.equal(s.players[0].lives,3);
 nextTurn(g);hit(g,20,2);assert.equal(deriveGame(g).players[0].lives,3);
 hit(g,19,2);hit(g,20,2);assert.equal(deriveGame(g).players[0].lives,2);
});
test('Killer: armed players remove exactly one life per double and last survivor wins',()=>{
 const g=make('killer');turn(g,[[20,2],[19,2],[19,2]]);turn(g,[[0],[0],[0]]);
 hit(g,19,2);const s=deriveGame(g);assert.equal(s.players[1].lives,0);assert.equal(s.winner,0);assert.equal(s.turnFinished,true);
 assert.throws(()=>hit(g,19,2));assert.equal(nextTurn(g),false);
});
test('Killer: own double costs lives after arming, including self-elimination',()=>{
 const g=make('killer',{players:['A','B','C']});
 turn(g,[[20,2],[20,2],[20,2]]);turn(g,[[0],[0],[0]]);turn(g,[[0],[0],[0]]);
 hit(g,20,2);let s=deriveGame(g);assert.equal(s.players[0].lives,0);assert.equal(s.turnFinished,true);assert.equal(s.winner,null);
 nextTurn(g);turn(g,[[0],[0],[0]]);turn(g,[[0],[0],[0]]);
 s=deriveGame(g);assert.equal(s.current,1);assert.equal(s.round,3);
});
test('Killer: self-elimination can give the win to an unarmed survivor',()=>{
 const g=make('killer');turn(g,[[20,2],[20,2],[20,2]]);turn(g,[[0],[0],[0]]);hit(g,20,2);
 assert.equal(deriveGame(g).winner,1);assert.equal(deriveGame(g).players[1].armed,false);
});
test('Killer ignores singles, triples, bull and unassigned doubles after arming',()=>{
 const g=make('killer');turn(g,[[20,2],[19],[19,3]]);turn(g,[[0],[0],[0]]);play(g,[[25,2],[3,2],[0]]);
 assert.deepEqual(deriveGame(g).players.map(p=>p.lives),[3,3]);
});
test('Killer correction and undo restore lives and remove a premature winner',()=>{
 const g=make('killer');turn(g,[[20,2],[19,2],[19,2]]);turn(g,[[0],[0],[0]]);hit(g,19,2);
 correctThrow(g,deriveGame(g).throws[0].id,{number:0,multiplier:0});
 assert.equal(deriveGame(g).winner,null);assert.equal(deriveGame(g).players[1].lives,1);
 hit(g,19,2);undo(g);assert.equal(deriveGame(g).players[1].lives,1);
});
test('Shanghai: only the current number scores and a triple is worth three times target',()=>{
 const g=make('shanghai');play(g,[[20,3],[25,2],[1,3]]);assert.equal(deriveGame(g).players[0].score,3);assert.equal(deriveGame(g).winner,null);
});
test('Shanghai: S/D/T in any order instantly wins; correcting it restores play',()=>{
 const g=make('shanghai');play(g,[[1,3],[1],[1,2]]);let s=deriveGame(g);
 assert.equal(s.winner,0);assert.equal(s.winReason,'shanghai');assert.equal(s.players[0].score,6);
 correctThrow(g,s.throws[2].id,{number:0,multiplier:0});s=deriveGame(g);assert.equal(s.winner,null);assert.equal(s.players[0].score,4);assert.equal(nextTurn(g),true);
});
test('Shanghai: seven full rounds, all players receive equal turns, highest total wins',()=>{
 const g=make('shanghai');
 for(let round=1;round<=7;round++){
  turn(g,[[round],[round],[0]]);assert.equal(deriveGame(g).winner,null);
  play(g,[[round],[0],[0]]);
  if(round<7)nextTurn(g);
 }
 const s=deriveGame(g);assert.equal(s.round,7);assert.deepEqual(s.players.map(p=>p.score),[56,28]);assert.deepEqual(s.winners,[0]);assert.equal(s.winReason,'points');
});
test('Shanghai: six tied leaders share the win after round seven',()=>{
 const g=make('shanghai',{players:['1','2','3','4','5','6']});
 for(let i=0;i<42;i++)turn(g,[[0],[0],[0]]);
 assert.deepEqual(deriveGame(g).winners,[0,1,2,3,4,5]);assert.equal(deriveGame(g).round,7);
});
test('Halve-it: starts at 40, adds valid hits and applies a rounded-down penalty only on dart three',()=>{
 const g=make('halveit',{players:['A']});assert.equal(deriveGame(g).players[0].score,40);
 turn(g,[[15],[20,3],[0]]);assert.equal(deriveGame(g).players[0].score,55);
 hit(g,0);hit(g,0);assert.equal(deriveGame(g).players[0].score,55);hit(g,0);
 const s=deriveGame(g);assert.equal(s.players[0].score,27);assert.equal(s.turnTotal,-28);assert.equal(s.halved,true);
});
test('Halve-it: exact nine-round schedule, numbered doubles, triples and both bulls',()=>{
 const g=make('halveit',{players:['A']});
 const turns=[[[15],[0],[0]],[[0],[0],[0]],[[25,2],[0],[0]],[[17,3],[0],[0]],[[18,2],[0],[0]],[[20,3],[25,2],[0]],[[19],[0],[0]],[[0],[0],[0]],[[25],[25,2],[0]]];
 const scores=[55,27,13,64,100,160,179,89,164];
 turns.forEach((darts,i)=>{assert.equal(deriveGame(g).round,i+1);play(g,darts);assert.equal(deriveGame(g).players[0].score,scores[i]);if(i<8)nextTurn(g);});
 assert.equal(deriveGame(g).winner,0);assert.equal(HALVE_TARGETS.length,9);
});
test('Halve-it: numbered double qualifies and non-target singles do not',()=>{
 const g=make('halveit',{players:['A']});turn(g,[[0],[0],[0]]);turn(g,[[0],[0],[0]]);
 play(g,[[3,2],[25,1],[5]]);assert.equal(deriveGame(g).players[0].score,16);assert.equal(deriveGame(g).halved,false);
});
test('Halve-it: correction and undo recalculate the penalty without applying it twice',()=>{
 const g=make('halveit');play(g,[[0],[0],[0]]);let s=deriveGame(g);assert.equal(s.players[0].score,20);
 correctThrow(g,s.throws[1].id,{number:15,multiplier:3});s=deriveGame(g);assert.equal(s.players[0].score,85);assert.equal(s.halved,false);
 undo(g);assert.equal(deriveGame(g).players[0].score,85);hit(g,0);assert.equal(deriveGame(g).players[0].score,85);
});
test('Halve-it: all players finish bull before deciding a tied result',()=>{
 const g=make('halveit');for(let i=0;i<17;i++){turn(g,[[0],[0],[0]]);assert.equal(deriveGame(g).winner,null);}
 play(g,[[0],[0],[0]]);assert.deepEqual(deriveGame(g).winners,[0,1]);assert.equal(deriveGame(g).round,9);
});
test('admin defaults support all new games and reject solo Killer',()=>{
 for(const mode of ['killer','shanghai','halveit'])assert.equal(validateSettings({...DEFAULTS,mode}).mode,mode);
 assert.throws(()=>validateSettings({...DEFAULTS,mode:'killer',playerCount:1}));
});
