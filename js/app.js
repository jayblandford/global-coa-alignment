import * as store from './store.js';
import { esc, initials, ICONS, initTooltip, toast } from './ui.js';
import { COMPANY, PEOPLE, ENTITIES } from './data/reference.js';
import * as dashboard from './views/dashboard.js';
import * as inbox from './views/inbox.js';
import * as accounts from './views/accounts.js';
import * as accountDetail from './views/account.js';
import * as requests from './views/requests.js';
import * as mapping from './views/mapping.js';
import * as audit from './views/audit.js';
import * as exporter from './views/export.js';

const ROUTES = [
  [/^#\/dashboard$/, dashboard],
  [/^#\/inbox$/, inbox],
  [/^#\/accounts$/, accounts],
  [/^#\/account\/(\d{8})$/, accountDetail],
  [/^#\/requests$/, requests],
  [/^#\/request\/(REQ-\d+)$/, requests],
  [/^#\/mapping$/, mapping],
  [/^#\/audit$/, audit],
  [/^#\/export$/, exporter],
];
const NAV = [
  ['dashboard', 'Dashboard'], ['inbox', 'My inbox'], ['accounts', 'Global chart'], ['requests', 'Requests'],
  ['mapping', 'Legacy mapping'], ['audit', 'Audit trail'], ['export', 'S/4HANA export'],
];

const app = document.getElementById('app');

function applyTheme() {
  let t = null;
  try { t = localStorage.getItem('jib-theme'); } catch { /* ignore */ }
  if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
  return t || 'auto';
}
function cycleTheme() {
  const order = ['auto', 'light', 'dark'];
  const next = order[(order.indexOf(applyTheme()) + 1) % 3];
  try { if (next === 'auto') localStorage.removeItem('jib-theme'); else localStorage.setItem('jib-theme', next); } catch { /* ignore */ }
  applyTheme();
  render();
}

function picker() {
  const c = PEOPLE.controllers;
  const opts = ENTITIES.map((e) => `<option value="u-${e.code}">${e.code} · ${esc(e.country)} — ${esc(e.analyst)}</option>`).join('');
  app.innerHTML = `
  <div class="picker">
    <div class="hero">
      <span class="fict">Demo · ${esc(COMPANY.label)}</span>
      <h1>Global Chart of Accounts Alignment</h1>
      <p>One place for 214 legal entities to design, debate, approve and map a new global standard chart of accounts for SAP S/4HANA. It replaces the spreadsheets and email threads. Pick a role to step into the workflow; you can switch at any time.</p>
    </div>
    <div class="roles">
      <button class="role" data-user="${PEOPLE.head.id}">
        <span class="r-k">Final approver</span>
        <span class="r-n">${esc(PEOPLE.head.name)}</span>
        <span class="r-d">Global Head of Accounting. Approves or rejects accounts, settles objections, owns the chart.</span>
      </button>
      <div class="role" role="group" aria-label="Regional controller">
        <span class="r-k">Regional review</span>
        <span class="r-n">Regional Controller</span>
        <span class="r-d">Reviews accounts and local requests for the region, resolves entity objections.</span>
        <div class="btns" style="margin-top:6px">
          ${['Americas', 'EMEA', 'APAC'].map((r) => `<button class="btn sm" data-user="${c[r].id}">${r} · ${esc(c[r].name)}</button>`).join('')}
        </div>
      </div>
      <div class="role" role="group" aria-label="Entity analyst">
        <span class="r-k">Entity feedback</span>
        <span class="r-n">Entity Accounting Analyst</span>
        <span class="r-d">Votes whether each account fits, raises objections, requests local accounts.</span>
        <select id="pick-entity" aria-label="Choose entity">${opts}</select>
        <button class="btn primary sm" id="pick-analyst" style="justify-self:start">Continue as analyst</button>
      </div>
    </div>
    <div class="how">
      <div><b>1 · Propose</b>The global design team proposes ${store.getState().accounts.length} accounts in 8-digit ranges.</div>
      <div><b>2 · Fit-check</b>Each of the 30 Wave 1 entities votes Fits / Needs change / Can't use.</div>
      <div><b>3 · Review</b>Regional controllers recommend; objections block approval until resolved.</div>
      <div><b>4 · Approve &amp; map</b>The Global Head approves; legacy accounts are mapped and exported for S/4HANA.</div>
    </div>
    <p class="muted small" style="margin-top:28px">All companies, people and figures are fictional. ${store.syncMode() === 'shared' ? 'Changes are shared with every visitor and reset nightly.' : 'Your changes are saved in this browser only.'} <button class="linkbtn" id="reset-demo">Reset demo data</button></p>
  </div>`;
  app.querySelectorAll('[data-user]').forEach((b) => b.addEventListener('click', () => go(b.dataset.user)));
  app.querySelector('#pick-analyst').addEventListener('click', () => go(app.querySelector('#pick-entity').value));
  app.querySelector('#reset-demo').addEventListener('click', () => { store.resetDemo(); toast('Demo data reset'); });
  function go(id) {
    store.setUser(id);
    if (!location.hash || location.hash === '#/' || location.hash === '#') location.hash = store.me().role === 'head' ? '#/dashboard' : '#/inbox';
    else render();
  }
}

let lastHash = null;
export function render() {
  const u = store.me();
  if (!u) { picker(); document.title = 'Global COA Alignment'; return; }
  const hash = location.hash || '#/dashboard';
  let view = null, params = [];
  for (const [re, v] of ROUTES) {
    const m = re.exec(hash);
    if (m) { view = v; params = m.slice(1); break; }
  }
  if (!view) { location.hash = '#/dashboard'; return; }
  const ib = store.inboxFor(u);
  const inboxCount = ib.accounts.length + ib.requests.length + ib.objections.length;
  const out = view.render(params, u);
  const section = hash.split('/')[1];
  const active = section === 'account' ? 'accounts' : section === 'request' ? 'requests' : section;
  const scroll = hash === lastHash ? window.scrollY : 0;
  app.innerHTML = `
  <div class="shell">
    <aside class="side">
      <div class="brand"><div class="brand-mark">JIB</div><div><div class="brand-name">${esc(COMPANY.name)}</div><div class="brand-sub">(Fictional) · COA Program</div></div></div>
      <nav class="nav" aria-label="Main">
        ${NAV.map(([k, label]) => `<a href="#/${k}" class="${active === k ? 'on' : ''}">${ICONS[k]}${label}${k === 'inbox' && inboxCount ? `<span class="count">${inboxCount}</span>` : ''}</a>`).join('')}
      </nav>
      <div class="side-foot">
        <div data-tip="${store.syncMode() === 'shared' ? 'Changes are saved to the shared database: every visitor sees the same program. Data resets nightly.' : 'Running on local demo data: changes stay in this browser.'}"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${store.syncMode() === 'shared' ? 'var(--good)' : 'var(--axis)'};margin-right:6px"></span>${store.syncMode() === 'shared' ? 'Live shared data' : 'Local demo data'}</div>
        <div>Wave 1 · 30 of ${COMPANY.totalEntities} entities<br>Chart <span class="mono">${COMPANY.operationalChart}</span> · ${COMPANY.leadingLedger}</div>
        <button class="linkbtn" id="theme">Theme: ${applyTheme()}</button>
        <button class="linkbtn" id="reset">Reset demo data</button>
        <a href="https://github.com/jayblandford/global-coa-alignment" target="_blank" rel="noopener">Source on GitHub ↗</a>
      </div>
    </aside>
    <div class="main">
      <header class="top">
        <div class="crumbs">${esc(COMPANY.label)} · ${esc(out.title)}</div>
        <div class="spacer"></div>
        <button class="whoami" id="switch" title="Switch role">
          <span class="avatar">${initials(u.name)}</span>
          <span style="text-align:left"><span class="n">${esc(u.name)}</span><br><span class="t">${esc(u.title)}</span></span>
          <span class="muted small" style="padding-right:6px">Switch ▾</span>
        </button>
      </header>
      <main class="content" id="view">${out.html}</main>
    </div>
  </div>`;
  document.title = `${out.title} · Global COA Alignment`;
  app.querySelector('#switch').addEventListener('click', () => { store.setUser(null); });
  app.querySelector('#theme').addEventListener('click', cycleTheme);
  app.querySelector('#reset').addEventListener('click', () => { store.resetDemo(); toast('Demo data reset'); });
  out.bind?.(app.querySelector('#view'), render);
  window.scrollTo(0, scroll);
  lastHash = hash;
}

applyTheme();
await store.init();
initTooltip();
store.subscribe(render);
window.addEventListener('hashchange', render);
render();
