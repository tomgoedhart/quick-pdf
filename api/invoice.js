import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const styles = fs.readFileSync(join(__dirname, "styles.css"), "utf8");
const logo = fs.readFileSync(join(__dirname, "logoGrey.svg"), "base64");

const invoiceHtml = (data) => {
  const hasDiscount = data.items.some(
    (item) => !item.discount?.replace("€", "").trim()?.startsWith("0")
  );

  const hasSmallOrderFee =
    !data.totals.small_order_fee?.cost
      ?.replace("€", "")
      .trim()
      ?.startsWith("0") || false;

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
        background-size: 70%;
        background-position: 123% 130%;
      }

      @page {
        padding: 5cm 0 0;
      }
    </style>
  </head>
  <body class="invoice">
    <div class="background-image"></div>

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
            <td rowspan="${item.items.length * 2 + 1}">
              ${item.date}
            </td>
            <td rowspan="${item.items.length * 2 + 1}">
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
            <td></td>
            <td colspan="${hasDiscount ? "4" : "2"}" rowspan="1" class="sender">
            </td>
            <td>${data.totals.subtotal.label}</td>
            <td>${data.totals.subtotal.cost}</td>
          </tr>
          <tr>
            <td rowspan="5"></td>
            <td colspan="${
              hasDiscount ? "4" : "2"
            }" rowspan="5" class="additional-notes">
              <h3>${data.footer.additional_note_header}</h3>
              <p>${
                data.footer.additional_notes ? data.footer.additional_notes : ""
              }
                ${data.footer.bank_details}
                ${data.footer.bank_account}
                ${data.footer.btw}
                ${data.footer.iban}
                ${data.footer.bic}
              </p>
            </td>
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
