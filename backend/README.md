# Sistema de Cafetería e Inventario

Sistema de gestión para cafeterías y restaurantes. Maneja mesas, órdenes, cocina, caja e inventario en tiempo real.

---

## Stack tecnológico

**Backend:** NestJS · MongoDB · Mongoose · Socket.io · Zod  
**Frontend:** Next.js · TypeScript · Tailwind CSS  
**Infraestructura:** Docker · Docker Compose

---

## Requisitos previos

Antes de clonar el proyecto asegúrate de tener instalado:

- [Node.js 20+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Git](https://git-scm.com/)

DEBEN FIJARSE DE TENER NEST INSTALADO PORQUE SI NO LES TIRARÁ ERROR!

---

## Primera vez — cómo levantar el proyecto

**1. Clona el repositorio**

```bash
git clone https://github.com/AdyaVP/project-cafeteria-inventario.git
cd project-cafeteria-inventario
```

**2. Crea tu archivo de variables de entorno**

```bash
cp backend/.env.example backend/.env
```

**3. Abre `backend/.env` y llena estas variables obligatorias**

```env
PORT=4000
MONGODB_URI=mongodb://root:root@mongodb:27017/cafeteria?authSource=admin
JWT_SECRET=pon-aqui-un-string-largo-y-aleatorio   Lo pueden hacer o con OPENSSL o con NODE el aleatorio. 
JWT_EXPIRATION=7d
FRONTEND_URL=http://localhost:3000
```

> Para generar un JWT_SECRET  corre este comando en tu terminal:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

**4. Levanta todos los servicios**

```bash
docker compose up --build
```

**5. Verifica que todo está corriendo**

| Servicio | URL |
|---|---|
| Backend API | http://localhost:4000/api |
| Mongo Express (admin BD) | http://localhost:8081 |
| MongoDB | puerto 27017 |

---

## Uso diario

```bash
# Levantar
docker compose up

# Apagar
docker compose down

# Ver logs del backend
docker compose logs -f backend

# Reconstruir si cambiaste dependencias
docker compose up --build
```

---

## Estructura del proyecto

```
project-cafeteria-inventario/
├── backend/                  # API REST — NestJS
│   ├── src/
│   │   ├── common/           # Guards, decoradores, filtros, pipes (compartidos)
│   │   ├── auth/             # Login, JWT, estrategias
│   │   ├── usuarios/         # CRUD de usuarios y roles
│   │   ├── mesas/            # Estados de mesas en tiempo real
│   │   ├── ordenes/          # Creación y seguimiento de órdenes
│   │   ├── productos/        # Menú con discriminadores (comida/bebida)
│   │   ├── inventario/       # Stock e ingredientes
│   │   ├── cocina/           # Cola de cocina por WebSocket
│   │   └── caja/             # Facturación y cierre de mesas
│   ├── .env.example          # Variables de entorno requeridas
│   └── Dockerfile.dev        # Imagen Docker para desarrollo
├── frontend/                 # App web — Next.js (Esto sera a partir de la Fase 7 si no mal recuerdo.)
├── docker-compose.yml        # Orquestación de servicios
└── README.md
```

---

## Convención de ramas

| Rama | Uso |
|---|---|
| `main` | Producción — **nadie hace push directo aquí deben crear su rama y aprobarse el PULL REQUEST** |
| `develop` | Integración — todo se mergea aquí primero |
| `feature/nombre-modulo` | Tu rama de trabajo |

**Cómo crear tu rama de trabajo:**

```bash
git checkout develop
git pull origin develop
git checkout -b feature/fase-2-productos-inventario
```

---

## Convención de commits

Formato: `tipo(scope): descripción corta en minúsculas`

| Tipo | Cuándo usarlo |
|---|---|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `refactor` | Mejora de código sin cambiar comportamiento |
| `chore` | Dependencias, configuraciones, tareas de mantenimiento |
| `docs` | Cambios en documentación |

**Ejemplos reales del proyecto:**

```bash
feat(usuarios): agregar endpoint de creación de usuario
fix(auth): corregir validación de token expirado
refactor(ordenes): extraer lógica de descuento a método privado
chore(deps): actualizar mongoose a v9.6.3
docs(readme): agregar instrucciones de setup
```

---

## Cómo hacer un Pull Request (recuerda primero se debe aprobar)

1. Asegúrate de que tu rama está actualizada con `develop`
   ```bash
   git checkout develop
   git pull origin develop
   git checkout feature/tu-rama
   git merge develop
   ```
2. Sube tu rama
   ```bash
   git push origin feature/tu-rama
   ```
3. Abre el PR en GitHub apuntando a `develop` — **nunca a `main`**
4. Espera el review  antes de mergear
5. No mergees tu propio PR

---

## Roles del sistema

| Rol | Qué puede hacer |
|---|---|
| `ADMIN` | Todo: usuarios, menú, inventario, reportes |
| `MESERO` | Abrir mesas, tomar y entregar órdenes |
| `CAJERO` | Ver cuentas pendientes, facturar, cobrar |
| `COCINA` | Ver cola de órdenes, marcar en preparación y listo |

> Un usuario puede tener más de un rol. Ejemplo: en negocios pequeños una persona puede ser `MESERO` y `CAJERO` al mismo tiempo.

---

## Contacto

Dudas técnicas o problemas con el setup → habla con **Valeria**.
---

# Documentación de API — Fase 6

## Convenciones generales

- Prefijo global: `/api`
- Contrato de respuestas:
  - Éxito: `{ "success": true, "data": ... }`
  - Error: `{ "success": false, "statusCode": N, "message": "...", "path": "..." }`
- Autenticación: cookie HttpOnly `access_token` (JWT) — `SameSite=Strict`, `secure` solo en producción
- Roles: `ADMIN`, `MESERO`, `CAJERO`, `COCINA`
- Todos los `POST`/`PATCH` con body validan con Zod (`ZodValidationPipe`)
- IDs malformados → `400` (nunca `404`)
- Rate limiting: 100 requests / 60s por IP (`429` al exceder)

## Auth

| Método | Ruta | Rol | Body | Respuesta |
|---|---|---|---|---|
| POST | `/api/auth/login` | público | `{ email, password }` | `200` → `{ user, message }` + cookie |
| POST | `/api/auth/logout` | autenticado | — | `200` → `{ message }` + cookie limpia |
| GET | `/api/auth/me` | autenticado | — | `200` → usuario sin password |
| POST | `/api/auth/registro` | ADMIN | `{ nombre, email, password, roles[] }` | `201` → usuario creado |

**Errores:** login inválido → `401 "Credenciales inválidas"` (genérico). Email duplicado → `409`. Usuario desactivado con token vigente → `401`.

## Usuarios

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/usuarios` | ADMIN | Lista usuarios activos (ordenados por nombre) |
| GET | `/api/usuarios/:id` | ADMIN | Detalle de usuario |
| PATCH | `/api/usuarios/:id/roles` | ADMIN | `{ roles[] }` — actualizar roles |
| PATCH | `/api/usuarios/:id/desactivar` | ADMIN | Soft delete (`activo: false`) |

## Productos y Recetas

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/productos` | ADMIN, CAJERO, MESERO | Todos los productos |
| GET | `/api/productos/disponibles` | +COCINA | Solo `disponible: true` |
| GET | `/api/productos/:id` | ADMIN, CAJERO, MESERO, COCINA | Detalle |
| POST | `/api/productos` | ADMIN | Crear COMIDA o BEBIDA (discriminado por `tipo`) |
| PATCH | `/api/productos/:id` | ADMIN | Actualizar (no cambia tipo) |
| PATCH | `/api/productos/:id/disponibilidad` | ADMIN | Toggle disponible |
| GET | `/api/recetas` | ADMIN, COCINA | Lista recetas |
| GET | `/api/recetas/:productoId` | ADMIN, COCINA | Receta de un producto |
| POST | `/api/recetas` | ADMIN, COCINA | `{ productoId, ingredientes: [{ inventarioItemId, cantidad }] }` |

**Body ejemplo producto COMIDA:** `{ "nombre": "Hamburguesa", "precio": 120, "tipo": "COMIDA", "tiempoPreparacionMin": 8, "calorias": 550, "alergenos": [] }`
**Body ejemplo producto BEBIDA:** `{ "nombre": "Cafe", "precio": 45, "tipo": "BEBIDA", "temperatura": "CALIENTE", "tamanosDisponibles": [{ "nombre": "Chico", "precioAdicional": 0 }] }`

## Inventario

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/inventario` | ADMIN, COCINA | Lista ítems |
| GET | `/api/inventario/alertas` | ADMIN, COCINA | ítems con `stockActual <= stockMinimo` |
| GET | `/api/inventario/:id` | ADMIN, COCINA | Detalle |
| POST | `/api/inventario` | ADMIN | `{ nombre, unidad, stockActual, stockMinimo, costoUnitario }` |
| PATCH | `/api/inventario/:id/stock` | ADMIN, COCINA | `{ cantidad, operacion: "AGREGAR" | "DESCONTAR" }` |

## Mesas

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/mesas` | ADMIN, MESERO, CAJERO | Todas las mesas con estado |
| GET | `/api/mesas/:id` | ADMIN, MESERO, CAJERO | Detalle |
| POST | `/api/mesas` | ADMIN | `{ numero, capacidad }` |
| PATCH | `/api/mesas/:id/abrir` | MESERO | Abre la mesa (el mesero viene de `@CurrentUser`) |
| PATCH | `/api/mesas/:id/solicitar-cuenta` | MESERO | Mesa → `CUENTA_PEDIDA` |

**Estados:** `LIBRE → OCUPADA → CUENTA_PEDIDA → LIBRE`. Transiciones inválidas → `400`. Apertura concurrente protegida (CAS) — solo una gana.

## Órdenes

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/api/ordenes` | MESERO | Crea orden mixta: `{ mesaId, items: [{ productoId, cantidad, notas? }] }` |
| GET | `/api/ordenes/mesa/:mesaId` | MESERO, CAJERO, ADMIN | Órdenes activas de la mesa |
| PATCH | `/api/ordenes/:id/entregar` | MESERO | Marca ENTREGADA (requiere todos los items LISTO) |

**Modelo de dominio:** un submit mixto produce **2 documentos** — `OrdenCocina` (`tipo: "COCINA"`) y `OrdenCafeteria` (`tipo: "CAFETERIA"`) — independientes, de la misma mesa y mesero, sin entidad padre. La separación existe solo para preparación; **COCINA opera ambas**.

**Estados:** `PENDIENTE → EN_PREPARACION → LISTA → ENTREGADA` (por orden). Items: `PENDIENTE → EN_PREPARACION → LISTO → ENTREGADO` (el mesero solo puede entregar si todos los items están LISTO).

**Atomicidad:** `crearOrden` corre en una **transacción Mongo** (requiere replica set): valida → descuenta inventario → crea documentos. Si cualquier paso falla, todo se revierte. El descuento de stock es atómico frente a concurrencia (2 pedidos simultáneos sobre stock insuficiente → solo 1 gana).

## Cocina

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/cocina/cola` | COCINA | Cola PENDIENTE + EN_PREPARACION (**COCINA y CAFETERIA**), más antiguas primero |
| PATCH | `/api/cocina/:ordenId/preparacion` | COCINA | → EN_PREPARACION |
| PATCH | `/api/cocina/:ordenId/lista` | COCINA | → LISTA (todos los items → LISTO) |

## Caja

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/caja/pre-cuenta/:mesaId` | CAJERO, MESERO, ADMIN | Resumen de órdenes ENTREGADAS desde `abiertaEn` (subtotal, impuesto, total) |
| POST | `/api/caja/factura` | CAJERO | `{ mesaId, metodoPago, rtn?, cai? }` — emite factura y libera mesa (transacción + CAS: doble cobro imposible) |
| GET | `/api/caja/factura/:id` | CAJERO, ADMIN | Detalle de factura |
| PATCH | `/api/caja/factura/:id/anular` | ADMIN | `{ justificacion }` (mín 10 chars). No reabre mesa. |
| GET | `/api/caja/reportes/diario?fecha=YYYY-MM-DD` | ADMIN | Total cobrado, desglose por método, mesas atendidas, ticket promedio (zona Honduras) |

**Snapshot inmutable:** la factura guarda `itemsSnapshot` (nombre, cantidad, precioUnitario, subtotal) en el momento del cobro. Un cambio futuro de precio NO altera facturas históricas.

---

# WebSockets — Fase 6

## Conexión

- **Namespace:** `/cocina`
- **Autenticación:** cookie HttpOnly `access_token` en el handshake (JWT). Sin token o token inválido → **desconexión inmediata**. No hay conexiones anónimas.
- **Reconexión:** el cliente configura `reconnection: true` (5 intentos, 1s de delay).

## Rooms

| Room | Quién entra | Propósito |
|---|---|---|
| `cocina` | Clientes con rol **COCINA** | Cola de cocina y estado de órdenes |
| `user:{sub}` | **Todos** los clientes autenticados | Eventos dirigidos al usuario (notificación al mesero) |

El ID de usuario proviene **del JWT verificado por el servidor** (`payload.sub`) — el cliente no puede elegir a qué room se une.

## Eventos

### `nueva-orden`
- **Emisor:** `CocinaGateway` (al crear una orden)
- **Destino:** room `cocina`
- **Payload:**
```json
{
  "ordenes": [ /* OrdenResponse[] */ ],
  "mesaId": "...",
  "timestamp": "..."
}
```

### `orden-actualizada`
- **Emisor:** `CocinaGateway` (al marcar EN_PREPARACION o LISTA)
- **Destino:** room `cocina` **y** `user:{meseroId}` (el mesero de la orden)
- **Payload:**
```json
{
  "ordenId": "...",
  "mesaId": "...",
  "mesaNumero": 4,
  "meseroId": "...",
  "tipo": "COCINA | CAFETERIA",
  "nuevoEstado": "EN_PREPARACION | LISTA",
  "timestamp": "..."
}
```
- **Uso mesero:** el frontend filtra `nuevoEstado === "LISTA"` para notificar "orden lista para entregar".

### `mesa-actualizada`
- **Emisor:** `CocinaGateway` (cambio de estado de mesa: abrir, solicitar cuenta, liberar)
- **Destino:** **broadcast** a todos los clientes conectados
- **Payload:**
```json
{
  "mesaId": "...",
  "nuevoEstado": "OCUPADA | CUENTA_PEDIDA | LIBRE",
  "timestamp": "..."
}
```

---

# Seed

```bash
npm run seed
```

Crea (o recrea) datos de catálogo deterministas: 4 usuarios demo (`admin|mesero|cajero|cocina@demo.local`, password `Test1234`), inventario, productos COMIDA/BEBIDA, recetas (solo COMIDA) y mesas 1-6 LIBRES. **Idempotente** (borra y recrea) y **se niega a ejecutarse con `NODE_ENV=production`**.

# Tests

```bash
npm test          # unit (40 tests)
npm run test:e2e  # integración + E2E + WebSocket (requiere Mongo con replica set)
```

Cobertura E2E: flujo completo de Fase 6 (orden mixta, 2 rondas, factura única, anulación, reporte), concurrencia (overbooking de stock, apertura de mesa), rate limiting real (429) y WebSocket mesero (recibe `LISTA`, aislamiento por room).
