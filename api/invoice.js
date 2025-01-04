import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const styles = fs.readFileSync(join(__dirname, "styles.css"), "utf8");

const invoiceTemplate = (data) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quickgraveer offerte</title>
    <style>
      ${styles}
    </style>
  </head>
  <body>
    <h1>${data.order_info?.order_number}</h1>
    <p>${data.order_info?.order_date}</p>
    <p>${data.order_info?.reference_name}</p>
    ${data.items
      .map(
        (item) => `
      <div class="item">
        <h2>${item.name}</h2>
        <p>${item.quantity}</p>
        <p>${item.total}</p>
      </div>
    `
      )
      .join("")}
  </body>
  </html>
`;

export default invoiceTemplate;
