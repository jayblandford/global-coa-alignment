import * as store from '../store.js';
import { esc, chip, ago, pct, act } from '../ui.js';

let tab = 'accounts';

function fitBar(acct) {
  const v = store.voteSummary(acct);
  const t = v.fits + v.change + v.cant + v.pending;
  return `<div style="display:flex;height:6px;border-radius:3px;overflow:hidden;gap:1px;min-width:90px;margin-top:4px" data-tip="<b>Fit-check</b><br>✓ ${v.fits} fits · ! ${v.change} needs change<br>✕ ${v.cant} can't use · ${v.pending} not voted">
    <i style="flex:${v.fits};background:var(--good)"></i><i style="flex:${v.change};background:var(--warn)"></i><i style="flex:${v.cant};background:var(--crit)"></i><i style="flex:${v.pending};background:var(--pending)"></i></div>
    <div class="small muted tnum">${pct(v.fits / t)} fits</div>`;
}

function accountRows(u, list) {
  if (!list.length) return `<div class="empty">Nothing waiting on you here. 🎉</div>`;
  return `<div class="table-wrap"><table>
    <thead><tr><th>Account</th><th>Group</th><th>Status</th><th>Entity feedback</th><th>Waiting</th><th></th></tr></thead>
    <tbody>${list.map((a) => {
      const obj = store.openObjections(a.number).length;
      let actions = '';
      if (u.role === 'analyst') actions = `<button class="btn sm" data-vote="${a.number}">✓ Fits</button> <a class="btn sm" href="#/account/${a.number}">Other…</a>`;
      if (u.role === 'controller') actions = `<button class="btn sm primary" data-rec="${a.number}">Recommend</button>`;
      if (u.role === 'head') actions = `<button class="btn sm good" data-approve="${a.number}" ${obj ? 'disabled title="Resolve objections first"' : ''}>Approve</button>`;
      return `<tr>
        <td><a href="#/account/${a.number}" class="mono">${a.number}</a><br>${esc(a.name)}${obj ? ` <span class="tag err">${obj} objection${obj > 1 ? 's' : ''}</span>` : ''}</td>
        <td class="small">${esc(a.group)}</td><td>${chip(a.status)}</td><td>${fitBar(a.number)}</td>
        <td class="small muted">${ago(store.lastEventAt(a.number))}</td>
        <td style="white-space:nowrap;text-align:right">${actions}</td></tr>`;
    }).join('')}</tbody></table></div>`;
}

function requestRows(u, list) {
  if (!list.length) return `<div class="empty">No requests waiting on you.</div>`;
  return `<div class="table-wrap"><table>
    <thead><tr><th>Request</th><th>Entity</th><th>Type</th><th>Status</th><th>Submitted</th></tr></thead>
    <tbody>${list.map((q) => `<tr class="link" data-href="#/request/${q.id}">
      <td><span class="mono">${q.id}</span><br>${esc(q.name)}</td><td>${q.entity}</td>
      <td class="small">${q.type === 'local' ? 'Country account' : 'New global account'}${q.statutory ? ' <span class="tag">statutory</span>' : ''}</td>
      <td>${chip(q.status)}</td><td class="small muted">${ago(q.at)}</td></tr>`).join('')}</tbody></table></div>`;
}

function objectionRows(list) {
  if (!list.length) return `<div class="empty">No open objections.</div>`;
  return `<div class="table-wrap"><table>
    <thead><tr><th>Objection</th><th>Account</th><th>Entity</th><th>Raised</th></tr></thead>
    <tbody>${list.map((o) => `<tr class="link" data-href="#/account/${o.account}">
      <td><span class="mono">${o.id}</span> ${chip('open')}<div class="small" style="max-width:60ch">${esc(o.text)}</div></td>
      <td><span class="mono">${o.account}</span><br><span class="small">${esc(store.account(o.account)?.name)}</span></td>
      <td>${o.entity}</td><td class="small muted">${ago(o.at)}</td></tr>`).join('')}</tbody></table></div>`;
}

const INTRO = {
  analyst: (u) => `As <b>${esc(u.entity)}</b>'s analyst, tell the program whether each global account works for your entity. One click for <b>Fits</b>; anything else needs a reason. Use a formal objection for issues that must block approval.`,
  controller: (u) => `Accounts and local requests waiting on the <b>${esc(u.region)}</b> review. An account moves to global review once all three regions recommend it.`,
  head: () => `Accounts all regions have recommended, plus requests escalated for your decision. Open objections block approval until they are resolved.`,
};

export function render(_p, u) {
  const ib = store.inboxFor(u);
  const tabs = [
    ['accounts', u.role === 'analyst' ? 'Awaiting your fit-check' : 'Accounts', ib.accounts.length],
    ['requests', u.role === 'analyst' ? 'Returned to you' : 'Requests', ib.requests.length],
    ['objections', 'Open objections', ib.objections.length],
  ];
  const clean = ib.accounts.filter((a) => !store.openObjections(a.number).length);
  const bulk = u.role === 'controller' && clean.length > 1 ? `<button class="btn" id="bulk">Recommend ${clean.length} accounts without objections</button>`
    : u.role === 'head' && clean.length > 1 ? `<button class="btn" id="bulk">Approve ${clean.length} accounts without objections</button>`
      : u.role === 'analyst' && ib.accounts.length ? `<a class="btn primary" href="#/requests">+ Request a local account</a>` : '';
  const body = tab === 'accounts' ? accountRows(u, ib.accounts) : tab === 'requests' ? requestRows(u, ib.requests) : objectionRows(ib.objections);
  return {
    title: 'My inbox',
    html: `<div class="page-head"><div><h1>My inbox</h1><p>${INTRO[u.role](u)}</p></div>${bulk}</div>
      <div class="filters"><div class="seg" role="tablist">${tabs.map(([k, l, n]) => `<button role="tab" class="${tab === k ? 'on' : ''}" data-tab="${k}">${l} · ${n}</button>`).join('')}</div></div>
      <div class="card">${body}</div>`,
    bind(root, rerender) {
      root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; rerender(); }));
      root.querySelectorAll('[data-vote]').forEach((b) => b.addEventListener('click', () => act(() => store.vote(b.dataset.vote, 'fits'), `${b.dataset.vote} marked Fits for ${u.entity}`)));
      root.querySelectorAll('[data-rec]').forEach((b) => b.addEventListener('click', () => act(() => store.recommendAccount(b.dataset.rec), `${b.dataset.rec} recommended`)));
      root.querySelectorAll('[data-approve]').forEach((b) => b.addEventListener('click', () => act(() => store.approveAccount(b.dataset.approve), `${b.dataset.approve} approved`)));
      root.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));
      root.querySelector('#bulk')?.addEventListener('click', (e) => {
        if (e.currentTarget.tagName === 'A') return;
        const n = clean.length;
        act(() => clean.forEach((a) => (u.role === 'head' ? store.approveAccount(a.number, 'Bulk approval – no open objections') : store.recommendAccount(a.number, 'Bulk recommendation – no open objections'))),
          `${n} accounts ${u.role === 'head' ? 'approved' : 'recommended'}`);
      });
    },
  };
}
