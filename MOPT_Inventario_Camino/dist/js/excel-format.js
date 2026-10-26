// Ajustes acotados del XLS: una fuente para los datos y bordes explícitos negros.
// Se conservan los dibujos OfficeArt, las medidas y las líneas visibles.
// Referencias: Microsoft MS-XLS, registros Font, XF y Setup.
import {TABLE_FONT} from './stations.js';
export const INPUT_FONT = Object.freeze({name:'Arial',points:14,colorIndex:8,weight:700});
export const LENGTH_RANGE=Object.freeze({top:10,bottom:11,left:26,right:29}); // AA11:AD12.
const u16=(b,p)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint16(p,true);
const set16=(b,p,n)=>new DataView(b.buffer,b.byteOffset,b.byteLength).setUint16(p,n,true);
const u32=(b,p)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(p,true);
const set32=(b,p,n)=>new DataView(b.buffer,b.byteOffset,b.byteLength).setUint32(p,n,true);
const key=(row,col)=>`${row}:${col}`;
const hex=b=>Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');
const cellTypes=new Set([0x201,0x203,0x204,0x205,0x6,0xfd,0x27e]);
const sides=['left','right','top','bottom'];
// El peso solo resuelve dos estilos que ya compartían el mismo borde.
const weights=[0,1,2,1,1,3,3,0.5,2,1,2,2,2,2];
const range=(top,bottom,left,right)=>({top,bottom,left,right});
// Cada recuadro editable es una sola celda. D:I conserva su cuadrícula gráfica.
const mergeAreas=[[
  range(0,0,26,29),range(7,7,15,29),range(8,8,15,29),LENGTH_RANGE,
  range(17,17,6,19),range(20,22,17,30),
  ...Array.from({length:26},(_,i)=>[range(i+23,i+23,0,2),range(i+23,i+23,9,10),
    range(i+23,i+23,11,12),range(i+23,i+23,13,14),range(i+23,i+23,15,16),
    range(i+23,i+23,17,30)]).flat()
],Array.from({length:8},(_,i)=>range(i+34,i+34,1,29))];
const inside=(a,b)=>a.top>=b.top&&a.bottom<=b.bottom&&a.left>=b.left&&a.right<=b.right;
const overlaps=(a,b)=>a.top<=b.bottom&&a.bottom>=b.top&&a.left<=b.right&&a.right>=b.left;
const equal=(a,b)=>inside(a,b)&&inside(b,a);
function normalizeMerges(existing,areas) {
  let result=[...existing];
  for(const area of areas) {
    if(result.some(r=>equal(r,area)))continue;
    result=result.filter(r=>{
      if(!overlaps(r,area))return true;
      if(!inside(r,area))throw new Error('Una combinación cruza dos recuadros distintos de la plantilla.');
      return false;
    });
    result.push(area);
  }
  return result;
}
function readMerges(data) {
  return Array.from({length:u16(data,0)},(_,i)=>{
    const p=2+i*8;return range(u16(data,p),u16(data,p+2),u16(data,p+4),u16(data,p+6));
  });
}
function writeMerges(ranges) {
  const data=new Uint8Array(2+8*ranges.length);set16(data,0,ranges.length);
  ranges.forEach((r,i)=>[r.top,r.bottom,r.left,r.right].forEach((v,k)=>set16(data,2+8*i+2*k,v)));
  return data;
}

export function prepareExcelFormatting(records,inputAddresses,tableEntries=[]) {
  const fonts=records.filter(r=>r.type===0x31), styles=records.filter(r=>r.type===0xe0);
  if(!fonts.length||!styles.length)throw new Error('Faltan los estilos de la plantilla Excel.');
  const inputFont=fonts[0].data.slice();
  set16(inputFont,0,INPUT_FONT.points*20);set16(inputFont,2,0);
  set16(inputFont,4,INPUT_FONT.colorIndex);set16(inputFont,6,INPUT_FONT.weight);
  set16(inputFont,8,0);inputFont[10]=0;
  const tableFont=inputFont.slice();set16(tableFont,0,TABLE_FONT.points*20);set16(tableFont,6,TABLE_FONT.weight);
  // BIFF8 reserva el índice de fuente 4: el quinto registro tiene índice 5.
  const fontIndex=fonts.length+(fonts.length>=4?1:0);
  // Los formatos con unidad conservan el valor numérico editable en Excel.
  const oldFormats=records.filter(r=>r.type===0x41e), formats=[], formatIds=new Map();
  const occupied=new Set(oldFormats.map(r=>u16(r.data,0)));
  const numberFormat=code=>{
    if(formatIds.has(code))return formatIds.get(code);
    let index=164;while(occupied.has(index))index++;
    if(index>382)throw new Error('No queda un formato numérico disponible en la plantilla.');
    occupied.add(index);formatIds.set(code,index);
    const b=new Uint8Array(5+code.length*2);set16(b,0,index);set16(b,2,code.length);b[4]=1;
    for(let i=0;i<code.length;i++)set16(b,5+2*i,code.charCodeAt(i));
    formats.push(b);return index;
  };
  const measureFormat=numberFormat('0.###" m"');
  const tableFormats=new Map(tableEntries.filter(e=>e.format).map(e=>{
    const [,letters,row]=/^([A-Z]+)(\d+)$/.exec(e.address);
    const col=[...letters].reduce((n,c)=>26*n+c.charCodeAt(0)-64,0)-1;
    return [key(Number(row)-1,col),numberFormat(e.format)];
  }));
  const sheets=[], inputCells=new Set(inputAddresses.map(address=>{
    const [,letters,row]=/^([A-Z]+)(\d+)$/.exec(address);
    const col=[...letters].reduce((n,c)=>26*n+c.charCodeAt(0)-64,0)-1;
    return key(Number(row)-1,col);
  }));
  let sheet=-1;
  for(const r of records) {
    if(r.type===0x809&&u16(r.data,2)===0x10){sheet++;sheets[sheet]={cells:new Map(),merged:new Map(),ranges:[],copies:new Map(),cleared:new Set()};}
    if(sheet<0||sheet>1)continue;
    const target=sheets[sheet],b=r.data;
    if(cellTypes.has(r.type))target.cells.set(key(u16(b,0),u16(b,2)),{row:u16(b,0),col:u16(b,2),xf:u16(b,4),record:r});
    if(r.type===0xbe||r.type===0xbd) {
      const row=u16(b,0),first=u16(b,2),last=u16(b,b.length-2),stride=r.type===0xbe?2:6;
      for(let col=first;col<=last;col++)target.cells.set(key(row,col),{row,col,xf:u16(b,4+(col-first)*stride)});
    }
    if(r.type===0xe5)target.ranges.push(...readMerges(b));
  }
  for(let s=0;s<2;s++) {
    const target=sheets[s];target.ranges=normalizeMerges(target.ranges,mergeAreas[s]);
    for(const area of target.ranges)for(let row=area.top;row<=area.bottom;row++)for(let col=area.left;col<=area.right;col++)target.merged.set(key(row,col),area);
    for(const area of mergeAreas[s]) {
      const content=[...target.cells.values()].filter(cell=>inside(range(cell.row,cell.row,cell.col,cell.col),area)&&cell.record&&cell.record.type!==0x201);
      if(content.length>1)throw new Error('No se puede combinar un recuadro que ya contiene varios datos.');
      if(!content.length)continue;
      const cell=content[0],from=key(cell.row,cell.col),to=key(area.top,area.left);
      if(from===to)continue;
      // La etiqueta de observaciones pasa al ancla de su recuadro, sin perderla.
      target.copies.set(to,cell.record);target.cleared.add(from);
      const anchor=target.cells.get(to);
      if(!anchor)throw new Error('Falta el ancla de una casilla en la plantilla.');
      anchor.contentXf=cell.xf;
    }
  }
  // Los blancos de una entrada combinada usan la misma fuente que su dato.
  for(const [cell,range]of sheets[0].merged)if(inputCells.has(key(range.top,range.left)))inputCells.add(cell);

  const additions=[],cache=new Map(styles.map((r,i)=>[hex(r.data),i]));
  for(let s=0;s<Math.min(2,sheets.length);s++) {
    const target=sheets[s],edges=new Map();
    function edgeKey(cell,side) {
      const {row,col}=cell,merge=target.merged.get(key(row,col));
      if(merge&&((side==='left'&&col>merge.left)||(side==='right'&&col<merge.right)||
         (side==='top'&&row>merge.top)||(side==='bottom'&&row<merge.bottom)))return null;
      return side==='left'?`v:${row}:${col}`:side==='right'?`v:${row}:${col+1}`:
        side==='top'?`h:${row}:${col}`:`h:${row+1}:${col}`;
    }
    // Se obtiene la unión original de bordes visibles, sin añadir una cuadrícula.
    for(const cell of target.cells.values()) {
      if(cell.col>=31)continue;
      const xf=styles[cell.xf].data,borders=u16(xf,10);
      for(let i=0;i<4;i++) {
        const style=(borders>>>(4*i))&15,edge=edgeKey(cell,sides[i]);
        if(!style||!edge)continue;
        const current=edges.get(edge);
        if(!current||(weights[style]??1)>(weights[current]??1))edges.set(edge,style);
      }
    }
    for(const [position,cell]of target.cells) {
      if(cell.col>=31)continue;
      const xf=styles[cell.contentXf??cell.xf].data.slice();
      let borders=u16(xf,10),colors=u16(xf,12),more=u32(xf,14),hasBorder=false;
      for(let i=0;i<4;i++) {
        const edge=edgeKey(cell,sides[i]);
        if(!edge)continue;
        // Se guarda el mismo borde a ambos lados. Excel no depende del blanco
        // vecino ni de un color automático al componer la impresión.
        const style=edges.get(edge)||0;
        borders=(borders&~(15<<(4*i)))|(style<<(4*i));
        if(!style)continue;
        hasBorder=true;
        if(i<2)colors=(colors&~(127<<(7*i)))|(8<<(7*i));
        else more=(more&~(127<<(7*(i-2))))|(8<<(7*(i-2)));
      }
      set16(xf,10,borders);set16(xf,12,colors);set32(xf,14,more);
      if(hasBorder)xf[9]|=0x20; // fAtrBdr: el borde está definido en esta celda.
      if(s===0&&inputCells.has(position)) {
        set16(xf,0,fontIndex);xf[9]|=0x08; // fAtrFnt: fuente explícita.
        xf[8]&=~0x10; // No reducir automáticamente la letra para encajarla.
      }
      if(s===0&&position===key(7,9)) {
        xf[6]=(xf[6]&~0x77)|0x12;xf[9]|=0x10; // N/C centrada horizontal y verticalmente en J8.
      }
      if(s===0&&position===key(17,6)) {
        xf[6]=(xf[6]&~7)|2;xf[9]|=0x10; // Descripción del cantón centrada, igual que la provincia.
      }
      if(s===0&&position===key(LENGTH_RANGE.top,LENGTH_RANGE.left)) {
        set16(xf,2,0);xf[9]|=0x14; // Valor numérico general y alineación explícita.
        xf[6]=(xf[6]&~0x77)|0x12; // Centro horizontal y vertical, sin cambiar la caja.
      }
      if(s===0&&cell.row>=23&&cell.row<=48&&(cell.col<=2||cell.col>=9)) {
        set16(xf,0,fontIndex+1);xf[9]|=0x1c;xf[8]&=~0x10;
        const freeText=cell.col>=15;
        xf[6]=(xf[6]&~0x7f)|(freeText?0x19:0x12); // Texto a la izquierda, cifras al centro, ambos en medio.
        const anchor=target.merged.get(position),anchorKey=anchor?key(anchor.top,anchor.left):position;
        const measure=cell.col>=9&&cell.col<=12;
        set16(xf,2,measure?(tableFormats.get(anchorKey)??measureFormat):0);
      }
      if(s===1&&cell.row>=34&&cell.row<=41&&cell.col>=1&&cell.col<=29) {
        set16(xf,0,fontIndex+1);set16(xf,2,0);xf[9]|=0x1c;xf[8]&=~0x10;
        xf[6]=(xf[6]&~0x7f)|0x11; // Arial 12 negro; izquierda y centro vertical, un renglón por celda.
      }
      const signature=hex(xf);
      if(!cache.has(signature)){
        // La copia no tiene un registro XFExt: su fuente y bordes son explícitos.
        set32(xf,14,u32(xf,14)&~0x02000000);
        const normalized=hex(xf);
        if(!cache.has(normalized)){cache.set(normalized,styles.length+additions.length);additions.push(xf);}
        cache.set(signature,cache.get(normalized));
      }
      cell.formattedXf=cache.get(signature);
    }
  }
  return {
    lastFont:fonts.at(-1),lastStyle:styles.at(-1),lastFormat:oldFormats.at(-1),
    fonts:[inputFont,tableFont],formats,styles:additions,
    cellStyle(sheet,row,col,old){return sheets[sheet]?.cells.get(key(row,col))?.formattedXf??old;},
    copiedCell(sheet,row,col){return sheets[sheet]?.copies.get(key(row,col));},
    movedFrom(sheet,row,col){return sheets[sheet]?.cleared.has(key(row,col))??false;},
    hasCopies(sheet,row,first,last){return Array.from({length:last-first+1},(_,i)=>sheets[sheet]?.copies.has(key(row,first+i))).some(Boolean);},
    mergedCells(sheet){return writeMerges(sheets[sheet].ranges);},
    checksum(input) {
      const data=input.slice();set16(data,14,styles.length+additions.length);
      set32(data,16,msoStyleChecksum([...styles.map(r=>r.data),...additions]));return data;
    }
  };
}

function msoStyleChecksum(styles) {
  // MS-OSHARED 2.4.3: CRC de orden alto, polinomio 0xAF e inicio cero.
  let crc=0;
  for(const style of styles)for(const byte of style) {
    crc^=byte<<24;
    for(let bit=0;bit<8;bit++)crc=(crc<<1)^((crc>>>31)?0xaf:0);
  }
  return crc>>>0;
}

export function excelPrintSetup(input) {
  const b=input.slice();
  // Se conservan Carta, orientación, escala, márgenes y una página por cara.
  set16(b,10,u16(b,10)&~0x14); // Sin borrador ni resolución indefinida; conserva la política de color.
  set16(b,12,600);set16(b,14,600);
  return b;
}
