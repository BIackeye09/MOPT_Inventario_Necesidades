// Recuperación, varios trabajos y descargas conjuntas con datos independientes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createInventory,addSheet,selectRoad,toBackup,fromBackup,STORAGE_KEY} from '../dist/js/model.js';
import {InventoryRepository,COLLECTION_KEY,hasPendingStation,inventoryHasData,editableFilename} from '../dist/js/inventory-store.js';
import {reviewOverview} from '../dist/js/inventory-ui.js';
import {cleanStation,restoreStationDraft} from '../dist/js/stations.js';
import {GRAPH_FRAME,GRAPH_ROAD_BOUNDS,createGraphic,graphicBounds,snapGraphic,stationFrame,graphicPlacements} from '../dist/js/graphics-model.js';
import {documentValues,documentFilename,makeExcel,makePdf,makeInventoryDocuments,checkInventoryTexts} from '../dist/js/documents.js';
import {crc32,makeZip} from '../dist/js/zip.js';
import {PDFDocument} from '../dist/vendor/pdf-lib.esm.min.js';
const catalog=JSON.parse(await readFile(new URL('../dist/data/caminos.json',import.meta.url),'utf8'));
const excel=await readFile(new URL('../dist/templates/DPA-301-original.xls',import.meta.url));
const pdf=await readFile(new URL('../dist/templates/DPA-301-original.pdf',import.meta.url));
class MemoryStorage{
  constructor(){this.values=new Map();this.failKey=null;}
  getItem(key){return this.values.get(key)??null;}
  setItem(key,value){if(key===this.failKey)throw Object.assign(new Error('Sin espacio'),{name:'QuotaExceededError'});this.values.set(key,String(value));}
  removeItem(key){this.values.delete(key);}
}
const record=(id,station,observations='')=>({id,...cleanStation({station,observations})});
const draft=(station='2,')=>({station,diameter:'',culvertLength:'',headwallNumber:'',headwallType:'',observations:'Pendiente de inspección',editingId:null});
function complete(){const inventory=selectRoad(createInventory(),catalog.roads.find(r=>r.from&&r.to));inventory.surface='1';return inventory;}

test('Nuevo inventario reconoce estados vacíos, observaciones y borradores sin ninguna dependencia del caso retirado',()=>{
  const inventory=createInventory();assert.equal(inventoryHasData(inventory),false);
  inventory.sheets[0].backObservations='Solo observaciones';assert.equal(inventoryHasData(inventory),true);
  inventory.sheets[0].backObservations='';inventory.sheets[0].stationDraft=draft();assert.equal(inventoryHasData(inventory),true);
  inventory.sheets[0].stationDraft=null;inventory.sheets[0].sketch.strokes=[{}];assert.equal(inventoryHasData(inventory),true);
});
test('un formulario incompleto se recupera sin convertirse en estación ni alterar las salidas',()=>{
  const inventory=createInventory(),before=documentValues(inventory);inventory.sheets[0].stationDraft=draft();
  const restored=fromBackup(toBackup(inventory),catalog);
  assert.equal(restored.sheets[0].stationDraft.station,'2,');assert.equal(restored.sheets[0].stations.length,0);
  assert.deepEqual(documentValues(restored),before);assert.equal(hasPendingStation(restored.sheets[0]),true);
  assert.equal(restoreStationDraft({...draft(),station:'',observations:''}),null);
  assert.throws(()=>restoreStationDraft({...draft(),observations:'x'.repeat(1001)}),/inválido/);
});
test('el formulario de edición conserva su registro por ID y un ID obsoleto se recupera como nueva estación',()=>{
  const records=[record('existing','2,870')];
  assert.equal(restoreStationDraft({...draft(),editingId:'existing'},records).editingId,'existing');
  assert.equal(restoreStationDraft({...draft(),editingId:'missing'},records).editingId,null);
  const cleared=restoreStationDraft({...draft(''),observations:'',editingId:'existing'},records);
  assert.equal(cleared.editingId,'existing');assert.equal(hasPendingStation({stationDraft:cleared}),true);
});
test('la migración abre el borrador anterior y los siguientes inventarios no lo reemplazan',()=>{
  const storage=new MemoryStorage(),old=complete();delete old.sheets[0].stationDraft;
  storage.setItem(STORAGE_KEY,toBackup(old));const repository=new InventoryRepository(storage,catalog),opened=repository.current();
  assert.equal(opened.id,old.id);repository.save(opened);const next=repository.create();
  assert.equal(repository.list().length,2);assert.notEqual(next.id,old.id);assert.equal(repository.open(old.id).road.code,old.road.code);
  assert.equal(new InventoryRepository(storage,catalog).current().id,old.id);
});
test('cada inventario conserva hojas, formularios y bloqueo de figuras al alternar y recargar',()=>{
  const storage=new MemoryStorage(),repository=new InventoryRepository(storage,catalog),first=repository.create();
  first.sheets[0].stationDraft=draft('4,9');first.sheets[0].graphics.free=[{...createGraphic('bacheo'),locked:true}];repository.save(first);
  const second=repository.create();second.number='Segundo';second.sheets[0].stationDraft=draft('12,678');repository.save(second);
  const reloaded=new InventoryRepository(storage,catalog);assert.equal(reloaded.current().number,'Segundo');
  const recovered=reloaded.open(first.id);assert.equal(recovered.sheets[0].stationDraft.station,'4,9');assert.equal(recovered.sheets[0].graphics.free[0].locked,true);
  assert.equal(reloaded.open(second.id).sheets[0].stationDraft.station,'12,678');
});
test('una copia importada es independiente, conserva la hoja activa y nunca pisa un trabajo con el mismo ID',()=>{
  const storage=new MemoryStorage(),repository=new InventoryRepository(storage,catalog);let first=addSheet(repository.create());
  first.activeSheetId=first.sheets[1].id;first.sheets[1].stationDraft=draft('8,125');repository.save(first);
  const raw=toBackup(first),imported=repository.import(raw);
  assert.notEqual(imported.id,first.id);assert.notEqual(imported.sheets[1].id,first.sheets[1].id);
  assert.equal(imported.activeSheetId,imported.sheets[1].id);assert.equal(imported.sheets[1].stationDraft.station,'8,125');
  assert.equal(repository.list().length,2);assert.deepEqual(repository.read(first.id),JSON.parse(raw).inventory);
  assert.match(editableFilename(imported),/\.mopt\.json$/);
  const before=storage.getItem(COLLECTION_KEY);assert.throws(()=>repository.import('{"application":"otra"}'),/no es un respaldo/);assert.equal(storage.getItem(COLLECTION_KEY),before);
});
test('fallar el índice por falta de espacio restaura el registro anterior y no anuncia un inventario nuevo',()=>{
  const storage=new MemoryStorage(),repository=new InventoryRepository(storage,catalog),first=repository.create();
  const before=new Map(storage.values);first.number='Cambio no guardado';storage.failKey=COLLECTION_KEY;
  assert.throws(()=>repository.save(first),/Sin espacio/);assert.deepEqual(storage.values,before);
  assert.throws(()=>repository.create(),/Sin espacio/);assert.deepEqual(storage.values,before);
  storage.failKey=null;repository.save(first);assert.equal(repository.read(first.id).number,'Cambio no guardado');
});
test('dos ventanas no se sobrescriben silenciosamente al editar el mismo inventario',()=>{
  const storage=new MemoryStorage(),one=new InventoryRepository(storage,catalog),first=one.create();
  const two=new InventoryRepository(storage,catalog),other=two.current();first.number='Edición primera ventana';one.save(first);
  other.number='Edición segunda ventana';assert.throws(()=>two.save(other),/otra ventana/);
  assert.equal(new InventoryRepository(storage,catalog).current().number,'Edición primera ventana');
});
test('una lista dañada no se sustituye al intentar guardar y los trabajos existentes se conservan',()=>{
  const storage=new MemoryStorage(),repository=new InventoryRepository(storage,catalog);repository.create();
  storage.setItem(COLLECTION_KEY,'mal formado');const before=new Map(storage.values);
  assert.throws(()=>repository.save(createInventory()),/lista de inventarios/);assert.deepEqual(storage.values,before);
});
test('quitar un trabajo anterior libera su registro, protege el actual y revierte si falla el índice',()=>{
  const storage=new MemoryStorage(),repository=new InventoryRepository(storage,catalog),first=repository.create(),second=repository.create();
  assert.throws(()=>repository.removeArchived(second.id,second.id),/otro inventario/);
  const before=new Map(storage.values);storage.failKey=COLLECTION_KEY;
  assert.throws(()=>repository.removeArchived(first.id,second.id),/Sin espacio/);assert.deepEqual(storage.values,before);
  storage.failKey=null;repository.removeArchived(first.id,second.id);assert.equal(repository.list().length,1);assert.equal(repository.current().id,second.id);
  assert.equal(storage.values.size,2);assert.throws(()=>repository.read(first.id),/No se encontró/);
});
test('el resumen distingue pendientes reales de las columnas y dibujos opcionales',()=>{
  const inventory=complete();inventory.sheets[0].stations=[record('a','2,870')];
  let overview=reviewOverview(inventory);assert.equal(overview.issues.length,0);assert.equal(overview.sheets[0].stations,1);assert.equal(overview.sheets[0].sketch,false);
  inventory.sheets[0].stationDraft=draft();overview=reviewOverview(inventory);assert.equal(overview.issues.length,1);assert.match(overview.issues[0].message,/pendiente/);
  inventory.sheets.push({...createInventory().sheets[0],stations:[record('b','2.87')]});overview=reviewOverview(inventory);assert.equal(overview.issues.filter(i=>/repetida/.test(i.message)).length,2);
});
test('el ajuste opcional se acerca a un borde y a las guías sin cambiar largo, grosor ni giro',()=>{
  const stations=Array.from({length:10},(_,i)=>record(`s${i}`,`${i},0`)),row=stationFrame(stations,'s9');
  for(const rotation of [0,37,90,270]){
    let item=createGraphic('bacheo',{y:.5});item={...item,rotation};
    const box=graphicBounds(item),near={...item,x:item.x+(GRAPH_ROAD_BOUNDS.left+1-box.x*GRAPH_FRAME.width)/GRAPH_FRAME.width,
      y:item.y+(row.top+1-box.y*GRAPH_FRAME.height)/GRAPH_FRAME.height};
    const snapped=snapGraphic(near,stations,2),result=graphicBounds(snapped);
    assert.ok(Math.abs(result.x*GRAPH_FRAME.width-GRAPH_ROAD_BOUNDS.left)<.00001);
    assert.ok(Math.abs(result.y*GRAPH_FRAME.height-row.top)<.00001);
    assert.equal(snapped.width,item.width);assert.equal(snapped.height,item.height);assert.equal(snapped.rotation,rotation);
    assert.deepEqual(snapGraphic({...near,locked:true},stations,2),{...near,locked:true});
    const sheet={stations,graphics:{free:[snapped]}};assert.doesNotThrow(()=>graphicPlacements(sheet));
  }
});
test('la revisión de textos omite imágenes sin pedir sus píxeles y detecta contenido que no cabe',async()=>{
  const inventory=complete();inventory.sheets[0].graphics.free=[createGraphic('bacheo')];
  inventory.sheets[0].sketch.strokes=[{tool:'pen',size:3,points:[[.2,.2],[.4,.4]]}];
  assert.deepEqual(await checkInventoryTexts(inventory,pdf),[]);
  inventory.sheets[0].stations=[record('a','2,870','x'.repeat(200))];
  const issues=await checkInventoryTexts(inventory,pdf);assert.equal(issues[0].tab,'stations');assert.match(issues[0].message,/no cabe/);
});
test('el PDF conjunto conserva dos páginas por hoja y el ZIP contiene los Excel individuales exactos',async()=>{
  const inventory=addSheet(complete());inventory.sheets[0].stations=[record('a','2,864','Primera hoja')];inventory.sheets[1].stations=[record('b','2,870','Segunda hoja')];
  inventory.activeSheetId=inventory.sheets[1].id;const before=toBackup(inventory),progress=[];
  const bundle=await makeInventoryDocuments(excel,pdf,inventory,{format:'pdf',progress:(a,b)=>progress.push([a,b])});
  const result=await PDFDocument.load(bundle),base=await PDFDocument.load(pdf);assert.equal(result.getPageCount(),4);
  assert.deepEqual(progress,[[1,2],[2,2]]);assert.deepEqual(result.getPages().map(p=>p.getSize()),Array.from({length:4},(_,i)=>base.getPages()[i%2].getSize()));
  const files=await makeInventoryDocuments(excel,pdf,inventory,{format:'excel'});
  assert.equal(files.length,2);
  for(const [index,file]of files.entries()){
    const selected={...inventory,activeSheetId:inventory.sheets[index].id},values=documentValues(selected);
    assert.equal(file.name,documentFilename(selected,'xls'));assert.deepEqual(file.bytes,makeExcel(excel,values));
    assert.equal((await PDFDocument.load(await makePdf(pdf,values))).getPageCount(),2);
  }
  assert.equal(toBackup(inventory),before);assert.equal(new DataView(makeZip(files).buffer).getUint32(0,true),0x04034b50);
});
test('el ZIP usa UTF-8, directorio central y CRC estándar, y rechaza rutas peligrosas o repetidas',()=>{
  const data=new TextEncoder().encode('123456789');assert.equal(crc32(data),0xcbf43926);assert.equal(crc32(new Uint8Array()),0);
  const name='Observación.xls',zip=makeZip([{name,bytes:data}]),view=new DataView(zip.buffer),length=new TextEncoder().encode(name).length;
  assert.equal(view.getUint16(6,true),0x800);assert.equal(view.getUint32(14,true),0xcbf43926);
  assert.equal(new TextDecoder().decode(zip.slice(30,30+length)),name);assert.deepEqual(zip.slice(30+length,39+length),data);
  const central=30+length+data.length;assert.equal(view.getUint32(central,true),0x02014b50);
  assert.equal(view.getUint32(zip.length-22,true),0x06054b50);assert.equal(view.getUint16(zip.length-12,true),1);
  for(const name of ['../x.xls','/x.xls','a\\b.xls','a//b.xls'])assert.throws(()=>makeZip([{name,bytes:data}]),/nombre/);
  assert.throws(()=>makeZip([{name:'a',bytes:data},{name:'a',bytes:data}]),/repetidos/);
});
test('los controles y las dependencias de inventarios, revisión y ZIP están disponibles sin conexión',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8'),sw=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
  for(const name of ['inventory-store','inventory-ui','zip'])assert.ok(sw.includes(`./js/${name}.js`),name);
  for(const name of ['inventory-ui','graphics-ui','document-ui']){
    const source=await readFile(new URL(`../dist/js/${name}.js`,import.meta.url),'utf8');
    for(const [,id]of source.matchAll(/\$\('([\w-]+)'\)/g))assert.ok(html.includes(`id="${id}"`),`${name}: ${id}`);
  }
});
