import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

const html = "bluehost/planner/bluehost.html";
const index = "bluehost/planner/index.html";
if (!existsSync(html)) {
  console.error("Bluehost build did not emit bluehost.html");
  process.exit(1);
}
renameSync(html, index);
let page = readFileSync(index, "utf8");
page = page.replace(/<script src="\/planner\/config\.js[^"]*"><\/script>\s*/g, "");
page = page.replace("<head>", '<head>\n    <script src="/planner/config.js?v=3"></script>');
writeFileSync(index, page);
copyFileSync("public/favicon.svg", "bluehost/planner/favicon.svg");
copyFileSync("bluehost-public/.htaccess", "bluehost/planner/.htaccess");
console.log("Bluehost planner is in bluehost/planner");

