// ============================================================================
// Public portfolio renderer (Supabase)
// Fetches About / Services / Projects from Supabase and injects them into the
// existing (unchanged) section markup on index.html. Read-only, no auth.
// ============================================================================

import { supabase, isSupabaseConfigured } from "./supabase-config.js";

// --- tiny helpers -----------------------------------------------------------
const $ = (sel) => document.querySelector(sel);

// Escape user-authored text before inserting as HTML.
function esc(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Sanitize a URL so only http(s)/mailto/tel schemes are used in href/src.
function safeUrl(url = "") {
  const u = String(url || "").trim();
  if (/^(https?:|mailto:|tel:)/i.test(u)) return esc(u);
  return "#";
}

// Descriptions are authored in the dashboard's rich-text editor and stored as
// HTML. Render only an allowlist of formatting tags — strip everything else.
const RTE_ALLOWED = {
  B: [], STRONG: [], I: [], EM: [], U: [], S: [], BR: [], P: [], DIV: [],
  UL: [], OL: [], LI: [], SPAN: [], H4: [], A: ["href", "target", "rel"],
};

function sanitizeHtml(dirty = "") {
  const doc = new DOMParser().parseFromString(`<body>${dirty || ""}</body>`, "text/html");
  const clean = (node) => {
    if (node.nodeType === 3) return;                 // text node → keep
    if (node.nodeType !== 1) { node.remove(); return; }
    const tag = node.tagName;
    if (!RTE_ALLOWED[tag]) {                          // unknown tag → unwrap, keep its text
      const parent = node.parentNode;
      const kids = [...node.childNodes];
      kids.forEach((k) => parent.insertBefore(k, node));
      parent.removeChild(node);
      kids.forEach(clean);
      return;
    }
    [...node.attributes].forEach((a) => {
      if (!RTE_ALLOWED[tag].includes(a.name.toLowerCase())) node.removeAttribute(a.name);
    });
    if (tag === "A") {
      const href = (node.getAttribute("href") || "").trim();
      if (!/^(https?:|mailto:|tel:)/i.test(href)) node.removeAttribute("href");
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener");
    }
    [...node.childNodes].forEach(clean);
  };
  [...doc.body.childNodes].forEach(clean);
  return doc.body.innerHTML.trim();
}

// --- renderers --------------------------------------------------------------
function renderAbout(data) {
  const card = $("#aboutMe_card");
  const whatIDo = $("#whatIDo");
  if (!card) return;

  const socialLink = (url, icon) =>
    url ? `<a href="${safeUrl(url)}" target="_blank" rel="noopener"><i class="${icon}"></i></a>` : "";

  const avatar = safeUrl(data.avatar_url);
  card.innerHTML = `
    <img src="${avatar !== "#" ? avatar : "img/me.jpg"}" class="card-avatar" alt="${esc(data.name || "Avatar")}" onerror="this.src='img/me.jpg'"/>
    <div class="card-info">
      <div class="card-title">${esc(data.name || "")}</div>
      <div class="card-subtitle">${esc(data.subtitle || "")}</div>
      <div class="card-description">${sanitizeHtml(data.description || "")}</div>
      <div class="card-social">
        ${socialLink(data.instagram, "fa-brands fa-square-instagram")}
        ${socialLink(data.github, "fa-brands fa-github")}
        ${socialLink(data.linkedin, "fa-brands fa-linkedin")}
      </div>
    </div>`;

  if (whatIDo) {
    const items = Array.isArray(data.what_i_do) ? data.what_i_do.filter(Boolean) : [];
    whatIDo.innerHTML = items.length
      ? `<h4 class="mb-3">💼 What I Do</h4>
         <ul class="list-unstyled fs-5">
           ${items.map((it) => `<li>${esc(it)}</li>`).join("")}
         </ul>`
      : "";
    whatIDo.style.display = items.length ? "" : "none";
  }
}

function renderServices(list) {
  const container = $("#Services .content");
  if (!container) return;
  if (!list.length) {
    container.innerHTML = `<p class="portfolio-empty">No services yet.</p>`;
    return;
  }
  container.innerHTML = list
    .map(
      (s) => `
      <div class="card">
        <div class="icon"><i class="${esc(s.icon || "fa-solid fa-star")} fa-2x"></i></div>
        <div class="info">
          <h3>${esc(s.title || "")}</h3>
          <p>${sanitizeHtml(s.description || "")}</p>
        </div>
      </div>`
    )
    .join("");
}

function renderProjects(list) {
  const container = $("#projects .content");
  if (!container) return;
  if (!list.length) {
    container.innerHTML = `<p class="portfolio-empty">No projects yet.</p>`;
    return;
  }
  container.innerHTML = list
    .map((p) => {
      const link = p.link
        ? `<a href="${safeUrl(p.link)}" target="_blank" rel="noopener" class="more-details">more details</a>`
        : "";
      return `
      <div class="project-card">
        <div class="project-image">
          <img src="${safeUrl(p.image_url)}" alt="${esc(p.title || "project")}" loading="lazy"/>
        </div>
        <div class="project-info">
          <p class="project-category">${esc(p.category || "")}</p>
          <strong class="project-title">
            <span>${sanitizeHtml(p.description || "") || esc(p.title || "")}</span>
            ${link}
          </strong>
        </div>
      </div>`;
    })
    .join("");
}

// Language presets: editor-tab extension/icon + the comment token used for the
// author credit line. Keep keys in sync with the dashboard.
const CQ_LANGS = {
  js:     { ext: "js",     icon: "fa-brands fa-js",      comment: "//" },
  ts:     { ext: "ts",     icon: "fa-solid fa-code",     comment: "//" },
  py:     { ext: "py",     icon: "fa-brands fa-python",  comment: "#" },
  java:   { ext: "java",   icon: "fa-brands fa-java",    comment: "//" },
  kotlin: { ext: "kt",     icon: "fa-solid fa-k",        comment: "//" },
  cpp:    { ext: "cpp",    icon: "fa-solid fa-code",     comment: "//" },
  c:      { ext: "c",      icon: "fa-solid fa-c",        comment: "//" },
  csharp: { ext: "cs",     icon: "fa-solid fa-code",     comment: "//" },
  go:     { ext: "go",     icon: "fa-brands fa-golang",  comment: "//" },
  rust:   { ext: "rs",     icon: "fa-brands fa-rust",    comment: "//" },
  php:    { ext: "php",    icon: "fa-brands fa-php",     comment: "//" },
  ruby:   { ext: "rb",     icon: "fa-solid fa-gem",      comment: "#" },
  swift:  { ext: "swift",  icon: "fa-brands fa-swift",   comment: "//" },
  dart:   { ext: "dart",   icon: "fa-solid fa-code",     comment: "//" },
  html:   { ext: "html",   icon: "fa-brands fa-html5",   comment: "<!--" },
  sql:    { ext: "sql",    icon: "fa-solid fa-database", comment: "--" },
  shell:  { ext: "sh",     icon: "fa-solid fa-terminal", comment: "#" },
};

function renderCodeQuotes(list) {
  const track = $("#codeQuotesTrack");
  if (!track) return;
  if (!list.length) {
    track.innerHTML = `<p class="portfolio-empty">No quotes yet.</p>`;
    return;
  }

  const line = (n, inner) =>
    `<div class="cq__line"><span class="ln">${n}</span><span class="tok">${inner}</span></div>`;

  const cardHtml = (q) => {
    const lang = CQ_LANGS[q.language] || CQ_LANGS.js;
    const author = esc(q.author || "");
    const role = q.role ? ` · ${esc(q.role)}` : "";

    // Render the author's code exactly as typed — one gutter line per input line.
    let n = 0;
    let body = String(q.quote || "")
      .split("\n")
      .map((ln) => line(++n, esc(ln)))
      .join("");

    // Append the author credit as a language-appropriate comment line.
    if (author) {
      body += line(++n, "");
      body += line(++n, `<span class="c-com">${esc(lang.comment)} — ${author}${role}</span>`);
    }

    return `
      <article class="code-quote">
        <div class="cq__bar">
          <span class="cq__dots"><i></i><i></i><i></i></span>
          <span class="cq__tab"><i class="${lang.icon}"></i> quote.${lang.ext}</span>
        </div>
        <div class="cq__body">
          <div class="cq__code">${body}</div>
        </div>
      </article>`;
  };

  // Repeat the source list so a single "half" comfortably fills wide screens,
  // then duplicate the half. The CSS animates the track by -50% for a seamless
  // infinite loop (each half is identical, so the seam is invisible).
  const reps = Math.max(1, Math.ceil(6 / list.length));
  const half = Array.from({ length: reps }, () => list).flat();
  const cards = half.map(cardHtml).join("");
  track.innerHTML = cards + cards;
}

function showLoading() {
  const about = $("#aboutMe_card");
  if (about) about.innerHTML = `<p class="portfolio-loading">Loading…</p>`;
}

function showConfigHint() {
  const about = $("#aboutMe_card");
  if (about) {
    about.innerHTML = `<p class="portfolio-loading">⚙️ Supabase is not configured yet. See <code>SETUP.md</code>.</p>`;
  }
}

// --- boot -------------------------------------------------------------------
async function init() {
  if (!isSupabaseConfigured) {
    showConfigHint();
    return;
  }
  showLoading();
  try {
    const [aboutRes, servicesRes, projectsRes, quotesRes] = await Promise.all([
      supabase.from("about").select("*").eq("id", "main").maybeSingle(),
      supabase.from("services").select("*").order("sort_order", { ascending: true }),
      supabase.from("projects").select("*").order("sort_order", { ascending: true }),
      supabase.from("code_quotes").select("*").order("sort_order", { ascending: true }),
    ]);

    if (aboutRes.error) throw aboutRes.error;
    if (servicesRes.error) throw servicesRes.error;
    if (projectsRes.error) throw projectsRes.error;
    if (quotesRes.error) throw quotesRes.error;

    if (aboutRes.data) renderAbout(aboutRes.data);
    renderServices(servicesRes.data || []);
    renderProjects(projectsRes.data || []);
    renderCodeQuotes(quotesRes.data || []);
  } catch (err) {
    console.error("Failed to load portfolio content:", err);
    const about = $("#aboutMe_card");
    if (about) about.innerHTML = `<p class="portfolio-loading">Couldn’t load content. Check your Supabase URL / keys / RLS policies.</p>`;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
