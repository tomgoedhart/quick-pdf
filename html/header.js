import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logo = fs.readFileSync(join(__dirname, "../assets/logo.svg"), "base64");

const headerTemplate = (data) => `
  <header style="margin: auto; padding: 0.5cm 1cm; height: 3cm; width: 100%; font-size: 18px; -webkit-print-color-adjust: exact;">
      <style>
        *{
          font-family: Futura, sans-serif;
          margin: 0;
          padding: 0;
          -webkit-font-smoothing: antialiased;
        }
      
        #header { 
          padding: 0 !important;
        }

        header img {
          position: absolute;
          top: 0.8cm;
          left: 50%;
          transform: translateX(-50%);
          height: 3.4cm;
        }
        
        header p { 
          font-size: 11px;
          text-align: right;
          float: right;
          white-space: pre;
          width: 30%;
          font-weight: 200;
        }
      </style>
      <img src="data:image/svg+xml;base64,${logo}" alt="Quick logo" />
      <p>
        ${data.header.company_info.name}
        ${data.header.company_info.address}
        ${data.header.company_info.postal_code} ${data.header.company_info.city}
        ${data.header.company_info.country}
        ${data.header.company_info.contact.phone}
        ${data.header.company_info.contact.email}
        ${data.header.company_info.contact.website}
        KvK: ${data.header.company_info.registration.kvk}
        BTW: ${data.header.company_info.registration.btw}
      </p>
  </header>
`;

export default headerTemplate;
