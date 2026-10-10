---
type: dashboard
title: Ejemplo — tablero inline
summary: Patrón de tablero solo con datos inline (sin ficheros externos)
---

```dashboard
- view: kanban
  title: Flujo de ejemplo
  source: inline
  updated: 2026-10-01
  basis: Demo estática embebida
  group: estado
  order: [nuevo, en_curso, hecho]
  fields: [prioridad]
  rows:
    - text: Revisar correo
      estado: en_curso
      prioridad: media
    - text: Escribir informe
      estado: nuevo
      prioridad: alta

- view: text
  title: Notas
  source: inline
  updated: 2026-10-01
  basis: Demo
  text: Los ejemplos en `user/dashboards/examples/` usan solo inline para poder copiarse sin dependencias.
```
