// ============================================================================
// Live tech-news renderer (no backend, no API key)
// ----------------------------------------------------------------------------
// Pulls fresh articles about mobile (iOS/Android) + AI from two free, no-key,
// CORS-friendly public APIs — Dev.to and Hacker News (Algolia) — merges and
// dedupes them, then renders cards into the #news section on index.html.
// Read-only, client-side, independent of Supabase.
// ============================================================================

// --- tiny helpers -----------------------------------------------------------
const $ = (sel) => document.querySelector(sel);

// Escape text before inserting as HTML.
function esc(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Only allow http(s) links in href/src; anything else collapses to "#".
function safeUrl(url = "") {
  const u = String(url || "").trim();
  if (/^https?:/i.test(u)) return esc(u);
  return "#";
}

// --- config -----------------------------------------------------------------
// Which topics each item belongs to (drives the All / Mobile / AI filter).
const TOPICS = { MOBILE: "mobile", AI: "ai" };

// Dev.to tags to fetch, grouped by topic.
const DEVTO_TAGS = {
  mobile: ["android", "ios", "kotlin", "swift", "flutter"],
  ai: ["ai", "machinelearning", "llm"],
};

// Hacker News search queries, grouped by topic.
const HN_QUERIES = {
  mobile: ["iOS", "Android"],
  ai: ["AI"],
};

const MAX_CARDS = 12;              // how many cards to show after merging
const PER_SOURCE = 4;              // items to pull per tag / per query
const CACHE_KEY = "news_cache_v1"; // sessionStorage cache
const CACHE_TTL = 15 * 60 * 1000;  // 15 minutes

// --- fetchers ---------------------------------------------------------------
async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// Dev.to: one request per tag. Returns normalized items tagged with `topic`.
async function fetchDevto() {
  const jobs = [];
  for (const [topic, tags] of Object.entries(DEVTO_TAGS)) {
    for (const tag of tags) {
      jobs.push(
        getJson(`https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&per_page=${PER_SOURCE}`)
          .then((arr) =>
            (Array.isArray(arr) ? arr : []).map((a) => ({
              title: a.title || "",
              url: a.url || a.canonical_url || "",
              summary: a.description || "",
              image: a.cover_image || a.social_image || "",
              source: "devto",
              author: a.user?.name || "",
              date: a.published_at || a.created_at || "",
              topics: [topic],
            }))
          )
          .catch(() => [])
      );
    }
  }
  const results = await Promise.all(jobs);
  return results.flat();
}

// Hacker News (Algolia): one search per query. No cover image → topic gradient.
async function fetchHn() {
  const jobs = [];
  for (const [topic, queries] of Object.entries(HN_QUERIES)) {
    for (const q of queries) {
      jobs.push(
        getJson(
          `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=${PER_SOURCE}`
        )
          .then((data) =>
            (data?.hits || []).map((h) => ({
              title: h.title || "",
              url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
              summary: "",
              image: "",
              source: "hn",
              author: h.author || "",
              date: h.created_at || "",
              topics: [topic],
              points: h.points || 0,
            }))
          )
          .catch(() => [])
      );
    }
  }
  const results = await Promise.all(jobs);
  return results.flat();
}

// --- merge ------------------------------------------------------------------
// Normalize a URL for dedupe: drop protocol, "www.", trailing slash, and query.
function urlKey(url = "") {
  return String(url)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

function mergeItems(lists) {
  const seen = new Map();
  for (const item of lists.flat()) {
    if (!item.title || !item.url) continue;
    const key = urlKey(item.url);
    const existing = seen.get(key);
    if (existing) {
      // Same article from two sources → union their topics.
      existing.topics = [...new Set([...existing.topics, ...item.topics])];
      continue;
    }
    seen.set(key, { ...item });
  }
  return [...seen.values()]
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, MAX_CARDS);
}

// --- rendering --------------------------------------------------------------
function timeAgo(dateStr) {
  const then = new Date(dateStr || 0).getTime();
  if (!then) return "";
  const diff = Date.now() - then;
  const day = 86400000;
  if (diff < 3600000) return `${Math.max(1, Math.round(diff / 60000))}m ago`;
  if (diff < day) return `${Math.round(diff / 3600000)}h ago`;
  if (diff < 30 * day) return `${Math.round(diff / day)}d ago`;
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const SOURCE_LABEL = { devto: "DEV", hn: "Hacker News" };

function cardHtml(item) {
  const url = safeUrl(item.url);
  const title = esc(item.title);
  const badge = SOURCE_LABEL[item.source] || esc(item.source);
  const topicClass = item.topics.includes(TOPICS.AI) && !item.topics.includes(TOPICS.MOBILE)
    ? "news-card--ai"
    : "news-card--mobile";

  const media = item.image
    ? `<div class="news-card__media"><img src="${safeUrl(item.image)}" alt="" loading="lazy" onerror="this.closest('.news-card__media').classList.add('news-card__media--fallback'); this.remove();"/></div>`
    : `<div class="news-card__media news-card__media--fallback"></div>`;

  const summary = item.summary
    ? `<p class="news-card__summary">${esc(item.summary)}</p>`
    : "";

  const metaBits = [];
  if (item.author) metaBits.push(esc(item.author));
  const ago = timeAgo(item.date);
  if (ago) metaBits.push(ago);
  if (item.source === "hn" && item.points) metaBits.push(`▲ ${item.points}`);

  return `
    <a class="news-card ${topicClass}" href="${url}" target="_blank" rel="noopener"
       data-topics="${esc(item.topics.join(" "))}">
      ${media}
      <div class="news-card__body">
        <span class="news-card__badge">${badge}</span>
        <h3 class="news-card__title">${title}</h3>
        ${summary}
        <div class="news-card__meta">${metaBits.join(" · ")}</div>
        <span class="news-card__cta">Read more <i class="fa-solid fa-arrow-up-right-from-square"></i></span>
      </div>
    </a>`;
}

function render(items) {
  const grid = $("#newsGrid");
  const filters = $("#newsFilters");
  if (!grid) return;

  if (!items.length) {
    grid.innerHTML = `<p class="portfolio-empty">No news right now — check back soon.</p>`;
    if (filters) filters.style.display = "none";
    return;
  }

  grid.innerHTML = items.map(cardHtml).join("");
  if (filters) filters.style.display = "";
}

// Client-side filtering by topic (All / Mobile / AI).
function wireFilters() {
  const filters = $("#newsFilters");
  const grid = $("#newsGrid");
  if (!filters || !grid) return;

  filters.addEventListener("click", (e) => {
    const btn = e.target.closest(".news-chip");
    if (!btn) return;
    const topic = btn.dataset.topic; // "" = all
    filters.querySelectorAll(".news-chip").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    grid.querySelectorAll(".news-card").forEach((card) => {
      const topics = card.dataset.topics || "";
      const show = !topic || topics.split(" ").includes(topic);
      card.style.display = show ? "" : "none";
    });
  });
}

// --- boot -------------------------------------------------------------------
function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { t, items } = JSON.parse(raw);
    if (Date.now() - t > CACHE_TTL) return null;
    return items;
  } catch {
    return null;
  }
}

function writeCache(items) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), items }));
  } catch {
    /* storage full / disabled — ignore, it's only a cache */
  }
}

async function init() {
  const grid = $("#newsGrid");
  if (!grid) return;
  wireFilters();

  const cached = readCache();
  if (cached) {
    render(cached);
    return;
  }

  grid.innerHTML = `<p class="portfolio-loading">Loading the latest…</p>`;
  try {
    const [devto, hn] = await Promise.allSettled([fetchDevto(), fetchHn()]);
    const lists = [
      devto.status === "fulfilled" ? devto.value : [],
      hn.status === "fulfilled" ? hn.value : [],
    ];
    const items = mergeItems(lists);
    if (!items.length) throw new Error("no items");
    render(items);
    writeCache(items);
  } catch (err) {
    console.error("Failed to load news:", err);
    grid.innerHTML = `<p class="portfolio-loading">Couldn't load the news feed right now. Please try again later.</p>`;
    const filters = $("#newsFilters");
    if (filters) filters.style.display = "none";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
