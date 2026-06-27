/* Culturepedia — main application logic */

const STORAGE_KEY = 'culturepedia';
const VOTES_KEY = 'culturepedia_votes';

const COUNTRIES = [
  'Brazil', 'China', 'France', 'Germany', 'India', 'Iran', 'Italy',
  'Japan', 'Mexico', 'South Korea', 'Thailand', 'Turkey', 'UAE',
];

const CATEGORIES = [
  'First Meeting', 'Business Etiquette', 'Communication', 'Dining',
  'Gestures', 'Taboos', 'Gift Giving', 'Negotiation',
];

const REGIONS = [
  'East Asia', 'Southeast Asia', 'South Asia',
  'Middle East', 'Latin America', 'Western Europe',
];

const COUNTRY_REGION = {
  Brazil: 'Latin America', China: 'East Asia', France: 'Western Europe',
  Germany: 'Western Europe', India: 'South Asia', Iran: 'Middle East',
  Italy: 'Western Europe', Japan: 'East Asia', Mexico: 'Latin America',
  'South Korea': 'East Asia', Thailand: 'Southeast Asia', Turkey: 'Middle East',
  UAE: 'Middle East',
};

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

  return Array.from(map.values()).map(ensureRegion).sort((a, b) => b.votes - a.votes);
}

function regionForCountry(country) {
  return COUNTRY_REGION[country] || '';
}

function hintRegion(hint) {
  return regionForCountry(hint.country) || hint.region || '';
}

function countriesForRegion(region) {
  if (!region) return [...COUNTRIES];
  return COUNTRIES.filter(country => COUNTRY_REGION[country] === region);
}

function ensureRegion(hint) {
  if (hint.country) {
    const mapped = regionForCountry(hint.country);
    if (mapped) hint.region = mapped;
  }
  return hint;
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
    region: document.getElementById('filter-region').value.trim(),
    country: document.getElementById('filter-country').value.trim(),
    category: document.getElementById('filter-category').value.trim(),
  };
}

function filteredHints() {
  const { search, region, country, category } = getFilters();

  return hints.filter(h => {
    if (region && hintRegion(h) !== region) return false;
    if (country && h.country !== country) return false;
    if (category && h.category !== category) return false;
    if (search) {
      const haystack = `${hintRegion(h)} ${h.country} ${h.category} ${h.text} ${h.expertNote || ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function populateCountryFilter() {
  const { region } = getFilters();
  fillSelect('filter-country', countriesForRegion(region), 'All countries');
}

function populateFilters() {
  fillSelect('filter-region', REGIONS, 'All regions');
  populateCountryFilter();
  fillSelect('filter-category', CATEGORIES, 'All categories');
  fillSelect('new-country', COUNTRIES, 'Select country', true);
  fillSelect('new-category', CATEGORIES, 'Select category', true);
}

function onRegionChange() {
  const countryEl = document.getElementById('filter-country');
  const prevCountry = countryEl.value.trim();
  const region = document.getElementById('filter-region').value.trim();

  populateCountryFilter();

  if (prevCountry && region && regionForCountry(prevCountry) !== region) {
    countryEl.value = '';
  } else if (prevCountry && countriesForRegion(region).includes(prevCountry)) {
    countryEl.value = prevCountry;
  }

  render();
}

function fillSelect(id, options, placeholder, isSubmit = false) {
  const select = document.getElementById(id);
  const current = select.value;

  if (isSubmit) {
    select.innerHTML = `<option value="" disabled ${!current ? 'selected' : ''}>${placeholder}</option>`;
  } else {
    select.innerHTML = `<option value="">${placeholder}</option>`;
  }

  for (const opt of options) {
    select.innerHTML += `<option value="${esc(opt)}">${esc(opt)}</option>`;
  }

  if (current && options.includes(current)) select.value = current;
}

// ── Render ─────────────────────────────────────────────────

function render() {
  const list = filteredHints();
  const container = document.getElementById('hints-list');
  const count = document.getElementById('result-count');

  count.textContent = `${list.length} hint${list.length !== 1 ? 's' : ''}`;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 px-4">
        <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-lg">∅</div>
        <p class="text-sm font-medium text-slate-600">No hints match your filters</p>
        <p class="text-xs text-slate-400 mt-1">Try a different country, category, or search term</p>
      </div>`;
    return;
  }

  container.innerHTML = list.map(h => hintCard(h)).join('');
}

function hintCard(h) {
  const voted = votedIds.has(h.id);
  const expertNote = h.expertNote
    ? `<div class="flex gap-2.5 mt-4 p-3.5 bg-gradient-to-r from-brand-50 to-teal-50/50 border border-brand-100/80 rounded-xl">
        <span class="shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-bold mt-0.5">i</span>
        <p class="text-xs text-brand-900 leading-relaxed"><span class="font-semibold not-italic text-brand-800">Expert note</span><span class="text-brand-700/70"> — </span><span class="italic text-brand-800/90">${esc(h.expertNote)}</span></p>
      </div>`
    : '';

  return `
    <article class="group bg-white rounded-2xl shadow-card border border-slate-200/80 p-5 sm:p-6 border-l-4 border-l-brand-500/80 hover:shadow-card-hover hover:border-slate-300/80 transition-all duration-200" data-id="${esc(h.id)}">
      <div class="flex flex-wrap items-center gap-2 mb-4">
        ${h.region ? `<span class="inline-flex items-center text-[10px] font-medium uppercase tracking-wide text-slate-500 bg-slate-50 px-2 py-0.5 rounded ring-1 ring-slate-200/70">${esc(h.region)}</span>` : ''}
        <span class="inline-flex items-center text-xs font-semibold bg-brand-600 text-white px-2.5 py-1 rounded-md shadow-sm">${esc(h.country)}</span>
        <span class="inline-flex items-center text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md ring-1 ring-slate-200/80">${esc(h.category)}</span>
      </div>
      <p class="text-[0.9375rem] sm:text-base text-slate-700 leading-relaxed tracking-tight">${esc(h.text)}</p>
      ${expertNote}
      <div class="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100">
        <button
          class="upvote-btn inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg transition-all active:scale-95
            ${voted ? 'bg-brand-100 text-brand-700 ring-1 ring-brand-200 cursor-default' : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700 hover:ring-1 hover:ring-brand-200'}"
          data-id="${esc(h.id)}"
          ${voted ? 'disabled' : ''}
          aria-label="Upvote hint"
        >
          <span aria-hidden="true" class="text-[10px]">▲</span>
          <span class="vote-count">${h.votes}</span>
        </button>
        <button
          class="copy-btn text-xs font-semibold px-3.5 py-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-all active:scale-95 ring-1 ring-transparent hover:ring-slate-200"
          data-id="${esc(h.id)}"
          aria-label="Copy hint"
        >
          Copy
        </button>
        <time class="text-xs text-slate-400 ml-auto tabular-nums" datetime="${esc(h.created)}">${formatDate(h.created)}</time>
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
    region: regionForCountry(country),
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
  document.getElementById('filter-region').addEventListener('change', onRegionChange);
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
  toast.dataset.show = 'true';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('opacity-0');
    delete toast.dataset.show;
  }, 2500);
}

// ── Start ──────────────────────────────────────────────────

init();