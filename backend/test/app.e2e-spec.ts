/**
 * Smoke test — verifica que la app arranca y que los endpoints
 * protegidos rechazan sin cookie (401) con el contrato { success: false }.
 */
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  'mongodb://localhost:27017/cafeteria_e2e_smoke?directConnection=true';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';

describe('Smoke (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sin cookie, los endpoints protegidos devuelven 401 con contrato unificado', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.message).toBe('string');
  });

  it('ruta inexistente devuelve 404 con contrato unificado', async () => {
    const res = await request(app.getHttpServer()).get('/api/no-existe');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
