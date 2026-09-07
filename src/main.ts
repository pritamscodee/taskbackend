import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { AppModule } from './app.module.js';
import { TASKZEN_EVENTS_QUEUE } from './events/events.constants.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'https://taskzen-brown.vercel.app',
    ],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const rabbitUrl = process.env.RABBITMQ_URL;
  await app.listen(process.env.PORT ?? 3000);
  logger.log(`HTTP listening on ${process.env.PORT ?? 3000}`);

  if (rabbitUrl) {
    app.connectMicroservice({
      transport: Transport.RMQ,
      options: {
        urls: [rabbitUrl],
        queue: TASKZEN_EVENTS_QUEUE,
        queueOptions: { durable: true },
      },
    });
    void app.startAllMicroservices().catch((error) => {
      logger.warn(
        `RabbitMQ microservice did not start: ${error instanceof Error ? error.message : error}`,
      );
    });
  } else {
    logger.warn('RABBITMQ_URL is not set; realtime events are disabled');
  }
}
bootstrap();
