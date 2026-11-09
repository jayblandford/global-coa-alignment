import * as store from '../store.js';
import { esc, chip, ago, dateTime, act, person, pct, initials } from '../ui.js';
import { RANGES } from '../data/reference.js';
import { requestChecks } from '../rules.js';

let filter = 'open';
const draft = { type: 'local', name: '', parent: '', group: 'Operating expenses', statutory: false, just: '' };

function checksHtml(q) {
  const c = requestChecks(q, store.getState().accounts);
  const items = [];
  if (c.dims.length) {
    items.push(`<div class="note ${q.statutory ? 'warn' : 'err'}"><b>Looks like a reporting dimension, not an account.</b> ${c.dims.map((d) => `“${esc(d.term)}” → use <b>${esc(d.dimension)}</b>`).join('; ')}.
      ${q.statutory ? 'Marked statutory, so reviewers will check the legal basis.' : 'The Universal Journal already carries this on every line item.'}</div>`);
  }
  if (c.dups.length) {
    items.push(`<div class="note warn"><b>Similar global accounts exist:</b> ${c.dups.map((d) => `<a href="#/account/${d.account.number}" class="mono">${d.account.number}</a> ${esc(d.account.name)} (${pct(d.score)} match)`).join('; ')}</div>`);
  }
  if (q.statutory) items.push('<div class="note"><b>Statutory requirement.</b> If approved, the account goes in the country chart and maps to its global parent, so group reporting is unaffected.</div>');
  if (!items.length && (q.name || '').length > 3) items.push('<div class="note ok"><b>No issues found.</b> Not a dimension, no duplicate.</div>');
  return `<div class="stack" style="gap:8px">${items.join('')}</div>
    <div class="small muted" style="margin-top:8px">Smart checks are rule-based today and designed to be swapped for a Claude review.</div>`;
}

function form() {
  const accts = store.getState().accounts.filter((a) => a.status !== 'rejected');
  return `<div class="card"><div class="card-head"><div><h2>New request</h2><p>Checked automatically as you type</p></div></div>
    <div class="grid g-2">
      <div class="stack" style="gap:10px">
        <div class="seg"><button data-t="local" class="${draft.type === 'local' ? 'on' : ''}">Country account</button><button data-t="global" class="${draft.type === 'global' ? 'on' : ''}">New global account</button></div>
        <label class="f">Account name<input type="text" id="r-name" value="${esc(draft.name)}" placeholder="e.g. IVA acreditable pendiente de pago"></label>
        ${draft.type === 'local'
    ? `<label class="f">Maps to global parent<select id="r-parent"><option value="">Choose…</option>${accts.map((a) => `<option value="${a.number}" ${draft.parent === a.number ? 'selected' : ''}>${a.number} ${esc(a.name)}</option>`).join('')}</select></label>`
    : `<label class="f">Account group<select id="r-group">${[...new Set(RANGES.map((r) => r.label))].map((g) => `<option ${draft.group === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>`}
        <label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="r-stat" ${draft.statutory ? 'checked' : ''}> Required by local statute, tax or regulator</label>
        <label class="f">Business justification<textarea id="r-just" placeholder="Cite the rule or reporting need">${esc(draft.just)}</textarea></label>
        <button class="btn primary" id="r-go" style="justify-self:start">Submit to regional controller</button>
      </div>
      <div><h3 style="margin-bottom:8px">Smart checks</h3><div id="r-checks">${checksHtml(draft)}</div></div>
    </div></div>`;
}

function list(u) {
  const all = store.getState().requests.slice().sort((a, b) => b.updatedAt - a.updatedAt);
  const shown = all.filter((q) => filter === 'all' || (filter === 'open' ? ['regional', 'global'].includes(q.status) : filter === 'mine' ? q.entity === u.entity : !['regional', 'global'].includes(q.status)));
  return `<div class="card">
    <div class="filters"><div class="seg">${[['open', 'Open'], ['closed', 'Decided / returned'], ...(u.role === 'analyst' ? [['mine', `${u.entity}`]] : []), ['all', 'All']]
      .map(([k, l]) => `<button class="${filter === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div></div>
    <div class="table-wrap"><table><thead><tr><th>Request</th><th>Entity</th><th>Type</th><th>Check</th><th>Status</th><th>Updated</th></tr></thead>
    <tbody>${shown.map((q) => { const v = requestChecks(q, store.getState().accounts).verdict; return `<tr class="link" data-href="#/request/${q.id}">
      <td><span class="mono">${q.id}</span><br>${esc(q.name)}</td><td>${q.entity}</td>
      <td class="small">${q.type === 'local' ? 'Country account' : 'New global account'}${q.statutory ? ' <span class="tag">statutory</span>' : ''}</td>
      <td>${v === 'dimension' ? '<span class="tag err">dimension?</span>' : v === 'duplicate' ? '<span class="tag warn">duplicate?</span>' : '<span class="tag">ok</span>'}</td>
      <td>${chip(q.status)}</td><td class="small muted">${ago(q.updatedAt)}</td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">No requests.</td></tr>'}</tbody></table></div></div>`;
}

function detail(q, u) {
  const ent = store.entity(q.entity);
  const ev = store.getState().audit.filter((e) => e.objectId === q.id).slice().reverse();
  let actions = '';
  if (u.role === 'controller' && ent.region === u.region && q.status === 'regional') actions = `<div class="btns"><button class="btn primary" data-d="recommend">Recommend to Global Head</button><button class="btn" data-d="return">Return to entity</button></div>`;
  if (u.role === 'head' && q.status === 'global') actions = `<div class="btns"><button class="btn good" data-d="approve">✓ Approve</button><button class="btn" data-d="return">Return</button><button class="btn danger" data-d="reject">✕ Reject</button></div>`;
  return `<div class="page-head"><div><a href="#/requests" class="small">← All requests</a>
      <h1 style="margin-top:6px"><span class="mono" style="font-size:20px">${q.id}</span> · ${esc(q.name)}</h1>
      <p>${chip(q.status)} &nbsp;${q.type === 'local' ? 'Country chart account' : 'New global account'} requested by ${person(q.by)} for <b>${q.entity}</b> · ${esc(ent.name)}</p></div></div>
    <div class="grid g-2-1"><div class="stack">
      <div class="card"><div class="card-head"><h2>Request</h2></div><dl class="kv">
        <dt>Justification</dt><dd>${esc(q.just)}</dd>
        ${q.parent ? `<dt>Global parent</dt><dd><a class="mono" href="#/account/${q.parent}">${q.parent}</a> ${esc(store.account(q.parent)?.name)}</dd>` : ''}
        ${q.group ? `<dt>Account group</dt><dd>${esc(q.group)}</dd>` : ''}
        <dt>Statutory</dt><dd>${q.statutory ? 'Yes' : 'No'}</dd>
        <dt>Country chart</dt><dd>${esc(ent.countryChart || 'None (uses global chart only)')}</dd>
        ${q.createdAccount ? `<dt>Created account</dt><dd><a class="mono" href="#/account/${q.createdAccount}">${q.createdAccount}</a></dd>` : ''}
      </dl></div>
      <div class="card"><div class="card-head"><h2>Smart checks</h2></div>${checksHtml(q)}</div>
    </div><div class="stack">
      ${actions ? `<div class="card stack" style="gap:10px"><h3>Your decision</h3>${actions}<label class="f">Note<textarea id="d-note" placeholder="Required for return or reject"></textarea></label></div>` : ''}
      <div class="card"><div class="card-head"><h2>History</h2></div><ul class="timeline">${ev.map((e) => `<li><span class="avatar" style="width:26px;height:26px;font-size:10px">${esc(initials(store.user(e.actor).name))}</span>
        <div><div class="what"><b>${esc(e.action)}</b> · ${person(e.actor, true)}</div>${e.note ? `<div class="small">${esc(e.note)}</div>` : ''}<div class="when">${dateTime(e.at)}</div></div></li>`).join('')}</ul></div>
    </div></div>`;
}

export function render([id], u) {
  if (id) {
    const q = store.getState().requests.find((x) => x.id === id);
    if (!q) return { title: 'Not found', html: '<div class="empty">Request not found.</div>' };
    return {
      title: `${q.id} ${q.name}`, html: detail(q, u),
      bind(root) {
        root.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => act(() => store.decideRequest(q.id, b.dataset.d, root.querySelector('#d-note')?.value || ''), 'Decision recorded')));
      },
    };
  }
  return {
    title: 'Requests',
    html: `<div class="page-head"><div><h1>Local & new account requests</h1>
      <p>Entities ask for country-chart accounts or new global accounts here. Every request is screened for <b>“is this an account or a dimension?”</b> before anyone reviews it. That one check is what keeps the chart small.</p></div></div>
      <div class="stack">${u.role === 'analyst' ? form() : ''}${list(u)}</div>`,
    bind(root, rerender) {
      root.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; rerender(); }));
      root.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));
      if (u.role !== 'analyst') return;
      const live = () => { root.querySelector('#r-checks').innerHTML = checksHtml(draft); };
      root.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { draft.type = b.dataset.t; rerender(); }));
      root.querySelector('#r-name').addEventListener('input', (e) => { draft.name = e.target.value; live(); });
      root.querySelector('#r-just').addEventListener('input', (e) => { draft.just = e.target.value; live(); });
      root.querySelector('#r-stat').addEventListener('change', (e) => { draft.statutory = e.target.checked; live(); });
      root.querySelector('#r-parent')?.addEventListener('change', (e) => { draft.parent = e.target.value; });
      root.querySelector('#r-group')?.addEventListener('change', (e) => { draft.group = e.target.value; });
      root.querySelector('#r-go').addEventListener('click', () => {
        if (draft.type === 'local' && !draft.parent) { act(() => { throw new Error('Choose the global parent account.'); }); return; }
        let id;
        if (act(() => { id = store.submitRequest(draft); }, 'Request submitted')) {
          Object.assign(draft, { name: '', parent: '', just: '', statutory: false });
          location.hash = `#/request/${id}`;
        }
      });
    },
  };
}
