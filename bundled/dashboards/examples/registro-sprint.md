---
type: dashboard
title: Ejemplo — registro de sprint
summary: Contador e inline de compromiso vs hecho
---

```dashboard
- view: counter
  title: Compromisos del sprint
  source: inline
  updated: 2026-10-01
  basis: Demo
  count: true
  rows:
    - id: 1
    - id: 2
    - id: 3

- view: table
  title: Entregables
  source: inline
  updated: 2026-10-01
  basis: Demo
  columns: [item, estado]
  rows:
    - item: API lista
      estado: hecho
    - item: Pruebas manuales
      estado: en curso
```
