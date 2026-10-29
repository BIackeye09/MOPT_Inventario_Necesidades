// Casos de captura reales, recuperación y posiciones de las salidas oficiales.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createInventory,addSheet,toBackup,fromBackup} from '../dist/js/model.js';
import {parseStation,formatStation,formatMetres,validateStation,stationRows,duplicateStationValues} from '../dist/js/stations.js';
import {createGraphic,constrainGraphic,stationFrame,graphicBounds} from '../dist/js/graphics-model.js';
import {documentValues,makeExcel,makePdf,checkStationForDocument} from '../dist/js/documents.js';
import {readContainer,readRecords} from '../dist/js/excel-template.js';
import {PDFDocument} from '../dist/vendor/pdf-lib.esm.min.js';
const template=await readFile(new URL('../dist/templates/DPA-301-original.xls',import.meta.url));
const pdf=await readFile(new URL('../dist/templates/DPA-301-original.pdf',import.meta.url));
const catalog=JSON.parse(await readFile(new URL('../dist/data/caminos.json',import.meta.url),'utf8'));
const entry=(station,changes={})=>({id:`est-${station}`,station,diameter:'',culvertLength:'',headwallNumber:'',headwallType:'',observations:'',...changes});

test('las estaciones completan metros sin perder el cero ni redondear posiciones',()=>{
  for(const [raw,expected]of [['0,0','0 + 000'],['12,678','12 + 678'],['4,9','4 + 900'],['1.02','1 + 020'],['2','2 + 000'],['0,001','0 + 001']])assert.equal(formatStation(raw),expected);
  for(const invalid of ['',null,'-1','1,0001','1/8','1e3','12,6.7','Infinity'])assert.equal(parseStation(invalid),null);
});
test('los campos opcionales pueden quedar vacíos y cero es un valor real',()=>{
  assert.deepEqual(validateStation(entry('0,0')),[]);
  assert.deepEqual(validateStation(entry('4,9',{diameter:'0',culvertLength:'6,50',headwallNumber:'0',headwallType:'Libre'})),[]);
  assert.equal(formatMetres(''),'');assert.equal(formatMetres('0'),'0 m');assert.equal(formatMetres('0.80'),'0,80 m');
  assert.equal(validateStation(entry('1,0',{diameter:'-2'}))[0].field,'diameter');
  assert.equal(validateStation(entry('1,0',{culvertLength:'tres'}))[0].field,'culvertLength');
  for(const invalid of ['dos','2,5','2.5','-1'])assert.equal(validateStation(entry('1,0',{headwallNumber:invalid}))[0].field,'headwallNumber');
});
test('se ordena por valor numérico conservando cada columna con su estación y la capacidad de 26',()=>{
  const stations=[entry('12,678',{diameter:'0,80',observations:'Primera'}),entry('0,0',{observations:'Segunda'})];
  const rows=stationRows({stations});assert.equal(rows[0].row,49);assert.equal(rows[1].row,48);
  assert.equal(rows[0].station,'0 + 000');assert.equal(rows[0].observations,'Segunda');
  assert.equal(rows[1].station,'12 + 678');assert.equal(rows[1].diameter,.8);assert.equal(rows[1].observations,'Primera');
  assert.equal(stationRows({stations:Array.from({length:26},(_,i)=>entry(String(i)))}).at(-1).row,24);
  assert.throws(()=>stationRows({stations:Array.from({length:27},(_,i)=>entry(String(i)))}),/26/);
});
test('recuperar un borrador ordena estaciones y conserva enteros antiguos, repeticiones y sus datos',()=>{
  const inv=createInventory();inv.sheets[0].stations=[entry('12',{id:'a',observations:'Anterior'}),entry('2,870',{id:'b',observations:'Uno'}),entry('02.87',{id:'c',observations:'Dos'})];
  const restored=fromBackup(toBackup(inv),catalog),records=restored.sheets[0].stations;
  assert.deepEqual(records.map(r=>r.id),['b','c','a']);assert.equal(records[2].station,'12,0');
  assert.equal(records[0].observations,'Uno');assert.equal(records[1].observations,'Dos');
  assert.deepEqual([...duplicateStationValues(restored.sheets)],[2870]);
});
test('al recuperar el orden, los símbolos se validan en su fila anterior y siguen a su ID sin perderse',()=>{
  const inv=createInventory(),sheet=inv.sheets[0];
  sheet.stations=Array.from({length:9},(_,i)=>entry(`${i+1},0`,{id:`s${i}`}));sheet.stations[8].station='0,0';
  const oldHeight=stationFrame(sheet.stations,'s8').height;
  sheet.graphics={activeMode:'station',free:[],station:[]};
  sheet.graphics.station=[constrainGraphic(createGraphic('bacheo',{stationId:'s8',frameHeight:oldHeight}),{width:.12,height:.8,rotation:45,stationId:'s8'},oldHeight)];
  const restored=fromBackup(toBackup(inv),catalog).sheets[0];
  assert.equal(restored.stations[0].id,'s8');assert.equal(restored.graphics.free[0].id,sheet.graphics.station[0].id);assert.equal(Object.hasOwn(restored.graphics,'station'),false);
  const box=graphicBounds(restored.graphics.free[0]);
  assert.ok(box.x>=-1e-7&&box.y>=-1e-7&&box.x+box.width<=1+1e-7&&box.y+box.height<=1+1e-7);
});
test('cada hoja exporta sus estaciones y los respaldos nuevos y anteriores se recuperan',()=>{
  let inventory=addSheet(createInventory());
  inventory.sheets[0].stations=[entry('0,0',{observations:'Huecos 2x2 (6)'})];
  inventory.sheets[1].stations=[entry('12,678',{headwallType:'Toma'})];inventory.activeSheetId=inventory.sheets[1].id;
  const restored=fromBackup(toBackup(inventory),catalog);
  assert.equal(documentValues(restored).stations[0].station,'12 + 678');
  restored.activeSheetId=restored.sheets[0].id;assert.equal(documentValues(restored).stations[0].observations,'Huecos 2x2 (6)');
  const legacy=JSON.parse(toBackup(createInventory()));delete legacy.inventory.sheets[0].stations;
  assert.deepEqual(fromBackup(legacy,catalog).sheets[0].stations,[]);
  const broken=JSON.parse(toBackup(inventory));broken.inventory.sheets[1].stations[0].headwallNumber='abc';
  assert.throws(()=>fromBackup(broken,catalog),/enteros/);
});
test('el XLS ubica cifras numéricas y unidades en el mismo renglón inferior de la estación',()=>{
  const inv=createInventory();inv.sheets[0].stations=[entry('0,0',{diameter:'0,80',culvertLength:'6.5',headwallNumber:'2',headwallType:'Toma',observations:'Huecos 2x2 (6)'}),entry('12,678')];
  const records=readRecords(readContainer(makeExcel(template,documentValues(inv))).workbook);
  const xfs=records.filter(r=>r.type===0xe0).map(r=>Buffer.from(r.data));
  const fonts=records.filter(r=>r.type===0x31).map(r=>Buffer.from(r.data));
  const formats=new Map(records.filter(r=>r.type===0x41e).map(r=>{const b=Buffer.from(r.data);return [b.readUInt16LE(0),b.subarray(5).toString(b[4]&1?'utf16le':'latin1')];}));
  let sheet=-1;const cells=new Map();
  for(const r of records){const b=Buffer.from(r.data);if(r.type===0x809&&b.readUInt16LE(2)===0x10)sheet++;if(sheet===0&&[0x203,0xfd].includes(r.type))cells.set(`${b.readUInt16LE(0)}:${b.readUInt16LE(2)}`,{type:r.type,b});}
  for(const [pos,value,format]of [['48:9',.8,'0.00" m"'],['48:11',6.5,'0.0" m"'],['48:13',2,undefined]]){
    const c=cells.get(pos);assert.equal(c.type,0x203);assert.equal(c.b.readDoubleLE(6),value);
    const xf=xfs[c.b.readUInt16LE(4)],fontIndex=xf.readUInt16LE(0),font=fonts[fontIndex>4?fontIndex-1:fontIndex];
    assert.equal(font.readUInt16LE(0),240);assert.equal(font.readUInt16LE(4),8);
    if(format)assert.equal(formats.get(xf.readUInt16LE(2)),format);
  }
  assert.equal(cells.get('48:0').type,0xfd);assert.equal(cells.get('47:0').type,0xfd);
  assert.ok(!cells.has('47:9'),'La medida vacía no se transforma en cero ni en una unidad suelta');
});
test('el PDF acepta las 26 estaciones y comprueba los límites de texto antes de guardarlo',async()=>{
  const inv=createInventory();inv.sheets[0].stations=Array.from({length:26},(_,i)=>entry(String(i),{diameter:'0,8',culvertLength:'6,5',headwallNumber:'2',headwallType:'Toma',observations:'Huecos 2x2 (6)'}));
  assert.equal((await PDFDocument.load(await makePdf(pdf,documentValues(inv)))).getPageCount(),2);
  await checkStationForDocument(entry('4,9',{observations:'Huecos 2x2 (6)'}),0);
  await assert.rejects(()=>checkStationForDocument(entry('4,9',{observations:'Descripción muy extensa '.repeat(30)}),0),/no cabe/);
});
test('la pestaña y todas las dependencias del detalle están disponibles sin conexión',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  const ui=await readFile(new URL('../dist/js/station-ui.js',import.meta.url),'utf8');
  const sw=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
  for(const name of ['stations.js','station-ui.js'])assert.ok(sw.includes(`./js/${name}`));
  for(const [,id]of ui.matchAll(/\$\('([^']+)'\)/g))assert.ok(html.includes(`id="${id}"`),id);
  assert.match(html,/id="tab-stations"[^>]+role="tab"/);assert.match(html,/id="panel-stations"[^>]+role="tabpanel"/);
  for(const id of ['station-diameter','station-length','station-number','station-type'])assert.ok(!html.match(new RegExp(`<input[^>]*id="${id}"[^>]*required`)));
});
