// Integración del dibujo libre con respaldos, impresión y las dos caras originales.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createInventory,addSheet,toBackup,fromBackup} from '../dist/js/model.js';
import {restoreSketch,loadSketchAsset,SKETCH_KEY,SKETCH_FRAME} from '../dist/js/sketch-model.js';
import {createGraphic,loadGraphicAssets} from '../dist/js/graphics-model.js';
import {documentValues,makeExcel,makePdf} from '../dist/js/documents.js';
import {readContainer,readRecords} from '../dist/js/excel-template.js';
import {officeArtRecords} from '../dist/js/excel-drawing.js';
import {PDFDocument} from '../dist/vendor/pdf-lib.esm.min.js';
import {renderExampleSketch} from '../scripts/render_sketch.mjs';
const root=new URL('../',import.meta.url),xls=await readFile(new URL('dist/templates/DPA-301-original.xls',root)),pdf=await readFile(new URL('dist/templates/DPA-301-original.pdf',root));
const catalog=JSON.parse(await readFile(new URL('dist/data/caminos.json',root),'utf8'));
const sample=()=>({strokes:[{tool:'pen',size:5,points:[[.1,.5],[.9,.5]]},{tool:'eraser',size:30,points:[[.5,.4],[.5,.6]]}]});
function drawing(file) {
  const records=readRecords(readContainer(file).workbook),parts=[[],[]];let sheet=-1;
  for(const r of records){if(r.type===0x809&&Buffer.from(r.data).readUInt16LE(2)===0x10)sheet++;if(sheet>=0&&r.type===0xec)parts[sheet].push(Buffer.from(r.data));}
  return {records,sheets:parts.map(p=>Buffer.concat(p))};
}
test('cada hoja conserva su croquis, orden de borrado y compatibilidad con respaldos anteriores',()=>{
  const inv=addSheet(createInventory());inv.sheets[0].sketch=sample();const recovered=fromBackup(toBackup(inv),catalog);
  assert.deepEqual(recovered.sheets[0].sketch,sample());assert.deepEqual(recovered.sheets[1].sketch,{strokes:[]});
  const old=JSON.parse(toBackup(inv));delete old.inventory.sheets[0].sketch;assert.deepEqual(fromBackup(old,catalog).sheets[0].sketch,{strokes:[]});
  inv.activeSheetId=inv.sheets[1].id;assert.deepEqual(documentValues(inv).sketch,{strokes:[]});
});
test('se rechazan herramientas, grosores y puntos dañados sin aceptar trazos fuera del recuadro',()=>{
  for(const patch of [s=>s.strokes[0].tool='otro',s=>s.strokes[0].size=0,s=>s.strokes[0].size=101,s=>s.strokes[0].points=[],s=>s.strokes[0].points[0]=[2,.5],s=>s.strokes[0].points[0]=[null,.5]]){const value=sample();patch(value);assert.throws(()=>restoreSketch(value));}
});
test('un croquis vacío no produce imagen y el dibujo usa un único PNG transparente',async()=>{
  assert.deepEqual(await loadSketchAsset({strokes:[]},()=>{throw new Error('no debe renderizar');}),{});
  const assets=await loadSketchAsset(sample(),renderExampleSketch);assert.equal(Buffer.from(assets[SKETCH_KEY]).subarray(1,4).toString(),'PNG');assert.equal(Object.keys(assets).length,1);
});
test('Excel añade el croquis al reverso y conserva cada objeto original y el dibujo frontal',async()=>{
  const inv=createInventory();inv.sheets[0].sketch=sample();const values=documentValues(inv),assets=await loadSketchAsset(values.sketch,renderExampleSketch);
  const before=drawing(xls),after=drawing(makeExcel(xls,values,assets));assert.deepEqual(before.sheets[0],after.sheets[0]);
  const oldNodes=officeArtRecords(before.sheets[1]),newNodes=officeArtRecords(after.sheets[1]);
  for(const n of oldNodes.filter(n=>n.type===0xf004))assert.deepEqual(after.sheets[1].subarray(n.start,n.end),before.sheets[1].subarray(n.start,n.end));
  assert.equal(newNodes.filter(n=>n.type===0xf00a).length,oldNodes.filter(n=>n.type===0xf00a).length+1);
  assert.equal(newNodes[0].end,after.sheets[1].length);
  for(const type of [0x7d,0x208,0x26,0x27,0x28,0x29])assert.deepEqual(after.records.filter(r=>r.type===type).map(r=>r.data),before.records.filter(r=>r.type===type).map(r=>r.data));
  assert.throws(()=>makeExcel(xls,values),/croquis/);
});
test('los símbolos del frente y el croquis del reverso se exportan juntos con identificadores distintos',async()=>{
  const inv=createInventory(),sheet=inv.sheets[0];sheet.sketch=sample();sheet.graphics.free=[createGraphic('bacheo')];const values=documentValues(inv);
  const assets={...await loadGraphicAssets(values.graphics,url=>readFile(url)),...await loadSketchAsset(values.sketch,renderExampleSketch)};
  const result=drawing(makeExcel(xls,values,assets));const ids=result.sheets.map(b=>officeArtRecords(b).filter(n=>n.type===0xf00a&&n.instance===75).map(n=>b.readUInt32LE(n.data)));
  assert.notEqual(ids[0].at(-1),ids[1].at(-1));assert.equal(officeArtRecords(result.sheets[1])[0].end,result.sheets[1].length);
  const output=await PDFDocument.load(await makePdf(pdf,values,assets));assert.equal(output.getPageCount(),2);assert.deepEqual(output.getPage(1).getSize(),{width:612,height:792});
  assert.ok(SKETCH_FRAME.top>248&&SKETCH_FRAME.top+SKETCH_FRAME.height<574);
  await assert.rejects(()=>makePdf(pdf,values,{}),/símbolo|croquis/);
});
test('la pestaña del croquis y sus controles se distribuyen también para uso sin conexión',async()=>{
  const html=await readFile(new URL('dist/index.html',root),'utf8'),ui=await readFile(new URL('dist/js/sketch-ui.js',root),'utf8'),sw=await readFile(new URL('dist/sw.js',root),'utf8');
  for(const [,id]of ui.matchAll(/\$\('([^']+)'\)/g))assert.ok(html.includes(`id="${id}"`),id);
  assert.match(html,/data-editor-tab="sketch"/);for(const name of ['sketch-ui.js','sketch-model.js'])assert.ok(sw.includes(`./js/${name}`));
});
