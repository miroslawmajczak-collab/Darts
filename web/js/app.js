import { createGame, deriveGame, submitThrow, nextTurn, undo, correctThrow, CRICKET_TARGETS, GAME_MODES, HALVE_TARGETS, KILLER_NUMBERS } from './engine.js';
import { boardSVG } from './board.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons = {
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>', chevron:'<path d="m9 5 7 7-7 7"/>', plus:'<path d="M12 5v14M5 12h14"/>', minus:'<path d="M5 12h14"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>', cricket:'<path d="M6 5v14M12 5v14M18 5v14M3 15l18-6"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="m9 3-.6 2.2-2 .8-2-.6-2 3.4 1.6 1.6v2.3L2.4 14l2 3.4 2-.6 2 .8L9 20h4l.6-2.4 2-.8 2 .6 2-3.4-1.6-1.3v-2.3L19.6 8l-2-3.4-2 .6-2-.8L13 3Z"/>',
  expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>', pause:'<path d="M8 5v14M16 5v14"/>', undo:'<path d="M8 5 3 10l5 5M3 10h11a6 6 0 0 1 0 12"/>', close:'<path d="m6 6 12 12M18 6 6 18"/>', check:'<path d="m5 12 4 4L19 6"/>', trophy:'<path d="M8 3h8v6a4 4 0 0 1-8 0Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v6m-4 2h8"/>', play:'<path d="m9 5 11 7-11 7Z"/>', lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>', pencil:'<path d="m15 4 5 5M4 20l5-1L20 8a3.5 3.5 0 0 0-5-5L4 14Z"/>'
};
const icon = (name,cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.target}</svg>`;
const dictionaries = {};
let languages = [{code:'en',name:'English'},{code:'pl',name:'Polski'}];
let lang = 'en', settings = {language:'en',playerCount:2,mode:'x01',startScore:501,checkout:'double'};
let setup = {mode:'x01',startScore:501,checkout:'double',count:2,names:Array(6).fill(''),killerNumbers:[...KILLER_NUMBERS]};
let game = null, multiplier = 1, modal = null, toastTimer;
const app=$('#app'), dialog=$('#dialog');
function t(key, params={}) { return (dictionaries[lang]?.[key] || dictionaries.en?.[key] || key).replace(/\{(\w+)\}/g,(_,k)=>String(params[k]??`{${k}}`)); }
function gameName(options) { return options.mode==='x01'?String(options.startScore):t(options.mode); }
function segment(dart) { return dart.number===0?t('miss'):dart.number===25?(dart.multiplier===2?t('doubleBull'):t('bull')):`${['','S','D','T'][dart.multiplier]}${dart.number}`; }
function toast(key) { clearTimeout(toastTimer);$('#toast').textContent=t(key);$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4200); }
async function api(endpoint, data) {
  const response=await fetch(endpoint,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
  const result=await response.json();
  if(!response.ok) throw Object.assign(new Error(result.error),{status:response.status});
  return result;
}
function renderHeader() {
  $('#header').innerHTML=`<div class="wordmark">${icon('target')}<span>FLIGHT<span class="wordmark-dot">↗</span></span></div><div class="header-actions"><button class="language-switch" data-action="language" aria-label="${t('language')}">${languages.map(l=>`<span class="${lang===l.code?'active':''}">${esc(l.code.toUpperCase())}</span>`).join('')}</button><button class="icon-button" data-action="fullscreen" aria-label="${t(document.fullscreenElement?'exitFullscreen':'fullscreen')}">${icon('expand')}</button></div>`;
  $('#footer').innerHTML=`<span class="offline-label"><i></i>${t('offline')}</span>${!game?`<button class="icon-button muted" data-action="admin" aria-label="${t('admin')}">${icon('settings')}</button>`:`<span class="footer-mode">${t('manual')}</span>`}`;
}
function render() {
  document.documentElement.lang=lang;
  document.title=`FLIGHT · ${game?gameName(game.options):t('setup')}`;
  renderHeader();
  if(game) renderGame(); else renderSetup();
}
function renderSetup() {
  app.className='setup-view';
  if(setup.mode==='killer'){
    const used=new Set();
    for(let i=0;i<setup.count;i++){
      if(used.has(setup.killerNumbers[i]))setup.killerNumbers[i]=Array.from({length:20},(_,j)=>j+1).find(n=>!used.has(n));
      used.add(setup.killerNumbers[i]);
    }
  }
  const gameCards=[['x01','target'],['cricket','cricket'],['clock','clock'],['killer','lock'],['shanghai','trophy'],['halveit','cricket']].map(([mode,shape],i)=>`<button class="game-card ${setup.mode===mode?'selected':''}" data-action="mode" data-value="${mode}" aria-pressed="${setup.mode===mode}" aria-label="${t('selectGame',{game:t(mode)})}"><span class="game-card-top"><span class="game-icon">${icon(shape)}</span><span class="radio-indicator">${setup.mode===mode?icon('check'):''}</span></span><strong>${t(mode)}</strong><span>${t(mode+'Short')}</span></button>`).join('');
  app.innerHTML=`<section class="setup-intro"><span class="eyebrow"><span class="tiny-dash"></span>${t('ready')}</span><h1>${esc(t('setupTitle')).replace('\n','<br>')}</h1><p>${t('setupSubtitle')}</p><div class="hero-orbit" aria-hidden="true"><i></i><i></i><i></i><span>↗</span></div></section>
    <section class="setup-section"><div class="section-heading"><h2><span class="section-index">01</span>${t('chooseGame')}</h2></div><div class="game-cards">${gameCards}</div>
    ${setup.mode==='x01'?`<div class="game-options"><div><span class="field-label">${t('startingScore')}</span><div class="segmented score-select">${[301,501,701].map(n=>`<button data-action="score" data-value="${n}" class="${setup.startScore===n?'selected':''}" aria-pressed="${setup.startScore===n}">${n}</button>`).join('')}</div></div><div><span class="field-label">${t('finish')}</span><div class="segmented">${['straight','double'].map(option=>`<button data-action="finish" data-value="${option}" class="${setup.checkout===option?'selected':''}" aria-pressed="${setup.checkout===option}">${t(option)}</button>`).join('')}</div></div></div>`:''}
    <details class="rules"><summary>${icon('target')} ${t('rules')} <span>+</span></summary><p>${t(setup.mode+'Rules')}</p>${setup.mode==='x01'?`<p>${t(setup.checkout+'Hint')}</p>`:''}</details></section>
    <section class="setup-section players-section"><div class="section-heading"><h2><span class="section-index">02</span>${t('players')}</h2><div class="stepper"><button class="icon-button" data-action="count" data-value="-1" ${setup.count===(setup.mode==='killer'?2:1)?'disabled':''} aria-label="${t('removePlayer')}">${icon('minus')}</button><span aria-live="polite">${setup.count}</span><button class="icon-button" data-action="count" data-value="1" ${setup.count===6?'disabled':''} aria-label="${t('addPlayer')}">${icon('plus')}</button></div></div><div class="name-grid">${Array.from({length:setup.count},(_,i)=>`<label class="player-input" data-action="name" data-index="${i}"><span class="player-avatar color-${i}">${String(i+1).padStart(2,'0')}</span><input data-name="${i}" inputmode="none" aria-label="${t('playerName',{n:i+1})}" placeholder="${t('player',{n:i+1})}" value="${esc(setup.names[i])}" maxlength="24" autocomplete="off" spellcheck="false"></label>`).join('')}</div><span class="helper-text">${t(setup.mode==='killer'?'killerMinimum':'upToSix')}</span>${setup.mode==='killer'?killerSetup():''}</section>
    <div class="start-area"><button class="button primary start-button" data-action="start">${t('start')}${icon('arrow')}</button><p>${t('startHint')}</p></div>`;
}
function cricketTable(state) {
  return `<div class="cricket-wrap"><table class="cricket-table"><caption class="sr-only">${t('cricket')}</caption><thead><tr><th>${t('targetColumn')}</th>${state.players.map((p,i)=>`<th class="${i===state.current?'current':''}" scope="col">${esc(p.name)}</th>`).join('')}</tr></thead><tbody>${CRICKET_TARGETS.map(n=>`<tr><th scope="row">${n===25?t('bull'):n}</th>${state.players.map((p,i)=>`<td class="${i===state.current?'current':''}"><span class="marks marks-${p.marks[n]}" aria-label="${t('marked',{n:p.marks[n]})}">${[0,1,2].map(m=>`<i class="${m<p.marks[n]?'filled':''}"></i>`).join('')}</span></td>`).join('')}</tr>`).join('')}<tr class="points-row"><th scope="row">${t('points')}</th>${state.players.map((p,i)=>`<td class="${i===state.current?'current':''}">${p.score}</td>`).join('')}</tr></tbody></table></div>`;
}
function killerSetup() {
  return `<div class="killer-setup"><h3>${t('killerAssignments')}</h3><p>${t('killerNumbersHint')}</p><div class="assignment-grid">${Array.from({length:setup.count},(_,i)=>{const name=setup.names[i].trim()||t('player',{n:i+1});return `<label><span>${esc(name)}</span><select data-killer-number="${i}" aria-label="${esc(t('killerAssignment',{name}))}">${Array.from({length:20},(_,j)=>j+1).map(n=>`<option value="${n}" ${setup.killerNumbers[i]===n?'selected':''} ${setup.killerNumbers.some((other,j)=>j<setup.count&&j!==i&&other===n)?'disabled':''}>${n}</option>`).join('')}</select></label>`;}).join('')}</div></div>`;
}
function playerValue(player,mode) {
  return mode==='x01'?player.remaining:mode==='clock'?Math.min(player.target,20):mode==='killer'?player.lives:player.score;
}
function winnerText(state) {
  return state.winners.length>1?t('sharedWin',{names:state.winners.map(i=>state.players[i].name).join(' · ')}):t(state.players.length===1?'winnerSolo':'winner',{name:state.players[state.winner].name});
}
function targetText(target) {return typeof target==='number'?String(target):t(target==='double'?'anyDouble':target==='triple'?'anyTriple':'targetBull');}
function modePanel(state,options) {
  const player=state.players[state.current];
  if(options.mode==='killer')return `<section class="mode-panel killer-panel"><strong>${t('ownDouble',{n:player.number})} <span class="status-badge ${player.armed?'armed':''}">${t(player.lives===0?'eliminated':player.armed?'armed':'notArmed')}</span></strong><p>${player.lives===0?t('eliminated'):t(player.armed?'attackInstruction':'armInstruction',{n:player.number})}</p></section>`;
  if(options.mode==='shanghai')return `<section class="mode-panel shanghai-panel"><div class="mode-target"><span>${t('currentTarget')}</span><strong>${state.round}</strong><div class="combo-marks">${[1,2,3].map(m=>`<span class="${state.throws.some(d=>d.number===state.round&&d.multiplier===m)?'hit':''}" aria-label="${t(['','single','doubleLabel','triple'][m])}">${['','S','D','T'][m]}</span>`).join('')}</div></div><p>${t('shanghaiCombo')}</p><div class="target-schedule" aria-label="${t('roundProgress')}">${Array.from({length:7},(_,i)=>`<span class="${i+1===state.round?'current':i+1<state.round?'done':''}">${i+1}</span>`).join('')}</div></section>`;
  if(options.mode==='halveit')return `<section class="mode-panel halve-panel ${state.halved?'penalty':''}"><div class="mode-target"><span>${t('currentTarget')}</span><strong>${targetText(HALVE_TARGETS[state.round-1])}</strong></div><p>${state.halved?t('halvedMessage',{score:player.score}):t('halveWarning')}</p><div class="target-schedule" aria-label="${t('roundProgress')}">${HALVE_TARGETS.map((target,i)=>`<span class="${i+1===state.round?'current':i+1<state.round?'done':''}" title="${targetText(target)}">${typeof target==='number'?target:target==='bull'?'◎':target==='double'?'D':'T'}</span>`).join('')}</div></section>`;
  return '';
}
function renderGame() {
  const state=deriveGame(game), player=state.players[state.current], options=game.options;
  const locked=state.turnFinished||game.paused;
  const value=playerValue(player,options.mode);
  const roundLabel=['shanghai','halveit'].includes(options.mode)?t('roundOf',{n:state.round,total:options.mode==='shanghai'?7:HALVE_TARGETS.length}):t('round',{n:state.round});
  app.className=`game-view game-${options.mode}`;
  app.innerHTML=`<div class="game-topline"><span class="game-type-chip">${gameName(options)}${options.mode==='x01'?`<span> / ${t(options.checkout)}</span>`:''}</span><span class="round-label">${roundLabel}</span><button class="icon-button" data-action="pause" aria-label="${t('pause')}">${icon('pause')}</button></div>
    <div class="player-strip player-count-${state.players.length}">${state.players.map((p,i)=>`<div class="player-tile ${i===state.current?'current':''} ${options.mode==='killer'&&p.lives===0?'eliminated':''} color-${i}"><span class="tile-name"><i></i>${esc(p.name)}</span><strong>${playerValue(p,options.mode)}${options.mode==='clock'?'<small>/20</small>':''}${options.mode==='killer'?`<small class="killer-player-status">D${p.number} · ${t(p.lives===0?'eliminated':p.armed?'armed':'notArmed')}</small>`:''}</strong></div>`).join('')}</div>
    <section class="score-stage"><div class="score-heading"><span class="eyebrow">${esc(player.name)} · ${t('toThrow')}</span><span class="score-number ${state.bust?'is-bust':''}">${state.bust?t('bust'):value}</span><span class="score-caption">${t(options.mode==='x01'?'remaining':options.mode==='clock'?'target':options.mode==='killer'?'lives':'points')}</span>${options.mode==='clock'?`<div class="clock-progress">${Array.from({length:20},(_,i)=>`<span class="${i+1<player.target?'done':i+1===player.target?'current':''}">${i+1}</span>`).join('')}</div>`:''}</div><div class="board-wrap">${boardSVG(t,state.throws,!locked)}</div></section>
    ${options.mode==='cricket'?cricketTable(state):''}${modePanel(state,options)}
    <section class="throw-section"><div class="throw-slots">${[0,1,2].map(i=>{const d=state.throws[i];return `<button class="throw-slot ${d?'recorded':''} ${!d&&i===state.throws.length&&!locked?'next-dart':''}" ${d?'':'disabled'} ${game.paused?'disabled':''} data-action="correct" data-id="${d?.id||''}" aria-label="${d?t('editDart',{n:i+1}):t('throw',{n:i+1})}"><span>${t('throw',{n:i+1})}</span><strong>${d?esc(segment(d)):'—'}</strong>${d?`<small>${d.number*d.multiplier} ${icon('pencil')}</small>`:`<small>${t('waiting')}</small>`}</button>`;}).join('')}</div><div class="turn-total"><span>${t(options.mode==='clock'?'hits':options.mode==='killer'?'killerTurnTotal':'turnTotal')}</span><strong>${state.bust?0:state.turnTotal}</strong></div></section>
    <section class="entry-section ${locked?'entry-locked':''}" aria-label="${t('tapToScore')}"><div class="entry-heading"><h2>${t('tapToScore')}</h2><span class="manual-dot"></span></div>${entryPad(locked,false)}<p class="entry-hint">${t('tapHint')}</p></section>
    <div class="game-controls"><button class="button secondary undo-button" data-action="undo" ${!game.actions.length||game.paused?'disabled':''}>${icon('undo')}${t('undo')}</button>${state.winner!==null?`<button class="button primary" data-action="results">${t('results')}${icon('trophy')}</button>`:`<button class="button primary next-button" data-action="next" ${!state.turnFinished||game.paused?'disabled':''}>${t(state.players.length===1?'nextSolo':'next')}${icon('arrow')}</button>`}</div>
    <p class="turn-message ${state.bust?'bust-message':''}" role="status">${state.winner!==null?esc(winnerText(state)):state.halved?t('halvedMessage',{score:player.score}):state.bust?t('bustHint'):state.turnFinished?t('removeDarts'):t('finishTurn')}</p>
    <details class="rules in-game-rules"><summary>${icon('target')}${t('rulesDuringGame')}<span>+</span></summary><p>${t(options.mode+'Rules')}</p></details><details class="history rules"><summary>${t('turnHistory')}<span>+</span></summary>${state.history.length?state.history.slice(-6).reverse().map(h=>`<div class="history-row"><strong>${esc(state.players[h.player].name)}</strong><span>${h.throws.map(d=>esc(segment(d))).join(' · ')}</span><b>${h.bust?t('bust'):h.halved?`½ (${h.total})`:h.total}</b></div>`).join(''):`<p>${t('noHistory')}</p>`}</details>`;
}
function entryPad(locked=false, correction=false) {
  return `<div class="segmented multiplier-select">${[1,2,3].map(m=>`<button class="${multiplier===m?'selected':''}" data-action="multiplier" data-value="${m}" aria-pressed="${multiplier===m}" ${locked?'disabled':''}><b>${m}×</b>${t(['','single','doubleLabel','triple'][m])}</button>`).join('')}</div><div class="number-pad">${Array.from({length:20},(_,i)=>`<button data-action="dart" data-number="${i+1}" data-multiplier="${multiplier}" ${locked?'disabled':''}>${i+1}</button>`).join('')}</div><div class="special-pad"><button data-action="dart" data-number="25" data-multiplier="1" ${locked?'disabled':''}><span class="bull-symbol">◎</span>${t('bull')}<b>25</b></button><button data-action="dart" data-number="25" data-multiplier="2" ${locked?'disabled':''}><span class="bull-symbol inner">●</span>${t('doubleBull')}<b>50</b></button><button class="miss-button" data-action="dart" data-number="0" data-multiplier="0" ${locked?'disabled':''}>${icon('close')}${t('miss')}<b>0</b></button></div>`;
}
function openDialog(kind, data={}) {
  modal={kind,...data};
  renderDialog();
  if(!dialog.open) dialog.showModal();
}
function closeDialog() {
  dialog.close();dialog.replaceChildren();modal=null;
  if(game?.paused) {game.paused=false;render();}
}
function dialogShell(title,body,classes='') {
  dialog.className=classes;
  dialog.innerHTML=`<div class="dialog-heading"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-action="close-dialog" aria-label="${t('close')}">${icon('close')}</button></div>${body}`;
  dialog.setAttribute('aria-labelledby','dialog-title');
}
function renderDialog() {
  if(!modal)return;
  if(modal.kind==='name') {
    const rows=['1234567890','QWERTYUIOP','ASDFGHJKL','ZXCVBNM',...(lang==='pl'?['ĄĆĘŁŃÓŚŹŻ']:[])];
    dialogShell(t('playerName',{n:modal.index+1}),`<label class="form-field"><span class="sr-only">${t('playerName',{n:modal.index+1})}</span><input id="name-draft" value="${esc(modal.draft)}" maxlength="24" autocomplete="off" spellcheck="false" inputmode="none" placeholder="${t('player',{n:modal.index+1})}"></label><div class="touch-keyboard">${rows.map(row=>`<div class="keyboard-row">${Array.from(row).map(letter=>`<button data-action="letter" data-value="${letter}">${letter}</button>`).join('')}</div>`).join('')}<div class="keyboard-row keyboard-tools"><button data-action="clear-name">${t('clear')}</button><button data-action="letter" data-value=" ">${t('space')}</button><button data-action="backspace" aria-label="${t('backspace')}">⌫</button></div></div><button class="button primary full-width" data-action="save-name">${t('done')}${icon('check')}</button>`,'name-dialog');
  }
  if(modal.kind==='correction') dialogShell(t('correctTitle'),`<p>${t('correctHint')}</p>${entryPad(false,true)}`,'correction-dialog');
  if(modal.kind==='pause') dialogShell(t('paused'),`<div class="pause-symbol">${icon('pause')}</div><p>${t('pausedHint')}</p><button class="button primary full-width" data-action="resume">${icon('play')}${t('resume')}</button><button class="button text-button full-width" data-action="end">${t('end')}</button>`,'pause-dialog');
  if(modal.kind==='end') dialogShell(t('endTitle'),`<p>${t('endHint')}</p><div class="dialog-actions"><button class="button secondary" data-action="close-dialog">${t('cancel')}</button><button class="button danger" data-action="confirm-end">${t('confirmEnd')}</button></div>`);
  if(modal.kind==='results') {
    const state=deriveGame(game), winner=state.players[state.winner];
    dialogShell(t('results'),`<div class="winner-emblem">${icon('trophy')}</div><h3 class="winner-title">${esc(winnerText(state))}</h3><p>${t(state.winReason==='shanghai'?'shanghaiWin':'winnerHint')}</p><div class="result-list">${state.players.map((p,i)=>`<div class="result-row ${state.winners.includes(i)?'winner-row':''}"><span>${esc(p.name)}${state.winners.includes(i)?`<small>${t(state.winners.length>1?'sharedBadge':'winnerBadge')}</small>`:''}</span><b>${game.options.mode==='clock'?`${Math.min(p.target-1,20)}/20`:game.options.mode==='killer'?esc(t('livesValue',{n:p.lives})):playerValue(p,game.options.mode)}</b></div>`).join('')}</div><button class="button primary full-width" data-action="rematch">${t('rematch')}${icon('arrow')}</button><button class="button secondary full-width" data-action="confirm-end">${t('newGame')}</button>`,'results-dialog');
  }
  if(modal.kind==='admin') renderAdmin();
}
function renderAdmin() {
  if(!modal.status) {dialogShell(t('adminTitle'),`<p>${t('starting')}</p>`);return;}
  const status=modal.status;
  if(!status.authenticated) {
    dialogShell(t('adminTitle'),`<div class="admin-lock">${icon('lock')}</div><p>${t(status.configured?'adminLogin':'adminFirst')}</p><form id="auth-form"><label class="form-field">${t('password')}<input name="password" type="password" minlength="8" maxlength="128" required autocomplete="${status.configured?'current-password':'new-password'}" placeholder="${t('passwordHint')}"></label>${!status.configured?`<label class="form-field">${t('confirmPassword')}<input name="confirm" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></label>`:''}<p class="form-error" role="alert" id="auth-error"></p><button class="button primary full-width" type="submit">${t(status.configured?'login':'createPassword')}${icon('lock')}</button></form>`,'admin-dialog');
  } else {
    dialogShell(t('adminTitle'),`<p>${t('adminIntro')}</p><form id="settings-form"><label class="form-field">${t('defaultLanguage')}<select name="language">${languages.map(l=>`<option value="${esc(l.code)}" ${settings.language===l.code?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label><label class="form-field">${t('defaultPlayers')}<select name="playerCount">${[1,2,3,4,5,6].map(n=>`<option ${settings.playerCount===n?'selected':''}>${n}</option>`).join('')}</select></label><label class="form-field">${t('defaultGame')}<select name="mode">${GAME_MODES.map(m=>`<option value="${m}" ${settings.mode===m?'selected':''}>${t(m)}</option>`).join('')}</select></label><label class="form-field">${t('defaultScore')}<select name="startScore">${[301,501,701].map(n=>`<option ${settings.startScore===n?'selected':''}>${n}</option>`).join('')}</select></label><label class="form-field">${t('defaultFinish')}<select name="checkout">${['straight','double'].map(m=>`<option value="${m}" ${settings.checkout===m?'selected':''}>${t(m)}</option>`).join('')}</select></label><p class="form-error" role="alert" id="settings-error"></p><button class="button primary full-width" type="submit">${t('save')}${icon('check')}</button></form><div class="admin-note"><strong>${t('cameraFuture')}</strong><p>${t('cameraFutureHint')}</p></div><p class="memory-note">${t('memoryNotice')}</p><button class="button secondary full-width" data-action="logout">${icon('lock')}${t('logout')}</button>`,'admin-dialog');
  }
}
function startGame(options) { game=createGame(options);multiplier=1;render();window.scrollTo({top:0,behavior:'instant'}); }
function savePlayerName() { setup.names[modal.index]=modal.draft.trim();closeDialog();render(); }
function acceptDart(number,mult) {
  const value={number,multiplier:mult,source:'manual'};
  try {
    if(modal?.kind==='correction') {
      const result=correctThrow(game,modal.id,value);closeDialog();toast(result.truncated?'correctionCleared':'corrected');
    } else submitThrow(game,value);
    multiplier=1;render();
    const state=deriveGame(game);
    if(state.winner!==null)openDialog('results');
  }catch{toast('gameError');}
}

document.addEventListener('change',event=>{if(event.target.matches('[data-killer-number]')){setup.killerNumbers[Number(event.target.dataset.killerNumber)]=Number(event.target.value);render();}});
document.addEventListener('input',event=>{ if(event.target.matches('[data-name]')) setup.names[Number(event.target.dataset.name)]=event.target.value;if(event.target.id==='name-draft'&&modal?.kind==='name')modal.draft=event.target.value; });
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action], .dartboard [data-number]');
  if(!button || button.disabled || (dialog.open&&!dialog.contains(button)))return;
  const action=button.dataset.action;
  try {
    if(button.closest('.dartboard')&&button.dataset.number!==undefined) return acceptDart(Number(button.dataset.number),Number(button.dataset.multiplier));
    if(action==='language') { lang=languages[(languages.findIndex(l=>l.code===lang)+1)%languages.length].code;render();renderDialog(); }
    if(action==='fullscreen') { try { if(document.fullscreenElement) await document.exitFullscreen();else await document.documentElement.requestFullscreen();renderHeader(); }catch{toast('quitFullscreen');} }
    if(action==='mode'){setup.mode=button.dataset.value;if(setup.mode==='killer')setup.count=Math.max(2,setup.count);render();}
    if(action==='score'){setup.startScore=Number(button.dataset.value);render();}
    if(action==='finish'){setup.checkout=button.dataset.value;render();}
    if(action==='count'){setup.count=Math.max(setup.mode==='killer'?2:1,Math.min(6,setup.count+Number(button.dataset.value)));render();}
    if(action==='name'){const index=Number(button.dataset.index);openDialog('name',{index,draft:setup.names[index]});}
    if(['letter','backspace','clear-name'].includes(action)&&modal?.kind==='name'){
      if(action==='clear-name')modal.draft='';
      if(action==='backspace')modal.draft=Array.from(modal.draft).slice(0,-1).join('');
      if(action==='letter'&&modal.draft.length<24){const letter=button.dataset.value;const previous=modal.draft.at(-1);modal.draft+=(modal.draft.length===0||previous===' ')?letter:letter.toLocaleLowerCase(lang);}
      $('#name-draft').value=modal.draft;
    }
    if(action==='save-name')savePlayerName();
    if(action==='start'){startGame({mode:setup.mode,startScore:setup.startScore,checkout:setup.checkout,players:setup.names.slice(0,setup.count).map((n,i)=>n.trim()||t('player',{n:i+1})),killerNumbers:setup.killerNumbers.slice(0,setup.count)});}
    if(action==='multiplier'){multiplier=Number(button.dataset.value);if(modal?.kind==='correction')renderDialog();else renderGame();}
    if(action==='dart')acceptDart(Number(button.dataset.number),Number(button.dataset.multiplier));
    if(action==='next'){nextTurn(game);multiplier=1;render();}
    if(action==='undo'){undo(game);multiplier=1;render();}
    if(action==='correct'){multiplier=1;openDialog('correction',{id:button.dataset.id});}
    if(action==='pause'){game.paused=true;render();openDialog('pause');}
    if(action==='close-dialog'||action==='resume')closeDialog();
    if(action==='end')openDialog('end');
    if(action==='confirm-end'){closeDialog();game=null;multiplier=1;render();window.scrollTo({top:0,behavior:'instant'});}
    if(action==='results')openDialog('results');
    if(action==='rematch'){const options=game.options;closeDialog();startGame(options);}
    if(action==='admin'){
      openDialog('admin');
      try { const status=await api('/api/admin/status');if(modal?.kind==='admin'){modal.status=status;renderDialog();} } catch {closeDialog();toast('serviceUnavailable');}
    }
    if(action==='logout'){await api('/api/admin/logout',{});modal.status.authenticated=false;renderDialog();}
  }catch{toast('gameError');}
});
document.addEventListener('keydown',event=>{
  if(modal?.kind==='name'&&event.key==='Enter'&&event.target.id==='name-draft'){event.preventDefault();savePlayerName();return;}
  if((event.key==='Enter'||event.key===' ')&&event.target.matches('.dartboard [data-number]')) {event.preventDefault();event.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}
});
dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
document.addEventListener('fullscreenchange',renderHeader);
document.addEventListener('submit',async event=>{
  const form=event.target;
  if(!['auth-form','settings-form'].includes(form.id))return;
  event.preventDefault();
  const data=Object.fromEntries(new FormData(form));
  const submit=form.querySelector('button[type=submit]');submit.disabled=true;
  if(form.id==='auth-form') {
    if(!modal.status.configured && data.password!==data.confirm){$('#auth-error').textContent=t('passwordMismatch');submit.disabled=false;return;}
    try {
      await api(modal.status.configured?'/api/admin/login':'/api/admin/setup',{password:data.password});
      if(modal?.kind==='admin'){modal.status={configured:true,authenticated:true};renderDialog();}
    }catch(error){if($('#auth-error'))$('#auth-error').textContent=t(error.status===429?'retryLater':error.message==='WEAK_PASSWORD'?'weakPassword':'authError');}
  } else {
    const next={...data,playerCount:Number(data.playerCount),startScore:Number(data.startScore)};
    if(next.mode==='killer'&&next.playerCount<2){$('#settings-error').textContent=t('adminKillerCount');submit.disabled=false;return;}
    try { await api('/api/settings',next);settings=next;toast('saved'); }
    catch(error){if($('#settings-error'))$('#settings-error').textContent=t(error.status===401?'sessionExpired':'saveError');}
  }
  submit.disabled=false;
});
window.addEventListener('beforeunload',event=>{if(game){event.preventDefault();event.returnValue='';}});

// Future camera adapters submit the same normalized segment via this boundary.
// No camera libraries, connections or polling are loaded in the manual MVP.
export const throwInput = Object.freeze({
  submit(candidate) {
    if(!game||modal||game.paused) return {accepted:false,reason:'NOT_READY'};
    if(candidate.requiresConfirmation) return {accepted:false,reason:'REVIEW_REQUIRED'};
    try {
      const accepted=submitThrow(game,{...candidate,source:'camera'});render();
      if(deriveGame(game).winner!==null)openDialog('results');
      return {accepted};
    }catch(error){return {accepted:false,reason:error.message};}
  }
});

async function init() {
  const [registered,saved]=await Promise.all([fetch('/locales/languages.json').then(r=>r.json()),api('/api/settings').catch(()=>null)]);
  languages=registered;
  await Promise.all(languages.map(async l=>{if(!/^[a-z]{2,3}(-[A-Za-z0-9]+)?$/.test(l.code))throw new Error('INVALID_LANGUAGE');dictionaries[l.code]=await fetch(`/locales/${l.code}.json`).then(r=>r.json());}));
  if(saved)settings=saved;
  lang=settings.language;setup={...setup,mode:settings.mode,startScore:settings.startScore,checkout:settings.checkout,count:settings.mode==='killer'?Math.max(2,settings.playerCount):settings.playerCount};
  render();if(!saved)toast('serviceUnavailable');
}
init().catch(()=>{app.textContent='FLIGHT could not load local files. Restart using start.bat / sh start.sh.';});
