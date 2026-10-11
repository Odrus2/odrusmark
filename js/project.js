import { supabase, requireUser, presentError } from './supabase.js';
import { initAppNav, esc, dateLabel, badge } from './ui.js';
await initAppNav('');
const user = await requireUser();
const form = document.querySelector('#project-form'), message = document.querySelector('#form-message');
if (form && user) form.addEventListener('submit', async event => {
  event.preventDefault(); message.textContent = '';
  if (!form.reportValidity()) return;
  const f = new FormData(form), payload = { title:String(f.get('title')).trim(), objective:String(f.get('objective')).trim(), success_criteria:String(f.get('success_criteria') || '').trim() || null, known_context:String(f.get('known_context') || '').trim() || null, attempted:String(f.get('attempted') || '').trim() || null, target_completion_date:String(f.get('desired_timeline') || '') || null };
  const files = [...(form.elements.attachments?.files || [])];
  if (payload.title.length < 5 || payload.objective.length < 20) { message.textContent = 'Add a project title and describe what you want to accomplish.'; return; }
  if (files.length > 5 || files.some(file => file.size > 10 * 1024 * 1024 || !/\.(pdf|txt|csv|jpe?g|png|webp|docx?|xlsx?)$/i.test(file.name))) { message.textContent = 'Choose up to 5 supported files, each no larger than 10 MB.'; return; }
  const button = form.querySelector('button[type=submit]'); button.disabled = true; button.textContent = 'Creating project…';
  try {
    const { data, error } = await supabase.from('projects').insert(payload).select('id').single();
    if (error) throw error;
    for (const file of files) {
      const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'attachment';
      const path = `${user.id}/${data.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('odrusmark-project-files').upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (uploadError) { console.error(uploadError); location.replace(`project.html?id=${encodeURIComponent(data.id)}&created=1&upload_error=1`); return; }
    }
    location.replace(`project.html?id=${encodeURIComponent(data.id)}&created=1`);
  } catch (error) { message.textContent = presentError(error); button.disabled = false; button.textContent = 'Create project ↗'; }
});

if (!form && user) {
  const content = document.querySelector('#project-content'), id = new URLSearchParams(location.search).get('id');
  if (!id || id.length > 80) { content.innerHTML = '<div class="error-page"><h2>Project not found</h2><p>Open a project from your workspace.</p><a class="text-link" href="dashboard.html">Return to overview →</a></div>'; }
  else try {
    const { data: p, error } = await supabase.from('projects').select('id,title,objective,success_criteria,known_context,attempted,desired_timeline,target_completion_date,status,created_at,updated_at').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!p) { content.innerHTML = '<div class="error-page"><h2>Project not found</h2><p>It may have been removed, or you may not have access.</p><a class="text-link" href="dashboard.html">Return to overview →</a></div>'; return; }
    document.title = `${p.title} — Odrusmark`;
    document.querySelector('#project-crumb').textContent = p.title.toUpperCase();
    const created = new URLSearchParams(location.search).get('created') === '1';
    const optional = (label, value) => value ? `<div class="detail-label">${label}</div><div class="detail-value">${esc(value)}</div>` : '';
    content.innerHTML = `${created ? '<div class="notice">Your project has been created. We’ll review what you shared and follow up through the contact details on your account.</div>' : ''}${new URLSearchParams(location.search).get('upload_error') ? '<div class="inline-message">The project was created, but an attachment could not be uploaded. Please contact us to arrange a secure transfer for the remaining files.</div>' : ''}<div class="app-title-row"><div><p class="eyebrow">PROJECT OVERVIEW</p><h1>${esc(p.title)}</h1><p>Created ${dateLabel(p.created_at)} · Updated ${dateLabel(p.updated_at)}</p></div>${badge(`status-${p.status}`, p.status.replaceAll('_',' '))}</div><section class="panel"><div class="panel-heading"><h2>Objective</h2><span class="muted">Project overview</span></div><div class="detail-content"><div class="detail-value">${esc(p.objective)}</div>${optional('WHAT SUCCESS LOOKS LIKE',p.success_criteria)}${optional('WHAT YOU ALREADY KNOW',p.known_context)}${optional('WHAT YOU HAVE TRIED',p.attempted)}${optional('REQUESTED COMPLETION DATE',p.target_completion_date ? new Date(p.target_completion_date + 'T00:00:00').toLocaleDateString() : p.desired_timeline)}</div></section><section class="workspace-section" id="research"><div class="panel-heading"><h2>Research</h2></div><p>Research can be scoped as part of this project after Odrusmark reviews your objective.</p></section><section class="workspace-section" id="tasks"><div class="panel-heading"><h2>Tasks & activity</h2></div><p>Project tasks and activity tracking are planned for a future workspace update.</p></section><section class="workspace-section" id="ideas"><div class="panel-heading"><h2>Ideas & experiments</h2></div><p>Idea development and experimentation can be added as this project is scoped.</p></section><section class="workspace-section" id="files"><div class="panel-heading"><h2>Files & data</h2></div><div id="project-files-list" class="detail-content">Loading private project files…</div></section><section class="workspace-section" id="findings"><div class="panel-heading"><h2>Findings & deliverables</h2></div><p>There are no findings or deliverables to show yet.</p></section><section class="workspace-section" id="deliverables"><div class="panel-heading"><h2>Deliverables</h2></div><p>Deliverables will appear here when they are part of the agreed project scope.</p></section><section class="workspace-section" id="messages"><div class="panel-heading"><h2>Messages</h2></div><p>Project messaging is not enabled yet. Contact <a href="mailto:hello@odrusmark.com">hello@odrusmark.com</a> and include your project title.</p></section><section class="workspace-section" id="activity"><div class="panel-heading"><h2>Progress updates</h2></div><div id="project-updates" class="detail-content">Loading updates…</div></section>`;
    const updatesBox = document.querySelector('#project-updates');
    const { data: updates, error: updatesError } = await supabase.from('project_updates').select('id,title,body,created_at').eq('project_id', p.id).order('created_at', { ascending: false });
    if (updatesError) updatesBox.textContent = 'Progress updates are unavailable. Please refresh later.';
    else if (!updates?.length) updatesBox.textContent = 'Odrusmark has not posted a progress update yet. New updates will appear here.';
    else updatesBox.innerHTML = `<div class="update-list">${updates.map(update => `<article class="panel"><h3>${esc(update.title)}</h3><p class="muted">${dateLabel(update.created_at)}</p><p>${esc(update.body).replaceAll('\\n','<br>')}</p></article>`).join('')}</div>`;
    const filesBox = document.querySelector('#project-files-list');
    const folder = `${user.id}/${p.id}`;
    const { data: files, error: listError } = await supabase.storage.from('odrusmark-project-files').list(folder);
    if (listError) filesBox.textContent = 'Project file listing is unavailable right now.';
    else if (!files?.length) filesBox.textContent = 'No files have been added to this project.';
    else {
      const links = await Promise.all(files.filter(file => file.name && !file.name.startsWith('.')).map(async file => {
        const { data: signed, error: signedError } = await supabase.storage.from('odrusmark-project-files').createSignedUrl(`${folder}/${file.name}`, 300);
        const name = file.name.replace(/^[0-9a-f-]{36}-/i, '');
        return signedError ? `<li>${esc(name)} — unavailable</li>` : `<li><a href="${esc(signed.signedUrl)}" target="_blank" rel="noopener noreferrer">${esc(name)} ↗</a></li>`;
      }));
      filesBox.innerHTML = `<ul>${links.join('')}</ul>`;
    }
  } catch (error) { content.innerHTML = `<div class="inline-message">${esc(presentError(error))}</div>`; }
}
