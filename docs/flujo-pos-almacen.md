# Flujo POS–almacén

Fecha de implementación y verificación: 1 de agosto de 2026.

## Comportamiento implementado

1. El vendedor envía una orden abierta a un usuario con rol `warehouse`.
2. Solo ese usuario ve el pedido en su cola de almacén.
3. Almacén confirma que revisó la versión actual y marca cada producto preparado.
4. El POS puede seguir agregando, aumentando, disminuyendo o retirando productos durante la preparación.
5. El POS puede registrar una indicación general para todo el pedido y otra específica para cada producto.
6. Cada cambio del POS incrementa la versión del pedido, lo deja en `changes_pending` y resalta en almacén los ítems `added`, `increased`, `decreased`, `removed` o `note_changed`.
7. La cantidad ya preparada se conserva. Si el POS disminuye o retira una línea, almacén debe corregir su check/cantidad antes de marcar el pedido listo.
8. Una acción de almacén enviada con una versión antigua responde `409`, evitando completar una lista desactualizada.
9. Almacén marca el pedido `ready`; el POS lo detecta por polling y confirma la recepción física.
10. Recién al confirmar la recepción se crea y completa el traslado de inventario. La venta permanece bloqueada únicamente hasta esa confirmación; otras órdenes del POS siguen operativas.

Estados: `assigned → preparing → changes_pending → preparing → ready → delivered`. La cancelación de la orden lleva el pedido a `cancelled`.

## Actualización móvil

POS y almacén consultan cambios cada 4 segundos. Esto funciona sin infraestructura adicional y recupera el estado correcto después de una desconexión. No incluye todavía notificación push, sonido o vibración con la app en segundo plano; esa mejora requerirá configurar el servicio de push o WebSockets del ambiente desplegado.

## Verificación realizada

- Suite backend: 275 pruebas, 1228 aserciones, todas aprobadas.
- TypeScript de Expo: `npx tsc --noEmit`, sin errores.
- Formato de archivos modificados: aprobado.
- Prueba HTTP real con `curl`: creación de orden, asignación, revisión v1, check parcial, modificación desde POS, rechazo `409` de acción obsoleta, revisión v2, pedido listo, polling del POS, recepción, traslado y cobro `201`.
- Resultado de la prueba HTTP: orden 5 completada, venta 3, traslado 3 y cola del usuario de almacén vacía.
- Prueba HTTP de indicaciones: la orden 6 envió una nota general y una nota por producto; una edición posterior produjo la versión 2 con `change_type=note_changed`, visible en la cola asignada. La orden de prueba fue cancelada y ambas sesiones se cerraron.

Las migraciones `2026_08_01_030000_create_pos_supply_requests_table` y `2026_08_01_040000_add_warehouse_notes_to_pos_orders`, junto con el permiso `pos-supply-requests.prepare-assigned`, quedaron aplicadas en el ambiente local.
