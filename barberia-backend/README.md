# Al clonar, en la dirección del barbería-backend:
  Para abrir prisma
  npx prisma studio


  ## Pasos para levantar el proyecto localmente
1. # Instalar dependencias:
     npm install
2. # Configurar base de datos y entorno:
  Crear un archivo .env basado en .env.example que está en el repositorio, solo le quitan el ,example al nombre del archivo, las credenciales las mandaré al grupo de wsp.

  Levantar el servicio de PostgreSQL local.
  Ejecutar las migraciones y sembrar datos de prueba:
    npx prisma migrate dev
    npx prisma db seed

  //Si no tienen instaladas las herramientas de Prisma, no funcionará, deben instalarlas.

3. # Configurar base de datos y entorno:
  Iniciar el servidor
  npm run start:dev

4. # Documentación de la API: 
  Una vez corriendo, visitar http://localhost:3000/api/docs.

  