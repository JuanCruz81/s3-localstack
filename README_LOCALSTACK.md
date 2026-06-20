# LocalStack S3 example (ubicado en ~/localstack)

Pasos rápidos:

1. Levantar LocalStack (desde cualquier carpeta):

```bash
docker-compose -f ~/localstack/docker-compose.yml up -d
```

2. Instalar dependencias Node (desde la raíz del proyecto `localstack`):

```bash
cd /Users/juancruz/localstack
npm install
```

3. Crear un archivo de prueba:

```bash
echo "hola desde LocalStack" > test.txt
```

4. Subir el archivo al bucket emulado (desde la raíz del proyecto):

```bash
node upload_s3.js test.txt
```

5. Verificar con AWS CLI:

```bash
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
aws --endpoint-url http://localhost:4566 s3 ls s3://mi-bucket
```

Nota sobre LocalStack endpoint:

LocalStack expone las APIs de AWS en `http://localhost:4566`. Si configuras
`LOCALSTACK_ENDPOINT=http://localhost:4566` o usas `--endpoint-url` en la
CLI/SDK, las llamadas irán a la emulación local en vez de a los servicios de
AWS. Esto permite probar flujos (S3, Lambda, IAM) sin usar recursos reales.


Lambda (opcional)

Si quieres probar una Lambda que se dispare al subir objetos a S3:

- Habilita Lambda en `docker-compose.yml` (ya está configurado en este repo).
- Empaqueta y despliega la Lambda de ejemplo:

```bash
./deploy_lambda.sh
```

- Luego sube un archivo para dispararla:

```bash
aws --endpoint-url http://localhost:4566 s3 cp test.txt s3://mi-bucket/
```

La Lambda de ejemplo está en `lambda/index.js` y sólo hace un `console.log` del evento.
