---
type: dashboard
title: Mi semana
summary: Logs recientes y entradas de journal
---

```dashboard
- view: list
  title: Logs (7 días)
  source: logs
  range: -7d..today
  fields: [date, status, summary]
  limit: 14

- view: counter
  title: Días con journal esta semana
  source: journal
  count: true
  range: -7d..today
```
