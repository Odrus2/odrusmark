import { supabase, requireUser, presentError } from './supabase.js';
import { initAppNav, esc } from './ui.js';
await initAppNav('request.html');
const user = await requireUser();
const form = document.querySelector('#request-form'), message = document.querySelector('#form-message');
const show = (text, ok = false) => { message.textContent = text; message.className = `form-message ${ok ? 'success' : ''}`; };
if (form && user) form.addEventListener('submit', async event => {
  event.preventDefault(); show('');
  if (!form.reportValidity()) return;
  const f = new FormData(form), payload = { title:String(f.get('title')).trim(), category:String(f.get('category')), description:String(f.get('description')).trim(), research_question:String(f.get('research_question')).trim(), desired_outcome:String(f.get('desired_outcome')).trim(), deadline:f.get('deadline') || null, priority:String(f.get('priority')), additional_information:String(f.get('additional_information') || '').trim() || null };
  if (payload.title.length < 5 || payload.title.length > 160) return show('Title must be between 5 and 160 characters.');
  if (payload.description.length < 20 || payload.description.length > 10000) return show('Background must be between 20 and 10,000 characters.');
  if (payload.research_question.length < 10 || payload.research_question.length > 3000) return show('Research question must be between 10 and 3,000 characters.');
  if (payload.desired_outcome.length > 3000 || (payload.additional_information && payload.additional_information.length > 5000)) return show('Please shorten the outcome or additional information.');
  if (payload.deadline && new Date(`${payload.deadline}T23:59:59`) < new Date()) return show('Choose a future deadline.');
  const button = form.querySelector('button[type=submit]'); button.disabled = true; button.textContent = 'Submitting…';
  try {
    const { data, error } = await supabase.from('research_requests').insert(payload).select('id').single();
    if (error) throw error;
    window.location.replace(`request-details.html?id=${encodeURIComponent(data.id)}&created=1`);
  } catch (error) { show(esc(presentError(error))); button.disabled = false; button.textContent = 'Submit research request ↗'; }
});
