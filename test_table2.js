const { JSDOM } = require("jsdom");
const html = `
<div class="container">
<table>
  <thead>
    <tr><th><div>dist_limit</div></th><th><div>split_limit</div></th><th><div>result</div></th></tr>
  </thead>
  <tbody>
    <tr><td><div>3</div></td><td><div>6</div></td><td><div>6</div></td></tr>
  </tbody>
</table>
</div>
`;
const dom = new JSDOM(html);
const document = dom.window.document;

function extractTextWithImages(node) {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1) return "";
    
    const tagName = node.tagName.toUpperCase();

    if (tagName === 'TABLE' || tagName === 'TBODY' || tagName === 'THEAD') {
        let tableText = "\n";
        const rows = Array.from(node.rows || []);
        rows.forEach((row, rowIndex) => {
            const cells = Array.from(row.cells || []);
            const cellTexts = cells.map(cell => {
                return extractTextWithImages(cell).replace(/\n+/g, ' ').trim();
            });
            tableText += "| " + cellTexts.join(" | ") + " |\n";
            
            if (rowIndex === 0 && rows.length > 1) {
                const sep = cells.map(() => "---");
                tableText += "| " + sep.join(" | ") + " |\n";
            }
        });
        return tableText + "\n";
    }

    let text = "";
    for (let child of node.childNodes) {
        text += extractTextWithImages(child);
    }
    
    const blockTags = ['DIV', 'P', 'BR', 'TR', 'TABLE'];
    if (blockTags.includes(tagName)) {
        text += "\n";
    }
    
    return text;
}

const node = document.querySelector(".container");
console.log(extractTextWithImages(node));
