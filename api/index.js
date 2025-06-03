import "dotenv/config";
import express from "express";
import puppeteer from "puppeteer";
import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";
import fs from "fs";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { dirname } from "path";
import header from "../html/header.js";
import footer from "../html/footer.js";
import invoiceHeader from "../html/invoiceHeader.js";
import invoiceFooter from "../html/invoiceFooter.js";
import invoiceHtml from "../html/invoice.js";
import orderHtml from "../html/order.js";
import quoteHtml from "../html/quote.js";
import addressStickerHtml from "../html/addressSticker.js";
import postStickerHtml from "../html/postSticker.js";

import s3 from "./s3.js";
import sendEmail from "./send-email.js";
import printPDF from "./print.js";
// Import the curl-based Synology implementation
import { uploadToSynologyWithCurl, moveFolder } from "./synology-curl.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const cleanData = (data) => {
  if (!data) {
    return;
  }

  const cleaned = JSON.parse(
    JSON.stringify(data, (key, value) =>
      value === Object(value) && Object.keys(value).length === 0 ? "" : value
    )
  );

  return cleaned;
};

const generatePdf = async (data, html, size) => {
  const path = data.path?.startsWith("/") ? data.path.slice(1) : data.path;

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
    pdfProperties.margin = {
      top: "0",
      right: "0",
      bottom: "0",
      left: "0",
    };
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

      browser = await puppeteer.launch({
        args: ["--no-sandbox", "--disable-web-security"],
      });
    } else {
      browser = await puppeteerCore.launch({
        args: [...chromium.args, "--no-sandbox", "--disable-web-security"],
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

    // Upload to storage (Synology or S3)
    let fileUrl;
    
    // Check if Synology is enabled
    if (process.env.USE_SYNOLOGY === "true" && process.env.SYNOLOGY_SID) {
      try {
        // Upload to Synology using curl (more reliable method)
        const synologyResult = await uploadToSynologyWithCurl(pdfBuffer, path);
        
        // Use the relative path for the response URL
        fileUrl = synologyResult.url;
        
        console.log("PDF file uploaded to Synology successfully", fileUrl);
        
        // For printing, we need to use the local file path format
        if (data.print) {
          // Format the path for the printer service
          const printPath = `synology://${synologyResult.relativePath}`;
          console.log("Sending to printer with path:", printPath);
          await printPDF(printPath, data.printer);
        }
      } catch (synologyError) {
        console.error("Error uploading to Synology:", synologyError);
        
        // If Synology fails and S3 is configured, fall back to S3
        if (process.env.NODE_DISABLE_S3 !== "true") {
          console.log("Falling back to S3 upload");
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
          fileUrl = `s3://${result.Bucket}/${result.Key}`;

          console.log(" PDF file uploaded to S3 successfully", fileUrl);

          if (data.print) {
            await printPDF(fileUrl, data.printer);
          }
        } else {
          throw synologyError;
        }
      }
    } else if (process.env.NODE_DISABLE_S3 !== "true") {
      // Upload to S3 if Synology is not enabled
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
      fileUrl = `s3://${result.Bucket}/${result.Key}`;

      console.log(" PDF file uploaded to S3 successfully", fileUrl);

      if (data.print) {
        await printPDF(fileUrl, data.printer);
      }
    }

    return {
      path,
      pdfBuffer,
      url: fileUrl,
    };
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
};

app.post("/invoice", async (req, res) => {
  try {
    const data = cleanData(req.body);
    if (!data) {
      throw new Error("No data provided");
    }

    // Create digital invoice - not to be printed
    const digitalHtml = invoiceHtml({ ...data, digital: true, print: false });
    const digitalPdf = await generatePdf(
      { ...data, digital: true, print: false },
      digitalHtml
    );

    // Create printed invoice
    let printPdf;
    if (data.print) {
      const html = invoiceHtml({ ...data, digital: false });
      const printPdf = await generatePdf(
        {
          ...data,
          digital: false,
          path: `${data.path?.replace(".pdf", "")}_print.pdf`,
        },
        html
      );
    }
    res.json({
      message: "PDF generated and uploaded successfully",
      printed: data.print,
      url: digitalPdf.url,
      printUrl: printPdf?.url ?? null,
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
    const data = cleanData(req.body);
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
    const data = cleanData(req.body);
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

app.post("/sticker", async (req, res) => {
  try {
    const data = cleanData(req.body);
    if (!data) {
      throw new Error("No data provided");
    }

    data.print = true;

    // Dymo Labelwriter 450
    const addressSize = {
      width: "36mm",
      height: "88mm",
    };

    const addressPdf = await handleAddressSticker(data, addressSize);

    res.json({
      message: "PDFs generated and uploaded successfully",
      printed: data.print,
      address: addressPdf.url,
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
    const data = cleanData(req.body);
    if (!data) {
      throw new Error("No data provided");
    }
    
    // Determine which storage system to use (Synology or S3)
    if (process.env.USE_SYNOLOGY === "true" && process.env.SYNOLOGY_SID) {
      try {
        // Use Synology folder move
        await moveFolder(req, res);
      } catch (synologyError) {
        console.error("Error moving folder in Synology:", synologyError);
        // If Synology fails and S3 is configured, fall back to S3
        if (process.env.NODE_DISABLE_S3 !== "true") {
          await s3(req, res);
        } else {
          throw synologyError;
        }
      }
    } else if (process.env.NODE_DISABLE_S3 !== "true") {
      // Use S3 folder move
      await s3(req, res);
    } else {
      throw new Error("No storage system is properly configured");
    }
  } catch (error) {
    console.error("Error processing folder move:", error);
    res
      .status(400)
      .json({ error: "Error processing folder move", message: error.message });
  }
});

app.post("/send-email", async (req, res) => {
  try {
    const data = cleanData(req.body);
    if (!data) {
      throw new Error("No data provided");
    }
    await sendEmail(req, res);
  } catch (error) {
    console.error("Error processing send email:", error);
    res
      .status(400)
      .json({ error: "Error processing send email", message: error.message });
  }
});

app.listen(port, () => {
  console.log(` Server is running on http://localhost:${port}`);
});
