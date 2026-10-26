// Coordenadas compartidas por los dos editores y por las exportaciones.
import {SYMBOLS} from './symbol-catalog.js';
import {createId} from './ids.js';
export {SYMBOLS};
export const GRAPH_FRAME=Object.freeze({left:91.165,top:312.646,width:90.077,height:440.922});
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
  // También conserva el ancla sin girar dentro del XLS; nunca recorta la imagen.
  const extentX=Math.max(next.width,bounds.width),extentY=Math.max(next.height,bounds.height);
  const scale=Math.min(1,1/extentX,1/extentY);
  next.width*=scale;next.height*=scale;
  next.x=clamp(centerX,extentX*scale/2,1-extentX*scale/2)-next.width/2;
  next.y=clamp(centerY,extentY*scale/2,1-extentY*scale/2)-next.height/2;
  for(const key of ['x','y','width','height'])next[key]=round(next[key]);
  return next;
}
export function createGraphic(symbolId,{stationId,frameHeight=GRAPH_FRAME.height,x=.5,y=.5}={}) {
  const symbol=symbolById(symbolId);if(!symbol)throw new Error('El símbolo no pertenece a la plantilla.');
  let width=22,height=width*symbol.height/symbol.width;
  if(height>frameHeight*.7){height=frameHeight*.7;width=height*symbol.width/symbol.height;}
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
      if(item.x<0||item.y<0||item.width<=0||item.height<=0||item.x+item.width>1.0000001||item.y+item.height>1.0000001)throw new Error('Un símbolo queda fuera de su recuadro.');
      if(mode==='station'&&!stationIds.has(item.stationId))throw new Error('Un símbolo está asociado a una estación que no existe.');
      const box=graphicBounds({...item,rotation},mode==='station'?stationFrame(stations,item.stationId).height:GRAPH_FRAME.height);
      if(box.x<-.0000001||box.y<-.0000001||box.x+box.width>1.0000001||box.y+box.height>1.0000001)throw new Error('Un símbolo girado queda fuera de su recuadro.');
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
  const stations=sheet.stations||[],graphics=restoreGraphics(sheet.graphics,stations),mode=graphics.activeMode;
  return graphics[mode].map(item=>{
    const frame=mode==='free'?{top:0,height:GRAPH_FRAME.height}:stationFrame(stations,item.stationId);
    return {id:item.id,symbolId:item.symbolId,x:item.x*GRAPH_FRAME.width,y:frame.top+item.y*frame.height,
      width:item.width*GRAPH_FRAME.width,height:item.height*frame.height,rotation:item.rotation};
  });
}
// El archivo recibe el contorno ya girado, sin depender de cómo Excel interprete
// la rotación OfficeArt. Cada figura sigue siendo una imagen nativa independiente.
export function exportGraphic(item) {
  const angle=(item.rotation||0)*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
  const width=item.width*c+item.height*s,height=item.height*c+item.width*s;
  return {...item,x:item.x+(item.width-width)/2,y:item.y+(item.height-height)/2,width,height,imageKey:graphicAssetKey(item)};
}
export function removeStationGraphics(sheet,stationId) {
  if(sheet.graphics)sheet.graphics.station=sheet.graphics.station.filter(item=>item.stationId!==stationId)
    .map(item=>constrainGraphic(item,{},stationFrame(sheet.stations,item.stationId).height));
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
