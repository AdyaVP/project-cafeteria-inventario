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