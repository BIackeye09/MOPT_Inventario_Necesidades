# Inventario de Necesidades del Camino · MOPT

Versión 0.5.0 de la aplicación independiente del Reporte Diario de Actividades.
Implementa el encabezado y las estaciones DPA-301, con vista previa y descargas
de Excel y PDF usando la plantilla original. Los croquis y las firmas se
completan en los espacios originales de Excel.

## Uso

1. Abrir la aplicación y pulsar **Seleccionar un camino**.
2. Buscar por código de camino, sección de control, ruta o lugar. El filtro inicial
   es Heredia; se puede cambiar a otra provincia o a todo el país.
3. Seleccionar una sección y revisar DE/A, ruta, longitud, provincia y cantón.
4. Elegir la superficie actual de la plantilla DPA-301.
5. Pulsar **Verificar encabezado**. NÚMERO es opcional y la macro región siempre es V.
6. Usar **Agregar hoja** para pasar de 1 de 1 a 1 de 2, 2 de 2 y así sucesivamente.
   Agregar una hoja conserva la selección actual. Todas comparten el encabezado.
7. Abrir **Estaciones y detalles**. Ingresar la estación y los hallazgos, y pulsar
   **Agregar estación**. Cada hoja tiene sus propios registros.
8. Abrir **Representación gráfica** y elegir **Caso 1 · Editor completo** o
   **Caso 2 · Por estación**. Cada caso conserva un dibujo independiente.
9. Revisar la vista previa o descargar Excel/PDF de la hoja seleccionada.
10. Descargar un respaldo JSON para conservar el borrador o abrirlo en otro equipo.

El guardado automático pertenece al navegador y al dispositivo donde se llena.
Al crear un inventario nuevo o abrir un respaldo se descarga una copia del borrador
actual antes de reemplazarlo. Borrar los datos del navegador puede borrar el borrador.

Los caminos cantonales se pueden ingresar manualmente seleccionando **C**; no se
adjuntó un catálogo cantonal. Los campos manuales también permiten rutas nacionales
que no estén en el catálogo. No se determina N/C por el primer dígito del código:
las secciones nacionales de Heredia siguen siendo **N**, incluidas las travesías.

## Ejecutar con Dart en VS Code

Se usa el mismo arranque con Dart del Reporte Diario MOPT. Si ya tenés Flutter,
su instalación incluye Dart. Ver **LEEME_PRIMERO.txt** para más detalles.

1. Extraer todo el ZIP y abrir la carpeta **MOPT_Inventario_Camino** en VS Code.
2. Tener instalada la extensión **Dart**, del autor **Dart Code**.
3. Abrir **herramientas/servir.dart** y presionar **F5**. La configuración incluida
   inicia **Iniciar inventario MOPT con Dart** y abre el navegador automáticamente.
4. Dejar la terminal abierta mientras se trabaja. Detener con **Ctrl+C**.

También se puede ejecutar desde la terminal de la carpeta del proyecto:

```bash
dart herramientas/servir.dart
```

Se abre `http://localhost:8081`. Dart sirve automáticamente `dist/`; no hace falta
abrir el HTML ni usar Live Server. No requiere Node.js, `npm install`,
`dart pub get` ni SDK de Android. El servidor usa solo `dart:io`.

Si VS Code no encuentra Dart, usar **Dart: Locate SDK** y seleccionar la carpeta
`flutter/bin/cache/dart-sdk` dentro de la instalación de Flutter, o el SDK
independiente. Para la otra computadora, si no tiene Dart, seguir su
[guía oficial](https://dart.dev/get-dart). La extensión no incluye el SDK.

La PWA conserva la instalación y el uso sin conexión después de completar su
primera carga. Pulsar **Instalar aplicación** en el navegador cuando esté lista.
Ejecutar `servir.dart` permite iniciar o actualizar los recursos locales.

El inventario usa el puerto **8081** y Reporte Diario puede seguir en **8080**.
Ambas aplicaciones pueden ejecutarse al mismo tiempo. Si otro programa ocupa
8081, se puede elegir otro con `dart herramientas/servir.dart --port=8082`.

Para continuar en otra computadora: **Descargar respaldo** en la primera y
**Abrir un respaldo** en la segunda. Los borradores no se sincronizan entre equipos.
Usar siempre la misma dirección `http://localhost:8081` y el mismo navegador.

**Pasar un borrador de 8080 a 8081:** antes de actualizar, abrir la versión anterior
en 8080 y pulsar **Descargar respaldo**. Luego iniciar esta versión en 8081 y usar
**Abrir un respaldo**. Los guardados y la instalación de la PWA son independientes
para cada puerto. Si se necesita recuperar el acceso anterior, ejecutar
`dart herramientas/servir.dart --port=8080` y detener temporalmente Reporte Diario
para no ocupar su puerto.
El sitio publicado y la dirección local tienen guardados separados.

Guía oficial de Chrome: https://support.google.com/chrome/answer/9658361?hl=es-419

## Estructura

| Ruta | Contenido |
| --- | --- |
| `dist/index.html` | Formulario, hojas, selector y vistas del encabezado |
| `dist/css/styles.css` | Interfaz adaptable para computadora, tableta y teléfono |
| `dist/js/app.js` | Eventos, guardado local, respaldo y actualización de la pantalla |
| `dist/js/model.js` | Datos del inventario, validación, numeración y búsqueda |
| `dist/js/stations.js` | Formato de estaciones, metros y orden de los 26 renglones |
| `dist/js/station-ui.js` | Pestañas y edición de estaciones por hoja |
| `dist/js/pwa.js` | Instalación nativa o instrucciones según el navegador |
| `dist/data/caminos.json` | Catálogo extraído y trazabilidad de las filas de origen |
| `dist/sw.js` | Recursos para uso sin conexión |
| `dist/manifest.webmanifest` | Configuración de la PWA |
| `herramientas/servir.dart` | Servidor local y apertura del navegador con Dart |
| `.vscode/launch.json` | Configuración de inicio con F5 |
| `scripts/generar_catalogo.py` | Extracción reproducible de los catálogos originales |
| `scripts/generar_iconos.py` | Símbolo e iconos de instalación |
| `tests/inventario.test.mjs` | Pruebas de datos, numeración y recuperación |
| `referencias/` | Archivos originales, conservados sin modificaciones |

## Criterios de datos

- Fuente principal: `Red Vial Nacional 2024(1).xlsx`, hojas `RVN_0524` y `Travesías`.
  La longitud es la de la **sección seleccionada**, no la longitud acumulada ni
  la suma de toda la ruta. Se conservan hasta seis decimales del origen.
- El RTF `red nacional heredia(1).rtf` relaciona el código de camino con la sección
  de control para Heredia. Por ejemplo, `4-0000-00` corresponde a la sección `40000`.
  Los datos de ruta, longitud y tramo provienen del Excel 2024, aun cuando el RTF
  contenga valores antiguos o redondeados.
- Para las otras provincias se conserva la sección exacta del Excel como código
  de búsqueda: no se inventan códigos que el RTF de Heredia no documenta.
- Los nombres de cantón provienen de `Longitud Por Provincia` y se relacionan por
  el código de provincia más los dos dígitos de cantón.
- Resultado: 1323 secciones utilizables; 109 de Heredia (94 de la hoja principal
  y 15 travesías). Se incluyeron códigos guardados como texto, por ejemplo el
  cantón `10` de Sarapiquí.
- Doce filas del Excel sin descripción o longitud positiva se excluyen del selector;
  el motivo y la fila quedan registrados en `audit.skippedRows` del catálogo.
- En once descripciones nacionales la separación DE/A es ambigua. No se inventan
  sus extremos: se muestra la descripción íntegra y se pide completar ambos campos.
- La superficie actual se selecciona de la codificación **DPA-301**: 1 Asfalto,
  2 Concreto, 3 Tratamiento superficial, 4 Lastre o grava, 5 Tierra. No se copian
  los códigos de superficie del catálogo 2024, porque corresponden a otra lista.
- NÚMERO queda vacío, editable y opcional hasta definir su uso institucional.

## Desarrollo y comprobaciones

Node.js solo se utiliza para las pruebas de desarrollo incluidas; no es
un requisito para iniciar ni usar esta PWA con Dart.

```bash
npm test
```

Las pruebas incluyen cruces del Excel 2024 con códigos del RTF, cantonales manuales,
longitudes con coma/punto, hojas múltiples, borradores incompletos y rechazo de
respaldos dañados. También comprueban que existan todos los recursos de la caché.

Para regenerar el catálogo se necesita Python con `openpyxl` y los archivos de
`referencias/`:

```bash
python scripts/generar_catalogo.py
```

El catálogo ya está generado; Python no es necesario para utilizar la aplicación.
La plantilla `.xls` original se conserva íntegra en `referencias/` y `dist/templates/`.
La descarga Excel rellena sus entradas directamente, manteniendo ambos nombres de
hoja, cada estilo, los dibujos, combinaciones y configuración de impresión.
El PDF parte de las dos páginas del original y únicamente superpone los valores.
La vista previa muestra exactamente los mismos bytes del PDF descargable.

## Representación gráfica: dos casos para comparar (0.5.0)

Abrir la pestaña **Representación gráfica** de la hoja seleccionada. La selección
entre los dos casos determina qué dibujo se usa en vista previa, Excel y PDF;
el indicador superior lo confirma. Los campos y las estaciones son comunes,
pero cada caso conserva sus propios símbolos y posiciones.

### Caso 1: editor completo

La simbología del reverso aparece junto a la carretera completa. Hacer clic en
una figura o arrastrarla desde la lista para incorporarla. Mover el símbolo con
el ratón y arrastrar sus esquinas para cambiar ancho y alto. El zoom permite
trabajar con más precisión y los rótulos a la izquierda ubican las estaciones.
Se puede colocar un símbolo a lo largo de varios renglones.

### Caso 2: por estación

Cada estación muestra su renglón gráfico y una lista con los 18 símbolos.
Seleccionar la figura y pulsar **Agregar símbolo**. Se pueden agregar varios
símbolos en una misma estación, moverlos y cambiarles el tamaño dentro de su fila.
Los renglones mantienen el orden de abajo hacia arriba. Al eliminar una estación
se eliminan también sus símbolos de este caso. El dibujo libre permanece intacto.

### Controles y descargas

- Al seleccionar un símbolo aparece una **flecha circular**, como en Word.
  Arrastrarla alrededor de la figura permite girarla en ambos casos. En teléfono
  se usa con el dedo; en computadora, Shift ajusta el giro a pasos de 15°.
- **Reducir** y **Agrandar** cambian el tamaño del símbolo seleccionado.
- **↶ 15°** y **↷ 15°** giran a izquierda o derecha. **Ángulo (°)** permite
  escribir un giro exacto; **Restablecer 0°** devuelve la orientación original.
  Los dos casos tienen estos controles, disponibles también al tocar en teléfono.
  El giro se guarda en cada dibujo y en los respaldos; los anteriores parten de 0°.
  Si una figura girada no cabe en su recuadro, se reduce sin recortarla.
- **Duplicar**, **Eliminar** y **Deshacer** permiten corregir el dibujo.
- Con un símbolo seleccionado en el gráfico, las flechas lo desplazan. Shift
  aumenta el paso. Suprimir o Retroceso elimina la selección.
- Cada hoja admite hasta 200 símbolos por caso. Ambos dibujos se incluyen en
  el respaldo y en el guardado del navegador. Los respaldos antiguos se recuperan
  con ambos dibujos inicialmente vacíos.
- Excel recibe imágenes nativas independientes, con las mismas posiciones,
  tamaños y orientaciones del editor y el PDF. El giro se incorpora a cada PNG
  con transparencia para evitar diferencias de interpretación del formato XLS.
  Las figuras se pueden seleccionar individualmente
  en Excel. No se sustituyen los dibujos originales ni se cambia la plantilla.
- Los nombres descargados indican `caso-1-libre` o `caso-2-estaciones` cuando el
  caso contiene símbolos, para comparar los resultados sin confundir los archivos.

En `ejemplos/` están **caso-1-editor-completo.xls/.pdf** y
**caso-2-por-estacion.xls/.pdf**. Usan las mismas figuras y posiciones para mostrar
que ambos métodos pueden producir el mismo documento. Abrir
**comparar-dos-casos.json** con **Abrir un respaldo** para probar los dos dibujos.
La aplicación ofrece descargar una copia del borrador actual antes de abrirlo.

### Probar desde el teléfono

Abrir https://mopt-inventario-caminos-sgv.docilepeony128.chatgpt.site con la misma
cuenta autorizada. El sitio conserva su acceso privado. No se necesita subir
archivos a GitHub ni mantener encendida la computadora. En **Representación
gráfica** se puede alternar entre los dos casos; tocar una figura la selecciona,
arrastrarla la mueve y los botones permiten reducir, agrandar y girar.
El editor completo ajusta su ancho a la pantalla y el caso por estación muestra
la lista encima de un renglón más ancho para trabajar con el dedo.

Los datos se guardan en cada navegador: para continuar un inventario del equipo
en el teléfono, descargar su respaldo JSON y abrirlo allí con **Abrir un respaldo**.

## Parte trasera: croquis de localización (0.5.0)

Abrir **Parte trasera · Croquis** en la hoja correspondiente. El área blanca
representa el espacio bajo el título del croquis en la plantilla original.

- **Lápiz** dibuja trazos libres en negro con ratón, lápiz táctil o dedo.
- **Borrador** elimina únicamente el fragmento por donde se pasa. No borra un
  trazo completo ni las líneas originales del formulario.
- **Tamaño** cambia el grosor del lápiz o el diámetro del borrador; cada herramienta
  recuerda su ajuste.
- **Deshacer** y **Rehacer** recuperan las últimas operaciones. **Limpiar croquis**
  vacía el dibujo de esta hoja y también se puede deshacer.
- **Zoom** amplía el área para dibujar. **Mover lienzo** permite recorrerla sin
  dejar trazos, también en teléfono.

Cada hoja conserva un croquis independiente, compartido por los dos casos de
representación gráfica frontal. Se guarda automáticamente en el dispositivo y en
el respaldo JSON. Los respaldos anteriores se abren con el croquis vacío.
Con el lienzo enfocado, Ctrl+Z deshace, Ctrl+Y o Ctrl+Shift+Z rehace, B activa
el lápiz, E el borrador y H permite mover el lienzo.

La vista previa, Excel y PDF reciben la misma imagen transparente, con el mismo
contenido y posición en el reverso. Se conservan la simbología, el marco, los
títulos y los demás espacios originales. En Excel el croquis queda como una
imagen independiente; el dibujo se edita desde la aplicación.

En `ejemplos/` están **croquis-localizacion.xls**, **croquis-localizacion.pdf** y
**croquis-localizacion.json**. El respaldo permite probar un dibujo de muestra
con trazo libre y un fragmento borrado, junto con ambos casos gráficos del frente.
Para regenerarlos en desarrollo: `node scripts/generar_ejemplo_croquis.mjs`.

Las figuras se extrajeron del PDF original del reverso en PNG con transparencia.
`scripts/extraer_simbolos.py` permite repetir la extracción durante el desarrollo
con PyMuPDF y Pillow. No es necesario ejecutarlo para usar la PWA.
`scripts/generar_ejemplos_graficos.mjs` genera los ejemplos mediante las mismas
funciones que usa la aplicación.

## Estaciones y detalles (0.3.0)

La pestaña **Estaciones y detalles** permite agregar, editar y eliminar registros
sin recorrer el formulario del encabezado. Los datos de cada estación se guardan
al pulsar **Agregar estación** o **Guardar cambios**. El encabezado sigue siendo
común, pero las estaciones pertenecen a la hoja seleccionada.

- La primera estación ocupa la fila inferior (49). Las siguientes van subiendo,
  en el orden de captura, hasta la fila 24. No se ordenan por kilometraje.
- Se admiten 26 estaciones por hoja. Al llenarla, **Agregar hoja y continuar** crea
  otra hoja y la selecciona. **Agregar hoja** en el panel lateral conserva su
  comportamiento anterior y mantiene la selección actual.
- ESTACIÓN se escribe en kilómetros, con coma o punto y hasta tres decimales:
  `0,0` se muestra como `0 + 000`; `4,9` como `4 + 900`; `12,678` como `12 + 678`.
- Diámetro y longitud de alcantarilla aceptan decimales. Cuando hay un valor,
  se agrega `m`. En Excel son cifras numéricas con formato de unidad, editables.
  Las casillas vacías permanecen vacías y cero se muestra como `0 m`.
- Diámetro, longitud, número y tipo de cabezales son opcionales. Número acepta
  enteros no negativos y Tipo es texto libre. Observaciones describe el hallazgo
  de la estación, por ejemplo `Huecos 2x2 (6)`.
- Los datos de la tabla usan Arial 12 en negro. El encabezado conserva Arial 14
  en negrita. No se reduce la letra ni se modifica la geometría del documento.
- Las observaciones y el tipo pueden ajustarse en renglones dentro de su casilla.
  Si el texto no cabe, se pide acortarlo antes de guardarlo, sin recortarlo.
- Los respaldos anteriores se abren con sus hojas y encabezados intactos. Los
  nuevos respaldos incluyen todas las estaciones de cada hoja.

En `ejemplos/` hay un XLS, un PDF y un respaldo con tres estaciones para revisar
la colocación. `node scripts/generar_ejemplos.mjs` regenera esas muestras usando
las mismas funciones que la aplicación.

## Celdas, encabezado e impresión de Excel

Todos los datos que se completan en el encabezado usan **Arial 14, negrita,
negro explícito**, incluyendo la numeración, N/C, código, DE/A, superficie,
ruta, longitud y ubicación. No se reduce la letra automáticamente.
Los títulos y las etiquetas institucionales conservan su formato de plantilla.
La letra N/C queda centrada horizontal y verticalmente en su casilla. La
descripción del cantón queda centrada sobre el mismo eje que la provincia,
en Excel, vista previa y PDF.

La entrada **LONGITUD (KM)** es una sola celda combinada **AA11:AD12**, dentro
del mismo rectángulo. Su dato es numérico y queda centrado horizontal y verticalmente.

DE y A tienen una celda por descripción (P8:AD8 y P9:AD9). La descripción del
cantón ocupa G18:T18 y NÚMERO ocupa AA1:AD1. En la tabla del frente, cada fila
de estación, diámetro, longitud de alcantarilla, número, tipo y observaciones
queda en una celda por recuadro. Las observaciones del reverso usan una celda
por renglón. Se sustituyen únicamente las combinaciones pequeñas que estaban
dentro del mismo espacio. La representación gráfica D:I conserva su cuadrícula.
Las etiquetas, las líneas visibles, sus posiciones y los dibujos se conservan.

Cada Excel descargado guarda sus bordes en negro explícito, con los mismos
trazos y grosores, y registra cada borde compartido a ambos lados de la celda.
Ambas caras piden 600 DPI y desactivan la impresión en borrador. Se conservan
el papel, la escala, las medidas, los márgenes y los dibujos originales.
Los ajustes se aplican al XLS exportado; no hace falta un botón de impresión
en la aplicación. Abrir el archivo en Excel y usar **Archivo → Imprimir**.

La vista previa y el PDF reflejan el mismo formato uniforme de los datos.
Si un texto no cabe con ese tamaño, se pide acortarlo antes de exportar.
En `ejemplos/` se incluye un Excel de muestra para revisar ambas caras.

Se comprueban los registros nativos del archivo, las fuentes, las combinaciones,
los índices y los bordes. Las estaciones se verificaron con un lector XLS independiente y con imágenes
del PDF generado. No se dispone de Microsoft Excel de Windows ni de una
impresora física en este entorno. La revisión visual del navegador está pendiente por un tiempo de espera del navegador de pruebas.
Se verificaron las posiciones y los tamaños de las imágenes al abrir el XLS en
LibreOffice Calc y compararlos con el PDF directo de la aplicación.

## Figuras del PDF

El PDF base corrige el arco de sección típica y las dos curvas de alcantarilla
existente que el conversor había deformado. Las referencias son la geometría
OfficeArt del XLS y las capturas de Excel proporcionadas. No se han desplazado
las casillas, líneas de tablas, textos ni observaciones. Se conservan los pesos
de línea y se activa el ajuste de trazos PDF al dispositivo de impresión.

`scripts/corregir_pdf_base.py` documenta las correcciones de conversión y permite
repetirlas con Python/pypdf durante el desarrollo. No hace falta ejecutarlo para
usar la PWA. No se ha probado una impresora física en este entorno.

## Revisar y descargar

Los botones **Vista previa**, **Descargar Excel** y **Descargar PDF** están encima
del formulario. La vista previa se abre completa con su botón y no ocupa un
panel lateral. Cada salida corresponde a la **hoja seleccionada**, e incluye
frente y reverso. Para descargar otra hoja, seleccionarla en la lista y repetir.
Los espacios de las próximas etapas quedan vacíos en su posición original.
Se puede descargar un borrador incompleto. Los campos sin completar permanecen
vacíos. Si un texto no cabe en su espacio original, se pide acortarlo; no se
recorta silenciosamente ni se cambia el tamaño de la plantilla.

Excel conserva el formato original **.xls**, sin conversiones a tablas HTML.
El PDF base fue obtenido de la impresión de la plantilla con LibreOffice Calc;
la interfaz utiliza bibliotecas locales para generar y mostrar el PDF sin red.
Antes del primer uso offline hay que esperar a que se complete la caché.
En cada equipo, los saltos y ajustes del controlador de impresión de Excel deben
respetar la configuración guardada en el archivo y no aplicar escalados nuevos.

## Componentes de documentos

- `dist/js/excel-template.js`: relleno de celdas, índices BIFF8 y ampliación FAT.
- `dist/js/excel-drawing.js`: imágenes nativas OfficeArt, ancladas a las celdas originales.
- `dist/js/graphics-model.js`: medidas, coordenadas, casos y validación de gráficos.
- `dist/js/graphics-ui.js`: selección, arrastre, redimensionamiento y controles.
- `dist/js/sketch-model.js`: trazos, borrado parcial, validación y renderizado común.
- `dist/js/sketch-ui.js`: herramientas del croquis, historial por hoja y zoom.
- `dist/js/symbol-catalog.js` y `dist/symbols/`: simbología original del reverso.
- `dist/js/documents.js`: datos compartidos y relleno del PDF original.
- `dist/js/document-ui.js`: vista previa y descargas de la hoja seleccionada.
- `dist/js/excel-format.js`: fuente del encabezado, longitud combinada y bordes de impresión.
- `dist/templates/`: XLS original y su impresión base de dos páginas.
- `dist/vendor/`: PDF-LIB, PDF.js y fuentes auxiliares, con sus licencias.

El desarrollo y verificación se realizaron sin Microsoft Excel de Windows;
se comprobaron estructura y estilos con un lector independiente y la impresión
con LibreOffice. La plantilla original no se ha rediseñado.

## Publicación y mantenimiento

Publicar el **contenido de `dist/`** en un alojamiento estático con HTTPS. No hace
falta compilación ni base de datos. Para un repositorio propio, la carpeta de
salida es `dist`, y el comando de compilación puede quedar vacío.

Al publicar cambios, actualizar el nombre de caché de `dist/sw.js` para que el
navegador descargue la nueva versión. La clave de guardado está separada del
Reporte Diario para que este inventario use un borrador independiente.

Las estaciones se almacenan dentro de cada objeto de `sheets`, conservando
la clave local y la versión de respaldo anterior. La versión 0.5.0 incluye
79 pruebas de datos, interfaz, documentos y conservación de la plantilla.
