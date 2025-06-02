import "dotenv/config";
import { testSynologyUpload } from './synology.js';

// This is a test script to verify Synology upload functionality

// Replace these with actual values for testing
const testFilePath = process.argv[2]; // Pass the file path as the first argument
const testRemotePath = process.argv[3] || '/Klanten/K/Kees Broersen/2025/Facturen/TEST'; // Default test path
const sid = process.argv[4]; // Pass the SID as the third argument

if (!testFilePath) {
  console.error('Error: File path argument is required');
  console.log('Usage: node test-synology-upload.js <file-path> [remote-path] [sid]');
  process.exit(1);
}

if (!sid) {
  console.error('Error: Synology session ID (sid) is required');
  console.log('Usage: node test-synology-upload.js <file-path> [remote-path] <sid>');
  process.exit(1);
}

console.log(`Testing Synology upload with file: ${testFilePath}`);
console.log(`Remote path: ${testRemotePath}`);

async function runTest() {
  try {
    const result = await testSynologyUpload(testFilePath, testRemotePath, sid);
    console.log('Upload successful!');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

runTest();
