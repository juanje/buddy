# Dashboards

Buddy puede mostrar **dashboards**: ficheros en `user/dashboards/` con bloques
` ```dashboard ` que el visor renderiza en modo ancho. Son consultas guardadas
sobre ficheros que Buddy ya mantiene (`tasks`, `projects`, `logs`, `journal`) o
sobre markdown con secciones (`source: sections` + `path`).

## Crear y editar

Los dashboards **no** se escriben con `write`/`edit` directos. Usa la herramienta
`dashboard()`:

- `dashboard(action='create', params={name, template})` — plantillas "mis-tareas" o "mi-semana"
- `dashboard(action='create', params={name, content})` — contenido validado
- `dashboard(action='update', ...)` — sustituir un widget por título o reescribir el fichero
- `dashboard(action='examples')` — copia ejemplos inline a `user/dashboards/examples/`

## Patrones de ejemplo

Los ficheros en `user/dashboards/examples/` (después de `examples`) muestran:

- **Tablero** — kanban inline con columnas ordenadas
- **Registro de sprint** — contador + tabla inline
- **Registro de incidencias** — lista + tarjeta de estado

Todos usan solo `source: inline` para que funcionen en cualquier instancia.

## Consultas

Widgets admiten `where`, `group`, `sort`, `limit`, `count`, `sum` y `range` sobre
la fuente elegida. Usa `dashboard(action='fields', params={source})` para ver
campos y tipos sin leer filas.
