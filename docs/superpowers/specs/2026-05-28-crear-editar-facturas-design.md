# Crear y Editar Facturas — Design Spec

**Fecha:** 2026-05-28  
**Proyecto:** AgroTech Drones Facturador  
**Alcance:** Creación de FAC/COT/SER desde la app + gestión de líneas de producto con catálogo de inventario

---

## Resumen

Añadir flujo de dos pasos para crear y editar documentos directamente desde el facturador, sin necesidad de abrir Notion manualmente. El paso 1 crea la factura con datos básicos. El paso 2 gestiona las líneas de producto con búsqueda en el inventario o entrada manual.

---

## Variables de entorno nuevas

```
NOTION_DB_CLIENTES=<id de la DB de clientes en Notion>
NOTION_DB_INVENTARIO=<id de "📦 Gestión de inventario" en Notion>
```

Ambas se añaden a `backend/.env` y `backend/.env.example`.

---

## Rutas frontend nuevas

| Ruta | Componente | Propósito |
|---|---|---|
| `/nueva` | `NuevaFactura.jsx` | Paso 1: formulario de creación |
| `/factura/:id/editar` | `EditarFactura.jsx` | Paso 2: gestión de líneas |

Añadir ambas a `App.jsx`.

---

## Endpoints backend nuevos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/clientes` | Lista clientes de NOTION_DB_CLIENTES |
| `GET` | `/api/inventario?q=texto` | Búsqueda de productos en NOTION_DB_INVENTARIO |
| `POST` | `/api/documentos` | Crea página Notion + sub-BD de líneas |
| `PUT` | `/api/documentos/:id` | Actualiza propiedades (estado, notas, fecha) |
| `POST` | `/api/documentos/:id/lineas` | Añade línea a la sub-BD |
| `PUT` | `/api/lineas/:id` | Edita cantidad/precio/descuento de una línea |
| `DELETE` | `/api/lineas/:id` | Elimina una línea |

---

## Paso 1 — Formulario de creación (`/nueva`)

### Campos

| Campo | Tipo Notion | UI | Reglas |
|---|---|---|---|
| Tipo | select | 3 botones toggle: FAC / COT / SER | Requerido |
| Cliente | relation | Dropdown con búsqueda (carga de `/api/clientes`) | Requerido |
| Fecha | date | Date picker, pre-llena con hoy | Requerido |
| Notas extras | rich_text | Textarea | Opcional |
| Notas | rich_text | Textarea | Opcional |

### Numeración automática

- Al crear, el backend consulta todos los documentos del mismo tipo en `NOTION_DB_VENTAS`
- Extrae los números existentes (ej. `SER-001` → `1`)
- Asigna `max + 1`, formateado como `SER-003`, `FAC-012`, etc. (cero-relleno a 3 dígitos)
- Si no existe ninguno del tipo, empieza en `001`

### Creación en Notion

`POST /api/documentos` realiza dos llamadas:
1. `pages.create` — crea la página en `NOTION_DB_VENTAS` con todas las propiedades
2. `databases.create` con `parent: { type: "page_id", page_id }` — crea la sub-BD de líneas dentro de esa página con el esquema:
   - `Producto` (title)
   - `SKU` (rich_text)
   - `Cantidad` (number)
   - `Precio c/u` (number)
   - `Descuento %` (number)

El Estado se inicializa en `Borrador`. Al éxito, el endpoint devuelve el `id` de la página creada y el frontend redirige a `/factura/:id/editar`.

---

## Paso 2 — Editor de líneas (`/factura/:id/editar`)

### Layout

- **Header** (solo lectura): número, tipo, cliente, fecha
- **Selector de estado**: Borrador → Enviada → Pagada → Cancelada (llama a `PUT /api/documentos/:id`)
- **Tabla de líneas existentes**: una fila por producto con campos editables inline (cantidad, descuento) y botón eliminar
- **Formulario de nueva línea**: en la parte inferior
- **Botón "Guardar y volver"**: navega a `/factura/:id`

### Formulario de nueva línea

| Campo | Comportamiento |
|---|---|
| Buscar producto | Input con debounce, llama `/api/inventario?q=` — muestra lista de coincidencias con SKU + nombre + precio |
| SKU | Se autocompleta al seleccionar del catálogo; editable manualmente |
| Producto | Se autocompleta al seleccionar; editable manualmente |
| Precio c/u | Se autocompleta del catálogo; editable |
| Cantidad | Número, default 1 |
| Descuento % | Número, default 0 |

### Lógica de guardado de nueva línea

1. Llama `POST /api/documentos/:id/lineas` — crea una página en la sub-BD con los datos
2. Si el producto fue escrito manualmente (no seleccionado del catálogo) → también llama `pages.create` en `NOTION_DB_INVENTARIO` con SKU + nombre + precio para añadirlo al inventario
3. La tabla se refresca con la nueva línea

### Edición inline de líneas existentes

- Los campos `Cantidad` y `Descuento %` son inputs editables directamente en la tabla
- Al perder foco (onBlur) se llama `PUT /api/lineas/:id` con el valor actualizado
- Botón eliminar llama `DELETE /api/lineas/:id` y remueve la fila

---

## Archivos a crear

**Backend:**
- `backend/src/clientes.js` — funciones para listar clientes
- `backend/src/inventario.js` — funciones para buscar productos
- Añadir rutas nuevas a `backend/src/server.js`

**Frontend:**
- `frontend/src/pages/NuevaFactura.jsx`
- `frontend/src/pages/EditarFactura.jsx`
- `frontend/src/components/BuscadorProducto.jsx` — input de búsqueda con dropdown

---

## Archivos a modificar

- `backend/src/server.js` — nuevos endpoints
- `backend/src/notion.js` — función `createDocument`, `addLineItem`, `updateLineItem`, `deleteLineItem`
- `backend/.env` y `backend/.env.example` — nuevas vars
- `frontend/src/App.jsx` — nuevas rutas
- `frontend/src/pages/Lista.jsx` — botón "Nueva Factura"
- `frontend/src/pages/Factura.jsx` — botón "Editar" que lleva a `/factura/:id/editar`

---

## Fuera de alcance

- Campo `Numero de Orden` en el formulario de creación (es una relación a otra DB — se asigna desde Notion directamente)
- Editar el campo Cliente de una factura existente
- Eliminar facturas completas
- Paginación del catálogo de inventario (se asume < 100 productos activos)
- Validación de stock disponible
