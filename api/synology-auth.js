import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Authenticate with Synology DSM and get a session ID (SID)
 * @param {string} baseUrl - The base URL of the Synology DSM (e.g., https://quickgraveer.synology.me:5001/webapi)
 * @param {string} username - The username for authentication
 * @param {string} password - The password for authentication
 * @param {string} session - The session name (default: 'FileStation')
 * @returns {Promise<string>} - The session ID (SID)
 */
export async function getSynologySid(
  baseUrl = process.env.SYNOLOGY_BASE_URL || 'https://quickgraveer.synology.me:5001/webapi',
  username = process.env.SYNOLOGY_USERNAME || 'WebAPI',
  password = process.env.SYNOLOGY_PASSWORD || 'Wf0QzSxFUG0CQVL3s73k#@#@$!',
  session = 'FileStation'
) {
  try {
    // Ensure the baseUrl doesn't end with a trailing slash
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    
    // Extract the base part of the URL (without /webapi/entry.cgi if present)
    const baseUrlParts = cleanBaseUrl.split('/webapi');
    const authBaseUrl = baseUrlParts[0] + '/webapi';
    
    // URL encode the password
    const encodedPassword = encodeURIComponent(password);
    
    // Construct the authentication URL
    const authUrl = `${authBaseUrl}/auth.cgi?api=SYNO.API.Auth&version=6&method=login&account=${username}&passwd=${encodedPassword}&session=${session}&format=sid`;
    
    // Execute the curl command to authenticate
    const curlCommand = `curl --insecure --silent --location '${authUrl}'`;
    console.log(`Authenticating with Synology DSM: ${authUrl.replace(encodedPassword, '********')}`);
    
    const { stdout } = await execPromise(curlCommand);
    const response = JSON.parse(stdout);
    
    if (!response.success) {
      throw new Error(`Authentication failed: ${response.error?.code}`);
    }
    
    const sid = response.data?.sid;
    if (!sid) {
      throw new Error('No session ID (SID) returned from authentication');
    }
    
    console.log('Successfully authenticated with Synology DSM');
    return sid;
  } catch (error) {
    console.error('Error authenticating with Synology DSM:', error);
    throw new Error(`Failed to authenticate with Synology DSM: ${error.message}`);
  }
}

/**
 * Logout from Synology DSM
 * @param {string} baseUrl - The base URL of the Synology DSM
 * @param {string} sid - The session ID to logout
 * @returns {Promise<boolean>} - True if logout was successful
 */
export async function logoutSynology(
  baseUrl = process.env.SYNOLOGY_BASE_URL || 'https://quickgraveer.synology.me:5001/webapi',
  sid
) {
  try {
    if (!sid) {
      console.log('No SID provided for logout, skipping');
      return true;
    }
    
    // Ensure the baseUrl doesn't end with a trailing slash
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    
    // Extract the base part of the URL (without /webapi/entry.cgi if present)
    const baseUrlParts = cleanBaseUrl.split('/webapi');
    const authBaseUrl = baseUrlParts[0] + '/webapi';
    
    // Construct the logout URL
    const logoutUrl = `${authBaseUrl}/auth.cgi?api=SYNO.API.Auth&version=6&method=logout&session=FileStation&_sid=${sid}`;
    
    // Execute the curl command to logout
    const curlCommand = `curl --insecure --silent --location '${logoutUrl}'`;
    
    const { stdout } = await execPromise(curlCommand);
    const response = JSON.parse(stdout);
    
    if (!response.success) {
      console.warn(`Logout failed: ${response.error?.code}`);
      return false;
    }
    
    console.log('Successfully logged out from Synology DSM');
    return true;
  } catch (error) {
    console.error('Error logging out from Synology DSM:', error);
    return false;
  }
}
