export const ORDER = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
const p = (r, a) => [220 + r * Math.cos(a * Math.PI / 180), 220 + r * Math.sin(a * Math.PI / 180)];
function ring(r1, r2, a1, a2) {
  const a=p(r1,a1),b=p(r2,a1),c=p(r2,a2),d=p(r1,a2);
  return `M${a} L${b} A${r2},${r2} 0 0 1 ${c} L${d} A${r1},${r1} 0 0 0 ${a} Z`;
}
export function boardSVG(t, throws = [], enabled = true) {
  let paths = '';
  ORDER.forEach((n, i) => {
    const a = -99 + i * 18, dark = i % 2 === 0;
    [[15.9,99,1],[99,107,3],[107,162,1],[162,170,2]].forEach(([inner,outer,m]) => {
      const fill = m === 1 ? (dark ? '#292f2b' : '#e6dfc9') : (dark ? '#bf5546' : '#49866a');
      const label = t(m===1?'segmentSingle':m===2?'segmentDouble':'segmentTriple',{n});
      paths += `<path d="${ring(inner,outer,a,a+18)}" fill="${fill}" stroke="#919889" stroke-width=".65" ${enabled?`data-number="${n}" data-multiplier="${m}" role="button" tabindex="0" aria-label="${label}"`:''}><title>${label}</title></path>`;
    });
    const [x,y] = p(193,a+9);
    paths += `<text x="${x}" y="${y}" dominant-baseline="central" text-anchor="middle" class="board-number">${n}</text>`;
  });
  paths += `<circle cx="220" cy="220" r="15.9" fill="#49866a" stroke="#919889" stroke-width=".65" ${enabled?'data-number="25" data-multiplier="1" role="button" tabindex="0"':''} aria-label="${t('bull')}"><title>${t('bull')}</title></circle><circle cx="220" cy="220" r="6.35" fill="#bf5546" stroke="#919889" stroke-width=".65" ${enabled?'data-number="25" data-multiplier="2" role="button" tabindex="0"':''} aria-label="${t('doubleBull')}"><title>${t('doubleBull')}</title></circle>`;
  const groups = new Map();
  throws.filter(d=>d.number).forEach((d,i)=>{
    const key=`${d.number}:${d.multiplier}`, occurrence=groups.get(key)||0;groups.set(key,occurrence+1);
    const r = d.number === 25 ? (d.multiplier===2?0:12) : d.multiplier===3?103:d.multiplier===2?166:135;
    const a = -90 + ORDER.indexOf(d.number)*18;
    const actual = d.boardPosition;
    const [x,y] = actual ? [220+actual.x,220+actual.y] : p(r,a);
    paths += `<g class="dart-marker" transform="translate(${x+occurrence*13},${y-occurrence*13})" pointer-events="none"><circle r="12" fill="#d5f19b" stroke="#1a392a" stroke-width="2"/><text dominant-baseline="central" text-anchor="middle" fill="#182d22" font-size="13" font-weight="800">${i+1}</text></g>`;
  });
  return `<svg class="dartboard" viewBox="0 0 440 440" role="group" aria-label="${t('board')}"><circle cx="220" cy="220" r="216" fill="#1d2520" stroke="#424d42" stroke-width="2"/><circle cx="220" cy="220" r="176" fill="none" stroke="#666f60" stroke-width="2"/>${paths}</svg>`;
}
