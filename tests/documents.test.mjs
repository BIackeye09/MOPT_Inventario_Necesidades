// Verificación de salidas reales y de la conservación de la plantilla original.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PDFDocument} from '../dist/vendor/pdf-lib.esm.min.js';
import {createInventory,selectRoad,addSheet} from '../dist/js/model.js';
import {documentValues,makePdf,makeExcel,documentFilename} from '../dist/js/documents.js';
import {readContainer,readRecords} from '../dist/js/excel-template.js';

const excel=await readFile(new URL('../dist/templates/DPA-301-original.xls',import.meta.url));
const pdf=await readFile(new URL('../dist/templates/DPA-301-original.pdf',import.meta.url));
const catalog=JSON.parse(await readFile(new URL('../dist/data/caminos.json',import.meta.url),'utf8'));
const example=()=>({...selectRoad(createInventory(),catalog.roads.find(r=>r.section==='40000')),surface:'1'});
const bytesByType=(file,type)=>readRecords(readContainer(file).workbook).filter(r=>r.type===type).map(r=>Buffer.from(r.data));

test('se distribuye el XLS original, sin conversión ni cambios previos',()=>{
  assert.equal(createHash('sha256').update(excel).digest('hex'),'b3a6a2639668f15e28416901639989d6b8c8cb8e9c68e3be35af68a4e30a1890');
});
test('el Excel relleno conserva dibujos, filas, columnas, márgenes y los estilos originales',()=>{
  const result=makeExcel(excel,documentValues(example()));
  for(const type of [0x7d,0x208,0xec,0x5d,0x26,0x27,0x28,0x29,0x17,0x18,0x23e,0xeb,0x87d]){
    assert.deepEqual(bytesByType(result,type),bytesByType(excel,type),`Registro ${type.toString(16)}`);
  }
  for(const type of [0x31,0xe0,0x41e])assert.deepEqual(bytesByType(result,type).slice(0,bytesByType(excel,type).length),bytesByType(excel,type));
  const originalSheets=bytesByType(excel,0x85).map(b=>b.subarray(4));
  assert.deepEqual(bytesByType(result,0x85).map(b=>b.subarray(4)),originalSheets);
});
test('PDF y Excel reciben la hoja activa y el total actual, conservando códigos con cero inicial',()=>{
  let inventory=addSheet(example());inventory.activeSheetId=inventory.sheets[1].id;
  const values=documentValues(inventory);
  assert.equal(values.sheet,2);assert.equal(values.total,2);assert.equal(values.region,'V');
  assert.equal(values.cantonCode,'01');assert.equal(values.code,'4-0000-00');assert.equal(values.lengthKm,4.865);
  assert.match(documentFilename(inventory,'xls'),/hoja-2-de-2\.xls$/);
});
test('el borrador sin camino deja las entradas vacías y también permite generar ambas caras',async()=>{
  const values=documentValues(createInventory());
  assert.equal(values.number,'');assert.equal(values.code,'');assert.equal(values.lengthKm,null);
  const output=await makePdf(pdf,values);
  assert.equal((await PDFDocument.load(output)).getPageCount(),2);
  assert.ok(makeExcel(excel,values).length>=excel.length);
});
test('el PDF conserva las dos páginas de la plantilla y sus tamaños originales',async()=>{
  const original=await PDFDocument.load(pdf),result=await PDFDocument.load(await makePdf(pdf,documentValues(example())));
  assert.equal(result.getPageCount(),2);
  assert.deepEqual(result.getPages().map(p=>p.getSize()),original.getPages().map(p=>p.getSize()));
});
test('un texto largo se informa en lugar de recortarlo o rediseñar el formulario',async()=>{
  const values=documentValues(example());values.to='Texto muy largo '.repeat(50);
  await assert.rejects(()=>makePdf(pdf,values),/no cabe en su espacio original/);
});
test('la exportación no convierte una longitud inválida en un dato aparentemente correcto',()=>{
  const inventory=example();inventory.road.lengthKm='incorrecto';
  assert.throws(()=>documentValues(inventory),/Revisá la longitud/);
});
test('todas las acciones visibles y los elementos del controlador de documentos existen',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  const ui=await readFile(new URL('../dist/js/document-ui.js',import.meta.url),'utf8');
  for(const [,id]of ui.matchAll(/\$\('([^']+)'\)/g))assert.ok(html.includes(`id="${id}"`),id);
  assert.ok(html.includes('data-export="excel"'));assert.ok(html.includes('data-export="pdf"'));
  assert.ok(!html.includes('La exportación oficial se integrará en otra etapa'));
  assert.ok(ui.includes('data:bytes.slice()'),'La vista previa no debe transferir el buffer descargable');
});
