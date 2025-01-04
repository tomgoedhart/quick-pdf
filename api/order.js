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
      <title>${data.header.title}</title>
      <style>
        ${styles}
      </style>
    </head>
    <body>
      <div class="order-header">
        <!-- Order Information -->
        <div class="order-info">
          <h1>Pakbon</h1>
          <p>Ordernummer: ${data.order_info.order_number}</p>
          <p>Orderdatum: ${data.order_info.order_date}</p>
          <p>Referentie: ${data.order_info.reference_name}</p>
          <p>Referentie nr: ${data.order_info.reference_number}</p>
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
      <table class="table">
        <thead>
          <tr>
            <th>${data.header_labels.qty}</th>
            <th>${data.header_labels.item}</th>
            <th>${data.header_labels.price_per_unit}</th>
            <th>${data.header_labels.discount}</th>
            <th>${data.header_labels.price}</th>
          </tr>
        </thead>
        <tbody>
          ${data.items
            .map(
              (item) => `
            <tr class="item-info">
              <td rowspan="2">${item.quantity}</td>
              <td><strong>${item.name}</strong></td>
              <td rowspan="2">${item.price_per_unit}</td>
              <td rowspan="2">${item.discount_percentage} <small>(${item.discount_amount})</small></td>
              <td rowspan="2">${item.total}</td>
            </tr>
            <tr class="item-specifications">
              <td>
                <table>
                  <tr>
                    <td>Techniek</td>
                    <td>: ${item.specifications.technique}</td>
                  </tr>
                  <tr>
                    <td>Materiaal</td>
                    <td>: ${item.specifications.material}</td>
                  </tr>
                  <tr>
                    <td>Formaat</td>
                    <td>: ${item.specifications.format.width} x ${item.specifications.format.height} mm</td>
                  </tr>
                  <tr>
                    <td>Aantal regels</td>
                    <td>: ${item.specifications.rules}</td>
                  </tr>
                  <tr>
                    <td>Zelfklevend</td>
                    <td>: ${item.specifications.self_adhesive}</td>
                  </tr>
                </table>
              </td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>

      <!-- Totals -->
      <div class="totals">
        <p><strong>${data.totals.subtotal.label}:</strong> ${
  data.totals.subtotal.cost
}</p>
        <p><strong>${data.totals.discount.label}:</strong> ${
  data.totals.discount.cost
}</p>
        <p><strong>${data.totals.small_order_fee.label}:</strong> ${
  data.totals.small_order_fee.cost
}</p>
        <p><strong>${data.totals.shipping.label}:</strong> ${
  data.totals.shipping.cost
} (${data.totals.shipping.method})</p>
        <p><strong>${data.totals.total.label}:</strong> ${
  data.totals.total.cost
}</p>
      </div>

      <!-- Footer -->
      <footer>
        <p class="footer-note">${data.footer.additional_notes}</p>
      </footer>
    </body>
  </html>
`;

export default invoiceHtml;
