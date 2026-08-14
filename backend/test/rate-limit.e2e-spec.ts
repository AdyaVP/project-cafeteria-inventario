/**
 * E2E — Rate limiting con la CONFIGURACION REAL (100 req / 60s).
 *
 * Se ejecuta en una BD dedicada y se espera que el request 101
 * dentro de la ventana devuelva 429 Too Many Requests.
 */
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  'mongodb://localhost:27017/cafeteria_e2e_rate?directConnection=true';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'http';

import { AppModule } from '../src/app.module';

describe('Rate limiting (configuracion real 100/60s)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('el request 101 dentro de la ventana devuelve 429', async () => {
    const agente = request.agent(server);
    let con429 = 0;
    let sin429 = 0;

    for (let i = 1; i <= 105; i += 1) {
      const res = await agente.get('/api/auth/me');
      if (res.status === 429) {
        con429 += 1;
      } else {
        sin429 += 1;
      }
      if (i >= 99 && i <= 102) console.log('req', i, '->', res.status);
    }

    expect(con429).toBeGreaterThanOrEqual(1);
    expect(sin429).toBeLessThanOrEqual(100);
  });
});
