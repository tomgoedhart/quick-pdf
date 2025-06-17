import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { getSynologySid, logoutSynology } from './synology-auth.js';

// Initialize Synology client configuration
const SYNOLOGY_BASE_URL = process.env.SYNOLOGY_BASE_URL || 'https://quickgraveer.synology.me:5001/webapi/entry.cgi';
const SYNOLOGY_API = 'SYNO.FileStation.Upload';
const SYNOLOGY_VERSION = '2';
const SYNOLOGY_METHOD = 'upload';
const BASE_PATH = process.env.SYNOLOGY_BASE_PATH || '/data/quick-opslag';

/**
 * Upload a file to Synology SharePoint
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} filePath - The path where to store the file (relative to BASE_PATH)
 * @param {string} contentType - The content type of the file
 * @returns {Promise<Object>} - The response from the Synology API
 */
export async function uploadToSynology(fileBuffer, filePath, contentType = 'application/pdf') {
  let sid = null;
  try {
    // Get a fresh Synology SID
    sid = await getSynologySid();

    // Normalize the path: remove leading slash if present
    const normalizedPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    
    // Split path into directory and filename
    const dirname = path.dirname(normalizedPath);
    const filename = path.basename(normalizedPath);
    
    // Create the full directory path
    const fullDirPath = `${BASE_PATH}/${dirname}`;
    
    // Create form data
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: filename,
      contentType: contentType
    });

    // Build the URL with proper encoding
    const url = `${SYNOLOGY_BASE_URL}?api=${SYNOLOGY_API}&version=${SYNOLOGY_VERSION}&method=${SYNOLOGY_METHOD}&path=${encodeURIComponent(fullDirPath)}&create_parents=true&overwrite=true&_sid=${sid}`;
    
    console.log(`Uploading to Synology: ${fullDirPath}/${filename}`);
    
    // Get the form data as a buffer to calculate content length
    const formBuffer = await new Promise((resolve, reject) => {
      formData.getBuffer((err, buffer) => {
        if (err) reject(err);
        else resolve(buffer);
      });
    });
    
    // Make the request with explicit Content-Length header
    const response = await axios({
      method: 'post',
      url: url,
      data: formData,
      headers: {
        ...formData.getHeaders(),
        'Content-Length': formBuffer.length.toString()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    console.log('Synology upload response:', response.data);
    
    // Logout the Synology session
    await logoutSynology(SYNOLOGY_BASE_URL, sid);
    
    return {
      success: true,
      data: response.data,
      url: `synology://${fullDirPath}/${filename}`,
      path: `${fullDirPath}/${filename}`
    };
  } catch (error) {
    console.error('Error uploading to Synology:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    
    // Attempt to logout if we have a SID
    if (sid) {
      try {
        await logoutSynology(SYNOLOGY_BASE_URL, sid);
      } catch (logoutError) {
        console.error('Error logging out from Synology:', logoutError.message);
      }
    }
    
    throw new Error(`Failed to upload to Synology: ${error.message}`);
  }
}

/**
 * List files in a directory on Synology
 * @param {string} dirPath - Directory path to list (relative to BASE_PATH)
 * @returns {Promise<Array>} - List of files in the directory
 */
export async function listSynologyFiles(dirPath) {
  let sid = null;
  try {
    // Get a fresh Synology SID
    sid = await getSynologySid();

    // Normalize the path
    const normalizedPath = dirPath.startsWith('/') ? dirPath.substring(1) : dirPath;
    const fullDirPath = `${BASE_PATH}/${normalizedPath}`;

    // Build the URL for listing files
    const url = `${SYNOLOGY_BASE_URL}?api=SYNO.FileStation.List&version=2&method=list&folder_path=${encodeURIComponent(fullDirPath)}&_sid=${sid}`;
    
    const response = await axios.get(url);
    
    // Logout the Synology session
    await logoutSynology(SYNOLOGY_BASE_URL, sid);
    
    return response.data;
  } catch (error) {
    console.error('Error listing Synology files:', error.message);
    
    // Attempt to logout if we have a SID
    if (sid) {
      try {
        await logoutSynology(SYNOLOGY_BASE_URL, sid);
      } catch (logoutError) {
        console.error('Error logging out from Synology:', logoutError.message);
      }
    }
    
    throw new Error(`Failed to list Synology files: ${error.message}`);
  }
}

/**
 * Move a file or folder on Synology
 * @param {string} oldPath - Source path (relative to BASE_PATH)
 * @param {string} newPath - Destination path (relative to BASE_PATH)
 * @returns {Promise<Object>} - Response from the Synology API
 */
export async function moveSynologyFile(oldPath, newPath) {
  let sid = null;
  try {
    // Get a fresh Synology SID
    sid = await getSynologySid();

    // Normalize paths
    const normalizedOldPath = oldPath.startsWith('/') ? oldPath.substring(1) : oldPath;
    const normalizedNewPath = newPath.startsWith('/') ? newPath.substring(1) : newPath;
    
    const fullOldPath = `${BASE_PATH}/${normalizedOldPath}`;
    const fullNewPath = `${BASE_PATH}/${normalizedNewPath}`;

    // Build the URL for moving files
    const url = `${SYNOLOGY_BASE_URL}?api=SYNO.FileStation.CopyMove&version=3&method=start&path=${encodeURIComponent(fullOldPath)}&dest_folder_path=${encodeURIComponent(path.dirname(fullNewPath))}&remove_src=true&_sid=${sid}`;
    
    const response = await axios.get(url);
    
    // Logout the Synology session
    await logoutSynology(SYNOLOGY_BASE_URL, sid);
    
    return {
      success: true,
      data: response.data,
      from: fullOldPath,
      to: fullNewPath
    };
  } catch (error) {
    console.error('Error moving Synology file:', error.message);
    
    // Attempt to logout if we have a SID
    if (sid) {
      try {
        await logoutSynology(SYNOLOGY_BASE_URL, sid);
      } catch (logoutError) {
        console.error('Error logging out from Synology:', logoutError.message);
      }
    }
    
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
    const result = await moveSynologyFile(oldLocation.path, newLocation.path);

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
