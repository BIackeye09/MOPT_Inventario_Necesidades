# Inventario de Necesidades del Camino · MOPT

Aplicación DPA-301, versión final 1.0.0 · 29 de octubre de 2026.

## Iniciar

- Ejecutá `dart herramientas/servir.dart` y abrí `http://localhost:8081`.
- También podés abrir `dist/index.html` con Live Server.
- La instalación como app necesita HTTPS o localhost. Los recursos están incluidos para trabajar sin conexión después de la primera carga.

## Completar el inventario

1. Elegí el camino del catálogo o ingresalo manualmente y completá su encabezado.
2. Agregá las hojas que necesités; cada una tiene sus estaciones, su dibujo y su croquis.
3. Registrá las estaciones con una sola coma o punto y de uno a tres decimales: `2,870`, `2.864`, `0,0`. Para un entero, usá `2,0`.
4. Cada hoja se ordena de menor a mayor, desde abajo. `2,864` queda debajo de `2,870`. No se permite repetir una estación en el mismo inventario, aunque cambien el separador, los ceros o la hoja.
5. Abrí **Representación gráfica** para colocar símbolos sobre la carretera completa.
6. Completá el croquis y las observaciones generales en **Parte trasera**.
7. Usá **Vista previa**, **Excel** o **PDF**. Cada documento incluye el frente y reverso de la hoja seleccionada.

Alcantarillas, cabezales y observaciones por estación son opcionales. Las medidas de alcantarillas admiten decimales y muestran metros. Al editar o eliminar una estación se acomodan sus datos; el dibujo libre de la carretera se conserva.

## Editor gráfico único

La aplicación utiliza únicamente el editor de la carretera completa. Cada hoja conserva su propio dibujo. Las 18 figuras oficiales mantienen sus píxeles y colores originales.

En teléfono, tocá **Abrir dibujo a pantalla completa** o la miniatura de la carretera. El menú y la lista de símbolos están plegados para aprovechar el espacio.

- **Mover y zoom:** un dedo mueve la vista y dos dedos acercan o alejan. Las figuras quedan bloqueadas.
- **Símbolo:** un dedo selecciona y mueve una figura; dos dedos escalan toda la figura. La vista queda fija.
- Los tiradores laterales cambian solo el **largo**; arriba y abajo cambian solo el **grosor**. Las zonas táctiles miden 44 px y acompañan el giro del símbolo.
- La flecha circular permite girar. **☰** también reúne Alargar, Acortar, Más grosor, Menos grosor, tamaño completo, giros de 15°, Duplicar, Eliminar y Deshacer.
- **＋ Agregar** abre las figuras cuando está elegido Símbolo. **←** vuelve al inventario. Los cambios se guardan automáticamente.

Las líneas horizontales azules delimitan los renglones de las estaciones registradas. Siguen el orden numérico, se actualizan con la hoja y mantienen su grosor con zoom. Son guías visuales: no bloquean el arrastre ni aparecen en el documento.

La vista principal conserva el ancho de trabajo y crece con toda la ruta. En computadora permite editar directamente; en teléfono abre el editor al tocarla. Dentro del editor, **Ver todo** muestra la carretera entera y **Ancho de trabajo** ajusta su ancho. Girar el teléfono conserva el dibujo.

El zoom y los controles no se exportan. Vista previa, Excel y PDF usan siempre el mismo dibujo completo de la hoja. Los símbolos llegan a ambos bordes del recuadro; al girarlos se limita únicamente su contorno visible.

## Croquis y observaciones

El croquis abre una hoja blanca que ocupa la ventana disponible de la app. Solo queda el acceso flotante **☰**. Ahí están Lápiz, Borrador parcial, Mover lienzo, tamaño, zoom, Deshacer, Rehacer, Limpiar y Volver a la app. Elegir una herramienta cierra el menú para dibujar.

**Llenar pantalla** conserva las proporciones originales y permite recorrer lo que queda fuera con Mover lienzo. **Ver hoja completa** ajusta el papel entero. Girar el teléfono mantiene el dibujo y el centro de trabajo. No se solicita pantalla completa al navegador para evitar su aviso sobre el papel.

Las observaciones generales se escriben fuera del lienzo y ocupan los ocho renglones originales del reverso, en Arial 12 negro. La app avisa si un texto no cabe, sin reducir la letra ni modificar la plantilla.

## Guardado y actualización

El borrador se conserva en el mismo navegador, dispositivo y dirección. No hay base de datos, sincronización entre equipos ni panel de respaldo. Crear un inventario nuevo requiere confirmar que se reemplazará el borrador; descargá antes los documentos que necesités conservar.

Los borradores anteriores se recuperan automáticamente. Se conserva el dibujo de la carretera completa aunque antes estuviera seleccionada otra vista. Si el borrador solo tenía dibujos por estación, se adaptan una vez a la carretera completa con sus posiciones, tamaños y giros. No se mezclan dos dibujos encima del mismo plano.

Los enteros antiguos se recuperan con `,0`. Las estaciones repetidas que ya existían se señalan para corregirlas sin eliminar registros automáticamente.

La caché de la PWA usa la versión **1.0.0**. Después de actualizar `dist/`, recargá con conexión o cerrá y volvé a abrir la app hasta ver esa versión al pie. Cambiar el navegador, dominio o puerto crea otro espacio de guardado.

## Plantilla oficial

- Se conservan las medidas, combinaciones, bordes, dibujos y configuración de impresión del XLS original BIFF8 y las dos páginas del PDF original.
- Encabezado: Arial 14, negrita y negro en Excel. La N queda centrada; cantón y provincia mantienen su alineación.
- Estaciones y observaciones: Arial 12 negro. Las cifras y unidades siguen los mismos renglones del documento.
- No hay botón de imprimir, panel lateral de vista previa ni lateral de instalación/respaldo. Instalar está junto a Vista previa; las hojas están en el selector superior.

## Ejemplos, publicación y pruebas

El proyecto completo tiene **95 archivos**, de los que **49** corresponden a `dist/`. Seguí `SUBIR_A_GITHUB.md` para actualizar la aplicación conservando la configuración de hosting.

`ejemplos/representacion-grafica.xls` y `.pdf` muestran el dibujo completo; `croquis-localizacion.xls` y `.pdf` muestran el reverso. Los JSON son muestras internas y no se importan desde la interfaz.

Ejecutá `npm test`. Las pruebas comprueban captura y orden de estaciones, duplicados, recuperación, compatibilidad de dibujos anteriores, límites y giro, cámara, gestos táctiles, largo y grosor independientes, Deshacer, croquis, observaciones, imágenes originales, contenido BIFF8 y recursos sin conexión.

Para regenerar la muestra gráfica, ejecutá `node scripts/generar_ejemplos_graficos.mjs`.
