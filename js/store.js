// Application state, workflow transitions and audit trail.
// Persistence: browser localStorage (per viewer). A Supabase adapter replaces this for shared state.
import { generate, SEED_VERSION } from './data/seed.js';
import { PEOPLE, REGIONS, RANGES } from './data/reference.js';
import { requestChecks } from './rules.js';
import * as sync from './sync.js';

const KEY = 'jib-coa-demo-state';
const USER_KEY = 'jib-coa-demo-user';
let state = null;
let currentUserId = null;
const listeners = new Set();

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }
function safeDel(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }

// 'shared' = Supabase document everyone sees; 'local' = this browser only (offline / not configured).
let mode = 'local';
let remoteStamp = null;
let saving = null;
let dirty = false;
export const syncMode = () => mode;

function loadLocal() {
  const raw = safeGet(KEY);
  if (!raw) return null;
  try { const parsed = JSON.parse(raw); return parsed.version === SEED_VERSION ? parsed : null; } catch { return null; }
}

export async function init() {
  currentUserId = safeGet(USER_KEY);
  if (sync.enabled) {
    try {
      const remote = await sync.load();
      if (remote && remote.state?.version === SEED_VERSION) { state = remote.state; remoteStamp = remote.updatedAt; }
      else { state = generate(); remoteStamp = await sync.save(state); }
      mode = 'shared';
      safeSet(KEY, JSON.stringify(state));
      setInterval(poll, 15000);
    } catch (e) {
      console.warn('Shared mode unavailable, using local demo data:', e.message);
      mode = 'local';
    }
  }
  if (!state) { state = loadLocal() || generate(); persist(); }
  indexState();
}

async function poll() {
  if (saving || dirty || document.hidden) return;
  try {
    const stamp = await sync.updatedAt();
    if (stamp && stamp !== remoteStamp) {
      const remote = await sync.load();
      if (remote?.state?.version === SEED_VERSION && !saving && !dirty) {
        state = remote.state; remoteStamp = remote.updatedAt;
        indexState(); safeSet(KEY, JSON.stringify(state)); listeners.forEach((fn) => fn());
      } else if (!remote) { /* nightly reset cleared the row: reseed */ state = generate(); dirty = true; pushRemote(); indexState(); listeners.forEach((fn) => fn()); }
    }
  } catch { /* transient network error; try again next tick */ }
}

let timer = null;
function pushRemote() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    if (saving) { pushRemote(); return; }
    dirty = false;
    saving = sync.save(state).then((stamp) => { remoteStamp = stamp; }).catch((e) => { console.warn('Save failed', e.message); dirty = true; })
      .finally(() => { saving = null; });
  }, 600);
}

let idx = {};
function indexState() {
  idx = {
    accounts: Object.fromEntries(state.accounts.map((a) => [a.number, a])),
    users: Object.fromEntries(state.users.map((u) => [u.id, u])),
    entities: Object.fromEntries(state.entities.map((e) => [e.code, e])),
    lastEvent: {},
  };
  for (const ev of state.audit) idx.lastEvent[ev.objectId] = ev.at;
}

function persist() {
  safeSet(KEY, JSON.stringify(state));
  if (mode === 'shared') { dirty = true; pushRemote(); }
}
function commit() { indexState(); persist(); listeners.forEach((fn) => fn()); }

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getState = () => state;
export const account = (n) => idx.accounts[n];
export const user = (id) => idx.users[id] || { id, name: id === 'system' ? 'Workflow engine' : id, title: '' };
export const entity = (code) => idx.entities[code];
export const lastEventAt = (id) => idx.lastEvent[id] || 0;

export function resetDemo() { state = generate(); commit(); }

export function me() { return currentUserId ? idx.users[currentUserId] : null; }
export function setUser(id) { currentUserId = id; if (id) safeSet(USER_KEY, id); else safeDel(USER_KEY); listeners.forEach((fn) => fn()); }

function log(object, objectId, action, note = '', from = null, to = null) {
  state.seq.audit += 1;
  state.audit.push({ id: `a${state.seq.audit}`, at: Date.now(), actor: currentUserId, object, objectId, action, note, from, to });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

// ---------- Queries ----------
export const openObjections = (acct) => state.objections.filter((o) => o.status === 'open' && (!acct || o.account === acct));
export const votesFor = (acct) => state.votes[acct] || {};
export const isVotable = (a) => ['regional', 'global', 'approved', 'returned'].includes(a.status);

export function voteSummary(acct) {
  const v = votesFor(acct);
  const s = { fits: 0, change: 0, cant: 0, pending: 0 };
  for (const e of state.entities) s[v[e.code]?.v || 'pending'] += 1;
  return s;
}

export function inboxFor(u) {
  if (!u) return { accounts: [], requests: [], objections: [] };
  if (u.role === 'head') {
    return {
      accounts: state.accounts.filter((a) => a.status === 'global'),
      requests: state.requests.filter((q) => q.status === 'global'),
      objections: openObjections(),
    };
  }
  if (u.role === 'controller') {
    const inRegion = (code) => entity(code)?.region === u.region;
    return {
      accounts: state.accounts.filter((a) => a.status === 'regional' && a.regional[u.region] === 'pending'),
      requests: state.requests.filter((q) => q.status === 'regional' && inRegion(q.entity)),
      objections: openObjections().filter((o) => inRegion(o.entity)),
    };
  }
  // analyst: accounts awaiting this entity's fit-check
  return {
    accounts: state.accounts.filter((a) => isVotable(a) && a.status !== 'approved' && !votesFor(a.number)[u.entity]),
    requests: state.requests.filter((q) => q.entity === u.entity && q.status === 'returned'),
    objections: openObjections().filter((o) => o.entity === u.entity),
  };
}

export function metrics() {
  const s = state;
  const active = s.accounts.filter((a) => a.status !== 'rejected');
  const byStatus = { draft: 0, regional: 0, global: 0, returned: 0, approved: 0, rejected: 0 };
  s.accounts.forEach((a) => { byStatus[a.status] += 1; });
  const votable = s.accounts.filter(isVotable);

  const regions = {};
  for (const r of REGIONS) regions[r] = { fits: 0, change: 0, cant: 0, pending: 0 };
  const entities = s.entities.map((e) => {
    const t = { fits: 0, change: 0, cant: 0, pending: 0 };
    for (const a of votable) t[s.votes[a.number]?.[e.code]?.v || 'pending'] += 1;
    for (const k in t) regions[e.region][k] += t[k];
    const voted = t.fits + t.change + t.cant;
    return { ...e, ...t, voted, eligible: votable.length, completion: voted / votable.length, fitRate: voted ? t.fits / voted : 0 };
  });

  const approvers = [PEOPLE.head, ...Object.values(PEOPLE.controllers)].map((u) => {
    const ib = inboxFor(u);
    const items = [...ib.accounts.map((a) => a.number), ...ib.requests.map((q) => q.id)];
    const ages = items.map((id) => (Date.now() - lastEventAt(id)) / 86400000);
    return { user: u, count: items.length, objections: ib.objections.length, oldest: ages.length ? Math.max(...ages) : 0 };
  });

  const approvedEvents = s.audit.filter((e) => e.object === 'account' && e.action === 'Approved');
  const cycle = approvedEvents.map((e) => (e.at - (account(e.objectId)?.createdAt || e.at)) / 86400000);

  const legacyBySystem = {};
  s.legacy.forEach((l) => { legacyBySystem[l.system] = (legacyBySystem[l.system] || 0) + 1; });

  return {
    total: s.accounts.length, active: active.length, byStatus,
    approvedPct: byStatus.approved / active.length,
    votesCast: entities.reduce((n, e) => n + e.voted, 0),
    votesEligible: votable.length * s.entities.length,
    openObjections: openObjections().length,
    blockedAccounts: new Set(openObjections().map((o) => o.account)).size,
    openRequests: s.requests.filter((q) => ['regional', 'global'].includes(q.status)).length,
    regions, entities, approvers,
    avgCycle: cycle.length ? cycle.reduce((x, y) => x + y, 0) / cycle.length : 0,
    legacyCount: s.legacy.length, legacyBySystem,
    unmapped: s.legacy.filter((l) => l.status === 'unmapped').length,
  };
}

// ---------- Actions ----------
export function vote(acct, value, reason = '') {
  const u = me();
  need(u?.role === 'analyst', 'Only entity analysts can cast fit-check votes.');
  const a = account(acct);
  need(a && isVotable(a), 'This account is not open for fit-check.');
  need(value === 'fits' || reason.trim(), 'Please give a reason.');
  state.votes[acct] = state.votes[acct] || {};
  const prev = state.votes[acct][u.entity]?.v || null;
  state.votes[acct][u.entity] = { v: value, reason: reason.trim(), by: u.id, at: Date.now() };
  const label = { fits: 'Fits', change: 'Needs change', cant: "Can't use" }[value];
  log('account', acct, `Fit-check: ${label}`, `${u.entity}${reason ? ` – ${reason.trim()}` : ''}`, prev, value);
  commit();
}

export function raiseObjection(acct, text) {
  const u = me();
  need(u?.role === 'analyst', 'Only entity analysts raise formal objections.');
  need(text.trim().length >= 15, 'Describe the objection (at least 15 characters).');
  state.seq.objection += 1;
  const id = `OBJ-${state.seq.objection}`;
  state.objections.push({ id, account: acct, entity: u.entity, by: u.id, text: text.trim(), status: 'open', at: Date.now(), resolution: '', resolvedBy: null, resolvedAt: null });
  log('account', acct, 'Objection raised', `${id}: ${text.trim()}`);
  commit();
}

export function resolveObjection(id, resolution) {
  const u = me();
  const o = state.objections.find((x) => x.id === id);
  need(o && o.status === 'open', 'Objection not found or already resolved.');
  need(u?.role === 'head' || (u?.role === 'controller' && entity(o.entity).region === u.region), 'Only the regional controller or Global Head can resolve this objection.');
  need(resolution.trim().length >= 10, 'Explain the resolution (at least 10 characters).');
  Object.assign(o, { status: 'resolved', resolution: resolution.trim(), resolvedBy: u.id, resolvedAt: Date.now() });
  log('account', o.account, 'Objection resolved', `${id}: ${resolution.trim()}`);
  commit();
}

export function recommendAccount(acct, note = '') {
  const u = me();
  const a = account(acct);
  need(u?.role === 'controller', 'Only regional controllers recommend accounts.');
  need(a.status === 'regional' && a.regional[u.region] === 'pending', 'Nothing pending for your region.');
  a.regional[u.region] = 'recommended';
  log('account', acct, 'Recommended', note || `${u.region} review complete`);
  if (REGIONS.every((r) => a.regional[r] === 'recommended')) {
    a.status = 'global';
    state.audit.push({ id: `a${++state.seq.audit}`, at: Date.now() + 1, actor: 'system', object: 'account', objectId: acct, action: 'Moved to global review', note: 'All regions recommended', from: 'regional', to: 'global' });
  }
  commit();
}

export function returnAccount(acct, note) {
  const u = me();
  const a = account(acct);
  need(note?.trim(), 'A note is required when returning an account.');
  need((u?.role === 'controller' && a.status === 'regional') || (u?.role === 'head' && ['global', 'regional'].includes(a.status)), 'You cannot return this account.');
  const from = a.status;
  a.status = 'returned';
  log('account', acct, 'Returned', note.trim(), from, 'returned');
  commit();
}

export function approveAccount(acct, note = '') {
  const u = me();
  const a = account(acct);
  need(u?.role === 'head', 'Only the Global Head of Accounting gives final approval.');
  need(a.status === 'global', 'Account is not in global review.');
  need(openObjections(acct).length === 0, 'Resolve open objections before approving.');
  a.status = 'approved';
  log('account', acct, 'Approved', note || 'Approved for global chart JGCA', 'global', 'approved');
  commit();
}

export function rejectAccount(acct, note) {
  const u = me();
  const a = account(acct);
  need(u?.role === 'head', 'Only the Global Head of Accounting can reject.');
  need(note?.trim(), 'A note is required when rejecting.');
  const from = a.status;
  a.status = 'rejected';
  log('account', acct, 'Rejected', note.trim(), from, 'rejected');
  commit();
}

export function resubmitAccount(acct, note = '') {
  const u = me();
  const a = account(acct);
  need(u?.role === 'head', 'Only the global design team (Global Head) can resubmit.');
  need(['returned', 'draft'].includes(a.status), 'Only draft or returned accounts can be submitted.');
  const from = a.status;
  a.status = 'regional';
  a.regional = { Americas: 'pending', EMEA: 'pending', APAC: 'pending' };
  log('account', acct, 'Submitted for regional review', note, from, 'regional');
  commit();
}

export function submitRequest({ type, name, parent, group, statutory, just }) {
  const u = me();
  need(u?.role === 'analyst', 'Only entity analysts submit requests.');
  need(name?.trim().length >= 4, 'Account name is required.');
  need(just?.trim().length >= 15, 'Business justification is required (at least 15 characters).');
  state.seq.request += 1;
  const id = `REQ-${state.seq.request}`;
  const q = { id, type, entity: u.entity, name: name.trim(), parent: parent || null, group: group || null, statutory: !!statutory, just: just.trim(), status: 'regional', at: Date.now(), updatedAt: Date.now(), by: u.id };
  q.checksAtSubmit = requestChecks(q, state.accounts).verdict;
  state.requests.push(q);
  log('request', id, 'Submitted', q.name);
  commit();
  return id;
}

function nextNumber(prefix) {
  const nums = state.accounts.filter((a) => a.number.startsWith(prefix)).map((a) => +a.number);
  const n = (nums.length ? Math.max(...nums) : +`${prefix}0000000`) + 10000;
  return String(n);
}

export function decideRequest(id, decision, note = '') {
  const u = me();
  const q = state.requests.find((x) => x.id === id);
  need(q, 'Request not found.');
  const ent = entity(q.entity);
  if (decision === 'recommend') {
    need(u?.role === 'controller' && ent.region === u.region && q.status === 'regional', 'Not in your queue.');
    q.status = 'global';
  } else if (decision === 'return') {
    need(note.trim(), 'A note is required.');
    need((u?.role === 'controller' && ent.region === u.region && q.status === 'regional') || (u?.role === 'head' && q.status === 'global'), 'Not in your queue.');
    q.status = 'returned';
  } else if (decision === 'approve' || decision === 'reject') {
    need(u?.role === 'head' && q.status === 'global', 'Only the Global Head decides requests in global review.');
    if (decision === 'reject') need(note.trim(), 'A note is required.');
    q.status = decision === 'approve' ? 'approved' : 'rejected';
    if (decision === 'approve' && q.type === 'global') {
      const range = RANGES.find((r) => r.label === q.group) || RANGES[5];
      const number = nextNumber(range.prefix);
      state.accounts.push({
        number, name: q.name, shortText: q.name.toUpperCase().slice(0, 20), group: range.label, statement: range.statement,
        glType: range.statement === 'Balance sheet' ? 'X' : range.prefix === '9' ? 'S' : range.prefix === '8' ? 'N' : 'P',
        recon: null, openItem: false, lineItem: range.statement === 'Balance sheet', taxCategory: range.statement === 'P&L' ? '*' : '',
        fieldStatus: range.statement === 'Balance sheet' ? 'G001' : 'G004', functionalArea: ['5', '6', '7'].includes(range.prefix),
        fsItem: `FS${number.slice(0, 4)}`, status: 'approved', regional: { Americas: 'recommended', EMEA: 'recommended', APAC: 'recommended' },
        createdAt: Date.now(), updatedAt: Date.now(), description: `Created from ${id}: ${q.just}`,
      });
      q.createdAccount = number;
      log('account', number, 'Created from request', `${id} approved`, null, 'approved');
    }
  } else throw new Error('Unknown decision');
  q.updatedAt = Date.now();
  const label = { recommend: 'Recommended', return: 'Returned', approve: 'Approved', reject: 'Rejected' }[decision];
  log('request', id, label, note.trim());
  commit();
}

/** Remediate attribute conflicts: switch on open-item management in the legacy account before
 * migration, and route reconciliation-account balances through the sub-ledger load. */
export function alignMapping(legacyId) {
  const u = me();
  need(u && u.role !== 'analyst', 'Mappings are remediated by regional controllers or the Global Head.');
  const l = state.legacy.find((x) => x.id === legacyId);
  const fixes = [];
  for (const t of l.targets) {
    const g = account(t);
    if (g.openItem && !l.openItem) { l.openItem = true; fixes.push('activate open-item management in legacy before load'); }
    if (g.recon && !l.recon) { l.recon = g.recon; fixes.push(`load balance via ${g.recon === 'D' ? 'customer' : g.recon === 'K' ? 'vendor' : 'asset'} sub-ledger`); }
  }
  if (!fixes.length) {
    // N:1 mix: align every sibling that maps to the same target
    const target = account(l.targets[0]);
    for (const s of state.legacy) if (s.system === l.system && s.targets.join() === l.targets.join()) s.openItem = target.openItem;
    fixes.push(`set open-item management to ${target.openItem ? 'on' : 'off'} for all merged sources (clear open items before load)`);
  }
  l.status = 'confirmed';
  log('mapping', legacyId, 'Conflict remediated', `${l.system} ${l.number}: ${fixes.join('; ')}`);
  commit();
}

export function setMapping(legacyId, targets, status = 'confirmed') {
  const u = me();
  need(u && u.role !== 'analyst', 'Mappings are confirmed by regional controllers or the Global Head.');
  const l = state.legacy.find((x) => x.id === legacyId);
  need(l, 'Legacy account not found.');
  const before = l.targets.join(', ') || '—';
  l.targets = targets;
  l.status = targets.length ? status : 'unmapped';
  log('mapping', legacyId, targets.length ? 'Mapping confirmed' : 'Mapping cleared', `${l.system} ${l.number} → ${targets.join(', ') || '—'}`, before, targets.join(', '));
  commit();
}
