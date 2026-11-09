import * as store from '../store.js';
import { esc, chip, ago, dateTime, pct, act, voteBadge, person, STATUS, initials } from '../ui.js';
import { GL_TYPES, RECON_TYPES, REGIONS } from '../data/reference.js';
import { rangeCheck } from '../rules.js';

let voteFilter = 'all';

function stepper(a) {
  const regionalDone = REGIONS.filter((r) => a.regional[r] === 'recommended').length;
  const stage = { draft: 0, regional: 1, global: 2, returned: 1, approved: 3, rejected: 3 }[a.status];
  const cls = (i) => (a.status === 'returned' && i === 1) || (a.status === 'rejected' && i === 3) ? 'bad' : i < stage || (i === 3 && a.status === 'approved') ? 'done' : i === stage ? 'now' : '';
  return `<div class="steps">
    <div class="step ${cls(0)}"><b>Proposed</b><span>${ago(a.createdAt)}</span></div>
    <div class="step ${cls(1)}"><b>Regional review</b><span>${a.status === 'returned' ? 'Returned for rework' : `${regionalDone} of 3 regions recommended`}</span></div>
    <div class="step ${cls(2)}"><b>Global review</b><span>${a.status === 'global' ? `${store.openObjections(a.number).length} open objection(s)` : stage > 2 ? 'Complete' : 'Waiting'}</span></div>
    <div class="step ${cls(3)}"><b>${a.status === 'rejected' ? 'Rejected' : 'Approved'}</b><span>${stage === 3 ? STATUS[a.status] : 'Global Head decides'}</span></div>
  </div>`;
}

function actionPanel(a, u) {
  const v = store.votesFor(a.number)[u.entity];
  const objs = store.openObjections(a.number);
  if (u.role === 'analyst') {
    if (!store.isVotable(a)) return `<div class="note">This account is ${STATUS[a.status].toLowerCase()} and not open for fit-check.</div>`;
    return `<div class="stack" style="gap:12px">
      <div><h3>Your fit-check for ${esc(u.entity)}</h3>${v ? `<div class="small" style="margin-top:4px">Current vote: ${voteBadge(v.v)} ${v.reason ? `· ${esc(v.reason)}` : ''}</div>` : '<div class="small muted">You have not voted yet.</div>'}</div>
      <div class="btns">
        <button class="btn ${v?.v === 'fits' ? 'primary' : ''}" data-v="fits">✓ Fits</button>
        <button class="btn ${v?.v === 'change' ? 'primary' : ''}" data-v="change">! Needs change</button>
        <button class="btn ${v?.v === 'cant' ? 'primary' : ''}" data-v="cant">✕ Can't use</button>
      </div>
      <label class="f">Reason (required unless Fits)<textarea id="reason" placeholder="e.g. Local GAAP requires a separate presentation of…"></textarea></label>
      <details><summary class="small" style="cursor:pointer;color:var(--crit-ink);font-weight:600">Raise a formal objection (blocks approval)</summary>
        <div class="stack" style="gap:8px;margin-top:8px"><textarea id="obj-text" placeholder="State the statutory, tax or operational reason this account cannot be approved as designed."></textarea>
        <button class="btn danger" id="obj-go" style="justify-self:start">Raise objection</button></div></details>
    </div>`;
  }
  if (u.role === 'controller') {
    const pending = a.status === 'regional' && a.regional[u.region] === 'pending';
    return `<div class="stack" style="gap:10px">
      <h3>${esc(u.region)} regional review</h3>
      ${pending ? `<div class="btns"><button class="btn primary" id="rec">Recommend</button><button class="btn" id="ret">Return for rework</button></div>
        <label class="f">Note<textarea id="note" placeholder="Required when returning"></textarea></label>`
        : `<div class="note">${a.status === 'regional' ? `${esc(u.region)} has already recommended this account.` : `No regional action needed – status is ${STATUS[a.status].toLowerCase()}.`}</div>`}
      ${objs.some((o) => store.entity(o.entity).region === u.region) ? '<div class="note warn">You can resolve objections from your region below.</div>' : ''}
    </div>`;
  }
  // head
  const canDecide = a.status === 'global';
  return `<div class="stack" style="gap:10px">
    <h3>Global decision</h3>
    ${canDecide ? `${objs.length ? `<div class="note err"><b>${objs.length} open objection(s)</b> must be resolved before approval.</div>` : '<div class="note ok">All regions recommended and no open objections.</div>'}
      <div class="btns"><button class="btn good" id="approve" ${objs.length ? 'disabled' : ''}>✓ Approve</button><button class="btn" id="ret">Return</button><button class="btn danger" id="reject">✕ Reject</button></div>
      <label class="f">Decision note<textarea id="note" placeholder="Required for return or reject"></textarea></label>`
      : ['returned', 'draft'].includes(a.status) ? `<div class="note">This account is ${STATUS[a.status].toLowerCase()}. Update the design offline, then resubmit.</div><button class="btn primary" id="resubmit" style="justify-self:start">Resubmit for regional review</button>`
        : `<div class="note">${a.status === 'regional' ? 'Waiting on regional controllers.' : `Decision recorded: ${STATUS[a.status]}.`}</div>`}
  </div>`;
}

function attributes(a) {
  const warn = rangeCheck(a.number, a.glType);
  return `<dl class="kv">
    <dt>G/L account type</dt><dd>${a.glType} · ${GL_TYPES[a.glType]}</dd>
    <dt>Group / range</dt><dd>${esc(a.group)} (${esc(a.statement)})</dd>
    <dt>Short text</dt><dd class="mono">${esc(a.shortText)}</dd>
    <dt>Reconciliation acct</dt><dd>${a.recon ? `${a.recon} · ${RECON_TYPES[a.recon]}` : '—'}</dd>
    <dt>Open item mgmt</dt><dd>${a.openItem ? 'Yes' : 'No'}</dd>
    <dt>Line item display</dt><dd>${a.lineItem ? 'Yes' : 'No'}</dd>
    <dt>Tax category</dt><dd>${a.taxCategory || '—'}</dd>
    <dt>Field status group</dt><dd class="mono">${a.fieldStatus}</dd>
    <dt>Functional area</dt><dd>${a.functionalArea ? 'Required (cost of sales accounting)' : 'Not required'}</dd>
    <dt>Group account / FS item</dt><dd class="mono">${a.fsItem}</dd>
  </dl>${warn ? `<div class="note err" style="margin-top:10px">${esc(warn)}</div>` : ''}`;
}

function votesTable(a) {
  const v = store.votesFor(a.number);
  const s = store.voteSummary(a.number);
  const ents = store.getState().entities.filter((e) => voteFilter === 'all' || (v[e.code]?.v || 'pending') === voteFilter);
  return `<div class="filters"><div class="seg">${[['all', 'All 30'], ['fits', `Fits · ${s.fits}`], ['change', `Needs change · ${s.change}`], ['cant', `Can't use · ${s.cant}`], ['pending', `Not voted · ${s.pending}`]]
    .map(([k, l]) => `<button class="${voteFilter === k ? 'on' : ''}" data-vf="${k}">${l}</button>`).join('')}</div></div>
    <div class="table-wrap"><table><thead><tr><th>Entity</th><th>Region</th><th>Vote</th><th>Reason</th><th>When</th></tr></thead>
    <tbody>${ents.map((e) => { const x = v[e.code]; return `<tr><td><b>${e.code}</b> <span class="small muted">${esc(e.country)}</span></td><td class="small">${e.region}</td>
      <td>${voteBadge(x?.v || 'pending')}</td><td class="small">${esc(x?.reason || '')}</td><td class="small muted">${x ? ago(x.at) : ''}</td></tr>`; }).join('') || '<tr><td colspan="5" class="empty">No entities in this filter.</td></tr>'}</tbody></table></div>`;
}

function objectionsBlock(a, u) {
  const list = store.getState().objections.filter((o) => o.account === a.number);
  if (!list.length) return '<div class="empty">No objections raised on this account.</div>';
  return list.map((o) => {
    const canResolve = o.status === 'open' && (u.role === 'head' || (u.role === 'controller' && store.entity(o.entity).region === u.region));
    return `<div class="note ${o.status === 'open' ? 'err' : 'ok'}" style="margin-bottom:10px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="mono">${o.id}</span>${chip(o.status)}<span class="small muted">${o.entity} · ${person(o.by)} · ${ago(o.at)}</span></div>
      <div style="margin-top:6px">${esc(o.text)}</div>
      ${o.status === 'resolved' ? `<div class="small" style="margin-top:6px"><b>Resolution</b> (${person(o.resolvedBy)}): ${esc(o.resolution)}</div>` : ''}
      ${canResolve ? `<div class="stack" style="gap:6px;margin-top:8px"><textarea data-res-text="${o.id}" placeholder="How is this resolved? e.g. handled by tax code, country chart account, or description change"></textarea>
        <button class="btn sm" data-res="${o.id}" style="justify-self:start">Resolve objection</button></div>` : ''}
    </div>`;
  }).join('');
}

function history(a) {
  const ev = store.getState().audit.filter((e) => e.objectId === a.number).slice().reverse();
  return `<ul class="timeline">${ev.map((e) => `<li><span class="avatar" style="width:26px;height:26px;font-size:10px">${e.actor === 'system' ? '⚙' : esc(initials(store.user(e.actor).name))}</span>
    <div><div class="what"><b>${esc(e.action)}</b> · ${person(e.actor, true)}</div>${e.note ? `<div class="small">${esc(e.note)}</div>` : ''}<div class="when">${dateTime(e.at)}</div></div></li>`).join('')}</ul>`;
}

export function render([num], u) {
  const a = store.account(num);
  if (!a) return { title: 'Not found', html: '<div class="empty">Account not found. <a href="#/accounts">Back to the global chart</a></div>' };
  const s = store.voteSummary(a.number);
  const voted = s.fits + s.change + s.cant;
  return {
    title: `${a.number} ${a.name}`,
    html: `<div class="page-head"><div>
        <a href="#/accounts" class="small">← Global chart</a>
        <h1 style="margin-top:6px"><span class="mono" style="font-size:20px">${a.number}</span> · ${esc(a.name)}</h1>
        <p>${chip(a.status)} &nbsp;${esc(a.description)}</p></div></div>
      <div class="stack">
        <div class="card">${stepper(a)}</div>
        <div class="grid g-2-1">
          <div class="stack">
            <div class="card"><div class="card-head"><div><h2>Entity fit-check</h2><p>${voted} of 30 entities voted · ${voted ? pct(s.fits / voted) : '—'} say it fits</p></div></div>${votesTable(a)}</div>
            <div class="card"><div class="card-head"><h2>Formal objections</h2></div>${objectionsBlock(a, u)}</div>
          </div>
          <div class="stack">
            <div class="card">${actionPanel(a, u)}</div>
            <div class="card"><div class="card-head"><h2>S/4HANA attributes</h2></div>${attributes(a)}</div>
            <div class="card"><div class="card-head"><h2>History</h2></div>${history(a)}</div>
          </div>
        </div>
      </div>`,
    bind(root, rerender) {
      const val = (id) => root.querySelector(id)?.value || '';
      root.querySelectorAll('[data-vf]').forEach((b) => b.addEventListener('click', () => { voteFilter = b.dataset.vf; rerender(); }));
      root.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => act(() => store.vote(a.number, b.dataset.v, val('#reason')), 'Vote recorded')));
      root.querySelector('#obj-go')?.addEventListener('click', () => act(() => store.raiseObjection(a.number, val('#obj-text')), 'Objection raised – approval is now blocked'));
      root.querySelector('#rec')?.addEventListener('click', () => act(() => store.recommendAccount(a.number, val('#note')), 'Recommended'));
      root.querySelector('#ret')?.addEventListener('click', () => act(() => store.returnAccount(a.number, val('#note')), 'Returned for rework'));
      root.querySelector('#approve')?.addEventListener('click', () => act(() => store.approveAccount(a.number, val('#note')), 'Approved'));
      root.querySelector('#reject')?.addEventListener('click', () => act(() => store.rejectAccount(a.number, val('#note')), 'Rejected'));
      root.querySelector('#resubmit')?.addEventListener('click', () => act(() => store.resubmitAccount(a.number), 'Resubmitted for regional review'));
      root.querySelectorAll('[data-res]').forEach((b) => b.addEventListener('click', () => act(() => store.resolveObjection(b.dataset.res, root.querySelector(`[data-res-text="${b.dataset.res}"]`).value), 'Objection resolved')));
    },
  };
}
