---
type: dashboard
title: Mis tareas
summary: Tablero mínimo sobre tasks.md
---

```dashboard
- view: kanban
  title: Por estado
  source: tasks
  group: state
  fields: [area, project]

- view: counter
  title: Siguientes acciones
  source: tasks
  count: true
  where: state = next
```
