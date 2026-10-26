// Los ocho renglones existentes del reverso, sin cambiar sus medidas.
import {PDFDocument,StandardFonts} from '../vendor/pdf-lib.esm.min.js';
import {TABLE_FONT} from './stations.js';
export const BACK_OBSERVATIONS_LIMIT=2000;
export const BACK_OBSERVATIONS_FRAME=Object.freeze({left:68.921,right:568.530,
  bounds:[592.797,607.514,622.232,636.949,651.667,666.384,681.771,697.157,712.543]});
const metricDocument=await PDFDocument.create();
const font=await metricDocument.embedFont(StandardFonts.Helvetica);
const size=TABLE_FONT.points*.5925;
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
