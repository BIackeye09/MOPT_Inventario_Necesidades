# Inventario de Necesidades del Camino · MOPT

Aplicación DPA-301, versión 0.8.2 · 28 de octubre de 2026.
Interfaz en español para computadora y teléfono; servidor local con Dart en el puerto **8081**.

## Uso

1. Seleccionar un camino del catálogo o ingresarlo manualmente y revisar el encabezado.
2. Usar la barra **Hoja** para seleccionar, agregar o eliminar hojas. En teléfono, las secciones están en la navegación inferior.
3. Completar **Estaciones y detalles**. La primera estación queda abajo y las siguientes suben; cada hoja admite 26.
4. En **Representación gráfica**, elegir un caso y abrir el dibujo. El Caso 2 tiene **Editar dibujo** junto a cada estación. La vista previa y las descargas usan el caso seleccionado.
5. En **Parte trasera · Croquis**, abrir la hoja blanca a pantalla completa. El menú **☰** reúne las herramientas y **Volver a la app**.
6. Escribir las **Observaciones del reverso** fuera del lienzo. Se distribuyen en los ocho renglones originales.
7. Abrir **Vista previa** o descargar **Excel** y **PDF** de la hoja seleccionada, con sus dos caras.

**Instalar** queda junto a Vista previa. La instalación utiliza el aviso del navegador o muestra instrucciones para Android, iPhone y computadora. El guardado del borrador sigue siendo automático en el mismo navegador y dispositivo. No hay sección lateral, descarga/importación de respaldos ni descarga automática al crear un inventario nuevo. No hay sincronización entre equipos. Crear un inventario nuevo pide confirmación si hay datos y reemplaza el borrador; descargá antes las hojas que necesités conservar.

## Trabajo desde el teléfono

La navegación inferior permite pasar entre Encabezado, Estaciones, Gráfico y Croquis. Vista previa, Excel, PDF e Instalar quedan en una fila compacta. Los campos usan letra de 16 px y los registros de estaciones se muestran como tarjetas. Los controles de la pantalla de dibujo tienen zonas de toque de al menos 44 px.

## Símbolos y zoom en teléfono

1. En Gráfico, elegí el caso. Abrí **Abrir dibujo a pantalla completa**, **Editar dibujo** junto a una estación, o tocá directamente su miniatura.
2. **Mover y zoom**: un dedo recorre la carretera; dos dedos acercan o alejan la vista. También se puede acercar con doble toque. Los símbolos quedan bloqueados, incluso al tocar una figura; sus herramientas y Agregar se deshabilitan.
3. **Símbolo**: un dedo selecciona y arrastra la figura; dos dedos la agrandan o achican. La flecha circular permite girarla. La vista queda fija: tocar el fondo, pellizcarlo o usar la rueda no cambia el zoom ni mueve la cámara. Para acercar la vista, volvé a **Mover y zoom**.
4. En modo **Símbolo**, **＋ Agregar** abre la lista de las 18 figuras originales. Al elegir una, la lista se cierra y continúa el mismo modo.
5. **☰** reúne Ver todo, Ancho de trabajo, botones de zoom, cambio de tamaño, giro, Duplicar, Eliminar y Deshacer. Solo se habilitan las herramientas del modo elegido; ninguna cambia de modo automáticamente.
6. En el Caso 2, el selector superior cambia de estación sin salir y conserva el modo elegido. **←** vuelve al inventario; los cambios del símbolo se guardan automáticamente.

El área de agarre incluye un margen alrededor de las líneas finas. Los controles del símbolo conservan su tamaño en pantalla al acercar la vista. Un gesto completo ocupa un paso de Deshacer; mover la cámara no agrega pasos. Cancelar un gesto restaura el estado anterior y libera los punteros.

Los símbolos girados pueden llegar a los extremos del recuadro: se limita su contorno visible, sin reservar espacio para el rectángulo anterior al giro. Las posiciones se conservan en el borrador, Excel y PDF. En el Caso 2, las alcantarillas existentes y nuevas se agregan centradas entre las líneas de la calzada. Su ancho inicial abarca la vía y el alto se adapta al renglón; las dimensiones en metros no se convierten en escala del dibujo. Los símbolos ya guardados mantienen sus ajustes.

El Caso 1 conserva el tamaño de trabajo de la carretera en la página principal. En teléfono, esa vista es una miniatura que abre el editor al tocarla; recorrer la página no mueve los símbolos. Dentro del editor se puede usar **Ver todo** para ver la ruta completa o **Ancho de trabajo** para continuar dibujando. Girar el teléfono ajusta la vista sin cambiar las figuras.

En el Caso 1, las líneas horizontales azules discontinuas marcan el inicio y final del renglón de cada estación registrada. Se alinean con su rótulo y con la ubicación que ocupa en la plantilla, de abajo hacia arriba. Aparecen tanto en la página principal como en el editor de teléfono y se actualizan al agregar o eliminar estaciones o cambiar de hoja. Conservan un grosor legible con zoom y permiten arrastrar sobre ellas. Son referencias visuales para colocar las figuras; no restringen su movimiento ni se incluyen en vista previa, Excel o PDF.

Los dos casos conservan dibujos independientes por hoja. Se incluyen las 18 figuras oficiales del reverso, con sus mismos píxeles y colores. El zoom, la posición de la cámara y los controles no se exportan. En computadora también se conserva el editor de la página principal.

## Croquis y observaciones

Al abrir el croquis, el papel blanco ocupa toda la ventana disponible de la aplicación. No hay encabezado ni barras fijas. El acceso flotante **☰** abre las herramientas y **Volver a la app**. Elegir Lápiz, Borrador o Mover lienzo cierra el menú; también se puede cerrar con **Volver al dibujo**. Los gráficos y el croquis usan la ventana completa de la app sin activar la pantalla completa del navegador, evitando su aviso de entrada sobre el dibujo. Desde la app instalada se aprovecha su ventana sin las barras del navegador.

El papel conserva las proporciones del espacio oficial, sin estirar los trazos. **Llenar pantalla** aprovecha toda el área; **Mover lienzo** permite recorrer el papel si queda una parte fuera de la vista. **Ver hoja completa** muestra el papel entero. Ambos controles y el zoom están dentro del menú. Girar el teléfono mantiene el dibujo, el zoom y el centro de trabajo. Las opciones Deshacer, Rehacer, tamaño y Limpiar siguen disponibles dentro de ☰.

Las observaciones generales del reverso son independientes de las observaciones por estación. Se escriben en la pestaña principal, fuera de la pantalla de dibujo. El texto se ajusta a los ocho renglones B35:AD42 y se exporta en Arial 12 negro, sin reducir su tamaño. Si supera el espacio o contiene un carácter no admitido, la app lo indica y permite corregirlo antes de descargar. Los borradores anteriores se recuperan con este campo vacío.

El dibujo es un PNG transparente que se coloca dentro del recuadro original del reverso. El borrador quita partes del dibujo sin tapar las líneas del formulario. Los símbolos frontales siguen siendo imágenes independientes en el XLS.

## Iniciar con Dart

Desde la carpeta del proyecto, con Dart instalado:

```bash
dart herramientas/servir.dart
```

Abrir **http://localhost:8081**. No requiere paquetes Dart ni compilación. El puerto 8081 es independiente de la app de reporte en 8080. El servidor se mantiene abierto mientras se usa la versión local. También se puede abrir `dist/index.html` con Live Server; las funciones de instalación dependen de un origen seguro o localhost.

## Actualizar una web existente

El proyecto completo ahora tiene **97 archivos** y `dist/` tiene **49**. La simbología está agrupada en `dist/js/symbol-catalog.js`, con los PNG originales incorporados sin cambiar sus bytes. Consultá **SUBIR_A_GITHUB.md** para subir todo de una vez, hacerlo en tres cargas o quitar los archivos antiguos que quedaron en un repositorio existente.

La carpeta publicable es **dist/**. Reemplazá su contenido completo en la carpeta que ya usa tu hosting, manteniendo las rutas relativas. No se publica el proyecto entero ni se sube el ZIP como página. Si el hosting utiliza una carpeta `docs/`, copiá allí el contenido de `dist/`.

Los archivos de desarrollo, pruebas, Dart y ejemplos quedan fuera de la carpeta pública. Para subir por la interfaz de GitHub, seleccioná solo los archivos de la versión web; `dist/` contiene menos de 100 archivos. Con Git no existe ese límite de selección por carga.

La PWA actualiza su caché a 0.8.2. Cerrá y volvé a abrir la app o recargá con conexión después de reemplazar los archivos. Se mantiene la misma clave local del borrador. Cambiar de navegador, dominio o puerto crea un espacio de datos distinto.

## Plantilla y datos

- `dist/templates/DPA-301-original.xls`: libro original, sin conversión a HTML ni XLSX. Se preservan hojas, medidas, márgenes, dibujos y configuración de impresión. Los campos editables se combinan dentro de sus recuadros; la representación gráfica conserva su cuadrícula.
- `dist/templates/DPA-301-original.pdf`: frente y reverso originales para la vista previa y el PDF. Solo se añaden los datos y dibujos en sus espacios.
- Encabezado: Arial 14 negrita y negro explícito en Excel; longitud en una sola celda y N centrada. Cantón centrado igual que provincia.
- Estaciones: Arial 12 negro; `0,0` se muestra como `0 + 000`, `12,678` como `12 + 678`. Las medidas son números editables con unidad de metros. Alcantarillas y cabezales son opcionales.
- Catálogo 2024: código, ruta, longitud por sección, tramo y ubicación. Las travesías de la red nacional mantienen N. No se inventan extremos en descripciones ambiguas; se revisan manualmente. Los caminos cantonales pueden ingresarse manualmente.
- El NÚMERO sigue siendo opcional y la macro región se mantiene en V.

## Desarrollo y verificación

Código estático ES modules, sin servicios externos para guardar o exportar. Dependencias PDF vendorizadas con sus licencias. `ids.js` permite crear registros tanto con HTTPS como desde el servidor HTTP local, sin depender de `crypto.randomUUID`.

```bash
npm test
```

Las pruebas cubren captura y estaciones, hojas y recuperación del borrador, geometría y giros, gestos de cámara y de símbolos con dos punteros, zoom centrado, pantallas vertical y horizontal, selección de líneas finas, cancelación y Deshacer, dibujo y regreso del croquis, observaciones por hoja, contenido/estilos BIFF8, configuración de impresión y recursos sin conexión.

Para regenerar el ejemplo del reverso:

```bash
node scripts/generar_ejemplo_croquis.mjs
```

`ejemplos/croquis-localizacion.xls` y `.pdf` muestran croquis y observaciones. Los JSON de `ejemplos/` son datos internos de prueba; esta versión no tiene interfaz para importarlos. Los adaptadores locales de imágenes requieren Python con Pillow. La app del navegador no depende de Python.

## Archivos principales

| Archivo | Función |
| --- | --- |
| `dist/index.html`, `dist/css/styles.css` | Interfaz adaptable y pantalla de dibujo |
| `dist/js/app.js`, `model.js` | Formulario, hojas y guardado automático |
| `dist/js/stations.js`, `station-ui.js` | Captura y orden de las estaciones |
| `dist/js/graphics-model.js`, `graphics-ui.js` | Figuras, giros, límites y gestos |
| `dist/js/sketch-model.js`, `sketch-ui.js` | Lápiz, borrador y pantalla del croquis |
| `dist/js/back-observations.js` | Renglones originales y ajuste del texto |
| `dist/js/documents.js`, `document-ui.js` | PDF compartido por vista previa y descarga |
| `dist/js/excel-template.js`, `excel-format.js`, `excel-drawing.js` | Edición nativa del XLS y sus imágenes |
| `dist/sw.js`, `manifest.webmanifest`, `js/pwa.js` | Caché y acción de instalación |
| `herramientas/servir.dart` | Servidor local, puerto 8081 |
