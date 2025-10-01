/* Configuration */
const API_BASE = "http://127.0.0.1:5000";
let currentPage = 1;
const pageSize = 12;
let totalItems = 0;
let sessionId = null;
let currentQuery = "";

/* DOM */
const cardsWrap = document.getElementById("cardsWrap");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageInfo = document.getElementById("pageInfo");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const newsBar = document.getElementById("newsBar");

/* Utility: safe text insertion */
function setText(el, text) { el.textContent = text ?? ""; }

/* Fetch and render flashcards */
async function loadPage(page=1, q="") {
  currentPage = page;
  currentQuery = q || "";
  const url = new URL(API_BASE + "/flashcards");
  url.searchParams.set("page", page);
  url.searchParams.set("page_size", pageSize);
  if (currentQuery) url.searchParams.set("q", currentQuery);

  try {
    const res = await fetch(url.toString());
    const data = await res.json();
    if (!data || !data.success) {
      cardsWrap.innerHTML = `<div class="text-center text-muted p-3">Failed to load flashcards.</div>`;
      return;
    }
    totalItems = data.total || 0;
    renderCards(data.items || []);
    updatePaginationUI();
  } catch (err) {
    console.error("Load error", err);
    cardsWrap.innerHTML = `<div class="text-center text-danger p-3">Server error — is the API running?</div>`;
  }
}

/* Render card list (grid) */
function renderCards(items) {
  cardsWrap.innerHTML = "";
  if (!items.length) {
    cardsWrap.innerHTML = `<div class="text-center text-muted p-3">No results.</div>`;
    return;
  }

  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "flashcard";
    const category = document.createElement("div");
    category.className = "flashcard-category";
    setText(category, item.category || "");

    const phrase = document.createElement("div");
    phrase.className = "flashcard-text";
    phrase.dataset.fr = item.fr;
    phrase.dataset.en = item.en;
    setText(phrase, item.fr);

    phrase.addEventListener("click", (e) => {
      const t = phrase.textContent === phrase.dataset.fr ? phrase.dataset.en : phrase.dataset.fr;
      setText(phrase, t);
    });

    const soundBtn = document.createElement("button");
    soundBtn.className = "sound-icon";
    soundBtn.title = "Play pronunciation";
    soundBtn.innerHTML = '<i class="bi bi-volume-up-fill"></i>';
    soundBtn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      await playTTS(item.fr);
    });

    const topRow = document.createElement("div");
    topRow.style.display = "flex";
    topRow.style.justifyContent = "space-between";
    topRow.style.alignItems = "start";
    topRow.appendChild(category);
    topRow.appendChild(soundBtn);

    card.appendChild(topRow);
    card.appendChild(phrase);
    cardsWrap.appendChild(card);
  });
}

/* TTS call */
async function playTTS(text) {
  try {
    const res = await fetch(API_BASE + "/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const j = await res.json();
    if (j.success && j.file) {
      const a = new Audio(j.file);
      await a.play().catch(()=>{/* ignore autoplay blocking */});
    } else {
      console.warn("TTS error", j);
      alert("TTS error: " + (j.error || "unknown"));
    }
  } catch (err) {
    console.error("TTS request failed", err);
    alert("TTS server error.");
  }
}

/* Pagination UI */
function updatePaginationUI(){
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  pageInfo.textContent = `Page ${currentPage} / ${totalPages} — ${totalItems} items`;
  prevBtn.disabled = (currentPage <= 1);
  nextBtn.disabled = (currentPage >= totalPages);
}

/* Buttons */
prevBtn.addEventListener("click", (e)=>{ e.preventDefault(); if (currentPage>1) loadPage(currentPage - 1, currentQuery); });
nextBtn.addEventListener("click", (e)=>{ e.preventDefault(); const tp = Math.max(1, Math.ceil(totalItems/pageSize)); if (currentPage < tp) loadPage(currentPage + 1, currentQuery); });

/* Search */
searchBtn.addEventListener("click", ()=> { const q = searchInput.value.trim(); loadPage(1, q); });
searchInput.addEventListener("keydown", (e)=>{ if (e.key === "Enter") { e.preventDefault(); searchBtn.click(); } });

/* News bar */
async function initNewsBar(){
  try {
    const res = await fetch(`${API_BASE}/flashcards?page=1&page_size=300`);
    const data = await res.json();
    if (!data.success) return;
    const arr = data.items.map(i=>i.fr).filter(Boolean);
    const news = [];
    while (news.length < 10 && arr.length) {
      const r = arr[Math.floor(Math.random()*arr.length)];
      if (!news.includes(r)) news.push(r);
    }
    newsBar.textContent = news.join("  |  ");
  } catch (err) {
    console.warn("news failed", err);
    newsBar.textContent = "Bienvenue — pratiquez votre français chaque jour !";
  }
}

/* Visitor tracking */
async function visitStart(){
  try {
    const r = await fetch(API_BASE + "/visit_start", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ user_agent: navigator.userAgent, referrer: document.referrer || "" })
    });
    const j = await r.json();
    if (j.success) sessionId = j.session_id;
  } catch (err) { console.warn("visitStart failed", err); }
}
function visitEnd(){
  if (!sessionId) return;
  const payload = JSON.stringify({ session_id: sessionId });
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon(API_BASE + "/visit_end", blob);
  } else {
    fetch(API_BASE + "/visit_end", { method:"POST", headers:{"Content-Type":"application/json"}, body: payload }).catch(()=>{});
  }
}

/* Init */
window.addEventListener("load", () => {
  visitStart();
  initNewsBar();
  loadPage(1, "");
});
window.addEventListener("beforeunload", () => { visitEnd(); });
