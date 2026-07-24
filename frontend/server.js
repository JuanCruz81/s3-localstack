const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');

const PORT = process.env.PORT || 3000;
const endpoint = process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566';

const s3 = new AWS.S3({
  endpoint,
  s3ForcePathStyle: true,
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test', secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test' }
});

function send404(res) { res.statusCode = 404; res.end('Not found'); }

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  
  // Health check endpoint
  if (req.method === 'GET' && parsed.pathname === '/health') {
    try {
      const bucket = process.env.BUCKET || 'mi-bucket';
      await s3.headBucket({ Bucket: bucket }).promise();
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify({ status: 'healthy', s3: 'connected', timestamp: new Date().toISOString() }));
    } catch (err) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 503;
      res.end(JSON.stringify({ status: 'unhealthy', s3: 'disconnected', error: String(err) }));
    }
    return;
  }
  
  if (req.method === 'GET' && (parsed.pathname === '/' || parsed.pathname === '/index.html')) {
    const p = path.join(__dirname, 'index.html');
    res.setHeader('Content-Type', 'text/html');
    fs.createReadStream(p).pipe(res);
    return;
  }

  if (req.method === 'GET' && parsed.pathname === '/presign') {
    const key = parsed.query.key || 'upload.bin';
    const bucket = process.env.BUCKET || 'mi-bucket';
    try {
      // ensure bucket exists
      try { await s3.headBucket({ Bucket: bucket }).promise(); } catch (e) { await s3.createBucket({ Bucket: bucket }).promise(); }
      const params = { Bucket: bucket, Key: decodeURIComponent(key), Expires: 60*60 };
      const url = await s3.getSignedUrlPromise('putObject', params);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ url }));
    } catch (err) {
      res.statusCode = 500; res.end(String(err));
    }
    return;
  }

  if (req.method === 'GET' && parsed.pathname === '/presign-get') {
    const key = parsed.query.key || 'upload.bin';
    const bucket = process.env.BUCKET || 'mi-bucket';
    try {
      const params = { Bucket: bucket, Key: decodeURIComponent(key), Expires: 60*60 };
      const url = await s3.getSignedUrlPromise('getObject', params);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ url }));
    } catch (err) { res.statusCode = 500; res.end(String(err)); }
    return;
  }

  // API: listar objetos como JSON con presigned GET
  if (req.method === 'GET' && parsed.pathname === '/api/list') {
    const bucket = process.env.BUCKET || 'mi-bucket';
    try {
      const data = await s3.listObjectsV2({ Bucket: bucket }).promise();
      const items = (data.Contents || []).map(o => ({ key: o.Key, size: o.Size, url: s3.getSignedUrl('getObject', { Bucket: bucket, Key: o.Key, Expires: 60*60 }) }));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(items));
    } catch (err) { res.statusCode = 500; res.end(String(err)); }
    return;
  }

  // UI: lista objetos y enlaces presigned (cliente simple)
  if (req.method === 'GET' && parsed.pathname === '/list') {
    const bucket = process.env.BUCKET || 'mi-bucket';
    const p = path.join(__dirname, 'list.html');
    try {
      let html = fs.readFileSync(p, 'utf8');
      html = html.replace(/__BUCKET__/g, bucket);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(html);
    } catch (err) {
      res.statusCode = 500; res.end(String(err));
    }
    return;
  }

  send404(res);
});

server.listen(PORT, () => {
  console.log(`Frontend server listening http://localhost:${PORT} (S3 endpoint: ${endpoint})`);
});
