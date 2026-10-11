import { supabase, requireUser, presentError } from './supabase.js';
import { initAppNav, esc, statusLabel, dateLabel, badge } from './ui.js';
import { initCopilot } from './copilot.js';

await initAppNav('dashboard.html');
const user = await requireUser();
const retry = selector => document.querySelector(selector)?.addEventListener('click', () => location.reload());

if (user) {
  if (new URLSearchParams(location.search).get('confirmed') === '1') {
    const notice = document.createElement('div');
    notice.className = 'notice';
    notice.textContent = 'Email confirmed. Your account is ready.';
    document.querySelector('.app-main')?.prepend(notice);
  }
  document.querySelector('#welcome-name').textContent = user.user_metadata?.full_name || user.email?.split('@')[0] || 'there';
  const projectArea = document.querySelector('#projects-content');
  let projects = [];
  let projectLoadFailed = false;
  try {
    const { data, error } = await supabase.from('projects')
      .select('id,title,objective,success_criteria,known_context,attempted,target_completion_date,desired_timeline,status,created_at,updated_at')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    projects = data || [];
    const active = projects.filter(project => ['submitted','under_review','scoped','active','on_hold'].includes(project.status));
    document.querySelector('#stat-total').textContent = projects.length;
    document.querySelector('#stat-active').textContent = active.length;
    document.querySelector('#stat-completed').textContent = projects.filter(project => project.status === 'completed').length;
    document.querySelector('#stat-attention').textContent = projects.filter(project => project.status === 'awaiting_client').length;
    if (!projects.length) {
      projectArea.innerHTML = `<div class="empty-state"><h3>Nothing in motion yet.</h3><p>Start with what you want to accomplish. Odrusmark will help discover the how.</p><a class="button" href="new-project.html">Start your first project <span>↗</span></a></div>`;
    } else {
      projectArea.innerHTML = `<div class="request-table-wrap"><table class="request-table"><thead><tr><th>PROJECT</th><th>STATUS</th><th>TARGET DATE</th><th>UPDATED</th></tr></thead><tbody>${projects.map(project => `<tr><td><a href="project.html?id=${encodeURIComponent(project.id)}">${esc(project.title)}</a><div class="muted">Open project workspace</div></td><td>${badge(`status-${project.status}`, statusLabel(project.status))}</td><td>${project.target_completion_date ? dateLabel(project.target_completion_date) : project.desired_timeline ? esc(project.desired_timeline) : 'Not set'}</td><td>${dateLabel(project.updated_at)}</td></tr>`).join('')}</tbody></table></div>`;
    }
  } catch (error) {
    projectLoadFailed = true;
    projectArea.innerHTML = `<div class="inline-message">${esc(presentError(error))} <button class="link-button" id="retry-projects">Try again</button></div>`;
    retry('#retry-projects');
  }
  await initCopilot(projects, { loadFailed: projectLoadFailed });

  const researchArea = document.querySelector('#research-content');
  try {
    const { data, error } = await supabase.from('research_requests')
      .select('id,title,category,status,priority,created_at,updated_at').order('created_at', { ascending: false });
    if (error) throw error;
    const requests = data || [];
    if (!requests.length) researchArea.innerHTML = '<div class="empty-state"><p>No standalone research requests. Research can also be part of a project.</p></div>';
    else researchArea.innerHTML = `<div class="request-table-wrap"><table class="request-table"><thead><tr><th>REQUEST</th><th>STATUS</th><th>PRIORITY</th><th>SUBMITTED</th></tr></thead><tbody>${requests.map(request => `<tr><td><a href="request-details.html?id=${encodeURIComponent(request.id)}">${esc(request.title)}</a><div class="muted">${esc(request.category)}</div></td><td>${badge(`status-${request.status}`, statusLabel(request.status))}</td><td>${badge(`priority-${request.priority}`, request.priority)}</td><td>${dateLabel(request.created_at)}</td></tr>`).join('')}</tbody></table></div>`;
  } catch (error) {
    researchArea.innerHTML = `<div class="inline-message">${esc(presentError(error))} <button class="link-button" id="retry-research">Try again</button></div>`;
    retry('#retry-research');
  }
}
