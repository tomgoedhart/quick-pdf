import "dotenv/config";
import express from "express";
import puppeteer from "puppeteer";
import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";
import fs from "fs";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { dirname } from "path";
import header from "./header.js";
import footer from "./footer.js";
import invoiceHeader from "./invoiceHeader.js";
import invoiceFooter from "./invoiceFooter.js";
import invoiceHtml from "./invoice.js";
import orderHtml from "./order.js";
import quoteHtml from "./quote.js";

import s3 from "./s3.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const generatePdf = async (data, html, res) => {
  const path = data.path;
  const pdfProperties = {
    format: "A4",
    printBackground: true,
    margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" },
    displayHeaderFooter: true,
    headerTemplate:
      data.type === "Factuur" ? invoiceHeader(data) : header(data),
    footerTemplate:
      data.type === "Factuur" ? invoiceFooter(data) : footer(data),
  };

  let browser;
  if (process.env.NODE_ENV === "development") {
    pdfProperties.path = `./pdf/${path}`;

    // Ensure the directory exists
    const dir = dirname(pdfProperties.path);
    fs.mkdirSync(dir, { recursive: true });

    browser = await puppeteer.launch();
  } else {
    browser = await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }

  let pdfBuffer;

  try {
    const page = await browser.newPage();
    await page.setContent(html);
    await page.emulateMediaType("print");

    pdfBuffer = await page.pdf(pdfProperties);
    console.log("PDF file generated successfully");
  } catch (error) {
    console.error("Error generating PDF:", error);
    res
      .status(500)
      .json({ error: "Error generating PDF", message: error.message });
  }

  // Generate HTML for development
  if (process.env.NODE_ENV === "development") {
    try {
      fs.writeFileSync(pdfProperties.path?.replace(".pdf", ".html"), html);
      console.log("HTML file generated successfully");
    } catch (error) {
      console.error("Error generating HTML:", error);
      res
        .status(500)
        .json({ error: "Error generating HTML", message: error.message });
    }
  }

  try {
    if (process.env.NODE_ENV === "production") {
      const s3Client = new S3Client({
        region: process.env.NODE_AWS_REGION,
        credentials: {
          accessKeyId: process.env.NODE_AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.NODE_AWS_SECRET_ACCESS_KEY,
        },
      });

      const uploadParams = {
        Bucket: "quick-opslag",
        Key: path,
        Body: pdfBuffer,
        ContentType: "application/pdf",
      };

      const upload = new Upload({
        client: s3Client,
        params: uploadParams,
      });

      await upload.done();
    }

    res.json({
      message: "PDF generated and uploaded successfully",
      url: `https://quick-opslag.s3.amazonaws.com/${path}`,
    });
  } catch (error) {
    console.error("Error uploading PDF:", error);
    res
      .status(500)
      .json({ error: "Error uploading PDF", message: error.message });
  } finally {
    await browser.close();
  }
};

app.post("/invoice", async (req, res) => {
  try {
    const data = req.body;
    if (!data) {
      throw new Error("No data provided");
    }
    const html = invoiceHtml(data);
    await generatePdf(data, html, res);
  } catch (error) {
    console.error("Error processing invoice:", error);
    res
      .status(400)
      .json({ error: "Error processing invoice", message: error.message });
  }
});

app.post("/order", async (req, res) => {
  try {
    const data = req.body;
    if (!data) {
      throw new Error("No data provided");
    }
    const html = orderHtml(data);
    await generatePdf(data, html, res);
  } catch (error) {
    console.error("Error processing order:", error);
    res
      .status(400)
      .json({ error: "Error processing order", message: error.message });
  }
});

app.post("/quote", async (req, res) => {
  try {
    const data = req.body;
    if (!data) {
      throw new Error("No data provided");
    }
    const html = quoteHtml(data);
    await generatePdf(data, html, res);
  } catch (error) {
    console.error("Error processing quote:", error);
    res
      .status(400)
      .json({ error: "Error processing quote", message: error.message });
  }
});

app.post("/move-folder", async (req, res) => {
  try {
    const data = req.body;
    if (!data) {
      throw new Error("No data provided");
    }
    await s3(req, res);
  } catch (error) {
    console.error("Error processing s3:", error);
    res
      .status(400)
      .json({ error: "Error processing s3", message: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
