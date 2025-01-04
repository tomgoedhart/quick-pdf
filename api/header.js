import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logo = fs.readFileSync(join(__dirname, "logo.svg"), "base64");

const headerTemplate = `<header style="margin: auto; padding: 0.5cm; height: 3cm; width: 100%; border-bottom: 1px solid #eee; font-size: 18px; background: #eee; -webkit-print-color-adjust: exact;">
      <style>#header, #footer { padding: 0 !important; }</style>
      <img style="float: center; height: 2cm" src="data:image/svg+xml;base64,${logo}" alt="Quick logo" />
    </header>`;

export default headerTemplate;
