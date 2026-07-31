# Análisis de tipos de venta, precios y variantes

Fecha de revisión: 28 de julio de 2026.

Este documento complementa la [auditoría general de necesidades](./auditoria-necesidades-app.md) y aterriza la segunda nota del negocio sobre venta a granel, productos envasados, niveles de precio, descuentos y ubicación.

## Conclusión principal

La idea de usar **variantes** es adecuada, pero no todo debe convertirse en una variante:

- **Gramo y kilo son unidades de entrada de una misma variante `Granel`.**
- **Caja/docena, sarta, unidad suelta y otros envases sí pueden ser variantes**, cuando se venden como presentaciones comerciales diferentes.
- **P. Gramero, P. Kilo, P. Mayor y P. Emprendedor son rangos de precio**, no variantes.
- **Verde o plomo no deberían ser variantes** si solamente representan un descuento o una señal visual.
- La ubicación física —zona, pasillo, estante o anaquel— es independiente de la variante y del precio.

La estructura recomendada es:

```text
Producto padre
└── Variante principal: Granel
    ├── entrada de venta: gramos o kilos
    ├── stock principal: gramos
    └── precios: Gramero / Kilo / Mayor / Emprendedor
└── Variantes de presentación
    ├── Unidad envasada
    ├── Sarta
    └── Caja / docena
        └── cada venta descuenta su contenido del stock principal
```

## Estado frente al sistema actual

| Necesidad | Estado | Situación actual |
|---|:---:|---|
| Vender granel por kilo o gramo | ✅ | Ya existe venta medida, ingreso en `g` o `kg`, conversión a gramos y descuento exacto de stock. |
| Vender unidad, sarta o caja/docena | ✅ | El modelo permite variantes unitarias con nombre, SKU, código, contenido, factor y precio propios. Falta cargar y normalizar estos datos de negocio. |
| Precio Gramero, Kilo, Mayor y Emprendedor | ✅ | Los rangos de precio permiten nombre, cantidad mínima/máxima y precio. El rango correcto se aplica automáticamente según la cantidad. |
| Precio especial para envasar | 🟡 | Cada variante envasada puede tener su precio final. No existe todavía un concepto separado de costo de envase, mano de obra o recargo de envasado. |
| Disminuir el precio Kilo en productos seleccionados usando colores | ❌ | No existe descuento manual, perfil de descuento, lista de productos habilitados ni señal visual por color. |
| Control de stock compartido entre granel y envases | 🟡 | La venta de una presentación descuenta su contenido del producto principal. Falta distinguir entre envasado al momento y productos preenvasados con stock propio. |
| Control de precios que cambian constantemente | 🟡 | Los precios se pueden editar y el cobro se recalcula, pero no hay precio de referencia, actualización derivada, historial ni alertas de cambio. |
| Ubicación de productos | 🟡 | Hay tiendas y almacenes, pero no ubicación interna por zona, pasillo, estante, anaquel o casillero. |
| App dinámica para administrador, vendedor y almacén | 🟡 | Los menús ya se filtran por permisos y hay interfaces distintas para POS, inventario y administración. Faltan los tres perfiles definitivos, inicios personalizados por rol y simplificar varios términos y recorridos. |

## 1. Venta a granel

### Modelo recomendado

Para un producto como arroz, azúcar, menestras o frutos secos:

| Campo | Configuración |
|---|---|
| Producto padre | Arroz Extra |
| Variante principal | Granel |
| Modo de venta | Medido |
| Unidad base de stock | Gramo |
| Formas de ingreso en POS | Gramos o kilogramos |
| Stock | Una sola cantidad expresada internamente en gramos |

El cajero puede ingresar `250 g`, `1 kg` o `2.5 kg`. La app convierte todo a gramos para stock y selecciona el precio correspondiente.

### Por qué kilo y gramo no deben ser variantes

Si se crean dos variantes llamadas `Kilo` y `Gramo`, se duplicaría artificialmente el mismo inventario y sería necesario transferir saldo entre ambas. En realidad:

```text
1 kg = 1 000 g del mismo stock
```

La app ya maneja esta conversión en [`frontend/features/pos/pos-measurement.ts`](../frontend/features/pos/pos-measurement.ts) y permite escribir cantidades libres en [`frontend/features/pos/pos-quantity-editor.tsx`](../frontend/features/pos/pos-quantity-editor.tsx).

## 2. Productos embotellados o envasados

### Presentaciones aceptadas

- Caja/docena.
- Sarta.
- Unidad suelta.
- Otros envases con contenido definido.
- `Paquete` se considera descartado porque aparece tachado en la nota. Podrá agregarse después si el negocio lo recupera como presentación real.

### Regla para crear una variante

Debe crearse una variante cuando la presentación tenga al menos una de estas diferencias:

- nombre comercial propio;
- SKU o código de barras propio;
- precio propio;
- contenido fijo;
- venta únicamente en cantidades enteras.

Ejemplo para un producto cuyo stock principal está en unidades:

| Variante | Modo | Contenido | Efecto en stock principal |
|---|---|---:|---:|
| Unidad suelta, principal | Unidad | 1 unidad | −1 unidad |
| Sarta | Unidad | cantidad definida por el negocio | −cantidad de unidades |
| Caja/docena | Unidad | 12 unidades | −12 unidades |

Ejemplo para un producto cuyo stock principal está en gramos:

| Variante | Modo | Contenido | Efecto en stock principal |
|---|---|---:|---:|
| Granel, principal | Medido | Libre | −gramos vendidos |
| Bolsa de 250 g | Unidad | 250 g | −250 g |
| Envase de 1 kg | Unidad | 1 000 g | −1 000 g |
| Caja con 12 envases de 1 kg | Unidad | 12 000 g | −12 000 g |

La lógica actual ya calcula ese consumo mediante [`app/Actions/Sales/ResolveSaleStockConsumptionAction.php`](../app/Actions/Sales/ResolveSaleStockConsumptionAction.php). Hay pruebas de venta proporcional en:

- [`tests/Feature/Api/V1/PosCheckoutTest.php`](../tests/Feature/Api/V1/PosCheckoutTest.php);
- [`tests/Feature/Api/V1/SaleTest.php`](../tests/Feature/Api/V1/SaleTest.php);
- [`tests/Feature/Api/V1/PosCatalogTest.php`](../tests/Feature/Api/V1/PosCatalogTest.php).

### Dos formas de manejar el envasado

Es necesario escoger el comportamiento por variante.

#### A. Envasado al momento

La presentación no tiene stock independiente. Cuando se vende, consume directamente del stock principal.

Ejemplo:

```text
Stock Granel: 20 000 g
Venta: 4 bolsas de 250 g
Nuevo stock Granel: 19 000 g
```

Este es el comportamiento que ya implementa la aplicación y es el más simple para iniciar.

#### B. Producto preenvasado con stock propio

El negocio prepara bolsas, cajas o sartas con anticipación y necesita saber cuántas están listas.

Ejemplo:

```text
Stock Granel: 20 000 g
Operación de envasado: prepara 20 bolsas de 250 g
Stock Granel: 15 000 g
Stock Bolsa 250 g: 20 unidades
```

Para este caso hace falta una operación de **envasado/reempaque** que registre:

- salida del granel;
- entrada de unidades terminadas;
- material o costo del envase;
- merma;
- usuario, fecha y observación.

El sistema actual no implementa esa transformación. Además, toda variante secundaria se resuelve automáticamente contra la variante principal, por lo que todavía no puede elegir entre `consume stock principal` y `usa stock propio`.

### Recomendación de diseño

Cada variante debería declarar explícitamente uno de estos modos:

| Modo de stock | Uso |
|---|---|
| `consume_principal` | Envase armado al momento, caja/docena o sarta calculada desde el stock principal. |
| `own_stock` | Producto terminado, comprado o envasado previamente, con existencias independientes. |

No conviene inferir esa regla solamente por `is_principal`, porque en el futuro podrían existir variantes físicas —por ejemplo, color o marca— que verdaderamente tengan stock separado.

## 3. Tipos de precio

### Mapeo recomendado

Los cuatro precios se deben configurar como rangos de la variante `Granel`:

| Nivel | Interpretación | Cantidad | Relación de precio |
|---|---|---|---|
| P. Gramero | Venta pequeña | Rango menor al kilo o al límite acordado | Por encima del precio de referencia |
| P. Kilo | Venta regular | Desde el límite definido para kilo | Precio de referencia |
| P. Mayor | Compra mayorista | Desde un volumen mayor | Debajo del precio de referencia |
| P. Emprendedor | Compra de volumen alto | Desde el mayor límite comercial | Precio más bajo |

La implementación actual de [`price_tiers`](../app/Models/PriceTier.php) permite exactamente:

- etiqueta;
- cantidad mínima;
- cantidad máxima;
- precio;
- estado activo/inactivo.

La pantalla para administrarlos está en [`frontend/features/products/product-sale-prices.tsx`](../frontend/features/products/product-sale-prices.tsx).

### Rangos pendientes de definición

No se deben inventar las cantidades. El negocio debe establecer, por producto o por una política común:

- hasta qué cantidad se considera Gramero;
- desde cuándo aplica Kilo;
- desde cuándo aplica Mayor;
- desde cuándo aplica Emprendedor;
- si los límites son iguales para todos los productos.

Los rangos no deben solaparse ni dejar huecos. Por ejemplo, si Gramero termina en `999 g`, el siguiente rango debería comenzar en `1 000 g`.

### Limitación ante precios variables

Hoy cada rango guarda un precio absoluto. Si cambia el precio de referencia, el administrador tiene que modificar manualmente Gramero, Kilo, Mayor y Emprendedor.

Para el problema de precios que varían constantemente, conviene evolucionar a:

```text
Precio Kilo de referencia
├── Gramero      = referencia + ajuste
├── Kilo         = referencia
├── Mayor        = referencia - ajuste
└── Emprendedor  = referencia - ajuste mayor
```

Cada ajuste podría ser:

- monto por kilo;
- porcentaje;
- o precio absoluto, solo cuando el producto sea una excepción.

Esto permitiría cambiar una sola referencia y recalcular los demás niveles, mostrando una vista previa antes de guardar.

## 4. Precio para envasar productos

La frase puede significar dos cosas diferentes:

### Opción 1: precio final de la presentación

Ejemplo: una bolsa de 250 g se vende a `S/ 3.00`.

Esto ya se puede manejar como precio propio de la variante envasada.

### Opción 2: costo o recargo por envasado

Ejemplo:

```text
Valor del contenido
+ costo del envase
+ trabajo de envasado
+ margen
= precio final sugerido
```

Esto todavía no está modelado. Si se necesita conocer rentabilidad real o recalcular automáticamente, deben separarse:

- costo del contenido;
- costo del envase;
- costo/merma de envasado;
- margen;
- precio final.

No conviene guardar todo como un único “precio de color” porque se perdería la explicación del cálculo.

## 5. Nota de precio por color

La nota recibida dice:

> Al Kilo poder disminuir un cierto porcentaje como opción en ciertos productos seleccionados. Verde = 0.50; plomo = 1.00 (tachado).

### Ambigüedades que deben resolverse

1. Se menciona “porcentaje”, pero `0.50` y `1.00` parecen montos en soles.
2. No queda claro si el descuento es por kilo, por línea o por toda la venta.
3. `Plomo = 1.00` está tachado; se considera descartado hasta confirmación.
4. Debe definirse quién puede aplicar el descuento.
5. Debe decidirse si el descuento aplica solo al rango Kilo o también a Mayor/Emprendedor.

### Interpretación provisional recomendada

Para la primera versión:

```text
Verde = disminuir S/ 0.50 por kg
Plomo = no implementar por estar tachado
Aplicación = solo productos autorizados y solo por un usuario con permiso
```

Esta interpretación es provisional. Si realmente es `0.50 %`, el cálculo y la comunicación al vendedor son distintos.

### No debe ser una variante

El color representa una regla comercial o una señal visual, no un producto físico. Convertirlo en variante causaría:

- SKU innecesario;
- posible duplicación de stock;
- confusión con colores reales del producto;
- pérdida del precio original.

Debe modelarse como un **ajuste de precio/descuento** con:

- nombre;
- color visual;
- tipo: monto por kg, porcentaje o monto por línea;
- valor;
- productos habilitados;
- nivel de precio habilitado;
- vigencia;
- permiso requerido;
- motivo opcional;
- precio original y precio final guardados en la venta.

## 6. Control de stock

### Lo que ya está bien encaminado

- Kardex de entradas y salidas.
- Stock por almacén.
- costo promedio ponderado;
- compras que aumentan stock;
- ventas que disminuyen stock;
- conversión de kilos a gramos;
- consumo proporcional de presentaciones desde el producto principal;
- validación transaccional para evitar ventas sin stock.

### Lo que todavía falta cerrar

1. Pantalla de ajuste manual de stock desde la app.
2. Modo de stock explícito por variante.
3. Operación de envasado/reempaque si se controlarán productos preparados.
4. Registro de merma.
5. Conteo físico e inventario de comprobación.
6. Ubicación interna del producto.
7. Mostrar en el Kardex tanto la variante vendida como el producto cuyo stock se consumió.

### Inconsistencia documental encontrada

[`docs/inventory-pos-data-model.md`](./inventory-pos-data-model.md) todavía indica que las variantes administran stock propio y no lo comparten automáticamente. El código actual sí hace que una variante secundaria consuma proporcionalmente el stock de la principal.

Antes de seguir construyendo, ese documento debe actualizarse para que negocio, desarrollo y pruebas trabajen con una sola regla.

## 7. Control de precios variables

La app permite editar los rangos y vuelve a calcular el precio al cobrar. Sin embargo, para controlar cambios frecuentes todavía faltan:

- historial del precio anterior y nuevo;
- motivo del cambio;
- usuario que lo realizó;
- fecha de vigencia;
- programación de un precio futuro;
- actualización derivada desde el precio Kilo de referencia;
- alertas a vendedores;
- resaltado por 48 o 72 horas;
- reporte de productos cuyo precio no fue revisado recientemente.

El historial es especialmente importante porque el precio aplicado queda guardado en la venta, pero actualmente no hay una bitácora clara para explicar por qué cambió la tabla comercial.

## 8. Falta de ubicación

Se interpreta “ubicación” como la posición física del producto dentro de un almacén. El sistema ya sabe en qué **almacén** está el stock, pero no en qué lugar interno debe buscarlo el almacenero.

### Primera etapa recomendada

Registrar una ubicación principal por producto y almacén:

- zona;
- pasillo;
- estante o anaquel;
- nivel;
- casillero;
- código corto visible, por ejemplo `A-03-N2`;
- observación.

La ubicación debería aparecer en:

- catálogo de stock;
- Kardex;
- comanda de almacén;
- preparación de pedido;
- búsqueda de productos.

### Segunda etapa, solo si se necesita

Si el mismo producto puede estar repartido en varias ubicaciones y se necesita conocer cuánto hay en cada una, entonces el stock debe dividirse por ubicación. Eso requiere movimientos entre ubicaciones y es bastante más complejo.

Para comenzar, se recomienda una ubicación informativa principal sin dividir el saldo del almacén.

## 9. Configuración propuesta por tipo de producto

### Producto vendido a granel y envasado al momento

| Elemento | Configuración |
|---|---|
| Principal | Granel, medido, base `g` |
| Entrada POS | `g` o `kg` |
| Rangos | Gramero, Kilo, Mayor, Emprendedor |
| Variantes | Envase 250 g, 500 g, 1 kg, etc. |
| Stock de variantes | Consume el principal |
| Compra | Saco u otra unidad de compra convertida a gramos |

### Producto embotellado comprado ya terminado

| Elemento | Configuración |
|---|---|
| Principal | Unidad suelta, base `unidad` |
| Variantes | Sarta y caja/docena |
| Caja/docena | contenido de 12 unidades |
| Stock | Principal en unidades; caja consume 12 si no se controla cerrada por separado |
| Compra | Caja con factor 12 o unidad |

### Producto preenvasado por el negocio

| Elemento | Configuración |
|---|---|
| Insumo | Granel |
| Producto terminado | Variante con stock propio |
| Operación necesaria | Envasado/reempaque |
| Registros | consumo, producción, envase, merma y costo |
| Estado actual | No implementado |

## 10. Decisiones que debe confirmar el negocio

1. ¿`Verde = 0.50` significa `S/ 0.50 por kg` o `0.50 %`?
2. ¿El descuento se aplica solo al precio Kilo?
3. ¿Se elimina definitivamente la opción plomo?
4. ¿Cuáles son los límites exactos de Gramero, Kilo, Mayor y Emprendedor?
5. ¿Los límites son globales o distintos por producto?
6. ¿“Precio para envasar” es precio final o un recargo/costo separado?
7. ¿Cuántas unidades contiene una sarta para cada producto?
8. ¿Las cajas siempre equivalen a una docena?
9. ¿Los envases se arman al vender o se preparan con anticipación?
10. ¿Se necesita contar stock de envases vacíos y registrar merma?
11. ¿“Ubicación” significa pasillo/estante del almacén o la ubicación del negocio/cliente?

## 11. Experiencia dinámica por tipo de usuario

### Objetivo

La app debe sentirse diferente para cada perfil:

- cada usuario ve primero lo que necesita para trabajar;
- las acciones frecuentes están a uno o dos toques;
- los datos se actualizan sin obligar a cerrar y volver a abrir pantallas;
- la interfaz responde inmediatamente con texto, color, icono y, cuando corresponda, sonido;
- se usan palabras cotidianas del negocio.

“Tan fácil como para un niño de 6 años” se interpreta como una meta de **claridad y aprendizaje inmediato**, no como un diseño infantil. La app controla dinero, inventario y documentos, por lo que debe seguir mostrando confirmaciones y consecuencias importantes.

### Situación actual

La app ya tiene:

- autenticación;
- permisos por acción;
- menús ocultos según los permisos;
- módulos separados para POS, inventario, compras, usuarios y configuración;
- botones, iconos, colores y mensajes de confirmación;
- buscadores y filtros;
- actualización periódica de comandas de almacén.

Todavía falta:

- crear exactamente los roles `administrador`, `vendedor` y `almacén`;
- una pantalla inicial diferente para cada rol;
- priorizar las tareas diarias en lugar de mostrar módulos genéricos;
- reemplazar palabras técnicas por lenguaje cotidiano;
- sincronización verdaderamente instantánea;
- ayuda visual dentro de los formularios;
- reducir formularios administrativos que hoy muestran muchas decisiones juntas;
- probar los recorridos con personas que no conozcan el sistema.

### Interfaz del administrador

El administrador necesita control y excepciones, no comenzar directamente en una lista larga.

#### Inicio recomendado

- **Ventas de hoy**
- **Stock bajo**
- **Precios por revisar**
- **Pedidos esperando**
- **Productos recién modificados**
- **Usuarios y accesos**

#### Acciones principales

- `Cambiar precios`
- `Agregar stock`
- `Ver lo vendido`
- `Crear producto`
- `Dar acceso`
- `Ver problemas`

#### Comportamiento dinámico

- avisar qué precios cambiaron y desde cuándo;
- mostrar productos con stock bajo o negativo;
- permitir cambiar el precio Kilo y previsualizar Gramero, Mayor y Emprendedor;
- confirmar antes de cambios masivos;
- informar cuántos vendedores recibirán el aviso;
- resaltar errores o tareas pendientes, no solamente estadísticas.

### Interfaz del vendedor

El vendedor debe poder vender sin navegar por módulos administrativos.

#### Inicio recomendado

- buscador grande;
- productos favoritos;
- categorías o familias;
- botón visible `Ver pedido`;
- pedidos abiertos;
- acceso directo a cámara/código de barras.

#### Recorrido ideal

```text
Tocar producto
→ elegir cantidad, peso o monto
→ revisar pedido
→ cobrar
```

#### Acciones principales

- `Agregar`
- `Quitar`
- `Cambiar cantidad`
- `Vender por gramos`
- `Vender por monto`
- `Aplicar precio Verde`
- `Pedir al almacén`
- `Cobrar`

#### Comportamiento dinámico

- actualizar total y stock mientras cambia la cantidad;
- mostrar inmediatamente el nivel aplicado: Gramero, Kilo, Mayor o Emprendedor;
- destacar precios cambiados recientemente;
- avisar si almacén modificó o terminó el pedido;
- evitar que el vendedor vea configuración, usuarios o costos que no necesita;
- conservar el pedido si se interrumpe temporalmente la conexión.

### Interfaz de almacén

Almacén necesita una cola de trabajo clara, ubicación y cambios visibles.

#### Inicio recomendado

- **Nuevos**
- **Alistando**
- **Listos**
- **Con problema**

Cada pedido debe mostrar:

- número grande;
- hora;
- vendedor;
- productos y cantidades;
- presentación: granel, unidad, sarta o caja/docena;
- ubicación física;
- observación;
- cambios recientes.

#### Acciones principales

- `Empezar a alistar`
- `No hay suficiente`
- `Marcar producto`
- `Pedido listo`
- `Avisar al vendedor`

#### Comportamiento dinámico

- sonido o vibración opcional al entrar un pedido;
- ítem nuevo resaltado;
- cantidad modificada con valor anterior y nuevo;
- producto retirado visible como cancelado durante un tiempo, no desaparecido silenciosamente;
- ubicación mostrada antes de la descripción técnica;
- confirmación del vendedor cuando recibe el aviso de pedido listo.

## 12. Lenguaje coloquial dentro de la app

### Regla general

Las palabras del código y de la contabilidad no deben llegar directamente al usuario. Deben usarse los términos que el equipo dice diariamente.

| Término técnico o poco cercano | Texto recomendado |
|---|---|
| Unidad de medida base | Cómo lo cuentas |
| Variante principal | Producto principal |
| Variante medida | Granel |
| Variante unitaria | Presentación |
| Price tier / rango de precio | Tipo de precio |
| Cantidad mínima | Desde cuánto |
| Cantidad máxima | Hasta cuánto |
| Ajuste de inventario | Agregar o quitar stock |
| Movimiento de entrada | Entró |
| Movimiento de salida | Salió |
| Inventory transfer | Envío entre almacenes |
| Supply request | Pedido al almacén |
| Checkout | Cobrar |
| Sales ticket | Nota de venta |
| Receipt | Boleta |
| Invoice | Factura |
| Cash register session | Turno de caja |
| Open session | Abrir caja |
| Close session | Cerrar caja |
| Stock configuration error | Hay un problema con el stock |
| No price tier matched | No hay precio para esta cantidad |
| Insufficient stock | No alcanza el stock |
| Submit / procesar | Guardar / continuar |

### Textos recomendados para acciones

- `¿Cuánto lleva?`
- `Escribe los gramos o kilos`
- `¿Por cuánto dinero quiere llevar?`
- `Este precio cambió hace poco`
- `Te faltan productos para completar el pedido`
- `Almacén ya está alistando`
- `El pedido está listo`
- `No alcanza. Pide más al almacén`
- `Revisa antes de cobrar`
- `Se guardó correctamente`
- `No pudimos guardar. Intenta otra vez`

### Términos que deben validarse con el negocio

El lenguaje coloquial no debe inventarse solo desde desarrollo. Antes de cerrar los textos hay que confirmar cómo llaman realmente a:

- la venta pequeña: `Gramero`, `menudeo` u otro nombre;
- el pedido del vendedor: `lista`, `pedido` o `nota`;
- el pedido que recibe almacén: `comanda`, `lista` o `pedido`;
- `Sarta`;
- `Caja/docena`;
- precio `Mayor`;
- precio `Emprendedor`;
- proceso de `alistar`;
- entrega o delivery.

Se debe escoger un solo término para cada concepto y usarlo en toda la app.

## 13. Principios de diseño simple

### Navegación

- Una acción principal por pantalla.
- Máximo tres decisiones visibles al mismo tiempo cuando sea posible.
- Botón `Volver` siempre en el mismo lugar.
- Evitar menús profundos.
- Recordar filtros y selección reciente.
- Mantener pedidos abiertos aunque el usuario cambie de pantalla.

### Controles

- Botones grandes y separados.
- Icono acompañado de texto; no depender solo del icono.
- Selectores en lugar de escribir códigos.
- Teclado numérico para precios, cantidades y pagos.
- Valores rápidos para cantidades frecuentes.
- Código de barras o cámara cuando ahorre escritura.

### Colores

- El color siempre debe estar acompañado por texto o icono.
- Verde no puede significar al mismo tiempo “descuento”, “correcto” y “pedido listo” sin una diferencia clara.
- Rojo debe reservarse principalmente para problemas, eliminación o falta de stock.
- Los colores de precios deben mantener el mismo significado en POS, listas y comprobantes.
- Debe haber contraste suficiente para personas con dificultad visual.

### Mensajes

- Indicar qué pasó.
- Explicar qué puede hacer el usuario.
- Evitar códigos de error y palabras internas.
- No mostrar “operación exitosa” cuando se puede decir `Venta guardada`.
- Ante un cambio de precio, mostrar precio anterior y nuevo.
- Ante un cambio de cantidad, mostrar cantidad anterior y nueva.

### Seguridad sin complicar

La simplicidad no debe eliminar controles importantes:

- confirmar eliminaciones;
- confirmar disminuciones manuales de stock;
- pedir autorización para descuentos;
- bloquear cambios a ventas ya cobradas;
- mostrar total antes de cobrar;
- distinguir claramente nota de venta, boleta y factura;
- registrar quién hizo cada cambio.

## 14. Criterios de facilidad de uso por rol

### Administrador

- Puede cambiar el precio Kilo de un producto y entender el efecto en los demás precios sin capacitación técnica.
- Puede crear un usuario y asignarle uno de los tres perfiles sin seleccionar permisos individuales.
- Puede encontrar un producto con stock bajo en menos de tres acciones.

### Vendedor

- Puede iniciar una venta desde la pantalla principal.
- Puede vender por unidad, gramos, kilos o monto sin entrar a configuración.
- Puede saber qué precio se aplicó sin calcularlo manualmente.
- Puede cobrar con un recorrido corto y una confirmación final.

### Almacén

- Puede reconocer cuál pedido atender primero.
- Puede encontrar la ubicación de cada producto sin abrir otra pantalla.
- Puede identificar inmediatamente un producto agregado, cambiado o retirado.
- Puede marcar un pedido listo con una acción clara.

### Prueba de comprensión

Una persona nueva debería poder completar su tarea principal después de una explicación breve:

```text
Administrador: cambiar un precio
Vendedor: hacer y cobrar una venta
Almacén: alistar y terminar un pedido
```

La prueba debe hacerse con usuarios reales de cada perfil. La referencia de “6 años” sirve para exigir claridad, pero no reemplaza la validación con quienes trabajarán diariamente.

## 15. Orden recomendado de implementación

1. Acordar las decisiones anteriores y preparar ejemplos reales de cinco productos.
2. Definir el vocabulario definitivo con administrador, vendedores y almaceneros.
3. Crear los tres perfiles y sus pantallas iniciales.
4. Mantener `Granel` como variante principal y configurar sus cuatro rangos.
5. Cargar unidad, sarta y caja/docena como variantes con factores comprobados.
6. Simplificar los recorridos principales de vendedor y almacén.
7. Hacer explícito el modo `consume principal` o `stock propio`.
8. Agregar ubicación informativa por producto y almacén.
9. Crear precio Kilo de referencia con ajustes derivados.
10. Crear el descuento Verde con auditoría y permisos.
11. Implementar reempaque solo si el negocio controlará productos preparados.
12. Agregar historial, actualización dinámica y alertas de cambios de precio.

## 16. Criterios de aceptación

- Una venta de `500 g` y una de `0.5 kg` descuentan exactamente la misma cantidad.
- Una caja/docena descuenta 12 unidades o el peso total configurado, sin duplicar stock.
- Una sarta descuenta su factor real, no un valor genérico.
- Los cuatro niveles de precio se aplican sin rangos solapados ni huecos.
- El vendedor ve claramente qué nivel de precio se aplicó.
- El descuento Verde solo aparece en productos autorizados y conserva precio original, ajuste y precio final.
- El sistema distingue una presentación armada al momento de una presentación con stock propio.
- La comanda muestra la ubicación física del producto.
- Todo cambio de precio conserva usuario, fecha, motivo, precio anterior y nuevo.
- Administrador, vendedor y almacén reciben un inicio y menú adaptados a su trabajo.
- Las tareas principales usan palabras cotidianas y no muestran nombres técnicos del sistema.
- Una persona nueva puede completar la tarea principal de su rol después de una explicación breve.
- Ningún estado importante depende exclusivamente de un color.

## 17. Mapa completo de decisiones y propuestas iniciales

Esta sección convierte las preguntas pendientes en una propuesta concreta para comenzar. Las reglas marcadas como **propuesta inicial** deben validarse con cinco productos reales antes de aplicarse a todo el catálogo.

### 17.1 Resumen de decisiones

| Tema | Propuesta inicial | Motivo | Estado recomendado |
|---|---|---|---|
| Granel | Una variante principal llamada `Granel` | Centraliza el stock físico | Aprobar |
| Kilo y gramo | Formas de ingresar cantidad, no variantes | Son el mismo producto y stock | Aprobar |
| Unidad suelta | Variante o producto principal de conteo | Se vende entera | Aprobar |
| Caja/docena | Presentación de 12 unidades por defecto | Coincide con la nota `docena = caja` | Confirmar por producto |
| Sarta | Presentación con factor obligatorio y editable | Una sarta puede contener cantidades distintas | Confirmar por producto |
| Paquete | No incluir en la primera versión | Aparece tachado | Aprobar o recuperar |
| Envase armado al vender | Consume stock del principal | Es el flujo más sencillo y ya funciona | Aprobar para MVP |
| Producto preenvasado | Stock propio mediante operación de reempaque | Permite contar unidades listas | Dejar para una etapa posterior |
| P. Gramero | Menos de 1 kg | Separa venta pequeña | Propuesta inicial |
| P. Kilo | Desde 1 kg hasta menos de 5 kg | Precio regular de referencia | Propuesta inicial |
| P. Mayor | Desde 5 kg hasta menos de 25 kg | Compra mayorista | Propuesta inicial |
| P. Emprendedor | Desde 25 kg | Volumen alto | Propuesta inicial |
| Precio de referencia | Usar P. Kilo como precio base por kg | Coincide con “en el promedio” | Aprobar |
| Precio Gramero | Precio Kilo + 10 % sugerido | Venta pequeña con mayor margen | Validar con costos |
| Precio Mayor | Precio Kilo − 5 % sugerido | Incentivo de volumen | Validar con costos |
| Precio Emprendedor | Precio Kilo − 10 % sugerido | Mayor incentivo por volumen | Validar con costos |
| Precio para envasar | Precio final manual por presentación durante el MVP | Es más sencillo y evita fórmulas incorrectas | Aprobar para MVP |
| Descuento Verde | Restar `S/ 0.50 por kg` al P. Kilo | Los valores anotados parecen montos, no porcentajes | Confirmar |
| Descuento Plomo | No implementar | Está tachado | Aprobar o recuperar |
| Acumulación de descuentos | No permitir combinar descuentos | Evita vender por debajo del mínimo | Aprobar |
| Productos con Verde | Lista autorizada por administrador | No todos los productos soportan el mismo margen | Aprobar |
| Duración de aviso de precio | Resaltar durante 72 horas | Da tiempo a vendedores que no trabajan diariamente | Confirmar |
| Ubicación | Una ubicación principal por producto y almacén | Resuelve el problema sin dividir stock | Aprobar para MVP |
| Nombre de la lista | Usar `Pedido` | Es cotidiano y sirve para vendedor y almacén | Confirmar con usuarios |
| Acción de almacén | Usar `Alistar` y `Pedido listo` | Lenguaje directo | Confirmar con usuarios |
| Perfiles | Administrador, Vendedor y Almacén | Coincide con la operación solicitada | Aprobar |

### 17.2 Propuesta de cantidades para los cuatro precios

Para productos cuya unidad base es el gramo:

| Tipo de precio | Desde | Hasta | Almacenamiento interno |
|---|---:|---:|---|
| Gramero | Más de 0 | Menos de 1 kg | `0` a `999.999999 g` |
| Kilo | 1 kg | Menos de 5 kg | `1 000` a `4 999.999999 g` |
| Mayor | 5 kg | Menos de 25 kg | `5 000` a `24 999.999999 g` |
| Emprendedor | 25 kg | Sin límite | `25 000 g` en adelante |

La propuesta evita huecos y hace que el POS elija automáticamente un solo precio.

#### Alternativas

Si el negocio maneja volúmenes menores:

```text
Gramero:       menos de 1 kg
Kilo:          1 a menos de 3 kg
Mayor:         3 a menos de 10 kg
Emprendedor:   10 kg o más
```

Si vende sacos o volúmenes grandes:

```text
Gramero:       menos de 1 kg
Kilo:          1 a menos de 10 kg
Mayor:         10 a menos de 50 kg
Emprendedor:   50 kg o más
```

La recomendación es comenzar con el perfil `1 / 5 / 25 kg`, probarlo con ventas reales y permitir excepciones por producto. No conviene crear límites diferentes para todos los productos desde el primer día.

### 17.3 Propuesta de cálculo de precios

El administrador escribiría un precio de referencia por kilo:

```text
P. Kilo = precio de referencia
```

La app mostraría sugerencias:

```text
P. Gramero      = P. Kilo + 10 %
P. Kilo         = P. Kilo
P. Mayor        = P. Kilo - 5 %
P. Emprendedor  = P. Kilo - 10 %
```

Ejemplo únicamente demostrativo:

| Tipo | Cálculo con P. Kilo = S/ 10.00 | Precio sugerido |
|---|---:|---:|
| Gramero | `10.00 + 10 %` | S/ 11.00/kg |
| Kilo | Referencia | S/ 10.00/kg |
| Mayor | `10.00 − 5 %` | S/ 9.50/kg |
| Emprendedor | `10.00 − 10 %` | S/ 9.00/kg |

El administrador debe poder reemplazar cualquier sugerencia por un precio exacto. Antes de guardar, la app debe mostrar los cuatro precios y advertir si alguno queda por debajo del costo más el margen mínimo.

#### Regla de protección

```text
Precio mínimo permitido
= costo promedio por kg
+ margen mínimo definido por el administrador
```

Un vendedor nunca debería poder ignorar esa protección. Solamente el administrador podría autorizar una excepción, dejando motivo y registro.

### 17.4 Propuesta del descuento Verde

Mientras el negocio no confirme que se trata de un porcentaje, la propuesta más coherente es:

| Campo | Regla inicial |
|---|---|
| Nombre visible | Precio Verde |
| Color | Verde acompañado por el texto `− S/ 0.50 por kg` |
| Tipo | Monto por kilogramo |
| Valor | S/ 0.50 |
| Nivel permitido | P. Kilo |
| Productos | Solo los seleccionados por administrador |
| Usuario que lo aplica | Vendedor con permiso |
| Combinación | No acumulable con otro descuento |
| Protección | No puede bajar del precio mínimo |
| Registro | Precio original, descuento, precio final, usuario y hora |

Ejemplo:

```text
Producto: Arroz Extra
Cantidad: 2 kg
P. Kilo: S/ 10.00/kg
Precio Verde: − S/ 0.50/kg
Precio final: S/ 9.50/kg
Total: S/ 19.00
```

En la interfaz debe aparecer:

```text
Precio Kilo            S/ 10.00/kg
Precio Verde          − S/  0.50/kg
Precio final            S/  9.50/kg
```

No debe mostrarse solamente un botón verde, porque el usuario necesita entender cuánto se está descontando.

### 17.5 Propuesta para productos envasados

#### MVP: precio final manual

Para comenzar, cada presentación tendrá:

- nombre;
- factor o contenido;
- SKU;
- código de barras opcional;
- precio final;
- ubicación;
- modo de stock `consume principal`.

Ejemplo:

| Presentación | Contenido | Precio final |
|---|---:|---:|
| Granel | Libre | Según rango |
| Envase 250 g | 250 g | S/ 3.00 |
| Envase 500 g | 500 g | S/ 5.50 |
| Envase 1 kg | 1 000 g | S/ 10.50 |

El administrador decide el precio final. La app puede mostrar como referencia el valor del contenido al P. Kilo, pero no debe cambiar automáticamente el precio del envase durante el MVP.

#### Evolución posterior

Cuando el negocio conozca costos de empaque:

```text
Precio sugerido del envase
= valor del contenido
+ costo del envase
+ costo de preparación
+ margen
+ redondeo comercial
```

### 17.6 Propuesta de stock por presentación

Cada presentación debe elegir explícitamente:

| Opción coloquial | Comportamiento técnico | Ejemplo |
|---|---|---|
| Usa el stock del producto principal | `consume_principal` | Bolsa armada al vender |
| Tiene su propio stock | `own_stock` | Botella comprada terminada |

#### Regla predeterminada

- Producto creado desde Granel: las nuevas presentaciones usan el stock principal.
- Producto comprado terminado: la unidad principal lleva stock en unidades.
- Caja/docena de producto terminado: consume 12 unidades del principal.
- Presentación preparada con anticipación y contada por separado: requiere stock propio y operación de reempaque.

La pantalla debe preguntar:

> ¿De dónde sale esta presentación?

Opciones:

- `Del producto principal`
- `Tiene stock propio`

### 17.7 Propuesta para caja, docena y sarta

#### Caja/docena

Valor inicial:

```text
1 caja = 12 unidades
```

Debe ser editable porque podrían existir cajas de 6, 24 u otra cantidad.

#### Sarta

No debe existir un factor global. Cada producto debe indicar:

```text
1 sarta = ___ unidades
```

o, si corresponde:

```text
1 sarta = ___ gramos
```

No se debe permitir vender una sarta hasta completar ese dato.

#### Unidad suelta

```text
1 unidad suelta = 1 unidad del stock principal
```

### 17.8 Propuesta de ubicación

Para la primera versión, cada producto tendrá una ubicación principal dentro de cada almacén:

| Campo | Ejemplo |
|---|---|
| Zona | Granos |
| Pasillo | A |
| Estante/anaquel | 03 |
| Nivel | 2 |
| Casillero | B |
| Código mostrado | `A-03-2-B` |
| Observación | Cerca de la balanza |

#### Forma coloquial en la app

```text
¿Dónde está?
Zona: Granos
Ubicación: A-03-2-B
Cerca de la balanza
```

La ubicación se muestra al almacenero en cada línea del pedido:

```text
Arroz Extra — 5 kg
Está en: A-03-2-B
```

No se dividirá el saldo por estante en el MVP. Si un producto está en varios lugares, se registra primero la ubicación principal y las demás en observaciones.

### 17.9 Propuesta de permisos

| Acción | Administrador | Vendedor | Almacén |
|---|:---:|:---:|:---:|
| Ver productos | Sí | Sí | Sí |
| Ver precio de venta | Sí | Sí | No necesario |
| Ver costo | Sí | No | No |
| Cambiar precios | Sí | No | No |
| Aplicar Precio Verde | Sí | Sí, si está autorizado | No |
| Vender y cobrar | Sí | Sí | No |
| Ver clientes | Sí | Sí | No |
| Crear clientes | Sí | Sí | No |
| Ver stock disponible | Sí | Sí | Sí |
| Ajustar stock | Sí | No | Sí, con motivo |
| Ver Kardex | Sí | Solo consulta básica | Sí |
| Ver pedidos de almacén | Sí | Solo los propios | Sí |
| Cambiar estado de preparación | Sí | No | Sí |
| Administrar ubicaciones | Sí | No | Sí |
| Administrar usuarios | Sí | No | No |
| Configurar SUNAT/VPN | Sí | No | No |

#### Regla importante para almacén

Almacén puede agregar o quitar stock únicamente mediante una pantalla controlada que exija motivo. No puede cambiar precios, cobrar ni administrar usuarios.

### 17.10 Propuesta de inicio para cada perfil

#### Administrador

```text
Ventas de hoy
Stock bajo
Precios por revisar
Pedidos esperando
Cambiar precios
Agregar o quitar stock
```

#### Vendedor

```text
Buscar producto
Favoritos
Nuevo pedido
Pedidos abiertos
Cobrar
```

#### Almacén

```text
Pedidos nuevos
Alistando
Listos
Con problema
Buscar ubicación
Agregar o quitar stock
```

### 17.11 Propuesta de vocabulario definitivo

| Concepto | Palabra propuesta |
|---|---|
| Orden/lista/comanda comercial | Pedido |
| Supply request | Pedido al almacén |
| Preparar | Alistar |
| Pedido completado por almacén | Pedido listo |
| Producto medido | Granel |
| Variante | Presentación |
| Price tier | Tipo de precio |
| Stock adjustment | Agregar o quitar stock |
| Inventory movement | Movimiento de stock |
| Checkout | Cobrar |
| Cash session | Turno de caja |
| Warehouse location | Dónde está |
| Insufficient stock | No alcanza el stock |
| Price mismatch | El precio cambió |

Las únicas palabras pendientes de confirmar con el equipo son `Pedido`, `Alistar`, `Gramero` y `Emprendedor`.

### 17.12 Propuesta para avisos de precios

Cuando el administrador cambie un precio:

1. guardar precio anterior y nuevo;
2. pedir un motivo corto;
3. marcar el producto como `Precio cambiado`;
4. mostrarlo a vendedores durante 72 horas;
5. ordenar los cambios más recientes primero;
6. mostrar una notificación dentro de la app;
7. exigir que el vendedor toque `Entendido` solo para cambios críticos.

Texto recomendado:

```text
El precio cambió
Arroz Extra
Antes: S/ 10.00/kg
Ahora: S/ 10.50/kg
Hace 2 horas
```

El sonido debe ser opcional y no repetirse cada vez que se abre la pantalla.

### 17.13 Propuesta de cinco productos piloto

Los nombres deben reemplazarse por productos reales del negocio, conservando los casos:

| Piloto | Qué valida |
|---|---|
| Arroz o menestra a granel | Gramos, kilos y cuatro rangos |
| Producto a granel con envases de 250 g y 1 kg | Consumo proporcional del principal |
| Producto embotellado por unidad y caja/docena | Conteo y factor 12 |
| Producto vendido por unidad y sarta | Factor específico de sarta |
| Producto autorizado para Precio Verde | Descuento, permisos y auditoría |

Para cada piloto se debe completar esta ficha:

```text
Nombre:
Unidad principal:
Se vende a granel: sí / no
Presentaciones:
Contenido de cada presentación:
¿Consume principal o tiene stock propio?:
P. Gramero:
P. Kilo:
P. Mayor:
P. Emprendedor:
¿Permite Precio Verde?:
Costo promedio:
Margen mínimo:
Ubicación:
Observación:
```

### 17.14 Qué requiere configuración y qué requiere desarrollo

| Trabajo | Tipo |
|---|---|
| Definir nombres y límites de precios | Decisión/configuración |
| Cargar factores de caja y sarta | Datos del negocio |
| Configurar cinco productos piloto | Configuración con funciones existentes |
| Crear roles exactos | Configuración y ajuste menor |
| Cambiar textos técnicos | Ajuste sencillo de interfaz |
| Inicio diferente por rol | Desarrollo sencillo–medio |
| Pantalla de agregar/quitar stock | Desarrollo medio; backend existente |
| Ubicación principal por almacén | Desarrollo medio |
| Observaciones de pedido | Desarrollo medio |
| Precio Kilo con precios derivados | Desarrollo medio |
| Descuento Verde | Desarrollo medio |
| Historial y avisos de precio | Desarrollo medio |
| Actualización instantánea y sonido | Desarrollo medio–alto |
| Stock propio y reempaque | Desarrollo alto |

### 17.15 Propuesta final para aprobar

La propuesta base que recomiendo aprobar es:

1. `Granel` será el producto principal para artículos vendidos por peso.
2. Gramo y kilo serán formas de ingresar la cantidad.
3. Unidad, sarta y caja/docena serán presentaciones.
4. Caja tendrá factor inicial 12, pero será editable.
5. Sarta siempre exigirá su propio factor.
6. Los envases del MVP consumirán stock del principal.
7. El stock propio de productos preenvasados se implementará después.
8. Los rangos iniciales serán menos de 1 kg, 1–5 kg, 5–25 kg y 25 kg en adelante.
9. P. Kilo será la referencia; los otros precios tendrán sugerencias editables.
10. Precio Verde se interpretará provisionalmente como `− S/ 0.50 por kg`, solo en P. Kilo y productos autorizados.
11. Plomo quedará fuera.
12. No se combinarán descuentos.
13. Se registrará una ubicación principal por producto y almacén.
14. Los perfiles serán Administrador, Vendedor y Almacén.
15. La app usará `Pedido`, `Pedido al almacén`, `Alistar` y `Pedido listo`.
16. Los cambios de precio se resaltarán durante 72 horas.
17. La validación comenzará con cinco productos reales antes de cargar todo el catálogo.

## Resultado

La base actual ya soporta correctamente el corazón de la propuesta: **una variante principal Granel, venta por gramos/kilos, variantes envasadas y precios por rango**. Las brechas reales están en hacer explícito el tipo de stock de cada variante, separar el precio/costo de envasado, implementar el descuento por color, controlar la ubicación interna y facilitar cambios frecuentes de precios con historial y alertas.

Además, la facilidad de uso debe tratarse como un requisito funcional: **cada rol necesita su propio inicio, pocas acciones visibles y palabras que el equipo ya utiliza en el negocio**. La aplicación no estará completa solo porque las operaciones existan; también debe permitir que administrador, vendedor y almacén las encuentren y entiendan sin capacitación técnica.
