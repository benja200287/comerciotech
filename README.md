# ComercioTech API

Pequeña API para administrar clientes usando Express y MongoDB.

## Requisitos
- Node.js 16+ instalado
- MongoDB accesible y en funcionamiento

## Cómo ejecutar
1. Instala dependencias:

```bash
npm install
```

2. Inicia el servidor:

```bash
npm start
# o
node index.js
```

3. Abre el navegador en:

```text
http://localhost:3000
```

## Rutas disponibles

- `GET /` — abre el formulario web para crear clientes.
- `GET /clientes` — obtiene la lista de clientes en JSON.
- `GET /clientes/:id` — obtiene un cliente por su id en JSON.
- `POST /clientes` — crea un cliente nuevo.
- `PUT /clientes/:id` — actualiza un cliente existente.
- `DELETE /clientes/:id` — elimina un cliente.

## Validaciones

- `nombre` y `email` son obligatorios al crear un cliente.
- `email` se normaliza (minúsculas y trim) y debe ser único.
- Las respuestas de error se devuelven en JSON con campos `error` y `details`.

## Ejemplos `curl`

### Crear cliente

```bash
curl -X POST http://localhost:3000/clientes \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Ana Perez","email":"ana@example.com","direccion":"Calle 123","telefono":"+56912345678"}'
```

### Listar todos los clientes

```bash
curl http://localhost:3000/clientes
```

### Obtener cliente por id

```bash
curl http://localhost:3000/clientes/CLIENTE_ID
```

### Actualizar cliente

```bash
curl -X PUT http://localhost:3000/clientes/CLIENTE_ID \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Ana Actualizada","email":"ana.nuevo@example.com"}'
```

### Eliminar cliente

```bash
curl -X DELETE http://localhost:3000/clientes/CLIENTE_ID
```

## Nota

Si `http://localhost:3000` siempre redirige al formulario, eso es normal porque la ruta raíz está configurada para cargar `form.html`. Puedes acceder directamente a la API en `/clientes`.

