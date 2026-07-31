# Diccionario de palabras de la interfaz

Fecha del mapeo: 30 de julio de 2026.

## Objetivo

Este documento inventaría las palabras visibles del frontend y propone alternativas más cotidianas. No cambia ningún texto de la aplicación todavía.

Cada propuesta debe ser revisada por las personas que realmente trabajan como administrador, vendedor y almacenero. La última columna queda pendiente para registrar la palabra elegida por el negocio.

## Cómo usar este documento

| Columna | Significado |
|---|---|
| Texto actual | Palabra que hoy muestra la app |
| Problema | Por qué puede ser difícil, técnica o ambigua |
| Sugerencia inicial | Alternativa propuesta para conversar |
| Palabra aprobada | Decisión final del negocio; todavía pendiente |

No todas las palabras deben cambiar. Algunos términos fiscales deben mantenerse porque aparecen en documentos oficiales, pero pueden acompañarse de una explicación sencilla.

## Decisiones aprobadas

| Texto actual | Texto aprobado |
|---|---|
| Configuraciones | Ajustes |
| Catálogo de productos | Productos |
| Directorio de clientes | Clientes |
| Buscar registros | Buscar |
| Filtros múltiples | Filtros |
| Predeterminado | Principal |
| Contabilidad | Ventas |
| Registro de ventas | Ventas |
| POS | POS; se mantiene |
| Stock | Stock; se mantiene |
| Factor | Contenido; mostrar también la unidad, por ejemplo: `Contenido: 12 unidades` |

## Cobertura del frontend

| Área | Pantallas revisadas | Archivo principal |
|---|---|---|
| Ingreso | Correo, contraseña e inicio de sesión | [`frontend/app/login.tsx`](../frontend/app/login.tsx) |
| Navegación | Inicio, módulos, menú lateral, aplicaciones y perfil | [`frontend/config/menu.ts`](../frontend/config/menu.ts) |
| Productos | Lista, creación, edición, imagen y favoritos | [`frontend/features/products/product-list.tsx`](../frontend/features/products/product-list.tsx) |
| Presentaciones | Atributos, variantes, combinaciones y contenido | [`frontend/features/products/product-attributes-form.tsx`](../frontend/features/products/product-attributes-form.tsx) |
| Precios | Rangos, cantidades y precio por unidad | [`frontend/features/products/product-sale-prices.tsx`](../frontend/features/products/product-sale-prices.tsx) |
| Inventario | Tiendas, almacenes, unidades, Kardex y movimientos | [`frontend/features/inventory/inventory-reference-list.tsx`](../frontend/features/inventory/inventory-reference-list.tsx) |
| Almacén | Comandas y preparación de pedidos | [`frontend/features/inventory/pos-supply-request-list.tsx`](../frontend/features/inventory/pos-supply-request-list.tsx) |
| Compras | Compras, proveedores y líneas de productos | [`frontend/features/purchases/purchase-order-form.tsx`](../frontend/features/purchases/purchase-order-form.tsx) |
| Cajas | Configuración, apertura, cierre y turnos | [`frontend/features/pos/cash-register-form.tsx`](../frontend/features/pos/cash-register-form.tsx) |
| POS | Catálogo, lector, pedidos, cantidades y cobro | [`frontend/features/pos/pos-terminal-shell.tsx`](../frontend/features/pos/pos-terminal-shell.tsx) |
| Comprobantes | Series, correlativos y tipos de documento | [`frontend/features/pos/document-series-form.tsx`](../frontend/features/pos/document-series-form.tsx) |
| Clientes | Lista, creación y edición | [`frontend/features/customers/customer-form.tsx`](../frontend/features/customers/customer-form.tsx) |
| Ventas | Historial y venta mayorista | [`frontend/features/accounting/accounting-sale-form.tsx`](../frontend/features/accounting/accounting-sale-form.tsx) |
| Usuarios | Usuarios, roles y permisos | [`frontend/features/access/access-reference-form.tsx`](../frontend/features/access/access-reference-form.tsx) |
| SUNAT | Emisor, Clave SOL, certificado, establecimientos y series | [`frontend/features/settings/sunat-settings-screen.tsx`](../frontend/features/settings/sunat-settings-screen.tsx) |
| Mensajes comunes | Búsqueda, filtros, paginación, vacíos y errores | [`frontend/components/data/list-toolbar.tsx`](../frontend/components/data/list-toolbar.tsx) |

## Inconsistencias que deben resolverse primero

### Stock, existencias e inventario

La app usa las tres palabras para conceptos cercanos:

- `Inventario` como módulo.
- `Existencias` como cantidad disponible.
- `Stock` dentro del POS y mensajes.

Propuesta inicial:

```text
Módulo: Productos y stock
Cantidad disponible: Stock
Historial: Entradas y salidas
```

Decisión parcial del negocio:

- `Stock` se mantiene.
- `Existencias` se unificará como `Stock`.
- El nombre del módulo `Inventario` sigue pendiente.

### Orden, pedido, lista y comanda

Hoy aparecen:

- `Orden` dentro del POS.
- `Comanda` para almacén.
- `Pedido de stock`.
- `Orden de compra`.

Propuesta inicial:

```text
Venta en preparación: Pedido
Solicitud hacia almacén: Pedido al almacén
Compra a proveedor: Compra
```

`Orden de compra` puede mantenerse solo donde sea necesario para administración.

Palabra elegida por el negocio: **Pendiente**.

### Variante, presentación y combinación

Hoy aparecen:

- `Variante`.
- `Variante principal`.
- `Combinación`.
- `Atributo`.
- `Factor`.

Propuesta inicial:

```text
Variante: Presentación
Variante principal: Producto principal
Combinación: Presentación
Atributo: Opción
Factor: Contenido
```

Palabra elegida por el negocio: **Pendiente**.

### Rango, tarifa y tipo de precio

La interfaz usa `Rango`, mientras algunos errores hablan de `Tarifa`. El negocio usa Gramero, Kilo, Mayor y Emprendedor.

Propuesta inicial:

```text
Nombre general: Tipo de precio
Valores: Gramero / Kilo / Mayor / Emprendedor
```

Palabra elegida por el negocio: **Pendiente**.

### Caja con dos significados

`Caja` puede significar:

1. el lugar/dispositivo donde el vendedor cobra;
2. una presentación de producto, por ejemplo caja/docena.

Propuesta inicial:

```text
Cobro: Caja de venta
Presentación: Caja x 12
Dinero físico: Dinero en caja
```

Palabra elegida por el negocio: **Pendiente**.

### Activo, visible y disponible

`Activo` es correcto para el sistema, pero no siempre explica la consecuencia.

Propuesta por contexto:

```text
Producto activo: Se puede vender
Proveedor activo: Disponible para compras
Caja activa: Lista para usar
Serie activa: Se puede usar
Usuario activo: Tiene acceso
Visible en POS: Aparece al vender
```

Palabras elegidas por el negocio: **Pendiente**.

## Diccionario general y navegación

| Texto actual | Problema | Sugerencia inicial | Palabra aprobada |
|---|---|---|---|
| Aplicaciones | Suena a varias apps diferentes | Secciones | Pendiente |
| Módulo | Término de software | Sección | Pendiente |
| Inventario | Puede sentirse administrativo | Productos y stock | Pendiente |
| Configuraciones | Largo y técnico | Ajustes | Ajustes |
| Contabilidad | El módulo muestra principalmente ventas | Ventas | Ventas |
| Catálogo | Formal | Lista | Pendiente |
| Directorio | Formal | Lista | Pendiente |
| Registro | Puede significar crear o historial | Historial | Pendiente |
| Detalle | Aceptable, pero poco directo como acción | Ver | Pendiente |
| Operaciones | Muy general | Movimientos | Pendiente |
| Accesos | Técnico | Quién puede entrar | Pendiente |
| Buscar registros | “Registros” es técnico | Buscar | Buscar |
| Filtros | Comprensible, pero puede simplificarse | Mostrar solo | Pendiente |
| Filtros múltiples | Técnico e innecesario | Filtros | Filtros |
| Sin coincidencias | Formal | No encontramos resultados | Pendiente |
| Sin resultados | Correcto | No encontramos nada | Pendiente |
| Página anterior | Correcto | Anterior | Pendiente |
| Página siguiente | Correcto | Siguiente | Pendiente |
| Notificaciones | Aceptable | Avisos | Pendiente |
| Perfil | Aceptable | Mi cuenta | Pendiente |
| Cerrar sesión | Aceptable | Salir de mi cuenta | Pendiente |
| Estado | General | Cómo está | Pendiente |
| Activo | No explica qué habilita | Disponible / En uso | Depende del contexto |
| Inactivo | No explica la consecuencia | No disponible / Fuera de uso | Depende del contexto |
| Predeterminado | Palabra larga | Principal | Principal |
| Referencia | Ambigua | N.° de operación / Dato de referencia | Depende del contexto |

## Productos y stock

| Texto actual | Problema | Sugerencia inicial | Palabra aprobada |
|---|---|---|---|
| Productos | Claro | Productos | Mantener |
| Catálogo de productos | Formal | Productos | Productos |
| Stock | Palabra conocida por el negocio | Stock | Mantener |
| Existencias | Inconsistente con “stock” | Stock | Stock |
| Inventario | Puede confundirse con conteo físico | Productos y stock | Pendiente |
| Kardex | Término contable/técnico | Entradas y salidas | Pendiente |
| Movimiento de inventario | Técnico | Cambio de stock | Pendiente |
| Entrada | Aceptable | Entró | Pendiente |
| Salida | Aceptable | Salió | Pendiente |
| Saldo | Puede parecer dinero | Quedó | Pendiente |
| Ajuste | No explica si suma o resta | Corregir stock | Pendiente |
| Transferencia | Formal | Envío entre almacenes | Pendiente |
| Transferencia enviada | Formal | Envío en camino | Pendiente |
| Transferencia recibida | Formal | Envío recibido | Pendiente |
| Almacén | Claro para el negocio | Almacén | Mantener |
| Almacén predeterminado | Largo | Almacén principal | Pendiente |
| Almacén de destino | Formal | A dónde llega | Pendiente |
| Almacén de salida | Formal | De dónde sale | Pendiente |
| Ubicación | Puede significar almacén o estante | Dónde está | Pendiente |
| Unidad de medida | Técnico | Cómo se vende / Cómo se cuenta | Pendiente |
| Conteo | Técnico | Por unidad | Pendiente |
| Peso | Claro | Por peso | Pendiente |
| Volumen | Formal | Por litro | Pendiente |
| Unidad base | Muy técnico | Unidad principal | Pendiente |
| Cantidad base | Muy técnico | Cantidad real de stock | Pendiente |
| SKU | Código técnico | Código interno | Pendiente |
| Código de barras | Claro | Código de barras | Mantener |
| Descripción | Aceptable | Detalles | Pendiente |
| Producto activo | No explica el resultado | Se puede vender | Pendiente |
| Visible en POS | Usa sigla técnica | Aparece al vender | Pendiente |
| Favorito | Claro | Favorito | Mantener |
| Stock en cero | Técnico | Sin stock | Pendiente |
| Stock negativo | Puede no entenderse | Hay un problema con el stock | Pendiente |
| Con stock | Claro | Disponible | Pendiente |
| Sin precio | Claro | Falta precio | Pendiente |
| Precio no configurado | Técnico | Falta poner el precio | Pendiente |

## Presentaciones y atributos

| Texto actual | Problema | Sugerencia inicial | Palabra aprobada |
|---|---|---|---|
| Variante | Técnico | Presentación | Pendiente |
| Variantes | Técnico | Presentaciones | Pendiente |
| Variante principal | Técnico | Producto principal | Pendiente |
| Producto simple | Técnico | Una sola presentación | Pendiente |
| Combinación | Técnico | Presentación | Pendiente |
| Atributo | Término de sistemas | Opción | Pendiente |
| Atributos | Término de sistemas | Opciones del producto | Pendiente |
| Valor | Demasiado general | Alternativa | Pendiente |
| Factor | Técnico | Contenido | Contenido; mostrar valor y unidad |
| Precio base | Puede confundirse con costo | Precio inicial | Pendiente |
| Principal | Sin contexto | Presentación principal | Pendiente |
| Granel | Término del negocio | Granel | Mantener |
| Medido | Técnico | Por peso / Por volumen | Depende del producto |
| Por unidad | Claro | Por unidad | Mantener |
| Por peso | Claro | Por peso | Mantener |
| Por volumen | Algo formal | Por litro | Pendiente |
| Contenido | Claro | Contiene | Pendiente |
| Producto sin atributos | Técnico | Producto sin opciones | Pendiente |
| Agregar atributo | Técnico | Agregar opción | Pendiente |
| Nuevo valor | Sin contexto | Agregar alternativa | Pendiente |
| Cantidad de la variante | Técnico | ¿Cuántas presentaciones? | Pendiente |
| Costo unitario de la variante | Largo y técnico | Costo por presentación | Pendiente |
| Línea de la compra | Técnico | Producto de la compra | Pendiente |
| Subtotal de la línea | Técnico | Subtotal del producto | Pendiente |

## Precios

| Texto actual | Problema | Sugerencia inicial | Palabra aprobada |
|---|---|---|---|
| Precios de venta | Claro | Precios | Pendiente |
| Rango | Técnico para el usuario | Tipo de precio | Pendiente |
| Rangos | Técnico | Tipos de precio | Pendiente |
| Tarifa | Inconsistente con “rango” | Tipo de precio | Pendiente |
| Nombre del rango | Técnico | Nombre del precio | Pendiente |
| Cantidad desde | Poco conversacional | Desde cuánto | Pendiente |
| Cantidad hasta | Poco conversacional | Hasta cuánto | Pendiente |
| Precio aplicado | Formal | Precio usado | Pendiente |
| Precio activo | No explica el efecto | Se puede usar | Pendiente |
| Sin rango | Técnico | Sin tipo de precio | Pendiente |
| Menudeo | No coincide con el vocabulario dado | Gramero | Pendiente |
| Mayorista | El negocio usa otro nombre | Mayor | Pendiente |
| Precio por kg | Claro | Precio por kilo | Pendiente |
| Precio por unidad base | Muy técnico | Precio por kilo/unidad | Según producto |
| No existe un precio activo para esta cantidad | Largo | No hay precio para esta cantidad | Pendiente |
| No hay una tarifa activa para esta cantidad | Usa otra palabra | No hay precio para esta cantidad | Pendiente |
| El total cambió | Falta explicar por qué | El precio cambió; revisa el pedido | Pendiente |
| Validado nuevamente por el servidor | Muy técnico | Revisaremos el precio antes de cobrar | Pendiente |

## Compras y proveedores

| Texto actual | Problema | Sugerencia inicial | Palabra aprobada |
|---|---|---|---|
| Compras | Claro | Compras | Mantener |
| Orden de compra | Formal | Compra | Pendiente |
| Proveedor | Claro para el negocio | Proveedor | Mantener |
| Borrador | Puede no explicar el estado | Sin confirmar | Pendiente |
| Confirmada | Claro | Recibida / Confirmada | Pendiente |
| Cancelada | Claro | Cancelada | Mantener |
| Guardar borrador | Formal | Guardar sin confirmar | Pendiente |
| Confirmar compra | Claro | Recibir compra | Pendiente |
| Almacén de destino | Formal | A qué almacén llega | Pendiente |
| Fecha (AAAA-MM-DD) | Formato técnico | Fecha | Pendiente |
| Serie de factura | Fiscal, puede mantenerse | Serie de la factura | Pendiente |
| Correlativo de factura | Técnico/fiscal | Número de factura | Pendiente |
| Nota u observación | Dos palabras para lo mismo | Nota | Pendiente |
| Número de documento | Ambiguo | RUC o documento | Pendiente |
| Cantidad | Claro | Cantidad | Mantener |
| Costo unitario | Formal pero útil | Cuánto costó cada uno | Pendiente |
| Subtotal | Comercial y común | Subtotal | Mantener |
| Total | Claro | Total | Mantener |
| Ítem / ítems | Anglicismo | Producto / productos | Pendiente |

## Caja, POS y cobro

| Texto actual | Problema | Sugerencia inicial | Palabra aprobada |
|---|---|---|---|
| POS | Sigla conocida por el negocio | POS | Mantener |
| POS móvil | Nombre conocido por el negocio | POS móvil | Mantener |
| Terminal | Técnico | Pantalla de venta | Pendiente |
| Caja | Choca con presentación de producto | Caja de venta | Pendiente |
| Caja activa | No explica el resultado | Lista para usar | Pendiente |
| Apertura de caja | Formal | Abrir caja | Pendiente |
| Efectivo inicial | Formal | Dinero al comenzar | Pendiente |
| Monto de apertura | Formal | Dinero al abrir | Pendiente |
| Cerrar caja | Claro | Cerrar caja | Mantener |
| Monto de cierre | Formal | Dinero contado | Pendiente |
| Efectivo esperado | Puede generar dudas | Lo que debería haber | Pendiente |
| Sesión de caja | Técnico | Turno de caja | Pendiente |
| Caja abierta de la tienda | Largo | Turno de caja | Pendiente |
| Orden | Inconsistente con “pedido” | Pedido | Pendiente |
| Órdenes | Inconsistente | Pedidos | Pendiente |
| Orden vacía | Inconsistente | Pedido vacío | Pendiente |
| Crear otra orden | Inconsistente | Nuevo pedido | Pendiente |
| Productos preparados antes del cobro | Puede implicar que almacén ya terminó | Productos del pedido | Pendiente |
| Comanda | No todos pueden conocerla | Pedido al almacén | Pendiente |
| Comandas POS | Mezcla dos términos técnicos | Pedidos al almacén | Pendiente |
| Solicitud de stock | Formal | Pedir al almacén | Pendiente |
| El almacén está trayendo el stock que falta | Claro | Almacén está preparando lo que falta | Pendiente |
| Método de pago | Común | Cómo pagó | Pendiente |
| Importe | Formal | Monto | Pendiente |
| Importe registrado | Formal | Monto pagado | Pendiente |
| Efectivo recibido | Claro | Me dio | Pendiente |
| Vuelto estimado | “Estimado” genera duda | Vuelto | Pendiente |
| Vuelto a entregar | Claro | Dale de vuelto | Pendiente |
| Número de operación o referencia | Largo | N.° de operación | Pendiente |
| Registrar venta | Formal | Cobrar | Pendiente |
| Venta completada | Claro | Venta lista | Pendiente |
| Total a cobrar | Claro | Total a cobrar | Mantener |
| Total cobrado | Claro | Total cobrado | Mantener |
| Registrando venta | Formal | Guardando venta | Pendiente |
| Catálogo POS | Técnico | Productos para vender | Pendiente |
| Lector de código de barras | Claro | Escanear producto | Pendiente |
| Unidad de venta | Técnico | ¿Cómo lo lleva? | Pendiente |
| Cantidad base | Técnico | Cantidad descontada del stock | Pendiente |

## Ventas e historial

| Texto actual | Problema | Sugerencia inicial | Palabra aprobada |
|---|---|---|---|
| Contabilidad | Módulo demasiado amplio | Ventas | Ventas |
| Registro de ventas | Formal | Ventas | Ventas |
| Venta POS | Sigla técnica | Venta en caja | Pendiente |
| Venta mayorista | El negocio usa P. Mayor | Venta por mayor | Pendiente |
| Mayoristas | Puede confundirse con clientes | Por mayor | Pendiente |
| Fuente | Si apareciera, sería técnica | Tipo de venta | Pendiente |
| Documento | Ambiguo | DNI/RUC / Comprobante | Según pantalla |
| Referencia de operación | Formal | N.° de operación | Pendiente |
| La venta se registra completamente pagada | Formal | La venta quedará pagada | Pendiente |
| El precio se resuelve por cantidad en unidad base | Muy técnico | Usaremos el precio según la cantidad | Pendiente |
| Venta completada e inmutable | Muy técnico | Esta venta ya fue cobrada y no puede cambiarse | Pendiente |
| Salida de stock | Técnico | Se descontó del stock | Pendiente |

## Clientes

| Texto actual | Problema | Sugerencia inicial | Palabra aprobada |
|---|---|---|---|
| Clientes | Claro | Clientes | Mantener |
| Directorio de clientes | Formal | Clientes | Clientes |
| Cliente de mostrador | Expresión comercial | Cliente sin registrar | Pendiente |
| Número de documento | Ambiguo | DNI o RUC | Pendiente |
| Cliente activo | No explica consecuencia | Disponible para venderle | Pendiente |
| Sin datos de contacto | Claro | Sin teléfono ni correo | Pendiente |
| Sin documento | Claro | Sin DNI/RUC | Pendiente |

## Usuarios y accesos

| Texto actual | Problema | Sugerencia inicial | Palabra aprobada |
|---|---|---|---|
| Usuarios | Claro | Usuarios / Personal | Pendiente |
| Roles | Técnico | Tipo de usuario | Pendiente |
| Rol | Técnico | Tipo de usuario | Pendiente |
| Permisos | Técnico | Qué puede hacer | Pendiente |
| Accesos | Técnico | Quién puede entrar | Pendiente |
| Cuentas y accesos al sistema | Técnico | Personal con acceso | Pendiente |
| Roles y permisos asignados | Muy técnico | Qué puede hacer cada usuario | Pendiente |
| Verificados | No indica qué se verificó | Correo confirmado | Pendiente |
| Sin verificar | No indica qué falta | Correo sin confirmar | Pendiente |
| Con roles | Técnico | Con tipo de usuario | Pendiente |
| Sin roles | Técnico | Sin tipo de usuario | Pendiente |
| Con permisos | Técnico | Con accesos | Pendiente |
| Sin permisos | Técnico | Sin accesos | Pendiente |
| Seleccionar roles | Técnico | Elegir tipo de usuario | Pendiente |
| Asignar | Aceptable | Dar acceso | Pendiente |
| Usuario | Claro | Usuario / Trabajador | Pendiente |
| Administrador | Claro | Administrador | Mantener |
| Vendedor | Claro | Vendedor | Mantener |
| Almacén | Es un lugar y un perfil | Almacenero / Personal de almacén | Pendiente |

## SUNAT y comprobantes

Estos términos necesitan especial cuidado. La sugerencia puede simplificar el título, pero el término oficial debe aparecer en la ayuda.

| Texto actual | Problema | Sugerencia inicial | Palabra aprobada |
|---|---|---|---|
| SUNAT | Término oficial | SUNAT | Mantener |
| Configuración SUNAT | Técnico | Datos para boletas y facturas | Pendiente |
| Emisor fiscal | Técnico | Empresa que emite | Pendiente |
| Emisor | Técnico | Empresa | Pendiente |
| Datos del emisor | Técnico | Datos de la empresa | Pendiente |
| RUC | Término oficial | RUC | Mantener |
| Razón social | Término legal | Razón social | Mantener con ayuda |
| Nombre comercial | Término legal comprensible | Nombre comercial | Mantener |
| Domicilio fiscal | Término legal | Dirección registrada en SUNAT | Pendiente |
| Ubigeo | Código oficial poco conocido | Código de ubicación (ubigeo) | Pendiente |
| Urbanización | Claro | Urbanización | Mantener |
| Establecimiento SUNAT | Técnico/fiscal | Tienda registrada en SUNAT | Pendiente |
| Código de establecimiento | Técnico/fiscal | Código SUNAT de la tienda | Pendiente |
| Clave SOL | Término oficial | Clave SOL | Mantener |
| Credenciales Clave SOL | Técnico | Acceso a SUNAT | Pendiente |
| Credenciales guardadas | Técnico | Acceso guardado | Pendiente |
| Credenciales pendientes | Técnico | Falta configurar el acceso | Pendiente |
| Usuario SOL | Término oficial | Usuario SOL | Mantener |
| Ambiente Beta | Técnico | Modo de prueba | Pendiente |
| Producción | Puede no quedar claro | Uso real | Pendiente |
| Certificado digital | Término oficial/técnico | Firma digital | Pendiente |
| P12/PFX | Extensiones técnicas | Archivo de firma digital | Pendiente |
| Firmar comprobantes | Término fiscal | Firmar boletas y facturas | Pendiente |
| Serie | Término fiscal | Serie | Mantener con ayuda |
| Correlativo | Término fiscal poco cotidiano | Número correlativo | Pendiente |
| Último correlativo | Técnico | Último número usado | Pendiente |
| Próximo correlativo | Técnico | Siguiente número | Pendiente |
| Series y correlativos | Técnico | Números de comprobantes | Pendiente |
| Tipo de documento | Claro | Tipo de comprobante | Pendiente |
| Nota de venta | Término del negocio | Nota de venta | Mantener |
| Boleta | Término oficial | Boleta | Mantener |
| Factura | Término oficial | Factura | Mantener |
| Facturación electrónica | Término oficial | Boletas y facturas electrónicas | Pendiente |

## Estados de documentos y movimientos

| Texto actual | Problema | Sugerencia inicial | Palabra aprobada |
|---|---|---|---|
| Borrador | Puede no explicar qué falta | Sin confirmar | Pendiente |
| Confirmada | Claro | Confirmada / Recibida | Depende de compra |
| Cancelada | Claro | Cancelada | Mantener |
| Abierta | Claro | Abierta | Mantener |
| Cerrada | Claro | Cerrada | Mantener |
| En tránsito | Formal | En camino | Pendiente |
| Recibida | Claro | Recibida | Mantener |
| Completada | Aceptable | Lista / Terminada | Depende del flujo |
| Emitida | Fiscal | Emitida | Mantener |
| Aceptada | Fiscal | Aceptada por SUNAT | Pendiente |
| Observada | Fiscal | SUNAT encontró observaciones | Pendiente |
| Rechazada | Claro | Rechazada por SUNAT | Pendiente |
| Pendiente | Claro | Pendiente | Mantener |
| Procesando | Claro | Enviando | Pendiente |
| Stock en cero | Técnico | Sin stock | Pendiente |
| Stock negativo | No comunica acción | Revisar stock | Pendiente |

## Mensajes y frases que conviene simplificar

| Texto actual | Sugerencia inicial | Palabra/frase aprobada |
|---|---|---|
| No se pudo completar la operación | No pudimos guardar. Intenta otra vez | Pendiente |
| No se pudo conectar con el servidor | No hay conexión. Tus datos siguen aquí | Pendiente |
| No se recibió respuesta a tiempo | Está tardando. Puedes intentar otra vez | Pendiente |
| No tienes permisos para ver esta sección | No tienes acceso a esta sección | Pendiente |
| Prueba con otro texto o cambia los filtros | Busca otra palabra o quita un filtro | Pendiente |
| Usa “Nuevo” para crear el primer registro | Toca “Nuevo” para comenzar | Pendiente |
| Completa todos los campos obligatorios | Completa lo que está marcado con * | Pendiente |
| Operación exitosa | Se guardó | Pendiente |
| Producto actualizado | Producto guardado | Pendiente |
| Precio de venta actualizado | Precio guardado | Pendiente |
| El total será validado nuevamente | Revisaremos el precio antes de cobrar | Pendiente |
| No existe un precio activo para esta cantidad | No hay precio para esta cantidad | Pendiente |
| No se puede cobrar hasta que llegue el stock pedido | Espera a que almacén termine el pedido | Pendiente |
| Comanda enviada al almacén | Pedido enviado al almacén | Pendiente |
| No hay comandas pendientes | No hay pedidos por alistar | Pendiente |
| Marcar listo | Pedido listo | Pendiente |
| Esta compra está confirmada y se muestra en modo consulta | Esta compra ya fue recibida y no puede cambiarse | Pendiente |
| La compra se guardará como borrador | Se guardará sin agregar stock todavía | Pendiente |

## Palabras que pueden mantenerse

Estas palabras son comprensibles o forman parte normal del negocio:

- Nuevo.
- Guardar.
- Editar.
- Eliminar.
- Buscar.
- Producto.
- Cliente.
- Proveedor.
- Compra.
- Venta.
- Precio.
- Cantidad.
- Costo.
- Total.
- Subtotal.
- Efectivo.
- Tarjeta.
- Yape.
- Plin.
- Transferencia bancaria.
- Teléfono.
- Dirección.
- Correo.
- Contraseña.
- Almacén, si el equipo usa esa palabra.
- Granel.
- Unidad.
- Kilo.
- Gramo.
- Boleta.
- Factura.
- Nota de venta.
- SUNAT.
- RUC.
- Clave SOL.

## Reglas propuestas para escribir textos

### Usar verbos directos

```text
Registrar venta  → Cobrar
Procesar         → Guardar
Seleccionar      → Elegir
Visualizar       → Ver
Realizar ajuste  → Corregir stock
```

### Hablarle directamente al usuario

```text
Cantidad requerida               → Escribe la cantidad
Debe seleccionar un producto     → Elige un producto
No se encontraron coincidencias  → No encontramos nada
```

### Mostrar primero la consecuencia

```text
Esta compra está en modo consulta porque afectó inventario
→ Esta compra ya agregó stock y no puede cambiarse
```

### No usar tres palabras para el mismo concepto

Debe elegirse una sola palabra para:

- Stock / existencias / inventario.
- Pedido / orden / lista / comanda.
- Presentación / variante / combinación.
- Tipo de precio / rango / tarifa.
- Nota / observación.
- Activo / visible / disponible.

### No depender únicamente del color

```text
Verde
→ Precio Verde: descuenta S/ 0.50 por kg
```

## Lista corta para que el negocio responda

Esta es la primera ronda recomendada. Puedes responder copiando la lista y escribiendo la palabra que prefieres:

```text
1. Inventario =
2. Stock / existencias = Stock
3. Kardex =
4. Movimiento de inventario =
5. Ajuste =
6. Orden del vendedor =
7. Comanda de almacén =
8. Variante =
9. Variante principal =
10. Combinación =
11. Atributo =
12. Factor = Contenido (ejemplo: Contenido: 12 unidades)
13. Unidad de medida =
14. Unidad base =
15. Rango de precio =
16. Menudeo =
17. Mayorista =
18. POS = POS
19. Caja de cobro =
20. Apertura de caja =
21. Efectivo inicial =
22. Monto de cierre =
23. Efectivo esperado =
24. Registro de ventas = Ventas
25. Venta mayorista =
26. Rol =
27. Permisos =
28. Emisor fiscal =
29. Establecimiento SUNAT =
30. Series y correlativos =
31. Ubigeo =
32. Certificado digital =
33. Activo =
34. Inactivo =
35. Ubicación del producto =
```

## Próximo paso

1. El negocio responde primero la lista corta.
2. Se actualiza la columna `Palabra aprobada`.
3. Se revisan las frases completas usando ese vocabulario.
4. Se prepara una lista exacta de cambios por archivo.
5. Solo después de aprobar el diccionario se modifica el frontend.
