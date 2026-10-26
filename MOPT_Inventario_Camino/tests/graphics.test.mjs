// Verifica datos, los dos casos, imágenes nativas y conservación de la plantilla.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createInventory,addSheet,toBackup,fromBackup} from '../dist/js/model.js';
import {SYMBOLS,symbolUrl,createGraphic,graphicPlacements,loadGraphicAssets,removeStationGraphics,GRAPH_FRAME,constrainGraphic,graphicBounds,stationFrame,graphicAssetKey,exportGraphic} from '../dist/js/graphics-model.js';
import {rotateExamplePng} from '../scripts/rotar_simbolos.mjs';
import {documentValues,makeExcel,makePdf,documentFilename} from '../dist/js/documents.js';
import {readContainer,readRecords} from '../dist/js/excel-template.js';
import {officeArtRecords,imageDigest} from '../dist/js/excel-drawing.js';
import {PDFDocument} from '../dist/vendor/pdf-lib.esm.min.js';
const template=await readFile(new URL('../dist/templates/DPA-301-original.xls',import.meta.url));
const pdf=await readFile(new URL('../dist/templates/DPA-301-original.pdf',import.meta.url));
const catalog=JSON.parse(await readFile(new URL('../dist/data/caminos.json',import.meta.url),'utf8'));
const station=(id,km)=>({id,station:km,diameter:'',culvertLength:'',headwallNumber:'',headwallType:'',observations:''});
const assetReader=async url=>Buffer.from(await (await fetch(url)).arrayBuffer());
function drawingStreams(file) {
  const records=readRecords(readContainer(file).workbook),group=[],sheets=[];let sheet=-1,inGroup=false;
  for(const r of records) {
    const b=Buffer.from(r.data);if(r.type===0x809&&b.readUInt16LE(2)===0x10){sheet++;sheets[sheet]=[];}
    if(sheet<0){if(r.type===0xeb)inGroup=true;if(inGroup&&[0xeb,0x3c].includes(r.type))group.push(b);else inGroup=false;}
    if(sheet>=0&&r.type===0xec)sheets[sheet].push(b);
  }
  return {records,group:Buffer.concat(group),sheets:sheets.map(parts=>Buffer.concat(parts))};
}
test('las 18 figuras agrupadas conservan cada byte de los PNG originales y la huella OfficeArt es válida',async()=>{
  assert.equal(SYMBOLS.length,18);assert.equal(new Set(SYMBOLS.map(s=>s.id)).size,18);
  const digest=createHash('sha256');
  for(const s of SYMBOLS){const b=await assetReader(symbolUrl(s.id));assert.equal(b.subarray(1,4).toString(),'PNG');assert.ok(s.width>0&&s.height>0);digest.update(s.id);digest.update('\0');digest.update(b);assert.equal(symbolUrl(s.id),symbolUrl(s.id));}
  assert.equal(digest.digest('hex'),'674b7c4474a840670fc9984bfd4d9ff8c9fe3378c57823ce53f8432268d5cfb8');
  assert.equal(Buffer.from(imageDigest(new TextEncoder().encode(''))).toString('hex'),'31d6cfe0d16ae931b73c59d7e0c089c0');
  assert.equal(Buffer.from(imageDigest(new TextEncoder().encode('a'))).toString('hex'),'bde52cb31de33e46245e05fbdbd6fb24');
});
test('los casos conservan dibujos independientes y los respaldos recuperan cada hoja',()=>{
  let inv=addSheet(createInventory()),sheet=inv.sheets[0];sheet.stations=[station('s0','0,0'),station('s1','4,9')];
  sheet.graphics.free=[createGraphic('bacheo',{x:.4,y:.8})];sheet.graphics.station=[createGraphic('tomas',{stationId:'s1',frameHeight:15.386})];
  const free=graphicPlacements(sheet);sheet.graphics.activeMode='station';const linked=graphicPlacements(sheet);
  assert.notEqual(free[0].symbolId,linked[0].symbolId);assert.ok(linked[0].y>GRAPH_FRAME.height-2*15.387);
  const recovered=fromBackup(toBackup(inv),catalog);assert.deepEqual(recovered.sheets[0].graphics,sheet.graphics);
  assert.equal(recovered.sheets[1].graphics.free.length,0);
  const legacy=JSON.parse(toBackup(inv));delete legacy.inventory.sheets[0].graphics;
  assert.deepEqual(fromBackup(legacy,catalog).sheets[0].graphics,{activeMode:'free',free:[],station:[]});
});
test('el gráfico por estación sube o baja con su fila y al eliminarla se retiran sus símbolos',()=>{
  const sheet=createInventory().sheets[0];sheet.stations=[station('s0','0'),station('s1','4,9')];
  sheet.graphics.activeMode='station';sheet.graphics.station=[createGraphic('bacheo',{stationId:'s1',frameHeight:15.386})];
  const before=graphicPlacements(sheet)[0];sheet.stations.shift();removeStationGraphics(sheet,'s0');
  const after=graphicPlacements(sheet)[0];assert.ok(after.y>before.y+15);
  sheet.stations=[];removeStationGraphics(sheet,'s1');assert.deepEqual(graphicPlacements(sheet),[]);
  // La plantilla cambia de alto entre filas; un giro debe seguir cabiendo al subir.
  sheet.stations=Array.from({length:9},(_,i)=>station(`r${i}`,String(i)));
  const height=stationFrame(sheet.stations,'r8').height;
  sheet.graphics.station=[constrainGraphic(createGraphic('alcantarilla-existente',{stationId:'r8',frameHeight:height}),{width:.8,height:.8,rotation:90},height)];
  sheet.stations.shift();removeStationGraphics(sheet,'r0');
  const box=graphicBounds(sheet.graphics.station[0],stationFrame(sheet.stations,'r8').height);
  assert.ok(box.y>=-1e-7&&box.y+box.height<=1.0000001);assert.equal(graphicPlacements(sheet)[0].rotation,90);
});
test('los respaldos rechazan figuras desconocidas, coordenadas fuera de la hoja y estaciones inexistentes',()=>{
  const inv=createInventory();inv.sheets[0].graphics.free=[createGraphic('bacheo')];
  for(const change of [s=>s.graphics.free[0].symbolId='inventado',s=>s.graphics.free[0].width=-1,s=>s.graphics.free[0].x=2,s=>{s.graphics.activeMode='station';s.graphics.station=[{...s.graphics.free[0],stationId:'no-existe'}];}]){
    const raw=JSON.parse(toBackup(inv));change(raw.inventory.sheets[0]);assert.throws(()=>fromBackup(raw,catalog));
  }
});
test('Excel incorpora imágenes independientes, reutiliza cada PNG y conserva los dibujos y geometría originales',async()=>{
  const inv=createInventory(),sheet=inv.sheets[0];sheet.graphics.free=[createGraphic('bacheo'),createGraphic('bacheo',{y:.7}),createGraphic('tomas',{x:.2,y:.9})];
  const values=documentValues(inv),assets=await loadGraphicAssets(values.graphics,assetReader),out=makeExcel(template,values,assets);
  const old=drawingStreams(template),result=drawingStreams(out),nodes=officeArtRecords(result.group),store=nodes.find(n=>n.type===0xf001);
  assert.equal(store.instance,6); // Cuatro entradas originales y dos símbolos nuevos.
  const oldStore=officeArtRecords(old.group).find(n=>n.type===0xf001);
  assert.deepEqual(result.group.subarray(store.data,store.data+oldStore.end-oldStore.data),old.group.subarray(oldStore.data,oldStore.end));
  const entries=nodes.filter(n=>n.type===0xf007&&n.start>=store.data+oldStore.end-oldStore.data);
  assert.equal(entries.length,2);assert.deepEqual(entries.map(n=>result.group.readUInt32LE(n.data+24)),[2,1]);
  for(let i=0;i<entries.length;i++){
    const entry=entries[i],image=officeArtRecords(result.group.subarray(entry.data+36,entry.end))[0];
    assert.equal(image.type,0xf01e);
    assert.deepEqual(result.group.subarray(entry.data+36+8+17,entry.end),assets[i===0?'bacheo':'tomas']);
  }
  const added=officeArtRecords(result.sheets[0]).filter(n=>n.type===0xf00a&&n.instance===75);
  assert.equal(added.length,4); // Logotipo original y tres símbolos editables.
  assert.deepEqual(result.sheets[1],old.sheets[1]);
  for(const type of [0x7d,0x208,0x26,0x27,0x28,0x29])assert.deepEqual(result.records.filter(r=>r.type===type).map(r=>r.data),old.records.filter(r=>r.type===type).map(r=>r.data));
  const bounds=result.records.filter(r=>r.type===0x85);for(const r of bounds){const at=new DataView(r.data.buffer).getUint32(0,true);assert.equal(result.records.find(v=>v.old===at)?.type,0x809);}
});
test('una hoja con 200 imágenes amplía FAT y mantiene identificadores y tamaños OfficeArt coherentes',async()=>{
  const inv=createInventory();inv.sheets[0].graphics.free=Array.from({length:200},(_,i)=>createGraphic(SYMBOLS[i%18].id,{x:(i%5+1)/6,y:(Math.floor(i/5)+.5)/40}));
  const values=documentValues(inv),assets=await loadGraphicAssets(values.graphics,assetReader),out=makeExcel(template,values,assets),c=readContainer(out),d=drawingStreams(out);
  assert.ok(c.fat.length>readContainer(template).fat.length);
  const front=officeArtRecords(d.sheets[0]),shapes=front.filter(n=>n.type===0xf00a),ids=shapes.map(n=>d.sheets[0].readUInt32LE(n.data));
  assert.equal(new Set(ids).size,ids.length);assert.equal(front[0].end,d.sheets[0].length);
  assert.equal(front.find(n=>n.type===0xf008).end-front.find(n=>n.type===0xf008).data,8);
  assert.equal(d.sheets[0].readUInt32LE(front.find(n=>n.type===0xf008).data),216);
});
test('PDF, Excel y el nombre de descarga distinguen el caso seleccionado',async()=>{
  const inv=createInventory(),sheet=inv.sheets[0];sheet.stations=[station('s0','0')];sheet.graphics.activeMode='station';sheet.graphics.station=[createGraphic('alcantarilla-existente',{stationId:'s0',frameHeight:15.386})];
  const values=documentValues(inv),assets=await loadGraphicAssets(values.graphics,assetReader);
  assert.match(documentFilename(inv,'xls'),/caso-2-estaciones/);
  assert.equal((await PDFDocument.load(await makePdf(pdf,values,assets))).getPageCount(),2);
  assert.throws(()=>makeExcel(template,values),/imagen original/);
  await assert.rejects(()=>makePdf(pdf,values),/Falta cargar/);
  sheet.graphics.activeMode='free';assert.equal(documentValues(inv).graphics.length,0);
});
test('todos los controles gráficos y sus recursos están incluidos para trabajar sin conexión',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8'),ui=await readFile(new URL('../dist/js/graphics-ui.js',import.meta.url),'utf8'),sw=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
  for(const [,id]of ui.matchAll(/\$\('([^']+)'\)/g))assert.ok(html.includes(`id="${id}"`),id);
  for(const name of ['graphics-ui.js','graphics-model.js','symbol-catalog.js','excel-drawing.js'])assert.ok(sw.includes(`./js/${name}`),name);
  for(const symbol of SYMBOLS){assert.ok(symbol.pngBase64,symbol.id);assert.ok(!sw.includes(`./symbols/${symbol.id}.png`),symbol.id);}
});
test('el giro conserva el centro, normaliza vueltas y limita el contorno real de cada caso',()=>{
  const original=createGraphic('alcantarilla-existente',{x:.5,y:.5});
  const turned=constrainGraphic(original,{rotation:405});assert.equal(turned.rotation,45);
  assert.ok(Math.abs(original.x+original.width/2-turned.x-turned.width/2)<1e-7);
  assert.ok(Math.abs(original.y+original.height/2-turned.y-turned.height/2)<1e-7);
  for(const height of [GRAPH_FRAME.height,14.717,15.386,17.695])for(let rotation=0;rotation<360;rotation+=7){
    const fitted=constrainGraphic({...original,x:.95,y:.99,width:.9,height:.8},{rotation},height),box=graphicBounds(fitted,height);
    assert.ok(box.x>=-1e-7&&box.y>=-1e-7&&box.x+box.width<=1.0000001&&box.y+box.height<=1.0000001,`${height}, ${rotation}`);
  }
});
test('los respaldos anteriores reciben 0 grados y ambos casos conservan su rotación',()=>{
  const inv=createInventory(),sheet=inv.sheets[0];sheet.stations=[station('s0','0')];
  sheet.graphics.free=[constrainGraphic(createGraphic('bacheo'),{rotation:37.5})];
  const height=stationFrame(sheet.stations,'s0').height;
  sheet.graphics.station=[constrainGraphic(createGraphic('tomas',{stationId:'s0',frameHeight:height}),{rotation:270},height)];
  const recovered=fromBackup(toBackup(inv),catalog).sheets[0];
  assert.equal(recovered.graphics.free[0].rotation,37.5);assert.equal(recovered.graphics.station[0].rotation,270);
  const legacy=JSON.parse(toBackup(inv));delete legacy.inventory.sheets[0].graphics.free[0].rotation;
  assert.equal(fromBackup(legacy,catalog).sheets[0].graphics.free[0].rotation,0);
  for(const rotation of ['90',null,-1,360]){const raw=JSON.parse(toBackup(inv));raw.inventory.sheets[0].graphics.free[0].rotation=rotation;assert.throws(()=>fromBackup(raw,catalog),/ángulo/);}
});
test('Excel y PDF reciben los mismos píxeles girados, con contornos y centros iguales al editor',async()=>{
  const inv=createInventory(),angles=[15,45,90,180,270,345,37.5];
  inv.sheets[0].graphics.free=angles.map((rotation,i)=>constrainGraphic(createGraphic('direccion-agua',{y:(i+1)/8}),{rotation}));
  const values=documentValues(inv),assets=await loadGraphicAssets(values.graphics,assetReader,rotateExamplePng),d=drawingStreams(makeExcel(template,values,assets));
  const nodes=officeArtRecords(d.group),store=nodes.find(n=>n.type===0xf001),images=nodes.filter(n=>n.type===0xf007&&n.parent===store).slice(-angles.length);
  for(let i=0;i<angles.length;i++){
    const source=values.graphics[i],item=exportGraphic(source),entry=images[i];
    assert.deepEqual(d.group.subarray(entry.data+36+8+17,entry.end),Buffer.from(assets[graphicAssetKey(source)]));
    assert.ok(Math.abs(item.x+item.width/2-source.x-source.width/2)<1e-7);
    assert.ok(Math.abs(item.y+item.height/2-source.y-source.height/2)<1e-7);
    if(source.rotation===90)assert.ok(Math.abs(item.width-source.height)<1e-7);
  }
  assert.equal((await PDFDocument.load(await makePdf(pdf,values,assets))).getPageCount(),2);
  assert.deepEqual(d.sheets[1],drawingStreams(template).sheets[1]);
});
test('el lienzo web estira antes de girar y reutiliza cada tamaño/ángulo al exportar',async()=>{
  const calls=[],png=await assetReader(symbolUrl('direccion-agua'));
  const previous={bitmap:globalThis.createImageBitmap,canvas:globalThis.OffscreenCanvas};
  globalThis.createImageBitmap=async()=>({width:200,height:50,close(){calls.push(['close']);}});
  globalThis.OffscreenCanvas=class{constructor(w,h){calls.push(['canvas',w,h]);}getContext(){return Object.fromEntries(['translate','scale','rotate','drawImage'].map(name=>[name,(...args)=>calls.push([name,...args.slice(name==='drawImage'?1:0)])]));}async convertToBlob(){return new Blob([png]);}};
  try{
    const item={symbolId:'direccion-agua',x:20,y:40,width:10,height:20,rotation:90};
    const assets=await loadGraphicAssets([item,{...item}],async()=>png);
    assert.ok(assets[graphicAssetKey(item)]);assert.equal(calls.filter(c=>c[0]==='canvas').length,1);
    assert.deepEqual(calls.find(c=>c[0]==='drawImage'),['drawImage',-5,-10,10,20]);
    assert.ok(Math.abs(calls.find(c=>c[0]==='rotate')[1]-Math.PI/2)<1e-9);
    assert.ok(calls.some(c=>c[0]==='scale'));
  }finally{globalThis.createImageBitmap=previous.bitmap;globalThis.OffscreenCanvas=previous.canvas;}
});
test('el proyecto completo queda por debajo de 100 archivos para una sola carga en GitHub',async()=>{
  const ignore=new Set(['.git','.openai','node_modules','__pycache__','.DS_Store']);
  async function files(directory) {
    const all=[];
    for(const item of await readdir(directory,{withFileTypes:true})) {
      if(ignore.has(item.name)||/\.(zip|tar\.gz)$/.test(item.name))continue;
      const path=new URL(item.name+(item.isDirectory()?'/':''),directory);
      if(item.isDirectory())all.push(...await files(path));else if(item.isFile())all.push(path);
    }
    return all;
  }
  const all=await files(new URL('../',import.meta.url));
  assert.ok(all.length<100,`El paquete completo contiene ${all.length} archivos.`);
  assert.ok(all.some(file=>file.pathname.endsWith('/dist/templates/DPA-301-original.xls')));
  assert.ok(all.some(file=>file.pathname.endsWith('/dist/templates/DPA-301-original.pdf')));
});
