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
import addressStickerHtml from "./addressSticker.js";
import postStickerHtml from "./postSticker.js";

import s3 from "./s3.js";
import printPDF from "./print.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const generatePdf = async (data, html, size) => {
  const path = data.path.startsWith("/") ? data.path.slice(1) : data.path;

  let pdfProperties = {
    printBackground: true,
  };

  const A4Properties = {
    margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" },
    format: "A4",
    displayHeaderFooter: true,
  };

  if (data.type === "Sticker") {
    pdfProperties.width = size.width;
    pdfProperties.height = size.height;
    pdfProperties.margin = {
      top: "0",
      right: "0",
      bottom: "0",
      left: "0",
    };
  } else if (data.type === "Factuur") {
    pdfProperties = {
      ...pdfProperties,
      ...A4Properties,
    };
    pdfProperties.headerTemplate = invoiceHeader(data);
    pdfProperties.footerTemplate = invoiceFooter(data);
  } else {
    pdfProperties = {
      ...pdfProperties,
      ...A4Properties,
    };
    pdfProperties.headerTemplate = header(data);
    pdfProperties.footerTemplate = footer(data);
  }

  let browser;
  let pdfBuffer;

  try {
    if (process.env.NODE_ENV === "development") {
      pdfProperties.path = `./pdf/${path}`;

      // Ensure the directory exists
      const dir = dirname(pdfProperties.path);
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (mkdirError) {
        // Ignore error if directory already exists
        if (mkdirError.code !== "EEXIST") {
          console.error("Error creating directory:", mkdirError);
          throw mkdirError;
        }
      }

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

    pdfBuffer = await page.pdf(pdfProperties);
    console.log(" PDF file generated successfully");

    await browser.close();

    // Generate HTML for development
    if (process.env.NODE_ENV === "development") {
      try {
        fs.writeFileSync(pdfProperties.path?.replace(".pdf", ".html"), html, {
          flag: "w",
        });
        console.log(" HTML file generated successfully");
      } catch (error) {
        console.error("Error generating HTML:", error);
        throw error;
      }
    }

    // Upload to S3
    let s3Url;
    if (process.env.NODE_DISABLE_S3 !== "true") {
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

      const result = await upload.done();
      s3Url = `s3://${result.Bucket}/${result.Key}`;

      console.log("⬆ PDF file uploaded to S3 successfully", s3Url);

      if (data.print) {
        try {
          await printPDF(s3Url, data.printer);
        } catch (error) {
          console.error("Error printing PDF:", error);
          throw error;
        }
      }
    }

    return {
      path,
      pdfBuffer,
      url: s3Url,
    };
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
};

app.post("/invoice", async (req, res) => {
  try {
    const data = req.body;
    if (!data) {
      throw new Error("No data provided");
    }
    const html = invoiceHtml(data);
    const pdf = await generatePdf(data, html);
    res.json({
      message: "PDF generated and uploaded successfully",
      printed: data.print,
      url: pdf.url,
    });
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
    const pdf = await generatePdf(data, html);
    res.json({
      message: "PDF generated and uploaded successfully",
      printed: data.print,
      url: pdf.url,
    });
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
    const pdf = await generatePdf(data, html);
    res.json({
      message: "PDF generated and uploaded successfully",
      printed: data.print,
      url: pdf.url,
    });
  } catch (error) {
    console.error("Error processing quote:", error);
    res
      .status(400)
      .json({ error: "Error processing quote", message: error.message });
  }
});

const handleAddressSticker = async (data, size) => {
  const addressHtml = addressStickerHtml(data);
  const addressData = {
    ...data,
    path: `${data.path}/address.pdf`,
  };
  return await generatePdf(addressData, addressHtml, size);
};

const handlePostSticker = async (data, size) => {
  const postHtml = postStickerHtml(data);
  const postData = {
    ...data,
    path: `${data.path}/post.pdf`,
  };
  return await generatePdf(postData, postHtml, size);
};

app.post("/sticker", async (req, res) => {
  try {
    const data = req.body;
    if (!data) {
      throw new Error("No data provided");
    }

    data.print = true;

    // Dymo Labelwriter 450
    const addressSize = {
      width: 88,
      height: 36,
    };

    const postSize = {
      width: 150,
      height: 102,
    };

    const [addressPdf, postPdf] = await Promise.all([
      handleAddressSticker(data, addressSize),
      handlePostSticker(data, postSize),
    ]);

    res.json({
      message: "PDFs generated and uploaded successfully",
      printed: data.print,
      address: addressPdf.url,
      post: postPdf.url,
    });
  } catch (error) {
    console.error("Error processing address sticker:", error);
    res.status(400).json({
      error: "Error processing address sticker",
      message: error.message,
    });
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
  console.log(` Server is running on http://localhost:${port}`);
});
