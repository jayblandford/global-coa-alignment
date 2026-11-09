import * as store from '../store.js';
import { esc, fmtN, act, pct } from '../ui.js';
import { LEGACY_SYSTEMS } from '../data/reference.js';
import { mappingConflicts, suggestMapping } from '../rules.js';

const f = { q: '', system: '', type: '', issues: false, limit: 120 };

export function analyse() {
  const s = store.getState();
  const byNumber = Object.fromEntries(s.accounts.map((a) => [a.number, a]));
  const groups = {};
  for (const l of s.legacy) if (l.targets.length === 1) (groups[`${l.system}|${l.targets[0]}`] ||= []).push(l);
  return s.legacy.map((l) => {
    const sib = l.targets.length === 1 ? groups[`${l.system}|${l.targets[0]}`] : [];
    const type = !l.targets.length ? 'Unmapped' : l.targets.length > 1 ? '1:N' : sib.length > 1 ? 'N:1' : '1:1';
    return { l, type, conflicts: mappingConflicts(l, byNumber, sib) };
  });
}

function rowsHtml(rows, u) {
  const canEdit = u.role !== 'analyst';
  const accts = store.getState().accounts;
  return rows.slice(0, f.limit).map(({ l, type, conflicts }) => {
    let action = '';
    if (canEdit && type === 'Unmapped') {
      action = suggestMapping(l.name, accts).map((x) => `<button class="btn sm" data-map="${l.id}" data-to="${x.account.number}" data-tip="${esc(x.account.name)} · ${pct(x.score)} match">→ ${x.account.number}</button>`).join(' ') || '<span class="small muted">No suggestion</span>';
    } else if (canEdit && conflicts.some((c) => c.level === 'error')) action = `<button class="btn sm" data-align="${l.id}" data-tip="Activate open-item management in the legacy account, or load the balance through the sub-ledger">Remediate</button>`;
    else if (canEdit && l.status === 'proposed') action = `<button class="btn sm" data-confirm="${l.id}">Confirm</button>`;
    return `<tr>
      <td class="small">${LEGACY_SYSTEMS[l.system].name}</td>
      <td><span class="mono">${esc(l.number)}</span><br><span class="small">${esc(l.name)}</span></td>
      <td><span class="tag ${type === 'Unmapped' ? 'err' : ''}">${type}</span></td>
      <td>${l.targets.map((t) => `<a class="mono" href="#/account/${t}">${t}</a> <span class="small">${esc(store.account(t)?.name || '')}</span>`).join('<br>') || '—'}</td>
      <td class="small">${conflicts.map((c) => `<div><span class="tag ${c.level === 'error' ? 'err' : 'warn'}">${c.level === 'error' ? '✕' : '!'}</span> ${esc(c.text)}</div>`).join('')}</td>
      <td class="small">${l.status === 'confirmed' ? '✓ Confirmed' : l.status === 'proposed' ? 'Proposed' : 'Unmapped'}</td>
      <td style="white-space:nowrap">${action}</td></tr>`;
  }).join('');
}

function filtered(all) {
  const q = f.q.toLowerCase();
  return all.filter(({ l, type, conflicts }) => (!f.system || l.system === f.system) && (!f.type || type === f.type)
    && (!f.issues || conflicts.length || type === 'Unmapped')
    && (!q || l.number.toLowerCase().includes(q) || l.name.toLowerCase().includes(q) || l.targets.some((t) => t.includes(q))));
}

function table(u) {
  const rows = filtered(analyse());
  return `<div class="small muted" style="margin-bottom:8px">${fmtN(rows.length)} legacy accounts${rows.length > f.limit ? ` · showing first ${f.limit}` : ''}</div>
    <div class="table-wrap"><table><thead><tr><th>Source</th><th>Legacy account</th><th>Type</th><th>Global target</th><th>Checks</th><th>Status</th><th></th></tr></thead>
    <tbody>${rowsHtml(rows, u) || '<tr><td colspan="7" class="empty">No legacy accounts match.</td></tr>'}</tbody></table></div>
    ${rows.length > f.limit ? '<button class="btn" id="more" style="margin-top:12px">Show more</button>' : ''}`;
}

export function render(_p, u) {
  const all = analyse();
  const count = (t) => all.filter((x) => x.type === t).length;
  const conflicts = all.filter((x) => x.conflicts.some((c) => c.level === 'error')).length;
  const confirmed = all.filter((x) => x.l.status === 'confirmed').length;
  return {
    title: 'Legacy mapping',
    html: `<div class="page-head"><div><h1>Legacy → global mapping</h1>
      <p>Every legacy account from SAP ECC, Oracle EBS and the local ERPs is mapped to the global chart. The checks catch the merges that break clearing and sub-ledger reconciliation <i>before</i> data migration, not during it.</p></div></div>
      <div class="stack">
        <div class="grid g-4">
          <div class="card tile"><div class="label">Legacy accounts in Wave 1</div><div class="value">${fmtN(all.length)}</div><div class="sub">${pct(confirmed / all.length)} mappings confirmed</div></div>
          <div class="card tile"><div class="label">Mapping types</div><div class="value" style="font-size:20px">${count('1:1')} · ${count('N:1')} · ${count('1:N')}</div><div class="sub">1:1 renames · N:1 merges · 1:N splits</div></div>
          <div class="card tile"><div class="label">Attribute conflicts</div><div class="value">${conflicts}</div><div class="sub">Open-item or reconciliation mismatches</div></div>
          <div class="card tile"><div class="label">Unmapped</div><div class="value">${count('Unmapped')}</div><div class="sub">Suspense, sundry and clearing accounts</div></div>
        </div>
        <div class="card">
          <div class="filters">
            <input type="search" id="q" placeholder="Search legacy or global account" value="${esc(f.q)}" aria-label="Search">
            <select id="sys" aria-label="Source system"><option value="">All systems</option>${Object.values(LEGACY_SYSTEMS).map((s) => `<option value="${s.id}" ${f.system === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
            <select id="type" aria-label="Mapping type"><option value="">All types</option>${['1:1', 'N:1', '1:N', 'Unmapped'].map((t) => `<option ${f.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
            <label style="display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" id="iss" ${f.issues ? 'checked' : ''}> Issues only</label>
          </div>
          ${u.role === 'analyst' ? '<div class="note" style="margin-bottom:12px">Read-only for analysts. Regional controllers and the Global Head confirm mappings.</div>' : ''}
          <div id="tbl">${table(u)}</div>
        </div>
      </div>`,
    bind(root, rerender) {
      const tbl = root.querySelector('#tbl');
      const wire = () => {
        tbl.querySelectorAll('[data-map]').forEach((b) => b.addEventListener('click', () => act(() => store.setMapping(b.dataset.map, [b.dataset.to], 'confirmed'), `Mapped to ${b.dataset.to}`)));
        tbl.querySelectorAll('[data-confirm]').forEach((b) => b.addEventListener('click', () => {
          const l = store.getState().legacy.find((x) => x.id === b.dataset.confirm);
          act(() => store.setMapping(l.id, l.targets, 'confirmed'), 'Mapping confirmed');
        }));
        tbl.querySelectorAll('[data-align]').forEach((b) => b.addEventListener('click', () => act(() => store.alignMapping(b.dataset.align), 'Conflict remediated and mapping confirmed')));
        tbl.querySelector('#more')?.addEventListener('click', () => { f.limit += 200; upd(); });
      };
      const upd = () => { tbl.innerHTML = table(u); wire(); };
      root.querySelector('#q').addEventListener('input', (e) => { f.q = e.target.value; f.limit = 120; upd(); });
      root.querySelector('#sys').addEventListener('change', (e) => { f.system = e.target.value; upd(); });
      root.querySelector('#type').addEventListener('change', (e) => { f.type = e.target.value; upd(); });
      root.querySelector('#iss').addEventListener('change', (e) => { f.issues = e.target.checked; upd(); });
      wire();
    },
  };
}
