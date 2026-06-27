/* Culturepedia — main application logic */

const STORAGE_KEY = 'culturepedia';
const VOTES_KEY = 'culturepedia_votes';

let hints = [];
let votedIds = new Set();

// ── Bootstrap ──────────────────────────────────────────────

async function init() {
  loadVotes();
  await loadHints();
  populateFilters();
  bindEvents();
  render();
  registerServiceWorker();
  setupInstallPrompt();
}

async function loadHints() {
  try {
    const res = await fetch('data.json');
    const data = await res.json();
    const stored = getStoredHints();
    hints = mergeHints(data.hints, stored);
  } catch {
    hints = getStoredHints();
    showToast('Could not load data.json — showing saved hints only');
  }
}

function getStoredHints() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveStoredHints(userHints) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userHints));
}

function mergeHints(base, stored) {
  const map = new Map(base.map(h => [h.id, { ...h }]));

  for (const h of stored) {
    if (map.has(h.id)) {
      const existing = map.get(h.id);
      existing.votes = Math.max(existing.votes, h.votes);
      if (h.expertNote) existing.expertNote = h.expertNote;
    } else {
      map.set(h.id, h);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.votes - a.votes);
}

function loadVotes() {
  try {
    votedIds = new Set(JSON.parse(localStorage.getItem(VOTES_KEY) || '[]'));
  } catch {
    votedIds = new Set();
  }
}

function saveVotes() {
  localStorage.setItem(VOTES_KEY, JSON.stringify([...votedIds]));
}

// ── Filters ────────────────────────────────────────────────

function getFilters() {
  return {
    search: document.getElementById('search').value.trim().toLowerCase(),
    country: document.getElementById('filter-country').value,
    category: document.getElementById('filter-category').value,
  };
}

function filteredHints() {
  const { search, country, category } = getFilters();

  return hints.filter(h => {
    if (country && h.country !== country) return false;
    if (category && h.category !== category) return false;
    if (search) {
      const haystack = `${h.country} ${h.category} ${h.text} ${h.expertNote || ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function populateFilters() {
  const countries = [...new Set(hints.map(h => h.country))].sort();
  const categories = [...new Set(hints.map(h => h.category))].sort();

  fillSelect('filter-country', countries);
  fillSelect('filter-category', categories);
}

function fillSelect(id, options) {
  const select = document.getElementById(id);
  const current = select.value;
  const label = id === 'filter-country' ? 'All countries' : 'All categories';

  select.innerHTML = `<option value="">${label}</option>`;
  for (const opt of options) {
    select.innerHTML += `<option value="${esc(opt)}">${esc(opt)}</option>`;
  }
  select.value = current;
}

// ── Render ─────────────────────────────────────────────────

function render() {
  const list = filteredHints();
  const container = document.getElementById('hints-list');
  const count = document.getElementById('result-count');

  count.textContent = `${list.length} hint${list.length !== 1 ? 's' : ''}`;

  if (list.length === 0) {
    container.innerHTML = '<p class="text-center text-slate-400 py-12">No hints match your filters.</p>';
    return;
  }

  container.innerHTML = list.map(h => hintCard(h)).join('');
}

function hintCard(h) {
  const voted = votedIds.has(h.id);
  const expertNote = h.expertNote
    ? `<p class="text-xs text-brand-700 bg-brand-50 rounded-md px-2.5 py-1.5 mt-2 italic">💡 ${esc(h.expertNote)}</p>`
    : '';

  return `
    <article class="bg-white rounded-xl shadow-sm border border-slate-200 p-4" data-id="${esc(h.id)}">
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <span class="text-xs font-medium bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">${esc(h.country)}</span>
            <span class="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">${esc(h.category)}</span>
          </div>
          <p class="text-sm leading-relaxed">${esc(h.text)}</p>
          ${expertNote}
        </div>
      </div>
      <div class="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
        <button
          class="upvote-btn flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition
            ${voted ? 'bg-brand-100 text-brand-700 cursor-default' : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700'}"
          data-id="${esc(h.id)}"
          ${voted ? 'disabled' : ''}
        >
          ▲ <span class="vote-count">${h.votes}</span>
        </button>
        <button class="copy-btn text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition" data-id="${esc(h.id)}">
          Copy
        </button>
        <span class="text-xs text-slate-400 ml-auto">${formatDate(h.created)}</span>
      </div>
    </article>
  `;
}

// ── Actions ────────────────────────────────────────────────

function upvote(id) {
  if (votedIds.has(id)) return;

  const hint = hints.find(h => h.id === id);
  if (!hint) return;

  hint.votes++;
  votedIds.add(id);
  saveVotes();
  persistHint(hint);
  render();
  showToast('Thanks for the upvote!');
}

async function copyHint(id) {
  const hint = hints.find(h => h.id === id);
  if (!hint) return;

  const text = `${hint.country} · ${hint.category}\n\n${hint.text}${hint.expertNote ? `\n\nNote: ${hint.expertNote}` : ''}`;

  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard');
  } catch {
    showToast('Copy failed — try selecting manually');
  }
}

function submitHint(e) {
  e.preventDefault();

  const country = document.getElementById('new-country').value.trim();
  const category = document.getElementById('new-category').value.trim();
  const text = document.getElementById('new-text').value.trim();
  const expertNote = document.getElementById('new-expert-note').value.trim();

  if (!country || !category || !text) return;

  const hint = {
    id: `user-${Date.now()}`,
    country,
    category,
    text,
    votes: 0,
    created: new Date().toISOString().slice(0, 10),
    ...(expertNote && { expertNote }),
  };

  hints.unshift(hint);
  persistHint(hint);
  populateFilters();
  render();
  e.target.reset();
  showToast('Hint submitted!');
}

function persistHint(hint) {
  const stored = getStoredHints();
  const idx = stored.findIndex(h => h.id === hint.id);
  if (idx >= 0) stored[idx] = hint;
  else stored.push(hint);
  saveStoredHints(stored);
}

// ── Events ─────────────────────────────────────────────────

function bindEvents() {
  document.getElementById('search').addEventListener('input', render);
  document.getElementById('filter-country').addEventListener('change', render);
  document.getElementById('filter-category').addEventListener('change', render);
  document.getElementById('submit-form').addEventListener('submit', submitHint);

  document.getElementById('hints-list').addEventListener('click', e => {
    const upvoteBtn = e.target.closest('.upvote-btn');
    const copyBtn = e.target.closest('.copy-btn');

    if (upvoteBtn && !upvoteBtn.disabled) upvote(upvoteBtn.dataset.id);
    if (copyBtn) copyHint(copyBtn.dataset.id);
  });
}

// ── PWA ────────────────────────────────────────────────────

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

function setupInstallPrompt() {
  const btn = document.getElementById('install-btn');
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    btn.classList.remove('hidden');
  });

  btn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btn.classList.add('hidden');
  });
}

// ── Utilities ──────────────────────────────────────────────

function esc(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

function formatDate(dateStr) {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('opacity-0');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('opacity-0'), 2500);
}

// ── Start ──────────────────────────────────────────────────

init();