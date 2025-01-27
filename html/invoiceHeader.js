import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logo = fs.readFileSync(join(__dirname, "../assets/logo.svg"), "base64");

const headerTemplate = (data) => `
  <header style="margin: auto; padding: 0.5cm 1cm; height: 4cm; width: 100%;  font-size: 18px; -webkit-print-color-adjust: exact; color: #fff;">
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

        header:before,
        header:after {
          content: "";
          display: block;
          position: absolute;
          z-index: -1;
          top: 5cm;
          width: 4.5cm;
          height: 3cm;
          background: #790845;
        }

        header:before {
          left: 0;
          border-radius: 0 0.2cm 0.2cm 0;
        }

        header:after {
          right: 0;
          width: 1cm;
          border-radius: 0.2cm 0 0 0.2cm;
        }

        header img {
          position: absolute;
          top: 1cm;
          left: 50%;
          transform: translateX(-50%);
          height: 3.5cm;
        }
        
        header p { 
          position: absolute;
          z-index: 1;
          top: 4.88cm;
          left: 0cm;
          font-size: 12px;
          text-align: left;
          white-space: pre;
          width: 3cm;
          font-weight: 200;
          color: #fff;
        }

        ${
          !data.digital
            ? `
            header:before,
            header:after,
            header p,
            header img {
              display: none;
            }
          `
            : ""
        }
      </style>
      <img src="data:image/svg+xml;base64,${logo}" alt="Quick logo" />
      <p>
        ${data.header.company_info.address}
        ${data.header.company_info.postal_code} ${data.header.company_info.city}
        ${data.header.company_info.contact.phone}

        ${data.header.company_info.contact.email}
        ${data.header.company_info.contact.website}
      </p>
  </header>
`;

export default headerTemplate;
