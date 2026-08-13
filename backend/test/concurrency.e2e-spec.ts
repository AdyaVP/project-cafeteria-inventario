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
import { InventarioItem, InventarioItemDocument } from '../src/inventario/schemas/inventario-item.schema';
import { Role } from '../src/common/constants/roles.enum';
import { Unidad } from '../src/inventario/schemas/unidad.enum';
import { ProductoTipo } from '../src/productos/schemas/producto-tipo.enum';

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

    const conexion = app.get('DatabaseConnection') as { dropDatabase: () => Promise<void> };
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
      ingredientes: [
        { inventarioItemId: ingrediente.id, cantidad: 4 },
      ],
    });

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

    const exitos = resultados.filter(
      (r) => r.status === 'fulfilled',
    ).length;
    const rechazados = resultados.filter(
      (r) => r.status === 'rejected',
    ).length;

    expect(exitos).toBe(1);
    expect(rechazados).toBe(1);

    const item = await itemModel.findById(ingredienteId).exec();
    expect(item?.stockActual).toBe(2);

    const docs = await ordenModel.countDocuments({ mesa: new Types.ObjectId(mesaId) }).exec();
    expect(docs).toBe(1);
  });

  it('dos aperturas concurrentes de la misma mesa: solo una gana', async () => {
    const mesaLibre = await mesas.crear({ numero: 100, capacidad: 4 });

    const resultados = await Promise.allSettled([
      mesas.abrirMesa(mesaLibre.id, meseroId),
      mesas.abrirMesa(mesaLibre.id, meseroId),
    ]);

    const exitos = resultados.filter(
      (r) => r.status === 'fulfilled',
    ).length;
    expect(exitos).toBe(1);

    const mesa = await mesas.buscarPorId(mesaLibre.id);
    expect(mesa.estado).toBe('OCUPADA');
  });
});
