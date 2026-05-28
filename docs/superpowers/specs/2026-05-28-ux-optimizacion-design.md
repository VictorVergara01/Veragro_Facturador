# UX Optimización — Design Spec

**Fecha:** 2026-05-28
**Proyecto:** AgroTech Drones Facturador
**Alcance:** Tres mejoras focalizadas para hacer el flujo diario más rápido y con mejor feedback

---

## Resumen

Mejoras quirúrgicas para un usuario conocido que crea facturas de 5-15 productos. Sin reescribir arquitectura — eliminar los tres puntos de fricción principales: falta de feedback, PDF incompleto, y lentitud al agregar productos.

---

## Sección 1 — Sistema de toasts

### Problema
Toda retroalimentación usa `alert()` bloqueante o silencio total. El usuario no sabe si el estado se guardó, si la línea se añadió, o si el PDF se generó correctamente.

### Solución
Componente `Toast` minimalista sin librerías externas.

**Archivos:**
- Crear: `frontend/src/components/Toast.jsx` — componente visual + hook `useToast`
- Modificar: `frontend/src/App.jsx` — añadir `ToastProvider` y `ToastContainer`
- Modificar: `frontend/src/pages/Lista.jsx` — usar toast en cambio de estado
- Modificar: `frontend/src/pages/Factura.jsx` — usar toast en descarga PDF y cambio estado
- Modificar: `frontend/src/pages/EditarFactura.jsx` — usar toast en todas las acciones (añadir, editar, eliminar línea, cancelar, cambio estado)

**Comportamiento:**
- Aparece abajo a la derecha
- Verde con ✓ para éxito, rojo con ✕ para error
- Se desvanece automáticamente en 3 segundos
- Máximo 3 toasts simultáneos (los más viejos se desplazan)
- Reemplaza todos los `alert()` y `confirm()` del sistema

**API del hook:**
```js
const { showToast } = useToast();
showToast('Estado actualizado', 'success');
showToast('Error al guardar', 'error');
```

---

## Sección 2 — PDF completo y datos bancarios configurables

### Problema
- Datos bancarios hardcodeados con valores placeholder en `pdf.js`
- Método de pago no aparece en el PDF que ve el cliente
- Tipo de cuenta no configurable

### Solución

**Nuevas variables de entorno en `backend/.env` y `backend/.env.example`:**
```
EMPRESA_BANCO=Banco General
EMPRESA_TIPO_CUENTA=Corriente
EMPRESA_CUENTA=04-88-888888-8
EMPRESA_CUENTA_NOMBRE=AgroTech Drones S.A.
EMPRESA_YAPPY=+507 6000-0000
```

**Sección de pago en el PDF resultante:**
```
Información de Pago
Banco General
Cuenta Corriente: 04-88-888888-8
A nombre de: AgroTech Drones S.A.
Yappy: +507 6000-0000
Método de pago: Yappy              ← solo si viene en el request
```

**Cambios en código:**
- `backend/src/pdf.js`: reemplazar strings hardcodeados por `process.env.EMPRESA_*` con fallback a los valores actuales
- `backend/src/pdf.js`: añadir línea de Método de pago después de Yappy (solo si `metodoPago` está definido)
- `backend/src/server.js`: pasar `metodoPago` a `buildHTML` (actualmente se guarda en Notion pero no llega al PDF)

**Archivos:**
- Modificar: `backend/src/pdf.js`
- Modificar: `backend/src/server.js`
- Modificar: `backend/.env` + `backend/.env.example`

---

## Sección 3 — Velocidad en `/editar`

### Problema
Agregar 10 productos requiere: clic en buscador → escribir → seleccionar → ajustar cantidad → clic en botón → repetir. Demasiados clics.

### Solución

**1. Auto-foco en buscador**
Al montar `EditarFactura`, el cursor queda automáticamente en el campo de búsqueda de inventario (`BuscadorProducto`). El usuario puede empezar a escribir inmediatamente sin clic.

Implementación: `BuscadorProducto` acepta prop `autoFocus` que pasa al `<input>` interno. `EditarFactura` lo pasa como `autoFocus={true}`.

**2. Enter para añadir línea**
Cuando el campo "Producto" (`newLine.descripcion`) tiene texto, presionar Enter en cualquier campo del formulario de nueva línea ejecuta `handleAddLine()`. Implementado con `onKeyDown` en los inputs del formulario.

**3. Feedback visual inline en tabla**
- Eliminar línea: en lugar de `confirm()`, mostrar toast de confirmación + la fila desaparece con una transición de opacidad
- Actualizar línea (onBlur): la celda destella brevemente en verde si guardó bien, rojo si falló
- Implementado con estado local `savingLines: { [lineId]: 'saving' | 'ok' | 'error' }` y clases CSS condicionales

**Archivos:**
- Modificar: `frontend/src/components/BuscadorProducto.jsx` — prop `autoFocus`
- Modificar: `frontend/src/pages/EditarFactura.jsx` — auto-focus, Enter handler, feedback visual

---

## Fuera de alcance

- Fusionar `/nueva` y `/editar` en una sola página
- Multi-página en PDF
- Logo de empresa en PDF
- Ver facturas canceladas
- Optimización de N+1 en listado (ya funcional, mejora de performance futura)
