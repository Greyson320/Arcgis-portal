/* MEO GIS Portaal — applicatielogica
   Laadt standplaatsen en inspecties uit ArcGIS Online (of demo-gegevens) en tekent
   per pagina: overzicht (KPI's + register), kaart + werkvoorraad, beleid en inspecties. */
(function () {
  "use strict";

  const C = window.MEO_CONFIG;
  const F = C.fields;
  const DAY = 86400000;
  const SIX_MONTHS = 182.5 * DAY;
  const CRED_KEY = "meo-portal-credentials";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = new Intl.NumberFormat("nl-NL");
  const fmtDate = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });
  const fmtMonth = new Intl.DateTimeFormat("nl-NL", { month: "short" });
  const fmtTime = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" });

  // ---------- Statussen & labels ----------
  const STATUS = {
    "Goedgekeurd": { label: "Goedgekeurd", tone: "--st-ok", chip: "ok", seg: "dark", order: 1 },
    "Nog niet geinspecteerd": { label: "Nog niet geïnspecteerd", tone: "--st-todo", chip: "todo", seg: "accent", order: 2 },
    "Overtreding": { label: "Overtreding", tone: "--st-bad", chip: "bad", seg: "striped", order: 3 },
    "Waarneming": { label: "Waarneming", tone: "--st-warn", chip: "warn", seg: "outline", order: 4 },
    "Herinspectie": { label: "Herinspectie", tone: "--st-info", chip: "info", seg: "outline", order: 5 }
  };
  const TODO = "Nog niet geinspecteerd";
  const statusInfo = (s) => STATUS[s] || { label: s || "Onbekend", tone: "--st-none", chip: "todo", seg: "outline", order: 9 };

  const PRETTY = {
    geen_overtreding: "Geen overtreding", prijsaanduiding: "Prijsaanduiding", openingstijden: "Openingstijden",
    bedrijfsvoering: "Bedrijfsvoering", anders: "Anders", netto_eenheid: "Netto-eenheid", makutu_basiko: "Makutu basiko",
    Horeca_vergunning: "Horecavergunning", Standplaatsvergunning: "Standplaatsvergunning",
    Vestigingsvergunning: "Vestigingsvergunning", Ventvergunning: "Ventvergunning"
  };
  const pretty = (v) => (v == null || v === "" ? "Niet ingevuld" : PRETTY[v] || String(v).replace(/_/g, " "));
  // Namen vergelijken zonder hoofdletters, accenten, leestekens en meervouds-s ("Batidos Gem" = "Batido Gem")
  const normName = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean).map((w) => w.replace(/s$/, "")).join(" ");
  const splitMulti = (v) => (v ? String(v).split(",").map((x) => x.trim()).filter(Boolean) : []);

  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const valueTone = (v) => {
    const k = String(v ?? "").toLowerCase();
    if (k === "ja") return "--st-ok";
    if (k.startsWith("nee")) return k === "nee" ? "--st-bad" : "--accent";
    if (k === "n.v.t.") return "--st-info";
    if (!k || k === "null" || k === "niet ingevuld") return "--st-none";
    return "--st-todo";
  };
  const valueChip = (v) => ({ "--st-ok": "ok", "--st-bad": "bad", "--accent": "warn", "--st-info": "info" }[valueTone(v)] || "todo");

  const AVATAR = ["#ffe2b0", "#e3ecdf", "#e4e1f7", "#fbe0dd", "#dfeaf3", "#f3e6d6", "#e9e4dc", "#dff1ec", "#f6e3ef", "#eef0d8"];
  const avatarColor = (key) => {
    let h = 0;
    for (const ch of String(key || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return AVATAR[h % AVATAR.length];
  };
  const initials = (name) => String(name || "?").replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

  const PAGES = { overzicht: "Overzicht", kaart: "Kaart", beleid: "Beleid", inspecties: "Inspecties" };
  const PAGE_SUB = {
    overzicht: "Kerncijfers en het register van alle standplaatsen.",
    kaart: "Ligging van de standplaatsen en de openstaande werkvoorraad.",
    beleid: "Vergunningen, afvoer na sluitingstijd en spreiding per type.",
    inspecties: "Uitgevoerde controles, bevindingen en inspecteurs."
  };

  // ---------- State ----------
  const state = {
    mode: null,
    page: "overzicht",
    stands: [],
    inspections: [],
    filters: { zone: "", status: "", soort: "", inspecteur: "", periode: "" },
    hidden: new Set(),
    mapColor: "status",
    basemap: "kaart",
    queue: "todo",
    sort: { key: "naam", dir: 1 },
    selectedId: null,
    lastSync: null,
    linked: false
  };

  // =========================================================
  // Data laden
  // =========================================================
  function loadDemo() {
    const d = window.MEO_DEMO;
    state.stands = d.stands.map((s) => ({ ...s }));
    const byId = new Map(state.stands.map((s) => [s.id, s]));
    state.inspections = d.inspections.map((i) => ({ ...i, naam: byId.get(i.standId)?.naam || null }));
    state.linked = true;
    state.mode = "demo";
    state.lastSync = new Date();
  }

  function esriRequire(mods) {
    return new Promise((resolve, reject) => {
      if (!window.require) return reject(new Error("ArcGIS SDK niet geladen"));
      window.require(mods, (...m) => resolve(m), reject);
    });
  }

  async function initIdentity() {
    const [esriId, OAuthInfo] = await esriRequire(["esri/identity/IdentityManager", "esri/identity/OAuthInfo"]);
    if (C.oauthAppId) {
      esriId.registerOAuthInfos([new OAuthInfo({ appId: C.oauthAppId, portalUrl: C.portalUrl, popup: false })]);
    } else {
      try {
        const saved = sessionStorage.getItem(CRED_KEY);
        if (saved) esriId.initialize(JSON.parse(saved));
      } catch (e) { /* sessie-opslag niet beschikbaar */ }
    }
    esriId.on("credential-create", () => {
      if (C.oauthAppId) return;
      try { sessionStorage.setItem(CRED_KEY, JSON.stringify(esriId.toJSON())); } catch (e) { /* negeren */ }
    });
    return esriId;
  }

  async function isSignedIn(esriId) {
    try { await esriId.checkSignInStatus(C.portalUrl + "/sharing"); return true; } catch (e) { return false; }
  }

  function domainLookup(layer) {
    const maps = {};
    for (const f of layer.fields) {
      if (f.domain && f.domain.type === "coded-value") {
        maps[f.name] = new Map(f.domain.codedValues.map((cv) => [cv.code, cv.name]));
      }
    }
    return (name, v) => (maps[name] && maps[name].has(v) ? maps[name].get(v) : v);
  }

  async function loadLive() {
    const [FeatureLayer] = await esriRequire(["esri/layers/FeatureLayer"]);
    const sl = new FeatureLayer({ url: C.layers.standplaatsen });
    const il = new FeatureLayer({ url: C.layers.inspecties });
    await Promise.all([sl.load(), il.load()]);

    // Standplaatsen
    const sd = domainLookup(sl);
    const sq = sl.createQuery();
    sq.where = "1=1"; sq.outFields = ["*"]; sq.returnGeometry = true; sq.outSpatialReference = { wkid: 4326 };
    const sres = await sl.queryFeatures(sq);
    const soid = sl.objectIdField;
    state.stands = sres.features.map((f) => {
      const a = f.attributes, g = f.geometry;
      return {
        id: a[soid],
        naam: a[F.naam] || "(zonder naam)",
        status: sd(F.status, a[F.status]) || "Onbekend",
        datum: a[F.datum] || null,
        zone: sd(F.zone, a[F.zone]) || null,
        soort: sd(F.soort, a[F.soort]) || null,
        vergunning: sd(F.vergunning, a[F.vergunning]) ?? null,
        afgevoerd: sd(F.afgevoerd, a[F.afgevoerd]) ?? null,
        prefill: Object.fromEntries(Object.entries(C.inspectieFormulier.uitRegister)
          .filter(([, src]) => a[src] != null && a[src] !== "").map(([dst, src]) => [dst, a[src]])),
        lon: g ? (g.longitude ?? g.x) : null,
        lat: g ? (g.latitude ?? g.y) : null
      };
    });

    // Inspecties (alle controles, zoals de indicatoren van het Centraal Dashboard)
    const idf = domainLookup(il);
    const ioid = il.objectIdField;
    const dateFields = il.fields.filter((f) => f.type === "date");
    const dateField =
      (dateFields.find((f) => /datum|date|inspectie/i.test(f.name) && !/edit|creat/i.test(f.name)) ||
        dateFields.find((f) => f.name === (il.editFieldsInfo && il.editFieldsInfo.creationDateField)) ||
        dateFields[0] || {}).name;
    const nameField = (il.fields.find((f) => f.type === "string" && /naam|zaak|bedrijf/i.test(f.name)) || {}).name;

    const iq = il.createQuery();
    iq.where = "1=1";
    iq.outFields = ["*"]; iq.returnGeometry = false;
    const ires = await il.queryFeatures(iq);
    const byName = new Map(state.stands.map((s) => [normName(s.naam), s.id]));
    const overnemen = C.inspectieFormulier.uitVorigeInspectie;
    state.inspections = ires.features.map((f) => {
      const a = f.attributes;
      const naam = nameField ? a[nameField] : null;
      const prefill = {};
      for (const k of overnemen) if (a[k] != null && a[k] !== "") prefill[k] = a[k];
      return {
        id: a[ioid],
        naam,
        prefill,
        standId: naam ? byName.get(normName(naam)) ?? null : null,
        inspecteur: idf(F.inspecteur, a[F.inspecteur]) || "Onbekend",
        overtredingen: a[F.overtredingen] || null,
        zonderVergunning: a[F.zonderVergunning] || null,
        datum: dateField ? a[dateField] : null
      };
    });
    state.linked = state.inspections.some((i) => i.standId != null);
    state.mode = "live";
    state.lastSync = new Date();
  }

  // =========================================================
  // Filters
  // =========================================================
  function filteredStands() {
    const f = state.filters;
    return state.stands.filter((s) =>
      (!f.zone || s.zone === f.zone) && (!f.status || s.status === f.status) && (!f.soort || s.soort === f.soort));
  }
  function filteredInspections(stands) {
    const f = state.filters;
    const standFilter = (f.zone || f.status || f.soort) && state.linked ? new Set(stands.map((s) => s.id)) : null;
    const since = f.periode ? Date.now() - Number(f.periode) * DAY : null;
    return state.inspections.filter((i) =>
      (!f.inspecteur || i.inspecteur === f.inspecteur) &&
      (!since || (i.datum && i.datum >= since)) &&
      (!standFilter || standFilter.has(i.standId)));
  }

  function fillSelect(id, values, labeler = (v) => v) {
    const sel = $(id);
    const keep = sel.value;
    sel.querySelectorAll("option:not(:first-child)").forEach((o) => o.remove());
    for (const v of values) {
      const o = document.createElement("option");
      o.value = v; o.textContent = labeler(v);
      sel.appendChild(o);
    }
    sel.value = values.includes(keep) ? keep : "";
  }
  const uniq = (arr) => [...new Set(arr.filter((v) => v != null && v !== ""))];

  function buildFilterOptions() {
    fillSelect("#f-zone", uniq(state.stands.map((s) => s.zone)).sort());
    fillSelect("#f-status", uniq(state.stands.map((s) => s.status)).sort((a, b) => statusInfo(a).order - statusInfo(b).order), (v) => statusInfo(v).label);
    fillSelect("#f-soort", uniq(state.stands.map((s) => s.soort)).sort());
    fillSelect("#f-inspecteur", uniq(state.inspections.map((i) => i.inspecteur)).sort());
  }

  function setFilter(key, value) {
    state.filters[key] = value;
    const sel = $("#f-" + key);
    if (sel) sel.value = value;
    render();
  }

  function groupCount(list, keyFn, multi = false) {
    const m = new Map();
    for (const x of list) {
      const keys = multi ? splitMulti(keyFn(x)) : [keyFn(x)];
      for (const k of keys) m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n);
  }

  // =========================================================
  // Rendering
  // =========================================================
  function countUp(el, to) {
    const from = Number(el.dataset.v || 0);
    el.dataset.v = to;
    if (reduceMotion || from === to) { el.textContent = fmt.format(to); return; }
    const t0 = performance.now(), dur = 800;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt.format(Math.round(from + (to - from) * e));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Verdeling per status als proportionele pillen (zoals Interviews / Hired / …)
  function renderSegments(stands) {
    const total = stands.length || 1;
    const groups = groupCount(stands, (s) => s.status).sort((a, b) => statusInfo(a.key).order - statusInfo(b.key).order);
    $("#segments").innerHTML = groups.map((g) => {
      const st = statusInfo(g.key);
      const pct = Math.round((g.n / total) * 100);
      return `<div class="segment ${state.filters.status === g.key ? "is-active" : ""}" style="flex-grow:${g.n};--seg:var(${st.tone})">
        <span class="segment__label" title="${esc(st.label)}">${esc(st.label)}</span>
        <button type="button" class="segment__bar" data-status="${esc(g.key)}"
          aria-label="${esc(st.label)}: ${g.n} (${pct}%) — filter" aria-pressed="${state.filters.status === g.key}">${pct}%</button>
      </div>`;
    }).join("") || `<p class="muted">Geen standplaatsen voor deze filters.</p>`;
    // Legenda onder de balk (zichtbaar op telefoon, waar de labels boven de balk te smal worden)
    $("#seg-legend").innerHTML = groups.map((g) => {
      const st = statusInfo(g.key);
      const pct = Math.round((g.n / total) * 100);
      return `<li><button type="button" data-status="${esc(g.key)}" aria-pressed="${state.filters.status === g.key}">
        <span class="dot" style="background:var(${st.tone})"></span><span>${esc(st.label)}</span><b>${g.n}</b><small>${pct}%</small>
      </button></li>`;
    }).join("");
  }

  function renderKpis(stands, insps) {
    const total = stands.length;
    const todo = stands.filter((s) => s.status === TODO).length;
    const bad = stands.filter((s) => s.status === "Overtreding").length;
    const old = stands.filter((s) => s.datum && Date.now() - s.datum > SIX_MONTHS).length;
    const zonder = insps.filter((i) => splitMulti(i.zonderVergunning).length).length;
    const kpis = [
      { key: "total", label: "Totaal standplaatsen", v: total },
      { key: "done", label: "Geïnspecteerd", v: total - todo },
      { key: "todo", label: "Nog te inspecteren", v: todo, filter: `status|${TODO}`, accent: true },
      { key: "bad", label: "Overtredingen", v: bad, filter: "status|Overtreding" },
      { key: "zonder", label: "Zonder vergunning", v: zonder },
      { key: "old", label: "Langer dan 6 mnd", v: old, filter: "queue|old" },
      { key: "controles", label: "Aantal controles", v: insps.length }
    ];
    const host = $("#kpis");
    if (!host.children.length) {
      host.innerHTML = kpis.map((k) => `
        <div class="stat ${k.accent ? "stat--accent" : ""}" data-kpi="${k.key}"
          ${k.filter ? `data-filter="${esc(k.filter)}" tabindex="0" role="button" aria-label="${esc(k.label)} — openen"` : ""}>
          <dt>${esc(k.label)}</dt><dd data-v="0">0</dd>
        </div>`).join("");
    }
    for (const k of kpis) countUp(host.querySelector(`[data-kpi="${k.key}"] dd`), k.v);
  }

  // ---------- Register ----------
  function renderTable(stands) {
    const { key, dir } = state.sort;
    const val = (s) => key === "status" ? statusInfo(s.status).order : key === "datum" ? (s.datum || 0) : String(s[key] ?? "").toLowerCase();
    const rows = [...stands].sort((a, b) => (val(a) > val(b) ? dir : val(a) < val(b) ? -dir : 0));
    $$(".table th button").forEach((b) => {
      if (b.dataset.sort === key) b.setAttribute("aria-sort", dir > 0 ? "ascending" : "descending");
      else b.removeAttribute("aria-sort");
    });
    $("#table-empty").hidden = rows.length > 0;
    $("#tbody").innerHTML = rows.map((s) => {
      const st = statusInfo(s.status);
      return `<tr data-id="${esc(s.id)}" class="${s.id === state.selectedId ? "is-selected" : ""}" tabindex="0">
        <td class="c-name"><span class="who"><span class="avatar" style="--av:${avatarColor(s.soort)}" aria-hidden="true">${esc(initials(s.naam))}</span>${esc(s.naam)}</span></td>
        <td class="c-meta c-soort">${esc(s.soort || "–")}</td>
        <td class="c-meta c-zone">${esc(s.zone || "–")}</td>
        <td class="c-meta c-datum">${s.datum ? fmtDate.format(s.datum) : `<span class="muted">Nog niet</span>`}</td>
        <td class="c-verg">${esc(s.vergunning ?? "–")}</td>
        <td class="c-afg">${esc(s.afgevoerd ?? "–")}</td>
        <td class="c-status"><span class="chip chip--${st.chip}">${esc(st.label)}</span></td>
      </tr>`;
    }).join("");
  }

  // ---------- Werkvoorraad ----------
  function queueItems(stands) {
    if (state.queue === "todo") return stands.filter((s) => s.status === TODO).sort((a, b) => a.naam.localeCompare(b.naam));
    if (state.queue === "old") return stands.filter((s) => s.datum && Date.now() - s.datum > SIX_MONTHS).sort((a, b) => a.datum - b.datum);
    return stands.filter((s) => s.status === "Overtreding").sort((a, b) => (b.datum || 0) - (a.datum || 0));
  }
  function renderQueue(stands) {
    $("#q-todo").textContent = stands.filter((s) => s.status === TODO).length;
    $("#q-old").textContent = stands.filter((s) => s.datum && Date.now() - s.datum > SIX_MONTHS).length;
    $("#q-bad").textContent = stands.filter((s) => s.status === "Overtreding").length;
    $$("[data-queue]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.queue === state.queue)));
    const items = queueItems(stands);
    $("#queue").innerHTML = items.length ? items.map((s) => `
      <li><button type="button" data-id="${esc(s.id)}">
        <span class="avatar" style="--av:${avatarColor(s.soort)}" aria-hidden="true">${esc(initials(s.naam))}</span>
        <span class="q-text"><span class="q-name">${esc(s.naam)}</span><span class="q-meta">${esc(s.soort || "–")} · ${esc(s.zone || "–")}</span></span>
        <span class="q-date">${s.datum ? relDate(s.datum) : ""}</span>
      </button></li>`).join("")
      : `<li class="queue__empty">Niets in deze lijst.</li>`;
  }

  function relDate(ms) {
    const d = Math.round((Date.now() - ms) / DAY);
    if (d < 1) return "vandaag";
    if (d < 31) return `${d} d`;
    if (d < 365) return `${Math.round(d / 30.4)} mnd`;
    return `${(d / 365).toFixed(1).replace(".", ",")} jr`;
  }

  // ---------- Grafieken ----------
  function donut(el, items, centerLabel) {
    const total = items.reduce((a, b) => a + b.n, 0);
    if (!total) { el.innerHTML = `<p class="chart-empty">Geen gegevens voor deze selectie.</p>`; return; }
    const R = 56, CIRC = 2 * Math.PI * R, GAP = items.length > 1 ? 8 : 0;
    let acc = 0;
    const segs = items.map((it) => {
      const len = (it.n / total) * CIRC;
      const s = `<circle class="seg-arc" cx="70" cy="70" r="${R}" style="stroke:var(${it.tone})" stroke-dasharray="0 ${CIRC}"
        data-dash="${Math.max(0.1, len - GAP)} ${CIRC}" stroke-dashoffset="${-acc}"><title>${esc(it.label)}: ${it.n}</title></circle>`;
      acc += len;
      return s;
    }).join("");
    el.innerHTML = `
      <div class="donut">
        <div class="donut__wrap">
          <svg viewBox="0 0 140 140" role="img" aria-label="${esc(centerLabel)}">${segs}</svg>
          <div class="donut__center"><strong>${fmt.format(total)}</strong><span>${esc(centerLabel)}</span></div>
        </div>
        <ul>${items.map((it) => `<li><span class="dot" style="background:var(${it.tone})"></span><span>${esc(it.label)}</span><b>${it.n}</b></li>`).join("")}</ul>
      </div>`;
    requestAnimationFrame(() => requestAnimationFrame(() =>
      el.querySelectorAll("circle.seg-arc").forEach((c) => c.setAttribute("stroke-dasharray", c.dataset.dash))));
  }

  function bars(el, items) {
    if (!items.length) { el.innerHTML = `<p class="chart-empty">Geen gegevens voor deze selectie.</p>`; return; }
    const max = Math.max(...items.map((i) => i.n));
    el.innerHTML = `<div class="bars">${items.map((it) => {
      const segs = it.parts
        ? it.parts.map((p) => `<i style="background:var(${p.tone})" data-w="${(p.n / max) * 100}" title="${esc(p.label)}: ${p.n}"></i>`).join("")
        : `<i style="background:var(${it.tone || "--ink"})" data-w="${(it.n / max) * 100}"></i>`;
      return `<div class="bar">
        <span class="bar__label" title="${esc(it.label)}">${esc(it.label)}</span>
        <span class="bar__track" role="img" aria-label="${esc(it.label)}: ${it.n}">${segs}</span>
        <span class="bar__value">${fmt.format(it.n)}</span></div>`;
    }).join("")}</div>`;
    requestAnimationFrame(() => requestAnimationFrame(() =>
      el.querySelectorAll(".bar__track i").forEach((i) => (i.style.width = i.dataset.w + "%"))));
  }

  function columns(el, insps) {
    const dated = insps.filter((i) => i.datum);
    if (!dated.length) { el.innerHTML = `<p class="chart-empty">Geen inspectiedatums beschikbaar.</p>`; return; }
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, k) => new Date(now.getFullYear(), now.getMonth() - 11 + k, 1));
    const counts = months.map((m) => dated.filter((i) => { const d = new Date(i.datum); return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth(); }).length);
    const max = Math.max(1, ...counts);
    el.innerHTML = `<div class="cols" role="img" aria-label="Controles per maand, laatste 12 maanden">${months.map((m, k) => `
      <div class="col ${k === 11 ? "is-current" : ""}">
        <div class="col__bar" data-h="${(counts[k] / max) * 100}" title="${fmtMonth.format(m)} ${m.getFullYear()}: ${counts[k]}"><span>${counts[k] || ""}</span></div>
        <span class="col__label">${fmtMonth.format(m).replace(".", "")}</span>
      </div>`).join("")}</div>`;
    requestAnimationFrame(() => requestAnimationFrame(() =>
      el.querySelectorAll(".col__bar").forEach((b) => (b.style.height = b.dataset.h + "%"))));
  }

  function renderBeleid(stands) {
    const valItems = (key) => groupCount(stands, (s) => s[key]).map((g) => ({ label: g.key == null ? "Niet ingevuld" : String(g.key), n: g.n, tone: valueTone(g.key) }));
    donut($("#c-vergunning"), valItems("vergunning"), "standplaatsen");
    donut($("#c-afgevoerd"), valItems("afgevoerd"), "standplaatsen");
    const zoneTones = ["--ink", "--accent", "--st-todo"];
    donut($("#c-zone"), groupCount(stands, (s) => s.zone).map((g, i) => ({ label: g.key || "Onbekend", n: g.n, tone: zoneTones[i % zoneTones.length] })), "standplaatsen");
    bars($("#c-soort"), groupCount(stands, (s) => s.soort).map((g) => {
      const sub = stands.filter((s) => s.soort === g.key);
      const parts = groupCount(sub, (s) => s.status).sort((a, b) => statusInfo(a.key).order - statusInfo(b.key).order)
        .map((p) => ({ label: statusInfo(p.key).label, n: p.n, tone: statusInfo(p.key).tone }));
      return { label: g.key || "Onbekend", n: g.n, parts };
    }));
  }

  function renderInspecties(insps) {
    columns($("#c-trend"), insps);
    bars($("#c-overtredingen"), groupCount(insps, (i) => i.overtredingen, true)
      .map((g) => ({ label: pretty(g.key), n: g.n, tone: g.key === "geen_overtreding" ? "--st-ok" : "--st-bad" })));
    bars($("#c-zonder"), groupCount(insps, (i) => i.zonderVergunning, true).map((g) => ({ label: pretty(g.key), n: g.n, tone: "--accent" })));
    bars($("#c-inspecteurs"), groupCount(insps, (i) => i.inspecteur).map((g) => ({ label: g.key, n: g.n, tone: "--ink" })));
    $("#c-trend-sub").textContent = state.filters.inspecteur
      ? `Inspecties van ${state.filters.inspecteur} over de afgelopen 12 maanden`
      : "Uitgevoerde inspecties over de afgelopen 12 maanden";
  }

  // ---------- Inspectieformulier vooraf invullen ----------
  // Zelfde koppeling als "Inspectie starten" in de webkaart: registergegevens als `field:`-parameters,
  // aangevuld uit de laatste inspectie; de locatie als `center`. Nieuwe bevindingen blijven leeg.
  const FIELD_LABELS = {
    eigenaar: "eigenaar", telefoonnummer: "telefoon", id_nummer: "ID-nummer",
    naam_bedrijf: "bedrijfsnaam", adres_bedrijf: "adres", Zone: "zone", kvk_nummer: "KvK-nummer",
    ondernemingsvorm: "ondernemingsvorm", hoofdcat: "categorie", subcat: "subcategorie", subcat1: "subcategorie",
    subcat2: "subcategorie", type_bedrijf: "type bedrijf", oppervlakte: "oppervlakte", aantal_kassa: "aantal kassa's"
  };
  function inspectieLink(s) {
    const P = C.inspectieFormulier;
    const prev = state.inspections
      .filter((i) => i.standId === s.id && i.prefill && Object.keys(i.prefill).length)
      .sort((a, b) => (b.datum || 0) - (a.datum || 0))[0];
    // Register wint; de vorige inspectie vult alleen aan wat in het register ontbreekt
    const vals = { ...(prev ? prev.prefill : {}), naam_bedrijf: s.naam, ...(s.prefill || {}) };
    const allowed = new Set([...Object.keys(P.uitRegister), ...P.uitVorigeInspectie]);
    const parts = [];
    const filled = new Set();
    for (const [k, v] of Object.entries(vals)) {
      if (v == null || v === "" || !allowed.has(k)) continue;
      parts.push(`field:${k}=${encodeURIComponent(v)}`);
      filled.add(FIELD_LABELS[k] || k);
    }
    if (s.lat != null && s.lon != null) { parts.push(`center=${s.lat.toFixed(6)},${s.lon.toFixed(6)}`); filled.add("locatie"); }
    return { url: `${P.url}?${parts.join("&")}`, prev, filled: [...filled] };
  }

  // ---------- Detailpaneel ----------
  function openDrawer(id, { zoom = false } = {}) {
    const s = state.stands.find((x) => String(x.id) === String(id));
    if (!s) return;
    state.selectedId = s.id;
    const st = statusInfo(s.status);
    const insps = state.inspections.filter((i) => i.standId === s.id).sort((a, b) => (b.datum || 0) - (a.datum || 0));
    const link = inspectieLink(s);
    const prefillNote = link.prev
      ? `Vooraf ingevuld (register + inspectie van ${link.prev.datum ? fmtDate.format(link.prev.datum) : "eerder"}): ${link.filled.join(", ")}. Vul alleen de nieuwe bevindingen aan.`
      : `Vooraf ingevuld uit het register: ${link.filled.join(", ")}. Vul de nieuwe bevindingen en wat nog ontbreekt aan.`;
    $("#d-soort").textContent = [s.soort, s.zone].filter(Boolean).join(" · ") || "Standplaats";
    $("#d-title").textContent = s.naam;
    $("#d-body").innerHTML = `
      <span class="chip chip--${st.chip}" style="align-self:flex-start">${esc(st.label)}</span>
      <dl class="facts">
        <div><dt>Laatste inspectie</dt><dd>${s.datum ? fmtDate.format(s.datum) : "Nog niet"}</dd></div>
        <div><dt>Sinds inspectie</dt><dd>${s.datum ? relDate(s.datum) : "–"}</dd></div>
        <div><dt>Vergunning</dt><dd>${esc(s.vergunning ?? "Niet ingevuld")}</dd></div>
        <div><dt>Afgevoerd na sluiting</dt><dd>${esc(s.afgevoerd ?? "Niet ingevuld")}</dd></div>
      </dl>
      <div class="drawer__actions">
        <a class="pill pill--dark" href="${esc(link.url)}" target="_blank" rel="noopener"><svg class="ico" aria-hidden="true"><use href="#i-clipboard"/></svg> Start inspectie</a>
        <button class="pill" type="button" id="d-zoom"><svg class="ico" aria-hidden="true"><use href="#i-target"/></svg> Toon op kaart</button>
      </div>
      <p class="prefill-note">${esc(prefillNote)}</p>
      ${state.linked ? `<h3>Inspectiehistorie</h3>${insps.length ? `<ul class="timeline">${insps.slice(0, 8).map((i) => `
        <li>${esc(splitMulti(i.overtredingen).map(pretty).join(", ") || "Geen bevindingen")}
          ${splitMulti(i.zonderVergunning).length ? `<br><span class="warn">Zonder: ${esc(splitMulti(i.zonderVergunning).map(pretty).join(", "))}</span>` : ""}
          <small>${i.datum ? fmtDate.format(i.datum) : "datum onbekend"} · ${esc(i.inspecteur)}</small></li>`).join("")}</ul>`
        : `<p class="muted">Nog geen inspecties vastgelegd.</p>`}` : ""}
      ${state.mode === "demo" ? `<p class="muted" style="font-size:12.5px">Momentopname van ${window.MEO_DEMO.snapshotDate}. Log in voor de actuele gegevens.</p>` : ""}`;
    $("#d-zoom").addEventListener("click", () => { location.hash = "#kaart"; zoomTo(s); });
    const dr = $("#drawer");
    dr.classList.add("is-open");
    dr.setAttribute("aria-hidden", "false");
    $("#d-close").focus({ preventScroll: true });
    $$("#tbody tr").forEach((tr) => tr.classList.toggle("is-selected", tr.dataset.id === String(s.id)));
    highlightMap();
    if (zoom) zoomTo(s);
  }
  function closeDrawer() {
    state.selectedId = null;
    $("#drawer").classList.remove("is-open");
    $("#drawer").setAttribute("aria-hidden", "true");
    $$("#tbody tr.is-selected").forEach((tr) => tr.classList.remove("is-selected"));
    highlightMap();
  }

  // ---------- Kaart ----------
  const mapCtx = { view: null, layer: null, labels: null, Graphic: null, ready: false, pending: null };
  const LABEL_MIN_SCALE = 20000; // namen tonen vanaf ongeveer zoomniveau 15

  async function initMap() {
    if (mapCtx.view) return;
    try {
      const [Map, MapView, GraphicsLayer, Graphic] = await esriRequire([
        "esri/Map", "esri/views/MapView", "esri/layers/GraphicsLayer", "esri/Graphic"]);
      mapCtx.Graphic = Graphic;
      mapCtx.layer = new GraphicsLayer({ title: "Standplaatsen" });
      mapCtx.labels = new GraphicsLayer({ title: "Namen", minScale: LABEL_MIN_SCALE });
      mapCtx.view = new MapView({
        container: "map", map: new Map({ basemap: C.map.basemaps[state.basemap], layers: [mapCtx.layer, mapCtx.labels] }),
        center: C.map.center, zoom: C.map.zoom, popupEnabled: false,
        constraints: { snapToZoom: false }, ui: { components: ["zoom"] }
      });
      mapCtx.view.ui.move("zoom", "top-right");
      mapCtx.view.on("click", async (e) => {
        const hit = await mapCtx.view.hitTest(e, { include: [mapCtx.layer] });
        const g = hit.results[0] && hit.results[0].graphic;
        if (g) openDrawer(g.attributes.id);
      });
      mapCtx.view.on("pointer-move", async (e) => {
        const hit = await mapCtx.view.hitTest(e, { include: [mapCtx.layer] });
        mapCtx.view.container.style.cursor = hit.results.length ? "pointer" : "";
      });
      await mapCtx.view.when();
      mapCtx.ready = true;
      renderMap(filteredStands());
      if (mapCtx.pending) { zoomTo(mapCtx.pending); mapCtx.pending = null; }
      else if (mapCtx.layer.graphics.length) {
        // Begin met alle standplaatsen in beeld
        mapCtx.view.goTo(mapCtx.layer.graphics.toArray(), { animate: false }).catch(() => {});
      }
    } catch (e) {
      console.error(e);
      $("#map-empty").hidden = false;
    }
  }

  const mapKey = (s) => state.mapColor === "status" ? s.status : String(s.vergunning ?? "Niet ingevuld");
  function symbolFor(s, selected) {
    const tone = state.mapColor === "status" ? statusInfo(s.status).tone : valueTone(s.vergunning);
    return {
      type: "simple-marker", style: "circle",
      size: selected ? 20 : 12,
      color: cssVar(tone),
      outline: { color: selected ? "#1c1c1c" : "#ffffff", width: selected ? 3 : 2 }
    };
  }
  function renderMap(stands) {
    renderMapLegend(stands);
    if (!mapCtx.ready) return;
    const Graphic = mapCtx.Graphic;
    const visible = stands.filter((s) => s.lon != null && s.lat != null && !state.hidden.has(mapKey(s)));
    const point = (s) => ({ type: "point", longitude: s.lon, latitude: s.lat });
    mapCtx.layer.removeAll();
    mapCtx.layer.addMany(visible.map((s) => new Graphic({
      geometry: point(s),
      attributes: { id: s.id },
      symbol: symbolFor(s, s.id === state.selectedId)
    })));
    mapCtx.labels.removeAll();
    mapCtx.labels.addMany(visible.map((s) => new Graphic({
      geometry: point(s),
      attributes: { id: s.id },
      symbol: labelFor(s, s.id === state.selectedId)
    })));
  }
  function labelFor(s, selected) {
    const sat = state.basemap === "satelliet";
    return {
      type: "text", text: s.naam,
      color: sat ? "#ffffff" : "#1c1c1c",
      haloColor: selected ? "#FFA500" : sat ? "rgba(0,0,0,0.85)" : "#ffffff", haloSize: selected ? 2.5 : 1.5,
      yoffset: selected ? -22 : -17,
      font: { size: selected ? 11 : 9.5, weight: "bold" }
    };
  }
  function highlightMap() {
    if (!mapCtx.ready) return;
    mapCtx.layer.graphics.forEach((g) => {
      const s = state.stands.find((x) => x.id === g.attributes.id);
      if (s) g.symbol = symbolFor(s, s.id === state.selectedId);
    });
    mapCtx.labels.graphics.forEach((g) => {
      const s = state.stands.find((x) => x.id === g.attributes.id);
      if (s) g.symbol = labelFor(s, s.id === state.selectedId);
    });
  }
  function zoomTo(s) {
    if (s.lon == null) return;
    if (!mapCtx.ready) { mapCtx.pending = s; return; }
    mapCtx.view.goTo({ center: [s.lon, s.lat], zoom: 16 }, { duration: reduceMotion ? 0 : 900 }).catch(() => {});
  }
  function renderMapLegend(stands) {
    const isStatus = state.mapColor === "status";
    const groups = isStatus
      ? groupCount(stands, (s) => s.status).sort((a, b) => statusInfo(a.key).order - statusInfo(b.key).order)
        .map((g) => ({ key: g.key, label: statusInfo(g.key).label, tone: statusInfo(g.key).tone, n: g.n }))
      : groupCount(stands, (s) => String(s.vergunning ?? "Niet ingevuld"))
        .map((g) => ({ key: g.key, label: g.key, tone: valueTone(g.key), n: g.n }));
    $("#map-legend").innerHTML = `<h3>${isStatus ? "Status standplaats" : "Vergunning"}</h3>` + groups.map((g) => `
      <button type="button" data-key="${esc(g.key)}" aria-pressed="${!state.hidden.has(g.key)}">
        <span class="dot" style="background:var(${g.tone})"></span>${esc(g.label)}<b>${g.n}</b>
      </button>`).join("");
  }

  // ---------- Zoeken ----------
  let searchIdx = -1;
  function renderSearch(q) {
    const ul = $("#search-results"), input = $("#search");
    q = q.trim().toLowerCase();
    if (!q) { ul.hidden = true; input.setAttribute("aria-expanded", "false"); return; }
    const hits = state.stands.filter((s) => s.naam.toLowerCase().includes(q) || String(s.soort || "").toLowerCase().includes(q)).slice(0, 8);
    searchIdx = hits.length ? 0 : -1;
    ul.innerHTML = hits.length ? hits.map((s, i) => `
      <li role="option" id="sr-${i}" data-id="${esc(s.id)}" aria-selected="${i === 0}">
        <span class="avatar" style="--av:${avatarColor(s.soort)}" aria-hidden="true">${esc(initials(s.naam))}</span>
        ${esc(s.naam)}<small>${esc(s.soort || "")}</small></li>`).join("")
      : `<li class="empty">Geen standplaats gevonden voor “${esc(q)}”.</li>`;
    ul.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  // ---------- Export ----------
  function exportCsv() {
    const rows = filteredStands();
    const head = ["Naam", "Soort zaak", "Zone", "Status", "Laatste inspectie", "Vergunning", "Afgevoerd na sluitingstijd", "Lengtegraad", "Breedtegraad"];
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [head.map(cell).join(";")].concat(rows.map((s) => [
      s.naam, s.soort, s.zone, statusInfo(s.status).label,
      s.datum ? new Date(s.datum).toISOString().slice(0, 10) : "", s.vergunning, s.afgevoerd,
      s.lon != null ? s.lon.toFixed(6) : "", s.lat != null ? s.lat.toFixed(6) : ""
    ].map(cell).join(";")));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `meo-standplaatsen-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(`${rows.length} standplaatsen geëxporteerd`);
  }

  // ---------- Hoofd-render ----------
  function render() {
    const stands = filteredStands();
    const insps = filteredInspections(stands);
    renderSegments(stands);
    renderKpis(stands, insps);
    renderTable(stands);
    renderQueue(stands);
    renderMap(stands);
    if (state.page === "beleid") renderBeleid(stands);
    if (state.page === "inspecties") renderInspecties(insps);
    const active = Object.values(state.filters).filter(Boolean).length;
    $("#filter-count").hidden = !active;
    $("#filter-count").textContent = active;
    for (const k of Object.keys(state.filters)) $("#f-" + k).closest(".pill--select").classList.toggle("is-set", !!state.filters[k]);
  }

  function renderMode() {
    const live = state.mode === "live";
    const t = state.lastSync ? fmtTime.format(state.lastSync) : "";
    const label = live ? `Live · bijgewerkt ${t}` : `Momentopname · ${window.MEO_DEMO.snapshotDate}`;
    $("#mode-label").textContent = label;
    $("#mode-label").dataset.mode = state.mode;
    const chip = $("#mode-chip");
    chip.dataset.mode = state.mode;
    chip.title = live ? "Verbonden met meo.maps.arcgis.com" : "Inloggen voor live gegevens";
    chip.setAttribute("aria-label", live ? "Live verbonden — gegevens vernieuwen" : "Inloggen met ArcGIS voor live gegevens");
    $("#foot-sync").textContent = live
      ? `Laatst bijgewerkt ${fmtDate.format(state.lastSync)} ${t}`
      : `Momentopname van ${window.MEO_DEMO.snapshotDate} — log in voor actuele gegevens`;
  }

  function showPage(page) {
    if (!PAGES[page]) page = "overzicht";
    state.page = page;
    $("#page-title").textContent = PAGES[page];
    $("#page-sub").textContent = PAGE_SUB[page];
    document.title = `${PAGES[page]} · MEO GIS Portaal`;
    $$(".page").forEach((p) => (p.hidden = p.dataset.page !== page));
    $$("[data-nav]").forEach((a) => {
      const on = a.dataset.nav === page;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    if (page === "kaart") initMap();
    if (page === "beleid") renderBeleid(filteredStands());
    if (page === "inspecties") { const st = filteredStands(); renderInspecties(filteredInspections(st)); }
  }

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 3200);
  }

  // =========================================================
  // Opstarten
  // =========================================================
  let esriIdRef = null;

  function enterApp() {
    $("#gate").classList.add("is-hidden");
    $("#app").setAttribute("aria-hidden", "false");
    buildFilterOptions();
    render();
    renderMode();
    showPage((location.hash || "#overzicht").slice(1));
  }

  async function startLive({ interactive }) {
    const btn = $("#btn-login");
    btn.disabled = true;
    $("#gate-note").textContent = "Verbinden met meo.maps.arcgis.com…";
    try {
      esriIdRef = esriIdRef || (await initIdentity());
      if (interactive) await esriIdRef.getCredential(C.portalUrl + "/sharing");
      await loadLive();
      enterApp();
      toast(`Live · ${state.stands.length} standplaatsen en ${state.inspections.length} inspecties geladen`);
    } catch (e) {
      console.error(e);
      if (!$("#gate").classList.contains("is-hidden")) {
        $("#gate-note").textContent = e && e.name === "identity-manager:user-aborted"
          ? "Inloggen geannuleerd. Probeer opnieuw of bekijk de demo."
          : "Kon geen live verbinding maken. Controleer uw account of bekijk de demo.";
      } else {
        toast("Inloggen mislukt — controleer uw account.");
      }
    } finally {
      btn.disabled = false;
    }
  }

  function startDemo() {
    loadDemo();
    enterApp();
  }

  async function refresh() {
    const b = $("#btn-refresh");
    b.classList.add("is-busy");
    try {
      if (state.mode === "live") { await loadLive(); toast("Gegevens vernieuwd"); }
      else { loadDemo(); toast("Demo herladen — log in voor live gegevens"); }
      buildFilterOptions();
      render();
      renderMode();
    } catch (e) {
      console.error(e);
      toast("Vernieuwen mislukt — controleer de verbinding.");
    } finally {
      b.classList.remove("is-busy");
    }
  }

  function bindEvents() {
    $("#btn-login").addEventListener("click", () => startLive({ interactive: true }));
    $("#btn-demo").addEventListener("click", startDemo);
    $("#mode-chip").addEventListener("click", () => (state.mode === "live" ? refresh() : startLive({ interactive: true })));
    $("#btn-refresh").addEventListener("click", refresh);
    $("#btn-export").addEventListener("click", exportCsv);
    window.addEventListener("hashchange", () => { showPage(location.hash.slice(1)); window.scrollTo(0, 0); });

    for (const k of Object.keys(state.filters)) {
      $("#f-" + k).addEventListener("change", (e) => setFilter(k, e.target.value));
    }
    $("#btn-reset").addEventListener("click", () => {
      if (!Object.values(state.filters).some(Boolean)) { toast("Geen actieve filters"); return; }
      for (const k of Object.keys(state.filters)) { state.filters[k] = ""; $("#f-" + k).value = ""; }
      render();
      toast("Filters gewist");
    });

    $("#seg-legend").addEventListener("click", (e) => {
      const b = e.target.closest("[data-status]");
      if (b) setFilter("status", state.filters.status === b.dataset.status ? "" : b.dataset.status);
    });
    $("#segments").addEventListener("click", (e) => {
      const b = e.target.closest("[data-status]");
      if (b) setFilter("status", state.filters.status === b.dataset.status ? "" : b.dataset.status);
    });

    const kpiAction = (e) => {
      const k = e.target.closest("[data-filter]");
      if (!k) return;
      const [key, val] = k.dataset.filter.split("|");
      if (key === "queue") { state.queue = val; renderQueue(filteredStands()); location.hash = "#kaart"; return; }
      setFilter(key, state.filters[key] === val ? "" : val);
    };
    $("#kpis").addEventListener("click", kpiAction);
    $("#kpis").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); kpiAction(e); } });

    $$("[data-queue]").forEach((b) => b.addEventListener("click", () => { state.queue = b.dataset.queue; renderQueue(filteredStands()); }));
    $("#queue").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-id]");
      if (b) openDrawer(b.dataset.id, { zoom: true });
    });

    $$("[data-color]").forEach((b) => b.addEventListener("click", () => {
      state.mapColor = b.dataset.color;
      state.hidden.clear();
      $$("[data-color]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      renderMap(filteredStands());
    }));
    $$("[data-basemap]").forEach((b) => b.addEventListener("click", () => {
      state.basemap = b.dataset.basemap;
      $$("[data-basemap]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      if (mapCtx.ready) {
        mapCtx.view.map.basemap = C.map.basemaps[state.basemap];
        highlightMap();
      }
    }));
    $("#map-legend").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-key]");
      if (!b) return;
      const k = b.dataset.key;
      state.hidden.has(k) ? state.hidden.delete(k) : state.hidden.add(k);
      renderMap(filteredStands());
    });

    $$(".table th button").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.sort;
      state.sort = { key: k, dir: state.sort.key === k ? -state.sort.dir : 1 };
      renderTable(filteredStands());
    }));
    $("#tbody").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) openDrawer(tr.dataset.id); });
    $("#tbody").addEventListener("keydown", (e) => {
      const tr = e.target.closest("tr[data-id]");
      if (tr && e.key === "Enter") openDrawer(tr.dataset.id);
    });
    $("#d-close").addEventListener("click", closeDrawer);

    const input = $("#search"), ul = $("#search-results");
    const pickResult = (id) => { openDrawer(id, { zoom: true }); input.value = ""; renderSearch(""); };
    input.addEventListener("input", () => renderSearch(input.value));
    input.addEventListener("keydown", (e) => {
      const opts = $$('li[role="option"]', ul);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!opts.length) return;
        searchIdx = (searchIdx + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length;
        opts.forEach((o, i) => o.setAttribute("aria-selected", String(i === searchIdx)));
        input.setAttribute("aria-activedescendant", "sr-" + searchIdx);
      } else if (e.key === "Enter" && opts[searchIdx]) {
        pickResult(opts[searchIdx].dataset.id); input.blur();
      } else if (e.key === "Escape") {
        input.value = ""; renderSearch(""); input.blur();
      }
    });
    ul.addEventListener("mousedown", (e) => {
      const li = e.target.closest('li[role="option"]');
      if (!li) return;
      e.preventDefault();
      pickResult(li.dataset.id);
    });
    input.addEventListener("blur", () => setTimeout(() => renderSearch(""), 120));

    document.addEventListener("keydown", (e) => {
      const tag = document.activeElement.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "SELECT") { e.preventDefault(); input.focus(); }
      if (e.key === "Escape" && $("#drawer").classList.contains("is-open")) closeDrawer();
    });
  }

  function renderLinks() {
    const L = C.links;
    $("#lnk-inspectie").href = L.nieuweInspectie;
    $("#lnk-standplaats").href = L.nieuweStandplaats;
    $("#lnk-beleid").href = L.dashboardBeleid;
    $("#lnk-insp-dash").href = L.dashboardInspectie;
    $("#lnk-portal").href = L.portal;
  }

  async function boot() {
    renderLinks();
    bindEvents();
    // ?demo in de URL slaat het toegangsscherm over
    if (new URLSearchParams(location.search).has("demo")) { startDemo(); return; }
    // Bestaande sessie hervatten
    try {
      esriIdRef = await initIdentity();
      if (await isSignedIn(esriIdRef)) startLive({ interactive: false });
    } catch (e) { /* SDK niet beschikbaar: alleen demo */ }
  }

  boot();
})();
