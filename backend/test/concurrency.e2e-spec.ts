/**
 * Integration — Concurrencia real sobre Mongo (requiere replica set).
 *
 * Verifica que la transaccion de crearOrden impide el overbooking:
 * stock 6, dos ordenes concurrentes consumiendo 4 cada una →
 * una commitea, la otra es rechazada, stock final 2.
 * Tambien verifica el CAS de abrirMesa (una sola apertura gana).
 */
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  'mongodb://localhost:27017/cafeteria_e2e_conc?directConnection=true';

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { AppModule } from '../src/app.module';
import { UsuariosService } from '../src/usuarios/usuarios.service';
import { InventarioService } from '../src/inventario/inventario.service';
import { ProductosService } from '../src/productos/productos.service';
import { RecetasService } from '../src/productos/recetas.service';
import { MesasService } from '../src/mesas/mesas.service';
import { OrdenesService } from '../src/ordenes/ordenes.service';
import { Orden, OrdenDocument } from '../src/ordenes/schemas/orden.schema';
import {
  InventarioItem,
  InventarioItemDocument,
} from '../src/inventario/schemas/inventario-item.schema';
import { Role } from '../src/common/constants/roles.enum';
import { Unidad } from '../src/inventario/schemas/unidad.enum';
import { ProductoTipo } from '../src/productos/schemas/producto-tipo.enum';
import { Temperatura } from '../src/productos/schemas/temperatura.enum';
import { MesaEstado } from '../src/mesas/schemas/mesa.schema';
import { OrdenEstado } from '../src/ordenes/schemas/orden-estado.enum';
import { ItemEstado } from '../src/ordenes/schemas/item-estado.enum';

const PASSWORD = 'Test1234';

describe('Concurrencia (integration)', () => {
  let moduleRef: TestingModule;
  let usuarios: UsuariosService;
  let inventario: InventarioService;
  let productos: ProductosService;
  let recetas: RecetasService;
  let mesas: MesasService;
  let ordenes: OrdenesService;
  let ordenModel: Model<OrdenDocument>;
  let itemModel: Model<InventarioItemDocument>;

  let meseroId: string;
  let mesaId: string;
  let productoId: string;
  let ingredienteId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    usuarios = app.get(UsuariosService);
    inventario = app.get(InventarioService);
    productos = app.get(ProductosService);
    recetas = app.get(RecetasService);
    mesas = app.get(MesasService);
    ordenes = app.get(OrdenesService);
    ordenModel = app.get<Model<OrdenDocument>>(getModelToken(Orden.name));
    itemModel = app.get<Model<InventarioItemDocument>>(
      getModelToken(InventarioItem.name),
    );

    const conexion = app.get('DatabaseConnection') as {
      dropDatabase: () => Promise<void>;
    };
    await conexion.dropDatabase();

    // Setup: mesero + mesa LIBRE + producto COMIDA con receta de 4 unidades
    const mesero = await usuarios.crear({
      nombre: 'Mesero Conc',
      email: 'mesero-conc@e2e.local',
      password: PASSWORD,
      roles: [Role.MESERO],
    });
    meseroId = mesero.id;

    const ingrediente = await inventario.crear({
      nombre: 'Insumo Concurrencia',
      unidad: Unidad.UNIDAD,
      stockActual: 6,
      stockMinimo: 1,
      costoUnitario: 5,
    });
    ingredienteId = ingrediente.id;

    const producto = await productos.crear({
      nombre: 'Producto Concurrencia',
      precio: 100,
      tipo: ProductoTipo.COMIDA,
      disponible: true,
      tiempoPreparacionMin: 5,
      calorias: 400,
      alergenos: [],
    });
    productoId = producto.id;

    await recetas.crear({
      productoId: producto.id,
      ingredientes: [{ inventarioItemId: ingrediente.id, cantidad: 4 }],
    });
    await productos.toggleDisponibilidad(producto.id);

    const mesa = await mesas.crear({ numero: 99, capacidad: 4 });
    mesaId = mesa.id;
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('dos ordenes concurrentes consumiendo 4 de stock 6: solo una gana', async () => {
    await mesas.abrirMesa(mesaId, meseroId);

    const resultados = await Promise.allSettled([
      ordenes.crearOrden(
        { mesaId, items: [{ productoId, cantidad: 1 }] },
        meseroId,
      ),
      ordenes.crearOrden(
        { mesaId, items: [{ productoId, cantidad: 1 }] },
        meseroId,
      ),
    ]);

    const exitos = resultados.filter((r) => r.status === 'fulfilled').length;
    const rechazados = resultados.filter((r) => r.status === 'rejected').length;

    expect(exitos).toBe(1);
    expect(rechazados).toBe(1);

    const item = await itemModel.findById(ingredienteId).exec();
    expect(item?.stockActual).toBe(2);

    const docs = await ordenModel
      .countDocuments({ mesa: new Types.ObjectId(mesaId) })
      .exec();
    expect(docs).toBe(1);
  });

  it('dos aperturas concurrentes de la misma mesa: solo una gana', async () => {
    const mesaLibre = await mesas.crear({ numero: 100, capacidad: 4 });

    const resultados = await Promise.allSettled([
      mesas.abrirMesa(mesaLibre.id, meseroId),
      mesas.abrirMesa(mesaLibre.id, meseroId),
    ]);

    const exitos = resultados.filter((r) => r.status === 'fulfilled').length;
    expect(exitos).toBe(1);

    const mesa = await mesas.buscarPorId(mesaLibre.id);
    expect(mesa.estado).toBe('OCUPADA');
  });

  it('crear orden y solicitar cuenta concurrentemente nunca dejan cuenta con orden activa', async () => {
    const bebida = await productos.crear({
      nombre: 'Bebida Concurrencia Cuenta',
      precio: 50,
      tipo: ProductoTipo.BEBIDA,
      disponible: true,
      temperatura: Temperatura.FRIA,
      tamanosDisponibles: [],
    });
    const mesa = await mesas.crear({ numero: 101, capacidad: 4 });
    await mesas.abrirMesa(mesa.id, meseroId);

    const [ordenEntregada] = await ordenes.crearOrden(
      { mesaId: mesa.id, items: [{ productoId: bebida.id, cantidad: 1 }] },
      meseroId,
    );
    await ordenModel
      .updateOne(
        { _id: new Types.ObjectId(ordenEntregada.id) },
        {
          $set: {
            estadoGeneral: OrdenEstado.ENTREGADA,
            'items.$[].estadoItem': ItemEstado.ENTREGADO,
          },
        },
      )
      .exec();

    const resultados = await Promise.allSettled([
      ordenes.crearOrden(
        { mesaId: mesa.id, items: [{ productoId: bebida.id, cantidad: 1 }] },
        meseroId,
      ),
      mesas.solicitarCuenta(mesa.id, meseroId),
    ]);

    expect(
      resultados.filter((resultado) => resultado.status === 'fulfilled'),
    ).toHaveLength(1);

    const mesaFinal = await mesas.buscarPorId(mesa.id);
    const ordenesActivas = await ordenModel
      .countDocuments({
        mesa: new Types.ObjectId(mesa.id),
        estadoGeneral: { $ne: OrdenEstado.ENTREGADA },
      })
      .exec();

    expect(
      mesaFinal.estado === MesaEstado.CUENTA_PEDIDA && ordenesActivas > 0,
    ).toBe(false);
  });

  it('dos ajustes de stock concurrentes no pierden actualizaciones', async () => {
    const item = await inventario.crear({
      nombre: 'Insumo Ajustes Concurrentes',
      unidad: Unidad.UNIDAD,
      stockActual: 10,
      stockMinimo: 1,
      costoUnitario: 5,
    });

    await Promise.all([
      inventario.ajustarStock(item.id, 5, 'AGREGAR'),
      inventario.ajustarStock(item.id, 7, 'AGREGAR'),
    ]);

    const final = await inventario.buscarPorId(item.id);
    expect(final.stockActual).toBe(22);
  });

  it('abrir mesa y desactivar mesero concurrentemente no dejan trabajo huérfano', async () => {
    const mesero = await usuarios.crear({
      nombre: 'Mesero Carrera Admin',
      email: 'mesero-admin-race@e2e.local',
      password: PASSWORD,
      roles: [Role.MESERO],
    });
    const mesa = await mesas.crear({ numero: 102, capacidad: 4 });

    const resultados = await Promise.allSettled([
      mesas.abrirMesa(mesa.id, mesero.id),
      usuarios.desactivar(mesero.id),
    ]);

    expect(
      resultados.filter((resultado) => resultado.status === 'fulfilled'),
    ).toHaveLength(1);

    const [mesaFinal, usuarioFinal] = await Promise.all([
      mesas.buscarPorId(mesa.id),
      usuarios.buscarPorId(mesero.id),
    ]);
    expect(
      mesaFinal.estado === MesaEstado.OCUPADA && !usuarioFinal.activo,
    ).toBe(false);
  });

  it('crear orden y quitar rol MESERO concurrentemente no dejan orden huérfana', async () => {
    const mesero = await usuarios.crear({
      nombre: 'Mesero Carrera Orden',
      email: 'mesero-order-race@e2e.local',
      password: PASSWORD,
      roles: [Role.MESERO],
    });
    const mesa = await mesas.crear({ numero: 103, capacidad: 4 });
    await mesas.abrirMesa(mesa.id, mesero.id);
    const bebida = await productos.crear({
      nombre: 'Bebida Carrera Rol',
      precio: 40,
      tipo: ProductoTipo.BEBIDA,
      disponible: true,
      temperatura: Temperatura.FRIA,
      tamanosDisponibles: [],
    });

    const resultados = await Promise.allSettled([
      ordenes.crearOrden(
        { mesaId: mesa.id, items: [{ productoId: bebida.id, cantidad: 1 }] },
        mesero.id,
      ),
      usuarios.actualizarRoles(mesero.id, { roles: [Role.CAJERO] }),
    ]);

    expect(
      resultados.filter((resultado) => resultado.status === 'fulfilled'),
    ).toHaveLength(1);

    const [usuarioFinal, ordenesActivas] = await Promise.all([
      usuarios.buscarPorId(mesero.id),
      ordenModel
        .countDocuments({
          mesa: new Types.ObjectId(mesa.id),
          estadoGeneral: { $ne: OrdenEstado.ENTREGADA },
        })
        .exec(),
    ]);
    expect(
      !usuarioFinal.roles.includes(Role.MESERO) && ordenesActivas > 0,
    ).toBe(false);
  });
});
