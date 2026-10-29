// Exporta la muestra del editor único usando las funciones reales de la app.
import {readFile,writeFile} from 'node:fs/promises';
import {fromBackup,toBackup} from '../dist/js/model.js';
import {loadGraphicAssets} from '../dist/js/graphics-model.js';
import {documentValues,makeExcel,makePdf} from '../dist/js/documents.js';
import {rotateExamplePng} from './rotar_simbolos.mjs';
const root=new URL('../',import.meta.url),out=new URL('ejemplos/',root);
const catalog=JSON.parse(await readFile(new URL('dist/data/caminos.json',root),'utf8'));
const inv=fromBackup(await readFile(new URL('representacion-grafica.json',out),'utf8'),catalog);
const [xls,pdf]=await Promise.all(['xls','pdf'].map(ext=>readFile(new URL(`dist/templates/DPA-301-original.${ext}`,root))));
const values=documentValues(inv),assets=await loadGraphicAssets(values.graphics,undefined,rotateExamplePng);
await writeFile(new URL('representacion-grafica.xls',out),makeExcel(xls,values,assets));
await writeFile(new URL('representacion-grafica.pdf',out),await makePdf(pdf,values,assets));
await writeFile(new URL('representacion-grafica.json',out),toBackup(inv));
console.log('Excel y PDF del editor único generados.');
