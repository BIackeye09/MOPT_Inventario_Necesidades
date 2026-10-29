// Ejemplo descargable con las mismas funciones que utiliza la aplicación.
import {readFile,writeFile} from 'node:fs/promises';
import {fromBackup,toBackup} from '../dist/js/model.js';
import {documentValues,makeExcel,makePdf} from '../dist/js/documents.js';
import {loadGraphicAssets} from '../dist/js/graphics-model.js';
import {loadSketchAsset} from '../dist/js/sketch-model.js';
import {rotateExamplePng} from './rotar_simbolos.mjs';
import {renderExampleSketch} from './render_sketch.mjs';
const root=new URL('../',import.meta.url),out=new URL('ejemplos/',root);
const catalog=JSON.parse(await readFile(new URL('dist/data/caminos.json',root),'utf8'));
const inventory=fromBackup(await readFile(new URL('representacion-grafica.json',out),'utf8'),catalog);
inventory.number='CROQUIS-001';
inventory.sheets[0].backObservations='Inspección del camino: se requiere limpieza de cunetas y revisión de alcantarillas.\nEl croquis indica el acceso principal, el desvío y la referencia de ubicación.\nCoordinar la atención de los puntos señalados durante el recorrido.';
const stroke=(points,size=3,tool='pen')=>({tool,size,points});
inventory.sheets[0].sketch={strokes:[
  stroke([[.1,.78],[.2,.70],[.30,.66],[.42,.54],[.52,.47],[.63,.39],[.75,.30],[.87,.24]],4),
  stroke([[.1,.82],[.21,.75],[.31,.70],[.44,.58],[.54,.51],[.65,.43],[.77,.34],[.89,.28]],4),
  stroke([[.42,.54],[.43,.37],[.36,.24],[.36,.15]],3),
  stroke([[.46,.56],[.47,.36],[.40,.23],[.40,.15]],3),
  stroke([[.61,.43],[.66,.57],[.71,.64],[.77,.77]],3),
  stroke([[.66,.48],[.69,.57],[.75,.62],[.81,.75]],3),
  stroke([[.63,.62],[.77,.62]],18,'eraser'),
  stroke([[.2,.42],[.2,.32],[.25,.27],[.3,.32],[.3,.42],[.2,.42]],3),
  stroke([[.2,.32],[.3,.32]],3),stroke([[.24,.42],[.24,.36],[.26,.36],[.26,.42]],2),
  stroke([[.87,.15],[.87,.06],[.85,.10]],3),stroke([[.87,.06],[.89,.10]],3),
  stroke([[.91,.16],[.91,.07],[.95,.16],[.95,.07]],3),
  stroke([[.16,.54]],7)
]};
const values=documentValues(inventory),assets={...await loadGraphicAssets(values.graphics,undefined,rotateExamplePng),...await loadSketchAsset(values.sketch,renderExampleSketch)};
await writeFile(new URL('croquis-localizacion.xls',out),makeExcel(await readFile(new URL('dist/templates/DPA-301-original.xls',root)),values,assets));
await writeFile(new URL('croquis-localizacion.pdf',out),await makePdf(await readFile(new URL('dist/templates/DPA-301-original.pdf',root)),values,assets));
await writeFile(new URL('croquis-localizacion.json',out),toBackup(inventory));
console.log('Excel y PDF con croquis y observaciones de muestra generados; datos internos actualizados.');
