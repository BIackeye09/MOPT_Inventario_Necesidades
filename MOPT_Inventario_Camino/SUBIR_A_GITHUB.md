# Subir el inventario completo a GitHub

Versión 1.3.1 · 30 de octubre de 2026.

El paquete completo contiene **99 archivos**. El editor único de la carretera completa, el croquis, Excel, PDF, las fuentes, las pruebas, los ejemplos y el servidor Dart están incluidos. Los símbolos y sus datos se agruparon en `dist/js/symbol-catalog.js`; sus imágenes conservan exactamente los bytes originales.

GitHub permite cargar hasta 100 archivos **por subida desde el navegador**. Ese número no es el límite total del repositorio.

## Opción 1: una sola subida

1. Descomprimí `MOPT_Inventario_Camino_v1.3.1.zip`.
2. Entrá a la carpeta `MOPT_Inventario_Camino` que queda dentro.
3. En la raíz de tu repositorio, elegí **Add file → Upload files**.
4. Arrastrá el contenido de esa carpeta, conservando los nombres y las carpetas. No arrastrés el ZIP ni agregués otra carpeta exterior con el nombre del proyecto.
5. Escribí un mensaje como `Actualizar inventario a 1.3.1` y guardá los cambios.

## Opción 2: tres cargas pequeñas

Hacé cada carga desde la misma raíz del repositorio y confirmala antes de iniciar la siguiente. Conservá las carpetas; no mezcles sus archivos sueltos.

| Carga | Contenido | Archivos |
| --- | --- | ---: |
| 1 · Aplicación | Carpeta `dist/` | 52 |
| 2 · Desarrollo | Carpetas `scripts/`, `tests/` y `herramientas/` | 25 |
| 3 · Documentación y ejemplos | `ejemplos/`, `referencias/`, `.vscode/` y los seis archivos de la raíz | 22 |
| **Total** | **Proyecto completo** | **99** |

Los seis archivos de la raíz son `.gitignore`, `README.md`, `LEEME_PRIMERO.txt`, `SUBIR_A_GITHUB.md`, `iniciar.cmd` y `package.json`.

Para actualizar solamente la aplicación publicada, alcanza con reemplazar `dist/`. Para conservar todo el proyecto en GitHub, subí también las otras dos cargas.

## Si ya habías subido la versión anterior

Subir archivos nuevos no borra los anteriores. Los 18 PNG separados y `manifest.json` que había dentro de `dist/symbols/` ya no se utilizan. En esta versión esa carpeta contiene únicamente `carretera.png`; las 18 figuras están dentro del catálogo JavaScript.

Para que el repositorio también quede con menos de 100 archivos:

1. Hacé la actualización en una rama, por ejemplo `actualizacion-inventario`, si tu repositorio ya publica una web.
2. Subí el nuevo proyecto a esa rama con una de las opciones anteriores.
3. Abrí `dist/symbols/`, usá el menú **… → Delete directory** y confirmá en la misma rama.
4. Volvé a la raíz y subí la carpeta nueva `dist/symbols/`, que contiene solamente `carretera.png`.
5. Revisá que estén las carpetas `dist/js/`, `dist/templates/` y `dist/vendor/`, y luego integrá la rama a la que usa tu publicación.

Si tu repositorio ya contiene una carpeta exterior `MOPT_Inventario_Camino`, reemplazá `dist/` dentro de esa carpeta. Para GitHub Actions, la ruta de publicación en ese caso es `MOPT_Inventario_Camino/dist`.

La publicación continúa usando el contenido de `dist/`. Conservá tu configuración actual de GitHub Pages, Actions o Cloudflare; este cambio no requiere cambiar su ruta. Si copiás el contenido de `dist/` a otra carpeta publicable, aplicá la misma limpieza dentro de su carpeta `symbols/`.

Los ejemplos gráficos se llaman ahora `representacion-grafica.xls`, `.pdf` y `.json`. Si conservás todo el código en GitHub, reemplazá también la carpeta `ejemplos/` para retirar los archivos antiguos `caso-1-editor-completo.*`, `caso-2-por-estacion.*` y `comparar-dos-casos.json`. La aplicación publicada solo depende de `dist/`.

## Comprobación

En teléfono, verificá que se lean **Nuevo inventario** y **Agregar hoja** completos, que las etiquetas estén en azul marino y las ayudas en verde petróleo, con letras más grandes. En pantallas de hasta 360 px, Agregar hoja aparece en una fila propia.

Abrí la web, recargá con conexión y verificá que al pie aparezca **1.3.1**. Probá **Anterior** y **Siguiente** al final de las secciones. Elegí el camino `4-0410-00`: la superficie debe completarse como **3 · Tratamiento superficial**. En Estaciones, el ejemplo de estación debe ser **0,000**. Abrí **Símbolos** de un registro, elegí por nombre o imagen y probá aceras, cunetas y carretera; **Ambos carriles** debe colocar una sola figura. Los símbolos existentes deben verse tanto en el renglón de la lista como al elegir otra figura. Repetir un símbolo en esa ubicación debe mostrar **Ya colocado** sin duplicarlo. Agregá una estación menor para comprobar que sus figuras acompañan el orden. Probá también Mis inventarios, la recuperación de un formulario pendiente, el editor gráfico, el croquis, Vista previa y las descargas individuales y conjuntas del menú Más. El borrador sigue guardado en el mismo navegador y dirección.

## Fuentes oficiales

- [GitHub: agregar archivos y límite por carga](https://docs.github.com/es/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
- [GitHub: eliminar archivos o una carpeta](https://docs.github.com/es/repositories/working-with-files/managing-files/deleting-files-in-a-repository)
