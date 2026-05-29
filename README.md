# Veragro Drones — Facturador

Sistema de facturación web full-stack para Veragro Drones. Lee y escribe documentos (Facturas, Cotizaciones y Facturas de Servicio) en bases de datos de **Notion**, genera PDFs profesionales con código QR de verificación, y gestiona líneas de producto contra un inventario.

---

## Características

- **Crear documentos** FAC / COT / SER con numeración correlativa automática
- **Selección de cliente** desde la base de datos de clientes de Notion
- **Gestión de líneas** con búsqueda en inventario o alta manual de productos
- **PDF profesional** (Carta o Legal, multi-página) con datos bancarios y QR de verificación
- **Sincronización con Notion**: descuento, subtotal, ITBMS y método de pago se guardan al generar el PDF
- **Búsqueda y filtros** en la lista (por tipo, por estado, ver canceladas)
- **Cambio de estado inline** (Borrador → Enviada → Pagada → Cancelada)
- **Página pública de verificación** vía el QR del PDF (mobile-first)

---

## Arquitectura

```
┌────────────────────┐      /api/*       ┌────────────────────┐
│  Frontend           │ ───── proxy ────► │  Backend            │
│  React + Vite       │                   │  Node + Express     │
│  Tailwind (nginx)   │                   │  Puppeteer (PDF)    │
└────────────────────┘                   │  @notionhq/client   │
                                          └─────────┬──────────┘
                                                    │
                                            ┌───────▼────────┐
                                            │  Notion API     │
                                            │  3 databases    │
                                            └────────────────┘
```

- **Backend** (puerto 3000): API REST que envuelve el SDK de Notion y renderiza HTML→PDF con Puppeteer.
- **Frontend** (puerto 5173 en dev / 80 en prod): SPA con tres flujos — lista, creación/edición, verificación.
- En desarrollo, Vite hace proxy de `/api/*` al backend. En producción, nginx hace el proxy.

---

## Requisitos previos

- **Node.js 20+** (para desarrollo local)
- **Docker + Docker Compose** (para despliegue en producción)
- Una cuenta de **Notion** con una integración interna y tres bases de datos

---

## Configuración de Notion

### 1. Crear la integración

1. Ir a [app.notion.com/developers](https://app.notion.com/developers) → **Internal connections** → **Create a new connection**
2. Asignar un nombre y seleccionar el workspace
3. Copiar el **Access token** (formato `ntn_...`) → será `NOTION_TOKEN`
4. Dar a la integración permisos de **Read, Update, Insert content**

### 2. Conectar la integración a cada base de datos

Para cada una de las tres bases de datos en Notion: abrir la base → menú `•••` → **Connections** → añadir la integración.

### 3. Obtener los IDs de las bases de datos

El ID son los 32 caracteres hexadecimales en la URL de la base: `notion.so/<ID>?v=...`

### 4. Esquema esperado de cada base de datos

**Base de Ventas** (`NOTION_DB_VENTAS`):

| Propiedad | Tipo | Notas |
|---|---|---|
| (título) | Title | Número del documento (ej. `SER-001`) — generado por el sistema |
| `Tipo` | Select | Opciones: `Venta directa`, `Cotización`, `Factura de Servicio` |
| `Cliente` | Relation | → base de Clientes |
| `Numero de Orden` | Relation | Opcional |
| `Fecha` | Date | Fecha de emisión |
| `Vencimiento` | Date | Opcional |
| `Estado` | Select | `Borrador`, `Enviada`, `Pagada`, `Cancelada` |
| `Notas` | Text | Opcional |
| `Descuento` | Number (porcentaje) | Se guarda como decimal (0.1 = 10%) |
| `Subtotal` | Number | |
| `ITBMS` | Number | Monto del impuesto |
| `Método de pago` | Select | |

Cada página de ventas contiene una **base de datos hija** ("Productos Mantenimiento") con las líneas: `Producto` (title), `SKU` (text), `Cantidad`, `Precio c/u`, `Descuento %` (números). El sistema la crea automáticamente al generar un documento nuevo.

**Base de Clientes** (`NOTION_DB_CLIENTES`): propiedad título = `Nombre`.

**Base de Inventario** (`NOTION_DB_INVENTARIO`): `Nombre` (title), `SKU_EXT` (text — SKU manual editable), `Precio c/u` (number). El campo `SKU` de tipo *unique ID* (ICA-X) se usa como respaldo si `SKU_EXT` está vacío.

> Si los nombres de las propiedades difieren, ajustarlos en `backend/src/notion.js`, `backend/src/clientes.js` y `backend/src/inventario.js`.

---

## Variables de entorno

| Variable | Descripción |
|---|---|
| `NOTION_TOKEN` | Token de la integración de Notion (`ntn_...`) |
| `NOTION_DB_VENTAS` | ID de la base de documentos |
| `NOTION_DB_CLIENTES` | ID de la base de clientes |
| `NOTION_DB_INVENTARIO` | ID de la base de inventario |
| `PORT` | Puerto del backend (default 3000) |
| `FRONTEND_URL` | URL pública del frontend — usada en el QR del PDF |
| `EMPRESA_BANCO` | Nombre del banco (PDF) |
| `EMPRESA_TIPO_CUENTA` | `Corriente` o `Ahorro` (PDF) |
| `EMPRESA_CUENTA` | Número de cuenta (PDF) |
| `EMPRESA_CUENTA_NOMBRE` | Titular de la cuenta (PDF) |
| `EMPRESA_YAPPY` | Número de Yappy (PDF) |

---

## Desarrollo local

El backend carga las variables desde **`backend/.env`** (no desde la raíz).

```bash
# 1. Backend
cd backend
cp .env.example .env        # rellenar con valores reales
npm install
npm run dev                 # http://localhost:3000

# 2. Frontend (en otra terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Abrir **http://localhost:5173**.

### Tests

```bash
cd backend && npm test      # 20 tests (cálculos + numeración + PDF)
```

---

## Despliegue en producción (Docker)

Docker Compose lee el archivo **`.env` de la raíz** del proyecto.

```bash
# 1. Crear el .env de producción en la raíz
cp .env.example .env

# 2. Editar .env:
#    - Rellenar NOTION_TOKEN y los tres IDs de base de datos
#    - Poner los datos bancarios reales (EMPRESA_*)
#    - FRONTEND_URL = la URL/IP pública del servidor (ej. http://203.0.113.10)
#      ⚠️ Importante para que el QR del PDF resuelva desde fuera

# 3. Construir y levantar
docker-compose up --build -d
```

La aplicación queda disponible en el **puerto 80** del servidor. El backend no se expone públicamente; nginx hace de proxy de `/api/*`.

### Comandos útiles

```bash
docker-compose logs -f          # ver logs
docker-compose down             # detener
docker-compose up --build -d    # reconstruir tras cambios
```

---

## Notas operativas

- **"Cancelar documento"** cambia el estado a `Cancelada` (la API de Notion solo permite archivar, no borrar permanentemente). Las canceladas se ocultan de la lista; se ven con el botón "Ver canceladas".
- **`@notionhq/client` v5**: el método `databases.query` fue removido; el código usa `notion.request(...)`. No bajar de versión sin ajustar el código.
- Tras cambiar nombres de propiedades en Notion, **reiniciar el backend** (algunos nombres de propiedad título se cachean en memoria).
- La fuente del PDF (Courier Prime) se carga desde Google Fonts; sin internet en el servidor, cae a Courier New.

---

## Estructura del proyecto

```
.
├── docker-compose.yml
├── .env.example                # plantilla para Docker (raíz)
├── backend/
│   ├── Dockerfile              # Node + Chromium para Puppeteer
│   ├── .env.example            # plantilla para desarrollo local
│   └── src/
│       ├── server.js           # rutas Express
│       ├── notion.js           # documentos, líneas, numeración
│       ├── clientes.js         # listado de clientes
│       ├── inventario.js       # búsqueda/alta de productos
│       ├── pdf.js              # HTML→PDF + QR
│       ├── calculateTotals.js  # descuentos e ITBMS
│       └── __tests__/          # tests jest
└── frontend/
    ├── Dockerfile              # build Vite + nginx
    ├── nginx.conf              # proxy /api/* → backend
    └── src/
        ├── pages/              # Lista, NuevaFactura, Factura, EditarFactura, Verify
        ├── components/         # BuscadorProducto, Toast, TablaLineas, Totales
        └── utils.js            # formato de fechas en español
```
