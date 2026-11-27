const $ = s => document.querySelector(s);

// ---------- languages ----------
const STR = {
  en: {
    title: 'Cité U in 3D', panel: 'Campus guide', eyebrow: 'Paris 14th · Boulevard Jourdan', in3d: 'in 3D',
    sub: 'Preview generated from OpenStreetMap. Rotate the model, click a house or a place to find it.',
    search: 'Search for a house, a service…', searchLabel: 'Search', overview: 'Overview', language: 'Language',
    hide: 'Hide panel', show: 'Show guide', data: 'Data ©', osm: 'OpenStreetMap contributors', heights: 'some heights are estimated',
    loading: 'Building the model…', loadError: 'Could not load the model',
    places: 'Places and services', houses: 'Houses and buildings',
    empty: 'No results. Try “café”, “Brésil” or “RER”.',
    buildings: 'buildings', height: h => 'about ' + h + ' m tall', estimated: 'estimated',
    osmLink: 'View on OpenStreetMap', unnamed: 'Building with no name in OSM'
  },
  fr: {
    title: 'Cité U en 3D', panel: 'Guide du campus', eyebrow: 'Paris 14e · Boulevard Jourdan', in3d: 'en 3D',
    sub: 'Aperçu généré depuis OpenStreetMap. Fais tourner la maquette, clique une maison ou un lieu pour le retrouver.',
    search: 'Chercher une maison, un service…', searchLabel: 'Chercher', overview: 'Vue d’ensemble', language: 'Langue',
    hide: 'Masquer le panneau', show: 'Afficher le guide', data: 'Données ©', osm: 'contributeurs OpenStreetMap', heights: 'hauteurs parfois estimées',
    loading: 'Construction de la maquette…', loadError: 'Impossible de charger la maquette',
    places: 'Lieux et services', houses: 'Maisons et bâtiments',
    empty: 'Aucun résultat. Essaie « café », « Brésil » ou « RER ».',
    buildings: 'bâtiments', height: h => 'environ ' + h + ' m de haut', estimated: 'estimé',
    osmLink: 'Voir la fiche OpenStreetMap', unnamed: 'Bâtiment sans nom dans OSM'
  }
};
// English by default (like the rest of the site); the visitor's choice is remembered.
let lang = 'en';
try { if (localStorage.getItem('map-lang') === 'fr') lang = 'fr'; } catch (e) { /* storage blocked */ }
const t = k => STR[lang][k];
let onLang = () => {}; // set once the map is built

function applyLang() {
  document.documentElement.lang = lang;
  document.title = t('title');
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-label]')) el.setAttribute('aria-label', t(el.dataset.i18nLabel));
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', b.dataset.lang === lang);
  onLang();
}
for (const b of document.querySelectorAll('[data-lang]')) b.onclick = () => {
  lang = b.dataset.lang;
  try { localStorage.setItem('map-lang', lang); } catch (e) { /* storage blocked */ }
  applyLang();
};
// Keep the embedded map and a full-screen tab in the same language
window.addEventListener('storage', e => { if (e.key === 'map-lang' && (e.newValue === 'en' || e.newValue === 'fr')) { lang = e.newValue; applyLang(); } });

// ---------- collapsible panel ----------
function setPanel(open) {
  document.body.classList.toggle('panel-closed', !open);
  $('#show-panel').hidden = open;
  $(open ? '#hide-panel' : '#show-panel').focus({ preventScroll: true });
}
$('#hide-panel').onclick = () => setPanel(false);
$('#show-panel').onclick = () => setPanel(true);

applyLang();

fetch('data.json').then(r => r.json()).then(function (D) {
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  // ---------- categories ----------
  const CATS = {
    food:    { en: 'Food',      fr: 'Restauration', v: '--c-food' },
    sport:   { en: 'Sport',     fr: 'Sport',        v: '--c-sport' },
    culture: { en: 'Culture',   fr: 'Culture',      v: '--c-culture' },
    service: { en: 'Services',  fr: 'Services',     v: '--c-service' },
    transit: { en: 'Transport', fr: 'Transports',   v: '--c-transit' }
  };
  const kd = (cat, en, fr) => ({ cat, en, fr });
  const KIND = {
    restaurant: kd('food', 'Restaurant', 'Restaurant'), cafe: kd('food', 'Café', 'Café'), convenience: kd('food', 'Convenience store', 'Épicerie'),
    sports_centre: kd('sport', 'Sports centre', 'Centre sportif'), fitness_centre: kd('sport', 'Gym', 'Salle de fitness'), fitness_station: kd('sport', 'Outdoor gym equipment', 'Agrès sportifs'), field: kd('sport', 'Sports field', 'Terrain'), association: kd('sport', 'Association', 'Association'),
    theatre: kd('culture', 'Theatre', 'Théâtre'), library: kd('culture', 'Library', 'Bibliothèque'), gallery: kd('culture', 'Gallery', 'Galerie'), public_bookcase: kd('culture', 'Book exchange box', 'Boîte à livres'), artwork: kd('culture', 'Artwork', 'Œuvre d’art'),
    bank: kd('service', 'Bank', 'Banque'), social_facility: kd('service', 'Social services', 'Action sociale'), bicycle: kd('service', 'Bike workshop', 'Atelier vélo'), photo_booth: kd('service', 'Photo booth', 'Photomaton'),
    station: kd('transit', 'Station', 'Station')
  };
  // Places without a name in OSM are labelled by their kind, in the current language
  const poiName = p => p.auto ? KIND[p.auto][lang] : p.name;
  const poiKind = p => p.kinds.map((k, i) => i ? KIND[k][lang].toLowerCase() : KIND[k][lang]).join(', ');
  const itemName = it => it.type === 'poi' ? poiName(it) : it.name;

  // ---------- data prep ----------
  const pip = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const area = p => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(a / 2); };
  const bbox = p => { let a = [Infinity, Infinity, -Infinity, -Infinity]; for (const [x, z] of p) { a[0] = Math.min(a[0], x); a[1] = Math.min(a[1], z); a[2] = Math.max(a[2], x); a[3] = Math.max(a[3], z); } return a; };
  const ctr = p => { const b = bbox(p); return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; };

  D.buildings.forEach(b => { b.bb = bbox(b.p); b.H = b.h || (b.c ? 13 : 16); });
  const campusB = D.buildings.filter(b => b.c);

  // POIs: rename, dedupe stations, place on top of buildings
  const pois = [];
  const seen = {};
  for (const p of D.pois) {
    const k = KIND[p.k]; if (!k) continue;
    if (!p.n && p.k === 'artwork') continue;
    let name = p.n || k.fr, auto = p.n ? null : p.k;
    if (p.k === 'station') {
      const line = p.sub === 'tram' ? 'T3a' : (name === 'Cité Universitaire' ? 'RER B' : 'T3a');
      name = line + ' · ' + name; auto = null;
      const key = name; if (seen[key]) continue; seen[key] = 1;
    }
    // Same place listed twice in OSM (e.g. "Comptoir Coréen" + "Comptoir Coréen Cité", or 3 nodes of fitness gear): merge
    const key = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const dup = pois.find(q => Math.hypot(q.x - p.p[0], q.z - p.p[1]) < 150 && (key(q.name) === key(name) || key(q.name).startsWith(key(name) + ' ') || key(name).startsWith(key(q.name) + ' ')));
    if (dup) {
      if (name.length < dup.name.length) { dup.name = name; dup.auto = auto; }
      if (!dup.kinds.some(x => KIND[x].fr === k.fr)) dup.kinds.push(p.k);
      continue;
    }
    let y = 3;
    for (const b of campusB) if (pip(p.p[0], p.p[1], b.p)) { y = b.H + 2; break; }
    pois.push({ name, auto, kinds: [p.k], cat: k.cat, x: p.p[0], z: p.p[1], y });
  }

  // Houses grouped by name (aliases: same foundation under its full and short name)
  const ALIAS = { 'Fondation Émile et Louise Deutsch de la Meurthe': 'Fondation Deutsch de la Meurthe' };
  const houses = new Map();
  for (const b of campusB) {
    if (b.n && ALIAS[b.n]) b.n = ALIAS[b.n];
    const n = b.n || null; if (!n) continue;
    if (!houses.has(n)) houses.set(n, []);
    houses.get(n).push(b);
  }
  const SERVICE_RX = /Internationale$|Administratif|Espace|Vestiaire|Parc/;

  // ---------- three setup ----------
  const host = $('#scene');
  host.innerHTML = '';
  const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 2, 9000);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.maxPolarAngle = 1.36; controls.minDistance = 50; controls.maxDistance = 2600;
  controls.screenSpacePanning = false;

  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a9a8a, 0.75); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e6, 0.9);
  sun.position.set(-500, 800, 350); sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -1000, right: 1000, top: 1000, bottom: -1000, near: 10, far: 2500 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.6;
  scene.add(sun); scene.add(sun.target);

  const M = {}; // materials by token
  const mat = (tok, opts) => (M[tok] = new THREE.MeshLambertMaterial(Object.assign({ color: css(tok) }, opts || {})));

  // flat polygon layer
  function flat(polys, tok, y) {
    const geos = [];
    for (const p of polys) {
      if (p.length < 3) continue;
      const s = new THREE.Shape(p.map(([x, z]) => new THREE.Vector2(x, -z)));
      const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
      geos.push(g);
    }
    if (!geos.length) return;
    const m = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(geos), mat(tok));
    m.receiveShadow = true; scene.add(m);
  }
  // ribbons for lines
  function ribbons(lines, tok, y) {
    const pos = [];
    for (const { p, w } of lines) {
      for (let i = 0; i < p.length - 1; i++) {
        let [x1, z1] = p[i], [x2, z2] = p[i + 1];
        const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz); if (L < 0.01) continue;
        const ux = dx / L, uz = dz / L, h = w / 2;
        x1 -= ux * h * 0.9; z1 -= uz * h * 0.9; x2 += ux * h * 0.9; z2 += uz * h * 0.9;
        const nx = -uz * h, nz = ux * h;
        const a = [x1 + nx, y, z1 + nz], b = [x1 - nx, y, z1 - nz], c = [x2 + nx, y, z2 + nz], d = [x2 - nx, y, z2 - nz];
        pos.push(...a, ...b, ...c, ...b, ...d, ...c);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat(tok, { side: THREE.DoubleSide })); m.receiveShadow = true; scene.add(m);
  }

  // ground
  const ground = new THREE.Mesh(new THREE.CircleGeometry(4200, 64).rotateX(-Math.PI / 2), mat('--g-ground'));
  ground.receiveShadow = true; scene.add(ground);
  flat([D.campus], '--g-campus', 0.05);
  flat(D.green.filter(g => g.k === 'grass').map(g => g.p), '--g-grass', 0.1);
  flat(D.green.filter(g => g.k === 'wood').map(g => g.p), '--g-wood', 0.12);
  flat(D.green.filter(g => g.k === 'pitch').map(g => g.p), '--g-pitch', 0.14);
  flat(D.water, '--g-water', 0.16);
  const RW = { motorway: 24, motorway_link: 9, trunk: 18, primary: 15, secondary: 12, tertiary: 10, residential: 7, unclassified: 7 };
  ribbons(D.roads.map(r => ({ p: r.p, w: RW[r.k] || 6 })), '--g-road', 0.22);
  ribbons(D.paths.map(p => ({ p, w: 2.6 })), '--g-path', 0.26);
  ribbons(D.rails.filter(r => !r.tun).map(r => ({ p: r.p, w: 3.2 })), '--g-rail', 0.24);

  // buildings
  const ctxGeos = [];
  const picks = [];
  for (const b of D.buildings) {
    const s = new THREE.Shape(b.p.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(s, { depth: b.H, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    if (!b.c) { ctxGeos.push(g); continue; }
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: css('--g-bldg'), roughness: 0.85, metalness: 0 }));
    m.castShadow = true; m.receiveShadow = true; m.userData.b = b; b.mesh = m;
    scene.add(m); picks.push(m);
  }
  const ctx = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(ctxGeos), mat('--g-ctx', { transparent: true, opacity: 0.6 }));
  ctx.castShadow = true; ctx.receiveShadow = true; scene.add(ctx);

  // trees in campus green areas, avoiding buildings and paths
  (function trees() {
    const cell = 25, grid = new Map();
    const key = (x, z) => Math.floor(x / cell) + ',' + Math.floor(z / cell);
    const addSeg = (a, b, w) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / cell) + 1; for (let i = 0; i <= n; i++) { const t = i / n, k = key(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t); if (!grid.has(k)) grid.set(k, []); grid.get(k).push([a, b, w]); } };
    D.paths.forEach(p => { for (let i = 0; i < p.length - 1; i++) addSeg(p[i], p[i + 1], 4); });
    D.roads.forEach(r => { for (let i = 0; i < r.p.length - 1; i++) addSeg(r.p[i], r.p[i + 1], (RW[r.k] || 6) / 2 + 4); });
    const nearSeg = (x, z) => { const l = grid.get(key(x, z)); if (!l) return false; for (const [a, b, w] of l) { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1; let t = ((x - a[0]) * dx + (z - a[1]) * dz) / L2; t = Math.max(0, Math.min(1, t)); if (Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) < w) return true; } return false; };
    const inBldg = (x, z) => { for (const b of D.buildings) { const q = b.bb; if (x < q[0] - 3 || x > q[2] + 3 || z < q[1] - 3 || z > q[3] + 3) continue; if (pip(x, z, b.p)) return true; } return false; };
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const spots = [];
    for (const g of D.green) {
      if (g.k === 'pitch') continue;
      const c = ctr(g.p); if (!pip(c[0], c[1], D.campus)) continue;
      const A = area(g.p); if (A < 400) continue;
      const n = Math.min(400, Math.round(A / (g.k === 'wood' ? 140 : 420)));
      const q = bbox(g.p);
      for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) {
        const x = q[0] + rnd() * (q[2] - q[0]), z = q[1] + rnd() * (q[3] - q[1]);
        if (!pip(x, z, g.p) || inBldg(x, z) || nearSeg(x, z)) continue;
        spots.push([x, z, 0.7 + rnd() * 0.7]); i++;
      }
      if (spots.length > 3500) break;
    }
    const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat('--g-tree'), spots.length);
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.5, 1, 6), new THREE.MeshLambertMaterial({ color: 0x6b5643 }), spots.length);
    const o = new THREE.Object3D();
    spots.forEach(([x, z, s], i) => {
      o.position.set(x, 7 * s, z); o.scale.set(4.2 * s, 4.6 * s, 4.2 * s); o.rotation.set(0, i, 0); o.updateMatrix(); crown.setMatrixAt(i, o.matrix);
      o.position.set(x, 2.5 * s, z); o.scale.set(s, 5 * s, s); o.updateMatrix(); trunk.setMatrixAt(i, o.matrix);
    });
    crown.castShadow = true; crown.receiveShadow = true; trunk.castShadow = true;
    scene.add(crown, trunk);
  })();

  // ---------- theme sync ----------
  function applyTheme() {
    for (const tok in M) M[tok].color.set(css(tok));
    for (const m of picks) m.material.color.set(css('--g-bldg'));
    const dark = getComputedStyle(document.documentElement).colorScheme === 'dark';
    scene.background = new THREE.Color(css('--g-sky'));
    scene.fog = new THREE.Fog(css('--g-sky'), 1600, 4200);
    hemi.intensity = dark ? 0.55 : 0.75; sun.intensity = dark ? 0.55 : 0.9;
    accent.set(css('--accent'));
    refreshHighlight();
  }
  const accent = new THREE.Color();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ---------- camera ----------
  const HOME = { pos: new THREE.Vector3(260, 720, 980), tgt: new THREE.Vector3(0, 0, 40) };
  camera.position.copy(HOME.pos); controls.target.copy(HOME.tgt);
  let fly = null;
  function flyTo(tgt, dist) {
    const dir = camera.position.clone().sub(controls.target).normalize();
    if (dir.y < 0.45) { dir.y = 0.45; dir.normalize(); }
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    fly = { t: reduce ? 1 : 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: tgt.clone().add(dir.multiplyScalar(dist)), t1: tgt.clone() };
  }
  $('#reset').onclick = () => { select(null); fly = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: HOME.pos.clone(), t1: HOME.tgt.clone() }; };

  // ---------- selection & highlight ----------
  let selected = null, hovered = null;
  function refreshHighlight() {
    for (const m of picks) {
      const b = m.userData.b;
      const isSel = selected && selected.type === 'house' && selected.name === b.n;
      const isHov = hovered === m;
      m.material.color.set(isSel ? accent : css('--g-bldg'));
      m.material.emissive.set(isHov && !isSel ? accent : 0x000000);
      m.material.emissiveIntensity = isHov ? 0.25 : 0;
    }
  }
  function select(item) {
    selected = item;
    refreshHighlight(); renderList(); renderCard();
    if (!item) return;
    if (item.type === 'house') {
      const bs = houses.get(item.name);
      let q = [Infinity, Infinity, -Infinity, -Infinity], H = 0;
      bs.forEach(b => { q = [Math.min(q[0], b.bb[0]), Math.min(q[1], b.bb[1]), Math.max(q[2], b.bb[2]), Math.max(q[3], b.bb[3])]; H = Math.max(H, b.H); });
      item.x = (q[0] + q[2]) / 2; item.z = (q[1] + q[3]) / 2; item.y = H + 6;
      const span = Math.max(q[2] - q[0], q[3] - q[1]);
      flyTo(new THREE.Vector3(item.x, H / 2, item.z), Math.max(170, span * 3));
    } else {
      flyTo(new THREE.Vector3(item.x, 0, item.z), 220);
    }
  }

  // ---------- panel ----------
  const active = new Set(Object.keys(CATS));
  const chips = $('#chips');
  for (const k in CATS) {
    const b = document.createElement('button');
    b.className = 'chip'; b.type = 'button'; b.setAttribute('aria-pressed', 'true');
    b.style.setProperty('--c', 'var(' + CATS[k].v + ')');
    b.dataset.cat = k; b.innerHTML = '<i></i><span></span>';
    b.onclick = () => { active.has(k) ? active.delete(k) : active.add(k); b.setAttribute('aria-pressed', active.has(k)); renderList(); renderPins(); };
    chips.appendChild(b);
  }
  $('#q').addEventListener('input', renderList);
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function renderList() {
    const q = norm($('#q').value.trim());
    const list = $('#list'); list.innerHTML = '';
    const mk = (label, cv, isCur, onClick) => {
      const b = document.createElement('button'); b.className = 'item'; b.type = 'button';
      if (cv) b.style.setProperty('--c', 'var(' + cv + ')');
      b.innerHTML = '<i></i><span></span>'; b.querySelector('span').textContent = label;
      b.setAttribute('aria-current', isCur ? 'true' : 'false'); b.onclick = onClick; return b;
    };
    const ps = pois.filter(p => active.has(p.cat) && (!q || norm(poiName(p) + ' ' + poiKind(p)).includes(q)));
    if (ps.length) {
      const h = document.createElement('div'); h.className = 'group'; h.textContent = t('places') + ' (' + ps.length + ')'; list.appendChild(h);
      ps.sort((a, b) => Object.keys(CATS).indexOf(a.cat) - Object.keys(CATS).indexOf(b.cat) || poiName(a).localeCompare(poiName(b), lang))
        .forEach(p => list.appendChild(mk(poiName(p), CATS[p.cat].v, selected === p, () => select(Object.assign(p, { type: 'poi' })))));
    }
    const hs = [...houses.keys()].filter(n => !q || norm(n).includes(q)).sort((a, b) => a.localeCompare(b, 'fr'));
    if (hs.length) {
      const h = document.createElement('div'); h.className = 'group'; h.textContent = t('houses') + ' (' + hs.length + ')'; list.appendChild(h);
      hs.forEach(n => list.appendChild(mk(n, SERVICE_RX.test(n) ? '--accent' : null, selected && selected.type === 'house' && selected.name === n, () => select({ type: 'house', name: n }))));
    }
    if (!ps.length && !hs.length) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = t('empty'); list.appendChild(e); }
  }
  function renderCard() {
    const c = $('#card');
    if (!selected) { c.hidden = true; return; }
    c.hidden = false; c.className = 'card'; c.innerHTML = '';
    const h = document.createElement('h2'); h.textContent = itemName(selected); c.appendChild(h);
    const m = document.createElement('div'); m.className = 'meta';
    if (selected.type === 'house') {
      const bs = houses.get(selected.name);
      const H = Math.max(...bs.map(b => b.H));
      const est = bs.some(b => !b.h);
      m.textContent = (bs.length > 1 ? bs.length + ' ' + t('buildings') + ' · ' : '') + t('height')(Math.round(H)) + (est ? ' (' + t('estimated') + ')' : '');
      c.appendChild(m);
      const a = document.createElement('a'); const id = bs[0].id;
      a.href = 'https://www.openstreetmap.org/' + (id[0] === 'w' ? 'way/' : 'relation/') + id.slice(1).split('_')[0];
      a.target = '_blank'; a.rel = 'noopener'; a.textContent = t('osmLink');
      c.appendChild(a);
    } else {
      m.textContent = CATS[selected.cat][lang] + ' · ' + poiKind(selected); c.appendChild(m);
    }
  }

  // ---------- pins (HTML overlay) ----------
  const labels = $('#labels');
  const pinEls = pois.map(p => {
    const el = document.createElement('div');
    el.className = 'pin' + (p.cat === 'transit' ? ' transit' : '');
    el.style.setProperty('--c', 'var(' + CATS[p.cat].v + ')');
    el.innerHTML = '<b></b><em></em>';
    el.onclick = () => select(Object.assign(p, { type: 'poi' }));
    labels.appendChild(el); return el;
  });
  const tagEl = document.createElement('div'); tagEl.className = 'tag'; tagEl.hidden = true; labels.appendChild(tagEl);
  function renderPins() { pois.forEach((p, i) => { pinEls[i].hidden = !active.has(p.cat); }); }
  const v = new THREE.Vector3();
  function placeLabels() {
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    const dist = camera.position.distanceTo(controls.target);
    pois.forEach((p, i) => {
      const el = pinEls[i]; if (!active.has(p.cat)) return;
      v.set(p.x, p.y, p.z).project(camera);
      const off = v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1;
      el.style.visibility = off ? 'hidden' : 'visible';
      if (!off) el.style.transform = 'translate(' + ((v.x + 1) / 2 * w) + 'px,' + ((1 - v.y) / 2 * h) + 'px) translate(-6px,-50%)';
      el.classList.toggle('quiet', !(p.cat === 'transit' || dist < 520 || selected === p));
    });
    if (selected) {
      v.set(selected.x, selected.y + (selected.type === 'poi' ? 10 : 0), selected.z).project(camera);
      tagEl.hidden = v.z > 1; tagEl.textContent = itemName(selected);
      tagEl.style.transform = 'translate(' + ((v.x + 1) / 2 * w) + 'px,' + ((1 - v.y) / 2 * h) + 'px) translate(-50%,-100%)';
    } else tagEl.hidden = true;
  }

  // ---------- picking ----------
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), tip = $('#tip');
  let down = null;
  function pick(e) {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(picks, false)[0];
    return hit ? hit.object : null;
  }
  renderer.domElement.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const m = pick(e);
    if (m !== hovered) { hovered = m; refreshHighlight(); }
    renderer.domElement.style.cursor = m ? 'pointer' : '';
    if (m) { tip.hidden = false; tip.textContent = m.userData.b.n || t('unnamed'); tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 14) + 'px'; }
    else tip.hidden = true;
  });
  renderer.domElement.addEventListener('pointerleave', () => { hovered = null; tip.hidden = true; refreshHighlight(); });
  renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const m = pick(e);
    if (m && m.userData.b.n) select({ type: 'house', name: m.userData.b.n });
  });

  // ---------- loop ----------
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function tick() {
    if (fly) {
      fly.t = Math.min(1, fly.t + 0.022); const k = ease(fly.t);
      camera.position.lerpVectors(fly.p0, fly.p1, k); controls.target.lerpVectors(fly.t0, fly.t1, k);
      if (fly.t >= 1) fly = null;
    }
    controls.update();
    sun.position.set(controls.target.x - 500, 800, controls.target.z + 350); sun.target.position.copy(controls.target);
    renderer.render(scene, camera);
    placeLabels();
    requestAnimationFrame(tick);
  }
  onLang = () => {
    for (const el of chips.children) el.querySelector('span').textContent = CATS[el.dataset.cat][lang];
    pois.forEach((p, i) => { pinEls[i].querySelector('em').textContent = poiName(p); });
    tip.hidden = true;
    renderList(); renderCard();
  };
  resize(); applyTheme(); onLang(); renderPins(); tick();
}).catch(function (e) {
  const l = $('.loading'); if (!l) return;
  l.removeAttribute('data-i18n');
  onLang = () => { l.textContent = t('loadError') + ' (' + e.message + ')'; };
  onLang();
});
