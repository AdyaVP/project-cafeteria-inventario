/**
 * E2E — Flujo completo Fase 6 (gate del Bloque 1).
 *
 * Requiere: Mongo con replica set (docker-compose.dev.yml) y
 * MONGODB_URI con directConnection=true.
 *
 * Usa una BD dedicada (cafeteria_e2e) que se limpia al iniciar.
 * El throttler se desactiva en este flujo (se prueba aparte en
 * rate-limit.e2e-spec.ts con la configuracion real).
 */
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  'mongodb://localhost:27017/cafeteria_e2e?directConnection=true';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import request from 'supertest';

import type { Server } from 'http';

import { AppModule } from '../src/app.module';
import { UsuariosService } from '../src/usuarios/usuarios.service';
import { InventarioService } from '../src/inventario/inventario.service';
import { ProductosService } from '../src/productos/productos.service';
import { RecetasService } from '../src/productos/recetas.service';
import { MesasService } from '../src/mesas/mesas.service';
import { Orden, OrdenDocument } from '../src/ordenes/schemas/orden.schema';
import { Factura, FacturaDocument } from '../src/caja/schemas/factura.schema';
import { Role } from '../src/common/constants/roles.enum';
import { Unidad } from '../src/inventario/schemas/unidad.enum';
import { ProductoTipo } from '../src/productos/schemas/producto-tipo.enum';
import { Temperatura } from '../src/productos/schemas/temperatura.enum';
import type { CreateProductoComidaDto } from '../src/productos/dto/create-producto-comida.dto';
import type { CreateProductoBebidaDto } from '../src/productos/dto/create-producto-bebida.dto';

const PASSWORD = 'Test1234';

interface Sesion {
  admin: InstanceType<typeof request.agent>;
  mesero: InstanceType<typeof request.agent>;
  cajero: InstanceType<typeof request.agent>;
  cocina: InstanceType<typeof request.agent>;
}

interface EstadoE2E {
  hamburguesa: string;
  pizza: string;
  cafe: string;
  refresco: string;
  harina: string;
  carne: string;
  mesaId: string;
  ordenCocinaId: string;
  ordenCafeteriaId: string;
  facturaId: string;
}

describe('Flujo completo Fase 6 (E2E)', () => {
  let app: INestApplication;
  let server: Server;
  let usuarios: UsuariosService;
  let inventario: InventarioService;
  let productos: ProductosService;
  let recetas: RecetasService;
  let mesas: MesasService;
  let ordenModel: Model<OrdenDocument>;
  let facturaModel: Model<FacturaDocument>;
  let sesion: Sesion;
  let estado: EstadoE2E;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(
      new (require('../src/common/filters/http-exception.filter').HttpExceptionFilter)(),
    );
    app.useGlobalInterceptors(
      new (require('../src/common/interceptors/response.interceptor').ResponseInterceptor)(),
    );
    app.use(require('cookie-parser')());
    app.use(require('express').json());
    await app.init();
    server = app.getHttpServer() as Server;

    usuarios = app.get(UsuariosService);
    inventario = app.get(InventarioService);
    productos = app.get(ProductosService);
    recetas = app.get(RecetasService);
    mesas = app.get(MesasService);
    ordenModel = app.get<Model<OrdenDocument>>(getModelToken(Orden.name));
    facturaModel = app.get<Model<FacturaDocument>>(getModelToken(Factura.name));

    const conexion = app.get(getConnectionToken());
    await conexion.dropDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(
    agente: InstanceType<typeof request.agent>,
    email: string,
  ): Promise<void> {
    const res = await agente
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    expect(res.body.data.user.email).toBe(email);
  }

  it('paso 1-6: seed inicial via servicios y login de los 4 roles', async () => {
    const adminCreado = await usuarios.crear({
      nombre: 'Admin E2E',
      email: 'admin@e2e.local',
      password: PASSWORD,
      roles: [Role.ADMIN],
    });
    expect(adminCreado.id).toBeDefined();

    for (const [nombre, email, roles] of [
      ['Mesero E2E', 'mesero@e2e.local', [Role.MESERO]],
      ['Cajero E2E', 'cajero@e2e.local', [Role.CAJERO]],
      ['Cocina E2E', 'cocina@e2e.local', [Role.COCINA]],
    ] as const) {
      await usuarios.crear({
        nombre,
        email,
        password: PASSWORD,
        roles: [...roles],
      });
    }

    const inv = await Promise.all(
      [
        {
          nombre: 'Harina',
          unidad: Unidad.KG,
          stockActual: 20,
          stockMinimo: 5,
          costoUnitario: 15,
        },
        {
          nombre: 'Queso',
          unidad: Unidad.KG,
          stockActual: 10,
          stockMinimo: 3,
          costoUnitario: 80,
        },
        {
          nombre: 'Carne molida',
          unidad: Unidad.KG,
          stockActual: 15,
          stockMinimo: 4,
          costoUnitario: 90,
        },
        {
          nombre: 'Papas',
          unidad: Unidad.KG,
          stockActual: 25,
          stockMinimo: 6,
          costoUnitario: 25,
        },
        {
          nombre: 'Salsa tomate',
          unidad: Unidad.UNIDAD,
          stockActual: 40,
          stockMinimo: 10,
          costoUnitario: 8,
        },
      ].map((item) => inventario.crear(item)),
    );
    const invById = new Map(inv.map((i) => [i.nombre, i.id]));

    const comidasDto: CreateProductoComidaDto[] = [
      {
        nombre: 'Hamburguesa',
        precio: 120,
        tipo: ProductoTipo.COMIDA,
        disponible: true,
        tiempoPreparacionMin: 8,
        calorias: 550,
        alergenos: [],
      },
      {
        nombre: 'Pizza',
        precio: 150,
        tipo: ProductoTipo.COMIDA,
        disponible: true,
        tiempoPreparacionMin: 12,
        calorias: 700,
        alergenos: [],
      },
    ];
    const comidas = await Promise.all(
      comidasDto.map((p) => productos.crear(p)),
    );
    const bebidasDto: CreateProductoBebidaDto[] = [
      {
        nombre: 'Cafe',
        precio: 45,
        tipo: ProductoTipo.BEBIDA,
        disponible: true,
        temperatura: Temperatura.CALIENTE,
        tamanosDisponibles: [{ nombre: 'Chico', precioAdicional: 0 }],
      },
      {
        nombre: 'Refresco',
        precio: 35,
        tipo: ProductoTipo.BEBIDA,
        disponible: true,
        temperatura: Temperatura.FRIA,
        tamanosDisponibles: [{ nombre: 'Chico', precioAdicional: 0 }],
      },
    ];
    const bebidas = await Promise.all(
      bebidasDto.map((p) => productos.crear(p)),
    );

    await recetas.crear({
      productoId: comidas[0].id,
      ingredientes: [
        { inventarioItemId: invById.get('Harina')!, cantidad: 0.2 },
        { inventarioItemId: invById.get('Carne molida')!, cantidad: 0.15 },
        { inventarioItemId: invById.get('Queso')!, cantidad: 0.05 },
      ],
    });
    await recetas.crear({
      productoId: comidas[1].id,
      ingredientes: [
        { inventarioItemId: invById.get('Harina')!, cantidad: 0.25 },
        { inventarioItemId: invById.get('Queso')!, cantidad: 0.15 },
        { inventarioItemId: invById.get('Salsa tomate')!, cantidad: 1 },
      ],
    });
    await Promise.all(
      comidas.map((producto) => productos.toggleDisponibilidad(producto.id)),
    );

    for (const numero of [1, 2]) {
      await mesas.crear({ numero, capacidad: 4 });
    }

    sesion = {
      admin: request.agent(server),
      mesero: request.agent(server),
      cajero: request.agent(server),
      cocina: request.agent(server),
    };

    await login(sesion.admin, 'admin@e2e.local');
    await login(sesion.mesero, 'mesero@e2e.local');
    await login(sesion.cajero, 'cajero@e2e.local');
    await login(sesion.cocina, 'cocina@e2e.local');

    estado = {
      hamburguesa: comidas[0].id,
      pizza: comidas[1].id,
      cafe: bebidas[0].id,
      refresco: bebidas[1].id,
      harina: invById.get('Harina')!,
      carne: invById.get('Carne molida')!,
      mesaId: '',
      ordenCocinaId: '',
      ordenCafeteriaId: '',
      facturaId: '',
    };
  });

  it('paso 7-8: abrir mesa y crear orden mixta (hamburguesa + cafe) = 2 docs', async () => {
    const mesasRes = await sesion.mesero.get('/api/mesas').expect(200);
    const mesa = mesasRes.body.data.find(
      (m: { numero: number }) => m.numero === 1,
    );
    expect(mesa).toBeDefined();
    estado.mesaId = mesa.id;

    const abrir = await sesion.mesero
      .patch(`/api/mesas/${mesa.id}/abrir`)
      .expect(200);
    expect(abrir.body.data.estado).toBe('OCUPADA');

    const orden = await sesion.mesero
      .post('/api/ordenes')
      .send({
        mesaId: mesa.id,
        items: [
          { productoId: estado.hamburguesa, cantidad: 2 },
          { productoId: estado.cafe, cantidad: 1 },
        ],
      })
      .expect(201);

    expect(orden.body.data).toHaveLength(2);
    const tipos = orden.body.data.map((o: { tipo: string }) => o.tipo).sort();
    expect(tipos).toEqual(['CAFETERIA', 'COCINA']);

    const docs = await ordenModel
      .find({
        _id: { $in: orden.body.data.map((o: { id: string }) => o.id) },
      })
      .exec();
    expect(docs.map((d) => d.tipo).sort()).toEqual(['CAFETERIA', 'COCINA']);

    const harina = await inventario.buscarPorId(estado.harina);
    const carne = await inventario.buscarPorId(estado.carne);
    expect(harina.stockActual).toBe(20 - 0.2 * 2);
    expect(carne.stockActual).toBe(15 - 0.15 * 2);

    estado.ordenCocinaId = orden.body.data.find(
      (o: { tipo: string }) => o.tipo === 'COCINA',
    ).id;
    estado.ordenCafeteriaId = orden.body.data.find(
      (o: { tipo: string }) => o.tipo === 'CAFETERIA',
    ).id;
  });

  it('paso 9-10: COCINA procesa ambas ordenes (COCINA y CAFETERIA)', async () => {
    const cola = await sesion.cocina.get('/api/cocina/cola').expect(200);
    const idsCola = cola.body.data.map((o: { id: string }) => o.id);
    expect(idsCola).toContain(estado.ordenCocinaId);
    expect(idsCola).toContain(estado.ordenCafeteriaId);

    for (const id of [estado.ordenCocinaId, estado.ordenCafeteriaId]) {
      const prep = await sesion.cocina
        .patch(`/api/cocina/${id}/preparacion`)
        .expect(200);
      expect(prep.body.data.estadoGeneral).toBe('EN_PREPARACION');
      const lista = await sesion.cocina
        .patch(`/api/cocina/${id}/lista`)
        .expect(200);
      expect(lista.body.data.estadoGeneral).toBe('LISTA');
    }
  });

  it('paso 11: MESERO entrega ambas ordenes', async () => {
    for (const id of [estado.ordenCocinaId, estado.ordenCafeteriaId]) {
      const entregada = await sesion.mesero
        .patch(`/api/ordenes/${id}/entregar`)
        .expect(200);
      expect(entregada.body.data.estadoGeneral).toBe('ENTREGADA');
    }

    await productos.actualizar(estado.hamburguesa, {
      nombre: 'Hamburguesa Editada',
      precio: 999,
    });
  });

  it('paso 12-13: RONDA 2 (pizza + refresco) y entrega', async () => {
    const orden2 = await sesion.mesero
      .post('/api/ordenes')
      .send({
        mesaId: estado.mesaId,
        items: [
          { productoId: estado.pizza, cantidad: 1 },
          { productoId: estado.refresco, cantidad: 2 },
        ],
      })
      .expect(201);
    expect(orden2.body.data).toHaveLength(2);

    for (const orden of orden2.body.data) {
      await sesion.cocina
        .patch(`/api/cocina/${orden.id}/preparacion`)
        .expect(200);
      await sesion.cocina.patch(`/api/cocina/${orden.id}/lista`).expect(200);
      await sesion.mesero
        .patch(`/api/ordenes/${orden.id}/entregar`)
        .expect(200);
    }

    await sesion.mesero
      .patch(`/api/mesas/${estado.mesaId}/solicitar-cuenta`)
      .expect(200);
  });

  it('paso 14-15: pre-cuenta con las DOS rondas y UNA factura', async () => {
    const pre = await sesion.cajero
      .get(`/api/caja/pre-cuenta/${estado.mesaId}`)
      .expect(200);

    const items = pre.body.data.items as Array<{
      nombre: string;
      cantidad: number;
      precioUnitario: number;
      subtotal: number;
    }>;
    const nombres = items.map((i) => i.nombre).sort();
    expect(nombres).toEqual(
      ['Cafe', 'Hamburguesa', 'Pizza', 'Refresco'].sort(),
    );

    const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
    expect(subtotal).toBe(120 * 2 + 45 + 150 + 35 * 2);
    expect(pre.body.data.subtotal).toBe(subtotal);
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nombre: 'Hamburguesa',
          precioUnitario: 120,
          cantidad: 2,
        }),
      ]),
    );
    expect(pre.body.data.impuesto).toBe(
      Math.round(subtotal * 0.15 * 100) / 100,
    );
    expect(pre.body.data.total).toBe(
      Math.round((subtotal + pre.body.data.impuesto) * 100) / 100,
    );

    const factura = await sesion.cajero
      .post('/api/caja/factura')
      .send({ mesaId: estado.mesaId, metodoPago: 'EFECTIVO' })
      .expect(201);

    const snapshot = factura.body.data.itemsSnapshot as Array<{
      nombre: string;
    }>;
    expect(snapshot.map((i) => i.nombre).sort()).toEqual(
      ['Cafe', 'Hamburguesa', 'Pizza', 'Refresco'].sort(),
    );
    expect(factura.body.data.estado).toBe('PAGADA');

    const mesaRes = await sesion.cajero.get(`/api/mesas/${estado.mesaId}`);
    expect(mesaRes.body.data.estado).toBe('LIBRE');

    estado.facturaId = factura.body.data.id;
  });

  it('paso 16-18: doble factura 400, anulacion 403/200, reporte', async () => {
    const doble = await sesion.cajero
      .post('/api/caja/factura')
      .send({ mesaId: estado.mesaId, metodoPago: 'EFECTIVO' })
      .expect(400);
    expect(doble.body.success).toBe(false);

    const anularMesero = await sesion.mesero
      .patch(`/api/caja/factura/${estado.facturaId}/anular`)
      .send({ justificacion: 'Prueba de permiso' })
      .expect(403);

    const anularAdmin = await sesion.admin
      .patch(`/api/caja/factura/${estado.facturaId}/anular`)
      .send({ justificacion: 'Error de facturacion en prueba E2E' })
      .expect(200);
    expect(anularAdmin.body.data.estado).toBe('ANULADA');

    const dobleAnulacion = await sesion.admin
      .patch(`/api/caja/factura/${estado.facturaId}/anular`)
      .send({ justificacion: 'Otra justificacion valida' })
      .expect(400);

    const fecha = new Date().toISOString().slice(0, 10);
    const reporte = await sesion.admin
      .get(`/api/caja/reportes/diario?fecha=${fecha}`)
      .expect(200);
    expect(reporte.body.data.totalCobrado).toBe(0);
    expect(reporte.body.data.mesasAtendidas).toBe(0);

    expect(anularMesero.body.success).toBe(false);
    expect(dobleAnulacion.body.success).toBe(false);
  });
});
