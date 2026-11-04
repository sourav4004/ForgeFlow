import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');

  const rawPort = process.env['PORT'];
  const parsedPort = rawPort ? Number.parseInt(rawPort, 10) : 4000;
  const port =
    Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : 4000;

  await app.listen(port);
  console.log(`FlowForge API is running on: http://localhost:${port}/api/v1`);
}

bootstrap().catch((err: unknown) => {
  console.error('Failed to start FlowForge API:', err);
  process.exit(1);
});
