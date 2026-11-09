// Shared-state sync with Supabase via its REST API (no client library, no build step).
// The whole demo state is one JSON document in table demo_state. Last write wins, which is
// fine for a demo; a production build would normalize accounts, votes and audit into tables.
import { SUPABASE_URL, SUPABASE_KEY, STATE_ID } from './config.js';

const base = `${SUPABASE_URL}/rest/v1/demo_state`;
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
export const enabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

async function req(url, opts = {}, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, headers: { ...headers, ...(opts.headers || {}) }, signal: ctl.signal });
    if (!res.ok) throw new Error(`Supabase ${res.status}`);
    return res;
  } finally { clearTimeout(t); }
}

/** Returns { state, updatedAt } or null when no shared state exists yet. Throws when unreachable. */
export async function load() {
  const res = await req(`${base}?id=eq.${STATE_ID}&select=state,updated_at`);
  const rows = await res.json();
  return rows.length ? { state: rows[0].state, updatedAt: rows[0].updated_at } : null;
}

export async function updatedAt() {
  const res = await req(`${base}?id=eq.${STATE_ID}&select=updated_at`);
  const rows = await res.json();
  return rows[0]?.updated_at || null;
}

/** Upsert the shared document; returns the new updated_at. */
export async function save(state) {
  const res = await req(`${base}?on_conflict=id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ id: STATE_ID, state, updated_at: new Date().toISOString() }),
  }, 15000);
  const rows = await res.json();
  return rows[0]?.updated_at || null;
}
