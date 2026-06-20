// Runner de depuración para la Lambda
// Usage: node lambda/debug-runner.js    -> ejecuta sin inspector
//        node --inspect-brk lambda/debug-runner.js  -> espera attach del debugger

const path = require('path');
const handler = require('./index').handler;

(async () => {
  // evento S3 sintético usado en las pruebas
  const event = {
    Records: [
      {
        s3: {
          bucket: { name: process.env.DEBUG_BUCKET || 'mi-bucket' },
          object: { key: process.env.DEBUG_KEY || 'test.txt' }
        }
      }
    ]
  };

  console.log('Debug runner: calling handler with event:', JSON.stringify(event));
  // punto de interrupción programático (compatible con attach de debugger)
  debugger;

  try {
    const res = await handler(event);
    console.log('Handler result:', res);
    process.exit(0);
  } catch (err) {
    console.error('Handler error:', err);
    process.exit(2);
  }
})();
