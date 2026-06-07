/* app.js — No build step. Edit data/*.yaml / data/*.json or design.md and push. */

const params = new URLSearchParams(location.search);
const lang = params.get('lang') ||
  (navigator.language && navigator.language.startsWith('ja') ? 'ja' : 'en');

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
  try {
    const r = await fetch(path);
    return r.ok ? r.json() : { items: [] };
  } catch { return { items: [] }; }
}

// ── Design tokens → CSS custom properties ──────────────────────────────────
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
    if (tokens.colors)     flat(tokens.colors,   'color');
    if (tokens.rounded)    flat(tokens.rounded,  'rounded');
    if (tokens.spacing)    flat(tokens.spacing,  'spacing');
    if (tokens.typography) {
      const ty = tokens.typography;
      if (ty['font-family'])    root.style.setProperty('--font-family', ty['font-family']);
      if (ty['font-size-base']) root.style.setProperty('--font-size-base', ty['font-size-base']);
      if (ty['line-height'])    root.style.setProperty('--line-height', ty['line-height']);
    }
  } catch (e) { console.warn('design.md:', e.message); }
}

// ── Navigation ─────────────────────────────────────────────────────────────
const NAV_LINKS = {
  en: [['#bio','About'],['#publications','Papers'],['#talks','Talks'],
       ['#experience','Experience'],['#projects','Projects'],
       ['#activities','Activities'],['#materials','Tools']],
  ja: [['#bio','プロフィール'],['#publications','論文'],['#talks','発表'],
       ['#experience','経歴'],['#projects','プロジェクト'],
       ['#activities','社会貢献'],['#materials','ツール']],
};

function renderNav(profile) {
  const name = t(profile?.name, 'Tatetsu Lab.');
  const otherLang = lang === 'en' ? 'ja' : 'en';
  const otherLabel = lang === 'en' ? '日本語' : 'English';
  document.getElementById('nav').innerHTML = `
    <div class="nav-inner">
      <a href="?" class="nav-brand">${esc(name)}</a>
      <div class="nav-links">
        ${NAV_LINKS[lang].map(([href, label]) =>
          `<a href="${href}">${label}</a>`).join('')}
        <a href="?lang=${otherLang}" class="nav-lang">${otherLabel}</a>
      </div>
    </div>`;
}

// ── Bio / Hero ─────────────────────────────────────────────────────────────
function renderBio(profile, areas) {
  if (!profile) return;
  const bio = t(profile.bio, '')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  const certs = (profile.certifications || []).map(c =>
    `<a href="${c.url}" class="cert-badge" target="_blank" rel="noopener">${esc(c.name)}</a>`
  ).join('');
  const socials = Object.entries(profile.links || {}).map(([key, url]) =>
    `<a href="${url}" class="bio-link" target="_blank" rel="noopener">${esc(key)}</a>`
  ).join('');
  const cvLink = profile.cv
    ? `<a href="${profile.cv}" class="bio-link cv" download>CV ↓</a>` : '';

  const areaItems = (areas?.items || []);
  const tags = areaItems.map(a => {
    const field = (lang === 'ja' && a.field_ja) ? a.field_ja : a.field;
    return `<span class="area-tag">#${esc(field)}</span>`;
  }).join('');

  document.getElementById('bio').innerHTML = `
    <div class="bio-inner">
      <div class="bio-photo">
        <img src="assets/me.png" alt="${esc(t(profile.name))}">
      </div>
      <div class="bio-text">
        <h1 class="bio-name">${esc(t(profile.name))}</h1>
        <p class="bio-role">${esc(t(profile.role))}</p>
        <p class="bio-org">${esc(t(profile.organization))}</p>
        <div class="bio-desc">${bio}</div>
        ${tags ? `<div class="bio-areas">${tags}</div>` : ''}
        ${certs ? `<div class="bio-certs">${certs}</div>` : ''}
        <div class="bio-links">${socials}${cvLink}</div>
      </div>
    </div>`;
}

// ── Publications (table) ───────────────────────────────────────────────────
function renderPublications(data) {
  const el = document.getElementById('publications');
  const items = (data.items || []).filter(p => !p.draft);
  if (!items.length) { el.style.display = 'none'; return; }
  const label = lang === 'ja';
  el.innerHTML = `
    <h2 class="section-title">${label ? '論文・業績' : 'Publications'}</h2>
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

// ── Talks (presentations + media_coverage tables) ──────────────────────────
function renderTalks(presData, mediaData) {
  const el = document.getElementById('talks');
  const pres  = (presData.items  || []).filter(p => !p.draft);
  const media = (mediaData.items || []).filter(m => !m.draft);
  if (!pres.length && !media.length) { el.style.display = 'none'; return; }
  const label = lang === 'ja';
  const typeMap = { oral_presentation: 'Oral', poster_presentation: 'Poster', invited: 'Invited' };

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
            return `<tr>
              <td class="col-year">${dateYM(m.date)}</td>
              <td class="col-title">${esc(title)}</td>
              <td>${esc(m.publication || '')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : '';

  el.innerHTML = `
    <h2 class="section-title">${label ? '発表・メディア' : 'Talks & Media'}</h2>
    ${presTable}${mediaTable}`;
}

// ── Experience ─────────────────────────────────────────────────────────────
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
  const exp    = (expData.items    || []);
  const edu    = (eduData.items    || []);
  const teach  = (teachData.items  || []);
  const comm   = (commData.items   || []);
  const assoc  = (assocData.items  || []);
  const awards = (awardsData.items || []);

  if (!exp.length && !edu.length && !teach.length && !comm.length && !assoc.length && !awards.length) {
    el.style.display = 'none'; return;
  }
  const label = lang === 'ja';

  const expBlock = exp.length ? `
    <h3 class="subsection-title">${label ? '職歴' : 'Career'}</h3>
    <div class="timeline">
      ${exp.map(e => timelineItem(
        e.institution, e.institution_ja,
        e.department,  e.department_ja,
        e.position,    e.position_ja,
        e.from_date,   e.to_date
      )).join('')}
    </div>` : '';

  const eduBlock = edu.length ? `
    <h3 class="subsection-title">${label ? '学歴' : 'Education'}</h3>
    <div class="timeline">
      ${edu.map(e => timelineItem(
        e.institution, e.institution_ja,
        e.department,  e.department_ja,
        e.degree,      e.degree_ja,
        e.from_date,   e.to_date
      )).join('')}
    </div>` : '';

  const teachBlock = teach.length ? `
    <h3 class="subsection-title">${label ? '担当授業' : 'Teaching'}</h3>
    <div class="card-grid">
      ${teach.map(t => {
        const subj = (lang === 'ja' && t.subject_ja) ? t.subject_ja : t.subject;
        const inst = (lang === 'ja' && t.institution_ja) ? t.institution_ja : (t.institution || '');
        const range = [dateYear(t.from_date), t.to_date ? dateYear(t.to_date) : (label ? '現在' : 'Present')]
          .filter(Boolean).join(' – ');
        return `<div class="exp-card">
          <div class="exp-card-title">${esc(subj)}</div>
          ${inst ? `<div class="exp-card-sub">${esc(inst)}</div>` : ''}
          <div class="exp-card-date">${esc(range)}</div>
        </div>`;
      }).join('')}
    </div>` : '';

  const commBlock = comm.length ? `
    <h3 class="subsection-title">${label ? '委員会・役職' : 'Committee Memberships'}</h3>
    <div class="card-grid">
      ${comm.map(c => {
        const name = (lang === 'ja' && c.name_ja) ? c.name_ja : c.name;
        const range = [dateYM(c.from_date), c.to_date ? dateYM(c.to_date) : (label ? '現在' : 'Present')]
          .filter(Boolean).join(' – ');
        return `<div class="exp-card">
          <div class="exp-card-title">${esc(name)}</div>
          ${c.organization ? `<div class="exp-card-sub">${esc(c.organization)}</div>` : ''}
          <div class="exp-card-date">${esc(range)}</div>
        </div>`;
      }).join('')}
    </div>` : '';

  const assocBlock = assoc.length ? `
    <h3 class="subsection-title">${label ? '学会・協会' : 'Academic Societies'}</h3>
    <div class="card-grid">
      ${assoc.map(a => {
        const name = (lang === 'ja' && a.name_ja) ? a.name_ja : a.name;
        const range = [dateYM(a.from_date), a.to_date ? dateYM(a.to_date) : (label ? '現在' : 'Present')]
          .filter(Boolean).join(' – ');
        return `<div class="exp-card">
          <div class="exp-card-title">${esc(name)}</div>
          <div class="exp-card-date">${esc(range)}</div>
        </div>`;
      }).join('')}
    </div>` : '';

  const awardsBlock = awards.length ? `
    <h3 class="subsection-title">${label ? '受賞・奨学金' : 'Awards & Scholarships'}</h3>
    <div class="card-grid">
      ${awards.map(a => {
        const title = (lang === 'ja' && a.title_ja) ? a.title_ja : a.title;
        return `<div class="exp-card">
          <div class="exp-card-title">${esc(title)}</div>
          ${a.organization ? `<div class="exp-card-sub">${esc(a.organization)}</div>` : ''}
          <div class="exp-card-date">${dateYM(a.date)}</div>
        </div>`;
      }).join('')}
    </div>` : '';

  el.innerHTML = `
    <h2 class="section-title">${label ? '経歴' : 'Experience'}</h2>
    ${expBlock}${eduBlock}${teachBlock}${commBlock}${assocBlock}${awardsBlock}`;
}

// ── Projects ───────────────────────────────────────────────────────────────
function renderProjects(data) {
  const el = document.getElementById('projects');
  const items = (data.items || []).filter(p => !p.draft);
  if (!items.length) { el.style.display = 'none'; return; }
  const label = lang === 'ja';
  el.innerHTML = `
    <h2 class="section-title">${label ? '研究プロジェクト' : 'Research Projects'}</h2>
    <div class="card-grid">
      ${items.map(p => {
        const title = (lang === 'ja' && p.title_ja) ? p.title_ja : p.title;
        const range = [dateYear(p.from_date), p.to_date ? dateYear(p.to_date) : (label ? '現在' : 'Present')]
          .filter(Boolean).join(' – ');
        const kakenLink = p.kaken_url
          ? `<a href="${p.kaken_url}" class="project-link" target="_blank" rel="noopener">KAKEN →</a>` : '';
        return `<div class="project-card">
          <div class="project-title">${esc(title)}</div>
          <div class="project-date">${esc(range)}</div>
          ${p.investigators ? `<div class="project-meta">${label ? '研究者:' : 'Investigators:'} ${esc(p.investigators)}</div>` : ''}
          ${p.system ? `<div class="project-meta">${label ? '制度:' : 'System:'} ${esc(p.system)}</div>` : ''}
          ${p.offer_org ? `<div class="project-meta">${label ? '提供機関:' : 'Funder:'} ${esc(p.offer_org)}</div>` : ''}
          ${p.grant_number ? `<div class="project-meta">${label ? '課題番号:' : 'Grant No:'} ${esc(p.grant_number)}</div>` : ''}
          ${p.role ? `<div class="project-meta">${label ? '役割:' : 'Role:'} ${esc(p.role)}</div>` : ''}
          ${kakenLink}
        </div>`;
      }).join('')}
    </div>`;
}

// ── Activities (social_contribution table) ─────────────────────────────────
function renderActivities(data) {
  const el = document.getElementById('activities');
  const items = (data.items || []).filter(a => !a.draft);
  if (!items.length) { el.style.display = 'none'; return; }
  const label = lang === 'ja';
  el.innerHTML = `
    <h2 class="section-title">${label ? '社会貢献活動' : 'Activities'}</h2>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>
          <th style="width:70px">${label ? '年月' : 'Date'}</th>
          <th>${label ? 'タイトル' : 'Title'}</th>
          <th>${label ? '組織' : 'Organization'}</th>
        </tr></thead>
        <tbody>
          ${items.map(a => {
            const title = (lang === 'ja' && a.title_ja) ? a.title_ja : a.title;
            return `<tr>
              <td class="col-year">${dateYM(a.date)}</td>
              <td class="col-title">${esc(title)}</td>
              <td>${esc(a.organization || '')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Others ─────────────────────────────────────────────────────────────────
function renderOthers(data) {
  const el = document.getElementById('others');
  const items = (data.items || []).filter(o => !o.draft);
  if (!items.length) { el.style.display = 'none'; return; }
  const label = lang === 'ja';
  el.innerHTML = `
    <h2 class="section-title">${label ? 'その他' : 'Others'}</h2>
    <div class="card-grid">
      ${items.map(o => {
        const title = (lang === 'ja' && o.title_ja) ? o.title_ja : o.title;
        const desc  = (lang === 'ja' && o.description_ja) ? o.description_ja : (o.description || '');
        return `<div class="exp-card">
          <div class="exp-card-title">${esc(title)}</div>
          ${desc ? `<div class="exp-card-sub">${esc(desc)}</div>` : ''}
          <div class="exp-card-date">${dateYM(o.date)}</div>
        </div>`;
      }).join('')}
    </div>`;
}

// ── News ───────────────────────────────────────────────────────────────────
function renderNews(data) {
  const el = document.getElementById('news');
  const items = (data.items || []).filter(n => !n.draft);
  if (!items.length) { el.style.display = 'none'; return; }
  const label = lang === 'ja';
  el.innerHTML = `
    <h2 class="section-title">${label ? 'ニュース' : 'News'}</h2>
    <div class="news-list">
      ${items.map(n => `
        <div class="news-item">
          <span class="news-date">${n.date || ''}</span>
          <div>
            <div class="news-title">${esc(t(n.title))}</div>
            ${n.body ? `<div class="news-body">${esc(t(n.body))}</div>` : ''}
            ${n.url ? `<a class="news-link" href="${n.url}" target="_blank" rel="noopener">${label ? '詳細 →' : 'Read more →'}</a>` : ''}
          </div>
        </div>`).join('')}
    </div>`;
}

// ── Materials / Tools ──────────────────────────────────────────────────────
function renderMaterials(data) {
  const el = document.getElementById('materials');
  const items = (data.items || []).filter(m => !m.draft);
  if (!items.length) { el.style.display = 'none'; return; }
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

// ── Footer ─────────────────────────────────────────────────────────────────
function renderFooter(profile) {
  const name = t(profile?.name, 'Yasutomi Tatetsu');
  document.getElementById('footer').innerHTML = `
    <p>© ${new Date().getFullYear()} ${esc(name)}</p>
    <p style="margin-top:6px">
      ${lang === 'ja'
        ? '研究業績は <a href="https://researchmap.jp/yasutomi_tatetsu" target="_blank">Researchmap</a> から自動取得しています'
        : 'Research data auto-synced from <a href="https://researchmap.jp/yasutomi_tatetsu" target="_blank">Researchmap</a>'}
    </p>`;
}

// ── Main ───────────────────────────────────────────────────────────────────
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

  const profile   = profileYaml   ? jsyaml.load(profileYaml)   : null;
  const newsData  = newsYaml      ? jsyaml.load(newsYaml)       : {};
  const matsData  = materialsYaml ? jsyaml.load(materialsYaml)  : {};

  document.documentElement.lang = lang;

  renderNav(profile);
  renderBio(profile, areas);
  renderPublications(pubs);
  renderTalks(pres, media);
  renderExperience(exp, edu, teach, comm, assoc, awards);
  renderProjects(projects);
  renderActivities(soc);
  renderOthers(others);
  renderNews(newsData);
  renderMaterials(matsData);
  renderFooter(profile);
}

main().catch(e => {
  document.getElementById('bio').innerHTML = `<p class="error">Error: ${esc(e.message)}</p>`;
  console.error(e);
});
