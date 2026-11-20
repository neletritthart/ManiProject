// CIUP Fast Track — single-page app (Supabase-backed)

// ── State ──────────────────────────────────────────────────────
const state = {
  user:              null,   // { name, email, house }
  view:              'loading',
  search:            '',
  selectedProblem:   null,
  selectedHouse:     HOUSES[0],
  selectedStaffType: "I don't know",
  selectedIntent:    'Report a problem',
  results:           [],
  selectedContact:   null,
};

let isSubmitting = false;

// ── SVGs ───────────────────────────────────────────────────────
const LOGO = `
<svg class="navbar-logo" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="7" fill="#2C5A42"/>
  <path d="M16 9.5L23.5 22.5H8.5L16 9.5Z" fill="white"/>
</svg>`;

const IC = {
  back:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`,
  search: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
  warn:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" color="#D97706"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  email:  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  phone:  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.5 2 2 0 0 1 3.59 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l.76-.76a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 17.4z"/></svg>`,
  spin:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin .8s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
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
  const key = problem?.key || 'reception';
  const best      = CONTACTS[key];
  const secondary = key !== 'reception' ? CONTACTS.reception : null;
  return [best, secondary, CONTACTS.security].filter(Boolean);
}

// ── Supabase data loading ──────────────────────────────────────
async function loadRemoteData() {
  try {
    const [contactsRes, housesRes] = await Promise.all([
      supabaseClient.from('contacts').select('*'),
      supabaseClient.from('houses').select('name').order('name'),
    ]);

    if (contactsRes.data?.length) {
      // Clear and repopulate in-memory CONTACTS object
      for (const key of Object.keys(CONTACTS)) delete CONTACTS[key];
      contactsRes.data.forEach(row => { CONTACTS[row.id] = normalizeContact(row); });
    }

    if (housesRes.data?.length) {
      HOUSES.length = 0;
      housesRes.data.forEach(row => HOUSES.push(row.name));
      // Keep selectedHouse in sync
      if (!HOUSES.includes(state.selectedHouse)) state.selectedHouse = HOUSES[0];
    }
  } catch (_) {
    // Network unavailable — silently fall back to hardcoded data.js values
  }
}

// ── Supabase auth ──────────────────────────────────────────────
async function doLogin() {
  if (isSubmitting) return;
  const email = document.getElementById('l-email')?.value?.trim();
  const pass  = document.getElementById('l-pass')?.value;
  const err   = document.getElementById('login-err');

  if (!email || !pass) {
    err.innerHTML = '<div class="error-msg">Please enter your email and password.</div>';
    return;
  }

  isSubmitting = true;
  setBtnLoading('login-btn', 'Logging in…');

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });

  if (error) {
    err.innerHTML = `<div class="error-msg">${esc(error.message)}</div>`;
    setBtnLoading('login-btn', 'Log in', false);
    isSubmitting = false;
    return;
  }

  const { data: profile } = await supabaseClient
    .from('profiles').select('name, house').eq('id', data.user.id).single();

  state.user = {
    name:  profile?.name  || email.split('@')[0],
    email,
    house: profile?.house || HOUSES[0],
  };
  state.selectedHouse = state.user.house;
  isSubmitting = false;
  navigate('step1');
}

async function doRegister() {
  if (isSubmitting) return;
  const name    = document.getElementById('r-name')?.value?.trim();
  const email   = document.getElementById('r-email')?.value?.trim();
  const house   = document.getElementById('r-house')?.value;
  const pass    = document.getElementById('r-pass')?.value;
  const confirm = document.getElementById('r-confirm')?.value;
  const err     = document.getElementById('reg-err');

  if (!name || !email || !pass) {
    err.innerHTML = '<div class="error-msg">Please fill in all required fields.</div>';
    return;
  }
  if (pass !== confirm) {
    err.innerHTML = '<div class="error-msg">Passwords do not match.</div>';
    return;
  }
  if (pass.length < 6) {
    err.innerHTML = '<div class="error-msg">Password must be at least 6 characters.</div>';
    return;
  }

  isSubmitting = true;
  setBtnLoading('register-btn', 'Creating account…');

  const { data, error } = await supabaseClient.auth.signUp({ email, password: pass });

  if (error) {
    err.innerHTML = `<div class="error-msg">${esc(error.message)}</div>`;
    setBtnLoading('register-btn', 'Create account', false);
    isSubmitting = false;
    return;
  }

  // Insert profile row (works whether email confirmation is on or off)
  if (data.user) {
    await supabaseClient.from('profiles').upsert({ id: data.user.id, name, house });
  }

  // If email confirmation is required Supabase returns user but no session
  if (!data.session) {
    err.innerHTML = `<div class="error-msg" style="color:#166534;background:#DCFCE7;border-color:#86EFAC">
      Account created! Check your email to confirm, then log in.</div>`;
    setBtnLoading('register-btn', 'Create account', false);
    isSubmitting = false;
    return;
  }

  state.user = { name, email, house };
  state.selectedHouse = house;
  isSubmitting = false;
  navigate('step1');
}

async function logout() {
  await supabaseClient.auth.signOut();
  state.user = null;
  navigate('login');
}

// ── Helper: button loading state ───────────────────────────────
function setBtnLoading(id, text, loading = true) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled  = loading;
  btn.innerHTML = loading ? `${IC.spin} ${esc(text)}` : esc(text);
}

// ── Navbar ─────────────────────────────────────────────────────
function navbar(mode) {
  let actions = '';
  if (mode === 'login')    actions = `<button class="link" onclick="navigate('register')">Create an account</button>`;
  if (mode === 'register') actions = `<button class="link" onclick="navigate('login')">Log in</button>`;
  if (mode === 'app')      actions = `<span class="navbar-user">${esc(state.user?.name)}</span><button class="link" onclick="logout()">Log out</button>`;
  const brand = mode === 'app'
    ? `<span class="navbar-brand clickable" onclick="navigate('step1')">${LOGO} CIUP Fast Track</span>`
    : `<span class="navbar-brand">${LOGO} CIUP Fast Track</span>`;
  return `<nav class="navbar">${brand}<div class="navbar-actions">${actions}</div></nav>`;
}

// ── Page: Loading ──────────────────────────────────────────────
function pageLoading() {
  return `
<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:14px">
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
      <p class="subtitle">Use the email you registered with as a resident.</p>
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
      <div class="form-footer">New resident? <button class="link" onclick="navigate('register')">Create an account</button></div>
    </div>
  </div>
</div>`;
}

// ── Page: Register ──────────────────────────────────────────────
function pageRegister() {
  return `
${navbar('register')}
<div class="login-layout">
  <div class="login-hero">
    <h1>Something wrong in your house? Find the right person in a few clicks.</h1>
    <p>Search your problem, tell us which house you live in, and get the email or phone number of the staff member who can actually help.</p>
    <span class="tagline">For residents of the Cité internationale universitaire de Paris</span>
  </div>
  <div class="login-form-side">
    <div class="login-form-box">
      <h2>Create an account</h2>
      <p class="subtitle">Register with your resident email address.</p>
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
        <label class="form-label" for="r-house">Which house do you live in?</label>
        <select class="form-select" id="r-house">
          ${HOUSES.map(h => `<option value="${esc(h)}">${esc(h)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="r-pass">Password</label>
        <input class="form-input" type="password" id="r-pass" placeholder="Min. 6 characters" autocomplete="new-password">
      </div>
      <div class="form-group">
        <label class="form-label" for="r-confirm">Confirm password</label>
        <input class="form-input" type="password" id="r-confirm" placeholder="••••••••" autocomplete="new-password">
      </div>
      <button class="btn btn-primary" id="register-btn" onclick="doRegister()">Create account</button>
      <div class="form-footer">Already have an account? <button class="link" onclick="navigate('login')">Log in</button></div>
    </div>
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
  <p class="page-subtitle">Describe your problem in a few words, or pick a common one below.</p>

  <div class="search-label">Search for a problem or a person</div>
  <div class="search-row">
    <div class="search-input-wrap">
      <span class="search-icon">${IC.search}</span>
      <input class="search-input" type="text" id="search-q"
        placeholder="e.g. heating, wifi, rent, lost key…"
        value="${esc(state.search)}"
        onkeydown="if(event.key==='Enter') doSearch()">
    </div>
    <button class="search-btn" onclick="doSearch()">Search</button>
  </div>

  <div class="section-label">Common problems</div>
  <div class="problems-grid">
    ${COMMON_PROBLEMS.map((p, i) => `
      <div class="problem-card" onclick="selectProblem(${i})">
        <div class="problem-name">${esc(p.name)}</div>
        <div class="problem-dept">${esc(p.dept)}</div>
      </div>`).join('')}
  </div>

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
    <select class="form-select" id="house-sel" onchange="state.selectedHouse=this.value">
      ${HOUSES.map(h => `<option value="${esc(h)}" ${h===state.selectedHouse?'selected':''}>${esc(h)}</option>`).join('')}
    </select>
  </div>

  <div class="filter-card">
    <div class="filter-title">What kind of staff are you trying to reach?</div>
    <div class="filter-hint">Not sure? Leave it on "I don't know" and we'll suggest the best fit.</div>
    <div class="chips">
      ${STAFF_TYPES.map((t, i) => `
        <button class="chip ${state.selectedStaffType===t?'active':''}"
          onclick="setStaffType(${i})">${esc(t)}</button>`).join('')}
    </div>
  </div>

  <div class="filter-card">
    <div class="filter-title">What do you want to do?</div>
    <div class="filter-hint">This helps us put the most suitable contact first.</div>
    <div class="chips">
      ${INTENTS.map((t, i) => `
        <button class="chip ${state.selectedIntent===t?'active':''}"
          onclick="setIntent(${i})">${esc(t)}</button>`).join('')}
    </div>
  </div>

  <div class="step2-footer">
    <button class="btn-show" onclick="doShowContacts()">Show contacts</button>
  </div>
</div>`;
}

// ── Page: Step 3 ────────────────────────────────────────────────
function pageStep3() {
  const r = state.results;
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
  <h1 class="page-title">${r.length} contact${r.length !== 1 ? 's' : ''} can help you</h1>

  <div class="tags-row">
    ${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}
  </div>

  <div class="contact-cards">
    ${r.map((c, i) => cardHtml(c, i === 0)).join('')}
  </div>

  <div class="new-search">
    Not what you need?
    <button class="link" onclick="navigate('step1', {search:'', selectedProblem:null})">Start a new search.</button>
  </div>
</div>`;
}

function cardHtml(c, isBest) {
  const houseLabel = c.wholeCampus ? 'Whole campus' : state.selectedHouse;
  return `
<div class="contact-card${isBest?' best':''}">
  <div class="card-top">
    <div>
      ${isBest ? '<div class="best-badge">Best match</div>' : ''}
      <div class="card-name">${esc(c.name)}</div>
      <div class="card-subtitle">${esc(houseLabel)} · ${esc(c.subtitle)}</div>
    </div>
    <div class="card-meta">
      <div>Hours: <span class="hours">${esc(c.hours)}</span></div>
      ${c.responseTime ? `<div style="margin-top:3px">Usually replies within ${esc(c.responseTime)}</div>` : ''}
    </div>
  </div>
  ${isBest ? `
  <div class="card-info-box">
    ${c.email ? `<div><strong>Email:</strong> ${esc(c.email)}</div>` : ''}
    ${c.phone ? `<div><strong>Phone:</strong> ${esc(c.phone)}</div>` : ''}
  </div>` : ''}
  <div class="card-actions">
    ${c.email ? `<button class="btn btn-outline btn-sm" onclick="mailTo('${esc(c.email)}','${esc(c.name)}')">${IC.email} Send email</button>` : ''}
    ${c.phone ? `<button class="btn btn-outline btn-sm" onclick="window.location='tel:${esc(c.phone)}'">${IC.phone} Call</button>` : ''}
    <button class="link" style="font-size:13px;margin-left:4px" onclick="viewDetail('${esc(c.id)}')">More details</button>
  </div>
</div>`;
}

// ── Page: Detail ────────────────────────────────────────────────
function pageDetail() {
  const c = state.selectedContact;
  if (!c) return '';
  const house = c.wholeCampus ? 'Whole campus' : state.selectedHouse;
  return `
${navbar('app')}
<div class="page-wrap">
  <button class="back-btn" onclick="navigate('step3')">${IC.back} Back to results</button>
  <div class="detail-breadcrumb">${esc(house)}</div>
  <h1 class="detail-title">${esc(c.name)}</h1>
  <p class="detail-desc">${esc(c.description)}</p>

  <div class="detail-grid">
    <div class="detail-panel">
      <div class="panel-title">Get in touch</div>
      ${c.email ? `
      <div class="contact-method">
        <div>
          <div class="method-label">Email</div>
          <div class="method-value">${esc(c.email)}</div>
        </div>
        <button class="copy-btn" onclick="copyText('${esc(c.email)}',this)">Copy</button>
      </div>` : ''}
      ${c.phone ? `
      <div class="contact-method">
        <div>
          <div class="method-label">Phone</div>
          <div class="method-value">${esc(c.phone)}</div>
        </div>
        <button class="copy-btn" onclick="copyText('${esc(c.phone)}',this)">Copy</button>
      </div>` : ''}
      <div class="detail-actions">
        ${c.email ? `<button class="btn-email" onclick="mailTo('${esc(c.email)}','${esc(c.name)}')">${IC.email} Open in my email app</button>` : ''}
        ${c.phone ? `<button class="btn-call" onclick="window.location='tel:${esc(c.phone)}'">${IC.phone} Call now</button>` : ''}
      </div>
      ${c.email ? `<div class="detail-note">The email opens with a subject line and a short template already filled in.</div>` : ''}
    </div>

    <div class="detail-panel">
      <div class="panel-title">Good to know</div>
      <div class="gtk-row">
        <div class="gtk-label">Opening hours</div>
        <div class="gtk-value">${esc(c.hours)}</div>
      </div>
      ${c.location ? `
      <div class="gtk-row">
        <div class="gtk-label">Where to find them</div>
        <div class="gtk-value">${esc(c.location)}</div>
      </div>` : ''}
      ${c.languages ? `
      <div class="gtk-row">
        <div class="gtk-label">Languages</div>
        <div class="gtk-value">${esc(c.languages)}</div>
      </div>` : ''}
      ${!c.alwaysOpen ? `
      <div class="outside-hours">
        <div class="oh-title">Outside opening hours?</div>
        <div class="oh-text">For urgent issues, call CIUP security at +33 1 44 16 65 00 (24/7).</div>
      </div>` : ''}
    </div>
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

function setStaffType(idx) { state.selectedStaffType = STAFF_TYPES[idx]; renderApp(); }
function setIntent(idx)    { state.selectedIntent    = INTENTS[idx];     renderApp(); }

function doShowContacts() {
  const sel = document.getElementById('house-sel');
  if (sel) state.selectedHouse = sel.value;
  state.results = buildResults(state.selectedProblem, state.selectedStaffType);
  navigate('step3');
}

function viewDetail(contactId) {
  const c = CONTACTS[contactId];
  if (!c) return;
  state.selectedContact = c;
  navigate('detail');
}

function mailTo(email, name) {
  const problem = state.selectedProblem?.name || 'my request';
  const house   = state.selectedHouse || '';
  const subject = encodeURIComponent(`[${house}] ${problem}`);
  const body    = encodeURIComponent(
    `Dear ${name},\n\nI am a resident of ${house} and I am writing regarding: ${problem}.\n\nRoom number: \nDescription: \n\nThank you,\n${state.user?.name || ''}`
  );
  window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
}

function copyText(text, btn) {
  const finish = () => {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(finish).catch(finish);
  } else {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    finish();
  }
}

// ── Keyboard shortcuts ─────────────────────────────────────────
function attachKeys() {
  const map = { 'l-email': doLogin, 'l-pass': doLogin, 'r-confirm': doRegister };
  for (const [id, fn] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') fn(); });
  }
}

// ── Render ─────────────────────────────────────────────────────
const AUTH_VIEWS = ['step1', 'step2', 'step3', 'detail'];

function renderApp() {
  if (AUTH_VIEWS.includes(state.view) && !state.user) state.view = 'login';

  const pages = {
    loading:  pageLoading,
    login:    pageLogin,
    register: pageRegister,
    step1:    pageStep1,
    step2:    pageStep2,
    step3:    pageStep3,
    detail:   pageDetail,
  };

  document.getElementById('app').innerHTML = (pages[state.view] || pageLogin)();
  attachKeys();
}

// ── Spin animation ─────────────────────────────────────────────
const spinStyle = document.createElement('style');
spinStyle.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(spinStyle);

// ── Bootstrap ──────────────────────────────────────────────────
async function initApp() {
  renderApp(); // show loading screen immediately

  // Load remote data (contacts + houses) and check existing session in parallel
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

  // Keep session in sync (token refresh, sign-out from another tab, etc.)
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' && AUTH_VIEWS.includes(state.view)) {
      state.user = null;
      navigate('login');
    }
  });
}

initApp();
