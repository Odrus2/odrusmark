import { supabase, requireConfiguration, presentError } from './supabase.js';
const form = document.querySelector('#reset-form'), message = document.querySelector('#form-message');
form?.addEventListener('submit', async event => {
  event.preventDefault(); message.textContent = '';
  if (!requireConfiguration()) return;
  const password = form.elements.password.value, confirm = form.elements.confirm_password.value;
  if (password.length < 10) { message.textContent = 'Use a password with at least 10 characters.'; return; }
  if (password.length > 72 || password !== confirm) { message.textContent = password !== confirm ? 'The passwords do not match.' : 'Password must be 72 characters or fewer.'; return; }
  const button = form.querySelector('button'); button.disabled = true;
  try { const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; message.textContent = 'Password updated. You can now log in.'; message.className = 'form-message success'; }
  catch (error) { message.textContent = presentError(error); }
  finally { button.disabled = false; }
});
