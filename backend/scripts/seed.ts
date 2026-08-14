/**
 * Seed BASE — datos de catálogo deterministas para desarrollo/demo.
 *
 * Crea (o recrea): 4 usuarios demo, inventario, productos COMIDA/BEBIDA,
 * recetas (solo para productos COMIDA, que es donde el dominio las usa)
 * y mesas LIBRES.
 *
 * Ejecucion: npm run seed
 *
 * - Idempotente: borra y recrea las colecciones de catalogo.
 * - Se niega a ejecutarse en production (NODE_ENV=production).
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import type { Model } from 'mongoose';

import { AppModule } from '../src/app.module.js';
import { UsuariosService } from '../src/usuarios/usuarios.service.js';
import { InventarioService } from '../src/inventario/inventario.service.js';
import { ProductosService } from '../src/productos/productos.service.js';
import { RecetasService } from '../src/productos/recetas.service.js';
import { MesasService } from '../src/mesas/mesas.service.js';
import {
  Usuario,
  UsuarioDocument,
} from '../src/usuarios/schemas/usuario.schema.js';
import {
  InventarioItem,
  InventarioItemDocument,
} from '../src/inventario/schemas/inventario-item.schema.js';
import {
  Producto,
  ProductoDocument,
} from '../src/productos/schemas/producto.schema.js';
import {
  Receta,
  RecetaDocument,
} from '../src/productos/schemas/receta.schema.js';
import { Mesa, MesaDocument } from '../src/mesas/schemas/mesa.schema.js';
import { Role } from '../src/common/constants/roles.enum.js';
import { ProductoTipo } from '../src/productos/schemas/producto-tipo.enum.js';
import { Unidad } from '../src/inventario/schemas/unidad.enum.js';
import { Temperatura } from '../src/productos/schemas/temperatura.enum.js';
import type { CreateProductoComidaDto } from '../src/productos/dto/create-producto-comida.dto.js';
import type { CreateProductoBebidaDto } from '../src/productos/dto/create-producto-bebida.dto.js';

const PASSWORD_DEMO = 'Test1234';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('[seed] ABORTADO: no se ejecuta en production.');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);

  const usuarios = app.get(UsuariosService);
  const inventario = app.get(InventarioService);
  const productos = app.get(ProductosService);
  const recetas = app.get(RecetasService);
  const mesas = app.get(MesasService);

  const usuariosModel = app.get<Model<UsuarioDocument>>(
    getModelToken(Usuario.name),
  );
  const inventarioModel = app.get<Model<InventarioItemDocument>>(
    getModelToken(InventarioItem.name),
  );
  const productosModel = app.get<Model<ProductoDocument>>(
    getModelToken(Producto.name),
  );
  const recetasModel = app.get<Model<RecetaDocument>>(
    getModelToken(Receta.name),
  );
  const mesasModel = app.get<Model<MesaDocument>>(getModelToken(Mesa.name));

  // ── Limpieza de catalogo (idempotente) ──────────────────────────
  console.log('[seed] Limpiando colecciones de catalogo...');
  await Promise.all([
    mesasModel.deleteMany({}),
    recetasModel.deleteMany({}),
    productosModel.deleteMany({}),
    inventarioModel.deleteMany({}),
    usuariosModel.deleteMany({}),
  ]);

  // ── 1. Usuarios demo ────────────────────────────────────────────
  const hash = await bcrypt.hash(PASSWORD_DEMO, 12);
  const usuariosData = [
    { nombre: 'Admin Demo', email: 'admin@demo.local', roles: [Role.ADMIN] },
    { nombre: 'Mesero Demo', email: 'mesero@demo.local', roles: [Role.MESERO] },
    { nombre: 'Cajero Demo', email: 'cajero@demo.local', roles: [Role.CAJERO] },
    { nombre: 'Cocina Demo', email: 'cocina@demo.local', roles: [Role.COCINA] },
  ];

  for (const u of usuariosData) {
    await usuarios.crear({ ...u, password: PASSWORD_DEMO });
  }
  console.log('[seed] Usuarios demo creados (password: Test1234):');
  usuariosData.forEach((u) =>
    console.log(`  - ${u.nombre} <${u.email}> [${u.roles.join(', ')}]`),
  );

  // ── 2. Inventario ───────────────────────────────────────────────
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
      {
        nombre: 'Cafe',
        unidad: Unidad.KG,
        stockActual: 12,
        stockMinimo: 3,
        costoUnitario: 150,
      },
      {
        nombre: 'Leche',
        unidad: Unidad.LT,
        stockActual: 18,
        stockMinimo: 5,
        costoUnitario: 30,
      },
      {
        nombre: 'Azucar',
        unidad: Unidad.KG,
        stockActual: 15,
        stockMinimo: 4,
        costoUnitario: 20,
      },
    ].map((item) => inventario.crear(item)),
  );
  console.log('[seed] Inventario creado:', inv.length, 'items');

  const byNombre = new Map(inv.map((i) => [i.nombre, i.id]));

  // ── 3. Productos COMIDA ─────────────────────────────────────────
  const productosComida: CreateProductoComidaDto[] = [
    {
      nombre: 'Hamburguesa',
      precio: 120,
      tipo: ProductoTipo.COMIDA,
      disponible: true,
      tiempoPreparacionMin: 8,
      calorias: 550,
      alergenos: ['gluten', 'lactosa'],
    },
    {
      nombre: 'Pizza',
      precio: 150,
      tipo: ProductoTipo.COMIDA,
      disponible: true,
      tiempoPreparacionMin: 12,
      calorias: 700,
      alergenos: ['gluten', 'lactosa'],
    },
    {
      nombre: 'Papas fritas',
      precio: 60,
      tipo: ProductoTipo.COMIDA,
      disponible: true,
      tiempoPreparacionMin: 5,
      calorias: 350,
      alergenos: [],
    },
  ];
  const comida = await Promise.all(
    productosComida.map((p) => productos.crear(p)),
  );

  // ── 4. Productos BEBIDA (sin receta: el dominio no la usa) ──────
  const productosBebida: CreateProductoBebidaDto[] = [
    {
      nombre: 'Cafe',
      precio: 45,
      tipo: ProductoTipo.BEBIDA,
      disponible: true,
      temperatura: Temperatura.CALIENTE,
      tamanosDisponibles: [
        { nombre: 'Chico', precioAdicional: 0 },
        { nombre: 'Grande', precioAdicional: 15 },
      ],
    },
    {
      nombre: 'Refresco',
      precio: 35,
      tipo: ProductoTipo.BEBIDA,
      disponible: true,
      temperatura: Temperatura.FRIA,
      tamanosDisponibles: [{ nombre: 'Chico', precioAdicional: 0 }],
    },
    {
      nombre: 'Jugo natural',
      precio: 50,
      tipo: ProductoTipo.BEBIDA,
      disponible: true,
      temperatura: Temperatura.FRIA,
      tamanosDisponibles: [
        { nombre: 'Chico', precioAdicional: 0 },
        { nombre: 'Grande', precioAdicional: 10 },
      ],
    },
  ];
  const bebida = await Promise.all(
    productosBebida.map((p) => productos.crear(p)),
  );
  console.log(
    '[seed] Productos creados:',
    comida.length,
    'COMIDA +',
    bebida.length,
    'BEBIDA',
  );

  // ── 5. Recetas (SOLO para productos COMIDA) ─────────────────────
  const recetasData: Array<{
    productoId: string;
    ingredientes: Array<{ inventarioItemId: string; cantidad: number }>;
  }> = [
    {
      productoId: comida[0].id, // Hamburguesa
      ingredientes: [
        { inventarioItemId: byNombre.get('Harina')!, cantidad: 0.2 },
        { inventarioItemId: byNombre.get('Carne molida')!, cantidad: 0.15 },
        { inventarioItemId: byNombre.get('Queso')!, cantidad: 0.05 },
      ],
    },
    {
      productoId: comida[1].id, // Pizza
      ingredientes: [
        { inventarioItemId: byNombre.get('Harina')!, cantidad: 0.25 },
        { inventarioItemId: byNombre.get('Queso')!, cantidad: 0.15 },
        { inventarioItemId: byNombre.get('Salsa tomate')!, cantidad: 1 },
      ],
    },
    {
      productoId: comida[2].id, // Papas fritas
      ingredientes: [
        { inventarioItemId: byNombre.get('Papas')!, cantidad: 0.3 },
      ],
    },
  ];

  for (const r of recetasData) {
    await recetas.crear(r);
  }
  await Promise.all(
    comida.map((producto) => productos.toggleDisponibilidad(producto.id)),
  );
  console.log('[seed] Recetas creadas:', recetasData.length, '(solo COMIDA)');

  // ── 6. Mesas LIBRES ─────────────────────────────────────────────
  for (const numero of [1, 2, 3, 4, 5, 6]) {
    await mesas.crear({ numero, capacidad: 4 });
  }
  console.log('[seed] Mesas creadas: 1-6 (LIBRES)');

  await app.close();
  console.log('[seed] Completado.');
}

main().catch((error: unknown) => {
  console.error('[seed] Error:', error);
  process.exit(1);
});
