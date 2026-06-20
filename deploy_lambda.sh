#!/usr/bin/env bash
set -euo pipefail

# despliega la lambda en LocalStack y configura notificación S3->Lambda
ENDPOINT=${LOCALSTACK_ENDPOINT:-http://localhost:4566}
REGION=${AWS_REGION:-us-east-1}
BUCKET=${BUCKET:-mi-bucket}
FUNC_NAME=${FUNC_NAME:-local_lambda}
ZIP_FILE=lambda.zip

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI not found. Instala AWS CLI v2 antes."
  exit 1
fi

# crear zip
rm -f $ZIP_FILE
zip -j $ZIP_FILE lambda/index.js

# crear función (si ya existe, lo ignoramos)
set +e
aws --endpoint-url $ENDPOINT lambda get-function --function-name $FUNC_NAME >/dev/null 2>&1
EXISTS=$?
set -e

if [ "$EXISTS" -ne 0 ]; then
  aws --endpoint-url $ENDPOINT lambda create-function \
    --function-name $FUNC_NAME \
    --runtime nodejs14.x \
    --handler index.handler \
    --zip-file fileb://$ZIP_FILE \
    --role arn:aws:iam::000000000000:role/lambda-role \
    --region $REGION
  echo "Lambda creada: $FUNC_NAME"
else
  aws --endpoint-url $ENDPOINT lambda update-function-code \
    --function-name $FUNC_NAME \
    --zip-file fileb://$ZIP_FILE \
    --region $REGION
  echo "Lambda actualizada: $FUNC_NAME"
fi

# crear bucket procesado si no existe
PROCESSED_BUCKET=${PROCESSED_BUCKET:-${BUCKET}-processed}
set +e
aws --endpoint-url $ENDPOINT s3api head-bucket --bucket $PROCESSED_BUCKET >/dev/null 2>&1
if [ $? -ne 0 ]; then
  aws --endpoint-url $ENDPOINT s3api create-bucket --bucket $PROCESSED_BUCKET --region $REGION
  echo "Created processed bucket: $PROCESSED_BUCKET"
fi
set -e

# Dar permiso para que S3 invoque la lambda (ignorar si ya existe)
set +e
aws --endpoint-url $ENDPOINT lambda add-permission \
  --function-name $FUNC_NAME \
  --principal s3.amazonaws.com \
  --statement-id s3invoke-$(date +%s) \
  --action lambda:InvokeFunction \
  --region $REGION >/dev/null 2>&1 || true
set -e

# Configurar notificación del bucket (S3:ObjectCreated:*)
cat > /tmp/notification.json <<EOF
{
  "LambdaFunctionConfigurations": [
    {
      "LambdaFunctionArn": "arn:aws:lambda:${REGION}:000000000000:function/${FUNC_NAME}",
      "Events": ["s3:ObjectCreated:*"]
    }
  ]
}
EOF

aws --endpoint-url $ENDPOINT s3api put-bucket-notification-configuration \
  --bucket $BUCKET \
  --notification-configuration file:///tmp/notification.json \
  --region $REGION

echo "Notificación S3 -> Lambda configurada para bucket: $BUCKET -> $FUNC_NAME"

echo "Listo. Puedes subir un archivo:"
echo "  aws --endpoint-url $ENDPOINT s3 cp test.txt s3://$BUCKET/"
