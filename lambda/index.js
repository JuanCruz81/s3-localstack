const AWS = require('aws-sdk');

exports.handler = async (event) => {
  console.log('Lambda received event:', JSON.stringify(event));
  console.log('ENV: LOCALSTACK_ENDPOINT=', process.env.LOCALSTACK_ENDPOINT, 'LOCALSTACK_HOSTNAME=', process.env.LOCALSTACK_HOSTNAME, 'EDGE_PORT=', process.env.EDGE_PORT, 'AWS_REGION=', process.env.AWS_REGION);

  const record = (event.Records && event.Records[0]);
  if (!record || !record.s3) {
    console.log('No S3 record found');
    return { statusCode: 400, body: 'No S3 record' };
  }

  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
  // Resolver endpoint de S3 de forma dinámica:
  // - si se define LOCALSTACK_ENDPOINT, usarlo (útil para pruebas locales fuera de contenedor)
  // - si la Lambda corre dentro de un contenedor lanzado por LocalStack, éste exporta LOCALSTACK_HOSTNAME y EDGE_PORT
  // - por defecto, usar http://localhost:4566
  const region = process.env.AWS_REGION || 'us-east-1';
  const creds = { accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test', secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test' };

  let endpoint;
  if (process.env.LOCALSTACK_ENDPOINT) {
    endpoint = process.env.LOCALSTACK_ENDPOINT;
  } else if (process.env.LOCALSTACK_HOSTNAME) {
    const port = process.env.EDGE_PORT || '4566';
    endpoint = `http://${process.env.LOCALSTACK_HOSTNAME}:${port}`;
  } else {
    endpoint = 'http://localhost:4566';
  }

  console.log('Using S3 endpoint:', endpoint);

  const s3 = new AWS.S3({ endpoint, s3ForcePathStyle: true, region, credentials: creds });

  try {
    const obj = await s3.getObject({ Bucket: bucket, Key: key }).promise();
    const body = obj.Body ? obj.Body.toString('utf-8') : '';

    // ejemplo de procesamiento: convertir contenido a MAYÚSCULAS
    const processed = body.toUpperCase();

    const destBucket = process.env.PROCESSED_BUCKET || `${bucket}-processed`;

    // asegurar que el bucket destino existe
    try {
      await s3.headBucket({ Bucket: destBucket }).promise();
    } catch (err) {
      console.log('Destino no existe, creando bucket:', destBucket);
      await s3.createBucket({ Bucket: destBucket }).promise();
    }

    const destKey = `processed-${key}`;
    await s3.putObject({ Bucket: destBucket, Key: destKey, Body: processed }).promise();

    console.log('Procesado:', `${bucket}/${key}`, '->', `${destBucket}/${destKey}`);
    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('Error procesando objeto S3:', err);
    return { statusCode: 500, body: String(err) };
  }
};
