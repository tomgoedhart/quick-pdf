import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logo = fs.readFileSync(join(__dirname, "metaaluni.svg"), "base64");

const footerTemplate = (data) => `
  <footer style="display: flex; justify-content: start; align-items: center; margin: 2cm 0 0.45cm; padding: 0.12cm 1cm; width: 100%; font-size: 10px; color: #fff; background: #790845; -webkit-print-color-adjust: exact;">
    <style>
      *{
        font-family: Futura, sans-serif;
        margin: 0;
        padding: 0;
        -webkit-font-smoothing: antialiased;
      }
    
      #footer { 
        padding: 0 !important;
      }
      
      footer p { 
        font-size: 9px;
        font-style: italic;
        text-align: left;
        max-width: 100%;
        width: 100%;
        margin: 0;
        padding: 0;
      }

      img {
        height: 1cm;
      }

      footer div {
        border-left: 1px solid #fff;
        margin-left: 0.4cm;
        padding: 0 0.5cm;
        text-align: left;
      }

      .pageNumber {
        position: absolute;
        bottom: 2cm;
        right: 1cm;
        color: #333;
      }

      ${
        !data.digital
          ? `
          footer div, 
          footer img {
            display: none;
          }

          footer {
            background: none !important;
          }
        `
          : ""
      }
    </style>
    <img src="data:image/svg+xml;base64,${logo}" alt="Metaal uni" />
    <div>
      <p>${data.footer.footer_header}</p>
      <p>${data.footer.footer_body}</p>
    </div>
    <span class="pageNumber"></span>
  </footer>
`;

export default footerTemplate;
