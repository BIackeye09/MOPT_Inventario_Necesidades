// Coordenadas compartidas por los dos editores y por las exportaciones.
import {SYMBOLS} from './symbol-catalog.js';
import {createId} from './ids.js';
import {sortStations} from './stations.js';
export {SYMBOLS};
export const GRAPH_FRAME=Object.freeze({left:91.165,top:312.646,width:90.077,height:440.922});
// Líneas de la calzada en el dibujo original, relativas al recuadro gráfico.
// Son medidas del formulario, no una conversión de los metros del camino.
export const GRAPH_ROAD_BOUNDS=Object.freeze({left:20.989,right:68.653});
export const GRAPH_ROW_BOUNDS=Object.freeze([312.646,330.341,348.035,365.729,383.424,401.118,418.813,436.507,
  454.202,471.896,489.590,507.285,524.979,542.674,560.368,578.062,595.757,613.451,
  631.146,645.863,661.250,676.636,692.023,707.409,722.796,738.182,753.568]);
export const GRAPH_LIMIT=200;
export const MODES=Object.freeze({free:'Caso 1 · Editor completo',station:'Caso 2 · Por estación'});
export const symbolById=id=>SYMBOLS.find(s=>s.id===id);
const symbolUrls=new Map();
export function symbolUrl(id) {
  if(symbolUrls.has(id))return symbolUrls.get(id);
  const symbol=symbolById(id);if(!symbol)throw new Error('El símbolo no pertenece a la plantilla.');
  // Se recuperan los bytes originales incluidos en el catálogo. Una URL corta
  // evita repetir el Base64 en cada repintado durante el arrastre de símbolos.
  const bytes=Uint8Array.from(atob(symbol.pngBase64),c=>c.charCodeAt(0));
  const url=new URL(URL.createObjectURL(new Blob([bytes],{type:'image/png'})));
  symbolUrls.set(id,url);return url;
}
export const graphicAssetKey=item=>item.rotation?`${item.symbolId}@${item.rotation}:${item.width.toFixed(5)}:${item.height.toFixed(5)}`:item.symbolId;
export const createGraphics=()=>({activeMode:'free',free:[],station:[]});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const round=value=>Math.round(value*1e8)/1e8;
// La cámara del editor usa las mismas coordenadas del documento. Su zoom y
// desplazamiento nunca forman parte de los datos guardados ni de la exportación.
export function fitGraphicView(bounds,width,height) {
  const ratio=Math.max(1,width)/Math.max(1,height),w=Math.max(bounds.width,bounds.height*ratio),h=w/ratio;
  return {x:bounds.x+(bounds.width-w)/2,y:bounds.y+(bounds.height-h)/2,width:w,height:h};
}
export function constrainGraphicView(view,bounds) {
  const x=view.width>=bounds.width?bounds.x+(bounds.width-view.width)/2:clamp(view.x,bounds.x,bounds.x+bounds.width-view.width);
  const y=view.height>=bounds.height?bounds.y+(bounds.height-view.height)/2:clamp(view.y,bounds.y,bounds.y+bounds.height-view.height);
  return {...view,x,y};
}
export function zoomGraphicView(view,factor,anchor={x:view.x+view.width/2,y:view.y+view.height/2}) {
  const width=view.width/factor,height=view.height/factor;
  return {x:anchor.x-(anchor.x-view.x)/factor,y:anchor.y-(anchor.y-view.y)/factor,width,height};
}
export const normalizeRotation=value=>round(((value%360)+360)%360);
// La rotación usa puntos reales: una fila es mucho más baja que la carretera.
export function graphicBounds(item,frameHeight=GRAPH_FRAME.height) {
  const angle=(item.rotation||0)*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
  const width=item.width*c+item.height*frameHeight/GRAPH_FRAME.width*s;
  const height=item.height*c+item.width*GRAPH_FRAME.width/frameHeight*s;
  return {x:item.x+(item.width-width)/2,y:item.y+(item.height-height)/2,width,height};
}
export function constrainGraphic(item,patch={},frameHeight=GRAPH_FRAME.height) {
  const next={...item,...patch};
  next.width=round(clamp(next.width,.002,1));next.height=round(clamp(next.height,.0005,1));
  next.rotation=normalizeRotation(next.rotation||0);
  const centerX=next.x+next.width/2,centerY=next.y+next.height/2,bounds=graphicBounds(next,frameHeight);
  // PDF y Excel reciben el contorno ya girado. El rectángulo sin girar puede
  // quedar fuera: limitarlo también reservaba espacio invisible junto a los bordes.
  const extentX=bounds.width,extentY=bounds.height;
  const scale=Math.min(1,1/extentX,1/extentY);
  next.width*=scale;next.height*=scale;
  next.x=clamp(centerX,extentX*scale/2,1-extentX*scale/2)-next.width/2;
  next.y=clamp(centerY,extentY*scale/2,1-extentY*scale/2)-next.height/2;
  for(const key of ['x','y','width','height'])next[key]=round(next[key]);
  return next;
}
// Estira un solo eje local del símbolo. El otro conserva exactamente su medida,
// también al girar o llegar al límite del recuadro del documento.
export function stretchGraphic(item,axis,value,frameHeight=GRAPH_FRAME.height,anchor='center') {
  const angle=(item.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),ac=Math.abs(c),as=Math.abs(s);
  let maximum=1;
  if(axis==='width') {
    if(ac>1e-10)maximum=Math.min(maximum,(1-item.height*frameHeight/GRAPH_FRAME.width*as)/ac);
    if(as>1e-10)maximum=Math.min(maximum,(1-item.height*ac)*frameHeight/GRAPH_FRAME.width/as);
  } else if(axis==='height') {
    if(as>1e-10)maximum=Math.min(maximum,(1-item.width*ac)*GRAPH_FRAME.width/frameHeight/as);
    if(ac>1e-10)maximum=Math.min(maximum,(1-item.width*GRAPH_FRAME.width/frameHeight*as)/ac);
  } else throw new Error('El eje del símbolo no es válido.');
  const minimum=axis==='width'?.002:.0005,size=clamp(value,minimum,Math.max(minimum,maximum));
  const width=axis==='width'?size:item.width,height=axis==='height'?size:item.height;
  // El menú conserva el centro; cada tirador conserva el extremo opuesto.
  const direction=anchor==='start'?.5:anchor==='end'?-.5:0;
  const delta=(size-item[axis])*(axis==='width'?GRAPH_FRAME.width:frameHeight)*direction;
  return constrainGraphic(item,{width,height,
    x:item.x+(item.width-width)/2+delta*(axis==='width'?c:-s)/GRAPH_FRAME.width,
    y:item.y+(item.height-height)/2+delta*(axis==='width'?s:c)/frameHeight},frameHeight);
}
export function createGraphic(symbolId,{stationId,frameHeight=GRAPH_FRAME.height,x=.5,y=.5}={}) {
  const symbol=symbolById(symbolId);if(!symbol)throw new Error('El símbolo no pertenece a la plantilla.');
  let width=22,height=width*symbol.height/symbol.width;
  if(height>frameHeight*.7){height=frameHeight*.7;width=height*symbol.width/symbol.height;}
  // Prueba del Caso 2: las dos alcantarillas nacen atravesando la calzada.
  // El alto se adapta al renglón; después siguen siendo editables como siempre.
  // No se redimensionan símbolos guardados ni se altera el Caso 1.
  if(stationId&&['alcantarilla-existente','alcantarilla-nueva'].includes(symbolId)) {
    width=GRAPH_ROAD_BOUNDS.right-GRAPH_ROAD_BOUNDS.left;
    height=Math.min(width*symbol.height/symbol.width,frameHeight*.8);
    x=(GRAPH_ROAD_BOUNDS.left+GRAPH_ROAD_BOUNDS.right)/(2*GRAPH_FRAME.width);
  }
  return constrainGraphic({id:createId(),symbolId,
    ...(stationId?{stationId}:{}),x:x-width/GRAPH_FRAME.width/2,y:y-height/frameHeight/2,
    width:width/GRAPH_FRAME.width,height:height/frameHeight,rotation:0},{},frameHeight);
}
export function restoreGraphics(input,stations=[]) {
  if(input===undefined)return createGraphics();
  if(!input||!Object.hasOwn(MODES,input.activeMode))throw new Error('El caso gráfico del respaldo no es válido.');
  const result={activeMode:input.activeMode},stationIds=new Set(stations.map(s=>s.id));
  for(const mode of Object.keys(MODES)) {
    if(!Array.isArray(input[mode])||input[mode].length>GRAPH_LIMIT)throw new Error(`Cada caso admite hasta ${GRAPH_LIMIT} símbolos por hoja.`);
    result[mode]=input[mode].map(item=>{
      if(!item||typeof item.id!=='string'||!item.id||item.id.length>120||!symbolById(item.symbolId))throw new Error('Hay un símbolo desconocido en el respaldo.');
      for(const key of ['x','y','width','height'])if(typeof item[key]!=='number'||!Number.isFinite(item[key]))throw new Error('La posición o el tamaño de un símbolo no es válido.');
      const rotation=item.rotation===undefined?0:item.rotation;
      if(typeof rotation!=='number'||!Number.isFinite(rotation)||rotation<0||rotation>=360)throw new Error('El ángulo de un símbolo no es válido.');
      if(item.width<=0||item.height<=0||item.width>1.0000001||item.height>1.0000001)throw new Error('El tamaño de un símbolo no es válido.');
      if(mode==='station'&&!stationIds.has(item.stationId))throw new Error('Un símbolo está asociado a una estación que no existe.');
      const box=graphicBounds({...item,rotation},mode==='station'?stationFrame(stations,item.stationId).height:GRAPH_FRAME.height);
      // Se valida lo que realmente se exporta, incluso si el ancla sin girar
      // tiene una coordenada negativa. Así se recupera un símbolo en la orilla.
      if(box.x<-.0000001||box.y<-.0000001||box.x+box.width>1.0000001||box.y+box.height>1.0000001)throw new Error('Un símbolo queda fuera de su recuadro.');
      return {id:item.id,symbolId:item.symbolId,x:item.x,y:item.y,width:item.width,height:item.height,
        rotation,...(mode==='station'?{stationId:item.stationId}:{})};
    });
    if(new Set(result[mode].map(i=>i.id)).size!==result[mode].length)throw new Error('Hay símbolos con identificadores repetidos.');
  }
  return result;
}
export function stationFrame(stations,stationId) {
  const index=stations.findIndex(s=>s.id===stationId);if(index<0)return null;
  const row=25-index,top=GRAPH_ROW_BOUNDS[row]-GRAPH_FRAME.top;
  return {top,height:GRAPH_ROW_BOUNDS[row+1]-GRAPH_ROW_BOUNDS[row]};
}
export function graphicPlacements(sheet={}) {
  const previous=sheet.stations||[],stations=sortStations(previous),graphics=restoreGraphics(sheet.graphics,previous),mode=graphics.activeMode;
  return graphics[mode].map(item=>{
    const frame=mode==='free'?{top:0,height:GRAPH_FRAME.height}:stationFrame(stations,item.stationId);
    if(mode==='station'&&Math.abs(stationFrame(previous,item.stationId).height-frame.height)>1e-6)item=constrainGraphic(item,{},frame.height);
    return {id:item.id,symbolId:item.symbolId,x:item.x*GRAPH_FRAME.width,y:frame.top+item.y*frame.height,
      width:item.width*GRAPH_FRAME.width,height:item.height*frame.height,rotation:item.rotation};
  });
}
// La asociación es por ID: al ordenar, el símbolo sigue a su estación. Solo
// se ajusta su contorno si el nuevo renglón tiene una altura diferente.
export function reflowStationGraphics(sheet,previousStations=[]) {
  if(!sheet.graphics)return;
  sheet.graphics.station=sheet.graphics.station.map(item=>{
    const before=stationFrame(previousStations,item.stationId),after=stationFrame(sheet.stations,item.stationId);
    return after&&(!before||Math.abs(before.height-after.height)>1e-6)?constrainGraphic(item,{},after.height):item;
  });
}
// El archivo recibe el contorno ya girado, sin depender de cómo Excel interprete
// la rotación OfficeArt. Cada figura sigue siendo una imagen nativa independiente.
export function exportGraphic(item) {
  const angle=(item.rotation||0)*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
  const width=item.width*c+item.height*s,height=item.height*c+item.width*s;
  return {...item,x:item.x+(item.width-width)/2,y:item.y+(item.height-height)/2,width,height,imageKey:graphicAssetKey(item)};
}
export function removeStationGraphics(sheet,stationId,previousStations=[]) {
  if(sheet.graphics){sheet.graphics.station=sheet.graphics.station.filter(item=>item.stationId!==stationId);reflowStationGraphics(sheet,previousStations);}
}
// La figura original tiene alta resolución y transparencia. El lienzo solo gira
// esos píxeles; se reutilizan los mismos bytes en PDF y Excel.
async function rotateGraphicPng(bytes,rotation,item) {
  const blob=new Blob([bytes],{type:'image/png'}),image=await createImageBitmap(blob);
  try {
    const angle=rotation*Math.PI/180,bounds=exportGraphic(item);
    const density=Math.min(16,2048/Math.max(bounds.width,bounds.height),Math.max(image.width/item.width,image.height/item.height));
    const width=Math.max(1,Math.ceil(bounds.width*density-1e-8)),height=Math.max(1,Math.ceil(bounds.height*density-1e-8));
    const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(width,height):Object.assign(document.createElement('canvas'),{width,height});
    const context=canvas.getContext('2d');if(!context)throw new Error('No se pudo preparar el símbolo girado.');
    context.translate(width/2,height/2);context.scale(width/bounds.width,height/bounds.height);context.rotate(angle);
    context.drawImage(image,-item.width/2,-item.height/2,item.width,item.height);
    const result=canvas.convertToBlob?await canvas.convertToBlob({type:'image/png'}):await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('No se pudo guardar el símbolo girado.')),'image/png'));
    return new Uint8Array(await result.arrayBuffer());
  } finally {image.close();}
}
export async function loadGraphicAssets(placements,read=async url=>{
  const response=await fetch(url);if(!response.ok)throw new Error('No se pudo cargar la simbología original.');
  return new Uint8Array(await response.arrayBuffer());
},rotate=rotateGraphicPng) {
  const ids=[...new Set(placements.map(item=>item.symbolId))];
  const originals=Object.fromEntries(await Promise.all(ids.map(async id=>{
    if(!symbolById(id))throw new Error('No se puede exportar un símbolo desconocido.');
    return [id,await read(symbolUrl(id))];
  })));
  const assets={...originals},turned=new Map(placements.filter(item=>item.rotation).map(item=>[graphicAssetKey(item),item]));
  for(const [key,item]of turned)assets[key]=await rotate(originals[item.symbolId],item.rotation,item);
  return assets;
}
