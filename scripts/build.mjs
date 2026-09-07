import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { validateCatalog } from "../js/data.js";

validateCatalog(JSON.parse(await readFile(new URL("../data/tutors.json", import.meta.url), "utf8")));
await mkdir("dist", { recursive: true });
// Publish only public website assets, never the repository or tooling folders.
for (const path of ["index.html", "styles.css", "js", "data"]) {
  await cp(path, `dist/${path}`, { recursive: true });
}
await writeFile("dist/.nojekyll", "");
console.log("Static website prepared in dist/.");
