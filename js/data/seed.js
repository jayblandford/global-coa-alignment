// Deterministic demo data generator. Same seed -> same demo for every viewer.
import { ENTITIES, GLOBAL_ACCOUNTS, PEOPLE, RANGES, REGIONS } from './reference.js';

export const SEED_VERSION = 4;
const DAY = 86400000;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OBJECTIONS = [
  ['20130000', 'DE01', 'HGB requires a separate provision for goodwill (ex-gratia) warranty claims. One combined warranty account would force a manual split at every statutory close.'],
  ['11070000', 'MX01', 'SAT electronic accounting needs creditable IVA split between paid (acreditable pagado) and pending (pendiente de pago). A single input-tax account fails the DIOT reconciliation.'],
  ['20060000', 'JP01', 'Japanese summer and winter bonus accruals are tracked separately for social insurance calculation. Needs either two accounts or a mandatory assignment field.'],
  ['40030000', 'NL01', 'As the EMEA holding company we invoice management fees, not products. Intercompany product sales does not fit; we need intercompany service revenue.'],
  ['12060000', 'BR01', 'Brazilian consignment stock must be reported by fiscal status in SPED Bloco K. A single global consignment account loses the fiscal status detail.'],
  ['60090000', 'FR01', 'French tax rules limit deductibility of entertainment (cadeaux et réceptions). Meals and entertainment combined prevents the tax adjustment.'],
  ['50050000', 'US04', 'Keystone uses standard costing by plant. PPV must be split between material and freight to support the acquisition earn-out calculation through 2027.'],
  ['21030000', 'GB01', 'UK defined-benefit scheme reports under FRS 102 locally. Pension and OPEB combined does not support the local disclosure; we have no OPEB at all.'],
  ['62090000', 'IN01', 'Ind AS requires expected credit loss reported separately from write-offs of specific debtors for the Schedule III notes.'],
  ['80040000', 'AR01', 'Hyperinflation (ASC 830 / IAS 29): monetary gain/loss must be separated from realized FX. Need a dedicated account for the remeasurement.'],
  ['14040000', 'CA02', 'Customer-owned tooling held on our premises must not sit in fixed assets. Suggest a separate account or a clear rule in the description.'],
  ['20140000', 'US03', 'Aftermarket rebates are volume-based and settled quarterly through the distributor portal. Need separate accrual from OEM incentives for audit testing.'],
];

const RESOLVED = [
  ['11010000', 'CN01', 'Need separate accounts for VAT special invoices (fapiao) receivable.', 'Handled with the fapiao reference field and a document type, not a new account.'],
  ['61010000', 'SE01', 'Rent should be split by building.', 'Building is a cost center / asset dimension. No account split needed.'],
  ['60080000', 'PL01', 'Polish per-diem (dieta) should be a separate account.', 'Approved as a country chart account in CAPL; mapped to the global travel account.'],
  ['40010000', 'KR01', 'OEM sales by customer group for management reporting.', 'Customer group is in the Universal Journal (market segment). No account needed.'],
  ['20090000', 'ES01', 'SII reporting needs output VAT split by rate.', 'Covered by tax code; the SII report reads tax codes, not G/L accounts.'],
  ['50010000', 'CZ01', 'Material cost split for scrap.', 'Scrap is captured via movement type and functional area.'],
];

const REQUESTS = [
  { type: 'local', entity: 'MX01', name: 'IVA acreditable pendiente de pago', parent: '11070000', statutory: true, status: 'global', just: 'SAT Anexo 24 requires creditable VAT not yet paid to be shown separately. Country chart CAMX only.' },
  { type: 'local', entity: 'BR01', name: 'PIS/COFINS a recuperar', parent: '11070000', statutory: true, status: 'approved', just: 'Recoverable PIS/COFINS credits are a separate line in SPED ECD.' },
  { type: 'local', entity: 'FR01', name: 'Provisions réglementées', parent: '21040000', statutory: true, status: 'regional', just: 'Regulated provisions (PCG 145) required in French statutory accounts; no US GAAP equivalent.' },
  { type: 'local', entity: 'DE01', name: 'Kulanzrückstellung (goodwill warranty)', parent: '20130000', statutory: true, status: 'global', just: 'HGB §249 separate disclosure of ex-gratia warranty provisions.' },
  { type: 'local', entity: 'US03', name: 'Freight expense – Midwest region', parent: '62080000', statutory: false, status: 'regional', just: 'Regional sales managers want freight by region in the P&L.' },
  { type: 'local', entity: 'CN01', name: 'Travel expense – Sales department', parent: '60080000', statutory: false, status: 'returned', just: 'Management report shows travel by department.' },
  { type: 'global', entity: 'US04', name: 'Product Sales – Customer Group A', parent: null, statutory: false, status: 'rejected', just: 'Top-5 OEM customers tracked separately for the earn-out.' },
  { type: 'global', entity: 'NL01', name: 'Intercompany Service Revenue', parent: null, statutory: false, status: 'global', just: 'Management fees, IT recharges and royalties charged to subsidiaries need their own revenue line for elimination.' },
  { type: 'local', entity: 'JP01', name: 'Consumption tax suspense', parent: '20090000', statutory: true, status: 'approved', just: 'Qualified invoice system transitional measure requires a suspense account until 2029.' },
  { type: 'local', entity: 'IN01', name: 'GST input credit – IGST', parent: '11070000', statutory: true, status: 'regional', just: 'GSTR-3B reconciliation by tax type (IGST / CGST / SGST).' },
  { type: 'global', entity: 'US01', name: 'Salaries – Engineering cost center 4100', parent: null, statutory: false, status: 'regional', just: 'Engineering leadership wants salaries visible separately.' },
  { type: 'local', entity: 'AR01', name: 'Resultado por exposición a la inflación (RECPAM)', parent: '80040000', statutory: true, status: 'regional', just: 'Inflation adjustment result required under Argentine GAAP (RT 6).' },
  { type: 'global', entity: 'GB01', name: 'Trade Receivables – Third Party (duplicate)', parent: null, statutory: false, status: 'returned', just: 'UK customers on separate account for credit control.' },
  { type: 'local', entity: 'KR01', name: 'Retirement benefit deposit (DC plan)', parent: '21030000', statutory: true, status: 'approved', just: 'K-IFRS requires separate presentation of retirement pension deposits.' },
];

const NEEDS_CHANGE = [
  'Description should clarify treatment of customer-owned items.',
  'Please confirm whether this needs a mandatory profit center.',
  'Local auditors want a sub-ledger reference in the long text.',
  'Field status group should make the assignment field required.',
  'Name is ambiguous in translation; suggest clearer local short text.',
];
const CANT_USE = [
  'Not applicable to this entity’s business model.',
  'Conflicts with local statutory presentation; see objection.',
  'Entity does not hold this asset class.',
];

function abbreviate(name) {
  return name.toUpperCase().replace(/ – /g, '-').replace(/ & /g, '&').replace(/[^A-Z0-9&/\- ]/g, '').slice(0, 20).trim();
}

export function generate(now = Date.now()) {
  const r = rng(20261109);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const ago = (days) => now - days * DAY - Math.floor(r() * 9) * 3600000;

  const users = [PEOPLE.head, ...Object.values(PEOPLE.controllers),
    ...ENTITIES.map((e) => ({ id: `u-${e.code}`, name: e.analyst, title: `Accounting Analyst, ${e.code}`, role: 'analyst', entity: e.code, region: e.region }))];

  const audit = [];
  let auditSeq = 0;
  const log = (at, actor, object, objectId, action, note = '', from = null, to = null) =>
    audit.push({ id: `a${++auditSeq}`, at, actor, object, objectId, action, note, from, to });

  // ---- Global accounts with workflow status ----
  const objectionAccts = new Set(OBJECTIONS.map((o) => o[0]));
  const accounts = GLOBAL_ACCOUNTS.map(([number, name, flags]) => {
    const range = RANGES.find((x) => number.startsWith(x.prefix));
    const recon = /[DKA]/.exec(flags)?.[0] || null;
    const glType = flags.includes('S') ? 'S' : flags.includes('N') ? 'N' : number[0] <= '3' ? 'X' : 'P';
    const isTax = /VAT|Sales Tax/.test(name);
    return {
      number, name, shortText: abbreviate(name), group: range.label, statement: range.statement,
      glType, recon, openItem: flags.includes('O'), lineItem: !recon && glType === 'X',
      taxCategory: isTax ? (number[0] === '1' ? '<' : '>') : glType === 'P' ? '*' : '',
      fieldStatus: recon === 'D' ? 'G067' : recon === 'K' ? 'G067' : recon === 'A' ? 'G007' : glType === 'X' ? 'G001' : 'G004',
      functionalArea: flags.includes('F'),
      fsItem: `FS${number.slice(0, 4)}`,
      status: 'draft', regional: { Americas: 'pending', EMEA: 'pending', APAC: 'pending' },
      createdAt: 0, updatedAt: 0, description: '',
    };
  });

  for (const a of accounts) {
    a.description = a.statement === 'Balance sheet'
      ? `Global balance sheet account for ${a.name.toLowerCase()}.${a.openItem ? ' Open-item managed; must clear to zero.' : ''}${a.recon ? ` Reconciliation account for ${a.recon === 'D' ? 'customers' : a.recon === 'K' ? 'vendors' : 'fixed assets'}; post only via sub-ledger.` : ''}`
      : `Global ${a.glType === 'S' ? 'secondary cost' : 'P&L'} account for ${a.name.toLowerCase()}. Analyse by profit center, segment and functional area; do not create sub-accounts by department, region, customer or product.`;
    const created = 48 - Math.floor(r() * 6);
    a.createdAt = ago(created);
    log(a.createdAt, 'u-head', 'account', a.number, 'Proposed', 'Initial global design baseline');

    let status;
    const x = r();
    if (objectionAccts.has(a.number)) status = x < 0.75 ? 'global' : 'regional';
    else if (x < 0.56) status = 'approved';
    else if (x < 0.74) status = 'global';
    else if (x < 0.88) status = 'regional';
    else if (x < 0.93) status = 'returned';
    else if (x < 0.95) status = 'rejected';
    else status = 'draft';
    if (a.glType === 'X' && a.group === 'Equity' && status !== 'approved') status = 'approved';

    if (status !== 'draft') {
      const sub = status === 'regional' ? 2 + Math.floor(r() * 12) : created - 3 - Math.floor(r() * 5);
      log(ago(sub), 'u-head', 'account', a.number, 'Submitted for regional review', '', 'draft', 'regional');
      let lastDay = sub;
      for (const region of REGIONS) {
        const done = status !== 'regional' || r() < 0.45;
        if (done) {
          const d = Math.max(1, Math.floor(r() * (sub - 1)));
          a.regional[region] = 'recommended';
          log(ago(d), PEOPLE.controllers[region].id, 'account', a.number, 'Recommended', `${region} review complete`);
          lastDay = Math.min(lastDay, d);
        }
      }
      if (status === 'returned') {
        const d = Math.max(1, lastDay - 2);
        log(ago(d), 'u-head', 'account', a.number, 'Returned', 'Clarify description and field status group before approval', 'global', 'returned');
      } else if (status === 'approved' || status === 'rejected') {
        const d = Math.max(1, lastDay - 1 - Math.floor(r() * 6));
        log(ago(d), 'u-head', 'account', a.number, status === 'approved' ? 'Approved' : 'Rejected',
          status === 'approved' ? 'Approved for global chart JGCA' : 'Covered by an existing account plus dimensions', 'global', status);
      } else if (status === 'global') {
        log(ago(Math.max(1, lastDay - 1)), 'system', 'account', a.number, 'Moved to global review', 'All regions recommended', 'regional', 'global');
      }
    }
    a.status = status;
  }

  // ---- Fit-check votes: votes[accountNumber][entityCode] ----
  const votes = {};
  // Engagement differs by entity: a few lag behind, which is what the program team needs to see.
  const LAGGING = { JP01: 0.48, AR01: 0.55, CZ01: 0.6, US05: 0.66, IN01: 0.72, BR01: 0.78 };
  for (const a of accounts) {
    if (a.status === 'draft') continue;
    votes[a.number] = {};
    const coverage = a.status === 'approved' ? 0.97 : a.status === 'global' ? 0.88 : 0.62;
    for (const e of ENTITIES) {
      if (r() > coverage * (LAGGING[e.code] ?? (0.9 + r() * 0.1))) continue;
      const y = r();
      let v = y < 0.84 ? 'fits' : y < 0.96 ? 'change' : 'cant';
      if (a.number === '14040000' && ['US05', 'NL01', 'SG01', 'US06'].includes(e.code)) v = 'cant';
      votes[a.number][e.code] = {
        v, reason: v === 'fits' ? '' : v === 'change' ? pick(NEEDS_CHANGE) : pick(CANT_USE),
        by: `u-${e.code}`, at: ago(1 + Math.floor(r() * 30)),
      };
    }
  }

  // ---- Objections ----
  const objections = [];
  OBJECTIONS.forEach(([acct, entity, text], i) => {
    const at = ago(3 + Math.floor(r() * 18));
    objections.push({ id: `OBJ-${101 + i}`, account: acct, entity, by: `u-${entity}`, text, status: 'open', at, resolution: '', resolvedBy: null, resolvedAt: null });
    log(at, `u-${entity}`, 'account', acct, 'Objection raised', text.slice(0, 90) + '…');
    if (votes[acct]) votes[acct][entity] = { v: 'cant', reason: 'See formal objection', by: `u-${entity}`, at };
  });
  RESOLVED.forEach(([acct, entity, text, resolution], i) => {
    const at = ago(20 + Math.floor(r() * 15));
    const resolvedAt = at + (3 + Math.floor(r() * 6)) * DAY;
    const ent = ENTITIES.find((e) => e.code === entity);
    const resolver = PEOPLE.controllers[ent.region].id;
    objections.push({ id: `OBJ-${120 + i}`, account: acct, entity, by: `u-${entity}`, text, status: 'resolved', at, resolution, resolvedBy: resolver, resolvedAt });
    log(at, `u-${entity}`, 'account', acct, 'Objection raised', text);
    log(resolvedAt, resolver, 'account', acct, 'Objection resolved', resolution);
  });

  // ---- Extension requests ----
  const requests = REQUESTS.map((q, i) => {
    const at = ago(4 + Math.floor(r() * 25));
    const id = `REQ-${201 + i}`;
    log(at, `u-${q.entity}`, 'request', id, 'Submitted', q.name);
    if (q.status !== 'regional') {
      const ent = ENTITIES.find((e) => e.code === q.entity);
      const rc = PEOPLE.controllers[ent.region].id;
      if (q.status === 'returned' && q.type === 'local') log(at + 2 * DAY, rc, 'request', id, 'Returned', 'Department is a cost center dimension. Use 60080000 with cost center.');
      else log(at + 2 * DAY, rc, 'request', id, 'Recommended', '');
      if (q.status === 'approved') log(at + 5 * DAY, 'u-head', 'request', id, 'Approved', 'Country chart account approved');
      if (q.status === 'rejected') log(at + 5 * DAY, 'u-head', 'request', id, 'Rejected', 'Customer group is a market segment attribute, not an account.');
      if (q.status === 'returned' && q.type === 'global') log(at + 5 * DAY, 'u-head', 'request', id, 'Returned', 'Duplicate of 11010000. Use customer account groups.');
    }
    return { id, ...q, at, updatedAt: at, by: `u-${q.entity}` };
  });

  // ---- Legacy charts and mapping ----
  const legacy = [];
  const systems = ['ECC', 'EBS', 'LOC'];
  const deptVariants = [' – Sales', ' – Engineering', ' – Plant Admin', ' – HQ'];
  const revVariants = [' – North Region', ' – Key Accounts', ' – Export'];
  const bsVariants = [' – USD', ' – EUR', ' – Plant 2', ' (old)'];
  let lseq = 0;
  const legacyNumber = (sys, g, i) => sys === 'ECC' ? `${g.number.slice(0, 4)}${String(i + 1).padStart(2, '0')}`
    : sys === 'EBS' ? `01-${g.number.slice(0, 4)}-${String(i * 10).padStart(3, '0')}`
      : `${g.number.slice(0, 4)}.${i + 1}`;

  for (const g of accounts) {
    for (const sys of systems) {
      if (sys === 'EBS' && r() < 0.18) continue;
      let n = 1;
      if (g.group === 'Operating expenses') n += sys === 'ECC' ? Math.floor(r() * 4) : sys === 'LOC' ? Math.floor(r() * 3) : Math.floor(r() * 2);
      else if (g.group === 'Revenue') n += Math.floor(r() * 3);
      else if (g.number.startsWith('100') || g.number.startsWith('110')) n += Math.floor(r() * 2);
      else if (r() < 0.25) n += 1;
      for (let i = 0; i < n; i++) {
        let suffix = '';
        if (i > 0) suffix = g.group === 'Operating expenses' || g.group === 'Cost of sales' ? deptVariants[(i - 1) % 4]
          : g.group === 'Revenue' ? revVariants[(i - 1) % 3] : bsVariants[(i - 1) % 4];
        const name = g.name + suffix;
        const conflictOI = g.openItem && i > 0 && r() < 0.55;
        legacy.push({
          id: `L${++lseq}`, system: sys, number: legacyNumber(sys, g, i),
          name: sys === 'ECC' ? abbreviate(name) : name,
          openItem: conflictOI ? false : g.openItem,
          recon: g.recon,
          targets: [g.number], status: r() < 0.82 ? 'confirmed' : 'proposed',
        });
      }
    }
  }
  // Deliberate attribute conflicts and edge cases
  legacy.push({ id: `L${++lseq}`, system: 'EBS', number: '01-1105-900', name: 'Trade Receivables – Misc (manual)', openItem: true, recon: null, targets: ['11010000'], status: 'proposed' });
  legacy.push({ id: `L${++lseq}`, system: 'LOC', number: '2001.9', name: 'Vendors – One-time (non-recon)', openItem: true, recon: null, targets: ['20010000'], status: 'proposed' });
  const splits = [
    ['ECC', '200599', 'ACCRUED PAYROLL&BONUS', ['20050000', '20060000']],
    ['EBS', '01-6105-000', 'Depreciation & Amortization', ['61050000', '61060000']],
    ['LOC', '6008.9', 'Travel & Entertainment', ['60080000', '60090000']],
    ['ECC', '620199', 'PROF FEES-ALL', ['62010000', '62020000', '62030000']],
    ['EBS', '01-2013-000', 'Warranty Reserve', ['20130000', '21040000']],
  ];
  for (const [system, number, name, targets] of splits) legacy.push({ id: `L${++lseq}`, system, number, name, openItem: false, recon: null, targets, status: 'proposed' });
  const unmapped = [
    ['ECC', '899901', 'SUSPENSE-CONVERSION'], ['ECC', '479900', 'MISC INCOME-OTHER'], ['EBS', '01-6999-000', 'Miscellaneous Expense'],
    ['LOC', '6299.1', 'Sundry expenses'], ['LOC', '1999.1', 'Clearing – old system'], ['EBS', '01-4799-000', 'Other Revenue – Scrap Sales'],
    ['ECC', '619950', 'COFFEE&WATER SERVICE'], ['LOC', '6050.7', 'Staff welfare – canteen'],
  ];
  for (const [system, number, name] of unmapped) legacy.push({ id: `L${++lseq}`, system, number, name, openItem: false, recon: null, targets: [], status: 'unmapped' });

  // Mappings with attribute conflicts cannot already be confirmed.
  const byNum = Object.fromEntries(accounts.map((a) => [a.number, a]));
  for (const l of legacy) {
    if (l.targets.some((t) => (byNum[t].openItem && !l.openItem) || (byNum[t].recon && !l.recon))) l.status = 'proposed';
  }
  audit.sort((a, b) => a.at - b.at);
  return {
    version: SEED_VERSION, seededAt: now, users, entities: ENTITIES, accounts, votes, objections, requests, legacy, audit,
    seq: { audit: auditSeq, objection: 140, request: 300, account: 0 },
  };
}
