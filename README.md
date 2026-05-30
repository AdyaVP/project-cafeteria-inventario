# Sistema de Cafeteria e Inventario

Sistema integral para la gestion de cafeteria universitaria: ordenes, inventario, cocina y caja.

## Stack tecnologico

- **Backend:** NestJS 11, TypeScript, Mongoose, Socket.io, Zod, Passport JWT
- **Frontend:** Next.js, TypeScript, Tailwind CSS
- **Base de datos:** MongoDB 7
- **Infraestructura:** Docker, Docker Compose

## Requisitos previos

- Node.js 20+
- Docker y Docker Compose
- npm

## Levantar el entorno local

1. Clonar el repositorio:

```bash
git clone <url-del-repo>
cd project-cafeteria-inventario
```

2. Crear el archivo de variables de entorno para Docker (raiz del proyecto):

```bash
cp .env.example .env  # si existe, o crear manualmente
```

El `.env` de la raiz necesita:

```
MONGO_USER=admin
MONGO_PASSWORD=password123
```

3. Crear el archivo de variables de entorno del backend:

```bash
cp backend/.env.example backend/.env
```

4. Levantar los servicios con Docker Compose:

```bash
docker compose up -d
```

5. Acceder a los servicios:

- **Backend API:** http://localhost:3000/api
- **Mongo Express:** http://localhost:8081

### Desarrollo sin Docker (solo backend)

```bash
cd backend
npm install
npm run start:dev
```

Requiere una instancia de MongoDB corriendo en el puerto 27017.

## Convencion de ramas

| Rama | Proposito |
|------|-----------|
| `main` | Rama protegida. Solo recibe merges via PR aprobado. |
| `develop` | Rama de integracion. Aqui se unen las features antes de ir a main. |
| `feature/nombre-modulo` | Ramas de trabajo. Se crean desde develop. |

## Convencion de commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: agregar endpoint de login
fix: corregir validacion de stock negativo
chore: actualizar dependencias de desarrollo
refactor: extraer logica de calculo a servicio dedicado
docs: documentar endpoints de ordenes
```

## Pull Requests

1. Crear la rama desde `develop`: `git checkout -b feature/nombre-modulo`
2. Hacer commits siguiendo la convencion
3. Abrir PR hacia `develop`
4. Solicitar review al lead del proyecto
5. Resolver comentarios y obtener aprobacion antes de mergear
