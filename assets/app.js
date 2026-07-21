/* app.js — No build step. Edit data/*.yaml / data/*.json or design.md and push. */

const params = new URLSearchParams(location.search);
const lang = params.get('lang') ||
  (navigator.language && navigator.language.startsWith('ja') ? 'ja' : 'en');

// ── Page routing ─────────────────────────────────────────────────────────────
// ?page=X で表示するセクションを切り替える。デフォルトは 'bio'（About）
const currentPage = params.get('page') || 'bio';

// ページ名 → 表示するセクション ID のマッピング
const PAGE_SECTIONS = {
  bio:          ['bio', 'news'],
  publications: ['publications'],
  talks:        ['talks'],
  experience:   ['experience'],
  projects:     ['projects'],
  activities:   ['activities'],
  materials:    ['materials', 'others'],  // materials が先、others が後
  contact:      ['contact'],
};
const ALL_SECTION_IDS = ['bio', 'publications', 'talks', 'experience',
                          'projects', 'activities', 'materials', 'others', 'news', 'contact'];

// URL を生成（lang と page を保持）
function makeUrl(page, langCode) {
  const l = langCode || lang;
  const p = new URLSearchParams({ lang: l });
  if (page !== 'bio') p.set('page', page);
  return `?${p.toString()}`;
}

// レンダリング後にページルーティングを適用
function applyPageRouting() {
  const toShow = PAGE_SECTIONS[currentPage] || PAGE_SECTIONS['bio'];
  ALL_SECTION_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    // .no-data が付いている = データなしで render 側が非表示にした → page routing は適用しない
    if (el.classList.contains('no-data')) return;
    el.style.display = toShow.includes(id) ? '' : 'none';
  });
}

function t(val, fallback = '') {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  return val[lang] || val['en'] || val['ja'] || fallback;
}
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function dateYear(d) { return d ? String(d).slice(0, 4) : ''; }
function dateYM(d)   { return d ? String(d).slice(0, 7) : ''; }

async function getText(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.text();
}
async function getJSON(path) {
  try { const r = await fetch(path); return r.ok ? r.json() : { items: [] }; }
  catch { return { items: [] }; }
}

// ── Social icon SVGs ────────────────────────────────────────────────────────
const ICONS = {
  github: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>`,

  email: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>`,

  orcid: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.369 4.378c.525 0 .947.431.947.947s-.422.947-.947.947a.95.95 0 01-.947-.947c0-.525.422-.947.947-.947zm-.722 3.038h1.444v10.041H6.647V7.416zm3.562 0h3.9c3.712 0 5.344 2.653 5.344 5.025 0 2.578-2.016 5.016-5.325 5.016h-3.919V7.416zm1.444 1.303v7.444h2.297c3.272 0 4.022-2.484 4.022-3.722 0-2.016-1.284-3.722-4.097-3.722h-2.222z"/></svg>`,

  linkedin: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,

  youtube: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a2.997 2.997 0 00-2.112-2.12C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.386.566A2.997 2.997 0 00.502 6.186C0 8.077 0 12 0 12s0 3.923.502 5.814a2.997 2.997 0 002.112 2.12C4.495 20.5 12 20.5 12 20.5s7.505 0 9.386-.566a2.997 2.997 0 002.112-2.12C24 15.923 24 12 24 12s0-3.923-.502-5.814zM9.6 15.568V8.432L15.818 12 9.6 15.568z"/></svg>`,

  'google-scholar': `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5.242 13.769L0 9.5 12 0l12 9.5-5.242 4.269C17.548 11.249 14.978 9.5 12 9.5c-2.977 0-5.548 1.748-6.758 4.269zM12 10a7 7 0 100 14 7 7 0 000-14z"/></svg>`,
};

// ── Design tokens → CSS ─────────────────────────────────────────────────────
async function applyDesign() {
  try {
    const text = await getText('design.md');
    const match = text.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return;
    const tokens = jsyaml.load(match[1]);
    const root = document.documentElement;
    const flat = (obj, prefix) => {
      for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v === 'object') flat(v, `${prefix}-${k}`);
        else root.style.setProperty(`--${prefix}-${k}`, v);
      }
    };
    if (tokens.colors)    flat(tokens.colors,  'color');
    if (tokens.rounded)   flat(tokens.rounded, 'rounded');
    if (tokens.spacing)   flat(tokens.spacing, 'spacing');
    if (tokens.typography) {
      const ty = tokens.typography;
      if (ty['font-family'])    root.style.setProperty('--font-family', ty['font-family']);
      if (ty['font-size-base']) root.style.setProperty('--font-size-base', ty['font-size-base']);
      if (ty['line-height'])    root.style.setProperty('--line-height', ty['line-height']);
    }
  } catch (e) { console.warn('design.md:', e.message); }
}

// ── Navigation ──────────────────────────────────────────────────────────────
// [page key, English label, Japanese label]
const NAV_PAGES = [
  ['bio',          'About',       'About'],
  ['publications', 'Papers',      '論文'],
  ['talks',        'Talks',       '発表'],
  ['experience',   'Experience',  '経歴'],
  ['projects',     'Projects',    'プロジェクト'],
  ['activities',   'Activities',  '社会貢献'],
  ['materials',    'Tools',       'ツール'],
  ['contact',      'Contact',     'Contact'],
];

function renderNav(profile) {
  const brand     = profile?.brand || 'Tatetsu Lab.';
  const otherLang = lang === 'en' ? 'ja' : 'en';
  const otherFlag = lang === 'en' ? '🇯🇵' : '🇬🇧';
  document.getElementById('nav').innerHTML = `
    <div class="nav-inner">
      <a href="${makeUrl('bio')}" class="nav-brand">${esc(brand)}</a>
      <div class="nav-links">
        ${NAV_PAGES.map(([page, enLabel, jaLabel]) => {
          const label  = lang === 'ja' ? jaLabel : enLabel;
          const active = currentPage === page ? ' class="nav-active"' : '';
          return `<a href="${makeUrl(page)}"${active}>${label}</a>`;
        }).join('')}
        <a href="${makeUrl(currentPage, otherLang)}" class="nav-lang"
           title="${otherLang === 'ja' ? '日本語に切り替え' : 'Switch to English'}">${otherFlag}</a>
      </div>
    </div>`;
}

// ── Bio / Hero ──────────────────────────────────────────────────────────────
function renderBio(profile) {
  if (!profile) return;
  const el = document.getElementById('bio');
  const bio = t(profile.bio, '')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  // ハイライト（資格・研究・関心など）
  const highlights = (profile.highlights || []).map(group => {
    const cat = t(group.category);
    const chips = (group.items || []).map(item => {
      const name = (lang === 'ja' && item.name_ja) ? item.name_ja : item.name;
      return item.url
        ? `<a href="${item.url}" class="hl-chip hl-chip--link" target="_blank" rel="noopener">${esc(name)}</a>`
        : `<span class="hl-chip">${esc(name)}</span>`;
    }).join('');
    return `<div class="hl-group"><span class="hl-cat">${esc(cat)}</span><div class="hl-chips">${chips}</div></div>`;
  }).join('');

  // ソーシャルリンク（アイコン or テキストボタン）
  const socials = Object.entries(profile.links || {}).map(([key, url]) => {
    const icon = ICONS[key];
    const isEmail = url.startsWith('mailto:');
    const label = key.replace(/-/g, ' ');
    const target = isEmail ? '' : 'target="_blank" rel="noopener"';
    if (icon) {
      return `<a href="${url}" class="icon-link" title="${esc(label)}" aria-label="${esc(label)}" ${target}>${icon}</a>`;
    }
    // アイコンなし → テキストボタン（Researchmap など）
    const displayName = key === 'researchmap' ? 'Researchmap' : esc(label);
    return `<a href="${url}" class="text-link-btn" ${target}>${displayName}</a>`;
  }).join('');

  el.innerHTML = `
    <div class="bio-inner">
      <div class="bio-photo">
        <img src="assets/me.png" alt="${esc(t(profile.name))}">
      </div>
      <div class="bio-text">
        <h1 class="bio-name">${esc(t(profile.name))}</h1>
        <p class="bio-role">${esc(t(profile.role))}</p>
        <p class="bio-org">${esc(t(profile.organization))}</p>
        <div class="bio-desc">${bio}</div>
        ${highlights ? `<div class="bio-highlights">${highlights}</div>` : ''}
        <div class="bio-social">${socials}</div>
      </div>
    </div>`;
}

// ── Publications ─────────────────────────────────────────────────────────────
// ── Dashboard helpers ─────────────────────────────────────────────────────────
function mkKpi(kpis) {
  return kpis.map(k =>
    `<div class="db-kpi"><span class="db-kpi-label">${k.lbl}</span><span class="db-kpi-val">${k.val}</span></div>`
  ).join('');
}

const CHART_COLOR_PRIMARY  = '#00A3C4';
const CHART_COLOR_POSTER   = '#4BBFD8';
const CHART_COLOR_INVITED  = '#007EA3';
const CHART_COLOR_OTHER    = '#B0DFE8';

function _mkChart(id, config) {
  setTimeout(() => {
    const canvas = document.getElementById(id);
    if (!canvas || !window.Chart) return;
    if (canvas._chart) canvas._chart.destroy();
    canvas._chart = new Chart(canvas, config);
  }, 0);
}

function pubsDashboard(items) {
  const label = lang === 'ja';
  const total = items.length;
  const curY = new Date().getFullYear();
  const recent = items.filter(p => parseInt(p.date) >= curY - 4).length;

  const yearCounts = {};
  items.forEach(p => {
    const y = String(p.date || '').slice(0, 4);
    if (y) yearCounts[y] = (yearCounts[y] || 0) + 1;
  });
  const years = Object.keys(yearCounts).sort();

  _mkChart('chart-pubs', {
    type: 'bar',
    data: {
      labels: years,
      datasets: [{ data: years.map(y => yearCounts[y]), backgroundColor: CHART_COLOR_PRIMARY, borderRadius: 3 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: c => c[0].label + (label ? '年' : ''), label: c => c.raw + (label ? '件' : '') } },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });

  const kpis = [
    { val: total,        lbl: label ? '総論文数' : 'Total' },
    { val: recent,       lbl: label ? '直近5年' : 'Last 5y' },
    { val: years.length, lbl: label ? '発表年数' : 'Active years' },
  ];
  return `<div class="page-dashboard">
    <div class="db-kpis">${mkKpi(kpis)}</div>
    <div class="db-chart">
      <p class="db-chart-label">${label ? '年別発表数' : 'Publications per year'}</p>
      <div class="db-canvas-wrap"><canvas id="chart-pubs"></canvas></div>
    </div>
  </div>`;
}

function talksDashboard(items) {
  const label = lang === 'ja';
  const total = items.length;
  const oralCount    = items.filter(p => p.type === 'oral_presentation' || p.type === 'nominated_symposium').length;
  const invitedCount = items.filter(p => p.type === 'invited_oral_presentation' || p.type === 'keynote_oral_presentation').length;
  const posterCount  = items.filter(p => p.type === 'poster_presentation').length;

  const TYPES = [
    { key: 'oral',    match: t => t === 'oral_presentation' || t === 'nominated_symposium',               color: CHART_COLOR_PRIMARY,  label: label ? '口頭' : 'Oral' },
    { key: 'poster',  match: t => t === 'poster_presentation',                                            color: CHART_COLOR_POSTER,   label: 'Poster' },
    { key: 'invited', match: t => t === 'invited_oral_presentation' || t === 'keynote_oral_presentation', color: CHART_COLOR_INVITED,  label: label ? '招待' : 'Invited' },
    { key: 'other',   match: () => true,                                                                  color: CHART_COLOR_OTHER,    label: label ? 'その他' : 'Other' },
  ];

  const yearData = {};
  items.forEach(p => {
    const y = String(p.date || '').slice(0, 4);
    if (!y) return;
    if (!yearData[y]) yearData[y] = { oral: 0, poster: 0, invited: 0, other: 0 };
    for (const tp of TYPES) {
      if (tp.match(p.type)) { yearData[y][tp.key]++; break; }
    }
  });
  const years = Object.keys(yearData).sort();

  _mkChart('chart-talks', {
    type: 'bar',
    data: {
      labels: years,
      datasets: TYPES.map(tp => ({
        label: tp.label,
        data: years.map(y => yearData[y][tp.key] || 0),
        backgroundColor: tp.color,
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: { mode: 'index', callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw}` } },
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });

  const kpis = [
    { val: total,        lbl: label ? '総件数' : 'Total' },
    { val: oralCount,    lbl: label ? '口頭発表' : 'Oral' },
    { val: invitedCount, lbl: label ? '招待講演' : 'Invited' },
    { val: posterCount,  lbl: 'Poster' },
  ];
  return `<div class="page-dashboard">
    <div class="db-kpis">${mkKpi(kpis)}</div>
    <div class="db-chart">
      <p class="db-chart-label">${label ? '年別発表数（種別）' : 'Presentations per year by type'}</p>
      <div class="db-canvas-wrap"><canvas id="chart-talks"></canvas></div>
    </div>
  </div>`;
}

function activitiesDashboard(items) {
  const label = lang === 'ja';
  const total = items.length;
  const locs = new Set(items.filter(a => a.location).map(a => a.location)).size;

  const yearCounts = {};
  items.forEach(a => {
    const y = String(a.date || '').slice(0, 4);
    if (y) yearCounts[y] = (yearCounts[y] || 0) + 1;
  });
  const years = Object.keys(yearCounts).sort();

  _mkChart('chart-acts', {
    type: 'bar',
    data: {
      labels: years,
      datasets: [{ data: years.map(y => yearCounts[y]), backgroundColor: CHART_COLOR_PRIMARY, borderRadius: 3 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: c => c[0].label + (label ? '年' : ''), label: c => c.raw + (label ? '件' : '') } },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });

  const kpis = [
    { val: total, lbl: label ? '総件数' : 'Total' },
    { val: locs,  lbl: label ? '活動拠点' : 'Locations' },
  ];
  return `<div class="page-dashboard">
    <div class="db-kpis">${mkKpi(kpis)}</div>
    <div class="db-chart">
      <p class="db-chart-label">${label ? '年別活動件数' : 'Activities per year'}</p>
      <div class="db-canvas-wrap"><canvas id="chart-acts"></canvas></div>
    </div>
  </div>`;
}

function renderPublications(data) {
  const el = document.getElementById('publications');
  const items = (data.items || []).filter(p => !p.draft);
  const label = lang === 'ja';
  if (!items.length) {
    el.innerHTML = `<h2 class="section-title">${label ? '論文・業績' : 'Publications'}</h2><p class="empty-state">—</p>`;
    return;
  }
  el.innerHTML = `
    <h2 class="section-title">${label ? '論文・業績' : 'Publications'}</h2>
    ${pubsDashboard(items)}
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>
          <th style="width:60px">${label ? '年' : 'Year'}</th>
          <th>${label ? '著者' : 'Authors'}</th>
          <th>${label ? 'タイトル' : 'Title'}</th>
          <th>${label ? '掲載誌' : 'Journal'}</th>
        </tr></thead>
        <tbody>
          ${items.map(p => {
            const title = (lang === 'ja' && p.title_ja) ? p.title_ja : p.title;
            const link = p.doi
              ? `<a href="https://doi.org/${p.doi}" target="_blank" rel="noopener">${esc(title)}</a>`
              : esc(title);
            return `<tr>
              <td class="col-year">${dateYear(p.date)}</td>
              <td class="col-authors">${esc(p.authors || '')}</td>
              <td class="col-title">${link}</td>
              <td class="col-journal"><em>${esc(p.journal || '')}</em></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <a class="more-link" href="https://researchmap.jp/yasutomi_tatetsu/published_papers"
       target="_blank" rel="noopener">
      ${label ? 'Researchmapで全件を見る →' : 'View all on Researchmap →'}
    </a>`;
}

// ── Talks 地図（座標は JSON に事前格納済み）──────────────────────────────
let _talkMap = null;

async function geocodeLocation(place) {
  if (!place) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1`;
    const r = await fetch(url, { headers: { 'User-Agent': 'TatetsuLab/1.0' } });
    const data = await r.json();
    return data[0] ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null;
  } catch { return null; }
}

function addTalkMarker(map, lat, lon, name, items) {
  const popup = `<strong>${esc(name)}</strong><br>${items.length} ${lang === 'ja' ? '件の発表' : 'presentation(s)'}`;
  L.circleMarker([lat, lon], {
    radius: 6 + Math.min(items.length, 10),
    fillColor: '#00A3C4', color: '#fff',
    weight: 2, opacity: 1, fillOpacity: 0.8,
  }).bindPopup(popup).addTo(map);
}

async function renderTalksMap(pres) {
  const mapEl = document.getElementById('talks-map');
  if (!mapEl || !window.L) return;
  if (_talkMap) { _talkMap.remove(); _talkMap = null; }

  _talkMap = L.map('talks-map').setView([35.68, 139.69], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(_talkMap);

  // 場所でグループ化
  const locMap = {};
  pres.forEach(p => {
    if (!p.location || p.location === 'オンライン') return;
    if (!locMap[p.location]) locMap[p.location] = [];
    locMap[p.location].push(p);
  });

  // キャッシュ読み込み
  let cache = {};
  try {
    const r = await fetch('data/location_cache.json');
    if (r.ok) cache = await r.json();
  } catch {}

  const allCoords = [];
  const uncached = [];

  for (const [loc, items] of Object.entries(locMap)) {
    if (cache[loc]) {
      const { lat, lon } = cache[loc];
      addTalkMarker(_talkMap, lat, lon, loc, items);
      allCoords.push([lat, lon]);
    } else {
      uncached.push(loc);
    }
  }

  if (allCoords.length > 1) _talkMap.fitBounds(allCoords, { padding: [20, 20] });
  else if (allCoords.length === 1) _talkMap.setView(allCoords[0], 8);

  // キャッシュにない場所は非同期でジオコーディング
  for (let i = 0; i < uncached.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1100));
    const loc = uncached[i];
    const coords = await geocodeLocation(loc);
    if (!coords) continue;
    addTalkMarker(_talkMap, coords.lat, coords.lon, loc, locMap[loc]);
  }
}

function renderTalks(presData, mediaData) {
  const el = document.getElementById('talks');
  const pres  = (presData.items  || []).filter(p => !p.draft);
  const media = (mediaData.items || []).filter(m => !m.draft);
  const label = lang === 'ja';
  const typeMap = { oral_presentation: 'Oral', poster_presentation: 'Poster', invited: 'Invited' };

  if (!pres.length && !media.length) {
    el.innerHTML = `<h2 class="section-title">${label ? '発表・メディア' : 'Talks & Media'}</h2><p class="empty-state">—</p>`;
    return;
  }

  // 地図コンテナ
  const mapSection = pres.some(p => p.location) ? `
    <div id="talks-map" class="talks-map"></div>
    <p class="map-note">${label ? '発表地点（ピンの大きさ = 件数）' : 'Presentation locations — circle size = number of talks'}</p>` : '';

  const presTable = pres.length ? `
    <h3 class="subsection-title">${label ? '学会発表' : 'Presentations'}</h3>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>
          <th style="width:70px">${label ? '年月' : 'Date'}</th>
          <th>${label ? 'タイトル' : 'Title'}</th>
          <th>${label ? '学会・イベント' : 'Event'}</th>
          <th>${label ? '場所' : 'Location'}</th>
          <th style="width:70px">${label ? '形式' : 'Type'}</th>
        </tr></thead>
        <tbody>
          ${pres.map(p => {
            const title = (lang === 'ja' && p.title_ja) ? p.title_ja : p.title;
            return `<tr>
              <td class="col-year">${dateYM(p.date)}</td>
              <td class="col-title">${esc(title)}</td>
              <td>${esc(p.event || '')}</td>
              <td>${esc(p.location || '')}</td>
              <td><span class="type-badge">${esc(typeMap[p.type] || p.type || '')}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : '';

  const mediaTable = media.length ? `
    <h3 class="subsection-title" style="margin-top:var(--spacing-md)">${label ? 'メディア掲載' : 'Media Coverage'}</h3>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>
          <th style="width:70px">${label ? '年月' : 'Date'}</th>
          <th>${label ? 'タイトル' : 'Title'}</th>
          <th>${label ? '媒体' : 'Publication'}</th>
        </tr></thead>
        <tbody>
          ${media.map(m => {
            const title = (lang === 'ja' && m.title_ja) ? m.title_ja : m.title;
            const titleCell = m.url
              ? `<a href="${m.url}" target="_blank" rel="noopener">${esc(title)}</a>`
              : esc(title);
            return `<tr>
              <td class="col-year">${dateYM(m.date)}</td>
              <td class="col-title">${titleCell}</td>
              <td>${esc(m.publication || '')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : '';

  el.innerHTML = `
    <h2 class="section-title">${label ? '発表・メディア' : 'Talks & Media'}</h2>
    ${talksDashboard(pres)}
    ${mapSection}${presTable}${mediaTable}`;

  // 地図のジオコーディングは非同期で実行
  if (pres.some(p => p.location)) {
    renderTalksMap(pres);
  }
}

// ── Experience ───────────────────────────────────────────────────────────────
function timelineItem(inst, instJa, dept, deptJa, role, roleJa, from, to) {
  const instShow = (lang === 'ja' && instJa) ? instJa : inst;
  const deptShow = (lang === 'ja' && deptJa) ? deptJa : dept;
  const roleShow = (lang === 'ja' && roleJa) ? roleJa : role;
  const dateRange = [dateYM(from), to ? dateYM(to) : (lang === 'ja' ? '現在' : 'Present')]
    .filter(Boolean).join(' – ');
  return `
    <div class="timeline-item">
      <div class="timeline-date">${esc(dateRange)}</div>
      <div class="timeline-body">
        <div class="timeline-inst">${esc(instShow || '')}</div>
        ${deptShow ? `<div class="timeline-dept">${esc(deptShow)}</div>` : ''}
        ${roleShow ? `<div class="timeline-role">${esc(roleShow)}</div>` : ''}
      </div>
    </div>`;
}

function renderExperience(expData, eduData, teachData, commData, assocData, awardsData) {
  const el = document.getElementById('experience');
  const exp    = expData.items    || [];
  const edu    = eduData.items    || [];
  const teach  = teachData.items  || [];
  const comm   = commData.items   || [];
  const assoc  = assocData.items  || [];
  const awards = awardsData.items || [];
  const label = lang === 'ja';

  const expBlock = exp.length ? `
    <h3 class="subsection-title">${label ? '職歴' : 'Career'}</h3>
    <div class="timeline">
      ${exp.map(e => timelineItem(e.institution,e.institution_ja,e.department,e.department_ja,e.position,e.position_ja,e.from_date,e.to_date)).join('')}
    </div>` : '';

  const eduBlock = edu.length ? `
    <h3 class="subsection-title">${label ? '学歴' : 'Education'}</h3>
    <div class="timeline">
      ${edu.map(e => timelineItem(e.institution,e.institution_ja,e.department,e.department_ja,e.degree,e.degree_ja,e.from_date,e.to_date)).join('')}
    </div>` : '';

  const teachBlock = teach.length ? `
    <h3 class="subsection-title">${label ? '担当授業' : 'Teaching'}</h3>
    <div class="card-grid">
      ${teach.map(t => {
        const subj = (lang === 'ja' && t.subject_ja) ? t.subject_ja : t.subject;
        const inst = (lang === 'ja' && t.institution_ja) ? t.institution_ja : (t.institution || '');
        const range = [dateYear(t.from_date), t.to_date ? dateYear(t.to_date) : (label ? '現在' : 'Present')].filter(Boolean).join(' – ');
        return `<div class="exp-card"><div class="exp-card-title">${esc(subj)}</div>${inst ? `<div class="exp-card-sub">${esc(inst)}</div>` : ''}<div class="exp-card-date">${esc(range)}</div></div>`;
      }).join('')}
    </div>` : '';

  const commBlock = comm.length ? `
    <h3 class="subsection-title">${label ? '委員会・役職' : 'Committee Memberships'}</h3>
    <div class="card-grid">
      ${comm.map(c => {
        const name = (lang === 'ja' && c.name_ja) ? c.name_ja : c.name;
        const range = [dateYM(c.from_date), c.to_date ? dateYM(c.to_date) : (label ? '現在' : 'Present')].filter(Boolean).join(' – ');
        return `<div class="exp-card"><div class="exp-card-title">${esc(name)}</div>${c.organization ? `<div class="exp-card-sub">${esc(c.organization)}</div>` : ''}<div class="exp-card-date">${esc(range)}</div></div>`;
      }).join('')}
    </div>` : '';

  const assocBlock = assoc.length ? `
    <h3 class="subsection-title">${label ? '学会・協会' : 'Academic Societies'}</h3>
    <div class="card-grid">
      ${assoc.map(a => {
        const name = (lang === 'ja' && a.name_ja) ? a.name_ja : a.name;
        const range = [dateYM(a.from_date), a.to_date ? dateYM(a.to_date) : (label ? '現在' : 'Present')].filter(Boolean).join(' – ');
        return `<div class="exp-card"><div class="exp-card-title">${esc(name)}</div><div class="exp-card-date">${esc(range)}</div></div>`;
      }).join('')}
    </div>` : '';

  const awardsBlock = awards.length ? `
    <h3 class="subsection-title">${label ? '受賞・奨学金' : 'Awards & Scholarships'}</h3>
    <div class="card-grid">
      ${awards.map(a => {
        const title = (lang === 'ja' && a.title_ja) ? a.title_ja : a.title;
        return `<div class="exp-card"><div class="exp-card-title">${esc(title)}</div>${a.organization ? `<div class="exp-card-sub">${esc(a.organization)}</div>` : ''}<div class="exp-card-date">${dateYM(a.date)}</div></div>`;
      }).join('')}
    </div>` : '';

  const body = expBlock + eduBlock + teachBlock + commBlock + assocBlock + awardsBlock;
  el.innerHTML = `<h2 class="section-title">${label ? '経歴' : 'Experience'}</h2>${body || '<p class="empty-state">—</p>'}`;
}

// ── Projects ─────────────────────────────────────────────────────────────────
function renderProjects(data) {
  const el = document.getElementById('projects');
  const items = (data.items || []).filter(p => !p.draft);
  const label = lang === 'ja';
  if (!items.length) {
    el.innerHTML = `<h2 class="section-title">${label ? '研究プロジェクト' : 'Research Projects'}</h2><p class="empty-state">—</p>`;
    return;
  }
  el.innerHTML = `
    <h2 class="section-title">${label ? '研究プロジェクト' : 'Research Projects'}</h2>
    <div class="card-grid">
      ${items.map(p => {
        const title = (lang === 'ja' && p.title_ja) ? p.title_ja : p.title;
        const range = [dateYear(p.from_date), p.to_date ? dateYear(p.to_date) : (label ? '現在' : 'Present')].filter(Boolean).join(' – ');
        const kakenLink = p.kaken_url ? `<a href="${p.kaken_url}" class="project-link" target="_blank" rel="noopener">KAKEN →</a>` : '';
        return `<div class="project-card">
          <div class="project-title">${esc(title)}</div>
          <div class="project-date">${esc(range)}</div>
          ${p.investigators ? `<div class="project-meta">${label ? '研究者:' : 'Investigators:'} ${esc(p.investigators)}</div>` : ''}
          ${p.system ? `<div class="project-meta">${label ? '制度:' : 'System:'} ${esc(p.system)}</div>` : ''}
          ${p.offer_org ? `<div class="project-meta">${label ? '提供機関:' : 'Funder:'} ${esc(p.offer_org)}</div>` : ''}
          ${p.grant_number ? `<div class="project-meta">${label ? '課題番号:' : 'Grant No:'} ${esc(p.grant_number)}</div>` : ''}
          ${kakenLink}
        </div>`;
      }).join('')}
    </div>`;
}

// ── Activities（地図 + テーブル）────────────────────────────────────────────
let _actMap = null;

async function renderActivitiesMap(items) {
  const mapEl = document.getElementById('activities-map');
  if (!mapEl || !window.L) return;
  if (_actMap) { _actMap.remove(); _actMap = null; }
  _actMap = L.map('activities-map').setView([26.5, 128.0], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(_actMap);

  // Group by location, preferring lat/lon embedded in each item
  const locMap = {};
  items.forEach(a => {
    if (!a.location || a.location === 'オンライン') return;
    if (!locMap[a.location]) locMap[a.location] = { lat: null, lon: null, acts: [] };
    locMap[a.location].acts.push(a);
    // Use item's own coords if valid Japan range (20-46°N, 123-154°E)
    if (!locMap[a.location].lat && a.lat && a.lon
        && a.lat >= 20 && a.lat <= 46 && a.lon >= 123 && a.lon <= 154) {
      locMap[a.location].lat = a.lat;
      locMap[a.location].lon = a.lon;
    }
  });

  const allCoords = [];
  const needGeocode = [];

  for (const [loc, info] of Object.entries(locMap)) {
    if (info.lat && info.lon) {
      const popup = `<strong>${esc(loc)}</strong><br>${info.acts.length}件`;
      L.circleMarker([info.lat, info.lon], {
        radius: 6 + Math.min(info.acts.length, 8),
        fillColor: '#00A3C4', color: '#fff',
        weight: 2, opacity: 1, fillOpacity: 0.8,
      }).bindPopup(popup).addTo(_actMap);
      allCoords.push([info.lat, info.lon]);
    } else {
      needGeocode.push(loc);
    }
  }

  if (allCoords.length) {
    const lat = allCoords.reduce((s, c) => s + c[0], 0) / allCoords.length;
    const lon = allCoords.reduce((s, c) => s + c[1], 0) / allCoords.length;
    setTimeout(() => { _actMap.invalidateSize(); _actMap.setView([lat, lon], allCoords.length > 1 ? 8 : 10); }, 50);
  }

  // Fallback: geocode locations that still have no coords
  let cache = {};
  if (needGeocode.length) {
    try { const r = await fetch('data/location_cache.json'); if (r.ok) cache = await r.json(); } catch {}
  }
  for (let i = 0; i < needGeocode.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1100));
    const loc = needGeocode[i];
    const coords = cache[loc] || await geocodeLocation(loc);
    if (!coords) continue;
    const popup = `<strong>${esc(loc)}</strong><br>${locMap[loc].acts.length}件`;
    L.circleMarker([coords.lat, coords.lon], {
      radius: 6 + Math.min(locMap[loc].acts.length, 8),
      fillColor: '#00A3C4', color: '#fff',
      weight: 2, opacity: 1, fillOpacity: 0.8,
    }).bindPopup(popup).addTo(_actMap);
  }
}

function renderActivities(data) {
  const el = document.getElementById('activities');
  const items = (data.items || []).filter(a => !a.draft);
  const label = lang === 'ja';
  if (!items.length) {
    el.innerHTML = `<h2 class="section-title">${label ? '社会貢献活動' : 'Activities'}</h2><p class="empty-state">—</p>`;
    return;
  }

  const hasLocation = items.some(a => a.location);
  const mapSection = hasLocation ? `
    <div id="activities-map" class="talks-map"></div>
    <p class="map-note">${label ? '活動場所（ピンの大きさ = 件数）' : 'Activity locations — circle size = count'}</p>` : '';

  el.innerHTML = `
    <h2 class="section-title">${label ? '社会貢献活動' : 'Activities'}</h2>
    ${activitiesDashboard(items)}
    ${mapSection}
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>
          <th style="width:70px">${label ? '年月' : 'Date'}</th>
          <th>${label ? 'タイトル' : 'Title'}</th>
          <th>${label ? '組織' : 'Organization'}</th>
          <th style="width:100px">${label ? '場所' : 'Location'}</th>
        </tr></thead>
        <tbody>
          ${items.map(a => {
            const title = (lang === 'ja' && a.title_ja) ? a.title_ja : a.title;
            return `<tr>
              <td class="col-year">${dateYM(a.date)}</td>
              <td class="col-title">${esc(title)}</td>
              <td>${esc(a.organization || '')}</td>
              <td>${esc(a.location || '')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;

  if (hasLocation) renderActivitiesMap(items);
}

// ── Others ────────────────────────────────────────────────────────────────────
function renderOthers(data) {
  const el = document.getElementById('others');
  const items = (data.items || []).filter(o => !o.draft);
  if (!items.length) { el.classList.add('no-data'); el.style.display = 'none'; return; }
  const label = lang === 'ja';
  el.innerHTML = `
    <h2 class="section-title">${label ? 'その他' : 'Others'}</h2>
    <div class="card-grid">
      ${items.map(o => {
        const title = (lang === 'ja' && o.title_ja) ? o.title_ja : o.title;
        const desc  = (lang === 'ja' && o.description_ja) ? o.description_ja : (o.description || '');
        return `<div class="exp-card"><div class="exp-card-title">${esc(title)}</div>${desc ? `<div class="exp-card-sub">${esc(desc)}</div>` : ''}<div class="exp-card-date">${dateYM(o.date)}</div></div>`;
      }).join('')}
    </div>`;
}

// ── News ──────────────────────────────────────────────────────────────────────

// Researchmap の直近5件を自動ニュースとして生成
function buildAutoNews(pubs, pres, awards) {
  const label = lang === 'ja';
  const TYPE = {
    publication:  label ? '論文'   : 'Paper',
    presentation: label ? '発表'   : 'Talk',
    award:        label ? '受賞'   : 'Award',
  };
  const all = [];
  (pubs.items   || []).forEach(p => all.push({ date: p.date, type: 'publication',
    title: (label && p.title_ja) ? p.title_ja : p.title,
    sub: p.journal || '', url: p.doi ? `https://doi.org/${p.doi}` : null }));
  (pres.items   || []).forEach(p => all.push({ date: p.date, type: 'presentation',
    title: (label && p.title_ja) ? p.title_ja : p.title,
    sub: p.event || '', url: null }));
  (awards.items || []).forEach(a => all.push({ date: a.date, type: 'award',
    title: (label && a.title_ja) ? a.title_ja : a.title,
    sub: a.organization || '', url: null }));
  return all
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 5)
    .map(item => ({ ...item, typeLabel: TYPE[item.type], auto: true }));
}

// 手動ニュースの表示可否判定（pinned / expires / 2か月デフォルト）
function isNewsVisible(item) {
  if (item.draft) return false;
  if (item.pinned) return true;
  if (!item.date) return true;
  const today = new Date();
  const base = new Date(item.date);
  const expires = item.expires
    ? new Date(item.expires)
    : new Date(base.getFullYear(), base.getMonth() + 2, base.getDate());
  return today <= expires;
}

function renderNews(data, pubs, pres, awards) {
  const el = document.getElementById('news');
  const label = lang === 'ja';

  // 手動項目
  const manualVisible = (data.items || []).filter(isNewsVisible);
  const pinned    = manualVisible.filter(i => i.pinned);
  const nonPinned = manualVisible.filter(i => !i.pinned);

  // Researchmap 自動ニュース
  const autoNews = buildAutoNews(pubs, pres, awards);

  // 表示するものがなければ非表示
  if (!pinned.length && !autoNews.length && !nonPinned.length) {
    el.classList.add('no-data'); el.style.display = 'none'; return;
  }

  // 順序: ピン留め → 自動＋手動を日付順にマージ
  const merged = [...autoNews, ...nonPinned]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const allItems = [...pinned, ...merged];

  const renderItem = item => {
    if (item.auto) {
      return `<div class="news-item">
        <span class="news-date">${dateYM(item.date)}</span>
        <div>
          <span class="news-tag">${esc(item.typeLabel)}</span>
          <div class="news-title">${esc(item.title)}</div>
          ${item.sub ? `<div class="news-body">${esc(item.sub)}</div>` : ''}
          ${item.url ? `<a class="news-link" href="${item.url}" target="_blank" rel="noopener">${label ? '詳細 →' : 'View →'}</a>` : ''}
        </div>
      </div>`;
    }
    return `<div class="news-item">
      <span class="news-date">${item.date || ''}</span>
      <div>
        ${item.pinned ? '<span class="news-pin">📌</span> ' : ''}
        <div class="news-title">${esc(t(item.title))}</div>
        ${item.body ? `<div class="news-body">${esc(t(item.body))}</div>` : ''}
        ${item.url ? `<a class="news-link" href="${item.url}" target="_blank" rel="noopener">${label ? '詳細 →' : 'Read more →'}</a>` : ''}
      </div>
    </div>`;
  };

  el.innerHTML = `
    <h2 class="section-title">${label ? 'ニュース' : 'News'}</h2>
    <div class="news-list">${allItems.map(renderItem).join('')}</div>`;
}

// ── Materials ─────────────────────────────────────────────────────────────────
function renderMaterials(data) {
  const el = document.getElementById('materials');
  const items = (data.items || []).filter(m => !m.draft);
  if (!items.length) { el.classList.add('no-data'); el.style.display = 'none'; return; }
  const label = lang === 'ja';
  el.innerHTML = `
    <h2 class="section-title">${label ? '資料・ツール' : 'Materials & Tools'}</h2>
    <div class="materials-grid">
      ${items.map(m => `
        <div class="material-card">
          ${m.icon ? `<div class="material-icon">${m.icon}</div>` : ''}
          <h3 class="material-title">${esc(t(m.title))}</h3>
          <p class="material-desc">${esc(t(m.description))}</p>
          <div class="material-links">
            ${m.url ? `<a href="${m.url}" class="btn-primary">${label ? '開く →' : 'Open →'}</a>` : ''}
            ${m.github ? `<a href="${m.github}" class="btn-secondary" target="_blank" rel="noopener">GitHub</a>` : ''}
            ${m.download ? `<a href="${m.download}" class="btn-secondary" target="_blank" rel="noopener">${label ? 'ダウンロード ↓' : 'Download ↓'}</a>` : ''}
          </div>
        </div>`).join('')}
    </div>`;
}

// ── Contact ───────────────────────────────────────────────────────────────────
const CONTACT_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScumams6cqV1iuSXMizzo6TML9iJKT5cXXX8FZKnuAz_EAQTw/viewform';

function renderContact(profile) {
  const el = document.getElementById('contact');
  const label = lang === 'ja';
  el.innerHTML = `
    <h2 class="section-title">${label ? 'お問い合わせ' : 'Contact'}</h2>
    <div class="contact-form-wrap">
      <iframe src="${CONTACT_FORM_URL}?embedded=true"
              class="contact-iframe"
              frameborder="0"
              marginheight="0"
              marginwidth="0"
              loading="lazy">
        ${label ? '読み込み中…' : 'Loading…'}
      </iframe>
    </div>`;
}

// ── Footer ────────────────────────────────────────────────────────────────────
async function renderFooter(profile) {
  const name = t(profile?.name, 'Yasutomi Tatetsu');
  const el = document.getElementById('footer');

  // GitHub API で最終コミット日を取得
  let updatedStr = '';
  try {
    const r = await fetch(
      'https://api.github.com/repos/OkinawaYT/yasutomi-tatetsu/commits/main?per_page=1',
      { headers: { 'Accept': 'application/vnd.github+json' } }
    );
    if (r.ok) {
      const data = await r.json();
      const d = new Date(data.commit.committer.date);
      updatedStr = lang === 'ja'
        ? `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
        : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  } catch {}

  el.innerHTML = `
    <p>© ${new Date().getFullYear()} ${esc(name)}</p>
    <p style="margin-top:4px">
      ${lang === 'ja'
        ? '研究業績は <a href="https://researchmap.jp/yasutomi_tatetsu" target="_blank">Researchmap</a> から自動取得しています'
        : 'Research data auto-synced from <a href="https://researchmap.jp/yasutomi_tatetsu" target="_blank">Researchmap</a>'}
    </p>
    ${updatedStr ? `<p style="margin-top:4px;font-size:12px">${lang === 'ja' ? `最終更新：${updatedStr}` : `Last updated: ${updatedStr}`}</p>` : ''}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  document.getElementById('bio').innerHTML = '<div class="loading">Loading…</div>';
  await applyDesign();

  const [
    profileYaml, newsYaml, materialsYaml,
    pubs, pres, media, awards,
    projects, areas,
    exp, edu, teach, comm, assoc,
    soc, others,
  ] = await Promise.all([
    getText('data/profile.yaml').catch(() => null),
    getText('data/news.yaml').catch(() => null),
    getText('data/materials.yaml').catch(() => null),
    getJSON('data/publications.json'),
    getJSON('data/presentations.json'),
    getJSON('data/media_coverage.json'),
    getJSON('data/awards.json'),
    getJSON('data/projects.json'),
    getJSON('data/research_areas.json'),
    getJSON('data/research_experience.json'),
    getJSON('data/education.json'),
    getJSON('data/teaching_experience.json'),
    getJSON('data/committee_memberships.json'),
    getJSON('data/association_memberships.json'),
    getJSON('data/social_contribution.json'),
    getJSON('data/others.json'),
  ]);

  const profile  = profileYaml   ? jsyaml.load(profileYaml)  : null;
  const newsData = newsYaml      ? jsyaml.load(newsYaml)      : {};
  const matsData = materialsYaml ? jsyaml.load(materialsYaml) : {};

  document.documentElement.lang = lang;

  // title / meta を profile.yaml から動的に設定
  if (profile) {
    const brand = profile.brand || t(profile.name);
    document.title = brand;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content',
        `${t(profile.name)} — ${t(profile.role)}, ${t(profile.organization)}`);
    }
  }

  renderNav(profile);
  renderBio(profile);
  renderPublications(pubs);
  renderTalks(pres, media);
  renderExperience(exp, edu, teach, comm, assoc, awards);
  renderProjects(projects);
  renderActivities(soc);
  renderMaterials(matsData);
  renderOthers(others);
  renderNews(newsData, pubs, pres, awards);
  renderContact(profile);
  renderFooter(profile);

  // ページルーティングを最後に適用（render 後でないと el が存在しない）
  applyPageRouting();
}

main().catch(e => {
  document.getElementById('bio').innerHTML = `<p class="error">Error: ${esc(e.message)}</p>`;
  console.error(e);
});
