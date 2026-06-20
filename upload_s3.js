const { S3Client, CreateBucketCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");

const endpoint = process.env.LOCALSTACK_ENDPOINT || "http://localhost:4566";
const region = process.env.AWS_REGION || "us-east-1";

const client = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

async function main() {
  const bucket = process.env.BUCKET || "mi-bucket";
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log("Bucket created:", bucket);
  } catch (e) {
    if ((e && e.name) !== 'BucketAlreadyOwnedByYou') {
      console.error('CreateBucket error:', e && e.name ? e.name : e);
    }
  }
  const filePath = process.argv[2] || "test.txt";
  if (!fs.existsSync(filePath)) {
    console.error("File not found:", filePath);
    process.exit(1);
  }
  const body = fs.createReadStream(filePath);
  const key = path.basename(filePath);
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
  }));
  console.log("Uploaded", filePath, "to", bucket);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
