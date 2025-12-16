async function loadGameList() {
  const res = await fetch("games.json");
  if (!res.ok) throw new Error("Failed to load game list");
  const data = await res.json();
  console.log("JSON loaded:", data);
  return data;
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
  const fullUrl = url.startsWith('http') ? url : `https://${url}`;
  document.getElementById('embeddedSite').src = fullUrl;

  // Save to history
  let history = JSON.parse(localStorage.getItem("embedHistory")||"[]");
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

function renderQuickLinks(links) {
    console.log("renderQuickLinks called");

    console.log("renderQuickLinks received:", links);

    
  const grid = document.querySelector("#linkGrid .grid");
  grid.innerHTML = "";

  links.forEach(link => {
    const tile = document.createElement("div");
    tile.className = "tile " + link.category;

    tile.innerHTML = `
      <img src="https://www.google.com/s2/favicons?sz=64&domain=${new URL(link.url).hostname}">
      <p class="link-name">${link.name}</p>
      <p class="link-description">${link.description}</p>
    `;

    tile.onclick = () => loadURL(link.url);
    grid.appendChild(tile);
  });
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

/* FULLSCREEN */
function toggleFullscreen() {
    const iframe = document.getElementById('embeddedSite');
    
    // Open in a new blank tab for fullscreen
    const newTab = window.open('', '_blank');
    
    // Inject the iframe full page
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
    
    // Optionally request fullscreen from the new tab
    newTab.document.body.requestFullscreen?.().catch(() => {});
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
  frame.src = 'search.html'; // path to your engine page
  container.style.display = 'block';
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
};

  /* if(s.audioWarning) alert("⚠️ Warning: you may have your audio turned on, please remember to turn it down joker."); */

  

