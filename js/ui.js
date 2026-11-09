// Small rendering helpers shared by all views.
import * as store from './store.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pct = (x, d = 0) => `${(x * 100).toFixed(d)}%`;
export const fmtN = (n) => Number(n).toLocaleString('en-US');

export function ago(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}
export const date = (ts) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
export const dateTime = (ts) => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const STATUS = {
  draft: 'Draft', regional: 'Regional review', global: 'Global review', returned: 'Returned', approved: 'Approved', rejected: 'Rejected',
  open: 'Open', resolved: 'Resolved',
};
const STATUS_ICON = { approved: '✓', rejected: '✕', returned: '↩' };
export const chip = (s) => `<span class="chip ${s}"><i></i>${STATUS_ICON[s] ? `${STATUS_ICON[s]} ` : ''}${STATUS[s] || esc(s)}</span>`;

export const VOTE = { fits: ['✓', 'Fits'], change: ['!', 'Needs change'], cant: ['✕', "Can't use"], pending: ['·', 'Not yet voted'] };
export const voteBadge = (v) => `<span class="vote ${v}"><b aria-hidden="true">${VOTE[v][0]}</b>${VOTE[v][1]}</span>`;

export function initials(name) { return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase(); }
export function person(id, withTitle = false) {
  const u = store.user(id);
  return `${esc(u.name)}${withTitle && u.title ? ` <span class="muted">· ${esc(u.title)}</span>` : ''}`;
}

export function toast(msg, isErr = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `on${isErr ? ' err' : ''}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.className = ''; }, 3200);
}

/** Run a store action, surfacing validation errors as a toast. */
export function act(fn, ok) {
  try { fn(); if (ok) toast(ok); return true; } catch (e) { toast(e.message, true); return false; }
}

// Shared tooltip for any element with data-tip (HTML-escaped content allowed: <b>).
export function initTooltip() {
  const tip = document.getElementById('tip');
  const show = (el, x, y) => {
    tip.innerHTML = el.getAttribute('data-tip');
    tip.classList.add('on');
    const r = tip.getBoundingClientRect();
    let left = x + 14, top = y + 14;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > innerHeight - 8) top = y - r.height - 14;
    tip.style.left = `${Math.max(8, left)}px`;
    tip.style.top = `${Math.max(8, top)}px`;
  };
  document.addEventListener('mousemove', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (el) show(el, e.clientX, e.clientY); else tip.classList.remove('on');
  });
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (el) { const r = el.getBoundingClientRect(); show(el, r.right, r.top); }
  });
  document.addEventListener('focusout', () => tip.classList.remove('on'));
  document.addEventListener('scroll', () => tip.classList.remove('on'), true);
}

export function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((c) => {
    const s = String(c ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
}

export const ICONS = {
  dashboard: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="5" height="6" rx="1"/><rect x="9" y="2" width="5" height="4" rx="1"/><rect x="9" y="8" width="5" height="6" rx="1"/><rect x="2" y="10" width="5" height="4" rx="1"/></svg>',
  inbox: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 9l2-6h8l2 6v4H2z"/><path d="M2 9h3.5l1 1.5h3L10.5 9H14"/></svg>',
  accounts: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3h10M3 6.5h10M3 10h10M3 13.5h6"/></svg>',
  requests: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 3v10M3 8h10"/><rect x="1.5" y="1.5" width="13" height="13" rx="3"/></svg>',
  mapping: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="3.5" cy="4" r="1.5"/><circle cx="3.5" cy="12" r="1.5"/><circle cx="12.5" cy="8" r="1.5"/><path d="M5 4.5C8 5 8 8 11 8M5 11.5C8 11 8 8 11 8"/></svg>',
  audit: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/></svg>',
  export: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8M5 7l3 3 3-3M3 12v2h10v-2"/></svg>',
};
