// Relleno del XLS DPA-301, conservando sus hojas, dibujos y medidas originales.
// Los datos usan una fuente uniforme y los bordes quedan explícitos para imprimir.
// Referencia del formato: especificación pública Microsoft MS-XLS / MS-CFB.
import {prepareExcelFormatting,excelPrintSetup} from './excel-format.js';
import {stationExcelEntries} from './stations.js';
import {prepareExcelDrawing} from './excel-drawing.js';
import {backObservationLines} from './back-observations.js';
const END = 0xfffffffe;
const FREE = 0xffffffff;
const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const u16 = (b, p) => view(b).getUint16(p, true);
const u32 = (b, p) => view(b).getUint32(p, true);
const set16 = (b, p, v) => view(b).setUint16(p, v, true);
const set32 = (b, p, v) => view(b).setUint32(p, v, true);
const join = arrays => {
  const out = new Uint8Array(arrays.reduce((n, b) => n + b.length, 0));
  let offset = 0;
  for (const bytes of arrays) { out.set(bytes, offset); offset += bytes.length; }
  return out;
};
const record = (type, data) => {
  if (data.length > 8224) throw new Error('El texto supera el espacio admitido por la plantilla.');
  const out = new Uint8Array(4 + data.length);
  set16(out, 0, type); set16(out, 2, data.length); out.set(data, 4);
  return out;
};

// Estos son espacios de entrada existentes de la primera cara del formulario.
export const EXCEL_CELLS = {
  number: 'AA1', sheet: 'AA3', total: 'AD3', region: 'B8', type: 'J8', code: 'K8',
  from: 'P8', to: 'P9', surface: 'J11', route: 'Q11', lengthKm: 'AA11',
  provinceCode: 'D15', provinceName: 'G15', cantonCode: 'D18', cantonName: 'G18'
};

function coordinates(address) {
  const [, letters, row] = /^([A-Z]+)(\d+)$/.exec(address);
  const col = [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
  return [Number(row) - 1, col];
}

// Se reutilizan los sectores originales del contenedor OLE. Solo se amplía la
// cadena Workbook cuando el texto ocupa más bytes; los otros streams no cambian.
export function readContainer(input) {
  const bytes = new Uint8Array(input);
  if (u32(bytes, 0) !== 0xe011cfd0 || u32(bytes, 4) !== 0xe11ab1a1) {
    throw new Error('La plantilla Excel original no es válida.');
  }
  const sectorSize = 2 ** u16(bytes, 30);
  if (sectorSize !== 512 || u32(bytes, 72) !== 0) throw new Error('La versión de la plantilla Excel no es compatible.');
  const fatSectors = [];
  for (let p = 76; p < 512; p += 4) if (u32(bytes, p) < 0xfffffffa) fatSectors.push(u32(bytes, p));
  const fat = fatSectors.flatMap(s => Array.from({ length: sectorSize / 4 }, (_, i) => u32(bytes, (s + 1) * sectorSize + i * 4)));
  const chain = first => {
    const result = [], seen = new Set();
    for (let s = first; s < 0xfffffffa; s = fat[s]) {
      if (seen.has(s) || s >= fat.length) throw new Error('La plantilla Excel tiene una cadena de sectores inválida.');
      seen.add(s); result.push(s);
    }
    return result;
  };
  const directoryChain = chain(u32(bytes, 48));
  const read = sectors => join(sectors.map(s => bytes.slice((s + 1) * sectorSize, (s + 2) * sectorSize)));
  const directory = read(directoryChain);
  let entry = -1;
  for (let p = 0; p + 128 <= directory.length; p += 128) {
    const size = u16(directory, p + 64);
    if (!size) continue;
    const name = new TextDecoder('utf-16le').decode(directory.slice(p, p + size - 2));
    if (name === 'Workbook' && directory[p + 66] === 2) { entry = p; break; }
  }
  if (entry < 0) throw new Error('No se encontró el libro de la plantilla.');
  const sectors = chain(u32(directory, entry + 116));
  const size = u32(directory, entry + 120);
  return { bytes, sectorSize, fatSectors, fat, directoryChain, directory, entry, sectors,
    workbook: read(sectors).slice(0, size) };
}

export function readRecords(bytes) {
  const records = [];
  for (let p = 0; p + 4 <= bytes.length;) {
    const type = u16(bytes, p), length = u16(bytes, p + 2);
    if (p + length + 4 > bytes.length) throw new Error('La plantilla Excel está incompleta.');
    records.push({ type, data: bytes.slice(p + 4, p + 4 + length), old: p });
    p += length + 4;
  }
  return records;
}

export function fillExcelTemplate(input, values, assets={}) {
  const container = readContainer(input);
  const original = readRecords(container.workbook);
  const drawing=prepareExcelDrawing(original,values.graphics,assets,values.sketch);
  const tableEntries=stationExcelEntries(values.stations);
  const formatting=prepareExcelFormatting(original,Object.values(EXCEL_CELLS),tableEntries);
  const sst = original.find(r => r.type === 0xfc);
  const extended = original.find(r => r.type === 0xff);
  if (!sst || !extended) throw new Error('La plantilla Excel no coincide con DPA-301.');
  const unique = u32(sst.data, 4), bucketSize = u16(extended.data, 0);
  const pending = new Map(), texts = [], newBuckets = [], textIds = new Map();
  let addedReferences = 0;
  const entries=[...Object.entries(EXCEL_CELLS).map(([key,address])=>({address,value:values[key]})),...tableEntries,
    ...backObservationLines(values.backObservations).map(line=>({sheet:1,address:line.address,value:line.text}))];
  for (const {address,value,sheet=0} of entries) {
    if (value === '' || value === null || value === undefined) continue;
    const [row, col] = coordinates(address);
    const cell = { row, col, value, sheet, id:`${sheet}:${row}:${col}` };
    if (typeof value !== 'number') {
      const text = String(value);
      if (text.length > 1000) throw new Error(`El campo ${address} es demasiado largo para la plantilla.`);
      if (!textIds.has(text)) {
        const data = new Uint8Array(3 + text.length * 2);
        set16(data, 0, text.length); data[2] = 1;
        for (let i = 0; i < text.length; i++) set16(data, 3 + i * 2, text.charCodeAt(i));
        const index = unique + texts.length;
        textIds.set(text, index); texts.push(data);
      }
      cell.stringIndex = textIds.get(text); addedReferences++;
    } else if (!Number.isFinite(value)) throw new Error('Un valor numérico del inventario no es válido.');
    pending.set(cell.id, cell);
  }
  // SST y CONTINUE se separan entre textos completos, sin cortar caracteres.
  // Así una hoja llena de observaciones no supera el límite BIFF8 de 8224 bytes.
  const chunks=[[sst.data.slice()]];let chunkLength=sst.data.length,chunkOffset=0;
  texts.forEach((data,i)=>{
    if(chunkLength+data.length>8224){chunkOffset+=4+chunkLength;chunks.push([]);chunkLength=0;}
    if((unique+i)%bucketSize===0)newBuckets.push({relative:chunkOffset+4+chunkLength,within:4+chunkLength});
    chunks.at(-1).push(data);chunkLength+=data.length;
  });
  const shared=chunks.map(parts=>join(parts));
  set32(shared[0],0,u32(sst.data,0)+addedReferences);set32(shared[0],4,unique+texts.length);
  const extData = new Uint8Array(extended.data.length + newBuckets.length * 8);
  extData.set(extended.data);
  newBuckets.forEach(({relative,within}, i) => {
    const p = extended.data.length + i * 8;
    set32(extData, p, sst.old + relative); set16(extData, p + 4, within);
  });

  const out = [], mapping = new Map(), used = new Set();
  let offset = 0, sheet = -1;
  const push = (r, bytes) => {
    mapping.set(r.old, offset); out.push({ ...r, bytes, offset }); offset += bytes.length;
  };
  const cellRecord = (cell, xf) => {
    used.add(cell.id);
    const numeric = typeof cell.value === 'number';
    const data = new Uint8Array(numeric ? 14 : 10);
    set16(data, 0, cell.row); set16(data, 2, cell.col); set16(data, 4, xf);
    if (numeric) view(data).setFloat64(6, cell.value, true);
    else set32(data, 6, cell.stringIndex);
    return record(numeric ? 0x203 : 0xfd, data);
  };
  const blankRecord=(row,col,xf)=>{
    const data=new Uint8Array(6);set16(data,0,row);set16(data,2,col);set16(data,4,xf);return record(0x201,data);
  };
  const copiedRecord=(source,row,col,xf)=>{
    const data=source.data.slice();set16(data,0,row);set16(data,2,col);set16(data,4,xf);return record(source.type,data);
  };
  for (const r of original) {
    if (r.type === 0x809 && u16(r.data, 2) === 0x10) sheet++;
    const drawn=drawing?.replacement(r);if(drawn!==undefined){push(r,drawn);continue;}
    if(r===formatting.lastFont){push(r,join([record(r.type,r.data),...formatting.fonts.map(b=>record(0x31,b))]));continue;}
    if(r===formatting.lastFormat){push(r,join([record(r.type,r.data),...formatting.formats.map(b=>record(0x41e,b))]));continue;}
    if(r===formatting.lastStyle){push(r,join([record(r.type,r.data),...formatting.styles.map(b=>record(0xe0,b))]));continue;}
    if(r.type===0x87c){push(r,record(r.type,formatting.checksum(r.data)));continue;}
    if(sheet>=0&&r.type===0xe5){push(r,record(r.type,formatting.mergedCells(sheet)));continue;}
    if (r === sst) { push(r,join(shared.map((b,i)=>record(i?0x3c:r.type,b)))); continue; }
    if (r === extended) { push(r, record(r.type, extData)); continue; }
    // La celda mantiene sus medidas y alineación; solo recibe su estilo corregido.
    if(sheet>=0&&[0x203,0x204,0x205,0x6,0xfd,0x27e].includes(r.type)&&formatting.movedFrom(sheet,u16(r.data,0),u16(r.data,2))) {
      const row=u16(r.data,0),col=u16(r.data,2);push(r,blankRecord(row,col,formatting.cellStyle(sheet,row,col,u16(r.data,4))));continue;
    }
    if (sheet >= 0 && r.type === 0x201) {
      const row=u16(r.data,0),col=u16(r.data,2),copy=formatting.copiedCell(sheet,row,col);
      if(copy){push(r,copiedRecord(copy,row,col,formatting.cellStyle(sheet,row,col,u16(r.data,4))));continue;}
      const cell = pending.get(`${sheet}:${row}:${col}`);
      if (cell) { push(r, cellRecord(cell, formatting.cellStyle(sheet,cell.row,cell.col,u16(r.data,4)))); continue; }
    }
    if (sheet >= 0 && r.type === 0xbe) {
      const row = u16(r.data, 0), first = u16(r.data, 2), last = u16(r.data, r.data.length - 2);
      if ([...pending.values()].some(c => c.sheet === sheet && c.row === row && c.col >= first && c.col <= last)||formatting.hasCopies(sheet,row,first,last)) {
        const parts = [];
        // Dividir el registro de vacíos no modifica la apariencia de sus celdas.
        for (let col = first; col <= last; col++) {
          const oldXf = u16(r.data, 4 + (col - first) * 2),
            xf=formatting.cellStyle(sheet,row,col,oldXf),cell = pending.get(`${sheet}:${row}:${col}`),
            copy=formatting.copiedCell(sheet,row,col);
          if (cell) parts.push(cellRecord(cell, xf));
          else if(copy)parts.push(copiedRecord(copy,row,col,xf));
          else parts.push(blankRecord(row,col,xf));
        }
        push(r, join(parts)); continue;
      }
    }
    // Se conservan los registros compactos de blancos y números del resto de la hoja.
    if(sheet>=0&&[0x201,0x203,0x204,0x205,0x6,0xfd,0x27e,0xbe,0xbd].includes(r.type)) {
      const data=r.data.slice(),row=u16(data,0),first=u16(data,2);
      if(r.type===0xbe||r.type===0xbd) {
        const stride=r.type===0xbe?2:6,last=u16(data,data.length-2);
        for(let col=first;col<=last;col++){const p=4+(col-first)*stride;set16(data,p,formatting.cellStyle(sheet,row,col,u16(data,p)));}
      } else set16(data,4,formatting.cellStyle(sheet,row,first,u16(data,4)));
      push(r,record(r.type,data));continue;
    }
    if(sheet>=0&&r.type===0xa1){push(r,record(r.type,excelPrintSetup(r.data)));continue;}
    push(r, record(r.type, r.data));
  }
  if (used.size !== pending.size) throw new Error('Un espacio de entrada no se encontró en la plantilla original.');

  // Se actualizan los punteros absolutos y los bloques de filas de BIFF8.
  const oldRecords = new Map(original.map(r => [r.old, r]));
  for (const r of out) {
    const data = r.bytes.subarray(4);
    if (r.type === 0x85) set32(data, 0, mapping.get(u32(r.data, 0)));
    if(r.type===0xff) {
      // Las fuentes y los estilos añadidos desplazan la tabla de textos compartidos.
      const shift=mapping.get(sst.old)-sst.old;
      for(let p=2;p+8<=data.length;p+=8)set32(data,p,u32(data,p)+shift);
    }
    if (r.type === 0x20b) {
      for (let p = 12; p + 4 <= r.data.length; p += 4) {
        const oldPointer = u32(r.data, p);
        if (mapping.has(oldPointer)) set32(data, p, mapping.get(oldPointer));
      }
    }
    if (r.type === 0xd7 && u32(r.data, 0)) {
      const firstRow = r.old - u32(r.data, 0), rowRecord = oldRecords.get(firstRow);
      if (!rowRecord) throw new Error('El índice de filas de la plantilla no es válido.');
      set32(data, 0, r.offset - mapping.get(firstRow));
      let previousOld = firstRow + 4 + rowRecord.data.length;
      let previousNew = mapping.get(firstRow) + 4 + rowRecord.data.length;
      for (let p = 4; p < r.data.length; p += 2) {
        const oldCell = previousOld + u16(r.data, p), newCell = mapping.get(oldCell);
        if (newCell === undefined) throw new Error('No se pudo actualizar el índice de una celda.');
        set16(data, p, newCell - previousNew);
        previousOld = oldCell; previousNew = newCell;
      }
    }
  }
  return replaceWorkbook(container, join(out.map(r => r.bytes)));
}

function replaceWorkbook(c, workbook) {
  const needed = Math.ceil(workbook.length / c.sectorSize);
  const count = c.bytes.length / c.sectorSize - 1;
  const extra = Math.max(0, needed - c.sectors.length);
  // Amplía FAT cuando las imágenes necesitan sectores nuevos, sin mover otros streams.
  let moreFat=0;while(count+extra+moreFat>(c.fatSectors.length+moreFat)*128)moreFat++;
  if(c.fatSectors.length+moreFat>109)throw new Error('Las imágenes superan la capacidad del contenedor Excel.');
  const fatSectors=[...c.fatSectors,...Array.from({length:moreFat},(_,i)=>count+extra+i)];
  const fat=new Uint32Array(fatSectors.length*128);fat.fill(FREE);fat.set(c.fat);
  const bytes = new Uint8Array(c.bytes.length + (extra+moreFat) * c.sectorSize);
  bytes.set(c.bytes);
  set32(bytes,44,fatSectors.length);
  fatSectors.forEach((s,i)=>{set32(bytes,76+4*i,s);fat[s]=0xfffffffd;});
  const sectors = [...c.sectors, ...Array.from({ length: extra }, (_, i) => count + i)];
  for (let i = 0; i < sectors.length; i++) {
    const sector = sectors[i];
    const next = i + 1 < sectors.length ? sectors[i + 1] : END;
    fat[sector]=next;
    const target = (sector + 1) * c.sectorSize;
    bytes.fill(0, target, target + c.sectorSize);
    bytes.set(workbook.subarray(i * c.sectorSize, (i + 1) * c.sectorSize), target);
  }
  fatSectors.forEach((s,i)=>{for(let k=0;k<128;k++)set32(bytes,(s+1)*c.sectorSize+4*k,fat[128*i+k]);});
  const entrySector = c.directoryChain[Math.floor(c.entry / c.sectorSize)];
  const entryPosition = (entrySector + 1) * c.sectorSize + c.entry % c.sectorSize;
  set32(bytes, entryPosition + 120, workbook.length);
  return bytes;
}
