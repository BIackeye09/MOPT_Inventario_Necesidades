// Se inspecciona el archivo exportado, no los detalles internos del formateador.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readContainer,readRecords,EXCEL_CELLS} from '../dist/js/excel-template.js';
import {makeExcel,documentValues} from '../dist/js/documents.js';
import {createInventory} from '../dist/js/model.js';
const source=await readFile(new URL('../dist/templates/DPA-301-original.xls',import.meta.url));
const values={...documentValues(createInventory()),number:'NEGRO-14',type:'N',code:'4-0080-00',
  from:'Barva (Quebrada Seca)(Lte Cantonal)',to:'Birrí (Río Porrosatí)(Lte Cantonal)',surface:2,
  route:'126',lengthKm:4.98,provinceCode:'4',provinceName:'Heredia',cantonCode:'02',cantonName:'Barva'};
const exported=makeExcel(source,values);
function inspect(file) {
  const records=readRecords(readContainer(file).workbook),fonts=records.filter(r=>r.type===0x31).map(r=>Buffer.from(r.data)),
    xfs=records.filter(r=>r.type===0xe0).map(r=>Buffer.from(r.data)),sheets=[];
  let sheet;
  for(const r of records) {
    const b=Buffer.from(r.data);
    if(r.type===0x809&&b.readUInt16LE(2)===0x10){sheet={cells:new Map(),merges:[],setup:null};sheets.push(sheet);}
    if(!sheet)continue;
    if(r.type===0xe5)for(let i=0;i<b.readUInt16LE(0);i++)sheet.merges.push([0,2,4,6].map(p=>b.readUInt16LE(2+i*8+p)));
    if(r.type===0xa1)sheet.setup=b;
    if([0x201,0x203,0xfd,0x27e,0x204,0x205,0x6].includes(r.type))sheet.cells.set(`${b.readUInt16LE(0)}:${b.readUInt16LE(2)}`,{xf:b.readUInt16LE(4),type:r.type,data:b});
    if(r.type===0xbe||r.type===0xbd)for(let c=b.readUInt16LE(2);c<=b.readUInt16LE(b.length-2);c++){
      const p=4+(c-b.readUInt16LE(2))*(r.type===0xbe?2:6);
      sheet.cells.set(`${b.readUInt16LE(0)}:${c}`,{xf:b.readUInt16LE(p),type:r.type,data:b});
    }
  }
  return {records,fonts,xfs,sheets};
}
const original=inspect(source),result=inspect(exported);
const position=address=>{const[,col,row]=address.match(/([A-Z]+)(\d+)/);return `${+row-1}:${[...col].reduce((n,c)=>26*n+c.charCodeAt(0)-64,0)-1}`;};
test('todas las entradas del encabezado usan Arial 14 negrita, negro explícito y sin reducir la letra',()=>{
  for(const [name,address]of Object.entries(EXCEL_CELLS)) {
    const cell=result.sheets[0].cells.get(position(address));assert.ok(cell,name);
    const xf=result.xfs[cell.xf],fontIndex=xf.readUInt16LE(0),font=result.fonts[fontIndex>4?fontIndex-1:fontIndex];
    assert.equal(font.readUInt16LE(0),280,name);assert.equal(font.readUInt16LE(4),8,name);
    assert.equal(font.readUInt16LE(6),700,name);assert.equal(font.subarray(16).toString('utf16le'),'Arial',name);
    assert.equal(xf[8]&0x10,0,`${name}: no reducir para ajustar`);assert.equal(xf[9]&8,8,name);
  }
});
test('LONGITUD se guarda como número en una única casilla AA11:AD12, centrada en ambos ejes',()=>{
  assert.ok(result.sheets[0].merges.some(r=>r.join(':')==='10:11:26:29'));
  const cell=result.sheets[0].cells.get('10:26');assert.equal(cell.type,0x203);assert.equal(cell.data.readDoubleLE(6),4.98);
  assert.equal(result.xfs[cell.xf][6]&0x77,0x12);
  assert.ok([0x201,0xbe].includes(result.sheets[0].cells.get('11:27').type),'AB12 permanece vacío');
});
test('cada campo de descripción, casilla de tabla y renglón de observaciones es una sola celda',()=>{
  const has=(sheet,expected)=>assert.ok(result.sheets[sheet].merges.some(r=>r.join(':')===expected.join(':')),`${sheet}:${expected}`);
  for(const r of [[0,0,26,29],[7,7,15,29],[8,8,15,29],[17,17,6,19],[20,22,17,30]])has(0,r);
  for(let row=23;row<=48;row++)for(const [left,right]of [[0,2],[9,10],[11,12],[13,14],[15,16],[17,30]])has(0,[row,row,left,right]);
  for(let row=34;row<=41;row++)has(1,[row,row,1,29]);
  for(const sheet of result.sheets)for(let i=0;i<sheet.merges.length;i++)for(const b of sheet.merges.slice(i+1)){
    const a=sheet.merges[i];assert.ok(a[1]<b[0]||b[1]<a[0]||a[3]<b[2]||b[3]<a[2],`Combinaciones superpuestas ${a} / ${b}`);
  }
});
test('la representación gráfica conserva su cuadrícula y todos los textos originales siguen presentes',()=>{
  const graphic=merges=>merges.filter(([a,b,c,d])=>a<=48&&b>=20&&c<=8&&d>=3);
  assert.deepEqual(graphic(result.sheets[0].merges),graphic(original.sheets[0].merges));
  const oldUnique=Buffer.from(original.records.find(r=>r.type===0xfc).data).readUInt32LE(4);
  for(let s=0;s<2;s++) {
    const ids=sheet=>[...sheet.cells.values()].filter(c=>c.type===0xfd&&c.data.readUInt32LE(6)<oldUnique).map(c=>c.data.readUInt32LE(6)).sort((a,b)=>a-b);
    assert.deepEqual(ids(result.sheets[s]),ids(original.sheets[s]),`Textos cara ${s+1}`);
  }
  const label=original.sheets[0].cells.get('21:17').data.readUInt32LE(6);
  assert.equal(result.sheets[0].cells.get('20:17').data.readUInt32LE(6),label,'Etiqueta de observaciones en el ancla combinada');
  assert.ok([0x201,0xbe].includes(result.sheets[0].cells.get('21:17').type),'La etiqueta no queda duplicada u oculta');
});

// Bordes físicos por coordenada, omitiendo los lados internos de combinaciones.
function borders(book,s) {
  const sheet=book.sheets[s],out=new Map();
  for(const [position,cell]of sheet.cells) {
    const [row,col]=position.split(':').map(Number);if(col>30)continue;
    const merge=sheet.merges.find(([a,b,c,d])=>a<=row&&row<=b&&c<=col&&col<=d),xf=book.xfs[cell.xf];
    for(const [i,k,inside]of [[0,`v:${row}:${col}`,merge&&col>merge[2]],[1,`v:${row}:${col+1}`,merge&&col<merge[3]],
      [2,`h:${row}:${col}`,merge&&row>merge[0]],[3,`h:${row+1}:${col}`,merge&&row<merge[1]]]) {
      const style=(xf.readUInt16LE(10)>>4*i)&15;if(!style||inside)continue;
      const color=i<2?(xf.readUInt16LE(12)>>7*i)&127:(xf.readUInt32LE(14)>>7*(i-2))&127;
      if(!out.has(k))out.set(k,[]);out.get(k).push({style,color,cell:position});
    }
  }
  return out;
}
test('se conservan todas las líneas de la plantilla y se fijan negras a ambos lados de las celdas',()=>{
  for(let s=0;s<2;s++) {
    const before=borders(original,s),after=borders(result,s);
    assert.deepEqual([...after.keys()].sort(),[...before.keys()].sort(),`Líneas página ${s+1}`);
    for(const [edge,uses]of after) {
      assert.ok(uses.every(v=>v.color===8),`${s}:${edge}: negro explícito`);
      assert.ok(uses.every(v=>before.get(edge).some(p=>p.style===v.style)),`${s}:${edge}: grosor original`);
      const [axis,r,c]=edge.split(':'),row=+r,col=+c;
      const pair=axis==='h'?[`${row-1}:${col}`,`${row}:${col}`]:[`${row}:${col-1}`,`${row}:${col}`];
      if(pair.every(p=>result.sheets[s].cells.has(p))&&!(axis==='v'&&col===31))assert.equal(uses.length,2,`${s}:${edge}: ambos lados`);
    }
  }
});
test('ambas hojas piden impresión sin borrador a 600 DPI y conservan el tamaño, escala y política de color',()=>{
  for(let s=0;s<2;s++) {
    const setup=result.sheets[s].setup,before=original.sheets[s].setup;
    assert.deepEqual(setup.subarray(0,10),before.subarray(0,10));assert.deepEqual(setup.subarray(16),before.subarray(16));
    assert.equal(setup.readUInt16LE(10)&0x14,0);assert.equal(setup.readUInt16LE(10)&8,before.readUInt16LE(10)&8);
    assert.equal(setup.readUInt16LE(12),600);assert.equal(setup.readUInt16LE(14),600);
  }
});
test('los índices de textos, hojas y extensiones de formato siguen siendo válidos al añadir estilos',()=>{
  const stream=readContainer(exported).workbook,records=result.records,sst=records.find(r=>r.type===0xfc),ext=records.find(r=>r.type===0xff);
  const data=Buffer.from(ext.data);
  for(let p=2;p+8<=data.length;p+=8)assert.equal(data.readUInt32LE(p)-data.readUInt16LE(p+4),sst.old,'Puntero SST');
  for(const r of records.filter(r=>r.type===0x85))assert.equal(Buffer.from(stream).readUInt16LE(Buffer.from(r.data).readUInt32LE(0)),0x809);
  const crc=Buffer.from(records.find(r=>r.type===0x87c).data);assert.equal(crc.readUInt16LE(14),result.xfs.length);
  const table=Array.from({length:256},(_,n)=>{let v=n<<24;for(let bit=0;bit<8;bit++)v=(v<<1)^((v&0x80000000)?0xaf:0);return v>>>0;});
  let sum=0;for(const xf of result.xfs)for(const byte of xf)sum=((sum<<8)^table[((sum>>>24)^byte)&255])>>>0;
  assert.equal(crc.readUInt32LE(16),sum);
});
test('la interfaz conserva solo vista previa y descargas y deja libre Ctrl+P',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8'),ui=await readFile(new URL('../dist/js/document-ui.js',import.meta.url),'utf8');
  assert.ok(!/data-print-pdf|Imprimir PDF|i-print/.test(html));assert.ok(!/bindPrintShortcut|openPdfForPrint/.test(ui));
});
