import * as store from '../store.js';
import { esc, pct, fmtN, ago, person, STATUS, initials } from '../ui.js';
import { COMPANY, REGIONS, LEGACY_SYSTEMS } from '../data/reference.js';

function wave() {
  const total = COMPANY.totalEntities;
  return `<div class="wave" role="img" aria-label="Wave 1 covers 30 of ${total} entities">
    ${COMPANY.waves.map((w) => `<div class="${w.wave === 1 ? 'w-on' : 'w-off'}" style="flex:${w.entities}" data-tip="<b>${w.label}</b><br>${w.entities} entities · ${w.status}">${w.label} · ${w.entities}${w.wave === 1 ? ' · in progress' : ''}</div>`).join('')}
  </div>`;
}

function tiles(m) {
  const reduction = 1 - m.active / m.legacyCount;
  return `<div class="grid g-4">
    <div class="card tile">
      <div class="label">Global accounts approved</div>
      <div class="value">${m.byStatus.approved}<small> / ${m.active}</small></div>
      <div class="sub">${pct(m.approvedPct)} of active accounts · avg ${m.avgCycle.toFixed(0)} days to approve</div>
      <div class="meter"><i style="width:${pct(m.approvedPct, 1)}"></i></div>
    </div>
    <div class="card tile">
      <div class="label">Entity fit-check completion</div>
      <div class="value">${pct(m.votesCast / m.votesEligible)}</div>
      <div class="sub">${fmtN(m.votesCast)} of ${fmtN(m.votesEligible)} entity votes cast</div>
      <div class="meter"><i style="width:${pct(m.votesCast / m.votesEligible, 1)}"></i></div>
    </div>
    <div class="card tile">
      <div class="label">Open formal objections</div>
      <div class="value">${m.openObjections}</div>
      <div class="sub">Blocking final approval on ${m.blockedAccounts} account${m.blockedAccounts === 1 ? '' : 's'} · ${m.openRequests} local requests open</div>
    </div>
    <div class="card tile">
      <div class="label">Legacy accounts → global</div>
      <div class="value">${fmtN(m.legacyCount)} <small>→</small> ${m.active}</div>
      <div class="sub">${pct(reduction)} fewer accounts across 3 legacy ERPs · ${m.unmapped} unmapped</div>
    </div>
  </div>`;
}

function pipeline(m) {
  const rows = ['draft', 'regional', 'global', 'returned', 'approved', 'rejected'].map((k) => [k, m.byStatus[k]]);
  const max = Math.max(...rows.map((r) => r[1]));
  const W = 560, L = 118, R = 40, bh = 18, gap = 12;
  const H = rows.length * (bh + gap);
  const x = (v) => ((W - L - R) * v) / max;
  const bars = rows.map(([k, v], i) => {
    const y = i * (bh + gap);
    const w = Math.max(2, x(v));
    return `<g data-tip="<b>${STATUS[k]}</b><br>${v} accounts · ${pct(v / m.total)} of all proposed" tabindex="0">
      <rect x="${L}" y="${y - 4}" width="${W - L}" height="${bh + 8}" fill="transparent"/>
      <text x="${L - 10}" y="${y + bh / 2 + 4}" text-anchor="end" font-size="12.5" fill="var(--ink-2)">${STATUS[k]}</text>
      <path d="M${L},${y} h${w - 4} a4,4 0 0 1 4,4 v${bh - 8} a4,4 0 0 1 -4,4 h${-(w - 4)} z" fill="var(--accent)"/>
      <text x="${L + w + 6}" y="${y + bh / 2 + 4}" font-size="12.5" font-weight="600" fill="var(--ink)" class="tnum">${v}</text>
    </g>`;
  }).join('');
  return `<div class="card">
    <div class="card-head"><div><h2>Approval pipeline</h2><p>Global accounts by workflow stage</p></div></div>
    <div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Accounts by workflow stage">
      <line x1="${L}" x2="${L}" y1="-4" y2="${H - gap + 4}" stroke="var(--axis)"/>${bars}</svg></div>
    <details class="tv"><summary>View as table</summary><table><tbody>${rows.map(([k, v]) => `<tr><td>${STATUS[k]}</td><td class="num">${v}</td></tr>`).join('')}</tbody></table></details>
  </div>`;
}

const SEG = [
  ['fits', 'Fits', 'var(--good)', '✓'], ['change', 'Needs change', 'var(--warn)', '!'],
  ['cant', "Can't use", 'var(--crit)', '✕'], ['pending', 'Not yet voted', 'var(--pending)', '·'],
];

function adoption(m) {
  const W = 560, L = 84, bh = 26, gap = 18;
  const H = REGIONS.length * (bh + gap) - gap;
  const rows = REGIONS.map((r, i) => {
    const t = m.regions[r];
    const total = t.fits + t.change + t.cant + t.pending;
    const y = i * (bh + gap);
    let x = L;
    const segs = SEG.map(([k, label, color], j) => {
      const w = ((W - L) * t[k]) / total;
      if (w <= 0) return '';
      const isLast = SEG.slice(j + 1).every(([kk]) => t[kk] === 0);
      const drawW = Math.max(0, w - (isLast ? 0 : 2));
      const path = isLast
        ? `M${x},${y} h${Math.max(0, drawW - 4)} a4,4 0 0 1 4,4 v${bh - 8} a4,4 0 0 1 -4,4 h${-Math.max(0, drawW - 4)} z`
        : `M${x},${y} h${drawW} v${bh} h${-drawW} z`;
      const lbl = k === 'fits' && w > 50 ? `<text x="${x + 8}" y="${y + bh / 2 + 4}" font-size="12" font-weight="600" fill="#fff" class="tnum">${pct(t[k] / total)}</text>` : '';
      const out = `<g data-tip="<b>${r} · ${label}</b><br>${fmtN(t[k])} entity votes · ${pct(t[k] / total, 1)}" tabindex="0"><path d="${path}" fill="${color}"/>${lbl}</g>`;
      x += w;
      return out;
    }).join('');
    return `<text x="0" y="${y + bh / 2 + 4}" font-size="12.5" font-weight="600" fill="var(--ink-2)">${r}</text>${segs}`;
  }).join('');
  return `<div class="card">
    <div class="card-head"><div><h2>Entity adoption by region</h2><p>Share of fit-check votes across all accounts open for feedback</p></div></div>
    <div class="legend">${SEG.map(([, label, color, ic]) => `<span><i style="background:${color}"></i>${ic} ${label}</span>`).join('')}</div>
    <div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Fit-check votes by region">${rows}</svg></div>
    <details class="tv"><summary>View as table</summary><table><thead><tr><th>Region</th>${SEG.map(([, l]) => `<th class="num">${l}</th>`).join('')}</tr></thead>
      <tbody>${REGIONS.map((r) => `<tr><td>${r}</td>${SEG.map(([k]) => `<td class="num">${fmtN(m.regions[r][k])}</td>`).join('')}</tr>`).join('')}</tbody></table></details>
  </div>`;
}

function heatmap(m) {
  const step = (c) => Math.min(6, Math.max(1, Math.ceil(c * 6)));
  return `<div class="card">
    <div class="card-head"><div><h2>Fit-check completion by entity</h2><p>Share of the chart each entity has reviewed. Lagging entities stand out; hover for detail.</p></div></div>
    ${REGIONS.map((r) => `<div class="region-label">${r}</div><div class="heat">
      ${m.entities.filter((e) => e.region === r).map((e) => `<a href="#/accounts" class="s${step(e.completion)}" style="background:var(--seq-${step(e.completion)})"
        data-tip="<b>${e.code} · ${esc(e.name)}</b><br>${esc(e.country)} · ${e.legacy === 'LOC' ? 'Local ERP' : e.legacy === 'EBS' ? 'Oracle EBS' : 'SAP ECC'}<br>${e.voted} of ${e.eligible} accounts reviewed (${pct(e.completion)})<br>${pct(e.fitRate)} rated Fits · ${e.cant} Can't use">
        <b>${e.code}</b><span>${pct(e.completion)}</span></a>`).join('')}
    </div>`).join('')}
    <div class="legend" style="margin:12px 0 0">${[1, 2, 3, 4, 5, 6].map((s) => `<span><i style="background:var(--seq-${s})"></i>${s === 1 ? '≤17%' : s === 6 ? '>83%' : ''}</span>`).join('')}</div>
  </div>`;
}

function bottlenecks(m) {
  const max = Math.max(1, ...m.approvers.map((a) => a.count));
  return `<div class="card">
    <div class="card-head"><div><h2>Approver queues</h2><p>Items waiting on each approver</p></div></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Approver</th><th>Queue</th><th class="num">Oldest</th><th class="num">Objections</th></tr></thead>
      <tbody>${m.approvers.sort((a, b) => b.count - a.count).map((a) => `<tr>
        <td><b>${esc(a.user.name)}</b><br><span class="muted small">${esc(a.user.title)}</span></td>
        <td style="min-width:110px"><div class="tnum" style="font-weight:600">${a.count}</div><div class="hbar" style="width:${(a.count / max) * 100}%"></div></td>
        <td class="num">${a.count ? `${a.oldest.toFixed(0)}d` : '—'}${a.oldest > 20 ? ' <span class="tag warn">slow</span>' : ''}</td>
        <td class="num">${a.objections}</td></tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

function contested() {
  const s = store.getState();
  const rows = s.accounts.filter(store.isVotable).map((a) => {
    const v = store.voteSummary(a.number);
    return { a, v, obj: store.openObjections(a.number).length };
  }).filter((r) => r.obj || r.v.cant || r.v.change > 3)
    .sort((x, y) => (y.obj * 10 + y.v.cant * 2 + y.v.change) - (x.obj * 10 + x.v.cant * 2 + x.v.change)).slice(0, 9);
  return `<div class="card">
    <div class="card-head"><div><h2>Most contested accounts</h2><p>Where alignment effort should go next</p></div><a href="#/accounts" class="small">Global chart →</a></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Account</th><th class="num">Objections</th><th class="num">Can't use</th><th class="num">Needs change</th></tr></thead>
      <tbody>${rows.map(({ a, v, obj }) => `<tr class="link" data-href="#/account/${a.number}">
        <td><span class="mono">${a.number}</span><br>${esc(a.name)}</td>
        <td class="num">${obj ? `<span class="tag err">${obj} open</span>` : '0'}</td><td class="num">${v.cant}</td><td class="num">${v.change}</td></tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

function activity() {
  const ev = store.getState().audit.slice(-9).reverse();
  return `<div class="card">
    <div class="card-head"><div><h2>Recent activity</h2><p>Latest workflow decisions</p></div><a href="#/audit" class="small">Full audit trail →</a></div>
    <ul class="timeline">${ev.map((e) => `<li>
      <span class="avatar" style="width:26px;height:26px;font-size:10px">${e.actor === 'system' ? '⚙' : esc(initials(store.user(e.actor).name))}</span>
      <div><div class="what">${person(e.actor)} · <b>${esc(e.action)}</b> · <a href="${e.object === 'request' ? `#/request/${e.objectId}` : e.object === 'mapping' ? '#/mapping' : `#/account/${e.objectId}`}" class="mono">${esc(e.objectId)}</a></div>
      ${e.note ? `<div class="small muted">${esc(e.note)}</div>` : ''}<div class="when">${ago(e.at)}</div></div></li>`).join('')}</ul>
  </div>`;
}

function legacyMix(m) {
  return `<div class="small muted" style="margin-top:6px">${Object.entries(m.legacyBySystem).map(([k, v]) => `${LEGACY_SYSTEMS[k].name}: ${fmtN(v)}`).join(' · ')}</div>`;
}

export function render() {
  const m = store.metrics();
  return {
    title: 'Alignment dashboard',
    html: `
    <div class="page-head"><div>
      <h1>Alignment dashboard</h1>
      <p>Wave 1 of the global chart of accounts rollout: <b>30 of ${COMPANY.totalEntities} legal entities</b> across the Americas, EMEA and APAC.</p>
    </div></div>
    <div class="stack">
      <div class="card" style="padding:14px 18px">${wave()}${legacyMix(m)}</div>
      ${tiles(m)}
      <div class="grid g-2">${pipeline(m)}${adoption(m)}</div>
      <div class="grid g-3-2">${heatmap(m)}${bottlenecks(m)}</div>
      <div class="grid g-2">${contested()}${activity()}</div>
    </div>`,
    bind(root) {
      root.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));
    },
  };
}
