import { prepareMarkdown } from "./src/app/markdown/wikilink.js";

const cases = [
    "[[Da]] [[@Alcea2/vvv|vvv]]",
    "\\[\\[Da]] \\[\\[@Alcea2/vvv|vvv]]",
    "# Заголовок\n\n**жирный** текст",
];

for (const c of cases) {
    console.log("IN :", JSON.stringify(c));
    console.log("OUT:", JSON.stringify(prepareMarkdown(c)));
}
