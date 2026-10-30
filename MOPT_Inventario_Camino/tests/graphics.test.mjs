// Verifica datos, el dibujo único, imágenes nativas y conservación de la plantilla.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createInventory,addSheet,toBackup,fromBackup} from '../dist/js/model.js';
import {SYMBOLS,symbolUrl,createGraphic,graphicPlacements,loadGraphicAssets,GRAPH_FRAME,GRAPH_ZONES,createStationGraphic,reflowStationSymbols,restoreGraphics,constrainGraphic,stretchGraphic,graphicBounds,stationFrame,graphicAssetKey,exportGraphic,fitGraphicView,zoomGraphicView,constrainGraphicView,stationGraphicEntries,findStationGraphicDuplicate} from '../dist/js/graphics-model.js';
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
test('la vista por renglón incluye dibujos girados que cruzan dos estaciones sin alterar sus datos',()=>{
  const inv=createInventory(),sheet=inv.sheets[0];sheet.stations=[station('a','0,0'),station('b','1,0'),station('c','2,0')];
  const row=stationFrame(sheet.stations,'b'),free=constrainGraphic(createGraphic('bacheo',{y:(row.top+row.height)/GRAPH_FRAME.height}),{width:.1,height:.01,rotation:45});
  const linked=createStationGraphic('tomas',sheet.stations,{stationId:'b',area:'road',side:'left'});linked.placement.manual=true;linked.y=.4;sheet.graphics.free=[free,linked];
  const before=structuredClone(sheet);
  assert.equal(stationGraphicEntries(sheet,'a').filter(entry=>entry.item.id===free.id&&entry.visible).length,1);
  const entries=stationGraphicEntries(sheet,'b');assert.equal(entries.length,2);assert.equal(entries.find(entry=>entry.item.id===free.id).graphic.rotation,45);
  assert.equal(entries.find(entry=>entry.item.id===linked.id).visible,false);assert.equal(entries.find(entry=>entry.item.id===linked.id).linked,true);
  assert.equal(stationGraphicEntries(sheet,'c').length,0);assert.equal(stationGraphicEntries(sheet,'missing').length,0);assert.deepEqual(sheet,before);
});
test('el bloqueo de duplicados reconoce ajustes manuales y dibujos libres, conservando otras ubicaciones',()=>{
  const inv=createInventory(),sheet=inv.sheets[0];sheet.stations=[station('a','0,0'),station('b','1,0')];const target={stationId:'a',area:'road',side:'left'};
  const linked=createStationGraphic('bacheo',sheet.stations,target);linked.placement.manual=true;sheet.graphics.free=[linked];
  assert.equal(findStationGraphicDuplicate(sheet,'bacheo',target).id,linked.id);
  assert.equal(findStationGraphicDuplicate(sheet,'bacheo',target,linked.id),undefined);
  assert.equal(findStationGraphicDuplicate(sheet,'bacheo',{...target,side:'right'}),undefined);
  assert.equal(findStationGraphicDuplicate(sheet,'bacheo',{...target,stationId:'b'}),undefined);
  const free=constrainGraphic(linked,{rotation:180});delete free.placement;sheet.graphics.free=[free];
  assert.equal(findStationGraphicDuplicate(sheet,'bacheo',target).id,free.id);
  assert.equal(findStationGraphicDuplicate(sheet,'tomas',target),undefined);
  assert.deepEqual(fromBackup(toBackup(inv),catalog).sheets[0].graphics,sheet.graphics);
});
test('los 18 símbolos caben en las siete ubicaciones y en los 26 renglones de la plantilla',()=>{
  const stations=Array.from({length:26},(_,i)=>station(`row-${i}`,`${i},0`));
  assert.deepEqual(GRAPH_ZONES.sidewalk.left,[0,13.998]);assert.deepEqual(GRAPH_ZONES.ditch.right,[68.653,75.159]);assert.deepEqual(GRAPH_ZONES.road.both,[20.989,68.653]);
  for(const symbol of SYMBOLS)for(const [area,zone]of Object.entries(GRAPH_ZONES))for(const side of ['left','right','both'].filter(side=>zone[side]))for(const record of stations){
    const item=createStationGraphic(symbol.id,stations,{stationId:record.id,area,side}),row=stationFrame(stations,record.id),[left,right]=zone[side];
    assert.ok(item.x*GRAPH_FRAME.width>=left+.39999);assert.ok((item.x+item.width)*GRAPH_FRAME.width<=right-.39999);
    assert.ok(item.y*GRAPH_FRAME.height>=row.top+.39999);assert.ok((item.y+item.height)*GRAPH_FRAME.height<=row.top+row.height-.39999);
    assert.ok(item.width>0&&item.height>0);assert.equal(item.rotation,0);
    if(side==='both')assert.ok(Math.abs(item.width*GRAPH_FRAME.width-(right-left-.8))<.00001);
    assert.doesNotThrow(()=>restoreGraphics({free:[item]},stations));
  }
});
test('ordenar estaciones mueve sus símbolos automáticos y conserva sus datos, ID y bloqueo',()=>{
  const inv=createInventory(),sheet=inv.sheets[0];sheet.stations=[station('later','2,870')];
  const auto={...createStationGraphic('alcantarilla-existente',sheet.stations,{stationId:'later',area:'road',side:'both'}),locked:true};
  const free=createGraphic('poste-electrico'),previous=sheet.stations;sheet.graphics.free=[auto,free];
  sheet.stations=[station('earlier','2,864'),...previous];reflowStationSymbols(sheet,previous);
  const moved=sheet.graphics.free[0],expected=createStationGraphic(auto.symbolId,sheet.stations,auto.placement);
  assert.equal(moved.id,auto.id);assert.equal(moved.locked,true);assert.equal(moved.y,expected.y);assert.ok(moved.y<auto.y);
  assert.deepEqual(sheet.graphics.free[1],free);assert.deepEqual(fromBackup(toBackup(inv),catalog).sheets[0].graphics,sheet.graphics);
});
test('un ajuste manual sigue la estación por desplazamiento y no pierde tamaño ni giro al reordenar',()=>{
  const inv=createInventory(),sheet=inv.sheets[0];sheet.stations=[station('later','2,870')];
  const auto=createStationGraphic('alcantarilla-existente',sheet.stations,{stationId:'later',area:'road',side:'both'});
  const manual=constrainGraphic({...auto,placement:{...auto.placement,manual:true}},{rotation:37,width:.2,height:.025,y:.9});
  sheet.graphics.free=[manual];const previous=sheet.stations,before=stationFrame(previous,'later');sheet.stations=[station('earlier','2,864'),...previous];
  reflowStationSymbols(sheet,previous);const moved=sheet.graphics.free[0],after=stationFrame(sheet.stations,'later');
  assert.equal(moved.width,manual.width);assert.equal(moved.height,manual.height);assert.equal(moved.rotation,manual.rotation);assert.equal(moved.x,manual.x);
  assert.ok(Math.abs((moved.y-manual.y)*GRAPH_FRAME.height-(after.top+after.height/2-before.top-before.height/2))<.00001);
  assert.deepEqual(fromBackup(toBackup(inv),catalog).sheets[0].graphics,sheet.graphics);
});
test('quitar una estación retira sus figuras vinculadas y mantiene los dibujos libres y demás estaciones',()=>{
  const inv=createInventory(),sheet=inv.sheets[0];sheet.stations=[station('a','1,0'),station('b','2,0')];
  const first=createStationGraphic('bacheo',sheet.stations,{stationId:'a',area:'sidewalk',side:'left'}),second=createStationGraphic('tomas',sheet.stations,{stationId:'b',area:'ditch',side:'right'}),free=createGraphic('bacheo');
  sheet.graphics.free=[first,second,free];const previous=sheet.stations;sheet.stations=[previous[1]];reflowStationSymbols(sheet,previous);
  assert.deepEqual(sheet.graphics.free.map(item=>item.id),[second.id,free.id]);assert.deepEqual(sheet.graphics.free[1],free);
  assert.equal(sheet.graphics.free[0].y,createStationGraphic('tomas',sheet.stations,second.placement).y);
});
test('las copias validan ubicación, lado y estación de cada vínculo sin aceptar referencias dañadas',()=>{
  const inv=createInventory(),sheet=inv.sheets[0];sheet.stations=[station('a','0,0')];
  const item=createStationGraphic('bacheo',sheet.stations,{stationId:'a',area:'road',side:'both'});
  for(const patch of [{stationId:'missing'},{area:'fuera'},{area:'sidewalk',side:'both'},{area:'ditch',side:'both'},{side:'label'},{manual:'sí'}]){
    sheet.graphics.free=[{...item,placement:{...item.placement,...patch}}];assert.throws(()=>fromBackup(toBackup(inv),catalog),/ubicación/);
  }
});
test('la exportación de siete posiciones usa las mismas figuras y coordenadas en PDF y Excel',async()=>{
  const inv=createInventory(),sheet=inv.sheets[0];sheet.stations=Array.from({length:7},(_,i)=>station(`row-${i}`,`${i},0`));
  const choices=Object.entries(GRAPH_ZONES).flatMap(([area,zone])=>['left','right','both'].filter(side=>zone[side]).map(side=>({area,side})));
  sheet.graphics.free=choices.map((choice,i)=>createStationGraphic('alcantarilla-existente',sheet.stations,{...choice,stationId:sheet.stations[i].id}));
  const values=documentValues(inv),assets=await loadGraphicAssets(values.graphics,assetReader),excel=makeExcel(template,values,assets);
  const drawings=drawingStreams(excel),shapes=officeArtRecords(drawings.sheets[0]).filter(record=>record.type===0xf010);
  assert.ok(shapes.length>=7);assert.equal(values.graphics.length,7);
  const anchors=shapes.slice(-7),columns=[[3,3],[8,8],[4,4],[7,7],[5,5],[6,6],[5,6]];
  for(const [index,anchor]of anchors.entries()){
    assert.equal(drawings.sheets[0].readUInt16LE(anchor.data+2),columns[index][0]);
    assert.equal(drawings.sheets[0].readUInt16LE(anchor.data+10),columns[index][1]);
    assert.equal(drawings.sheets[0].readUInt16LE(anchor.data+6),48-index);
    assert.equal(drawings.sheets[0].readUInt16LE(anchor.data+14),48-index);
  }
  const result=await PDFDocument.load(await makePdf(pdf,values,assets));assert.equal(result.getPageCount(),2);
  const content=result.getPages()[0].node.Contents();assert.ok(content);
  for(const [index,value]of values.graphics.entries()){
    const item=sheet.graphics.free[index];assert.ok(Math.abs(value.x-item.x*GRAPH_FRAME.width)<1e-7);assert.ok(Math.abs(value.y-item.y*GRAPH_FRAME.height)<1e-7);
  }
});
test('un borrador anterior siempre recupera el dibujo libre aunque tuviera seleccionado el editor retirado',()=>{
  const inv=createInventory(),sheet=inv.sheets[0];sheet.stations=[station('old','2,870')];
  const drawing=constrainGraphic(createGraphic('bacheo'),{rotation:37.5,width:.2,height:.03});
  sheet.graphics={activeMode:'station',free:[drawing],station:[{id:'old-symbol',symbolId:'tomas',stationId:'old',x:.2,y:.2,width:.1,height:.3,rotation:0}]};
  const recovered=fromBackup(toBackup(inv),catalog),graphics=recovered.sheets[0].graphics;
  assert.deepEqual(graphics,{free:[drawing]});
  assert.equal(documentValues(recovered).graphics[0].id,drawing.id);
  assert.doesNotMatch(documentFilename(recovered,'xls'),/caso|estaciones/);
});
test('un borrador que solo tenía dibujo por estación se adapta una vez a la carretera completa',()=>{
  const inv=createInventory(),sheet=inv.sheets[0];sheet.stations=[station('a','2,864'),station('b','2,870')];
  const row=stationFrame(sheet.stations,'b'),old=constrainGraphic({id:'old-symbol',symbolId:'direccion-agua',stationId:'b',x:.2,y:.2,width:.1,height:.3,rotation:37.5},{},row.height);
  sheet.graphics={activeMode:'station',free:[],station:[old]};
  const recovered=fromBackup(toBackup(inv),catalog),graphics=recovered.sheets[0].graphics,item=graphics.free[0];
  assert.deepEqual(Object.keys(graphics),['free']);assert.ok(!Object.hasOwn(item,'stationId'));
  assert.equal(item.id,old.id);assert.equal(item.rotation,old.rotation);assert.equal(item.width,old.width);
  assert.ok(Math.abs(item.y*GRAPH_FRAME.height-row.top-old.y*row.height)<1e-7);
  assert.ok(Math.abs(item.height*GRAPH_FRAME.height-old.height*row.height)<1e-7);
  assert.deepEqual(fromBackup(toBackup(recovered),catalog).sheets[0].graphics,graphics);
});
test('la recuperación de dibujos antiguos conserva 26 filas y sus giros en un único plano',()=>{
  const inv=createInventory(),sheet=inv.sheets[0];sheet.stations=Array.from({length:26},(_,i)=>station(`s${i}`,`${i},0`));
  const legacy=sheet.stations.flatMap(st=>[0,37,90,270].map(rotation=>{
    const row=stationFrame(sheet.stations,st.id);
    return constrainGraphic({id:`${st.id}-${rotation}`,symbolId:'alcantarilla-existente',stationId:st.id,x:.4,y:.3,width:.2,height:.2,rotation},{},row.height);
  }));
  sheet.graphics={activeMode:'station',free:[],station:legacy};
  const recovered=fromBackup(toBackup(inv),catalog),items=recovered.sheets[0].graphics.free;
  assert.equal(items.length,104);
  for(let i=0;i<items.length;i++) {
    const old=legacy[i],row=stationFrame(sheet.stations,old.stationId),item=items[i];
    assert.equal(item.id,old.id);assert.equal(item.rotation,old.rotation);assert.equal(item.width,old.width);
    assert.ok(Math.abs(item.height*GRAPH_FRAME.height-old.height*row.height)<1e-7);
    const bounds=graphicBounds(item);assert.ok(bounds.x>=-1e-7&&bounds.y>=-1e-7&&bounds.x+bounds.width<=1+1e-7&&bounds.y+bounds.height<=1+1e-7);
  }
  assert.equal(graphicPlacements(recovered.sheets[0]).length,104);
});
test('estirar hasta el límite conserva el otro eje y el contorno girado dentro del documento',()=>{
  for(const frameHeight of [GRAPH_FRAME.height,15.386])for(const rotation of [0,37,90,143,270])for(const axis of ['width','height']) {
    const item=constrainGraphic(createGraphic('bacheo',{frameHeight}),{width:.04,height:.04,rotation},frameHeight);
    const result=stretchGraphic(item,axis,100,frameHeight),other=axis==='width'?'height':'width',bounds=graphicBounds(result,frameHeight);
    assert.ok(Math.abs(result[other]-item[other])<=1e-8);
    assert.ok(bounds.x>=-1e-7&&bounds.y>=-1e-7&&bounds.x+bounds.width<=1+1e-7&&bounds.y+bounds.height<=1+1e-7);
  }
});
test('estirar con un tirador conserva el extremo opuesto en los ejes del símbolo girado',()=>{
  for(const rotation of [0,37,90])for(const axis of ['width','height'])for(const anchor of ['start','end']) {
    const item=constrainGraphic(createGraphic('bacheo'),{width:.1,height:.04,rotation}),result=stretchGraphic(item,axis,item[axis]*1.2,GRAPH_FRAME.height,anchor);
    const a=rotation*Math.PI/180,sign=anchor==='start'?-1:1;
    const fixed=value=>{
      const cx=(value.x+value.width/2)*GRAPH_FRAME.width,cy=(value.y+value.height/2)*GRAPH_FRAME.height;
      const extent=value[axis]*(axis==='width'?GRAPH_FRAME.width:GRAPH_FRAME.height)/2*sign;
      return [cx+extent*(axis==='width'?Math.cos(a):-Math.sin(a)),cy+extent*(axis==='width'?Math.sin(a):Math.cos(a))];
    };
    const before=fixed(item),after=fixed(result);assert.ok(Math.hypot(before[0]-after[0],before[1]-after[1])<1e-5);
  }
});
test('la cámara conserva proporciones en vertical y horizontal y mantiene el punto bajo los dedos al acercar',()=>{
  const bounds={x:-23,y:0,width:113.077,height:440.922};
  for(const [width,height]of [[390,700],[844,260]]) {
    const view=fitGraphicView(bounds,width,height);
    assert.ok(view.x<=bounds.x&&view.y<=bounds.y&&view.x+view.width>=bounds.x+bounds.width-1e-8&&view.y+view.height>=bounds.y+bounds.height-1e-8);
    assert.ok(Math.abs(view.width/view.height-width/height)<1e-8);
    const anchor={x:view.x+view.width*.3,y:view.y+view.height*.7},zoom=zoomGraphicView(view,2.5,anchor);
    assert.ok(Math.abs((anchor.x-zoom.x)/zoom.width-.3)<1e-8);assert.ok(Math.abs((anchor.y-zoom.y)/zoom.height-.7)<1e-8);
    const back=zoomGraphicView(zoom,1/2.5,anchor);for(const key of ['x','y','width','height'])assert.ok(Math.abs(view[key]-back[key])<1e-8);
    const atEdge=constrainGraphicView({...zoom,x:9999,y:-9999},bounds);
    if(atEdge.width<bounds.width)assert.ok(atEdge.x>=bounds.x&&atEdge.x+atEdge.width<=bounds.x+bounds.width+1e-8);
    if(atEdge.height<bounds.height)assert.ok(atEdge.y>=bounds.y&&atEdge.y+atEdge.height<=bounds.y+bounds.height+1e-8);
  }
});
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
test('los respaldos rechazan figuras desconocidas, coordenadas fuera de la hoja y estaciones inexistentes',()=>{
  const inv=createInventory();inv.sheets[0].graphics.free=[createGraphic('bacheo')];
  for(const change of [s=>s.graphics.free[0].symbolId='inventado',s=>s.graphics.free[0].width=-1,s=>s.graphics.free[0].x=2,s=>{s.graphics.free=[];s.graphics.station=[{...s.graphics.free[0],stationId:'no-existe'}];}]){
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
test('PDF, Excel y nombre de descarga usan el único dibujo de la hoja',async()=>{
  const inv=createInventory(),sheet=inv.sheets[0];sheet.stations=[station('s0','0,0')];sheet.graphics.free=[createGraphic('alcantarilla-existente')];
  const values=documentValues(inv),assets=await loadGraphicAssets(values.graphics,assetReader);
  assert.equal(Object.hasOwn(values,'graphicMode'),false);assert.doesNotMatch(documentFilename(inv,'xls'),/caso|estaciones/);
  assert.match(documentFilename(inv,'xls'),/hoja-1-de-1\.xls$/);
  assert.equal((await PDFDocument.load(await makePdf(pdf,values,assets))).getPageCount(),2);
  assert.throws(()=>makeExcel(template,values),/imagen original/);
  await assert.rejects(()=>makePdf(pdf,values),/Falta cargar/);
});
test('todos los controles gráficos y sus recursos están incluidos para trabajar sin conexión',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8'),ui=await readFile(new URL('../dist/js/graphics-ui.js',import.meta.url),'utf8'),sw=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
  for(const [,id]of ui.matchAll(/\$\('([^']+)'\)/g))assert.ok(html.includes(`id="${id}"`),id);
  for(const name of ['graphics-ui.js','graphics-model.js','symbol-catalog.js','excel-drawing.js'])assert.ok(sw.includes(`./js/${name}`),name);
  for(const symbol of SYMBOLS){assert.ok(symbol.pngBase64,symbol.id);assert.ok(!sw.includes(`./symbols/${symbol.id}.png`),symbol.id);}
  assert.doesNotMatch(html,/id="(?:graphic-case-station|graphic-case-free|graphic-station-panel|graphic-focus-station)"/);
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
test('los respaldos anteriores reciben 0 grados y el dibujo conserva su rotación',()=>{
  const inv=createInventory(),sheet=inv.sheets[0];sheet.stations=[station('s0','0')];
  sheet.graphics.free=[constrainGraphic(createGraphic('bacheo'),{rotation:37.5})];
  const recovered=fromBackup(toBackup(inv),catalog).sheets[0];
  assert.equal(recovered.graphics.free[0].rotation,37.5);
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

test('el contorno girado llega a ambos bordes en el dibujo único y se recupera aunque el rectángulo original quede fuera',()=>{
  const inv=createInventory(),sheet=inv.sheets[0];sheet.stations=[station('s0','0')];
   {
    const height=GRAPH_FRAME.height;
    const base=createGraphic('alcantarilla-nueva');
    const left=constrainGraphic(base,{rotation:90,x:-999},height),right=constrainGraphic({...base,id:base.id+'-right'},{rotation:90,x:999},height);
    assert.ok(left.x<0,'El ancla invisible ya no bloquea el borde izquierdo.');
    assert.ok(right.x+right.width>1,'El ancla invisible ya no bloquea el borde derecho.');
    assert.ok(Math.abs(graphicBounds(left,height).x)<1e-7);
    const box=graphicBounds(right,height);assert.ok(Math.abs(box.x+box.width-1)<1e-7);
    sheet.graphics.free=[left,right];
  }
  assert.deepEqual(fromBackup(toBackup(inv),catalog).sheets[0].graphics,sheet.graphics);
  const bad=JSON.parse(toBackup(inv));bad.inventory.sheets[0].graphics.free[0].x-=.01;
  assert.throws(()=>fromBackup(bad,catalog),/fuera de su recuadro/);
});

test('los símbolos girados en los extremos se exportan completos con las anclas del XLS dentro de la plantilla',async()=>{
  const inv=createInventory(),sheet=inv.sheets[0];
  sheet.graphics.free=[-999,999].map((x,i)=>constrainGraphic(createGraphic('alcantarilla-nueva',{y:(i+1)/3}),{rotation:90,x}));
  const values=documentValues(inv),assets=await loadGraphicAssets(values.graphics,assetReader,rotateExamplePng),d=drawingStreams(makeExcel(template,values,assets));
  const anchors=officeArtRecords(d.sheets[0]).filter(n=>n.type===0xf010).slice(-2);
  assert.equal(d.sheets[0].readUInt16LE(anchors[0].data+2),3);assert.equal(d.sheets[0].readUInt16LE(anchors[0].data+4),0);
  assert.equal(d.sheets[0].readUInt16LE(anchors[1].data+10),9);assert.equal(d.sheets[0].readUInt16LE(anchors[1].data+12),0);
  for(const item of values.graphics){const box=exportGraphic(item);assert.ok(box.x>=-1e-6&&box.x+box.width<=GRAPH_FRAME.width+1e-6);}
  assert.equal((await PDFDocument.load(await makePdf(pdf,values,assets))).getPageCount(),2);
  assert.deepEqual(d.sheets[1],drawingStreams(template).sheets[1]);
});

test('cada hoja conserva su dibujo y un borrador sin gráficos recibe un lienzo vacío',()=>{
  const inv=addSheet(createInventory());inv.sheets[0].graphics.free=[createGraphic('bacheo')];inv.sheets[1].graphics.free=[createGraphic('tomas')];
  assert.deepEqual(fromBackup(toBackup(inv),catalog).sheets.map(s=>s.graphics),inv.sheets.map(s=>s.graphics));
  const raw=JSON.parse(toBackup(inv));delete raw.inventory.sheets[1].graphics;
  assert.deepEqual(fromBackup(raw,catalog).sheets[1].graphics,{free:[]});
});
