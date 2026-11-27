// CIUP Fast Track — single-page app (Supabase-backed)

// ── State ──────────────────────────────────────────────────────
const state = {
  user:              null,
  view:              'loading',
  search:            '',
  selectedProblem:   null,
  selectedHouse:     HOUSES[0],
  selectedStaffType: "I don't know",
  selectedIntent:    'Report a problem',
  results:           [],
  expandedCard:      0,
};

let isSubmitting = false;

// ── Icons ──────────────────────────────────────────────────────
const LOGO = `
<svg class="navbar-logo" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="7" fill="#2C5A42"/>
  <path d="M16 9.5L23.5 22.5H8.5L16 9.5Z" fill="white"/>
</svg>`;

const IC = {
  back:      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`,
  search:    `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
  warn:      `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" color="#D97706"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  info:      `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  spin:      `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin .8s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
  chevDown:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
  chevUp:    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`,
  arrowRight:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`,
  copy:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  ddSection: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>`,
  ddQA:      `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
};

// ── Utilities ──────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

function normalizeContact(row) {
  return {
    id:           row.id,
    name:         row.name,
    role:         row.role         ?? '',
    description:  row.description  ?? '',
    subtitle:     row.subtitle     ?? '',
    hours:        row.hours        ?? '',
    responseTime: row.response_time ?? null,
    email:        row.email        ?? null,
    phone:        row.phone        ?? null,
    location:     row.location     ?? null,
    languages:    row.languages    ?? null,
    alwaysOpen:   row.always_open  ?? false,
    wholeCampus:  row.whole_campus ?? false,
  };
}

// ── Navigation ─────────────────────────────────────────────────
function navigate(view, patch = {}) {
  Object.assign(state, patch);
  state.view = view;
  renderApp();
  window.scrollTo({ top: 0 });
}

async function logout() {
  await supabaseClient.auth.signOut();
  state.user = null;
  navigate('login');
}

// ── Business logic ─────────────────────────────────────────────
function searchByQuery(query) {
  const q = query.toLowerCase().trim();
  if (!q) return null;
  for (const entry of SEARCH_INDEX) {
    if (entry.terms.some(t => q.includes(t) || t.includes(q.split(' ')[0]))) {
      return { name: query, dept: CONTACTS[entry.key]?.role || '', key: entry.key };
    }
  }
  return { name: query, dept: 'Reception', key: 'reception' };
}

function buildResults(problem, staffType) {
  if (staffType !== "I don't know") {
    const key = STAFF_TYPE_KEY[staffType];
    return [key ? CONTACTS[key] : null, CONTACTS.security].filter(Boolean);
  }
  const key  = problem?.key || 'reception';
  const best = CONTACTS[key];
  const sec  = key !== 'reception' ? CONTACTS.reception : null;
  return [best, sec, CONTACTS.security].filter(Boolean);
}

// ── Supabase data loading ──────────────────────────────────────
async function loadRemoteData() {
  try {
    const [contactsRes, housesRes] = await Promise.all([
      supabaseClient.from('contacts').select('*'),
      supabaseClient.from('houses').select('name').order('name'),
    ]);
    if (contactsRes.data?.length) {
      for (const key of Object.keys(CONTACTS)) delete CONTACTS[key];
      contactsRes.data.forEach(row => { CONTACTS[row.id] = normalizeContact(row); });
    }
    if (housesRes.data?.length) {
      HOUSES.length = 0;
      housesRes.data.forEach(row => HOUSES.push(row.name));
      if (!HOUSES.includes(state.selectedHouse)) state.selectedHouse = HOUSES[0];
    }
  } catch (_) { /* fall back to hardcoded data */ }
}

// ── Supabase auth ──────────────────────────────────────────────
async function doLogin() {
  if (isSubmitting) return;
  const email = document.getElementById('l-email')?.value?.trim();
  const pass  = document.getElementById('l-pass')?.value;
  const err   = document.getElementById('login-err');
  if (!email || !pass) { err.innerHTML = '<div class="error-msg">Please enter your email and password.</div>'; return; }

  isSubmitting = true;
  setBtnLoading('login-btn', 'Logging in…');

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
  if (error) {
    err.innerHTML = `<div class="error-msg">${esc(error.message)}</div>`;
    setBtnLoading('login-btn', 'Log in', false);
    isSubmitting = false;
    return;
  }
  const { data: profile } = await supabaseClient.from('profiles').select('name, house').eq('id', data.user.id).single();
  state.user = { name: profile?.name || email.split('@')[0], email, house: profile?.house || HOUSES[0] };
  state.selectedHouse = state.user.house;
  isSubmitting = false;
  navigate('step1');
}

// Dev shortcut: only available when served from localhost (never on the deployed site).
const IS_DEV_HOST = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname);

function devLogin() {
  if (!IS_DEV_HOST) return;
  state.user = { name: 'Dev user', email: 'dev@localhost', house: HOUSES[0] };
  state.selectedHouse = state.user.house;
  navigate('step1');
}

async function doRegister() {
  if (isSubmitting) return;
  const name  = document.getElementById('r-name')?.value?.trim();
  const email = document.getElementById('r-email')?.value?.trim();
  const house = document.getElementById('r-house')?.value;
  const pass  = document.getElementById('r-pass')?.value;
  const err   = document.getElementById('reg-err');

  if (!name || !email || !pass) { err.innerHTML = '<div class="error-msg">Please fill in all required fields.</div>'; return; }
  if (!house)                   { err.innerHTML = '<div class="error-msg">Please select your house.</div>'; return; }
  if (pass.length < 8)          { err.innerHTML = '<div class="error-msg">Password must be at least 8 characters.</div>'; return; }

  isSubmitting = true;
  setBtnLoading('register-btn', 'Creating account…');

  const { data, error } = await supabaseClient.auth.signUp({ email, password: pass });
  if (error) {
    err.innerHTML = `<div class="error-msg">${esc(error.message)}</div>`;
    setBtnLoading('register-btn', 'Create account', false);
    isSubmitting = false;
    return;
  }
  if (data.user) await supabaseClient.from('profiles').upsert({ id: data.user.id, name, house });

  if (!data.session) {
    err.innerHTML = `<div class="error-msg" style="color:#166534;background:#DCFCE7;border-color:#86EFAC">
      Account created! Check your email to confirm it, then log in.</div>`;
    setBtnLoading('register-btn', 'Create account', false);
    isSubmitting = false;
    return;
  }
  state.user = { name, email, house };
  state.selectedHouse = house;
  isSubmitting = false;
  navigate('step1');
}

function setBtnLoading(id, text, loading = true) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled  = loading;
  btn.innerHTML = loading ? `${IC.spin} ${esc(text)}` : esc(text);
}

// ── Navbar ─────────────────────────────────────────────────────
function navbar(mode) {
  let actions = '';
  if (mode === 'login')    actions = `<button class="btn-nav" onclick="navigate('register')">Create an account</button>`;
  if (mode === 'register') actions = `<span style="color:var(--muted);font-size:14px">Already have an account?</span> <button class="link" onclick="navigate('login')">Log in</button>`;
  if (mode === 'app')      actions = `<a class="link" href="cite-u-3d/index.html">Campus map</a><span class="navbar-user">${esc(state.user?.name)}</span><button class="link" onclick="logout()">Log out</button>`;
  const brand = mode === 'app'
    ? `<span class="navbar-brand clickable" onclick="navigate('step1')">${LOGO} CIUP Fast Track</span>`
    : `<span class="navbar-brand">${LOGO} CIUP Fast Track</span>`;
  return `<nav class="navbar">${brand}<div class="navbar-actions">${actions}</div></nav>`;
}

// ── Page: Loading ──────────────────────────────────────────────
function pageLoading() {
  return `<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:14px">
    ${LOGO.replace('class="navbar-logo"','style="width:48px;height:48px"')}
    <p style="font-size:15px;color:var(--muted);font-weight:500">Loading…</p>
  </div>`;
}

// ── Page: Login ─────────────────────────────────────────────────
function pageLogin() {
  return `
${navbar('login')}
<div class="login-layout">
  <div class="login-hero">
    <h1>Something wrong in your house? Find the right person in a few clicks.</h1>
    <p>Search your problem, tell us which house you live in, and get the email or phone number of the staff member who can actually help.</p>
    <span class="tagline">For residents of the Cité internationale universitaire de Paris</span>
  </div>
  <div class="login-form-side">
    <div class="login-form-box">
      <h2>Log in</h2>
      <p class="subtitle">Use the email and password of your Fast Track account.</p>
      <div id="login-err"></div>
      <div class="form-group">
        <label class="form-label" for="l-email">Email</label>
        <input class="form-input" type="email" id="l-email" placeholder="you@example.com" autocomplete="email">
      </div>
      <div class="form-group">
        <div class="form-label-row">
          <label class="form-label" style="margin-bottom:0" for="l-pass">Password</label>
          <button class="link" style="font-size:13px" type="button">Forgot password?</button>
        </div>
        <input class="form-input" type="password" id="l-pass" placeholder="••••••••" autocomplete="current-password">
      </div>
      <button class="btn btn-primary" id="login-btn" onclick="doLogin()">Log in</button>
      ${IS_DEV_HOST ? `<button class="btn btn-outline" style="width:100%;margin-top:10px;border-style:dashed" type="button" onclick="devLogin()">Dev: continue without logging in</button>` : ''}

      <div class="info-notice info-notice-white" style="margin-top:20px;margin-bottom:0">
        <span>${IC.info}</span>
        <div>
          <div style="font-weight:700;margin-bottom:4px">New here? You need a Fast Track account</div>
          <div style="color:var(--muted);font-size:13px;margin-bottom:14px">This app has its own accounts. Your CIUP account won't work here, even if you already have one. Creating an account takes about a minute.</div>
          <button class="btn btn-outline" style="width:100%" onclick="navigate('register')">Create an account</button>
        </div>
      </div>
    </div>
  </div>
</div>`;
}

// ── Page: Register ──────────────────────────────────────────────
function pageRegister() {
  return `
${navbar('register')}
<div class="register-page">
  <h2>Create your Fast Track account</h2>
  <p class="subtitle">One account, then you can find the right contact any time.</p>

  <div class="info-notice info-notice-green">
    ${IC.info}
    <span><strong>This is a separate account.</strong> It is not linked to your CIUP account, so choose a new password here even if you already have a CIUP login.</span>
  </div>

  <div class="register-card">
    <div id="reg-err"></div>
    <div class="form-group">
      <label class="form-label" for="r-name">Full name</label>
      <input class="form-input" type="text" id="r-name" placeholder="Your full name" autocomplete="name">
    </div>
    <div class="form-group">
      <label class="form-label" for="r-email">Email</label>
      <input class="form-input" type="email" id="r-email" placeholder="you@example.com" autocomplete="email">
    </div>
    <div class="form-group">
      <label class="form-label" for="r-house">Your house</label>
      <select class="form-select" id="r-house">
        <option value="" disabled selected>Choose your house…</option>
        ${HOUSES.map(h => `<option value="${esc(h)}">${esc(h)}</option>`).join('')}
      </select>
      <div class="field-hint">We'll pre-fill this when you search. You can change it later.</div>
    </div>
    <div class="form-group" style="margin-bottom:20px">
      <label class="form-label" for="r-pass">Create a password</label>
      <input class="form-input" type="password" id="r-pass" placeholder="At least 8 characters" autocomplete="new-password">
      <div class="field-hint">At least 8 characters.</div>
    </div>
    <button class="btn btn-primary" id="register-btn" onclick="doRegister()">Create account</button>
  </div>
</div>`;
}

// ── Page: Step 1 ────────────────────────────────────────────────
function pageStep1() {
  return `
${navbar('app')}
<div class="page-wrap">
  <div class="step-label">STEP 1 OF 3</div>
  <h1 class="page-title">What do you need help with?</h1>
  <p class="page-subtitle">Type a few words, tap a keyword, or pick a common problem below.</p>

  <div class="search-label">Search for a problem or a person</div>
  <div class="search-row">
    <div class="search-input-wrap">
      <span class="search-icon">${IC.search}</span>
      <input class="search-input" type="text" id="search-q"
        placeholder="e.g. heating, wifi, rent, lost key…"
        value="${esc(state.search)}"
        onkeydown="if(event.key==='Enter'){hideDropdown();doSearch()}"
        autocomplete="off">
      <div class="search-dropdown" id="search-dropdown"></div>
    </div>
    <button class="search-btn" onclick="hideDropdown();doSearch()">Search</button>
  </div>

  <div class="keywords-section">
    <div class="keywords-label">Popular keywords</div>
    <div class="keywords-row">
      ${POPULAR_KEYWORDS.map(k => `
        <button class="keyword-chip" onclick="useKeyword('${esc(k)}')">${esc(k)}</button>`).join('')}
    </div>
  </div>

  <div class="section-label">Common problems</div>
  <div class="problems-grid">
    ${COMMON_PROBLEMS.map((p, i) => `
      <div class="problem-card" onclick="selectProblem(${i})">
        <div class="problem-name">${esc(p.name)}</div>
        <div class="problem-dept">${esc(p.dept)}</div>
      </div>`).join('')}
  </div>

  <a class="map-promo" href="cite-u-3d/index.html">
    <span><strong>Looking for a place, not a person?</strong><br>
    Explore the 3D campus map: houses, restaurants, sports, services and transport.</span>
    <span class="map-promo-cta">Open the map ${IC.arrowRight}</span>
  </a>

  <div class="emergency-banner">
    ${IC.warn}
    <span>
      <strong>Emergency?</strong> Fire, flooding or a safety threat: call <strong>112</strong>,
      then contact CIUP security at <strong>+33 1 44 16 65 00</strong> (24/7).
    </span>
  </div>
</div>`;
}

// ── Page: Step 2 ────────────────────────────────────────────────
function step2Summary() {
  const house  = state.selectedHouse || '—';
  const staff  = state.selectedStaffType === "I don't know" ? 'Best match' : state.selectedStaffType;
  const intent = state.selectedIntent;
  return `${esc(house)} · ${esc(staff)} · ${esc(intent)}`;
}

function pageStep2() {
  const p = state.selectedProblem;
  return `
${navbar('app')}
<div class="page-wrap">
  <button class="back-btn" onclick="navigate('step1')">${IC.back} Back to search</button>
  <div class="step-label">STEP 2 OF 3</div>
  <h1 class="page-title">Tell us a bit more</h1>
  <div class="searched-for">
    You searched for <span class="searched-tag">${esc(p?.name || state.search || 'your problem')}</span>
  </div>

  <div class="filter-card">
    <div class="filter-title">Which house do you live in?</div>
    <div class="filter-hint">Most staff work for one house, so this decides who you reach.</div>
    <select class="form-select" id="house-sel" onchange="state.selectedHouse=this.value;refreshBar()">
      ${HOUSES.map(h => `<option value="${esc(h)}" ${h===state.selectedHouse?'selected':''}>${esc(h)}</option>`).join('')}
    </select>
  </div>

  <div class="filter-card">
    <div class="filter-title">What kind of staff are you trying to reach?</div>
    <div class="filter-hint">Not sure? Leave it on "I don't know" and we'll suggest the best fit.</div>
    <div class="chips">
      ${STAFF_TYPES.map((t, i) => {
        const active = state.selectedStaffType === t;
        return `<button class="chip ${active?'active':''}" onclick="setStaffType(${i})">${active?'✓ ':''}${esc(t)}</button>`;
      }).join('')}
    </div>
  </div>

  <div class="filter-card">
    <div class="filter-title">What do you want to do?</div>
    <div class="filter-hint">This helps us put the most suitable contact first.</div>
    <div class="chips">
      ${INTENTS.map((t, i) => {
        const active = state.selectedIntent === t;
        return `<button class="chip ${active?'active':''}" onclick="setIntent(${i})">${active?'✓ ':''}${esc(t)}</button>`;
      }).join('')}
    </div>
  </div>

  <div class="step2-bar" id="step2-bar">
    <div>
      <div class="step2-bar-label">Ready to see who can help</div>
      <div class="step2-bar-summary" id="bar-summary">${step2Summary()}</div>
    </div>
    <button class="step2-bar-btn" onclick="doShowContacts()">Show contacts ${IC.arrowRight}</button>
  </div>
</div>`;
}

// ── Page: Step 3 (accordion) ────────────────────────────────────
function pageStep3() {
  const r    = state.results;
  const tags = [
    state.selectedProblem?.name,
    state.selectedHouse,
    state.selectedStaffType !== "I don't know" ? state.selectedStaffType : null,
    state.selectedIntent,
  ].filter(Boolean);

  return `
${navbar('app')}
<div class="page-wrap">
  <button class="back-btn" onclick="navigate('step2')">${IC.back} Change details</button>
  <div class="step-label">STEP 3 OF 3</div>
  <h1 class="page-title">${r.length} contact${r.length!==1?'s':''} can help you</h1>
  <p class="page-subtitle" style="margin-bottom:20px">Choose a contact to see their details.</p>

  <div class="tags-row" style="margin-bottom:24px">
    ${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}
  </div>

  <div class="acc-cards">
    ${r.map((c, i) => accCardHtml(c, i, i === state.expandedCard)).join('')}
  </div>

  <div class="new-search" style="margin-top:24px">
    Not what you need?
    <button class="link" onclick="navigate('step1',{search:'',selectedProblem:null})">Start a new search.</button>
  </div>
</div>`;
}

function accCardHtml(c, idx, expanded) {
  const isBest     = idx === 0;
  const houseLabel = c.wholeCampus ? 'Whole campus' : state.selectedHouse;

  const header = `
    <div class="acc-header" onclick="toggleCard(${idx})">
      <div class="acc-header-left">
        ${isBest ? '<div class="best-badge" style="margin-bottom:8px">Best match</div>' : ''}
        <div class="acc-name">${esc(c.name)}</div>
        <div class="acc-subtitle">${esc(houseLabel)} · ${esc(c.subtitle)}</div>
      </div>
      <span class="acc-chevron">${expanded ? IC.chevUp : IC.chevDown}</span>
    </div>`;

  if (!expanded) return `<div class="acc-card" id="acc-${idx}">${header}</div>`;

  const infoGrid = `
    <div class="acc-info-grid">
      <div>
        <div class="acc-info-label">Opening hours</div>
        <div class="acc-info-value">${esc(c.hours)}</div>
      </div>
      ${c.location ? `<div>
        <div class="acc-info-label">Where to find them</div>
        <div class="acc-info-value">${esc(c.location)}</div>
      </div>` : '<div></div>'}
      ${c.languages ? `<div>
        <div class="acc-info-label">Languages</div>
        <div class="acc-info-value">${esc(c.languages)}</div>
      </div>` : '<div></div>'}
    </div>`;

  const contactRow = (c.email || c.phone) ? `
    <div class="acc-contact-row">
      <div class="acc-contact-data">
        ${c.email ? `<div><strong>Email</strong> ${esc(c.email)}</div>` : ''}
        ${c.phone ? `<div><strong>Phone</strong> ${esc(c.phone)}</div>` : ''}
      </div>
      ${c.email ? `<button class="btn-copy-email" id="copy-btn-${idx}" onclick="copyEmail('${esc(c.email)}',${idx})">${IC.copy} Copy email</button>` : ''}
    </div>` : '';

  const warnBox = !c.alwaysOpen ? `
    <div class="acc-warn">
      Outside opening hours? For urgent issues, call CIUP security at +33 1 44 16 65 00 (24/7).
    </div>` : '';

  return `
    <div class="acc-card expanded" id="acc-${idx}">
      ${header}
      <div class="acc-body">
        ${infoGrid}
        ${contactRow}
        ${warnBox}
      </div>
    </div>`;
}

// ── Event handlers ─────────────────────────────────────────────
function doSearch() {
  const q = document.getElementById('search-q')?.value?.trim();
  if (!q) return;
  state.search = q;
  state.selectedProblem = searchByQuery(q);
  navigate('step2');
}

function selectProblem(idx) {
  const p = COMMON_PROBLEMS[idx];
  state.selectedProblem = p;
  state.search = p.name;
  navigate('step2');
}

function useKeyword(kw) {
  const input = document.getElementById('search-q');
  if (input) input.value = kw;
  state.search = kw;
  state.selectedProblem = searchByQuery(kw);
  navigate('step2');
}

function setStaffType(idx) {
  state.selectedStaffType = STAFF_TYPES[idx];
  renderApp();
}

function setIntent(idx) {
  state.selectedIntent = INTENTS[idx];
  renderApp();
}

function refreshBar() {
  const el = document.getElementById('bar-summary');
  if (el) el.textContent = step2Summary().replace(/&amp;/g,'&').replace(/&#x27;/g,"'");
}

function doShowContacts() {
  const sel = document.getElementById('house-sel');
  if (sel) state.selectedHouse = sel.value;
  state.results      = buildResults(state.selectedProblem, state.selectedStaffType);
  state.expandedCard = 0;
  navigate('step3');
}

function toggleCard(idx) {
  state.expandedCard = state.expandedCard === idx ? null : idx;
  // Re-render only the cards section to avoid scroll-to-top
  const cardsEl = document.querySelector('.acc-cards');
  if (cardsEl) {
    cardsEl.innerHTML = state.results.map((c, i) =>
      accCardHtml(c, i, i === state.expandedCard)
    ).join('');
  }
}

function copyEmail(email, idx) {
  const finish = (ok) => {
    const btn = document.getElementById(`copy-btn-${idx}`);
    if (!btn) return;
    btn.innerHTML = `${IC.copy} ${ok ? 'Copied!' : 'Copy email'}`;
    if (ok) {
      btn.classList.add('copied');
      setTimeout(() => { btn.innerHTML = `${IC.copy} Copy email`; btn.classList.remove('copied'); }, 2000);
    }
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(email).then(() => finish(true)).catch(() => finish(false));
  } else {
    const ta = Object.assign(document.createElement('textarea'), { value: email });
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    finish(true);
  }
}

// ── Search autocomplete ────────────────────────────────────────
function updateDropdown() {
  const q  = document.getElementById('search-q')?.value?.trim().toLowerCase() || '';
  const dd = document.getElementById('search-dropdown');
  if (!dd) return;
  if (!q) { dd.style.display = 'none'; return; }

  const matchProblems = COMMON_PROBLEMS.filter(p =>
    p.name.toLowerCase().includes(q) || p.dept.toLowerCase().includes(q)
  );
  const matchQA = QUICK_ANSWERS.filter(qa =>
    qa.question.toLowerCase().includes(q) || qa.keywords.some(k => k.includes(q))
  );

  if (!matchProblems.length && !matchQA.length) { dd.style.display = 'none'; return; }

  let html = '';
  if (matchProblems.length) {
    html += `<div class="dd-section">Sections</div>`;
    matchProblems.forEach(p => {
      const idx = COMMON_PROBLEMS.indexOf(p);
      html += `<div class="dd-item" onmousedown="selectProblem(${idx})">
        <span class="dd-item-icon">${IC.ddSection}</span>
        <span style="flex:1">${esc(p.name)}</span>
        <span class="dd-item-dept">${esc(p.dept)}</span>
      </div>`;
    });
  }
  if (matchQA.length) {
    html += `<div class="dd-section">Quick answers</div>`;
    matchQA.forEach(qa => {
      html += `<div class="dd-item" onmousedown="selectQuickAnswer('${esc(qa.id)}')">
        <span class="dd-item-icon">${IC.ddQA}</span>
        <div>
          <div class="dd-qa-q">${esc(qa.question)}</div>
          <div class="dd-qa-a">${esc(qa.answer)}</div>
        </div>
      </div>`;
    });
  }

  dd.innerHTML = html;
  dd.style.display = 'block';
}

function hideDropdown() {
  const dd = document.getElementById('search-dropdown');
  if (dd) dd.style.display = 'none';
}

function selectQuickAnswer(qaId) {
  const qa = QUICK_ANSWERS.find(q => q.id === qaId);
  if (!qa) return;
  state.search = qa.question;
  state.selectedProblem = { name: qa.question, dept: CONTACTS[qa.key]?.role || '', key: qa.key };
  navigate('step2');
}

// ── Keyboard / event wiring ────────────────────────────────────
function attachKeys() {
  const lEmail = document.getElementById('l-email');
  const lPass  = document.getElementById('l-pass');
  if (lEmail) lEmail.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  if (lPass)  lPass.addEventListener('keydown',  e => { if (e.key === 'Enter') doLogin(); });

  const rPass = document.getElementById('r-pass');
  if (rPass) rPass.addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); });

  const sq = document.getElementById('search-q');
  if (sq) {
    sq.addEventListener('input', updateDropdown);
    sq.addEventListener('blur',  () => setTimeout(hideDropdown, 150));
  }
}

// ── Render ─────────────────────────────────────────────────────
const AUTH_VIEWS = ['step1','step2','step3'];

function renderApp() {
  if (AUTH_VIEWS.includes(state.view) && !state.user) state.view = 'login';
  const pages = { loading: pageLoading, login: pageLogin, register: pageRegister,
                  step1: pageStep1, step2: pageStep2, step3: pageStep3 };
  document.getElementById('app').innerHTML = (pages[state.view] || pageLogin)();
  attachKeys();
}

// ── Spin animation ─────────────────────────────────────────────
const _style = document.createElement('style');
_style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(_style);

// ── Bootstrap ──────────────────────────────────────────────────
async function initApp() {
  renderApp();
  const [, sessionResult] = await Promise.all([
    loadRemoteData(),
    supabaseClient.auth.getSession(),
  ]);
  const session = sessionResult?.data?.session;
  if (session) {
    const { data: profile } = await supabaseClient
      .from('profiles').select('name, house').eq('id', session.user.id).single();
    state.user = {
      name:  profile?.name  || session.user.email.split('@')[0],
      email: session.user.email,
      house: profile?.house || HOUSES[0],
    };
    state.selectedHouse = state.user.house;
    navigate('step1');
  } else {
    navigate('login');
  }
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' && AUTH_VIEWS.includes(state.view)) {
      state.user = null;
      navigate('login');
    }
  });
}

initApp();
