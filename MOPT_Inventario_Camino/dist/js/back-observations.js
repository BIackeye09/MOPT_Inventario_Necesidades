// Datos del reverso: ocho renglones y tres casillas de fecha, con sus medidas originales.
import {PDFDocument,StandardFonts} from '../vendor/pdf-lib.esm.min.js';
import {TABLE_FONT} from './stations.js';
export const BACK_OBSERVATIONS_LIMIT=2000;
// Se conserva Arial 10 de esta entrada para que el año completo quepa en su casilla original.
export const BACK_DATE_FONT=Object.freeze({name:'Arial',points:10,colorIndex:8,weight:400});
export const BACK_OBSERVATIONS_FRAME=Object.freeze({left:68.921,right:568.530,
  bounds:[592.797,607.514,622.232,636.949,651.667,666.384,681.771,697.157,712.543]});
const metricDocument=await PDFDocument.create();
const font=await metricDocument.embedFont(StandardFonts.Helvetica);
const size=TABLE_FONT.points*.5925;

// Se usan los componentes locales del dispositivo para evitar adelantar el día por UTC.
export function deviceDate(now=new Date()) {
  return `${String(now.getFullYear()).padStart(4,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function restoreBackDate(value) {
  if(value===undefined)return deviceDate();
  if(value==='')return '';
  const match=typeof value==='string'&&/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if(!match)throw new Error('La fecha del reverso no es válida. Elegí una fecha con el calendario.');
  const [,yearText,monthText,dayText]=match,year=Number(yearText),month=Number(monthText),day=Number(dayText);
  const leap=year%4===0&&(year%100!==0||year%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(year<1||month<1||month>12||day<1||day>days[month-1])throw new Error('La fecha del reverso no es válida. Elegí una fecha con el calendario.');
  return value;
}
export function backDateLines(value='') {
  if(value==='')return [];
  const [year,month,day]=restoreBackDate(value).split('-');
  const dateSize=BACK_DATE_FONT.points*.5925,top=727.930,bottom=743.316,glyphHeight=font.heightAtSize(dateSize,{descender:false});
  return [
    {address:'AA44',text:day,left:505.094,right:520.949},
    {address:'AB44',text:month,left:520.949,right:552.190},
    {address:'AD44',text:year,left:552.190,right:568.530}
  ].map(item=>({...item,size:dateSize,x:(item.left+item.right-font.widthOfTextAtSize(item.text,dateSize))/2,
    top:top+(bottom-top+glyphHeight)/2}));
}
export function restoreBackObservations(value) {
  if(value===undefined)return '';
  if(typeof value!=='string'||value.length>BACK_OBSERVATIONS_LIMIT)throw new Error('Las observaciones del reverso no son válidas.');
  return value.replace(/\r\n?/g,'\n');
}
export function backObservationLines(value='') {
  const text=restoreBackObservations(value).trim();if(!text)return [];
  const width=BACK_OBSERVATIONS_FRAME.right-BACK_OBSERVATIONS_FRAME.left-4,lines=[];
  function measure(text) {
    try{return font.widthOfTextAtSize(text,size);}
    catch{throw new Error('Las observaciones del reverso contienen un carácter que no admite la plantilla. Usá texto normal.');}
  }
  for(const paragraph of text.split('\n')) {
    let line='';
    for(const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const next=line?`${line} ${word}`:word;
      if(measure(next)<=width){line=next;continue;}
      if(line){lines.push(line);line='';}
      for(const character of word) {
        if(measure(line+character)>width){lines.push(line);line='';}
        line+=character;
      }
    }
    lines.push(line);
  }
  if(lines.length>8)throw new Error('Las observaciones del reverso superan los 8 renglones de la plantilla. Acortá el texto o usá otra hoja.');
  const glyphHeight=font.heightAtSize(size,{descender:false}),bounds=BACK_OBSERVATIONS_FRAME.bounds;
  return lines.map((text,i)=>({text,address:`B${35+i}`,size,x:BACK_OBSERVATIONS_FRAME.left+2,
    top:bounds[i]+(bounds[i+1]-bounds[i]+glyphHeight)/2}));
}
