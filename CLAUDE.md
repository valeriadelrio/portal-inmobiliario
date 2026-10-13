# Portal inmobiliario de Tandil

Ver SPEC.md para el alcance. Decisiones de arquitectura irán en ARCHITECTURE.md.

## Reglas
- Responder a la usuaria en español.
- Multi-tenant: toda consulta a propiedades debe filtrar por agencia según el rol.
- Nunca hardcodear zonas/barrios ni secretos; usar tablas y variables de entorno.
- Tests para cada feature; commits pequeños, uno por feature.
- Lo mínimo para la v1: no añadir funcionalidades fuera del SPEC.
