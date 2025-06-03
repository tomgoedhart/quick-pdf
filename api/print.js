import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const execPromise = promisify(exec);

const printPDF = async (path, printer) => {
  // Handle Synology URLs with self-signed certificates
  let finalPath = path;
  
  // Check if this is a Synology URL
  if (typeof path === 'string' && path.includes('quickgraveer.synology.me') && path.includes('SYNO.FileStation.Download')) {
    try {
      console.log('Detected Synology URL with potential self-signed certificate, using curl to download');
      
      // Create a temporary file for the downloaded PDF
      const tempFilePath = `/tmp/${uuidv4()}.pdf`;
      
      // Use curl with --insecure flag to ignore SSL certificate verification
      const curlCommand = `curl --silent --insecure --location --connect-timeout 30 --max-time 50 --output "${tempFilePath}" "${path}"`;
      
      // Execute the curl command
      const { stderr } = await execPromise(curlCommand);
      
      if (stderr) {
        console.error('Curl stderr:', stderr);
      }
      
      // Check if the file was downloaded successfully
      if (fs.existsSync(tempFilePath) && fs.statSync(tempFilePath).size > 0) {
        console.log(`Successfully downloaded file to ${tempFilePath}`);
        finalPath = tempFilePath;
      } else {
        throw new Error('Failed to download file with curl');
      }
    } catch (error) {
      console.error('Error downloading from Synology:', error.message);
      throw new Error(`Failed to download from Synology: ${error.message}`);
    }
  }
  
  // Prepare the request payload
  const payload = {
    s3_url: finalPath,
    printer: printer || null,
  };

  console.log("Printing PDF:", payload);

  try {
    const response = await fetch(process.env.NODE_PRINTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to print PDF");
    }

    const data = await response.json();
    
    // Clean up temporary file if it was created
    if (finalPath !== path && finalPath.startsWith('/tmp/') && fs.existsSync(finalPath)) {
      fs.unlinkSync(finalPath);
      console.log(`Cleaned up temporary file ${finalPath}`);
    }
    
    return data;
  } catch (error) {
    // Clean up temporary file if it was created, even on error
    if (finalPath !== path && finalPath.startsWith('/tmp/') && fs.existsSync(finalPath)) {
      fs.unlinkSync(finalPath);
      console.log(`Cleaned up temporary file ${finalPath}`);
    }
    
    console.error("Error printing PDF:", error.message);
    throw error;
  }
};

export default printPDF;

// Usage examples:
// printPDF('/path/to/local/file.pdf')
// printPDF('/path/to/local/file.pdf', { printer: 'MyPrinter' })
// printPDF('s3://mybucket/path/to/file.pdf')
// printPDF('https://example.com/file.pdf', { printer: 'MyPrinter' })
