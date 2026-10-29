// Excel y PDF comparten los mismos datos y la numeración de la hoja seleccionada.
// El PDF conserva ambas páginas del original; solo agrega texto en sus entradas.
import { PDFDocument, StandardFonts, rgb } from '../vendor/pdf-lib.esm.min.js';
import { fillExcelTemplate } from './excel-template.js';
import { INPUT_FONT } from './excel-format.js';
import { parseKm } from './model.js';
import {TABLE_FONT, stationRows} from './stations.js';
import {GRAPH_FRAME,GRAPH_ROW_BOUNDS,graphicPlacements,exportGraphic,loadGraphicAssets} from './graphics-model.js';
import {SKETCH_FRAME,SKETCH_KEY,restoreSketch,loadSketchAsset} from './sketch-model.js';
import {backObservationLines} from './back-observations.js';

export function documentValues(inventory) {
  const road = inventory.road || {};
  const text = value => String(value ?? '').trim().replace(/[\r\n\t]+/g, ' ');
  const length = parseKm(road.lengthKm);
  const activeSheet=inventory.sheets.find(s=>s.id===inventory.activeSheetId);
  if (text(road.lengthKm) && length === null) throw new Error('Revisá la longitud: debe ser un número mayor que cero.');
  return {
    number: text(inventory.number), sheet: inventory.sheets.findIndex(s => s.id === inventory.activeSheetId) + 1,
    total: inventory.sheets.length, region: 'V', type: text(road.type), code: text(road.code),
    from: text(road.from), to: text(road.to), route: text(road.route), lengthKm: length,
    surface: inventory.surface ? Number(inventory.surface) : null,
    provinceCode: text(road.provinceCode), provinceName: text(road.provinceName),
    cantonCode: text(road.cantonCode), cantonName: text(road.cantonName),
    stations: stationRows(activeSheet),
    graphics:graphicPlacements(activeSheet),sketch:restoreSketch(activeSheet?.sketch),
    backObservations:activeSheet?.backObservations||'',backObservationLines:backObservationLines(activeSheet?.backObservations)
  };
}

// Medidas verificadas sobre una copia rellenada del XLS original, en puntos PDF.
// Arial 14 del XLS equivale a 8,295 puntos en esta página escalada de la plantilla.
// La alineación sigue sus espacios originales, sin dibujar líneas nuevas.
const inputSize=INPUT_FONT.points*0.5925;
export const PDF_FIELDS = {
  number: {x:482.6,y:764.254,size:inputSize,width:73,align:'left',bold:true},
  sheet: {x:490.055,y:737.110,size:inputSize,width:14,align:'center',bold:true},
  total: {x:548.189,y:737.110,size:inputSize,width:14,align:'center',bold:true},
  region: {x:101.460,y:675.063,size:inputSize,width:65,align:'center',bold:true},
  type: {x:195.015,y:678.307,size:inputSize,width:20,align:'center',bold:true},
  code: {x:236.799,y:678.307,size:inputSize,width:55,align:'center',bold:true},
  from: {x:303.297,y:674.561,size:inputSize,width:252,align:'left',bold:true},
  to: {x:303.297,y:658.706,size:inputSize,width:252,align:'left',bold:true},
  surface: {x:195.025,y:625.090,size:inputSize,width:25,align:'center',bold:true},
  route: {x:344.563,y:625.090,size:inputSize,width:45,align:'center',bold:true},
  lengthKm: {x:519.243,y:627.231,size:inputSize,width:72,align:'center',bold:true},
  provinceCode: {x:101.670,y:586.056,size:inputSize,width:16,align:'center',bold:true},
  provinceName: {x:260.096,y:586.056,size:inputSize,width:245,align:'center',bold:true},
  cantonCode: {x:101.673,y:546.569,size:inputSize,width:16,align:'center',bold:true},
  cantonName: {x:260.096,y:546.569,size:inputSize,width:245,align:'center',bold:true}
};
const labels = {number:'NÚMERO',code:'Código del camino',from:'DE',to:'A',route:'Ruta',
  lengthKm:'Longitud',provinceName:'Provincia',cantonName:'Cantón',sheet:'Hoja',total:'Total de hojas'};

// Límites originales medidos en el PDF, desde el borde superior de la página.
const rowBounds=GRAPH_ROW_BOUNDS;
const tableFields=[
  {key:'station',label:'Estación',left:41.711,right:91.165,align:'center'},
  {key:'diameterText',label:'Diámetro',left:181.242,right:227.452,align:'center'},
  {key:'culvertLengthText',label:'Longitud de alcantarilla',left:227.452,right:264.781,align:'center'},
  {key:'headwallNumber',label:'Número de cabezales',left:264.781,right:302.110,align:'center'},
  {key:'headwallType',label:'Tipo de cabezales',left:302.110,right:336.629,wrap:true},
  {key:'observations',label:'Observaciones',left:336.629,right:572.694,wrap:true}
];
function tableLayout(row,font) {
  const size=TABLE_FONT.points*0.5925,lineHeight=size*1.1,index=row.row-24;
  const top=rowBounds[index],height=rowBounds[index+1]-top;
  const maxLines=Math.max(1,Math.floor((height-2)/lineHeight));
  return tableFields.flatMap(field=>{
    const text=String(row[field.key]??'');if(!text)return [];
    const width=field.right-field.left-4,lines=[];
    const measure=text=>{
      try{return font.widthOfTextAtSize(text,size);}
      catch{throw new Error(`«${field.label}» de la estación ${row.station} contiene un carácter que no admite la plantilla.`);}
    };
    if(field.wrap)for(const paragraph of text.replace(/\r\n?/g,'\n').split('\n')) {
      let line='';
      for(const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
        if(measure(word)>width)throw new Error(`El texto de «${field.label}» en ${row.station} no cabe en su casilla. Acortalo para conservar la plantilla.`);
        const next=line?`${line} ${word}`:word;
        if(measure(next)>width){lines.push(line);line=word;}else line=next;
      }
      lines.push(line);
    } else lines.push(text);
    if(lines.length>maxLines||lines.some(line=>measure(line)>width))throw new Error(`El texto de «${field.label}» en ${row.station} no cabe en su casilla. Acortalo para conservar la plantilla.`);
    const glyphHeight=font.heightAtSize(size,{descender:false}),blockHeight=glyphHeight+(lines.length-1)*lineHeight;
    return lines.map((text,i)=>({text,size,x:field.align==='center'?(field.left+field.right-measure(text))/2:field.left+2,
      top:top+(height-blockHeight)/2+glyphHeight+i*lineHeight}));
  });
}
let measurementFont;
export async function checkStationForDocument(record,index) {
  measurementFont??=(async()=>{const pdf=await PDFDocument.create();return pdf.embedFont(StandardFonts.Helvetica);})();
  const row=stationRows({stations:[record]})[0];row.row=49-index;
  tableLayout(row,await measurementFont);
}

export async function makePdf(template, values, assets={}) {
  const pdf = await PDFDocument.load(template, { updateMetadata: false });
  if (pdf.getPageCount() !== 2) throw new Error('El PDF base no contiene las dos caras de la plantilla.');
  const fonts = {regular:await pdf.embedFont(StandardFonts.Helvetica),bold:await pdf.embedFont(StandardFonts.HelveticaBold)};
  const page = pdf.getPages()[0];
  for (const [key, field] of Object.entries(PDF_FIELDS)) {
    const value = values[key];
    if (value === '' || value === null || value === undefined) continue;
    const text = String(value), font = field.bold ? fonts.bold : fonts.regular;
    let width;
    try { width = font.widthOfTextAtSize(text, field.size); }
    catch { throw new Error(`El campo «${labels[key] || key}» contiene un carácter que no admite la plantilla. Usá texto normal.`); }
    if (width > field.width) {
      throw new Error(`El texto de «${labels[key] || key}» no cabe en su espacio original. Acortalo para exportar sin alterar la plantilla.`);
    }
    page.drawText(text, {x:field.align === 'center' ? field.x-width/2 : field.x,
      y:field.y,size:field.size,font,color:rgb(0,0,0)});
  }
  for(const row of values.stations||[])for(const item of tableLayout(row,fonts.regular)) {
    page.drawText(item.text,{x:item.x,y:page.getHeight()-item.top,size:item.size,font:fonts.regular,color:rgb(0,0,0)});
  }
  const pictures=new Map();
  for(const source of values.graphics||[]) {
    const item=exportGraphic(source);
    if(!assets[item.imageKey])throw new Error('Falta cargar un símbolo para el PDF.');
    if(!pictures.has(item.imageKey))pictures.set(item.imageKey,await pdf.embedPng(assets[item.imageKey]));
    page.drawImage(pictures.get(item.imageKey),{x:GRAPH_FRAME.left+item.x,
      y:page.getHeight()-GRAPH_FRAME.top-item.y-item.height,width:item.width,height:item.height});
  }
  if(values.sketch?.strokes.length) {
    if(!assets[SKETCH_KEY])throw new Error('Falta cargar el croquis para el PDF.');
    const back=pdf.getPages()[1],picture=await pdf.embedPng(assets[SKETCH_KEY]);
    back.drawImage(picture,{x:SKETCH_FRAME.left,y:back.getHeight()-SKETCH_FRAME.top-SKETCH_FRAME.height,width:SKETCH_FRAME.width,height:SKETCH_FRAME.height});
  }
  const back=pdf.getPages()[1];
  for(const item of backObservationLines(values.backObservations)) {
    back.drawText(item.text,{x:item.x,y:back.getHeight()-item.top,size:item.size,font:fonts.regular,color:rgb(0,0,0)});
  }
  return pdf.save();
}

export function makeExcel(template, values, assets={}) {
  return fillExcelTemplate(template, values, assets);
}

export function documentFilename(inventory, extension) {
  const values = documentValues(inventory);
  const code = (values.code || 'borrador').replace(/[^a-zA-Z0-9-]/g,'_');
  return `Inventario_DPA301_${code}_hoja-${values.sheet}-de-${values.total}.${extension}`;
}

// Las hojas se generan con la misma función que la descarga individual. Unir
// páginas no añade márgenes, rótulos ni cambios a la plantilla oficial.
export async function makeInventoryDocuments(excelTemplate,pdfTemplate,inventory,{format='pdf',progress=()=>{},assetsFor}={}) {
  if(!['pdf','excel'].includes(format))throw new Error('El formato del inventario no es válido.');
  const snapshot=structuredClone(inventory),files=[],combined=format==='pdf'?await PDFDocument.create():null;
  for(let i=0;i<snapshot.sheets.length;i++){
    snapshot.activeSheetId=snapshot.sheets[i].id;progress(i+1,snapshot.sheets.length);
    const values=documentValues(snapshot),assets=assetsFor?await assetsFor(values):
      {...await loadGraphicAssets(values.graphics),...await loadSketchAsset(values.sketch)};
    const pdfBytes=await makePdf(pdfTemplate,values,assets);
    if(combined){const source=await PDFDocument.load(pdfBytes,{updateMetadata:false});const pages=await combined.copyPages(source,source.getPageIndices());pages.forEach(page=>combined.addPage(page));}
    else files.push({name:documentFilename(snapshot,'xls'),bytes:makeExcel(excelTemplate,values,assets)});
    // Permite pintar el progreso y seguir respondiendo en teléfonos.
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  return combined?combined.save({useObjectStreams:false}):files;
}

export async function checkInventoryTexts(inventory,pdfTemplate) {
  const issues=[];
  for(const [index,sheet]of inventory.sheets.entries()){
    try{
      const values=documentValues({...inventory,activeSheetId:sheet.id});
      // Solo se comprueban textos: los dibujos ya se validan al recuperar y editar.
      await makePdf(pdfTemplate,{...values,graphics:[],sketch:{strokes:[]}},{});
    }catch(error){
      const tab=/observaciones del reverso|reverso|renglones/i.test(error.message)?'sketch':/estación|casilla/i.test(error.message)?'stations':'header';
      const key=Object.entries(labels).find(([,label])=>error.message.includes(`«${label}»`))?.[0];
      const headerFields={number:'inventory-number',code:'road-code',from:'road-from',to:'road-to',route:'road-route',lengthKm:'road-length',provinceName:'road-province',cantonName:'road-canton'};
      issues.push({sheetId:sheet.id,sheetNumber:index+1,message:error.message,tab,
        ...(tab==='header'&&headerFields[key]?{field:headerFields[key]}:tab==='sketch'?{field:'back-observations'}:{})});
    }
  }
  return issues;
}
