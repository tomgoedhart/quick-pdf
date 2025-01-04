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
import contentInvoice from "./invoice.js";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const generatePdf = async (path, html, res) => {
  const pdfProperties = {
    format: "A4",
    printBackground: true,
    margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" },
    displayHeaderFooter: true,
    headerTemplate: header,
    footerTemplate: footer,
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

  const page = await browser.newPage();
  await page.setContent(html);
  await page.emulateMediaType("print");

  try {
    const pdfBuffer = await page.pdf(pdfProperties);

    if (process.env.NODE_ENV === "production") {
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

    console.log("PDF file generated successfully");
    res.json({
      message: "PDF generated and uploaded successfully",
      url: `https://quick-opslag.s3.amazonaws.com/${path}`,
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ error: "Error generating PDF" });
  } finally {
    await browser.close();
  }
};

app.post("/invoice", async (req, res) => {
  const data = req.body;
  const html = contentInvoice(data);
  const path = data.path;
  await generatePdf(path, html, res);
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
