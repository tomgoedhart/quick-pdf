const fs = require("fs");
const path = require("path");

const logo = fs.readFileSync(path.join(__dirname, "logo.svg"), "base64");

module.exports = {
  default: `<header style="margin: auto; padding: 0.5cm; height: 3cm; width: 100%; border-bottom: 1px solid #eee; font-size: 18px; background: #eee; -webkit-print-color-adjust: exact;">
      <style>#header, #footer { padding: 0 !important; }</style>
      <img style="float: center; height: 2cm" src="data:image/svg+xml;base64,${logo}" alt="Quick logo" />
    </header>`,
};
