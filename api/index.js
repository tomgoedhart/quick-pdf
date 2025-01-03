const express = require("express");
const fs = require("fs");
const path = require("path");
const { default: puppeteer } = require("puppeteer");
const app = express();
const port = process.env.PORT || 3000;
const header = require("./header");
const footer = require("./footer");

app.use(express.json());

app.post("/generate", async (req, res) => {
  const data = req.body;
  const styles = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  const orderId = data.orderId;

  const htmlContent = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated HTML</title>
    <style>
      ${styles}
    </style>
  </head>
  <body>
    <h1>${orderId}</h1>
    <p>${data.orderDate}</p>
    <p>${data.customerName}</p>
    ${data.items
      .map(
        (item) => `
      <div class="item">
        <h2>${item.productName}</h2>
        <p>${item.quantity}</p>
        <p>${item.price}</p>
      </div>
    `
      )
      .join("")}
  </body>
  </html>
  `;

  // const filePath = path.join(__dirname, `${orderId}.html`);

  // fs.writeFile(filePath, htmlContent, (err) => {
  //   if (err) {
  //     console.error("Error writing file", err);
  //     res.status(500).json({ message: "Error writing file" });
  //     return;
  //   }
  //   console.log("HTML file generated successfully");
  // });

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    await page.setContent(htmlContent);
    await page.emulateMediaType("print");
    await page.pdf({
      path: `./pdf/${orderId}.pdf`,
      format: "A4",
      printBackground: true,
      margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" },
      displayHeaderFooter: true,
      headerTemplate: header.default,
      footerTemplate: footer.default,
    });
    await browser.close();
    console.log("PDF file generated successfully");
  } catch (error) {
    console.error("Error generating PDF", error);
    res.status(500).json({ message: "Error generating PDF" });
    return;
  }

  res.json({
    message: "PDF file generated successfully",
    url: `http://localhost:${port}/pdf/${orderId}.pdf`,
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
