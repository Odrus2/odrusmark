import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './config.js';

export const configured = isSupabaseConfigured();
export const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;

export function requireConfiguration() {
  if (configured) return true;
  let message = document.querySelector('[data-config-message]');
  if (!message) {
    message = document.createElement('p');
    message.className = 'inline-message';
    message.setAttribute('data-config-message', '');
    document.querySelector('main')?.prepend(message);
  }
  message.textContent = 'Connect your Supabase project to enable accounts and research requests. Add the project URL and anon key in js/config.js.';
  message.hidden = false;
  return false;
}

export async function getCurrentUser() {
  if (!configured) return null;
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) return null;
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  return user;
}

export async function requireUser({ redirect = true } = {}) {
  if (!requireConfiguration()) return null;
  try {
    const user = await getCurrentUser();
    if (!user && redirect) window.location.replace(`login.html?next=${encodeURIComponent(location.pathname.split('/').pop() + location.search)}`);
    return user;
  } catch (error) {
    console.error(error);
    if (redirect) window.location.replace('login.html?notice=session');
    return null;
  }
}

export function safeNextPath(value) {
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|\\)/i.test(value) || value.includes('..')) return 'dashboard.html';
  const [path] = value.split(/[?#]/);
  const allowed = ['dashboard.html', 'request.html', 'profile.html', 'request-details.html'];
  return allowed.includes(path) ? value : 'dashboard.html';
}

export function presentError(error) {
  const code = error?.code;
  if (code === '23505' || /already registered|already exists/i.test(error?.message || '')) return 'An account with this email already exists. Try logging in instead.';
  if (/invalid login credentials/i.test(error?.message || '')) return 'That email and password combination was not recognized.';
  if (/email not confirmed/i.test(error?.message || '')) return 'Please confirm your email using the link we sent before logging in.';
  if (/password/i.test(error?.message || '') && /least|weak|short/i.test(error?.message || '')) return error.message;
  if (/row-level security|permission denied/i.test(error?.message || '')) return 'You are not allowed to perform that action. Refresh the page and try again.';
  return 'Something went wrong. Please try again. If it continues, contact Odrusmark.';
}
