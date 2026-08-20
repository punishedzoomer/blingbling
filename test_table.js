const { JSDOM } = require("jsdom");

const html = `
<table>
  <thead>
    <tr><th>dist_limit</th><th>split_limit</th><th>result</th></tr>
  </thead>
  <tbody>
    <tr><td>3</td><td>6</td><td>6</td></tr>
    <tr><td>0</td><td>10</td><td>1</td></tr>
  </tbody>
</table>
`;

const dom = new JSDOM(html);
const document = dom.window.document;
const node = document.querySelector("table");

console.log("node.rows length:", node.rows.length);

const tbody = document.querySelector("tbody");
console.log("tbody.rows length:", tbody.rows ? tbody.rows.length : "undefined");

