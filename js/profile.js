import { supabase, requireUser, presentError } from './supabase.js';
import { initAppNav, esc } from './ui.js';
await initAppNav('profile.html');
const user = await requireUser();
const form = document.querySelector('#profile-form'), message = document.querySelector('#form-message');
const show = (text, ok = false) => { message.textContent = text; message.className = `form-message ${ok ? 'success' : ''}`; };
if (user) {
  const { data: profile, error } = await supabase.from('profiles').select('full_name,email').eq('id', user.id).maybeSingle();
  if (error) show(presentError(error));
  form.elements.full_name.value = profile?.full_name || user.user_metadata?.full_name || '';
  form.elements.email.value = user.email || '';
  form.addEventListener('submit', async event => {
    event.preventDefault(); show('');
    const fullName = form.elements.full_name.value.trim();
    if (fullName.length < 2 || fullName.length > 120) return show('Name must be between 2 and 120 characters.');
    const button = form.querySelector('button[type=submit]'); button.disabled = true; button.textContent = 'Saving…';
    try {
      const { error: updateError } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id);
      if (updateError) throw updateError;
      const { error: metadataError } = await supabase.auth.updateUser({ data: { full_name: fullName } });
      if (metadataError) throw metadataError;
      show('Your profile has been updated.', true);
    } catch (error) { show(presentError(error)); }
    finally { button.disabled = false; button.textContent = 'Save profile ↗'; }
  });
}
