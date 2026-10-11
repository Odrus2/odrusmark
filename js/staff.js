import { supabase, requireUser, presentError } from './supabase.js';
import { initAppNav, esc, dateLabel } from './ui.js';
await initAppNav('');
const user = await requireUser();
const root = document.querySelector('#staff-content');
if (user) {
  try {
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profileError) throw profileError;
    if (!['researcher','admin'].includes(profile.role)) {
      root.innerHTML = '<div class="inline-message">This page is restricted to Odrusmark research staff.</div>';
    } else await loadProjects();
  } catch (error) { root.innerHTML = `<div class="inline-message">${esc(presentError(error))}</div>`; }
}

async function loadProjects() {
  const { data, error } = await supabase.from('projects').select('id,owner_id,title,objective,success_criteria,known_context,attempted,target_completion_date,status,created_at').order('created_at',{ascending:false});
  if (error) throw error;
  if (!data?.length) { root.innerHTML = '<div class="empty-state"><h2>No submissions yet</h2><p>New client projects will appear here.</p></div>'; return; }
  const statuses=['submitted','under_review','scoped','active','on_hold','awaiting_client','completed','cancelled'];
  root.innerHTML = `<div class="staff-project-list">${data.map(p=>`<article class="panel staff-project"><div class="app-title-row"><div><p class="eyebrow">SUBMITTED ${dateLabel(p.created_at)}</p><h2>${esc(p.title)}</h2></div><span class="muted">Client ${esc(p.owner_id)}</span></div><div class="detail-content"><div class="detail-label">OBJECTIVE</div><p>${esc(p.objective)}</p>${p.target_completion_date?`<p><strong>Requested completion:</strong> ${esc(p.target_completion_date)}</p>`:''}${p.success_criteria?`<p><strong>Success:</strong> ${esc(p.success_criteria)}</p>`:''}${p.known_context?`<p><strong>Context:</strong> ${esc(p.known_context)}</p>`:''}${p.attempted?`<p><strong>Already tried:</strong> ${esc(p.attempted)}</p>`:''}</div><form class="staff-update-form" data-project-id="${esc(p.id)}"><div class="field"><label>Status</label><select name="status">${statuses.map(s=>`<option value="${s}" ${p.status===s?'selected':''}>${s.replaceAll('_',' ')}</option>`).join('')}</select></div><div class="field"><label>Update title</label><input name="title" maxlength="160" placeholder="e.g. Research plan agreed"></div><div class="field"><label>Progress update for client</label><textarea name="body" maxlength="10000" placeholder="Share progress, findings, next steps or what you need from the client."></textarea></div><p class="form-message" aria-live="polite"></p><button class="button" type="submit">Save status / post update ↗</button></form></article>`).join('')}</div>`;
  root.querySelectorAll('.staff-update-form').forEach(form=>form.addEventListener('submit', saveUpdate));
}

async function saveUpdate(event) {
  event.preventDefault();
  const form=event.currentTarget, projectId=form.dataset.projectId, fields=new FormData(form), message=form.querySelector('.form-message'), button=form.querySelector('button[type="submit"]');
  const status=String(fields.get('status')), title=String(fields.get('title')||'').trim(), body=String(fields.get('body')||'').trim();
  if ((title && !body) || (!title && body)) { message.textContent='Enter both an update title and its details, or leave both blank to change status only.'; return; }
  button.disabled=true; message.textContent='Saving…';
  try {
    const {error: statusError}=await supabase.from('projects').update({status}).eq('id',projectId);
    if(statusError) throw statusError;
    if(title && body) { const {error:updateError}=await supabase.from('project_updates').insert({project_id:projectId,title,body}); if(updateError) throw updateError; }
    message.textContent=title?'Status and client update saved.':'Status saved.';
    if(title) { form.elements.title.value=''; form.elements.body.value=''; }
  } catch(error) { message.textContent=presentError(error); }
  finally { button.disabled=false; }
}
