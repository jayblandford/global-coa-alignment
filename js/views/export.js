import * as store from '../store.js';
import { esc, downloadCSV, fmtN } from '../ui.js';
import { COMPANY, LEGACY_SYSTEMS } from '../data/reference.js';
import { analyse } from './mapping.js';

const CURRENCY = { 'United States': 'USD', Canada: 'CAD', Mexico: 'MXN', Brazil: 'BRL', Argentina: 'ARS', Germany: 'EUR', France: 'EUR', 'United Kingdom': 'GBP', Italy: 'EUR', Spain: 'EUR', Poland: 'PLN', Netherlands: 'EUR', Czechia: 'CZK', Sweden: 'SEK', Japan: 'JPY', China: 'CNY', India: 'INR', 'South Korea': 'KRW', Thailand: 'THB', Australia: 'AUD', Singapore: 'SGD' };

function files() {
  const s = store.getState();
  const approved = s.accounts.filter((a) => a.status === 'approved');
  const chart = [
    ['ChartOfAccounts', 'GLAccount', 'GLAccountType', 'AccountGroup', 'ShortText', 'LongText', 'FunctionalAreaRequired', 'GroupAccount_FSItem'],
    ...approved.map((a) => [COMPANY.operationalChart, a.number, a.glType, a.group.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4), a.shortText, a.name, a.functionalArea ? 'X' : '', a.fsItem]),
  ];
  const cc = [
    ['CompanyCode', 'GLAccount', 'AccountCurrency', 'ReconciliationAccountType', 'OpenItemManagement', 'LineItemDisplay', 'TaxCategory', 'FieldStatusGroup', 'CountryChart'],
  ];
  for (const e of s.entities) {
    for (const a of approved) {
      if (s.votes[a.number]?.[e.code]?.v === 'cant') continue; // not extended where entity cannot use it
      cc.push([e.code, a.number, CURRENCY[e.country] || '', a.recon || '', a.openItem ? 'X' : '', a.lineItem ? 'X' : '', a.taxCategory, a.fieldStatus, e.countryChart ? e.countryChart.split(' ')[0] : '']);
    }
  }
  const map = [['SourceSystem', 'LegacyAccount', 'LegacyName', 'TargetGLAccount', 'MappingType', 'Status', 'Issues'],
    ...analyse().map(({ l, type, conflicts }) => [LEGACY_SYSTEMS[l.system].name, l.number, l.name, l.targets.join(' | '), type, l.status, conflicts.map((c) => c.text).join(' | ')])];
  const local = [['CountryChart', 'Entity', 'RequestID', 'AccountName', 'GlobalParent', 'Status'],
    ...s.requests.filter((q) => q.type === 'local' && q.status === 'approved').map((q) => [store.entity(q.entity).countryChart?.split(' ')[0] || '', q.entity, q.id, q.name, q.parent, q.status])];
  return [
    { id: 'chart', name: 'G/L account master – chart of accounts data', file: 'jib-glaccount-chart-JGCA.csv', rows: chart, desc: 'Approved global accounts only, chart-level fields.' },
    { id: 'cc', name: 'G/L account master – company code data', file: 'jib-glaccount-companycode.csv', rows: cc, desc: 'Approved accounts extended to each Wave 1 company code, skipping entities that voted “Can’t use”.' },
    { id: 'map', name: 'Legacy-to-global mapping', file: 'jib-legacy-mapping.csv', rows: map, desc: 'For balance and open-item migration, with the issues found by the checks.' },
    { id: 'local', name: 'Approved country chart accounts', file: 'jib-country-chart-accounts.csv', rows: local, desc: 'Statutory accounts with their global parent.' },
  ];
}

export function render() {
  const m = store.metrics();
  const all = analyse();
  const errs = all.filter((x) => x.conflicts.some((c) => c.level === 'error')).length;
  const unm = all.filter((x) => x.type === 'Unmapped').length;
  const checks = [
    [m.byStatus.approved === m.active, `${m.byStatus.approved} of ${m.active} active accounts approved`],
    [m.openObjections === 0, `${m.openObjections} open objections`],
    [unm === 0, `${unm} legacy accounts unmapped`],
    [errs === 0, `${errs} legacy mappings with attribute conflicts`],
  ];
  const list = files();
  return {
    title: 'S/4HANA export',
    html: `<div class="page-head"><div><h1>S/4HANA load files</h1>
      <p>Download load-ready files for the approved chart. Column names follow the S/4HANA Migration Cockpit G/L account template (simplified for the demo). Export works at any time; the readiness check shows what still blocks a clean cutover.</p></div></div>
      <div class="stack">
        <div class="card"><div class="card-head"><h2>Cutover readiness</h2></div>
          <div class="stack" style="gap:6px">${checks.map(([ok, t]) => `<div class="note ${ok ? 'ok' : 'warn'}">${ok ? '✓' : '!'} ${t}</div>`).join('')}</div></div>
        ${list.map((x) => `<div class="card">
          <div class="card-head"><div><h2>${esc(x.name)}</h2><p>${esc(x.desc)} · ${fmtN(x.rows.length - 1)} rows</p></div><button class="btn primary" data-dl="${x.id}">Download CSV</button></div>
          <div class="table-wrap"><table><thead><tr>${x.rows[0].map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${x.rows.slice(1, 4).map((r) => `<tr>${r.map((c) => `<td class="small">${esc(c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${x.rows[0].length}" class="empty">No rows yet.</td></tr>`}</tbody></table></div>
        </div>`).join('')}
      </div>`,
    bind(root) {
      root.querySelectorAll('[data-dl]').forEach((b) => b.addEventListener('click', () => {
        const x = files().find((y) => y.id === b.dataset.dl);
        downloadCSV(x.file, x.rows);
      }));
    },
  };
}
