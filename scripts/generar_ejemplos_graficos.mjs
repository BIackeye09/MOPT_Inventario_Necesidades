// Ejemplos de los dos casos usando las funciones reales de exportación.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createInventory,selectRoad,toBackup} from '../dist/js/model.js';
import {createGraphic,constrainGraphic,graphicPlacements,stationFrame,GRAPH_FRAME,loadGraphicAssets} from '../dist/js/graphics-model.js';
import {documentValues,makeExcel,makePdf} from '../dist/js/documents.js';
import {rotateExamplePng} from './rotar_simbolos.mjs';
const root=new URL('../',import.meta.url),out=new URL('ejemplos/',root);await mkdir(out,{recursive:true});
const catalog=JSON.parse(await readFile(new URL('dist/data/caminos.json',root),'utf8'));
const inv={...selectRoad(createInventory(),catalog.roads.find(r=>r.code==='4-0080-00')),surface:'2',number:'GRAFICO-001'};
const sheet=inv.sheets[0];
sheet.stations=[['inicio','0,0','Inicio del recorrido'],['medio','1,25','Alcantarilla con sedimentos'],['final','4,9','Huecos 2x2 (6)']].map(([id,station,observations])=>({id,station,observations,diameter:'',culvertLength:'',headwallNumber:'',headwallType:''}));
Object.assign(sheet.stations[1],{diameter:'0,80',culvertLength:'6,50',headwallNumber:'2',headwallType:'Toma'});
for(const [symbolId,stationId,x,rotation]of [['poste-electrico','inicio',.78,90],['alcantarilla-existente','medio',.5,30],['chapea-mano','medio',.2,345],['bacheo','final',.4,45],['gaviones','final',.8,270]]) {
  const frameHeight=stationFrame(sheet.stations,stationId).height;
  sheet.graphics.station.push(constrainGraphic(createGraphic(symbolId,{stationId,x,y:.5,frameHeight}),{rotation},frameHeight));
}
sheet.graphics.activeMode='station';
sheet.graphics.free=graphicPlacements(sheet).map(item=>({id:globalThis.crypto.randomUUID(),symbolId:item.symbolId,x:item.x/GRAPH_FRAME.width,y:item.y/GRAPH_FRAME.height,width:item.width/GRAPH_FRAME.width,height:item.height/GRAPH_FRAME.height,rotation:item.rotation}));
const [xls,pdf]=await Promise.all(['xls','pdf'].map(ext=>readFile(new URL(`dist/templates/DPA-301-original.${ext}`,root))));
for(const [mode,name]of [['free','caso-1-editor-completo'],['station','caso-2-por-estacion']]) {
  sheet.graphics.activeMode=mode;const values=documentValues(inv),assets=await loadGraphicAssets(values.graphics,url=>readFile(url),rotateExamplePng);
  await writeFile(new URL(`${name}.xls`,out),makeExcel(xls,values,assets));await writeFile(new URL(`${name}.pdf`,out),await makePdf(pdf,values,assets));
}
sheet.graphics.activeMode='free';await writeFile(new URL('comparar-dos-casos.json',out),toBackup(inv));
console.log('Dos Excel, dos PDF y respaldo comparativo generados.');
