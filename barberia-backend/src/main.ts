import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Permitir peticiones desde la app de Angular
  app.enableCors({
    origin: 'http://localhost:4200',
    credentials: true,
  });

  // --- CONFIGURACIÓN DE SWAGGER ---
  const config = new DocumentBuilder()
    .setTitle('API Barbería Corte-26')
    .setDescription('Documentación de los endpoints para el equipo de frontend')
    .setVersion('1.0')
    .addBearerAuth() // Permite probar el JWT desde la web
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  // --------------------------------

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Backend corriendo en http://localhost:${port}`);
  console.log(`Documentación en http://localhost:${port}/api/docs`);
  }
  bootstrap();  