import {
  S3Client,
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.NODE_AWS_REGION,
  credentials: {
    accessKeyId: process.env.NODE_AWS_ACCESS_S3_KEY_ID,
    secretAccessKey: process.env.NODE_AWS_SECRET_S3_ACCESS_KEY,
  },
});

// Authentication middleware
const authenticate = (req) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.NODE_API_S3_KEY) {
    throw new Error("Unauthorized");
  }
};

// Helper function to move all objects in a folder
async function moveFolder(bucketName, oldPrefix, newPrefix) {
  // List all objects in the old folder
  const listCommand = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: oldPrefix,
  });

  const objects = await s3Client.send(listCommand);

  if (!objects.Contents || objects.Contents.length === 0) {
    throw new Error("Source folder is empty or does not exist");
  }

  // Copy each object to the new location and delete the old one
  for (const object of objects.Contents) {
    if (!object.Key) continue;

    // Calculate new key
    const newKey = object.Key.replace(oldPrefix, newPrefix);

    // Copy object to new location
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: bucketName,
        CopySource: `${bucketName}/${object.Key}`,
        Key: newKey,
      })
    );

    // Delete original object
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: object.Key,
      })
    );
  }
}

// Helper function to parse S3 URL
function parseS3Url(url) {
  try {
    let bucket;
    let prefix;

    if (url.startsWith("https://")) {
      // Handle HTTPS URL format (https://bucket-name.s3.region.amazonaws.com/path)
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // Extract bucket name from hostname
      bucket = hostname.split(".s3.")[0];

      // Remove leading slash from pathname
      prefix = urlObj.pathname.replace(/^\//, "");
    } else {
      // Handle s3:// format
      const cleanUrl = url.replace("s3://", "");
      const parts = cleanUrl.split("/");
      bucket = parts[0];
      prefix = parts.slice(1).join("/");
    }

    // Validate bucket name according to S3 naming rules
    if (!bucket.match(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)) {
      throw new Error(`Invalid bucket name: ${bucket}`);
    }

    return { bucket, prefix };
  } catch (error) {
    throw new Error(`Invalid S3 URL format: ${url}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    authenticate(req);

    const { oldUrl, newUrl } = req.body;

    // Validate input
    if (!oldUrl || !newUrl) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Parse URLs
    const oldLocation = parseS3Url(oldUrl);
    const newLocation = parseS3Url(newUrl);

    // Verify both operations are on the same bucket
    if (oldLocation.bucket !== newLocation.bucket) {
      return res.status(400).json({
        error: "Cross-bucket operations are not supported",
      });
    }

    // Move the folder
    await moveFolder(
      oldLocation.bucket,
      oldLocation.prefix,
      newLocation.prefix
    );

    return res.status(200).json({
      message: "Folder moved successfully",
      from: oldUrl,
      to: newUrl,
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(error.message === "Unauthorized" ? 401 : 500).json({
      error: error.message || "Internal server error",
    });
  }
}
