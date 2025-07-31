import SibApiV3Sdk from "sib-api-v3-sdk";
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fsPromises } from 'fs';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getSynologySid, logoutSynology } from './synology-auth.js';

const execPromise = promisify(exec);

// Initialize Brevo with environment variable
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

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
  let sid = null;
  // Define synologyBaseUrl outside the try block so it's available in catch blocks
  const synologyBaseUrl = process.env.SYNOLOGY_BASE_URL || 'https://quickgraveer.synology.me:5001/webapi/entry.cgi';
  
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
    
    // Get a fresh Synology session ID for this request
    sid = await getSynologySid();
    
    // Use curl with the Synology API to download the file
    const curlCommand = `curl --insecure --fail --location --connect-timeout 30 --max-time 50 --output "${tempFilePath}" "${synologyBaseUrl}?api=SYNO.FileStation.Download&version=2&method=download&path=${encodeURIComponent(fullPath)}&mode=download&_sid=${sid}"`;
    
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
      const fileBuffer = await fsPromises.readFile(tempFilePath);
      
      // Clean up the temporary file
      await fsPromises.unlink(tempFilePath);
      
      // Extract the filename from the path
      const filename = relativePath.split('/').pop();
      
      // Logout the session
      try {
        await logoutSynology(synologyBaseUrl, sid);
        console.log('Successfully logged out Synology session');
      } catch (logoutError) {
        console.warn(`Warning: Failed to logout Synology session: ${logoutError.message}`);
      }
      
      return { fileBuffer, filename };
    } else {
      // Attempt to logout before throwing the error
      try {
        await logoutSynology(synologyBaseUrl, sid);
      } catch (logoutError) {
        console.warn(`Warning: Failed to logout Synology session: ${logoutError.message}`);
      }
      
      throw new Error(`File download failed or file is empty: ${tempFilePath}`);
    }
  } catch (error) {
    console.error('Error downloading from Synology:', error);
    
    // Attempt to logout if we have a SID
    if (sid) {
      try {
        await logoutSynology(synologyBaseUrl, sid);
        console.log('Successfully logged out Synology session after error');
      } catch (logoutError) {
        console.warn(`Warning: Failed to logout Synology session: ${logoutError.message}`);
      }
    }
    
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
      !email ||
      !from_email ||
      !from_name ||
      !subject ||
      !message
    ) {
      console.log('Validation failed:', { email, from_email, from_name, subject, message });
      return res.status(400).json({
        error: "Missing required parameters",
      });
    }

    // Download the attachment from Synology if provided
    let fileBuffer;
    let filename;
    
    if (attachment) {
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
    }
    
    // Prepare email with optional attachment and sender name
    console.log('Preparing email with params:', { email, from_email, from_name, subject, hasAttachment: !!attachment });
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    
    sendSmtpEmail.to = [{
      email: email,
      name: "Recipient"
    }];
    
    sendSmtpEmail.sender = {
      email: from_email,
      name: from_name
    };
    
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.textContent = message;
    sendSmtpEmail.htmlContent = message.replace(/\n/g, "<br>");
    
    // Add attachment if provided
    if (fileBuffer && filename) {
      sendSmtpEmail.attachment = [{
        content: fileBuffer.toString("base64"),
        name: filename,
        contentType: "application/pdf"
      }];
    }

    // Send email
    try {
      console.log('Sending email with Brevo...');
      const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log('Email sent successfully');
      return res.status(200).json({
        message: "Email sent successfully",
        data: data
      });
    } catch (emailError) {
      console.error("Brevo Error:", emailError);
      console.error("Error details:", emailError.response?.body || emailError.message);
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
