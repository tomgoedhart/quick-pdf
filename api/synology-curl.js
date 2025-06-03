import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const execPromise = promisify(exec);

// Synology configuration
const SYNOLOGY_BASE_URL = process.env.SYNOLOGY_BASE_URL || 'https://quickgraveer.synology.me:5001/webapi/entry.cgi';
const BASE_PATH = process.env.SYNOLOGY_BASE_PATH || '/data/quick-opslag';
const SYNOLOGY_SID = process.env.SYNOLOGY_SID;

/**
 * Upload a file to Synology SharePoint using curl
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} filePath - The path where to store the file (relative to BASE_PATH)
 * @returns {Promise<Object>} - The response from the Synology API
 */
export async function uploadToSynologyWithCurl(fileBuffer, filePath) {
  try {
    if (!SYNOLOGY_SID) {
      throw new Error('Synology session ID (SID) is not configured');
    }

    // Normalize the path: remove leading slash if present
    const normalizedPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    
    // Split path into directory and filename
    const dirname = path.dirname(normalizedPath);
    const filename = path.basename(normalizedPath);
    
    // Create the full directory path
    const fullDirPath = `${BASE_PATH}/${dirname}`;
    
    // Create a temporary file to upload
    const tempFilePath = `/tmp/${filename}`;
    fs.writeFileSync(tempFilePath, fileBuffer);
    
    // Encode the path for URL
    const encodedPath = encodeURIComponent(fullDirPath);
    
    // Build the curl command with timeout parameters and specify the destination filename
    const curlCommand = `curl --silent --location --connect-timeout 30 --max-time 50 --request GET '${SYNOLOGY_BASE_URL}?api=SYNO.FileStation.Upload&version=2&method=upload&path=${encodedPath}&create_parents=true&overwrite=true&dest_file_name=${encodeURIComponent(filename)}&_sid=${SYNOLOGY_SID}' --form 'file=@"${tempFilePath}"'`;
    
    console.log(`Uploading to Synology: ${fullDirPath}/${filename}`);
    
    // Execute the curl command
    const { stdout, stderr } = await execPromise(curlCommand);
    
    // Clean up the temporary file
    fs.unlinkSync(tempFilePath);
    
    if (stderr) {
      console.error('Curl stderr:', stderr);
    }
    
    let response;
    try {
      response = JSON.parse(stdout);
    } catch (e) {
      console.error('Error parsing curl response:', e);
      console.log('Raw response:', stdout);
      response = { success: false, error: 'Failed to parse response' };
    }
    
    if (!response.success) {
      throw new Error(`Synology upload failed: ${JSON.stringify(response)}`);
    }
    
    console.log('Synology upload response:', response);
    
    // Extract the domain from SYNOLOGY_BASE_URL
    const synologyDomain = SYNOLOGY_BASE_URL.match(/https?:\/\/([^:]+)/)?.[0] || 'https://quickgraveer.synology.me';
    
    // Create a proper HTTP URL for the file
    const httpUrl = `${synologyDomain}/webapi/entry.cgi?api=SYNO.FileStation.Download&version=2&method=download&path=${encodeURIComponent(`${fullDirPath}/${filename}`)}&mode=download&_sid=${SYNOLOGY_SID}`;
    
    // Create a relative path (without BASE_PATH prefix)
    const relativePath = `${dirname}/${filename}`;
    
    console.log(`PDF file uploaded to Synology successfully ${fullDirPath}/${filename}`);
    
    return {
      success: true,
      data: response,
      url: relativePath, // Return the relative path instead of the download URL
      downloadUrl: httpUrl, // Keep the download URL as a separate property
      path: `${fullDirPath}/${filename}`,
      relativePath: relativePath
    };
  } catch (error) {
    console.error('Error uploading to Synology:', error.message);
    throw new Error(`Failed to upload to Synology: ${error.message}`);
  }
}

/**
 * Move a file or folder on Synology using curl
 * @param {string} oldPath - Source path (relative to BASE_PATH)
 * @param {string} newPath - Destination path (relative to BASE_PATH)
 * @returns {Promise<Object>} - Response from the Synology API
 */
export async function moveSynologyFileWithCurl(oldPath, newPath) {
  try {
    if (!SYNOLOGY_SID) {
      throw new Error('Synology session ID (SID) is not configured');
    }

    // Normalize paths
    const normalizedOldPath = oldPath.startsWith('/') ? oldPath.substring(1) : oldPath;
    const normalizedNewPath = newPath.startsWith('/') ? newPath.substring(1) : newPath;
    
    const fullOldPath = `${BASE_PATH}/${normalizedOldPath}`;
    const fullNewPath = `${BASE_PATH}/${normalizedNewPath}`;
    
    // Encode paths for URL
    const encodedOldPath = encodeURIComponent(fullOldPath);
    const encodedNewPath = encodeURIComponent(path.dirname(fullNewPath));
    
    // Build the curl command for moving files with timeout parameters
    const curlCommand = `curl --silent --location --connect-timeout 30 --max-time 50 --request GET '${SYNOLOGY_BASE_URL}?api=SYNO.FileStation.CopyMove&version=3&method=start&path=${encodedOldPath}&dest_folder_path=${encodedNewPath}&remove_src=true&_sid=${SYNOLOGY_SID}'`;
    
    console.log(`Moving file in Synology from: ${fullOldPath} to: ${fullNewPath}`);
    
    // Execute the curl command
    const { stdout, stderr } = await execPromise(curlCommand);
    
    if (stderr) {
      console.error('Curl stderr:', stderr);
    }
    
    let response;
    try {
      response = JSON.parse(stdout);
    } catch (e) {
      console.error('Error parsing curl response:', e);
      console.log('Raw response:', stdout);
      response = { success: false, error: 'Failed to parse response' };
    }
    
    if (!response.success) {
      throw new Error(`Synology move failed: ${JSON.stringify(response)}`);
    }
    
    return {
      success: true,
      data: response,
      from: fullOldPath,
      to: fullNewPath
    };
  } catch (error) {
    console.error('Error moving Synology file:', error.message);
    throw new Error(`Failed to move Synology file: ${error.message}`);
  }
}

/**
 * Parse a Synology URL
 * @param {string} url - The Synology URL to parse
 * @returns {Object} - The parsed URL components
 */
export function parseSynologyUrl(url) {
  try {
    if (!url) {
      throw new Error('URL is required');
    }

    // Handle synology:// format
    if (url.startsWith('synology://')) {
      const path = url.replace('synology://', '');
      return { path };
    }
    
    // Handle full path format
    if (url.startsWith(BASE_PATH)) {
      return { path: url };
    }
    
    // Handle relative path
    return { path: `${BASE_PATH}/${url}` };
  } catch (error) {
    throw new Error(`Invalid Synology URL format: ${url}`);
  }
}

/**
 * Handler for the /api/move-folder endpoint
 */
export async function moveFolder(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { oldUrl, newUrl } = req.body;

    // Validate input
    if (!oldUrl || !newUrl) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Parse URLs
    const oldLocation = parseSynologyUrl(oldUrl);
    const newLocation = parseSynologyUrl(newUrl);

    console.log('Attempting to move:', {
      oldLocation,
      newLocation
    });

    // Move the folder
    const result = await moveSynologyFileWithCurl(oldLocation.path, newLocation.path);

    return res.status(200).json({
      message: 'Folder moved successfully',
      from: oldUrl,
      to: newUrl,
      result
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
}
