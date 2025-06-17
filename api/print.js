import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { getSynologySid, logoutSynology } from './synology-auth';

const execPromise = promisify(exec);

const printPDF = async (path, printer) => {
  // Handle Synology URLs with self-signed certificates
  let finalPath = path;
  
  // Check if this is a synology:// protocol format
  if (typeof path === 'string' && path.startsWith('synology://')) {
    let sid = null;
    try {
      console.log('Detected Synology path format, using Synology API to download');
      
      // Convert synology:// format to full file path
      const relativePath = path.replace('synology://', '');
      const fullPath = `${process.env.SYNOLOGY_BASE_PATH || '/data/quick-opslag'}/${relativePath}`;
      console.log(`Full Synology file path: ${fullPath}`);
      
      // Create a temporary file for the downloaded PDF
      const tempFilePath = `/tmp/${uuidv4()}.pdf`;
      
      // Construct the Synology API URL
      const synologyBaseUrl = process.env.SYNOLOGY_BASE_URL || 'https://quickgraveer.synology.me:5001/webapi/entry.cgi';
      
      // Get a fresh Synology session ID for this request
      console.log('Getting fresh Synology session ID');
      sid = await getSynologySid();
      console.log('Successfully obtained Synology session ID');
      
      // Use curl with the Synology API to download the file
      const curlCommand = `curl --insecure --fail --location --connect-timeout 30 --max-time 50 --output "${tempFilePath}" "${synologyBaseUrl}?api=SYNO.FileStation.Download&version=2&method=download&path=${encodeURIComponent(fullPath)}&mode=download&_sid=${sid}"`;
      
      console.log(`Executing Synology download command: ${curlCommand}`);
      
      // Execute the curl command
      const { stdout, stderr } = await execPromise(curlCommand);
      
      if (stderr) {
        console.log('Curl stderr (this may include progress info):', stderr);
      }
      
      // Check if the file was downloaded successfully
      if (fs.existsSync(tempFilePath) && fs.statSync(tempFilePath).size > 0) {
        console.log(`Successfully downloaded file to ${tempFilePath}, size: ${fs.statSync(tempFilePath).size} bytes`);
        finalPath = tempFilePath;
        
        // Logout the session
        try {
          await logoutSynology(synologyBaseUrl, sid);
          console.log('Successfully logged out Synology session');
        } catch (logoutError) {
          console.warn(`Warning: Failed to logout Synology session: ${logoutError.message}`);
        }
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
      console.error(`Error downloading from Synology: ${error.message}`);
      
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
  // Check if this is a Synology URL (full URL format)
  else if (typeof path === 'string' && path.includes('quickgraveer.synology.me') && path.includes('SYNO.FileStation.Download')) {
    try {
      console.log('Detected Synology URL with potential self-signed certificate, using curl to download');
      
      // Create a temporary file for the downloaded PDF
      const tempFilePath = `/tmp/${uuidv4()}.pdf`;
      
      // Use curl with more verbose output and without silent flag to see what's happening
      // Add --fail flag to make curl return an error code if the HTTP status is an error
      const curlCommand = `curl --insecure --fail --location --verbose --connect-timeout 30 --max-time 50 --output "${tempFilePath}" "${path}"`;
      
      console.log(`Executing curl command: ${curlCommand}`);
      
      try {
        // Execute the curl command
        const { stdout, stderr } = await execPromise(curlCommand);
        
        console.log('Curl stdout:', stdout);
        if (stderr) {
          console.log('Curl stderr (this may include progress info):', stderr);
        }
        
        // Check if the file was downloaded successfully
        if (fs.existsSync(tempFilePath) && fs.statSync(tempFilePath).size > 0) {
          console.log(`Successfully downloaded file to ${tempFilePath}, size: ${fs.statSync(tempFilePath).size} bytes`);
          finalPath = tempFilePath;
        } else {
          throw new Error(`File download failed or file is empty: ${tempFilePath}`);
        }
      } catch (curlError) {
        console.error('Curl execution error:', curlError);
        
        // Try an alternative approach using the Synology domain without the full path
        console.log('Trying alternative download approach...');
        
        // Extract the file path and SID from the URL
        const urlParams = new URL(path).searchParams;
        const filePath = urlParams.get('path');
        const sid = urlParams.get('_sid');
        
        if (filePath && sid) {
          const altCurlCommand = `curl --insecure --fail --location --verbose --connect-timeout 30 --max-time 50 --output "${tempFilePath}" "https://quickgraveer.synology.me:5001/webapi/entry.cgi?api=SYNO.FileStation.Download&version=2&method=download&path=${encodeURIComponent(filePath)}&mode=download&_sid=${sid}"`;
          
          console.log(`Executing alternative curl command: ${altCurlCommand}`);
          
          const { stdout: altStdout, stderr: altStderr } = await execPromise(altCurlCommand);
          
          console.log('Alt curl stdout:', altStdout);
          if (altStderr) {
            console.log('Alt curl stderr:', altStderr);
          }
          
          if (fs.existsSync(tempFilePath) && fs.statSync(tempFilePath).size > 0) {
            console.log(`Successfully downloaded file with alternative approach to ${tempFilePath}, size: ${fs.statSync(tempFilePath).size} bytes`);
            finalPath = tempFilePath;
          } else {
            throw new Error(`Alternative download failed or file is empty: ${tempFilePath}`);
          }
        } else {
          throw new Error(`Could not extract necessary parameters from URL: ${path}`);
        }
      }
    } catch (error) {
      console.error('Error downloading from Synology:', error);
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
