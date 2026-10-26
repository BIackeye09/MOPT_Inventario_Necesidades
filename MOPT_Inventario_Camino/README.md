# Inventario de Necesidades del Camino · MOPT

Aplicación DPA-301, versión 0.6.3 · 26 de octubre de 2026.
Interfaz en español para computadora y teléfono; servidor local con Dart en el puerto **8081**.

## Uso

1. Seleccionar un camino del catálogo o ingresarlo manualmente y revisar el encabezado.
2. Usar la barra **Hoja**, arriba de las pestañas, para seleccionar, agregar o eliminar hojas.
3. Completar **Estaciones y detalles**. La primera estación queda abajo y las siguientes suben; cada hoja admite 26.
4. En **Representación gráfica**, probar ambos casos. La vista previa y las descargas usan el caso seleccionado.
5. En **Parte trasera · Croquis**, abrir el lienzo blanco a pantalla completa y volver con **Volver a la app**.
6. Escribir las **Observaciones del reverso** fuera del lienzo. Se distribuyen en los ocho renglones originales.
7. Abrir **Vista previa** o descargar **Excel** y **PDF** de la hoja seleccionada, con sus dos caras.

**Instalar** queda junto a Vista previa. La instalación utiliza el aviso del navegador o muestra instrucciones para Android, iPhone y computadora. El guardado del borrador sigue siendo automático en el mismo navegador y dispositivo. No hay sección lateral, descarga/importación de respaldos ni descarga automática al crear un inventario nuevo. No hay sincronización entre equipos. Crear un inventario nuevo pide confirmación si hay datos y reemplaza el borrador; descargá antes las hojas que necesités conservar.

## Símbolos en teléfono

- Tocá una figura de la paleta, o agregala desde la lista de una estación.
- Poné un dedo sobre el símbolo y arrastrá para moverlo.
- Manteniendo ese dedo sobre el símbolo, apoyá un segundo dedo en el dibujo; separalos para agrandar o juntalos para reducir. Al levantar uno podés seguir moviendo con el otro.
- El área de agarre incluye un margen alrededor de las líneas finas. Los símbolos y controles no permiten seleccionar la imagen de la carretera.
- La flecha circular gira como en Word. **Giro y ángulo exacto** abre los controles numéricos. Reducir, Agrandar y Deshacer siguen disponibles.
- El tamaño del símbolo respeta sus proporciones durante el gesto y su contorno queda dentro del recuadro, incluso girado. Cada gesto completo ocupa un paso de Deshacer.
- El Caso 1 conserva el ancho de trabajo de la carretera, con un máximo de 440 px para el editor. La página crece según el alto completo de la imagen; no hay una barra de desplazamiento dentro del dibujo. Se recorre con el desplazamiento normal de la página, también arrastrando el fondo. Las figuras nuevas se agregan en el tramo visible. Los gestos siguen cambiando el tamaño de los símbolos.

Los dos casos conservan dibujos independientes por hoja. Se incluyen las 18 figuras oficiales del reverso, con sus mismos píxeles y colores. El zoom y los controles del editor no se exportan.

## Croquis y observaciones

El croquis tiene una pantalla propia con Lápiz negro, Borrador parcial, Mover lienzo, tamaño, Deshacer, Rehacer, Limpiar y zoom. El papel blanco conserva las proporciones del espacio oficial. Girar el teléfono ajusta el tamaño visible sin modificar los trazos. El área gris delimita el papel; con zoom se puede recorrer el dibujo con Mover lienzo. Volver a la app conserva el dibujo de esa hoja.

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

La PWA actualiza su caché a 0.6.3. Cerrá y volvé a abrir la app o recargá con conexión después de reemplazar los archivos. Se mantiene la misma clave local del borrador. Cambiar de navegador, dominio o puerto crea un espacio de datos distinto.

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

Las pruebas cubren captura y estaciones, hojas y recuperación del borrador, geometría y giros, gestos con dos punteros, selección de líneas finas, cancelación y Deshacer, dibujo y regreso del croquis, observaciones por hoja, contenido/estilos BIFF8, configuración de impresión y recursos sin conexión.

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
