/**
 * E2E WebSocket — verifica el requisito de Fase 6 paso 22:
 * "el mesero recibe notificacion WebSocket cuando la orden queda lista".
 *
 * Usa 2 clientes Socket.io reales autenticados con cookie (MESERO + COCINA).
 * - El MESERO DEBE recibir `orden-actualizada` con nuevoEstado LISTA
 *   para la orden de SU mesa (room user:{id}).
 * - Un COCINA recibe el mismo evento por el room de cocina.
 */
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  'mongodb://localhost:27017/cafeteria_e2e_ws?directConnection=true';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { getConnectionToken } from '@nestjs/mongoose';
import request from 'supertest';
import { io, Socket as ClientSocket } from 'socket.io-client';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { UsuariosService } from '../src/usuarios/usuarios.service';
import { InventarioService } from '../src/inventario/inventario.service';
import { ProductosService } from '../src/productos/productos.service';
import { RecetasService } from '../src/productos/recetas.service';
import { MesasService } from '../src/mesas/mesas.service';
import { Role } from '../src/common/constants/roles.enum';
import { Unidad } from '../src/inventario/schemas/unidad.enum';
import { ProductoTipo } from '../src/productos/schemas/producto-tipo.enum';

const PASSWORD = 'Test1234';

interface EventoOrdenActualizada {
  ordenId: string;
  mesaId: string;
  mesaNumero: number;
  meseroId: string;
  tipo: string;
  nuevoEstado: string;
  timestamp: string;
}

describe('WebSocket mesero recibe orden LISTA (Fase 6 paso 22)', () => {
  let app: INestApplication;
  let server: Server;
  let usuarios: UsuariosService;
  let inventario: InventarioService;
  let productos: ProductosService;
  let recetas: RecetasService;
  let mesas: MesasService;

  let meseroId: string;
  let meseroCookie: string;
  let cocinaCookie: string;
  let mesaId: string;
  let productoId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(require('cookie-parser')());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.listen(0);
    server = app.getHttpServer() as Server;

    const conexion = app.get(getConnectionToken());
    await conexion.dropDatabase();

    usuarios = app.get(UsuariosService);
    inventario = app.get(InventarioService);
    productos = app.get(ProductosService);
    recetas = app.get(RecetasService);
    mesas = app.get(MesasService);

    const mesero = await usuarios.crear({
      nombre: 'Mesero WS',
      email: 'mesero-ws@e2e.local',
      password: PASSWORD,
      roles: [Role.MESERO],
    });
    meseroId = mesero.id;

    await usuarios.crear({
      nombre: 'Cocina WS',
      email: 'cocina-ws@e2e.local',
      password: PASSWORD,
      roles: [Role.COCINA],
    });

    const ingrediente = await inventario.crear({
      nombre: 'Insumo WS',
      unidad: Unidad.UNIDAD,
      stockActual: 50,
      stockMinimo: 5,
      costoUnitario: 5,
    });

    const producto = await productos.crear({
      nombre: 'Producto WS',
      precio: 100,
      tipo: ProductoTipo.COMIDA,
      disponible: true,
      tiempoPreparacionMin: 5,
      calorias: 300,
      alergenos: [],
    });
    productoId = producto.id;

    await recetas.crear({
      productoId: producto.id,
      ingredientes: [{ inventarioItemId: ingrediente.id, cantidad: 1 }],
    });

    const mesa = await mesas.crear({ numero: 88, capacidad: 4 });
    mesaId = mesa.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginYExtraerCookie(
    email: string,
  ): Promise<{ cookie: string }> {
    const res = await request(server)
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const accessToken = setCookie
      .find((c) => c.startsWith('access_token='))
      ?.split(';')[0];
    if (!accessToken) throw new Error('Cookie access_token no recibida');
    return { cookie: accessToken };
  }

  function conectarSocket(cookie: string): ClientSocket {
    const port = (server.address() as AddressInfo).port;
    return io(`http://127.0.0.1:${port}/cocina`, {
      transports: ['websocket'],
      reconnectionAttempts: 0,
      extraHeaders: { Cookie: cookie },
    });
  }

  function esperarEvento(
    socket: ClientSocket,
    evento: string,
    estadoEsperado?: string,
    timeoutMs = 5000,
  ): Promise<EventoOrdenActualizada> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Timeout esperando ${evento}`)),
        timeoutMs,
      );
      const handler = (payload: EventoOrdenActualizada): void => {
        if (estadoEsperado && payload.nuevoEstado !== estadoEsperado) return;
        clearTimeout(timeout);
        socket.off(evento, handler);
        resolve(payload);
      };
      socket.on(evento, handler);
    });
  }

  it('MESERO recibe orden-actualizada LISTA de su orden y COCINA tambien', async () => {
    const sesionMesero = await loginYExtraerCookie('mesero-ws@e2e.local');
    const sesionCocina = await loginYExtraerCookie('cocina-ws@e2e.local');
    meseroCookie = sesionMesero.cookie;
    cocinaCookie = sesionCocina.cookie;

    const socketMesero = conectarSocket(meseroCookie);
    const socketCocina = conectarSocket(cocinaCookie);

    await Promise.all([
      new Promise<void>((resolve) => socketMesero.on('connect', () => resolve())),
      new Promise<void>((resolve) => socketCocina.on('connect', () => resolve())),
    ]);

    const promesaMesero = esperarEvento(socketMesero, 'orden-actualizada', 'LISTA');
    const promesaCocina = esperarEvento(socketCocina, 'orden-actualizada', 'LISTA');

    // MESERO abre mesa y crea orden (via HTTP)
    const agenteMesero = request.agent(server);
    await agenteMesero
      .post('/api/auth/login')
      .send({ email: 'mesero-ws@e2e.local', password: PASSWORD })
      .expect(200);

    await agenteMesero.patch(`/api/mesas/${mesaId}/abrir`).expect(200);

    const orden = await agenteMesero
      .post('/api/ordenes')
      .send({ mesaId, items: [{ productoId, cantidad: 1 }] })
      .expect(201);
    const ordenId = orden.body.data[0].id;

    // COCINA marca LISTA
    const agenteCocina = request.agent(server);
    await agenteCocina
      .post('/api/auth/login')
      .send({ email: 'cocina-ws@e2e.local', password: PASSWORD })
      .expect(200);
    await agenteCocina.patch(`/api/cocina/${ordenId}/preparacion`).expect(200);
    await agenteCocina.patch(`/api/cocina/${ordenId}/lista`).expect(200);

    const [eventoMesero, eventoCocina] = await Promise.all([
      promesaMesero,
      promesaCocina,
    ]);

    expect(eventoMesero.ordenId).toBe(ordenId);
    expect(eventoMesero.nuevoEstado).toBe('LISTA');
    expect(eventoMesero.meseroId).toBe(meseroId);
    expect(eventoMesero.mesaId).toBe(mesaId);
    expect(eventoMesero.mesaNumero).toBe(88);

    expect(eventoCocina.ordenId).toBe(ordenId);
    expect(eventoCocina.nuevoEstado).toBe('LISTA');

    socketMesero.disconnect();
    socketCocina.disconnect();
  });

  it('un tercer MESERO distinto NO recibe la notificacion de la orden ajena', async () => {
    const otroMesero = await usuarios.crear({
      nombre: 'Otro Mesero WS',
      email: 'otro-mesero-ws@e2e.local',
      password: PASSWORD,
      roles: [Role.MESERO],
    });

    const sesionOtro = await loginYExtraerCookie('otro-mesero-ws@e2e.local');
    const socketOtro = conectarSocket(sesionOtro.cookie);
    await new Promise<void>((resolve) => socketOtro.on('connect', () => resolve()));

    // Mesa nueva para este test
    const mesaNueva = await mesas.crear({ numero: 89, capacidad: 4 });

    // Crear una orden para el mesero original y marcarla lista
    const agenteMesero = request.agent(server);
    await agenteMesero
      .post('/api/auth/login')
      .send({ email: 'mesero-ws@e2e.local', password: PASSWORD })
      .expect(200);
    await agenteMesero.patch(`/api/mesas/${mesaNueva.id}/abrir`).expect(200);

    const orden = await agenteMesero
      .post('/api/ordenes')
      .send({ mesaId: mesaNueva.id, items: [{ productoId, cantidad: 1 }] })
      .expect(201);
    const ordenId = orden.body.data[0].id;

    const agenteCocina = request.agent(server);
    await agenteCocina
      .post('/api/auth/login')
      .send({ email: 'cocina-ws@e2e.local', password: PASSWORD })
      .expect(200);
    await agenteCocina.patch(`/api/cocina/${ordenId}/preparacion`).expect(200);

    let recibioEvento = false;
    socketOtro.on('orden-actualizada', () => {
      recibioEvento = true;
    });

    await agenteCocina.patch(`/api/cocina/${ordenId}/lista`).expect(200);

    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(recibioEvento).toBe(false);

    socketOtro.disconnect();
  });
});
