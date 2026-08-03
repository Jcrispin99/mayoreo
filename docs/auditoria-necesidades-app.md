# Auditoría de necesidades de la app

Fecha de revisión: 1 de agosto de 2026.

## Alcance

Esta revisión compara las necesidades indicadas con el estado actual del código del backend Laravel y de la app Expo/React Native.

Es una auditoría estática del código disponible en el repositorio. Confirma que las funciones existen en el código, pero no sustituye una prueba de aceptación en un ambiente desplegado con usuarios reales, dispositivos, impresora ni infraestructura VPN.

## Leyenda

- ✅ **Cumplido:** la necesidad principal está implementada tanto en la lógica como en una pantalla utilizable de la app.
- 🟡 **Parcial:** existe una parte importante o la capacidad de backend, pero falta completar el flujo solicitado en la app.
- ❌ **Falta:** no se encontró una implementación que cubra la necesidad.
- ⚪ **No verificable en este repositorio:** depende de infraestructura externa y no hay configuración suficiente para demostrarlo.

## Resumen ejecutivo

| Resultado | Cantidad |
|---|---:|
| ✅ Cumplido | 6 |
| 🟡 Parcial | 5 |
| ❌ Falta / ⚪ no verificable | 2 |
| **Total de necesidades revisadas** | **13** |

La app ya tiene una buena base para inventario, compras, ventas, POS, búsqueda, usuarios, roles y documentos fiscales. La coordinación POS-almacén ya permite preparación por ítem, cambios versionados y aviso visual mediante actualización periódica. Las brechas principales restantes son el ajuste directo de stock desde una pantalla, observaciones por pedido, alertas de precios, emisión fiscal visible desde la app y acceso restringido por VPN.

## Matriz de cumplimiento

| N.º | Necesidad | Estado | Lo que ya existe | Lo que falta |
|---:|---|:---:|---|---|
| 1 | Aumentar o agregar stock desde la app | 🟡 | La app permite registrar y confirmar compras; al confirmarlas se genera una entrada de stock. El backend también tiene el endpoint `POST /stocks/adjust` para aumentos y disminuciones manuales, protegido con `stock.manage`. | No hay una pantalla de la app para hacer un ajuste manual directo de stock por producto, almacén, cantidad, costo y observación. El módulo muestra existencias/Kardex, pero no expone ese endpoint. |
| 2 | Disminuir stock y vender desde la app | ✅ | El POS y la venta mayorista registran venta, pago, correlativo y salida de stock. El checkout vuelve a validar precios y stock antes de completar la operación. | Como mejora futura podrían agregarse devoluciones o anulaciones con reversión, pero no forman parte del requerimiento original. |
| 3 | Aumentar, disminuir o quitar ítems desde la app | ✅ | En una orden POS abierta se pueden agregar productos, usar botones `+`/`-`, escribir otra cantidad y eliminar la línea. También existe CRUD de productos del catálogo. | La edición se limita correctamente a órdenes abiertas; una venta completada queda inmutable. |
| 4 | Buscador con opciones en la app | ✅ | El POS busca por nombre, SKU o código de barras y ofrece filtros por favorito, código de barras, tipo, stock y precio. Las listas de productos, compras, ventas, usuarios, roles, clientes, inventario y otras secciones también incluyen búsqueda y filtros. | Sería conveniente validar con usuarios cuáles filtros deben quedar visibles por rol, pero la capacidad solicitada ya existe. |
| 5 | Control de usuarios | ✅ | Hay autenticación por token, cierre de sesión, recuperación de contraseña, CRUD de usuarios, CRUD de roles, asignación de roles, permisos por endpoint y ocultamiento de menús según permisos. | Conviene definir una política operativa para altas, bajas, bloqueo de cuentas y contraseñas, aunque el control funcional principal ya existe. |
| 6 | Privacidad de ingreso mediante VPN | ⚪ | La app de producción apunta a una URL HTTPS y la API exige autenticación Sanctum en sus rutas protegidas. | No hay configuración de WireGuard/OpenVPN/Tailscale, restricción por red o IP, ni evidencia de que el servidor solo sea accesible desde una VPN. El Nginx incluido escucha en HTTP/80 y CORS permite cualquier origen. HTTPS y token ayudan, pero **no equivalen a exigir VPN**. Esto debe resolverse y probarse en la infraestructura de despliegue. |
| 7 | Opciones de descuento, identificadas por color, para productos seleccionados | 🟡 | Existen precios por rango de cantidad, etiquetas de precio, variantes y atributos como color. Un valor de atributo puede modificar el precio de una variante. | No existe un concepto explícito de descuento manual o promoción, porcentaje/monto descontado, autorización de descuento, motivo, vigencia ni botones/colores de descuento en el POS. Tampoco se conserva el precio original frente al descuento aplicado. Se necesita precisar qué representa cada color. |
| 8 | Emitir boleta, nota de venta o factura desde la app | 🟡 | La app genera notas de venta con serie y correlativo tanto en POS como en venta mayorista. El backend soporta `sales_ticket`, `receipt` y `invoice`, conversión de una nota a boleta/factura, configuración SUNAT, certificado, envío y respuesta CDR. | El POS y la pantalla de nueva venta seleccionan únicamente serie de nota de venta. No se encontró en la app un botón para convertir/emitir boleta o factura, enviarla a SUNAT, ver su estado fiscal, descargar/compartir PDF o imprimir. La capacidad existe principalmente en backend. |
| 9 | Tres tipos de usuario: administrador, vendedor y almacén | 🟡 | Existen los roles preconfigurados `admin`, `cashier` y `warehouse`, además de `manager` y `viewer`. Almacén solo consulta y prepara los pedidos que le fueron asignados; el vendedor puede asignarlos. | Los nombres `cashier` y `warehouse` aún no coinciden literalmente con `vendedor` y `almacén`, y conviene terminar una prueba de aceptación de menús por perfil. |
| 10 | Descripción u observaciones en cada lista/pedido para almacén o delivery | ✅ | La orden POS tiene indicaciones generales y cada producto admite su propia indicación para almacén. Ambas se copian al pedido, se muestran en la cola asignada y cualquier edición posterior genera una versión nueva resaltada sin perder los checks preparados. | El alcance implementado es POS–almacén. Si posteriormente se crea un módulo independiente de reparto, deberá reutilizar o copiar estas indicaciones para delivery. |
| 11 | Modificar una lista en tiempo real y avisar al almacenero | ✅ | La orden POS permanece editable mientras almacén prepara. Cada alta, aumento, disminución o retiro actualiza el mismo pedido con una versión nueva; almacén consulta cada 4 segundos, ve tarjeta e ítems resaltados, confirma la revisión y marca cada línea alistada. Una versión antigua recibe conflicto `409`. El POS ve cuándo queda listo y confirma la recepción antes de cobrar. | WebSockets, push, sonido y vibración pueden reducir la demora y avisar con la app en segundo plano, pero no son necesarios para el flujo principal actualmente implementado. |
| 12 | Alertar a vendedores por cambios de precio y resaltar el ítem 48/72 horas | ❌ | Los precios por rango guardan `updated_at`, y el checkout detecta si el total cambió antes de cobrar. | No hay historial/evento de cambio de precio, destinatarios, notificación, sonido, confirmación de lectura ni resaltado temporal. El botón de notificaciones de la app actualmente solo muestra “No tienes notificaciones nuevas”. Tampoco hay configuración para elegir 48 o 72 horas. |
| 13 | Ingresar un monto libre para productos vendidos por gramos | 🟡 | El POS admite peso libre en gramos o kilogramos, valores rápidos y decimales. Calcula automáticamente el total usando el rango de precio correspondiente. | Solo se ingresa la **cantidad**. Falta el modo inverso: escribir, por ejemplo, `S/ 10.00` y que la app calcule los gramos equivalentes con una regla clara de redondeo, mostrando monto solicitado, peso calculado y monto final. |

## Evidencia principal en el código

### Inventario, compras y ventas

- Rutas de stock, POS, ventas, usuarios y documentos fiscales: [`routes/api/v1.php`](../routes/api/v1.php).
- Ajuste manual de stock en backend: [`app/Http/Controllers/Api/V1/StockController.php`](../app/Http/Controllers/Api/V1/StockController.php) y [`app/Actions/Inventory/AdjustStockAction.php`](../app/Actions/Inventory/AdjustStockAction.php).
- Registro centralizado de entradas y salidas de stock: [`app/Services/StockLedgerService.php`](../app/Services/StockLedgerService.php).
- Edición de líneas de una orden abierta: [`app/Actions/Pos/SavePosOrderItemAction.php`](../app/Actions/Pos/SavePosOrderItemAction.php).
- Interfaz para aumentar, disminuir y retirar líneas: [`frontend/features/pos/pos-order-panel.tsx`](../frontend/features/pos/pos-order-panel.tsx).
- Registro de ventas mayoristas desde la app: [`frontend/features/accounting/accounting-sale-form.tsx`](../frontend/features/accounting/accounting-sale-form.tsx).

### Búsqueda, precios y venta por peso

- Catálogo POS con buscador y filtros: [`frontend/features/pos/pos-product-catalog.tsx`](../frontend/features/pos/pos-product-catalog.tsx).
- Precios por rango de cantidad: [`frontend/features/products/product-sale-prices.tsx`](../frontend/features/products/product-sale-prices.tsx).
- Entrada libre de gramos/kilogramos: [`frontend/features/pos/pos-quantity-editor.tsx`](../frontend/features/pos/pos-quantity-editor.tsx).
- Variantes y atributos, incluido el precio adicional por valor: [`frontend/features/products/product-attributes-form.tsx`](../frontend/features/products/product-attributes-form.tsx).

### Usuarios y permisos

- Roles y permisos iniciales: [`database/seeders/RolePermissionSeeder.php`](../database/seeders/RolePermissionSeeder.php).
- Administración de usuarios y roles en la app: [`frontend/features/access/access-reference-form.tsx`](../frontend/features/access/access-reference-form.tsx).
- Menús filtrados por permiso: [`frontend/config/menu.ts`](../frontend/config/menu.ts).

### Comandas, tiempo real y notificaciones

- Solicitudes de preparación/reposición desde el POS: [`app/Actions/Pos/RequestPosOrderSupplyAction.php`](../app/Actions/Pos/RequestPosOrderSupplyAction.php).
- Sincronización versionada de cambios del POS: [`app/Actions/Pos/SyncPosSupplyRequestAction.php`](../app/Actions/Pos/SyncPosSupplyRequestAction.php).
- Checks, revisión y estado listo de almacén: [`app/Actions/Pos/ManagePosSupplyPreparationAction.php`](../app/Actions/Pos/ManagePosSupplyPreparationAction.php).
- Cola de almacén con consulta cada 4 segundos: [`frontend/features/inventory/pos-supply-request-list.tsx`](../frontend/features/inventory/pos-supply-request-list.tsx).
- El botón de notificaciones aún es informativo: [`frontend/components/module/module-layout.tsx`](../frontend/components/module/module-layout.tsx).
- No se encontraron dependencias o implementaciones de WebSockets, notificaciones push o reproducción de sonidos en los paquetes actuales.

### Documentos fiscales

- Modelado de nota de venta, boleta y factura: [`database/migrations/2026_07_17_121500_create_fiscal_documents_table.php`](../database/migrations/2026_07_17_121500_create_fiscal_documents_table.php).
- Conversión a boleta/factura: [`app/Actions/Sales/IssueFiscalDocumentPlaceholderAction.php`](../app/Actions/Sales/IssueFiscalDocumentPlaceholderAction.php).
- Envío electrónico y consulta de resultado SUNAT: [`app/Services/FiscalDocumentTransmissionService.php`](../app/Services/FiscalDocumentTransmissionService.php).
- El checkout POS genera actualmente una nota de venta: [`app/Actions/Pos/CompletePosOrderAction.php`](../app/Actions/Pos/CompletePosOrderAction.php).

### Seguridad de red

- Cliente de la app y URL de API: [`frontend/lib/api.ts`](../frontend/lib/api.ts).
- Autenticación/token en la app: [`frontend/lib/auth-context.tsx`](../frontend/lib/auth-context.tsx).
- Configuración Nginx local sin restricción VPN: [`docker/nginx/default.conf`](../docker/nginx/default.conf).
- CORS actual: [`config/cors.php`](../config/cors.php).

## Brechas prioritarias

### Prioridad 0: seguridad y operación básica

1. **Definir y exigir el acceso por VPN.**
   - Elegir la tecnología y topología.
   - Hacer que la API no sea accesible directamente desde Internet.
   - Mantener HTTPS incluso dentro de la VPN.
   - Restringir firewall, proxy y administración.
   - Probar acceso permitido desde VPN y rechazado fuera de ella.

2. **Crear los perfiles exactos `administrador`, `vendedor` y `almacén`.**
   - Documentar permisos por módulo y acción.
   - Evitar que vendedor cambie precios, usuarios o stock arbitrariamente.
   - Permitir que almacén vea y resuelva comandas, existencias y movimientos necesarios.
   - Probar menús y respuestas 403 para cada rol.

3. **Agregar la pantalla de ajuste manual de stock.**
   - Producto, almacén, aumentar/disminuir, cantidad, costo cuando corresponda y observación obligatoria.
   - Confirmación antes de guardar y visualización inmediata en Kardex.

### Prioridad 1: coordinación comercial y almacén

4. **Modelar pedido/comanda con observaciones editables.**
   - Observación general del pedido.
   - Observación opcional por línea.
   - Instrucciones separadas para almacén y delivery.
   - Historial de quién cambió qué y cuándo.

5. **Mejorar las alertas de pedidos para segundo plano.**
   - Mantener el versionado, confirmación de lectura y recuperación por consulta ya implementados.
   - Agregar WebSockets o push cuando se disponga de infraestructura y credenciales.
   - Incorporar sonido/vibración configurables sin duplicar avisos.

6. **Implementar aviso de cambios de precio.**
   - Registrar precio anterior, nuevo, producto, administrador y fecha.
   - Notificar solo a los roles necesarios.
   - Resaltar el producto durante 48 o 72 horas, según una configuración única.
   - Evitar que una simple edición de nombre o imagen active el aviso.

7. **Completar boleta y factura en la app.**
   - Elegir tipo de documento y serie.
   - Validar cliente/documento según reglas fiscales.
   - Enviar a SUNAT, mostrar estado y errores.
   - Generar, descargar, compartir o imprimir representación PDF.

8. **Definir descuentos y su significado por color.**
   - Aclarar si el color representa porcentaje, campaña, autorización o tipo de cliente.
   - Guardar descuento por línea y/o total, precio original, motivo y usuario autorizador.
   - Mostrar el descuento antes de confirmar y en el comprobante.

### Prioridad 2: facilidad de venta

9. **Agregar venta por monto libre.**
   - Selector `Por peso` / `Por monto`.
   - Cálculo inverso de gramos según el precio/rango aplicable.
   - Regla explícita de redondeo.
   - Confirmación visible del peso y total finales.

## Criterios mínimos para considerar todo cumplido

- Un administrador puede aumentar o disminuir stock desde una pantalla y el movimiento aparece en Kardex.
- Un vendedor puede crear, modificar y cobrar una orden sin permisos administrativos.
- Un usuario de almacén recibe cambios de pedido sin recargar manualmente y puede distinguir ítems nuevos, modificados y retirados.
- Todas las órdenes tienen observaciones generales y por línea disponibles para almacén/delivery.
- Los cambios de precio generan un aviso real y un resaltado con vencimiento comprobable.
- El POS permite nota de venta, boleta o factura desde una interfaz completa, incluido estado SUNAT y salida imprimible/compartible.
- Un producto por peso se puede vender escribiendo gramos, kilogramos o un monto monetario.
- La API rechaza conexiones fuera de la VPN y mantiene autenticación, permisos y HTTPS dentro de ella.
- Los roles activos coinciden exactamente con la política aprobada para administrador, vendedor y almacén.

## Conclusión

**Todavía no se cumplen todas las necesidades.** La app ya cubre completamente la venta con salida de stock, la edición básica de ítems, la búsqueda con filtros y el control general de usuarios. Siete necesidades están parcialmente resueltas y dos —VPN verificable y alertas temporales por cambio de precio— requieren implementación específica.

La ruta más corta para una primera operación segura es: VPN y roles definitivos, ajuste de stock desde la app, observaciones de pedido y sincronización de comandas. Después conviene completar comprobantes fiscales, alertas de precio, descuentos y venta por monto libre.
