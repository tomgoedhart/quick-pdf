import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getSynologySid, logoutSynology } from './synology-auth.js';
import { uploadToSynologyWithCurl, moveSynologyFileWithCurl } from './synology-curl.js';

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
  try {
    console.log(`Uploading to Synology using uploadToSynologyWithCurl: ${filePath}`);
    console.log(`File size: ${fileBuffer.length} bytes`);
    
    // Use the existing uploadToSynologyWithCurl function which is known to work
    const result = await uploadToSynologyWithCurl(fileBuffer, filePath);
    
    return {
      success: true,
      data: result.data,
      url: result.url,
      path: result.path
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
    
    console.log(`Listing files in Synology directory: ${fullDirPath}`);
    
    // Use curl command for listing which is consistent with our other operations
    const { exec } = await import('child_process');
    const execPromise = util => new Promise((resolve, reject) => {
      exec(util, (error, stdout, stderr) => {
        if (error) {
          console.error('Curl command execution error:', error.message);
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
    
    const curlCommand = `curl --insecure --silent --max-time 10 --location '${url}'`;
    const { stdout } = await execPromise(curlCommand);
    
    // Parse the response
    const response = { data: JSON.parse(stdout) };
    
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
  try {
    console.log(`Moving Synology file using moveSynologyFileWithCurl: ${oldPath} to ${newPath}`);
    
    // Use the existing moveSynologyFileWithCurl function which is known to work
    const result = await moveSynologyFileWithCurl(oldPath, newPath);
    
    return {
      success: true,
      data: result.data,
      from: result.from,
      to: result.to
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
