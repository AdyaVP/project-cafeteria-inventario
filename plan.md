# Plan de Implementación — Fase 4: Órdenes + WebSocket + Cocina

## Sistema de Cafetería e Inventario

---

## Decisiones Arquitectónicas

| Decisión | Elección | Impacto |
|---|---|---|
| Órdenes mixtas (COMIDA + BEBIDA) | **Documentos separados por tipo** | `crearOrden` puede generar 1 o 2 documentos por orden; response devuelve array |
| Error de stock insuficiente | **Mensaje detallado por insumo** | El servicio recolecta todos los faltantes antes de lanzar la excepción |
| `tiempoEstimadoMin` en OrdenCocina | **Automático** | Suma de `tiempoPreparacionMin` de cada producto COMIDA al crear la orden |
| Mapeo tipo producto → tipo orden | `ProductoTipo.COMIDA` → `TipoOrden.COCINA`, `ProductoTipo.BEBIDA` → `TipoOrden.CAFETERIA` |
| Gateway + JwtService | `AuthModule` exporta `JwtModule` para que `CocinaModule` lo re-use |
| Items en respuesta | El servicio popula `producto` (nombre, precio) desde la colección Producto |

---

## Estructura de Archivos

### Archivos a Crear (14)

```
src/ordenes/
├── schemas/
│   ├── orden-estado.enum.ts
│   ├── item-estado.enum.ts
│   ├── tipo-orden.enum.ts
│   ├── orden.schema.ts
│   ├── orden-cocina.schema.ts
│   └── orden-cafeteria.schema.ts
├── interfaces/
│   └── orden-response.interface.ts
├── dto/
│   └── crear-orden.dto.ts
├── ordenes.service.ts
├── ordenes.controller.ts
└── ordenes.module.ts

src/cocina/
├── cocina.service.ts
├── cocina.gateway.ts
├── cocina.controller.ts
└── cocina.module.ts
```

### Archivos a Modificar (4)

```
src/auth/auth.module.ts        → agregar exports: [JwtModule]
src/cocina/cocina.module.ts    → stub → completo
src/app.module.ts              → agregar OrdenesModule y CocinaModule a imports
```

---

## FASE A — Enums + Schemas + Interfaces

### A.1 — Enums

**`src/ordenes/schemas/orden-estado.enum.ts`**

```typescript
export enum OrdenEstado {
  PENDIENTE = 'PENDIENTE',
  EN_PREPARACION = 'EN_PREPARACION',
  LISTA = 'LISTA',
  ENTREGADA = 'ENTREGADA',
}
```

**`src/ordenes/schemas/item-estado.enum.ts`**

```typescript
export enum ItemEstado {
  PENDIENTE = 'PENDIENTE',
  EN_PREPARACION = 'EN_PREPARACION',
  LISTO = 'LISTO',
  ENTREGADO = 'ENTREGADO',
}
```

**`src/ordenes/schemas/tipo-orden.enum.ts`**

```typescript
export enum TipoOrden {
  COCINA = 'COCINA',
  CAFETERIA = 'CAFETERIA',
}
```

### A.2 — Schema Base con Discriminadores

**`src/ordenes/schemas/orden.schema.ts`**

```typescript
@Schema({ timestamps: true, versionKey: false, discriminatorKey: 'tipo' })
class Orden {
  mesa: Types.ObjectId;            // ref 'Mesa', required
  mesero: Types.ObjectId;          // ref 'Usuario', required
  items: Array<{
    producto: Types.ObjectId;      // ref 'Producto', required
    cantidad: number;              // required, min 1
    notas?: string;                // opcional
    estadoItem: ItemEstado;        // default PENDIENTE
  }>;
  estadoGeneral: OrdenEstado;      // default PENDIENTE
  tipo: TipoOrden;                 // discriminatorKey, required
}

// Índices:
// { mesa: 1, estadoGeneral: 1 }  → consultas de mesa activa
// { 'items.producto': 1 }        → consultas por producto
```

**`src/ordenes/schemas/orden-cocina.schema.ts`**

```typescript
@Schema()
class OrdenCocina extends Orden {
  notaChef?: string;               // instrucciones especiales
  tiempoEstimadoMin?: number;      // calculado automáticamente
}
```

**`src/ordenes/schemas/orden-cafeteria.schema.ts`**

```typescript
@Schema()
class OrdenCafeteria extends Orden {
  temperatura?: Temperatura;       // reusa enum existente de src/productos/schemas/
  tamano?: string;                 // ej: "Grande", "Mediano"
}
```

### A.3 — Interfaces de Respuesta

**`src/ordenes/interfaces/orden-response.interface.ts`**

```typescript
export interface OrdenItemResponse {
  id: string;
  productoId: string;
  nombreProducto: string;         // Populado desde Producto
  cantidad: number;
  notas?: string;
  estadoItem: ItemEstado;
}

export interface OrdenResponse {
  id: string;
  mesa: {
    id: string;
    numero: number;
  };
  mesero: {
    id: string;
    nombre: string;
  };
  items: OrdenItemResponse[];
  estadoGeneral: OrdenEstado;
  tipo: TipoOrden;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrdenCocinaResponse extends OrdenResponse {
  notaChef?: string;
  tiempoEstimadoMin?: number;
}

export interface OrdenCafeteriaResponse extends OrdenResponse {
  temperatura?: Temperatura;
  tamano?: string;
}
```

### A.4 — DTO de Creación (Zod)

**`src/ordenes/dto/crear-orden.dto.ts`**

```typescript
export const CrearOrdenSchema = z.object({
  mesaId: z.string().min(1, 'El ID de la mesa es requerido'),
  items: z
    .array(
      z.object({
        productoId: z.string().min(1, 'El ID del producto es requerido'),
        cantidad: z
          .number()
          .int()
          .positive('La cantidad debe ser mayor a 0'),
        notas: z.string().optional(),
      }),
    )
    .min(1, 'Debe haber al menos un producto en la orden'),
});

export type CrearOrdenDto = z.infer<typeof CrearOrdenSchema>;
```

---

## FASE B — Servicio de Órdenes

### B.1 — Métodos Públicos

| Método | Responsabilidad |
|---|---|
| `crearOrden(dto, meseroId)` | Flujo de 8 pasos (ver B.2) |
| `listarPorMesa(mesaId)` | Órdenes activas de una mesa con items populados |
| `actualizarEstadoItem(ordenId, itemId, nuevoEstado)` | Cambio de estado de un ítem individual |
| `marcarOrdenEntregada(ordenId)` | Cerrar orden solo si todos los items están LISTO |
| `obtenerColaCocina()` | Órdenes COCINA pendientes/en preparación, sort por createdAt ASC |

### B.2 — Flujo de `crearOrden` (8 Pasos)

```
PASO 1 — Validar mesa
  → MesasService.buscarPorId(dto.mesaId)
  → Validar que mesa.estado === OCUPADA
  → Si no: HTTP 400 "La mesa no está ocupada"

PASO 2 — Validar productos
  → Por cada item del dto:
    → ProductosService.buscarPorId(item.productoId)
    → Validar que producto.disponible === true
    → Guardar producto en lookup local

PASO 3 — Separar ítems por tipo
  → _separarItemsPorTipo(items, productosLookup)
  → Retorna: [
      { tipo: COCINA, items: [ítems COMIDA...] },
      { tipo: CAFETERIA, items: [ítems BEBIDA...] }
    ]

PASO 4 — Verificar stock (antes de descontar)
  → _verificarStock(itemsPorTipo)
  → Para cada ítem COMIDA:
    → RecetasService.buscarPorProducto(productoId)
    → Agregar ingredientes a Map<inventarioItemId, cantidadTotal>
  → Validar cantidadTotal <= stockActual para cada ingrediente
  → Si falla: recolectar TODOS los faltantes y lanzar 400 con detalle
    Ej: "Stock insuficiente para: Harina (faltan 2kg), Azúcar (faltan 0.5kg)"

PASO 5 — Descontar inventario
  → Por cada grupo de items:
    → Para cada item con receta:
      → InventarioService.descontarPorReceta(ingredientes)

PASO 6 — Crear documentos
  → Si items COCINA.length > 0:
    → OrdenCocinaModel.create({
        mesa, mesero, items, estadoGeneral: PENDIENTE,
        tipo: TipoOrden.COCINA,
        tiempoEstimadoMin: suma de tiemposPreparacionMin
      })
  → Si items CAFETERIA.length > 0:
    → OrdenCafeteriaModel.create({
        mesa, mesero, items, estadoGeneral: PENDIENTE,
        tipo: TipoOrden.CAFETERIA
      })

PASO 7 — Emitir evento
  → EventEmitter.emit('orden.creada', {
      ordenes: documentosCreados.map(d => d.toObject()),
      mesaId: dto.mesaId,
      timestamp: new Date()
    })

PASO 8 — Retornar respuesta
  → documentosCreados.map(doc => this._toResponse(doc))
  → Principio: validar todo antes de persistir; si falla algo, no hay efectos parciales
```

### B.3 — Métodos Privados

```typescript
// ÚNICO punto de mapeo de documentos a interfaces públicas
private _toResponse(
  doc: OrdenDocument
): OrdenCocinaResponse | OrdenCafeteriaResponse

// Validación de ObjectId consistente con el resto del proyecto
private _validarObjectId(id: string): void

// Separa ítems del dto según el tipo de producto (COMIDA → COCINA, BEBIDA → CAFETERIA)
private _separarItemsPorTipo(
  items: CrearOrdenItemDto[],
  productos: ProductoDetalle[]
): { tipo: TipoOrden; items: ProcesedItem[] }[]

// Verifica stock para TODOS los ingredientes antes de descontar
private async _verificarStock(
  itemsPorTipo: { tipo: TipoOrden; items: ProcesedItem[] }[]
): Promise<void>

// Descuenta inventario para cada ítem con receta
private async _descontarInventario(
  itemsPorTipo: { tipo: TipoOrden; items: ProcesedItem[] }[]
): Promise<void>
```

---

## FASE C — Gateway WebSocket

### C.1 — Configuración

**`src/cocina/cocina.gateway.ts`**

```typescript
@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
  namespace: '/cocina',
})
```

### C.2 — Eventos de Conexión

| Evento | Acción |
|---|---|
| `handleConnection(client)` | Extraer token de cookie → `JwtService.verify()` → suscribir a room según rol (`cocina`, `barra`) |
| `handleDisconnect(client)` | Socket.IO maneja limpieza automática |

### C.3 — Extracción de Token desde Cookie

```typescript
private extraerToken(client: Socket): string | null {
  const cookie = client.handshake.headers.cookie;
  if (!cookie) return null;
  const match = cookie.match(/access_token=([^;]+)/);
  return match ? match[1] : null;
}
```

### C.4 — Eventos Internos Escuchados

| Evento interno | Acción |
|---|---|
| `@OnEvent('orden.creada')` | `server.to('cocina').emit('nueva-orden', payload)` para órdenes de cocina |
| `@OnEvent('mesa.estado.cambiado')` | `server.emit('mesa-actualizada', payload)` a todos los clientes |

### C.5 — Método Público

```typescript
emitirEstadoOrden(ordenId: string, nuevoEstado: OrdenEstado): void {
  this.server.to('cocina').emit('orden-actualizada', {
    ordenId,
    nuevoEstado,
    timestamp: new Date(),
  });
}
```

---

## FASE D — Servicio de Cocina

### D.1 — Métodos

**`src/cocina/cocina.service.ts`**

```typescript
@Injectable()
class CocinaService {
  constructor(
    private readonly ordenesService: OrdenesService,
    private readonly cocinaGateway: CocinaGateway,
  ) {}
}
```

#### `obtenerColaActual()`

```typescript
async obtenerColaActual(): Promise<OrdenCocinaResponse[]> {
  const ordenes = await this.ordenesService.obtenerColaCocina();
  return ordenes.map(orden => this._toResponse(orden));
}
```

→ Filtro: `estadoGeneral IN [PENDIENTE, EN_PREPARACION]`
→ Sort: `createdAt ASC` (las más antiguas primero)

#### `marcarEnPreparacion(ordenId, cocineroId)`

```
1. Validar orden existe y estado === PENDIENTE
2. Cambiar estadoGeneral a EN_PREPARACION
3. Emitir vía WebSocket: cocinaGateway.emitirEstadoOrden(ordenId, EN_PREPARACION)
4. Retornar _toResponse(orden)
```

#### `marcarLista(ordenId)`

```
1. Validar orden existe y estado === EN_PREPARACION
2. Cambiar estadoGeneral a LISTA
3. Actualizar todos los items a estado LISTO
4. Emitir vía WebSocket: cocinaGateway.emitirEstadoOrden(ordenId, LISTA)
5. Retornar _toResponse(orden)
```

---

## FASE E — Controladores

### E.1 — `ordenes.controller.ts`

```typescript
@Controller('ordenes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdenesController {
  constructor(private readonly ordenesService: OrdenesService) {}

  @Post()
  @Roles(Role.MESERO)
  async crear(
    @Body(new ZodValidationPipe(CrearOrdenSchema))
    dto: CrearOrdenDto,
    @CurrentUser() usuario: JwtPayload,
  ): Promise<OrdenResponse[]> { ... }

  @Get('mesa/:mesaId')
  @Roles(Role.MESERO, Role.CAJERO, Role.ADMIN)
  async listarPorMesa(
    @Param('mesaId') mesaId: string,
  ): Promise<OrdenResponse[]> { ... }

  @Patch(':id/entregar')
  @Roles(Role.MESERO)
  async marcarEntregada(
    @Param('id') id: string,
  ): Promise<OrdenResponse> { ... }
}
```

### E.2 — `cocina.controller.ts`

```typescript
@Controller('cocina')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CocinaController {
  constructor(private readonly cocinaService: CocinaService) {}

  @Get('cola')
  @Roles(Role.COCINA)
  async obtenerCola(): Promise<OrdenCocinaResponse[]> { ... }

  @Patch(':ordenId/preparacion')
  @Roles(Role.COCINA)
  async marcarPreparacion(
    @Param('ordenId') ordenId: string,
    @CurrentUser() usuario: JwtPayload,
  ): Promise<OrdenCocinaResponse> { ... }

  @Patch(':ordenId/lista')
  @Roles(Role.COCINA)
  async marcarLista(
    @Param('ordenId') ordenId: string,
  ): Promise<OrdenCocinaResponse> { ... }
}
```

---

## FASE F — Módulos e Integración

### F.1 — `ordenes.module.ts`

```typescript
@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Orden.name,
        schema: OrdenSchema,
        discriminators: [
          { name: OrdenCocina.name, schema: OrdenCocinaSchema },
          { name: OrdenCafeteria.name, schema: OrdenCafeteriaSchema },
        ],
      },
    ]),
    MesasModule,
    ProductosModule,
    InventarioModule,
  ],
  controllers: [OrdenesController],
  providers: [OrdenesService],
  exports: [OrdenesService],
})
export class OrdenesModule {}
```

### F.2 — `cocina.module.ts`

```typescript
@Module({
  imports: [
    OrdenesModule,
    AuthModule,     // Para JwtService en el gateway
  ],
  controllers: [CocinaController],
  providers: [CocinaService, CocinaGateway],
})
export class CocinaModule {}
```

### F.3 — Modificación en `auth.module.ts`

Agregar `exports: [JwtModule]` para que `CocinaModule` pueda inyectar `JwtService`:

```typescript
@Module({
  imports: [UsuariosModule, PassportModule, JwtModule.registerAsync({...})],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtModule],   // ← NUEVO
})
export class AuthModule {}
```

### F.4 — Modificación en `app.module.ts`

Agregar `OrdenesModule` y `CocinaModule` a la lista de imports:

```typescript
@Module({
  imports: [
    // ... módulos existentes ...
    AuthModule,
    UsuariosModule,
    ProductosModule,
    InventarioModule,
    MesasModule,
    OrdenesModule,    // ← NUEVO
    CocinaModule,     // ← NUEVO
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
```

---

## Orden de Implementación y Commits

| # | Paso | Archivos | Descripción |
|---|---|---|---|
| 1 | Enums | 3 archivos | `orden-estado.enum.ts`, `item-estado.enum.ts`, `tipo-orden.enum.ts` |
| 2 | Schemas | 3 archivos | `orden.schema.ts` (base + índices), `orden-cocina.schema.ts`, `orden-cafeteria.schema.ts` |
| 3 | Interfaces | 1 archivo | `orden-response.interface.ts` con base + discriminadas |
| 4 | DTO | 1 archivo | `crear-orden.dto.ts` con Zod |
| 5 | Servicio | 1 archivo | `ordenes.service.ts` — flujo 8 pasos, métodos privados |
| 6 | Controlador | 1 archivo | `ordenes.controller.ts` — POST/GET/PATCH |
| 7 | Módulo | 1 archivo | `ordenes.module.ts` — imports con discriminadores |
| 8 | Gateway | 1 archivo | `cocina.gateway.ts` — JWT handshake, rooms, @OnEvent |
| 9 | Servicio cocina | 1 archivo | `cocina.service.ts` — cola, transiciones |
| 10 | Controlador cocina | 1 archivo | `cocina.controller.ts` — cola/preparacion/lista |
| 11 | Módulo cocina | 1 archivo | `cocina.module.ts` — imports a OrdenesModule + AuthModule |
| 12 | Modificaciones | 2 archivos | `auth.module.ts` (export JwtModule), `app.module.ts` (registrar módulos) |

### Commits Recomendados

```
1. feat(ordenes): enums, schemas con discriminadores e interfaces de respuesta
2. feat(ordenes): dto de creación con validación Zod
3. feat(ordenes): servicio con flujo completo crearOrden (8 pasos)
4. feat(ordenes): controlador REST con endpoints protegidos
5. feat(ordenes): módulo con imports a Mesas/Productos/Inventario
6. feat(cocina): gateway WebSocket con autenticación JWT en handshake
7. feat(cocina): servicio de cola y transiciones de estado
8. feat(cocina): controlador REST y módulo
9. fix(auth): exportar JwtModule para reuso en CocinaModule
10. chore(app): registrar OrdenesModule y CocinaModule en AppModule
```

---

## Reglas No Negociables Aplicables

- ✅ **SOLID**: Cada clase con una sola razón de cambio
- ✅ **Zod obligatorio**: Cada endpoint valida con ZodValidationPipe
- ✅ **Inyección de dependencias**: Sin instancias directas
- ✅ **Comunicación desacoplada**: Eventos con EventEmitter2
- ✅ **Sin `any`**: Tipado estricto en todo TypeScript
- ✅ **Sin `!`** (non-null assertions): Salvo justificación explícita
- ✅ **Sin magic strings**: Constantes en SCREAMING_SNAKE_CASE
- ✅ **Funciones únicas**: Cada método hace una sola cosa
- ✅ **`_toResponse` privado**: Único punto de mapeo
- ✅ **Orden de imports**: NestJS → Librerías → Internos
- ✅ **Validación ObjectId**: `mongoose.isValidObjectId()` antes de cada query
- ✅ **Timestamps + versionKey**: En todos los schemas
- ✅ **Soft-delete**: `activo: false` (donde aplique)
- ✅ **Cookies HttpOnly**: JWT solo en cookies, nunca en body
- ✅ **WebSocket autenticado**: Sin conexiones anónimas
