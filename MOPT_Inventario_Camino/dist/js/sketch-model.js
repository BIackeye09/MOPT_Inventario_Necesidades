// Croquis por hoja. Los puntos normalizados conservan el dibujo al cambiar pantalla.
export const SKETCH_FRAME=Object.freeze({left:43.718,top:257.924,width:541.553,height:315.623});
export const SKETCH_KEY='_croquis';
export const SKETCH_LIMITS=Object.freeze({strokes:2000,points:100000,perStroke:10000});
export const createSketch=()=>({strokes:[]});
const round=value=>Math.round(value*100000)/100000;
export const sketchPoint=(x,y)=>[round(Math.max(0,Math.min(1,x))),round(Math.max(0,Math.min(1,y)))];
export function restoreSketch(input) {
  if(input===undefined)return createSketch();
  if(!input||!Array.isArray(input.strokes)||input.strokes.length>SKETCH_LIMITS.strokes)throw new Error('El croquis del respaldo no es válido.');
  let total=0;
  return {strokes:input.strokes.map(stroke=>{
    if(!stroke||!['pen','eraser'].includes(stroke.tool)||typeof stroke.size!=='number'||!Number.isFinite(stroke.size)||stroke.size<1||stroke.size>100)throw new Error('Una herramienta o grosor del croquis no es válido.');
    if(!Array.isArray(stroke.points)||!stroke.points.length||stroke.points.length>SKETCH_LIMITS.perStroke)throw new Error('Un trazo del croquis no es válido.');
    total+=stroke.points.length;if(total>SKETCH_LIMITS.points)throw new Error('El croquis supera la cantidad de puntos admitida.');
    return {tool:stroke.tool,size:stroke.size,points:stroke.points.map(p=>{
      if(!Array.isArray(p)||p.length!==2||p.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>1))throw new Error('Un punto del croquis queda fuera del recuadro.');
      return p.map(round);
    })};
  })};
}
// El borrador quita píxeles de la capa del usuario, sin pintar encima de la plantilla.
export function drawSketchStroke(context,stroke,width,height) {
  context.save();context.globalCompositeOperation=stroke.tool==='eraser'?'destination-out':'source-over';
  // Margen transparente para no superponer tinta sobre el marco oficial.
  const inset=2*width/SKETCH_FRAME.width;context.beginPath();context.rect(inset,inset,width-2*inset,height-2*inset);context.clip();
  context.strokeStyle='#000000';context.fillStyle='#000000';context.lineWidth=stroke.size*width/1000;
  context.lineCap='round';context.lineJoin='round';
  if(stroke.points.length===1){context.beginPath();context.arc(stroke.points[0][0]*width,stroke.points[0][1]*height,context.lineWidth/2,0,2*Math.PI);context.fill();}
  else {context.beginPath();stroke.points.forEach(([x,y],i)=>context[i?'lineTo':'moveTo'](x*width,y*height));context.stroke();}
  context.restore();
}
export function renderSketch(context,sketch,width,height) {
  context.clearRect(0,0,width,height);
  for(const stroke of sketch.strokes)drawSketchStroke(context,stroke,width,height);
}
export async function loadSketchAsset(sketch,render=renderSketchPng) {
  const value=restoreSketch(sketch);
  return value.strokes.length?{[SKETCH_KEY]:await render(value)}:{};
}
async function renderSketchPng(sketch) {
  const width=2160,height=Math.round(width*SKETCH_FRAME.height/SKETCH_FRAME.width);
  const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(width,height):Object.assign(document.createElement('canvas'),{width,height});
  const context=canvas.getContext('2d');if(!context)throw new Error('No se pudo preparar el croquis.');
  renderSketch(context,sketch,width,height);
  const blob=canvas.convertToBlob?await canvas.convertToBlob({type:'image/png'}):await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('No se pudo guardar el croquis.')),'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}
