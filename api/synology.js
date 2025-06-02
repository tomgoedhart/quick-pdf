import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

// Initialize Synology client configuration
const SYNOLOGY_BASE_URL = 'https://quickgraveer.synology.me:5001/webapi/entry.cgi';
const SYNOLOGY_API = 'SYNO.FileStation.Upload';
const SYNOLOGY_VERSION = '2';
const SYNOLOGY_METHOD = 'upload';
const BASE_PATH = '/data/quick-opslag';

/**
 * Upload a file to Synology SharePoint
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} path - The path where to store the file (relative to BASE_PATH)
 * @param {string} filename - The name of the file
 * @param {string} sid - The session ID for authentication
 * @returns {Promise<Object>} - The response from the Synology API
 */
export async function uploadToSynology(fileBuffer, path, filename, sid) {
  try {
    // Ensure path starts with a slash if not empty
    if (path && !path.startsWith('/')) {
      path = '/' + path;
    }

    // Create the full path
    const fullPath = `${BASE_PATH}${path}`;
    
    // Create form data
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: filename,
      contentType: 'application/pdf'
    });

    // Build the URL
    const url = `${SYNOLOGY_BASE_URL}?api=${SYNOLOGY_API}&version=${SYNOLOGY_VERSION}&method=${SYNOLOGY_METHOD}&path=${encodeURIComponent(fullPath)}&create_parents=true&overwrite=true&_sid=${sid}`;
    
    console.log(`Uploading to Synology: ${fullPath}/${filename}`);
    
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
    
    return {
      success: true,
      data: response.data,
      url: `${fullPath}/${filename}`
    };
  } catch (error) {
    console.error('Error uploading to Synology:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    
    throw new Error(`Failed to upload to Synology: ${error.message}`);
  }
}

/**
 * Test function to upload a file to Synology SharePoint
 * @param {string} filePath - Path to the local file to upload
 * @param {string} remotePath - Path on Synology where to store the file
 * @param {string} sid - The session ID for authentication
 * @returns {Promise<Object>} - The response from the Synology API
 */
export async function testSynologyUpload(filePath, remotePath, sid) {
  try {
    // Read file from disk
    const fileBuffer = fs.readFileSync(filePath);
    const filename = filePath.split('/').pop();
    
    return await uploadToSynology(fileBuffer, remotePath, filename, sid);
  } catch (error) {
    console.error('Error in test upload:', error);
    throw error;
  }
}

/**
 * Handler for the /api/test-synology endpoint
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { filePath, remotePath, sid } = req.body;

    // Validate input
    if (!filePath || !remotePath || !sid) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        message: 'filePath, remotePath, and sid are required'
      });
    }

    const result = await testSynologyUpload(filePath, remotePath, sid);
    
    return res.status(200).json({
      message: 'File uploaded successfully',
      result
    });
  } catch (error) {
    console.error('Error in handler:', error);
    return res.status(500).json({
      error: 'Failed to upload file',
      message: error.message
    });
  }
}
