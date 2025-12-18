import fs from "fs";
import vm from "vm";

const SOURCE_URL =
  "https://raw.githubusercontent.com/Rmheade/rmheade.github.io/main/games.js";

const PREFIX = "https://studying.work.gd";

async function main() {

  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch games.js: ${res.status}`);
  }

  const jsText = await res.text();

  const sandbox = {};
  vm.createContext(sandbox);

  vm.runInContext(jsText + "\nthis.baseGames = baseGames;", sandbox);

  const baseGames = sandbox.baseGames;

  if (!Array.isArray(baseGames)) {
    throw new Error("baseGames was not found or is not an array");
  }


  const items = baseGames.map(game => {
    let url = game.url;

    if (url.startsWith("/")) {
      url = PREFIX + url;
    }

    return {
      name: game.name,
      url,
      category: game.category?.toLowerCase() ?? "game",
      description: game.description
    };
  });


  const output = {
    version: "1.0",
    updated: new Date().toISOString().slice(0, 10),
    items
  };


  fs.writeFileSync(
    "games.json",
    JSON.stringify(output, null, 2),
    "utf8"
  );

  console.log(`Converted ${items.length} games → games.json`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
