import fs from 'fs';
import path from 'path';
import os from 'os';
import { uploadToSynology, listSynologyFiles, moveSynologyFile } from './synology-storage.js';
import { clearCachedSid, getSynologySid, logoutSynology } from './synology-auth.js';
import 'dotenv/config';

// Check for required environment variables
const requiredEnvVars = [
  'SYNOLOGY_BASE_URL',
  'SYNOLOGY_USERNAME',
  'SYNOLOGY_PASSWORD'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Please set these variables in your .env file before running tests');
  process.exit(1);
}

// Test configuration
const TEST_DIR = 'test-dynamic-sid';
const TEST_FILENAME = 'test-file.txt';
const TEST_CONTENT = 'test'; // Very small content for testing
const TEST_MOVE_DIR = 'test-dynamic-sid-moved';

// Create a buffer from test content
const fileBuffer = Buffer.from(TEST_CONTENT);

async function testSidGeneration() {
  console.log('Testing SID generation directly...');
  try {
    // Clear any cached SID
    clearCachedSid();
    
    // Get a fresh SID
    const sid = await getSynologySid();
    console.log('Successfully obtained SID:', sid ? 'Valid SID (hidden for security)' : 'Failed to get SID');
    
    // Logout
    if (sid) {
      await logoutSynology(process.env.SYNOLOGY_BASE_URL, sid);
      console.log('Successfully logged out');
    }
    
    return !!sid; // Return true if SID was obtained
  } catch (error) {
    console.error('SID generation test failed:', error.message);
    return false;
  }
}



async function runTests() {
  console.log('Starting Synology storage tests with dynamic SID...');
  
  try {
    // First test SID generation directly
    const sidTestPassed = await testSidGeneration();
    if (!sidTestPassed) {
      console.error('SID generation test failed. Cannot proceed with further tests.');
      return;
    }
    
    console.log('\n--- SID generation test passed. Proceeding with storage tests ---');
    
    // Clear any cached SID to ensure we're testing fresh SID generation
    clearCachedSid();
    
    // Test 1: Upload a file
    console.log(`\n--- Test 1: Uploading file to ${TEST_DIR}/${TEST_FILENAME} ---`);
    const tempFilePath = path.join(os.tmpdir(), TEST_FILENAME);
    fs.writeFileSync(tempFilePath, fileBuffer);
    console.log(`Created test file at ${tempFilePath} with content length: ${fileBuffer.length}`);
    
    // Set a timeout for the upload operation
    try {
      console.log('Starting upload with 15-second timeout...');
      // Convert file to buffer for upload
      const fileBuffer = fs.readFileSync(tempFilePath);
      const uploadPromise = uploadToSynology(fileBuffer, `${TEST_DIR}/${TEST_FILENAME}`, 'text/plain');
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Upload operation timed out after 15 seconds')), 15000);
      });
      
      // Race the upload against the timeout
      const uploadResult = await Promise.race([uploadPromise, timeoutPromise]);
      console.log('Upload completed successfully!');
      console.log('Upload result:', uploadResult);
      
      if (!uploadResult || !uploadResult.success) {
        console.error('Upload test failed: Result indicates failure');
        return;
      }
    } catch (error) {
      console.error('Upload test failed:', error.message);
      console.error('Error details:', error.stack || 'No stack trace available');
      return;
    }
    
    // Test 2: List files in the directory
    console.log(`\n--- Test 2: Listing files in ${TEST_DIR} ---`);
    const listResult = await listSynologyFiles(TEST_DIR);
    console.log('List result:', JSON.stringify(listResult, null, 2));
    
    // Test 3: Move the file
    console.log(`\n--- Test 3: Moving file from ${TEST_DIR}/${TEST_FILENAME} to ${TEST_MOVE_DIR}/${TEST_FILENAME} ---`);
    try {
      // First, create the destination directory
      console.log(`Creating destination directory: ${TEST_MOVE_DIR}`);
      
      // Use uploadToSynology with an empty file to create the directory
      const emptyBuffer = Buffer.from('');
      const dirMarkerFile = `${TEST_MOVE_DIR}/.dir_marker`;
      await uploadToSynology(emptyBuffer, dirMarkerFile, 'text/plain');
      console.log(`Destination directory created: ${TEST_MOVE_DIR}`);
      
      // Now attempt the move operation
      const moveResult = await moveSynologyFile(`${TEST_DIR}/${TEST_FILENAME}`, `${TEST_MOVE_DIR}/${TEST_FILENAME}`);
      console.log('Move result:', JSON.stringify(moveResult, null, 2));
      
      // Test 4: List files in the new directory to confirm move
      console.log(`\n--- Test 4: Listing files in ${TEST_MOVE_DIR} to confirm move ---`);
      const listMovedResult = await listSynologyFiles(TEST_MOVE_DIR);
      console.log('List moved result:', JSON.stringify(listMovedResult, null, 2));
    } catch (error) {
      console.error('Move test failed:', error.message);
      return;
    }
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the tests
runTests();
