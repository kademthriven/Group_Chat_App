# AWS Media Setup

Use these values to connect chat media uploads to Amazon S3 with signed download URLs.

## 1. Create an S3 Bucket

Create a bucket for chat uploads, for example `group-chat-app-media`.

## 2. Bucket CORS

Set the bucket CORS configuration to allow your frontend origin. If your app runs on `localhost:4000`, use that exact origin:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["http://localhost:4000"],
    "ExposeHeaders": ["ETag"]
  }
]
```

## 3. IAM Policy

Create an IAM user with programmatic access and attach a policy like this:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```

Because the app now uses presigned `GetObject` URLs, you do not need to make the bucket or objects public.

## 4. Environment Variables

Add these to `.env`:

```env
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_SIGNED_URL_TTL_SECONDS=3600
```

## 5. Install New Packages

Run:

```bash
npm install
```

This project now expects `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, and `multer`.
