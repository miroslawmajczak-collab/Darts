export const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25];
export const GAME_MODES = ['x01','cricket','clock','killer','shanghai','halveit'];
export const HALVE_TARGETS = [15,16,'double',17,18,'triple',19,20,'bull'];
export const KILLER_NUMBERS = [20,19,18,17,16,15];

export function normalizeThrow(value) {
  if (!value || !Number.isInteger(value.number) || !Number.isInteger(value.multiplier)) throw new Error('INVALID_THROW');
  const { number, multiplier } = value;
  if (number === 0 && multiplier === 0) return { number, multiplier };
  if (number === 25 && [1, 2].includes(multiplier)) return { number, multiplier };
  if (number >= 1 && number <= 20 && multiplier >= 1 && multiplier <= 3) return { number, multiplier };
  throw new Error('INVALID_THROW');
}

export function createGame(options) {
  const names = options.players?.map(name => String(name).trim());
  if (!names || names.length < 1 || names.length > 6 || names.some(name => !name || name.length > 24)) throw new Error('INVALID_PLAYERS');
  if (!GAME_MODES.includes(options.mode)) throw new Error('INVALID_MODE');
  if (options.mode === 'x01' && (![301,501,701].includes(options.startScore) || !['straight','double'].includes(options.checkout))) throw new Error('INVALID_OPTIONS');
  const killerNumbers = options.killerNumbers || KILLER_NUMBERS.slice(0,names.length);
  if (options.mode === 'killer' && (names.length<2 || !Array.isArray(killerNumbers) || killerNumbers.length!==names.length || new Set(killerNumbers).size!==names.length || killerNumbers.some(n=>!Number.isInteger(n)||n<1||n>20))) throw new Error('INVALID_KILLER_SETUP');
  return { options: { ...options, players: names, ...(options.mode==='killer'?{killerNumbers:[...killerNumbers]}:{}) }, actions: [], paused: false };
}

// This pure reducer is independent of the UI and of manual/camera input.
export function deriveGame(game) {
  const { options } = game;
  const state = {
    players: options.players.map((name,i) => ({ name, remaining: options.startScore || 501, score: options.mode==='halveit'?40:0, target: 1, lives:3, armed:false, number:options.killerNumbers?.[i], marks: Object.fromEntries(CRICKET_TARGETS.map(n => [n, 0])) })),
    current: 0, turn: 1, round: 1, throws: [], turnTotal: 0, bust: false, winner: null, winners:[], winReason:null, turnFinished: false, history: [], halved:false
  };
  const finish = (indices, reason) => {state.winners=indices;state.winner=indices[0];state.winReason=reason;state.turnFinished=true;};
  const finishOnPoints = () => {const best=Math.max(...state.players.map(p=>p.score));finish(state.players.flatMap((p,i)=>p.score===best?[i]:[]),'points');};
  let turnStart = state.players[0].remaining;
  for (const action of game.actions) {
    if (action.type === 'next') {
      if (!state.turnFinished || state.winner !== null) throw new Error('INVALID_NEXT');
      state.history.push({ player: state.current, round:state.round, throws: [...state.throws], bust: state.bust, halved:state.halved, total: state.bust ? 0 : state.turnTotal });
      const previous=state.current;
      do {state.current = (state.current + 1) % state.players.length;} while(options.mode==='killer' && state.players[state.current].lives===0);
      state.turn++;
      if(state.current<=previous)state.round++;
      state.throws = []; state.turnTotal = 0; state.bust = false; state.turnFinished = false;state.halved=false;
      turnStart = state.players[state.current].remaining;
      continue;
    }
    if (action.type !== 'throw' || state.turnFinished || state.winner !== null) throw new Error('INVALID_ACTION');
    const dart = normalizeThrow(action.dart);
    const player = state.players[state.current];
    const points = dart.number * dart.multiplier;
    state.throws.push({ ...dart, id: action.id, source: action.source, boardPosition: action.boardPosition ?? null });
    if (options.mode === 'x01') {
      const remaining = player.remaining - points;
      const doubleOut = options.checkout === 'double';
      if (remaining < 0 || (doubleOut && (remaining === 1 || (remaining === 0 && dart.multiplier !== 2)))) {
        player.remaining = turnStart; state.bust = true; state.turnFinished = true;
      } else {
        player.remaining = remaining; state.turnTotal += points;
        if (remaining === 0) finish([state.current],'checkout');
      }
    } else if (options.mode === 'cricket') {
      if (CRICKET_TARGETS.includes(dart.number)) {
        const before = player.marks[dart.number];
        player.marks[dart.number] = Math.min(3, before + dart.multiplier);
        const excess = Math.max(0, before + dart.multiplier - 3);
        const anyoneOpen = state.players.some((other, i) => i !== state.current && other.marks[dart.number] < 3);
        const gained = anyoneOpen ? excess * dart.number : 0;
        player.score += gained; state.turnTotal += gained;
      }
      if (CRICKET_TARGETS.every(n => player.marks[n] === 3) && state.players.every(other => player.score >= other.score)) finish([state.current],'closed');
    } else if(options.mode==='clock') {
      if (dart.number === player.target) { player.target++; state.turnTotal++; }
      if (player.target === 21) finish([state.current],'clock');
    } else if(options.mode==='killer') {
      if(dart.multiplier===2 && dart.number<=20 && dart.number>0){
        if(!player.armed){if(dart.number===player.number)player.armed=true;}
        else {
          const victim=state.players.find(p=>p.number===dart.number);
          if(victim && victim.lives>0){victim.lives--;state.turnTotal++;}
        }
      }
      if(player.lives===0)state.turnFinished=true;
      const survivors=state.players.flatMap((p,i)=>p.lives>0?[i]:[]);
      if(survivors.length===1)finish(survivors,'survivor');
    } else if(options.mode==='shanghai') {
      if(dart.number===state.round){player.score+=points;state.turnTotal+=points;}
      const rings=new Set(state.throws.filter(d=>d.number===state.round).map(d=>d.multiplier));
      if([1,2,3].every(m=>rings.has(m)))finish([state.current],'shanghai');
    } else if(options.mode==='halveit') {
      const target=HALVE_TARGETS[state.round-1];
      const matches=typeof target==='number'?dart.number===target:target==='bull'?dart.number===25:target==='double'?dart.number>=1&&dart.number<=20&&dart.multiplier===2:dart.multiplier===3;
      if(matches){player.score+=points;state.turnTotal+=points;}
      if(state.throws.length===3 && state.turnTotal===0){const before=player.score;player.score=Math.floor(before/2);state.turnTotal=player.score-before;state.halved=true;}
    }
    if (state.throws.length === 3 || state.winner !== null) state.turnFinished = true;
    if(state.throws.length===3 && state.current===state.players.length-1 && state.winner===null && ((options.mode==='shanghai'&&state.round===7)||(options.mode==='halveit'&&state.round===HALVE_TARGETS.length)))finishOnPoints();
  }
  return state;
}

export function submitThrow(game, value) {
  if (game.paused) throw new Error('PAUSED');
  const state = deriveGame(game);
  if (state.turnFinished || state.winner !== null) throw new Error('TURN_FINISHED');
  const dart = normalizeThrow(value);
  const id = value.id || globalThis.crypto.randomUUID();
  if (game.actions.some(a => a.id === id)) return false;
  game.actions.push({ type: 'throw', id, dart, source: value.source || 'manual', boardPosition: value.boardPosition || null });
  return true;
}

export function nextTurn(game) {
  const state = deriveGame(game);
  if (game.paused || !state.turnFinished || state.winner !== null) return false;
  game.actions.push({ type: 'next' });
  return true;
}

export function undo(game) {
  if (game.paused) return false;
  // A next-player transition is undone together with the preceding throw.
  while (game.actions.at(-1)?.type === 'next') game.actions.pop();
  return Boolean(game.actions.pop());
}

export function correctThrow(game, id, value) {
  if (game.paused) throw new Error('PAUSED');
  const index = game.actions.findIndex(a => a.type === 'throw' && a.id === id);
  if (index < 0) throw new Error('INVALID_ACTION');
  const original = game.actions[index];
  const candidate = { ...game, actions: game.actions.map((a, i) => i === index ? { ...a, dart: normalizeThrow(value), source: 'manual-correction', boardPosition: null } : a) };
  // Changes that end a turn early invalidate later input. Discard only that tail.
  let truncated = false;
  try { deriveGame(candidate); } catch {
    candidate.actions = candidate.actions.slice(0, index + 1); truncated = true;
    deriveGame(candidate);
  }
  game.actions = candidate.actions;
  return { truncated, previous: original.dart };
}

