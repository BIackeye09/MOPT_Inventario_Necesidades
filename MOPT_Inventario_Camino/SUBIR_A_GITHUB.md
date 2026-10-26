# Subir el inventario completo a GitHub

Versión 0.6.3 · 26 de octubre de 2026.

El paquete completo contiene **97 archivos**. Los dos casos de representación gráfica, el croquis, Excel, PDF, las fuentes, las pruebas, los ejemplos y el servidor Dart están incluidos. Los símbolos y sus datos se agruparon en `dist/js/symbol-catalog.js`; sus imágenes conservan exactamente los bytes originales.

GitHub permite cargar hasta 100 archivos **por subida desde el navegador**. Ese número no es el límite total del repositorio.

## Opción 1: una sola subida

1. Descomprimí `MOPT_Inventario_Camino_v0.6.3.zip`.
2. Entrá a la carpeta `MOPT_Inventario_Camino` que queda dentro.
3. En la raíz de tu repositorio, elegí **Add file → Upload files**.
4. Arrastrá el contenido de esa carpeta, conservando los nombres y las carpetas. No arrastrés el ZIP ni agregués otra carpeta exterior con el nombre del proyecto.
5. Escribí un mensaje como `Actualizar inventario a 0.6.3` y guardá los cambios.

## Opción 2: tres cargas pequeñas

Hacé cada carga desde la misma raíz del repositorio y confirmala antes de iniciar la siguiente. Conservá las carpetas; no mezcles sus archivos sueltos.

| Carga | Contenido | Archivos |
| --- | --- | ---: |
| 1 · Aplicación | Carpeta `dist/` | 49 |
| 2 · Desarrollo | Carpetas `scripts/`, `tests/` y `herramientas/` | 24 |
| 3 · Documentación y ejemplos | `ejemplos/`, `referencias/`, `.vscode/` y los seis archivos de la raíz | 24 |
| **Total** | **Proyecto completo** | **97** |

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

La publicación continúa usando el contenido de `dist/`. Conservá tu configuración actual de GitHub Pages, Actions o Cloudflare; este cambio no requiere cambiar su ruta. Si copiás el contenido de `dist/` a otra carpeta publicable, aplicá la misma limpieza dentro de su carpeta `symbols/`.

## Comprobación

Abrí la web, recargá con conexión y verificá que al pie aparezca **0.6.3**. Probá ambos casos de símbolos, el croquis, Vista previa, Descargar Excel y Descargar PDF. El borrador sigue guardado en el mismo navegador y dirección.

## Fuentes oficiales

- [GitHub: agregar archivos y límite por carga](https://docs.github.com/es/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
- [GitHub: eliminar archivos o una carpeta](https://docs.github.com/es/repositories/working-with-files/managing-files/deleting-files-in-a-repository)
