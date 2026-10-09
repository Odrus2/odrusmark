import { supabase, configured, getCurrentUser } from './supabase.js';
export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const dateLabel = value => value ? new Intl.DateTimeFormat(undefined, { year:'numeric', month:'short', day:'numeric' }).format(new Date(value)) : 'Not set';
export const statusLabel = value => ({submitted:'Submitted',under_review:'Under review',approved:'Approved',in_progress:'In progress',awaiting_client:'Awaiting you',scoped:'Scoping',active:'Active',on_hold:'On hold',awaiting_client:'Awaiting you',completed:'Completed',cancelled:'Cancelled'})[value] || value;
export const badge = (className, label) => `<span class="badge ${esc(className)}">${esc(label)}</span>`;
export async function signOut() { if (configured) await supabase.auth.signOut(); location.replace('login.html'); }
export async function initAppNav(active) {
  document.querySelectorAll('[data-signout]').forEach(button => button.addEventListener('click', signOut));
  document.querySelectorAll('.app-nav a').forEach(a => { if (a.getAttribute('href') === active) a.classList.add('active'); });
  if (configured) { try { const user = await getCurrentUser(); if (user) { const el = document.querySelector('[data-user-email]'); if (el) el.textContent = user.email; } } catch (error) { console.error(error); } }
}
