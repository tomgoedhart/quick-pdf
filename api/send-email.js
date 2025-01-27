import sgMail from '@sendgrid/mail';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { authenticate } from '../utils/auth';

// Initialize S3 client with environment variables
const s3Client = new S3Client({
  region: process.env.NODE_AWS_REGION,
  credentials: {
    accessKeyId: process.env.NODE_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.NODE_AWS_SECRET_ACCESS_KEY
  }
});

// Initialize SendGrid with environment variable
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Helper function to parse S3 URL (reuse from move-folder.js)
function parseS3Url(url) {
  try {
    let bucket;
    let prefix;

    if (url.startsWith('https://')) {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      bucket = hostname.split('.s3.')[0];
      prefix = urlObj.pathname.replace(/^\//, '');
    } else {
      const cleanUrl = url.replace('s3://', '');
      const parts = cleanUrl.split('/');
      bucket = parts[0];
      prefix = parts.slice(1).join('/');
    }

    return { bucket, prefix };
  } catch (error) {
    throw new Error(`Invalid S3 URL format: ${url}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    authenticate(req);

    const { attachment, email, from_email, subject, message } = req.body;

    // Validate inputs
    if (!attachment || !email || !from_email || !subject || !message) {
      return res.status(400).json({ 
        error: 'Missing required parameters' 
      });
    }

    // Parse S3 URL and get the file
    const { bucket, prefix } = parseS3Url(attachment);
    
    let s3Response;
    try {
      const getObjectCommand = new GetObjectCommand({
        Bucket: bucket,
        Key: prefix
      });

      s3Response = await s3Client.send(getObjectCommand);
    } catch (s3Error) {
      console.error('S3 Error:', s3Error);
      
      // Handle specific S3 errors
      if (s3Error.name === 'NoSuchKey') {
        return res.status(404).json({ 
          error: 'The specified file does not exist in S3' 
        });
      }
      if (s3Error.name === 'AccessDenied') {
        return res.status(403).json({ 
          error: 'Access denied to S3 file. Please check AWS credentials and permissions' 
        });
      }
      if (s3Error.name === 'NoSuchBucket') {
        return res.status(404).json({ 
          error: 'The specified S3 bucket does not exist' 
        });
      }
      
      // Generic S3 error
      return res.status(500).json({ 
        error: 'Error accessing S3 file',
        details: s3Error.message
      });
    }

    // Validate content type (optional but recommended)
    const contentType = s3Response.ContentType;
    if (contentType && !contentType.includes('pdf')) {
      return res.status(400).json({ 
        error: 'Invalid file type. Only PDF files are supported' 
      });
    }

    // Convert stream to buffer
    try {
      const chunks = [];
      for await (const chunk of s3Response.Body) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);

      // Prepare email with attachment
      const msg = {
        to: email,
        from: {
          email: from_email,
          name: 'Your Company Name'
        },
        subject: subject,
        text: message,
        html: message.replace(/\n/g, '<br>'),
        attachments: [
          {
            content: fileBuffer.toString('base64'),
            filename: prefix.split('/').pop(),
            type: 'application/pdf',
            disposition: 'attachment'
          }
        ]
      };

      // Send email
      try {
        await sgMail.send(msg);
      } catch (emailError) {
        console.error('SendGrid Error:', emailError);
        if (emailError.response) {
          return res.status(400).json({ 
            error: 'Email sending failed',
            details: emailError.response.body
          });
        }
        throw emailError;
      }

      return res.status(200).json({ 
        message: 'Email sent successfully' 
      });

    } catch (streamError) {
      console.error('Stream Error:', streamError);
      return res.status(500).json({ 
        error: 'Error processing file stream',
        details: streamError.message
      });
    }

  } catch (error) {
    console.error('General Error:', error);
    return res.status(error.message === 'Unauthorized' ? 401 : 500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
} 