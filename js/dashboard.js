import { supabase, requireUser, presentError } from './supabase.js';
import { initAppNav, esc, statusLabel, dateLabel, badge } from './ui.js';
await initAppNav('dashboard.html');
const user = await requireUser();
const retry = id => document.querySelector(id)?.addEventListener('click', () => location.reload());
if (user) {
  document.querySelector('#welcome-name').textContent = user.user_metadata?.full_name || user.email?.split('@')[0] || 'there';
  const projectArea = document.querySelector('#projects-content');
  try {
    const { data, error } = await supabase.from('projects').select('id,title,status,created_at,updated_at').order('updated_at', { ascending: false });
    if (error) throw error;
    const projects = data || [], active = projects.filter(p => ['submitted','under_review','scoped','active','on_hold'].includes(p.status));
    document.querySelector('#stat-active').textContent = active.length;
    document.querySelector('#stat-completed').textContent = projects.filter(p => p.status === 'completed').length;
    document.querySelector('#stat-attention').textContent = projects.filter(p => p.status === 'awaiting_client').length;
    if (!projects.length) projectArea.innerHTML = `<div class="empty-state"><h3>Nothing in motion yet.</h3><p>Tell us what you want to accomplish. You don't need to know how to solve it.</p><a class="button" href="new-project.html">Start your first project <span>↗</span></a></div>`;
    else projectArea.innerHTML = `<div class="request-table-wrap"><table class="request-table"><thead><tr><th>PROJECT</th><th>STATUS</th><th>STARTED</th><th>UPDATED</th></tr></thead><tbody>${projects.map(p => `<tr><td><a href="project.html?id=${encodeURIComponent(p.id)}">${esc(p.title)}</a><div class="muted">Project workspace</div></td><td>${badge(`status-${p.status}`, statusLabel(p.status))}</td><td>${dateLabel(p.created_at)}</td><td>${dateLabel(p.updated_at)}</td></tr>`).join('')}</tbody></table></div>`;
  } catch (error) { projectArea.innerHTML = `<div class="inline-message">${esc(presentError(error))} <button class="link-button" id="retry-projects">Try again</button></div>`; retry('#retry-projects'); }
  const researchArea = document.querySelector('#research-content');
  try {
    const { data, error } = await supabase.from('research_requests').select('id,title,category,status,priority,created_at,updated_at').order('created_at', { ascending: false });
    if (error) throw error;
    const requests = data || [];
    if (!requests.length) researchArea.innerHTML = '<div class="empty-state"><p>No standalone research requests. Research can also be part of a project.</p></div>';
    else researchArea.innerHTML = `<div class="request-table-wrap"><table class="request-table"><thead><tr><th>REQUEST</th><th>STATUS</th><th>PRIORITY</th><th>SUBMITTED</th></tr></thead><tbody>${requests.map(r => `<tr><td><a href="request-details.html?id=${encodeURIComponent(r.id)}">${esc(r.title)}</a><div class="muted">${esc(r.category)}</div></td><td>${badge(`status-${r.status}`, statusLabel(r.status))}</td><td>${badge(`priority-${r.priority}`, r.priority)}</td><td>${dateLabel(r.created_at)}</td></tr>`).join('')}</tbody></table></div>`;
  } catch (error) { researchArea.innerHTML = `<div class="inline-message">${esc(presentError(error))} <button class="link-button" id="retry-research">Try again</button></div>`; retry('#retry-research'); }
}
