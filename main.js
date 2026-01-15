const sessionId = crypto.randomUUID();
const ANALYTICS_ENDPOINT = "http://localhost:3000";
const startTime = Date.now();
sendEvent("session_start");

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    sendEvent("session_end", {
      durationMs: Date.now() - startTime,
    });
  }
});


async function loadGameList() {
  const res = await fetch("games.json");
  if (!res.ok) throw new Error("Failed to load game list");
  const data = await res.json();
  console.log("JSON loaded:", data);
  return data;
}
const SITE_PREFIX = "https://lkarch.org/omtegu/games/";

function normalizeURL(url) {
  if (!url || typeof url !== "string") return null;

  url = url.trim();

  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  try {
    new URL(url);
    return url;
  } catch {

  }


  if (url.startsWith("/")) return SITE_PREFIX + url;

  return SITE_PREFIX + "/" + url;
}


function normalizeCategory(category) {
  if (!category) return "game";

  const c = category.toLowerCase();

  if (c === "other" || c === "misc") return "misc";
  if (c.includes("thomasi")) return "thomas";

  return c;
}



function getSettings() {
  return JSON.parse(localStorage.getItem("embedderSettings")) || DEFAULT_SETTINGS;
}

function saveSettings(settings) {
  
  localStorage.setItem("embedderSettings", JSON.stringify(settings));
}

/* APPLY THEME */
function applyTheme(theme) {
  document.body.classList.remove("light","dark","purple","yellow","magenta");
  document.body.classList.add(theme);
}

/* HISTORY + QUICK LINKS */



function loadFromInput() {
  const url = document.getElementById('urlInput').value;
  if(url) loadURL(url);
}

function loadURL(url) {

  const fullUrl = normalizeURL(url);
  console.log("Loading URL:", fullUrl);
  if (!fullUrl) return;
  sendEvent("load_url", { url });
  document.getElementById('embeddedSite').src = fullUrl;

  let history = JSON.parse(localStorage.getItem("embedHistory") || "[]");
  history.unshift(fullUrl);

  const settings = getSettings();
  history = history.slice(0, settings.historyLength);

  localStorage.setItem("embedHistory", JSON.stringify(history));
  renderHistory();
}


function renderHistory() {
  const settings = getSettings();
  let history = JSON.parse(localStorage.getItem("embedHistory")||"[]");
  history = history.slice(0, settings.historyLength);
  const list = document.getElementById('historyList');
  list.innerHTML = "";
  history.forEach(url=>{
    const li=document.createElement("li");
    li.textContent=url;
    li.onclick=()=>loadURL(url);
    list.appendChild(li);
  });
}

let currentPage = 1;
const itemsPerPage = 20;
let linksData = [];       
let currentLinks = [];    

function renderQuickLinks(links) {
  linksData = links;
  currentLinks = linksData;
  currentPage = 1;
  renderPage();
}

async function getFavicon(url) {
  const hostname = safeHostname(url);
  const normalized = normalizeURL(url);

  const directFavicon = `${normalized.replace(/\/$/, "")}/favicon.ico`;
  try {
    const res = await fetch(directFavicon, { method: "HEAD" });
    if (res.ok) return directFavicon;
  } catch {

  }

  return `https://www.google.com/s2/yfavicons?sz=64&domain=${hostname}`;
}

function renderPage() {
  const grid = document.querySelector("#linkGrid .grid");
  grid.innerHTML = "";

  const searchTerm = document.querySelector("#linkSearch").value.toLowerCase();
  let linksToShow = currentLinks;

  if (searchTerm) {
    linksToShow = linksData.filter(link =>
      (link.name && link.name.toLowerCase().includes(searchTerm)) ||
      (link.description && link.description.toLowerCase().includes(searchTerm)) ||
      (link.category && link.category.toLowerCase().includes(searchTerm))
    );
  } else {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    linksToShow = currentLinks.slice(start, end);
  }

  // Create tiles with placeholder favicon first
  linksToShow.forEach(link => {
    const url = normalizeURL(link.url);
    if (!url) return;

    const tile = document.createElement("div");
    tile.className = "tile " + normalizeCategory(link.category) + (link.featured ? " featured" : "");

    tile.innerHTML = `
      <img src="fallback.png" alt="">
      <p class="link-name">${link.name || "Untitled"}</p>
      <p class="link-description">${link.description || ""}</p>
    `;

    tile.onclick = () => loadURL(url);
    grid.appendChild(tile);

    // Replace favicon asynchronously
    getFavicon(url).then(faviconUrl => {
      const img = tile.querySelector("img");
      if (img) img.src = faviconUrl;
    });
  });

  updatePagination(!searchTerm);
}


function updatePagination(show = true) {
  const pageInfo = document.querySelector("#pageInfo");
  const totalPages = Math.ceil(currentLinks.length / itemsPerPage);

  if (!show) {
    pageInfo.textContent = `Showing search results`;

    return;
  }


}

document.querySelector("#prevPage").onclick = () => {
  if (currentPage > 1) {
    currentPage--;
    renderPage();
  }
};

document.querySelector("#nextPage").onclick = () => {
  const totalPages = Math.ceil(currentLinks.length / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    renderPage();
  }
};

// Trigger search live
document.querySelector("#linkSearch").addEventListener("input", () => renderPage());





function safeHostname(url) {
  try {
    return new URL(normalizeURL(url)).hostname;
  } catch {
    return "example.com";
  }
}


function renderBookmarks(bookmarks) {
  let container = document.getElementById("customBookmarks");
  container.innerHTML = "";
  if (bookmarks.some(b => b)) {
    container.innerHTML = "<h2>Custom Bookmarks</h2>";
    bookmarks.forEach(url => {
      if (url) {
        const div = document.createElement("div");
        div.className = "tile";
        
        div.onclick = () => loadURL(url);
        container.appendChild(div);
      }
    });
  }
}

function toggleFullscreen() {
    const iframe = document.getElementById('embeddedSite');

    // Try opening in a new tab first
    try {
        const newTab = window.open('', '_blank');
        newTab.document.write(`
            <html>
            <head>
                <title>Fullscreen View</title>
                <style>
                    html, body { margin:0; height:100%; }
                    iframe { width:100%; height:100%; border:none; }
                </style>
            </head>
            <body>
                <iframe src="${iframe.src}" allow="fullscreen"></iframe>
            </body>
            </html>
        `);
        newTab.document.close();
        newTab.document.body.requestFullscreen?.().catch(() => { throw 'fullscreen failed'; });
        return; // Success, exit function
    } catch {
        // Fallback fullscreen on the same page
        createOverlayFullscreen(iframe);
    }
}

function createOverlayFullscreen(iframe) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'iframeFullscreenOverlay';
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        background: '#000',
        zIndex: '9999',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    });

    // Clone iframe so original stays in place
    const fullscreenIframe = iframe.cloneNode(true);
    Object.assign(fullscreenIframe.style, {
        width: '100%',
        height: '100%',
        border: 'none'
    });

    overlay.appendChild(fullscreenIframe);
    document.body.appendChild(overlay);

    // Close on Escape
    function closeOverlay(e) {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', closeOverlay);
        }
    }
    document.addEventListener('keydown', closeOverlay);
}


/* SETTINGS MODAL LOGIC */
const settingsBtn = document.getElementById("settingsBtn");
const modal = document.getElementById("settingsModal");
const closeSettings = document.getElementById("closeSettings");
const saveBtn = document.getElementById("saveSettings");

settingsBtn.onclick = ()=>{
  const s = getSettings();
  document.getElementById("historyLength").value = s.historyLength;
  document.getElementById("themeSelect").value = s.theme;
  document.getElementById("audioWarning").checked = s.audioWarning;
  document.getElementById("bookmark1").value = s.bookmarks[0];
  document.getElementById("bookmark2").value = s.bookmarks[1];
  document.getElementById("bookmark3").value = s.bookmarks[2];
  modal.style.display="block";
};
document.getElementById('openEngine').onclick = loadEngine;

closeSettings.onclick = ()=> modal.style.display="none";

saveBtn.onclick = ()=>{
  const newSettings = {
    historyLength: parseInt(document.getElementById("historyLength").value),
    theme: document.getElementById("themeSelect").value,
      lowEndMode: document.getElementById("lowEndMode").checked,
    audioWarning: document.getElementById("audioWarning").checked,
    bookmarks: [
      document.getElementById("bookmark1").value,
      document.getElementById("bookmark2").value,
      document.getElementById("bookmark3").value
    ]
  };
  saveSettings(newSettings);
  applyTheme(newSettings.theme);
  renderBookmarks(newSettings.bookmarks);
  renderHistory();
  modal.style.display="none";
};

/* ENTER KEY TO LOAD */
document.getElementById('urlInput').addEventListener('keypress', e=>{
  if(e.key==='Enter') loadFromInput();
});

function applyLowEndMode(enabled) {
  if (enabled) document.body.classList.add("low-end");
  else document.body.classList.remove("low-end");
}
function loadEngine() {
  const container = document.getElementById('engineContainer');
  const frame = document.getElementById('engineFrame');
  frame.src = 'search.html'; 
  container.style.display = 'block';
}
function sendEvent(type, data = {}) {
  const payload = {
    type,
    sessionId,
    timestamp: Date.now(),
    ...data,
  };

  const blob = new Blob(
    [JSON.stringify(payload)],
    { type: "application/json" }
  );

  navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
}
document.querySelector("#linkSearch").addEventListener("input", () => {
  currentPage = 1; // reset page
  renderPage();
});
function featuredImagePath(item) {
  if (item.image) return `/images/${item.image}`;

 
  const slug = item.name.toLowerCase().replace(/\s+/g, "-");
  return `/images/${slug}.png`;
}

function renderFeatured(items) {
  const container = document.getElementById("featuredCarousel");
  if (!container) return;

  const featured = items.filter(i => normalizeCategory(i.category) === "featured");

  container.innerHTML = "";

  featured.forEach(item => {
    const url = normalizeURL(item.url);
    if (!url) return;

    const card = document.createElement("div");
    card.className = "tile carousel-item";

    card.innerHTML = `
      <img src="${featuredImagePath(item)}" alt="${item.name}">
      <h3>${item.name}</h3>
      <p>${item.description || ""}</p>
    `;

    card.onclick = () => loadURL(url);
    container.appendChild(card);
  });
}


/* INITIALIZATION */
window.onload = async () => {
  const s = getSettings();
  applyTheme(s.theme);
  applyLowEndMode(s.lowEndMode);
  renderBookmarks(s.bookmarks);
  renderHistory();

  const data = await loadGameList();
  renderQuickLinks(data.items);
  renderFeatured(data.items);
};

  /* if(s.audioWarning) alert("⚠️ Warning: you may have your audio turned on, please remember to turn it down joker."); */

  

