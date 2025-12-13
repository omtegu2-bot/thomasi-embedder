const DEFAULT_SETTINGS = {
  historyLength: 10,
  theme: "light",
  audioWarning: true,
  bookmarks: ["", "", ""]
};
const quickLinks = [
  { name: "Wikipedia", url: "https://wikipedia.org", category: "Study", description: "The best thing ever made by humanity, second to only the MOSFET. Please, read this for hours." },
  { name: "Hexanaut", url: "https://hexanaut.io/", category: "Game", description: "An .io game where you capture territory." },
  { name: "Kodub", url: "https://www.kodub.com/", category: "Game", description: "A simple, fun game portal. Features Polytrack!" },
  { name: "Krunker", url: "https://krunker.io/", category: "Game", description: "Fast-paced browser FPS game." },
  { name: "Defly", url: "https://defly.io", category: "Game", description: "Fly a helicopter and capture points." },
  { name: "Yorg", url: "https://yorg.io", category: "Game", description: "A zombie tower defense .io game." },
  { name: "Zombs", url: "https://zombs.io", category: "Game", description: "Build a base and survive zombie waves." },
  { name: "Bit Planes", url: "https://medv.io/bit-planes/", category: "Game", description: "Simple airplane flying game." },
  { name: "Goober Dash", url: "https://gooberdash.winterpixel.io", category: "Game", description: "A fun running and racing game." },
  { name: "Splatoon 2 Loadout Ability Chunk Calculator", url: "https://selicia.github.io/en_US/", category: "Misc", description: "Optimize your sploon gear." },
  { name: "Bloxd", url: "https://bloxd.io", category: "Game", description: "Minecraft-style .io games." },
  { name: "MC Seed Map", url: "https://mcseedmap.net", category: "Misc", description: "Find structures in Minecraft seeds." },
  { name: "Minecraft Wordle", url: "https://mcdle.net", category: "Misc", description: "A Wordle clone with Minecraft theming and items." },
  { name: "TI-83+ Programs", url: "https://www.ticalc.org/pub/83plus/basic/math/", category: "Misc", description: "Basic math programs for the TI-83+ calculator." },
  { name: "OpenFront", url: "https://openfront.io/", category: "Game", description: "A tactical FPS game." },
  { name: "Thomas 32x - Official Thomas Game!", url: "https://html-classic.itch.zone/html/15749771/thms/index.html", category: "Thomas", description: "Thomas' original 3D platforming game, now released for web. ඞ."},
  { name: "Metroid for NES", url: "https://himespider.work.gd/pages/metroid", category: "emulate", description: "Play the classic NES game in-browser."},
  { name: "Metroid 2 for Gameboy", url: "https://himespider.work.gd/pages/metroidII", category: "emulate", description: "Play the classic Gameboy game in-browser."},
  { name: "Super Metroid for SNES", url: "https://himespider.work.gd/pages/supermetroid", category: "emulate", description: "Play the classic SNES game in-browser."},
 { name: "Homestuck", url: "https://homestuck.com", category: "Misc", description: "Play the classic 2009 webcomic in-browser. ඞ!"},
  { name: "Hollow Knight", url: "https://lkarch.org/hollow-knight/", category: "Game", description: "It may not be silksong, but it is hollow knight."},
  { name: "Celeste", url: "https://lkarch.org/celeste/", category: "Game", description: "2d pixel platformer"}
];
const fonts = [
  { name: "Minecraftia", url: "https://fonts.cdnfonts.com/css/minecraftia", css: "'minecraftia', cursive, sans-serif" },
  { name: "Press Start 2P", url: "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap", css: "'Press Start 2P', cursive, sans-serif" },
  { name: "Courier New", css: "'Courier New', monospace" },
  { name: "Comic Neue", url: "https://fonts.googleapis.com/css2?family=Comic+Neue&display=swap", css: "'Comic Neue', cursive, sans-serif" }
];