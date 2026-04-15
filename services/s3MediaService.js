const crypto = require("crypto");
const { GetObjectCommand, PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function createS3MediaService() {
  function getClientConfig() {
    const region = getRequiredEnv("AWS_REGION");
    const bucket = getRequiredEnv("AWS_S3_BUCKET");
    const accessKeyId = getRequiredEnv("AWS_ACCESS_KEY_ID");
    const secretAccessKey = getRequiredEnv("AWS_SECRET_ACCESS_KEY");

    return {
      region,
      bucket,
      bucketBaseUrl: process.env.AWS_S3_PUBLIC_BASE_URL || `https://${bucket}.s3.${region}.amazonaws.com`,
      client: new S3Client({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey
        }
      })
    };
  }

  return {
    async getSignedDownloadUrl(key, mimeType) {
      if (!key) {
        throw new Error("Media key is required");
      }

      const { bucket, client } = getClientConfig();

      return getSignedUrl(client, new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentType: mimeType || undefined
      }), {
        expiresIn: Number(process.env.AWS_SIGNED_URL_TTL_SECONDS || 3600)
      });
    },

    async hydrateMediaMessage(message) {
      if (message?.type !== "media" || !message.media?.storageKey) {
        return message;
      }

      const nextUrl = await this.getSignedDownloadUrl(message.media.storageKey, message.media.mimeType);

      return {
        ...message,
        media: {
          ...message.media,
          url: nextUrl
        }
      };
    },

    async uploadFile(file) {
      if (!file?.buffer || !file.originalname) {
        throw new Error("A media file is required");
      }

      const { bucket, client } = getClientConfig();
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `chat-media/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;

      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype
      }));

      const signedUrl = await getSignedUrl(client, new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentType: file.mimetype
      }), {
        expiresIn: Number(process.env.AWS_SIGNED_URL_TTL_SECONDS || 3600)
      });

      return {
        key,
        url: signedUrl
      };
    }
  };
}

module.exports = createS3MediaService;
