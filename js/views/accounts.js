import * as store from '../store.js';
import { esc, chip, pct, STATUS } from '../ui.js';
import { RANGES } from '../data/reference.js';

const f = { q: '', group: '', status: '' };

function rows() {
  const q = f.q.toLowerCase();
  return store.getState().accounts.filter((a) =>
    (!q || a.number.includes(q) || a.name.toLowerCase().includes(q)) &&
    (!f.group || a.group === f.group) && (!f.status || a.status === f.status));
}

function table() {
  const list = rows();
  let lastGroup = null;
  return `<div class="small muted" style="margin-bottom:8px">${list.length} accounts</div>
  <div class="table-wrap"><table>
    <thead><tr><th>Account</th><th>Name</th><th>Type</th><th>Recon</th><th>Open item</th><th>Status</th><th class="num">Fits</th><th class="num">Objections</th></tr></thead>
    <tbody>${list.map((a) => {
      const s = store.voteSummary(a.number);
      const voted = s.fits + s.change + s.cant;
      const obj = store.openObjections(a.number).length;
      const head = a.group !== lastGroup ? `<tr><td colspan="8" style="background:var(--surface-2);font-weight:650;font-size:12px">${esc(a.group)}</td></tr>` : '';
      lastGroup = a.group;
      return `${head}<tr class="link" data-href="#/account/${a.number}">
        <td class="mono">${a.number}</td><td>${esc(a.name)}</td><td class="small">${a.glType}</td><td class="small">${a.recon || ''}</td>
        <td class="small">${a.openItem ? 'Yes' : ''}</td><td>${chip(a.status)}</td>
        <td class="num small">${voted ? pct(s.fits / voted) : '—'}</td><td class="num">${obj ? `<span class="tag err">${obj}</span>` : ''}</td></tr>`;
    }).join('') || '<tr><td colspan="8" class="empty">No accounts match.</td></tr>'}</tbody></table></div>`;
}

export function render() {
  const groups = [...new Set(RANGES.map((r) => r.label))];
  return {
    title: 'Global chart of accounts',
    html: `<div class="page-head"><div><h1>Global chart of accounts · JGCA</h1>
      <p>One operational chart for every company code, 8-digit range-based numbering. Country charts carry statutory numbers alongside. Analysis lives in dimensions (profit center, segment, functional area), not in extra accounts.</p></div></div>
      <div class="card">
        <div class="filters">
          <input type="search" id="q" placeholder="Search number or name" value="${esc(f.q)}" aria-label="Search accounts">
          <select id="group" aria-label="Group"><option value="">All groups</option>${groups.map((g) => `<option ${f.group === g ? 'selected' : ''}>${g}</option>`).join('')}</select>
          <select id="status" aria-label="Status"><option value="">All statuses</option>${Object.entries(STATUS).slice(0, 6).map(([k, l]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </div>
        <div id="tbl">${table()}</div>
      </div>`,
    bind(root) {
      const tbl = root.querySelector('#tbl');
      const wire = () => tbl.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));
      const upd = () => { tbl.innerHTML = table(); wire(); };
      root.querySelector('#q').addEventListener('input', (e) => { f.q = e.target.value; upd(); });
      root.querySelector('#group').addEventListener('change', (e) => { f.group = e.target.value; upd(); });
      root.querySelector('#status').addEventListener('change', (e) => { f.status = e.target.value; upd(); });
      wire();
    },
  };
}
