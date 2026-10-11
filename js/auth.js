import { supabase, requireConfiguration, presentError, safeNextPath } from './supabase.js';

const signupForm = document.querySelector('#signup-form');
const loginForm = document.querySelector('#login-form');
const message = document.querySelector('#form-message');
function show(text, kind = '') { if (!message) return; message.textContent = text; message.className = `form-message ${kind}`; }
function busy(form, yes, text = 'Please wait…') { const button = form.querySelector('button[type="submit"]'); button.disabled = yes; button.dataset.original ||= button.textContent; button.textContent = yes ? text : button.dataset.original; }

if (signupForm) signupForm.addEventListener('submit', async event => {
  event.preventDefault(); show('');
  if (!requireConfiguration()) return;
  const form = new FormData(signupForm), fullName = String(form.get('full_name')).trim(), email = String(form.get('email')).trim().toLowerCase(), password = String(form.get('password')), confirm = String(form.get('confirm_password'));
  if (fullName.length < 2) return show('Enter your full name.');
  if (fullName.length > 120) return show('Name must be 120 characters or fewer.');
  if (!signupForm.elements.email.validity.valid) return show('Enter a valid email address.');
  if (password.length < 10) return show('Use a password with at least 10 characters.');
  if (password.length > 72) return show('Password must be 72 characters or fewer.');
  if (password !== confirm) return show('The passwords do not match.');
  busy(signupForm, true);
  try {
    const redirectTo = new URL('dashboard.html?confirmed=1', location.href).href;
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: redirectTo } });
    if (error) throw error;
    if (data.session) window.location.replace('dashboard.html');
    else show('Account created. Check your email for a confirmation link before logging in.', 'success');
  } catch (error) { show(presentError(error)); }
  finally { busy(signupForm, false); }
});

if (loginForm) loginForm.addEventListener('submit', async event => {
  event.preventDefault(); show('');
  if (!requireConfiguration()) return;
  const email = String(new FormData(loginForm).get('email')).trim().toLowerCase(), password = String(new FormData(loginForm).get('password'));
  if (!email || !password) return show('Enter your email and password.');
  busy(loginForm, true, 'Logging in…');
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const next = safeNextPath(new URLSearchParams(location.search).get('next'));
    window.location.replace(next);
  } catch (error) { show(presentError(error)); }
  finally { busy(loginForm, false); }
});

const forgot = document.querySelector('#forgot-password');
if (forgot) forgot.addEventListener('click', async event => {
  event.preventDefault();
  if (!requireConfiguration()) return;
  const email = loginForm.elements.email.value.trim().toLowerCase();
  if (!email || !loginForm.elements.email.validity.valid) return show('Enter your email address above first.');
  busy(loginForm, true, 'Sending…');
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: new URL('reset-password.html', location.href).href });
    if (error) throw error;
    show('If an account exists for that address, a password reset link is on its way.', 'success');
  } catch (error) { show(presentError(error)); }
  finally { busy(loginForm, false); }
});
