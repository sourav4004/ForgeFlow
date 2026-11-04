import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns HTTP 200 with service health payload', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'flowforge-api',
    });
  });

  it('GET /api/v1/nonexistent returns HTTP 404 for unknown routes', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/nonexistent');

    expect(response.status).toBe(404);
  });

  it('POST /api/v1/health returns HTTP 404 for unsupported HTTP method', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/health');

    expect(response.status).toBe(404);
  });
});
