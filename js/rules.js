// Rule-based "smart checks".
// Each function is a deliberate seam: the same signature can later be backed by a
// Claude API call (see README "AI-ready checks") without touching the UI.

const DIMENSION_PATTERNS = [
  { dimension: 'Cost center / functional area', re: /\b(department|dept|sales|engineering|marketing|admin(istration)?|hq|headquarters|cost cent(er|re)|cc ?\d+|plant ?\d*)\b/i },
  { dimension: 'Profit center / segment (region)', re: /\b(region|regional|north|south|east|west|midwest|emea|apac|americas|territory|branch)\b/i },
  { dimension: 'Customer / market segment', re: /\b(customer|client|key accounts?|customer group|dealer group|oem group)\b/i },
  { dimension: 'Product / material group', re: /\b(product line|sku|model|brand|material group)\b/i },
  { dimension: 'Internal order / project / WBS', re: /\b(project|wbs|internal order|campaign)\b/i },
];

/** Is this proposed account really a reporting dimension? Returns a list of findings. */
export function dimensionCheck(text) {
  const hits = [];
  for (const p of DIMENSION_PATTERNS) {
    const m = p.re.exec(text || '');
    if (m) hits.push({ dimension: p.dimension, term: m[0] });
  }
  return hits;
}

const STOP = new Set(['the', 'and', 'of', 'for', 'to', 'a', 'in', '–', '-', '&']);
function tokens(s) {
  return new Set(String(s).toLowerCase().replace(/[()/,.–-]/g, ' ').split(/\s+/).filter((t) => t && !STOP.has(t)));
}
export function similarity(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Near-duplicate names in the global chart. */
export function duplicateCheck(name, accounts, threshold = 0.6) {
  return accounts
    .filter((a) => a.status !== 'rejected')
    .map((a) => ({ account: a, score: similarity(name, a.name) }))
    .filter((x) => x.score >= threshold)
    .sort((x, y) => y.score - x.score)
    .slice(0, 3);
}

/** Suggest global targets for an unmapped legacy account. */
export function suggestMapping(legacyName, accounts) {
  const clean = legacyName.replace(/-/g, ' ');
  return accounts
    .filter((a) => a.status !== 'rejected')
    .map((a) => ({ account: a, score: Math.max(similarity(clean, a.name), similarity(clean, a.shortText)) }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, 3);
}

/** Number range must match the account's financial statement group. */
export function rangeCheck(number, glType) {
  const d = String(number)[0];
  if (!/^\d{8}$/.test(number)) return 'Account number must be 8 digits.';
  if (glType === 'X' && d > '3') return 'Balance sheet accounts must sit in ranges 1–3.';
  if (glType === 'S' && d !== '9') return 'Secondary cost accounts must sit in range 9.';
  if ((glType === 'P' || glType === 'N') && d < '4') return 'P&L accounts must sit in ranges 4–8.';
  return null;
}

/** Attribute conflicts between a legacy account and its global target(s). */
export function mappingConflicts(legacy, byNumber, siblings = []) {
  const out = [];
  if (legacy.targets.length > 1) out.push({ level: 'warn', text: `1:${legacy.targets.length} split: needs an allocation rule for balances and open items.` });
  for (const t of legacy.targets) {
    const g = byNumber[t];
    if (!g) continue;
    if (g.openItem && !legacy.openItem) out.push({ level: 'error', text: `Open-item mismatch: ${t} is open-item managed, legacy is not. Line items will not clear.` });
    if (g.recon && !legacy.recon) out.push({ level: 'error', text: `Target ${t} is a reconciliation account (${g.recon}). Legacy balance must load via sub-ledger, not G/L.` });
  }
  if (siblings.length > 1) {
    const mixed = new Set(siblings.map((s) => s.openItem)).size > 1;
    if (mixed) out.push({ level: 'error', text: `N:1 merge mixes open-item and non-open-item legacy accounts (${siblings.length} sources).` });
  }
  return out;
}

/** Run all request checks and return a summary used by reviewers. */
export function requestChecks(req, accounts) {
  const dims = dimensionCheck(`${req.name} ${req.just}`);
  const dups = duplicateCheck(req.name, accounts, 0.55);
  let verdict = 'ok';
  if (dims.length && !req.statutory) verdict = 'dimension';
  else if (dups.length && dups[0].score >= 0.75) verdict = 'duplicate';
  return { dims, dups, verdict };
}
