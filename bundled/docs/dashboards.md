# Dashboards

Buddy puede mostrar **dashboards**: ficheros en `user/dashboards/` con bloques
` ```dashboard ` que el visor renderiza en modo ancho. Son consultas guardadas
sobre ficheros que Buddy ya mantiene (`tasks`, `projects`, `logs`, `journal`) o
sobre markdown con secciones (`source: sections` + `path`) o CSV con
`source: series` + `path` (por ejemplo `user/data/registro.csv`; la cabecera
define los campos y el código infiere los tipos).

```dashboard
- view: table
  source: series
  path: user/data/ejemplo.csv
  columns: [date, amount, note]
```

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

### Ejemplos de consulta

Filtrar por texto en una serie CSV:

```dashboard
- view: table
  source: series
  path: user/data/paises.csv
  where: region = Europe
  columns: [name, region]
```

Filtrar por fecha relativa (últimos 30 días):

```dashboard
- view: table
  source: tasks
  where: date >= -30d
  columns: [text, due, state]
```

Contador con suma:

```dashboard
- view: counter
  title: Total amount
  source: series
  path: user/data/ventas.csv
  sum: amount
```

Contador agrupado:

```dashboard
- view: counter
  title: Tasks by state
  source: tasks
  group: state
  count: true
```

Antes de crear widgets sobre un CSV, descubre columnas sin leer el fichero con
`fields(source='series', path='user/data/paises.csv')` vía
`dashboard(action='fields', params={source:'series', path:'user/data/paises.csv'})`.
