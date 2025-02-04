import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const styles = fs.readFileSync(join(__dirname, "../styles/styles.css"), "utf8");
const logo = fs.readFileSync(
  join(__dirname, "../assets/logoGrey.svg"),
  "base64"
);
const logoWhite = fs.readFileSync(
  join(__dirname, "../assets/logo.svg"),
  "base64"
);

const invoiceHtml = (data) => {
  const hasDiscount =
    data.totals?.discount?.label &&
    data.totals?.discount?.cost &&
    !data.totals.discount.cost.replace("€", "").trim().startsWith("0");

  const hasSmallOrderFee =
    data.totals?.small_order_fee?.label &&
    data.totals?.small_order_fee?.cost &&
    !data.totals.small_order_fee.cost.replace("€", "").trim().startsWith("0");

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quickgraveer offerte</title>
    <style>
      ${styles}

      .background-image {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        height: 100vh;
        width: 100vw;
        z-index: -1;
        background-image: url('data:image/svg+xml;base64,${logo}');
        background-repeat: no-repeat;
        background-size: 60%;
        background-position: bottom right;
      }

      @page {
        padding: 1cm 0 2.5cm;
      }

      .table-invoice {
        padding: 0 0 4cm;
      }

      #header { 
        padding: 0 !important;
      }

      header {
        margin: 0 auto;
        padding: 0.5cm 1cm;
        height: 4cm;
        width: 100vw;
         font-size: 18px;
        -webkit-print-color-adjust: exact;
        color: #fff;
      }

      header:before,
      header:after {
        content: "";
        display: block;
        position: absolute;
        z-index: -1;
        top: 4cm;
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
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        height: 3.5cm;
      }

      header p { 
        position: absolute;
        z-index: 1;
        top: 3.88cm;
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
  </head>
  <body class="invoice">
    ${!data.digital ? "" : `<div class="background-image"></div>`}

    <header>
      <img src="data:image/svg+xml;base64,${logoWhite}" alt="Quick logo" />
      <p>
        ${data.header.company_info.address}
        ${data.header.company_info.postal_code} ${data.header.company_info.city}
        ${data.header.company_info.contact.phone}

        ${data.header.company_info.contact.email}
        ${data.header.company_info.contact.website}
      </p>
    </header>

    <div class="order-header">
      <!-- Order Information -->
      <div class="order-info">
        <h1>Factuur</h1>
        <p>Nummer: ${data.header.number}</p>
        <p>Datum: ${data.header.date}</p>
      </div>

      <!-- Customer Information -->
      <div class="customer-info">
        <h2>${data.customer.name}</h2>
        <p>
          ${data.customer.address}<br/>
          ${data.customer.address_2 ? data.customer.address_2 + "<br/>" : ""}
          ${data.customer.postal_code} ${data.customer.city}
        </p>
      </div>
    </div>

    <!-- Items Table -->
    <table class="table table--invoice">
      <thead>
        <tr>
          <th>${data.header_labels.date}</th>
          <th>${data.header_labels.order}</th>
          <th>${data.header_labels.qty}</th>
          <th>${data.header_labels.description}</th>
          <th class="align-right">${data.header_labels.price_per_unit}</th>
          ${
            hasDiscount
              ? `<th class="align-right">${data.header_labels.discount}</th>`
              : ``
          }
          <th class="align-right">${data.header_labels.price}</th>
        </tr>
      </thead>
      <tbody>
        ${data.items
          .map(
            (item) => `
          <tr class="item-info">
            <td rowspan="${item.items.length + 1}">
              ${item.date}
            </td>
            <td rowspan="${item.items.length + 1}">
              <strong>${item.order}</strong><br/>
              Referentie: ${item.reference_name}<br/>
              Referentienummer: ${item.reference_number}<br/>
              Projectomschrijving: ${item.project_description}
            </td>
          </tr>
          ${item.items
            .map(
              (subItem) => `
              <tr class="item-specifications">
                <td>${subItem.qty}</td>
                <td>${subItem.description}</td>
                <td class="align-right">${subItem.price_per_unit}</td>
                ${
                  hasDiscount
                    ? `<td class="align-right">${subItem.discount}</td>`
                    : ``
                }
                <td class="align-right">${subItem.price}</td>
              </tr>
            `
            )
            .join("")}
        `
          )
          .join("")}
        <tfoot>
          <tr>
            <td rowspan="5"></td>
            <td rowspan="5"colspan="${
              hasDiscount ? "4" : "3"
            }" class="invoice-payment-info">
             <h3>${data.footer.additional_note_header}</h3>
              ${
                data.footer.additional_notes
                  ? "<p>" + data.footer.additional_notes + "</p>"
                  : ""
              }
              <table>
                <tr>
                    <td>Bank:</td>
                    <td>${data.footer.bank_details}</td>
                    <td>BTW:</td>
                    <td>${data.footer.btw}</td>
                </tr>
                <tr>
                    <td>Rek nr.:</td>
                    <td>${data.footer.bank_account}</td>
                    <td>IBAN:</td>
                    <td>${data.footer.iban}</td>
                </tr>
                <tr>
                    <td></td>
                    <td></td>
                    <td>BIC:</td>
                    <td>${data.footer.bic}</td>
                </tr>
              </table>
            </td>
            <td>${data.totals.subtotal.label}</td>
            <td>${data.totals.subtotal.cost}</td>
          </tr>
          ${
            hasDiscount
              ? `
            <tr>
              <td>${data.totals.discount?.label}</td>
              <td>${data.totals.discount?.cost}</td>
            </tr>
          `
              : ""
          }
          ${
            hasSmallOrderFee
              ? `
            <tr>
              <td>${data.totals.small_order_fee?.label}</td>
              <td>${data.totals.small_order_fee?.cost}</td>
            </tr>
          `
              : ""
          }
          ${
            data.totals.shipping?.cost
              ? `<tr>
            <td>${data.totals.shipping?.label}</td>
            <td>${data.totals.shipping?.cost}</td>
          </tr>`
              : ""
          }
          <tr>
            <td>${data.totals.vat?.label}</td>
            <td>${data.totals.vat.cost}</td>
          </tr>
          <tr class="total">
            <td>${data.totals.total?.label}</td>
            <td>${data.totals.total.cost}</td>
          </tr>
        </tfoot>
      </tbody>
    </table>
  </body>
  </html>
`;
};

export default invoiceHtml;
