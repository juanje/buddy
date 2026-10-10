---
type: dashboard
title: Ejemplo — registro de incidencias
summary: Lista inline de incidencias abiertas
---

```dashboard
- view: list
  title: Incidencias abiertas
  source: inline
  updated: 2026-10-01
  basis: Demo
  fields: [severidad, desde]
  rows:
    - text: Caída del pipeline
      severidad: alta
      desde: 2026-10-05
    - text: Informe lento
      severidad: media
      desde: 2026-10-06

- view: status
  title: Salud global
  source: inline
  updated: 2026-10-01
  basis: Demo
  rows:
    - label: Servicios críticos
      state: warn
      reason: Una incidencia alta abierta
```
