import * as store from '../store.js';
import { esc, dateTime, person, downloadCSV, fmtN } from '../ui.js';

const f = { q: '', object: '', limit: 150 };

function rows() {
  const q = f.q.toLowerCase();
  return store.getState().audit.slice().reverse().filter((e) => (!f.object || e.object === f.object)
    && (!q || `${e.objectId} ${e.action} ${e.note} ${store.user(e.actor).name}`.toLowerCase().includes(q)));
}

function table() {
  const list = rows();
  return `<div class="small muted" style="margin-bottom:8px">${fmtN(list.length)} events${list.length > f.limit ? ` · showing latest ${f.limit}` : ''}</div>
    <div class="table-wrap"><table><thead><tr><th>When</th><th>Who</th><th>Object</th><th>Action</th><th>Detail</th></tr></thead>
    <tbody>${list.slice(0, f.limit).map((e) => `<tr>
      <td class="small" style="white-space:nowrap">${dateTime(e.at)}</td><td class="small">${person(e.actor, true)}</td>
      <td><a class="mono" href="${e.object === 'request' ? `#/request/${e.objectId}` : e.object === 'mapping' ? '#/mapping' : `#/account/${e.objectId}`}">${esc(e.objectId)}</a></td>
      <td><b>${esc(e.action)}</b>${e.from || e.to ? `<div class="small muted">${esc(e.from || '—')} → ${esc(e.to || '—')}</div>` : ''}</td>
      <td class="small">${esc(e.note)}</td></tr>`).join('')}</tbody></table></div>
    ${list.length > f.limit ? '<button class="btn" id="more" style="margin-top:12px">Show more</button>' : ''}`;
}

export function render() {
  return {
    title: 'Audit trail',
    html: `<div class="page-head"><div><h1>Audit trail</h1>
      <p>Every proposal, vote, objection, decision and mapping change, with who, when and why. Append-only, so SOX and external auditors can trace any account in the final chart back to its approval.</p></div>
      <button class="btn" id="csv">Download CSV</button></div>
      <div class="card"><div class="filters">
        <input type="search" id="q" placeholder="Search account, person, action" value="${esc(f.q)}" aria-label="Search audit trail">
        <select id="obj" aria-label="Object type"><option value="">All objects</option>${['account', 'request', 'mapping'].map((o) => `<option ${f.object === o ? 'selected' : ''}>${o}</option>`).join('')}</select>
      </div><div id="tbl">${table()}</div></div>`,
    bind(root) {
      const tbl = root.querySelector('#tbl');
      const upd = () => { tbl.innerHTML = table(); tbl.querySelector('#more')?.addEventListener('click', () => { f.limit += 300; upd(); }); };
      root.querySelector('#q').addEventListener('input', (e) => { f.q = e.target.value; upd(); });
      root.querySelector('#obj').addEventListener('change', (e) => { f.object = e.target.value; upd(); });
      tbl.querySelector('#more')?.addEventListener('click', () => { f.limit += 300; upd(); });
      root.querySelector('#csv').addEventListener('click', () => downloadCSV('jib-coa-audit-trail.csv', [
        ['Timestamp', 'Actor', 'Role', 'Object', 'Object ID', 'Action', 'From', 'To', 'Note'],
        ...rows().map((e) => [new Date(e.at).toISOString(), store.user(e.actor).name, store.user(e.actor).title, e.object, e.objectId, e.action, e.from, e.to, e.note]),
      ]));
    },
  };
}
