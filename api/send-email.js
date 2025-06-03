import sgMail from "@sendgrid/mail";
import { exec } from 'child_process';
import fs from 'fs';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const execPromise = promisify(exec);

// Initialize SendGrid with environment variable
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Authentication function
function authenticate(req) {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== "LADJM6JLBBVWAKIASBGQ") {
    throw new Error("Unauthorized");
  }
}

// No longer need S3 URL parsing

// Helper function to parse Synology path and download file
async function downloadFromSynology(path) {
  try {
    // Check if this is a synology:// protocol format or a relative path
    let relativePath;
    if (path.startsWith('synology://')) {
      relativePath = path.replace('synology://', '');
    } else {
      // Assume it's already a relative path
      relativePath = path;
    }
    
    // Construct the full path
    const basePath = process.env.SYNOLOGY_BASE_PATH || '/data/quick-opslag';
    const fullPath = `${basePath}/${relativePath}`;
    console.log(`Full Synology file path: ${fullPath}`);
    
    // Create a temporary file for the downloaded PDF
    const tempFilePath = `/tmp/${uuidv4()}.pdf`;
    
    // Construct the Synology API URL
    const synologyBaseUrl = process.env.SYNOLOGY_BASE_URL || 'https://quickgraveer.synology.me:5001/webapi/entry.cgi';
    const synologySid = process.env.SYNOLOGY_SID;
    
    if (!synologySid) {
      throw new Error('Synology session ID (SID) is not configured');
    }
    
    // Use curl with the Synology API to download the file
    const curlCommand = `curl --insecure --fail --location --connect-timeout 30 --max-time 50 --output "${tempFilePath}" "${synologyBaseUrl}?api=SYNO.FileStation.Download&version=2&method=download&path=${encodeURIComponent(fullPath)}&mode=download&_sid=${synologySid}"`;
    
    console.log(`Executing Synology download command for email attachment: ${curlCommand}`);
    
    // Execute the curl command
    const { stdout, stderr } = await execPromise(curlCommand);
    
    if (stderr) {
      console.log('Curl stderr (this may include progress info):', stderr);
    }
    
    // Check if the file was downloaded successfully
    if (fs.existsSync(tempFilePath) && fs.statSync(tempFilePath).size > 0) {
      console.log(`Successfully downloaded file to ${tempFilePath}, size: ${fs.statSync(tempFilePath).size} bytes`);
      
      // Read the file into a buffer
      const fileBuffer = fs.readFileSync(tempFilePath);
      
      // Clean up the temporary file
      fs.unlinkSync(tempFilePath);
      
      // Extract the filename from the path
      const filename = relativePath.split('/').pop();
      
      return { fileBuffer, filename };
    } else {
      throw new Error(`File download failed or file is empty: ${tempFilePath}`);
    }
  } catch (error) {
    console.error('Error downloading from Synology:', error);
    throw new Error(`Failed to download from Synology: ${error.message}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Check API key authentication
    authenticate(req);

    const { attachment, email, from_email, from_name, subject, message } =
      req.body;

    // Validate inputs
    if (
      !attachment ||
      !email ||
      !from_email ||
      !from_name ||
      !subject ||
      !message
    ) {
      return res.status(400).json({
        error: "Missing required parameters",
      });
    }

    // Download the attachment from Synology
    let fileBuffer;
    let filename;
    
    try {
      console.log('Downloading attachment using Synology API');
      const result = await downloadFromSynology(attachment);
      fileBuffer = result.fileBuffer;
      filename = result.filename;
    } catch (error) {
      console.error('Error downloading from Synology:', error);
      return res.status(500).json({
        error: 'Error accessing file from Synology',
        details: error.message,
      });
    }
    
    // File buffer should be available at this point

    // Prepare email with attachment and sender name
    const msg = {
      to: email,
      from: {
        email: from_email,
        name: from_name,
      },
      subject: subject,
      text: message,
      html: message.replace(/\n/g, "<br>"),
      attachments: [
        {
          content: fileBuffer.toString("base64"),
          filename: filename,
          type: "application/pdf",
          disposition: "attachment",
        },
      ],
    };

    // Send email
    try {
      await sgMail.send(msg);
      return res.status(200).json({
        message: "Email sent successfully",
      });
    } catch (emailError) {
      console.error("SendGrid Error:", emailError);
      if (emailError.response) {
        return res.status(400).json({
          error: "Email sending failed",
          details: emailError.response.body,
        });
      }
      throw emailError;
    }
  } catch (error) {
    console.error("General Error:", error);
    return res.status(error.message === "Unauthorized" ? 401 : 500).json({
      error: error.message || "Internal server error",
    });
  }
}
