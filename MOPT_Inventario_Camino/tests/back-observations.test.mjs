import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createInventory,addSheet,toBackup,fromBackup} from '../dist/js/model.js';
import {backObservationLines,BACK_OBSERVATIONS_FRAME} from '../dist/js/back-observations.js';
import {documentValues,makeExcel,makePdf} from '../dist/js/documents.js';
import {readContainer,readRecords} from '../dist/js/excel-template.js';
import {PDFDocument,StandardFonts} from '../dist/vendor/pdf-lib.esm.min.js';
const catalog=JSON.parse(await readFile(new URL('../dist/data/caminos.json',import.meta.url),'utf8'));
const xls=await readFile(new URL('../dist/templates/DPA-301-original.xls',import.meta.url));
const pdf=await readFile(new URL('../dist/templates/DPA-301-original.pdf',import.meta.url));
test('cada hoja conserva sus observaciones del reverso y los borradores anteriores se recuperan vacíos',()=>{
  const inv=addSheet(createInventory());inv.sheets[0].backObservations='Limpieza de cunetas.\nInspección del tramo.';
  const recovered=fromBackup(toBackup(inv),catalog);assert.equal(documentValues(recovered).backObservationLines.length,2);
  recovered.activeSheetId=recovered.sheets[1].id;assert.equal(documentValues(recovered).backObservations,'');
  const old=JSON.parse(toBackup(inv));delete old.inventory.sheets[0].backObservations;assert.equal(fromBackup(old,catalog).sheets[0].backObservations,'');
  old.inventory.sheets[0].backObservations={};assert.throws(()=>fromBackup(old,catalog),/observaciones/);
});
test('el texto se distribuye en los renglones originales con letra legible y sin perder saltos',async()=>{
  const lines=backObservationLines('Limpieza de cunetas.\n\nRevisión de alcantarillas.'),font=await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
  assert.equal(lines.length,3);assert.equal(lines[1].text,'');assert.equal(lines[2].address,'B37');
  const wrapped=backObservationLines('Necesita atención en el tramo. '.repeat(20));assert.ok(wrapped.length>1);
  for(const [i,line]of wrapped.entries()){
    assert.equal(line.size,7.11);assert.ok(font.widthOfTextAtSize(line.text,line.size)<=BACK_OBSERVATIONS_FRAME.right-line.x-2);
    assert.ok(line.top>BACK_OBSERVATIONS_FRAME.bounds[i]&&line.top<BACK_OBSERVATIONS_FRAME.bounds[i+1]);
  }
  assert.throws(()=>backObservationLines(Array.from({length:9},()=> 'Renglón').join('\n')),/8 renglones/);
  assert.throws(()=>backObservationLines('Texto con emoji 🚧'),/carácter/);
});
test('las ocho entradas del XLS están en el reverso, combinadas y con Arial 12 negro sin reducir',async()=>{
  const inv=createInventory();inv.sheets[0].backObservations=Array.from({length:8},(_,i)=>`Observación ${i+1}`).join('\n');
  const values=documentValues(inv),records=readRecords(readContainer(makeExcel(xls,values)).workbook);
  const fonts=records.filter(r=>r.type===0x31).map(r=>Buffer.from(r.data)),styles=records.filter(r=>r.type===0xe0).map(r=>Buffer.from(r.data));
  let sheet=-1,filled=0;
  for(const r of records){
    const b=Buffer.from(r.data);if(r.type===0x809&&b.readUInt16LE(2)===0x10)sheet++;
    if(sheet!==1||r.type!==0xfd||b.readUInt16LE(0)<34||b.readUInt16LE(0)>41)continue;
    assert.equal(b.readUInt16LE(2),1);filled++;
    const xf=styles[b.readUInt16LE(4)],index=xf.readUInt16LE(0),font=fonts[index>4?index-1:index];
    assert.equal(font.readUInt16LE(0),240);assert.equal(font.readUInt16LE(4),8);assert.equal(font.readUInt16LE(6),400);
    assert.equal(xf[6]&0x7f,0x11);assert.equal(xf[8]&0x10,0);
  }
  assert.equal(filled,8);assert.equal((await PDFDocument.load(await makePdf(pdf,values))).getPageCount(),2);
  const original=readRecords(readContainer(xls).workbook);
  for(const type of [0x7d,0x208,0xec,0x5d,0x26,0x27,0x28,0x29])assert.deepEqual(records.filter(r=>r.type===type).map(r=>r.data),original.filter(r=>r.type===type).map(r=>r.data));
});
test('la interfaz elimina respaldos y lateral, deja Instalar junto a Vista previa y observaciones fuera del lienzo',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  for(const old of ['download-backup','import-backup','backup-file','context-column','sheets-list'])assert.ok(!html.includes(old));
  assert.match(html,/<div class="document-actions"><button id="install-app"/);
  assert.match(html,/id="active-sheet"/);
  const dialog=html.slice(html.indexOf('<dialog id="sketch-dialog"'),html.indexOf('</dialog>',html.indexOf('<dialog id="sketch-dialog"')));
  assert.ok(dialog.includes('id="sketch-canvas"'));assert.ok(!dialog.includes('id="back-observations"'));
});
