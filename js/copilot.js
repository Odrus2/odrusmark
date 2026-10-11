import { supabase } from './supabase.js';
import { esc, dateLabel } from './ui.js';

const projectSelect = document.querySelector('#copilot-project');
const thread = document.querySelector('#copilot-thread');
const form = document.querySelector('#copilot-form');
const messageInput = document.querySelector('#copilot-message');
const consent = document.querySelector('#copilot-consent');
const sendButton = document.querySelector('#copilot-send');
const status = document.querySelector('#copilot-status');
const actions = [...document.querySelectorAll('[data-copilot-mode]')];
const modes = {
  ask: 'Project question',
  clarify: 'Clarify my project',
  plan: 'Draft an investigation plan',
  research: 'Research with sources'
};
let selectedMode = 'ask';
let pending = false;
let userProjects = [];
let historyReady = false;

export async function initCopilot(projects, { loadFailed = false } = {}) {
  userProjects = Array.isArray(projects) ? projects : [];
  projectSelect.replaceChildren();
  if (!userProjects.length) {
    const option = new Option(loadFailed ? 'Projects unavailable' : 'Create a project to begin', '');
    projectSelect.add(option);
    projectSelect.disabled = true;
    thread.innerHTML = loadFailed
      ? '<div class="copilot-welcome"><strong>Your projects could not be loaded.</strong><p>Try again from the projects panel above. The copilot needs a project before it can help.</p></div>'
      : '<div class="copilot-welcome"><strong>Your copilot is ready when your first project is.</strong><p>Create a project first, then it can help clarify that brief, plan the investigation or research its question.</p><a class="text-link" href="new-project.html">Start a project ↗</a></div>';
    status.textContent = loadFailed ? 'The copilot is waiting for your project list.' : '';
    return;
  }
  projectSelect.disabled = false;
  for (const project of userProjects) projectSelect.add(new Option(project.title, project.id));
  const remembered = localStorage.getItem('odrusmark-copilot-project');
  if (remembered && userProjects.some(project => project.id === remembered)) projectSelect.value = remembered;
  historyReady = await loadHistory();
  updateAvailability();
  projectSelect.addEventListener('change', async () => {
    localStorage.setItem('odrusmark-copilot-project', projectSelect.value);
    selectedMode = 'ask';
    historyReady = false;
    messageInput.disabled = true;
    sendButton.disabled = true;
    status.textContent = 'Loading this project’s copilot history…';
    actions.forEach(button => button.setAttribute('aria-pressed', 'false'));
    messageInput.value = '';
    historyReady = await loadHistory();
    updateAvailability();
  });
  consent.addEventListener('change', updateAvailability);
  actions.forEach(button => button.addEventListener('click', () => {
    selectedMode = button.dataset.copilotMode;
    actions.forEach(action => action.setAttribute('aria-pressed', String(action === button)));
    const prompts = {
      clarify: 'Review this project brief. Identify what is clear, what is still uncertain, and the most important questions to answer. Ask me up to three focused questions, then suggest a clearer draft objective. Do not change my saved project.',
      plan: 'Draft a practical investigation plan for this project. Include the decision to support, research questions, evidence to gather, proposed methods, milestones, risks and the final decision-ready deliverable. Label assumptions and do not promise a completion date or outcome.',
      research: 'Research the key question in this project using current web sources. Separate sourced facts from assumptions, cite the sources you used, compare conflicting evidence and identify what remains unknown.'
    };
    if (!messageInput.value.trim()) messageInput.value = prompts[selectedMode] || '';
    messageInput.focus();
    updateAvailability();
  }));
  form.addEventListener('submit', sendMessage);
}

function updateAvailability() {
  projectSelect.disabled = !userProjects.length || pending;
  actions.forEach(button => { button.disabled = pending; });
  const canUse = Boolean(projectSelect.value && historyReady && consent.checked && !pending);
  messageInput.disabled = !canUse;
  sendButton.disabled = !canUse || !messageInput.value.trim();
  if (!pending) {
    if (!historyReady) status.textContent = 'The AI migration must be applied in Supabase before the copilot can be used.';
    else status.textContent = canUse ? `Using: ${modes[selectedMode]}.` : consent.checked ? 'Choose a project to continue.' : 'Review and accept the AI data-use notice to use the copilot.';
  }
}

messageInput.addEventListener('input', updateAvailability);

async function loadHistory() {
  thread.replaceChildren();
  const selected = projectSelect.value || userProjects[0]?.id;
  if (!selected) return;
  const { data, error } = await supabase.from('project_ai_messages')
    .select('id,role,content,mode,sources,created_at')
    .eq('project_id', selected).order('created_at', { ascending: true }).limit(60);
  if (error) {
    thread.innerHTML = '<div class="copilot-welcome"><strong>AI history is not set up yet.</strong><p>Odrusmark needs to finish configuring the project copilot before it can be used.</p></div>';
    return false;
  }
  if (!data?.length) {
    thread.innerHTML = '<div class="copilot-welcome"><strong>Start with the project question.</strong><p>Choose an action above, or ask what you need to understand or decide. Odrusmark staff review and verify findings before they become official project updates.</p></div>';
    return true;
  }
  for (const item of data) renderMessage(item);
  thread.scrollTop = thread.scrollHeight;
  return true;
}

function renderMessage(item, { pending: isPending = false } = {}) {
  const article = document.createElement('article');
  article.className = `copilot-message ${item.role === 'assistant' ? 'copilot-message-ai' : 'copilot-message-client'}`;
  const header = document.createElement('div');
  header.className = 'copilot-message-meta';
  const who = document.createElement('strong');
  who.textContent = item.role === 'assistant' ? 'Odrusmark AI · Draft' : 'You';
  const when = document.createElement('span');
  when.textContent = isPending ? 'Working…' : item.created_at ? dateLabel(item.created_at) : '';
  header.append(who, when);
  const body = document.createElement('p');
  body.className = 'copilot-message-body';
  body.textContent = item.content || '';
  article.append(header, body);
  const sources = Array.isArray(item.sources) ? item.sources : [];
  if (sources.length) {
    const sourceWrap = document.createElement('div');
    sourceWrap.className = 'copilot-sources';
    const label = document.createElement('strong');
    label.textContent = 'Sources';
    sourceWrap.append(label);
    sources.forEach((source, index) => {
      try {
        const url = new URL(source.url);
        if (url.protocol !== 'https:') return;
        const link = document.createElement('a');
        link.href = url.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = `[${index + 1}] ${source.title || url.hostname}`;
        sourceWrap.append(link);
      } catch { /* Ignore malformed source URLs. */ }
    });
    article.append(sourceWrap);
  }
  thread.append(article);
  thread.scrollTop = thread.scrollHeight;
  return article;
}

async function sendMessage(event) {
  event.preventDefault();
  const projectId = projectSelect.value;
  const message = messageInput.value.trim();
  if (!projectId || !message || pending || !consent.checked) return;
  if (message.length > 2500) { status.textContent = 'Keep your question under 2,500 characters.'; return; }
  pending = true;
  const submit = { role: 'user', content: message, mode: selectedMode };
  renderMessage(submit, { pending: true });
  messageInput.value = '';
  updateAvailability();
  status.textContent = 'Odrusmark AI is working on your project…';
  try {
    const { data, error } = await supabase.functions.invoke('odrusmark-copilot', {
      body: { projectId, message, mode: selectedMode, consent: consent.checked }
    });
    if (error) {
      let details = '';
      try { details = await error.context?.json?.().then(value => value.error || '').catch(() => ''); } catch { /* optional details */ }
      throw new Error(details || error.message || 'The project copilot could not respond.');
    }
    const { data: saved, error: saveError } = await supabase.from('project_ai_messages')
      .select('id,role,content,mode,sources,created_at').eq('project_id', projectId)
      .order('created_at', { ascending: false }).limit(2);
    if (saveError) throw saveError;
    const sorted = (saved || []).reverse();
    thread.lastElementChild?.remove();
    for (const row of sorted) renderMessage(row);
    const quotaLabel = selectedMode === 'research' ? 'sourced research runs' : 'copilot messages';
    status.textContent = data?.remaining === 0
      ? `You have used today's limit for ${quotaLabel}.`
      : `${data?.remaining ?? 'Some'} ${quotaLabel} remain today. Verify recommendations with Odrusmark before relying on them.`;
  } catch (error) {
    const pendingBubble = thread.lastElementChild;
    if (pendingBubble?.querySelector('.copilot-message-meta span')?.textContent === 'Working…') pendingBubble.remove();
    const errorMessage = document.createElement('div');
    errorMessage.className = 'copilot-error';
    errorMessage.textContent = error.message || 'The project copilot is temporarily unavailable. Please try again.';
    thread.append(errorMessage);
    messageInput.value = message;
    status.textContent = 'Your message was not lost. Check the connection and try again.';
  } finally {
    pending = false;
    updateAvailability();
    thread.scrollTop = thread.scrollHeight;
  }
}
