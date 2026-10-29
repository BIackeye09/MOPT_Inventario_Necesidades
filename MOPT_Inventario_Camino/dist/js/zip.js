// ZIP estándar sin compresión: los XLS ya contienen sus objetos originales.
// Se escribe en memoria, sin depender de una conexión ni de servicios externos.
const encoder=new TextEncoder();
const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export function makeZip(files){
  if(!Array.isArray(files)||files.length>65535)throw new Error('La cantidad de archivos no se puede incluir en un ZIP.');
  const seen=new Set(),records=files.map(file=>{
    if(typeof file.name!=='string'||!file.name||/[\\\x00-\x1f]/.test(file.name)||file.name.startsWith('/')||file.name.split('/').some(s=>s==='..'||s===''))throw new Error('El nombre de un archivo del ZIP no es válido.');
    const name=encoder.encode(file.name);if(name.length>65535||seen.has(file.name))throw new Error('Hay nombres de archivos repetidos o demasiado largos.');seen.add(file.name);
    const bytes=file.bytes;if(!(bytes instanceof Uint8Array))throw new Error('El archivo del ZIP no contiene bytes válidos.');
    return {name,bytes,crc:crc32(bytes)};
  });
  const size=22+records.reduce((n,r)=>n+30+46+2*r.name.length+r.bytes.length,0);
  if(size>0xffffffff)throw new Error('El inventario es demasiado grande para descargarlo en un solo ZIP.');
  const output=new Uint8Array(size),view=new DataView(output.buffer);let offset=0;
  const u16=(at,n)=>view.setUint16(at,n,true),u32=(at,n)=>view.setUint32(at,n,true);
  for(const r of records){r.offset=offset;u32(offset,0x04034b50);u16(offset+4,20);u16(offset+6,0x800);u16(offset+12,33);u32(offset+14,r.crc);u32(offset+18,r.bytes.length);u32(offset+22,r.bytes.length);u16(offset+26,r.name.length);output.set(r.name,offset+30);output.set(r.bytes,offset+30+r.name.length);offset+=30+r.name.length+r.bytes.length;}
  const directory=offset;
  for(const r of records){u32(offset,0x02014b50);u16(offset+4,20);u16(offset+6,20);u16(offset+8,0x800);u16(offset+14,33);u32(offset+16,r.crc);u32(offset+20,r.bytes.length);u32(offset+24,r.bytes.length);u16(offset+28,r.name.length);u32(offset+42,r.offset);output.set(r.name,offset+46);offset+=46+r.name.length;}
  u32(offset,0x06054b50);u16(offset+8,records.length);u16(offset+10,records.length);u32(offset+12,offset-directory);u32(offset+16,directory);
  return output;
}
