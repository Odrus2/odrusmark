import { supabase, requireUser, presentError } from './supabase.js';
import { initAppNav, esc, statusLabel, dateLabel, badge } from './ui.js';
await initAppNav('dashboard.html');
const user = await requireUser();
if (user) {
  const content = document.querySelector('#request-detail-content'), id = new URLSearchParams(location.search).get('id');
  if (!id || id.length > 80) { content.innerHTML = '<div class="error-page"><h2>Research request not found</h2><p>Open a request from your dashboard.</p><a class="text-link" href="dashboard.html">Return to dashboard →</a></div>'; }
  else try {
    const { data: r, error } = await supabase.from('research_requests').select('id,title,category,description,research_question,desired_outcome,additional_information,deadline,status,priority,created_at,updated_at').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!r) { content.innerHTML = '<div class="error-page"><h2>Research request not found</h2><p>It may have been removed, or you may not have access.</p><a class="text-link" href="dashboard.html">Return to dashboard →</a></div>'; }
    else {
      document.querySelector('#page-title').textContent = r.title;
      const timeline = ['submitted','under_review','approved','in_progress','completed'], order = r.status === 'awaiting_client' ? 3 : timeline.indexOf(r.status);
      const labels = timeline.map(status => ({submitted:'Submitted',under_review:'Under review',approved:'Approved',in_progress:'In progress',completed:'Completed'})[status]);
      content.innerHTML = `<div class="details-grid"><section class="panel"><div class="panel-heading"><h2>Request overview</h2>${badge(r.status === 'awaiting_client' ? 'status-awaiting_client' : `status-${r.status}`, statusLabel(r.status))}</div><div class="detail-content"><h2>${esc(r.title)}</h2><p>${esc(r.category)}</p><div class="detail-label">PROBLEM / BACKGROUND</div><div class="detail-value">${esc(r.description)}</div><div class="detail-label">RESEARCH QUESTION</div><div class="detail-value">${esc(r.research_question)}</div><div class="detail-label">DESIRED OUTCOME</div><div class="detail-value">${esc(r.desired_outcome)}</div>${r.additional_information ? `<div class="detail-label">ADDITIONAL INFORMATION</div><div class="detail-value">${esc(r.additional_information)}</div>` : ''}</div></section><aside><section class="panel detail-meta"><div class="panel-heading" style="padding:0 0 15px"><h2>Request details</h2></div><dl><dt>PRIORITY</dt><dd>${badge(`priority-${r.priority}`,r.priority)}</dd><dt>DEADLINE</dt><dd>${dateLabel(r.deadline)}</dd><dt>SUBMITTED</dt><dd>${dateLabel(r.created_at)}</dd><dt>LAST UPDATED</dt><dd>${dateLabel(r.updated_at)}</dd></dl></section><section class="panel" style="margin-top:15px"><div class="panel-heading"><h2>Research progress</h2></div><ol class="timeline">${labels.map((label,i) => `<li class="${order >= i ? 'done' : ''}">${label}${r.status === 'awaiting_client' && i === 3 ? ' · Awaiting your response' : ''}</li>`).join('')}${r.status === 'cancelled' ? '<li class="done">Cancelled</li>' : ''}</ol><p class="timeline-note">Status updates appear here as your request moves forward.</p></section></aside></div>`;
      if (new URLSearchParams(location.search).get('created')) { const note = document.querySelector('#confirmation'); note.textContent = 'Your research request has been submitted.'; note.hidden = false; }
    }
  } catch (error) { content.innerHTML = `<div class="inline-message">${esc(presentError(error))}</div>`; }
}
