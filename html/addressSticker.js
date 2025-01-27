import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const styles = fs.readFileSync(
  join(__dirname, "../styles/addressStickerStyles.css"),
  "utf8"
);

const addressStickerHTML = (data) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${data.header}</title>
      <style>
        ${styles}
      </style>
    </head>
    <body>
      <div class="address-sticker">
        <h1>${data.header}</h1>
        <p>${data.line_1}</p>
        <p>${data.line_2}</p>
        <p>${data.line_3}</p>
      </div>
    </body>
  </html>
`;
};

export default addressStickerHTML;
