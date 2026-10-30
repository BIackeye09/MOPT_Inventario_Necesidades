# Inventario de Necesidades del Camino · MOPT

Aplicación DPA-301, versión 1.3.1 · 30 de octubre de 2026.

## Iniciar

- Ejecutá `dart herramientas/servir.dart` y abrí `http://localhost:8081`.
- También podés abrir `dist/index.html` con Live Server.
- La instalación como app necesita HTTPS o localhost. Los recursos están incluidos para trabajar sin conexión después de la primera carga.

## Completar el inventario

En teléfono, los títulos y etiquetas usan azul marino, el contenido un tono oscuro y las ayudas verde petróleo. Las etiquetas y ayudas tienen 14 px y los campos 16 px para facilitar la lectura. **Nuevo inventario** y **Agregar hoja** muestran sus nombres completos; en pantallas pequeñas, Agregar hoja ocupa una fila propia. La presentación de Excel y PDF conserva los estilos de la plantilla.

1. Elegí el camino del catálogo o ingresalo manualmente y completá su encabezado.
2. Agregá las hojas que necesités; cada una tiene sus estaciones, su dibujo y su croquis.
3. Registrá las estaciones con una sola coma o punto y de uno a tres decimales: `2,870`, `2.864`, `0,0`. Para un entero, usá `2,0`.
4. Cada hoja se ordena de menor a mayor, desde abajo. `2,864` queda debajo de `2,870`. No se permite repetir una estación en el mismo inventario, aunque cambien el separador, los ceros o la hoja.
5. En una estación guardada, tocá **Símbolos** para elegir por nombre o imagen y colocarlos automáticamente. **Representación gráfica** permite ajustar las figuras sobre la carretera completa.
6. Completá el croquis y las observaciones generales en **Parte trasera**.
7. Usá **Revisar inventario** para encontrar datos, formularios y textos pendientes. Cada aviso abre su sección.
8. Usá **Vista previa**, **Excel** o **PDF** para la hoja seleccionada. En **Más** están **Descargar PDF completo** y **Descargar todos los Excel (ZIP)**, con el frente y reverso de todas las hojas.

Al final de cada sección están **Anterior** y **Siguiente**, con el nombre de su destino. Recorren Encabezado, Estaciones y detalles, Representación gráfica y Parte trasera · Croquis, y llevan al inicio de la sección elegida. Los formularios pendientes se conservan al avanzar o volver.

Los campos usan ejemplos sencillos: estación `0,000`, diámetro `0,5 m`, longitud de alcantarilla `1 m`, número de cabezales `1` y observación `Un hueco`. Son indicaciones para escribir; los campos siguen vacíos hasta que ingresés tus datos.

## Superficie del catálogo

Al seleccionar un camino se completa **Tipo de superficie actual (B)** cuando el material del Excel tiene una equivalencia clara en DPA-301. Podés cambiarlo según lo observado en carretera. Elegir otro camino actualiza esta referencia; las selecciones y correcciones guardadas se conservan al reabrir el inventario.

El catálogo usa `BE` y `BF` de `RVN_0524`, `AM` de `Travesías` y la tabla `Códigos 2` del Excel Red Vial Nacional 2024. Los campos `BC` y `BD` describen el terreno y no se usan como superficie de ruedo. El RTF de Heredia mantiene la relación entre código del camino y sección.

| Código del Excel | Material del catálogo | Código DPA-301 |
| --- | --- | --- |
| 1 | Carpeta asfáltica | 1 · Asfalto |
| 2 y 3 | Tratamiento superficial múltiple o simple | 3 · Tratamiento superficial |
| 4 | Lastre o grava | 4 · Lastre o grava |
| 6 | Tierra mejorada | 5 · Tierra |
| 9 | Hormigón o concreto | 2 · Concreto |

Hay 1.234 secciones con equivalencia y 89 que requieren seleccionar la superficie. En estas últimas, la app muestra el material original cuando está disponible, por ejemplo material producto del perfilado, sello asfáltico u otros. La referencia corresponde al catálogo 2024 y sigue siendo editable. Los códigos convertidos se usan en el encabezado de Excel y PDF.

Alcantarillas, cabezales y observaciones por estación son opcionales. Las medidas de alcantarillas admiten decimales y muestran metros. Al editar o eliminar una estación se acomodan sus datos y sus símbolos vinculados; el dibujo libre de la carretera se conserva.

Los campos de una estación se guardan mientras escribís, aunque estén incompletos. Al volver a abrir la app o cambiar de hoja se recupera ese formulario. **Agregar estación** o **Guardar cambios** incorpora sus datos al documento; un formulario pendiente todavía no se exporta. **Descartar borrador** lo vacía, y **Cancelar edición** conserva el registro anterior.

## Colocar símbolos desde Estaciones

Cada estación guardada tiene un botón **Símbolos**. Elegí una de las 18 figuras por su nombre o en **Elegir por imagen**, seleccioná la ubicación y el lado, y tocá **Colocar símbolo**. Si marcás **Elegir símbolos al guardar la estación**, la ventana se abre al agregar o guardar ese registro. No es obligatorio colocar figuras.

| Ubicación | Lados disponibles | Espacio en la plantilla |
| --- | --- | --- |
| Acera | Izquierda o derecha | Las franjas exteriores |
| Cuneta / caño | Izquierda o derecha | Las columnas estrechas |
| Carretera | Izquierda, derecha o ambos carriles | Los dos carriles centrales |

Todos los símbolos admiten estas siete ubicaciones. El ajuste automático centra la figura dentro del renglón de su estación y de la franja elegida. Una ubicación individual conserva sus proporciones; **Ambos carriles** usa una sola imagen a lo ancho de la carretera y adapta su alto si hace falta para que quepa en el renglón. Es un tamaño gráfico de la plantilla, no una escala en metros.

La lista de Estaciones muestra el renglón de carretera con sus figuras y todos sus nombres. La ventana de colocación también muestra los símbolos existentes, con su tamaño, posición y giro actuales. Incluye los dibujos libres del gráfico completo que cruzan ese renglón. Negro significa ya colocado; el símbolo atenuado y el recuadro azul anticipan el siguiente agregado. Si elegís uno que ya está en esa ubicación, el botón muestra **Ya colocado** y se desactiva. La protección también reconoce figuras vinculadas ajustadas manualmente y dibujos libres del mismo tipo que ya ocupan esa posición. Podés usar el mismo símbolo en otra ubicación. Los duplicados anteriores se muestran para poder revisarlos y quitarlos, sin borrarlos automáticamente.

Los símbolos quedan vinculados al registro: si cambia el orden numérico, se trasladan con su estación. Eliminar una estación también quita sus figuras vinculadas, con confirmación; las figuras libres se conservan. **Ver en gráfico** abre el mismo editor completo para ajustar largo, grosor, posición o giro. Después de un ajuste manual se conservan esas medidas y el giro al reordenar las estaciones. **Ubicación → Aplicar ajuste automático** vuelve al tamaño, posición y giro iniciales de la franja elegida. **Quitar** retira solo esa figura y conserva la estación.

Esta colocación trabaja sobre el único dibujo completo de la hoja. La vista previa, Excel y PDF usan esas mismas figuras y coordenadas. La franja coloreada de la ventana solo ayuda a elegir la ubicación y no aparece en los documentos.

## Editor gráfico único

La aplicación utiliza únicamente el editor de la carretera completa. Cada hoja conserva su propio dibujo. Las 18 figuras oficiales mantienen sus píxeles y colores originales.

En teléfono, tocá **Abrir dibujo a pantalla completa** o la miniatura de la carretera. El menú y la lista de símbolos están plegados para aprovechar el espacio.

- **Mover y zoom:** un dedo mueve la vista y dos dedos acercan o alejan. Las figuras quedan bloqueadas.
- **Símbolo:** un dedo selecciona y mueve una figura; dos dedos escalan toda la figura. La vista queda fija.
- Los tiradores laterales cambian solo el **largo**; arriba y abajo cambian solo el **grosor**. Las zonas táctiles miden 44 px y acompañan el giro del símbolo.
- La flecha circular permite girar. **☰** también reúne Alargar, Acortar, Más grosor, Menos grosor, tamaño completo, giros de 15°, Duplicar, Eliminar y Deshacer.
- En **☰ → Mostrar flechas sobre el dibujo**, cuatro flechas mueven ligeramente la figura mientras el dibujo permanece visible, sin alterar largo, grosor ni giro. **×** oculta esas flechas para recuperar espacio. En computadora están en **Posición, bloqueo y ángulo exacto**.
- **Bloquear símbolo** protege esa figura del arrastre, pellizco, teclado y herramientas. Se puede seleccionar para **Desbloquear símbolo**; las demás figuras siguen editables. El bloqueo se guarda y no cambia su imagen exportada.
- **Ajustar al arrastrar cerca de guías y bordes** es opcional y viene apagado. Acerca el contorno visible a los límites de estación, bordes de calzada o recuadro sin cambiar su tamaño. Desactivarlo conserva el movimiento libre.
- **＋ Agregar** abre las figuras cuando está elegido Símbolo. **←** vuelve al inventario. Los cambios se guardan automáticamente.

Las líneas horizontales azules delimitan los renglones de las estaciones registradas. Siguen el orden numérico, se actualizan con la hoja y mantienen su grosor con zoom. Son guías visuales: no bloquean el arrastre ni aparecen en el documento.

La vista principal conserva el ancho de trabajo y crece con toda la ruta. En computadora permite editar directamente; en teléfono abre el editor al tocarla. Dentro del editor, **Ver todo** muestra la carretera entera y **Ancho de trabajo** ajusta su ancho. Girar el teléfono conserva el dibujo.

El zoom y los controles no se exportan. Vista previa, Excel y PDF usan siempre el mismo dibujo completo de la hoja. Los símbolos llegan a ambos bordes del recuadro; al girarlos se limita únicamente su contorno visible.

## Croquis y observaciones

El croquis abre una hoja blanca que ocupa la ventana disponible de la app. Solo queda el acceso flotante **☰**. Ahí están Lápiz, Borrador parcial, Mover lienzo, tamaño, zoom, Deshacer, Rehacer, Limpiar y Volver a la app. Elegir una herramienta cierra el menú para dibujar.

**Llenar pantalla** conserva las proporciones originales y permite recorrer lo que queda fuera con Mover lienzo. **Ver hoja completa** ajusta el papel entero. Girar el teléfono mantiene el dibujo y el centro de trabajo. No se solicita pantalla completa al navegador para evitar su aviso sobre el papel.

Las observaciones generales se escriben fuera del lienzo y ocupan los ocho renglones originales del reverso, en Arial 12 negro. La app avisa si un texto no cabe, sin reducir la letra ni modificar la plantilla.

## Guardado y actualización

**Mis inventarios** conserva varios trabajos en este navegador, dispositivo y dirección. Podés buscarlos por código, número o tramo y tocar **Continuar**. Crear uno nuevo guarda el anterior con sus hojas, dibujos, croquis, observaciones y formularios pendientes. Si el actual ya está vacío se reutiliza.

Los trabajos anteriores tienen **Quitar del dispositivo** para liberar espacio, con confirmación. Abrilos y guardá primero su copia editable si los necesitás conservar. El inventario actual no se puede quitar desde la lista.

En **Más → Guardar copia editable** se descarga un archivo `.mopt.json` con todo el trabajo. **Abrir copia editable** lo valida y crea un inventario independiente, conservando el anterior. Así se puede continuar en otro teléfono o computadora sin servidor ni sincronización automática. Excel y PDF son los documentos para entregar; la copia editable permite seguir trabajando dentro de la app.

El guardado detecta cambios realizados desde otra ventana y avisa si el navegador no tiene espacio. En esos casos conservá una copia editable antes de cerrar. La app no cambia de inventario si no pudo guardar el trabajo actual. Los datos locales dependen de que no se borre el almacenamiento del navegador.

Los borradores anteriores se recuperan automáticamente. Se conserva el dibujo de la carretera completa aunque antes estuviera seleccionada otra vista. Si el borrador solo tenía dibujos por estación, se adaptan una vez a la carretera completa con sus posiciones, tamaños y giros. No se mezclan dos dibujos encima del mismo plano.

Los enteros antiguos se recuperan con `,0`. Las estaciones repetidas que ya existían se señalan para corregirlas sin eliminar registros automáticamente.

La caché de la PWA usa la versión **1.3.1**. Después de actualizar `dist/`, recargá con conexión o cerrá y volvé a abrir la app hasta ver esa versión al pie. Cambiar el navegador, dominio o puerto crea otro espacio de guardado; abrí una copia editable para trasladar el trabajo.

## Revisar y descargar el inventario completo

**Revisar inventario** muestra los datos pendientes del encabezado, las estaciones antiguas repetidas, los formularios sin agregar y los textos que no caben en su espacio. Sus accesos abren la hoja y sección correspondientes. También resume las estaciones, figuras, croquis y observaciones de cada hoja; los campos opcionales no se convierten en obligatorios. La comprobación de texto detecta el primer problema de cada hoja: después de corregirlo, volvé a revisar. La ubicación de los dibujos se revisa en Vista previa.

**Más → Descargar PDF completo** une las dos páginas originales de cada hoja en orden: frente 1, reverso 1, frente 2, reverso 2. **Descargar todos los Excel (ZIP)** reúne un XLS independiente por hoja, con sus dos caras y sus nombres numerados. No se añaden hojas, rótulos ni cambios a la plantilla. Estas opciones trabajan con una instantánea del inventario y muestran el progreso. Los formularios pendientes de agregar se conservan en las copias editables y se indican en la revisión.

## Plantilla oficial

- Se conservan las medidas, combinaciones, bordes, dibujos y configuración de impresión del XLS original BIFF8 y las dos páginas del PDF original.
- Encabezado: Arial 14, negrita y negro en Excel. La N queda centrada; cantón y provincia mantienen su alineación.
- Estaciones y observaciones: Arial 12 negro. Las cifras y unidades siguen los mismos renglones del documento.
- No hay botón de imprimir, panel lateral de vista previa ni lateral de instalación/respaldo. Instalar está junto a Vista previa; las hojas están en el selector superior.

## Ejemplos, publicación y pruebas

El proyecto completo tiene **99 archivos**, de los que **52** corresponden a `dist/`. Seguí `SUBIR_A_GITHUB.md` para actualizar la aplicación conservando la configuración de hosting.

`ejemplos/representacion-grafica.xls` y `.pdf` muestran el dibujo completo; `croquis-localizacion.xls` y `.pdf` muestran el reverso. Sus JSON se pueden abrir desde **Más → Abrir copia editable** como inventarios independientes.

Ejecutá `npm test`. Las pruebas comprueban conversión y selección de superficie, navegación entre secciones, captura y orden de estaciones, duplicados, recuperación de formularios, varios inventarios, importación sin reemplazos, falta de espacio y ediciones entre ventanas; también los 18 símbolos en las siete ubicaciones y los 26 renglones, sus vínculos al reordenar y eliminar estaciones, límites, bloqueo, ajuste a guías, giro, cámara, gestos, largo y grosor independientes, Deshacer, croquis, observaciones, imágenes originales, contenido BIFF8, PDF conjunto, ZIP y recursos sin conexión.

Para regenerar la muestra gráfica, ejecutá `node scripts/generar_ejemplos_graficos.mjs`.
