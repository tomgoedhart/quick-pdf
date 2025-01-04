import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const styles = fs.readFileSync(join(__dirname, "styles.css"), "utf8");

const invoiceHtml = (data) => `
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
    <h1>Factuur</h1>
    <p>Nummer: ${data.header.number}</p>
    <p>Datum: ${data.header.date}</p>
    ${data.items
      .map(
        (item) => `
      <div class="item">
        <p>Datum: ${item.date}</p>
        <p>Order: ${item.order}</p>
        <p>${item.reference_name}</p>
        <p>${item.reference_number}</p>
        <p>${item.project_description}</p>
        ${item.items
          .map(
            (subItem) => `
              <div class="sub-item">
                <h2>${subItem.description}</h2>
                <p>Aantal: ${subItem.qty}</p>
                <p>Prijs per eenheid: ${subItem.price_per_unit}</p>
                <p>Korting: ${subItem.discount}</p>
                <p>Totaal: ${subItem.price}</p>
              </div>
            `
          )
          .join("")}
          </div>
        `
      )
      .join("")}
  </body>
  </html>
`;

export default invoiceHtml;
