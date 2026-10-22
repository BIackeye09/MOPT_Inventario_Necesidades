// Imágenes nativas del XLS mediante OfficeArt. Conserva los dibujos originales.
// Formatos: Microsoft MS-XLS (MsoDrawing/Obj) y MS-ODRAW (BStore/BlipPNG).
import {GRAPH_FRAME,GRAPH_ROW_BOUNDS,exportGraphic} from './graphics-model.js';
import {SKETCH_KEY} from './sketch-model.js';
const view=b=>new DataView(b.buffer,b.byteOffset,b.byteLength);
const u16=(b,p)=>view(b).getUint16(p,true),u32=(b,p)=>view(b).getUint32(p,true);
const set16=(b,p,n)=>view(b).setUint16(p,n,true),set32=(b,p,n)=>view(b).setUint32(p,n,true);
const join=parts=>{const b=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let o=0;for(const p of parts){b.set(p,o);o+=p.length;}return b;};
function art(type,version,instance,data) {
  const b=new Uint8Array(8+data.length);set16(b,0,(instance<<4)|version);set16(b,2,type);set32(b,4,data.length);b.set(data,8);return b;
}
function biff(type,data) {
  const b=new Uint8Array(4+data.length);set16(b,0,type);set16(b,2,data.length);b.set(data,4);return b;
}
export function officeArtRecords(bytes,partial=false) {
  const out=[];
  function scan(start,end,parent) {
    for(let p=start;p+8<=Math.min(end,bytes.length);) {
      const vi=u16(bytes,p),length=u32(bytes,p+4),node={start:p,data:p+8,end:p+8+length,type:u16(bytes,p+2),version:vi&15,instance:vi>>>4,parent};
      if(node.end>bytes.length&&!partial)throw new Error('El dibujo OfficeArt está incompleto.');
      out.push(node);if(node.version===15)scan(node.data,node.end,node);
      p=node.end;
    }
  }
  scan(0,bytes.length,null);return out;
}

// Identificador MD4 de las imágenes de OfficeArt (RFC 1320); no se usa para seguridad.
export function imageDigest(input) {
  const length=input.length,padded=new Uint8Array(((length+9+63)>>>6)*64);padded.set(input);padded[length]=128;
  set32(padded,padded.length-8,(length*8)>>>0);set32(padded,padded.length-4,Math.floor(length/0x20000000));
  let h=[0x67452301,0xefcdab89,0x98badcfe,0x10325476];
  const rotate=(v,s)=>(v<<s)|(v>>>(32-s));
  const rounds=[{order:Array.from({length:16},(_,i)=>i),shifts:[3,7,11,19],add:0,fn:(b,c,d)=>(b&c)|(~b&d)},
    {order:[0,4,8,12,1,5,9,13,2,6,10,14,3,7,11,15],shifts:[3,5,9,13],add:0x5a827999,fn:(b,c,d)=>(b&c)|(b&d)|(c&d)},
    {order:[0,8,4,12,2,10,6,14,1,9,5,13,3,11,7,15],shifts:[3,9,11,15],add:0x6ed9eba1,fn:(b,c,d)=>b^c^d}];
  for(let p=0;p<padded.length;p+=64) {
    const x=Array.from({length:16},(_,i)=>u32(padded,p+4*i)),v=h.slice();
    for(const round of rounds)for(let i=0;i<16;i++) {
      const a=[0,3,2,1][i%4],b=(a+1)%4,c=(a+2)%4,d=(a+3)%4;
      v[a]=rotate((v[a]+round.fn(v[b],v[c],v[d])+x[round.order[i]]+round.add)|0,round.shifts[i%4]);
    }
    h=h.map((n,i)=>(n+v[i])>>>0);
  }
  const result=new Uint8Array(16);h.forEach((n,i)=>set32(result,4*i,n));return result;
}
function imageStore(png,references) {
  if(!(png instanceof Uint8Array)||png.length<24||u32(png,0)!==0x474e5089)throw new Error('No se pudo cargar la imagen original de un símbolo.');
  const uid=imageDigest(png),blip=art(0xf01e,0,0x6e0,join([uid,new Uint8Array([255]),png]));
  const b=new Uint8Array(36);b[0]=6;b[1]=6;b.set(uid,2);set16(b,18,255);set32(b,20,blip.length);set32(b,24,references);
  return art(0xf007,2,6,join([b,blip]));
}
const columnBounds=[0,13.998,20.989,44.821,68.653,75.159,90.077];
const rowBounds=GRAPH_ROW_BOUNDS.map(n=>n-GRAPH_FRAME.top);
function offsetInCell(bounds,value,base,units) {
  value=Math.max(0,Math.min(value,bounds.at(-1)));
  if(value>=bounds.at(-1)-1e-8)return [base+bounds.length-1,0];
  let index=0;while(index<bounds.length-2&&value>=bounds[index+1])index++;
  const fraction=Math.round((value-bounds[index])/(bounds[index+1]-bounds[index])*units);
  return fraction===units?[base+index+1,0]:[base+index,fraction];
}
export function graphicAnchor(item) {
  const [colL,dxL]=offsetInCell(columnBounds,item.x,3,1024),[rowT,dyT]=offsetInCell(rowBounds,item.y,23,256);
  const [colR,dxR]=offsetInCell(columnBounds,item.x+item.width,3,1024),[rowB,dyB]=offsetInCell(rowBounds,item.y+item.height,23,256);
  const b=new Uint8Array(18);[0,colL,dxL,rowT,dyT,colR,dxR,rowB,dyB].forEach((n,i)=>set16(b,2*i,n));return b;
}
// El croquis ocupa A16:AF34 del reverso, bajo el título y sobre Observaciones.
export function sketchAnchor() {
  const b=new Uint8Array(18);[0,0,0,15,0,31,0,33,0].forEach((n,i)=>set16(b,2*i,n));return b;
}
function pictureShape(prototype,shapeId,blipId,item,name) {
  const nodes=officeArtRecords(prototype),parts=[];
  for(const n of nodes.filter(n=>n.parent?.start===0)) {
    let data=prototype.slice(n.data,n.end);
    if(n.type===0xf00a)set32(data,0,shapeId);
    if(n.type===0xf010)data=item.anchor||graphicAnchor(item);
    if(n.type===0xf00b) {
      const props=[],complex=[];let offset=n.instance*6;
      for(let i=0;i<n.instance;i++) {
        const id=u16(data,6*i),entry=data.slice(6*i,6*i+6);let value=u32(entry,2);
        if((id&0x3fff)===0x104)set32(entry,2,blipId);
        if(id&0x8000) {
          let bytes=data.slice(offset,offset+value);offset+=value;
          if((id&0x3fff)===0x380){bytes=new Uint8Array((name.length+1)*2);[...name].forEach((c,k)=>set16(bytes,2*k,c.charCodeAt(0)));}
          set32(entry,2,bytes.length);complex.push(bytes);
        }
        props.push(entry);
      }
      data=join([...props,...complex]);
    }
    parts.push(art(n.type,n.version,n.instance,data));
  }
  return art(0xf004,15,0,join(parts));
}

export function prepareExcelDrawing(records,placements=[],assets={},sketch) {
  if(sketch?.strokes.length&&!assets[SKETCH_KEY])throw new Error('Falta cargar el croquis para el Excel.');
  const jobs=[{index:0,items:placements.map(exportGraphic)},{index:1,items:sketch?.strokes.length?[{imageKey:SKETCH_KEY,anchor:sketchAnchor()}]:[]}].filter(job=>job.items.length);
  if(!jobs.length)return null;
  const start=records.findIndex(r=>r.type===0xeb);if(start<0)throw new Error('Falta el grupo de dibujos de la plantilla Excel.');
  let end=start;while([0xeb,0x3c].includes(records[end]?.type))end++;
  const originals=records.slice(start,end),group=join(originals.map(r=>r.data)),groupNodes=officeArtRecords(group);
  const store=groupNodes.find(n=>n.type===0xf001),cluster=groupNodes.find(n=>n.type===0xf006);
  const sheets=[];let sheet=-1;
  for(const r of records){if(r.type===0x809&&u16(r.data,2)===0x10){sheet++;sheets[sheet]=[];}if(sheet>=0)sheets[sheet].push(r);}
  const front=sheets[0];
  const first=front.find(r=>r.type===0xec),nodes=officeArtRecords(first.data,true),dg=nodes.find(n=>n.type===0xf008),spgr=nodes.find(n=>n.type===0xf003);
  const logo=nodes.find(n=>n.type===0xf004&&nodes.some(child=>child.parent===n&&child.type===0xf00a&&child.instance===75));
  if(!store||!cluster||!logo||!dg||!spgr)throw new Error('La estructura gráfica del Excel no coincide con la plantilla.');
  const prototype=first.data.slice(logo.start,logo.end),object=front[front.indexOf(first)+1];
  const usage=new Map();for(const job of jobs)for(const item of job.items)usage.set(item.imageKey,(usage.get(item.imageKey)||0)+1);
  const blipIndices=new Map(),newImages=[];let imageIndex=store.instance;
  for(const [symbolId,references]of usage){blipIndices.set(symbolId,++imageIndex);newImages.push(imageStore(assets[symbolId],references));}
  const extraImages=join(newImages),newGroup=join([group.slice(0,store.end),extraImages,group.slice(store.end)]);
  set32(newGroup,4,u32(group,4)+extraImages.length);set16(newGroup,store.start,(imageIndex<<4)|15);
  set32(newGroup,store.start+4,u32(group,store.start+4)+extraImages.length);
  const replacements=new Map();
  const objectIds=records.filter(r=>r.type===0x5d).map(r=>u16(r.data,6));let objectId=Math.max(...objectIds)+1;
  for(const job of jobs) {
    const sheetRecords=sheets[job.index],first=sheetRecords.find(r=>r.type===0xec),nodes=officeArtRecords(first.data,true);
    const dg=nodes.find(n=>n.type===0xf008),spgr=nodes.find(n=>n.type===0xf003);
    const count=job.items.length,clusterCount=u32(newGroup,cluster.data+4)-1;let clusterIndex=-1;
    for(let i=0;i<clusterCount;i++)if(u32(newGroup,cluster.data+16+8*i)===dg.instance&&u32(newGroup,cluster.data+20+8*i)+count<=1024)clusterIndex=i;
    if(clusterIndex<0)throw new Error('No queda espacio de imágenes en el dibujo de esta hoja.');
    const nextId=u32(newGroup,cluster.data+20+clusterIndex*8),firstId=(clusterIndex+1)*1024+nextId;
    set32(newGroup,cluster.data,Math.max(u32(newGroup,cluster.data),firstId+count));
    set32(newGroup,cluster.data+8,u32(newGroup,cluster.data+8)+count);
    set32(newGroup,cluster.data+20+8*clusterIndex,nextId+count);
    const newShapes=job.items.map((item,index)=>pictureShape(prototype,firstId+index,blipIndices.get(item.imageKey),item,job.index===1?'DPA301 croquis':`DPA301 símbolo ${index+1}`));
    const shapeLength=newShapes.reduce((n,b)=>n+b.length,0),firstData=first.data.slice();
    set32(firstData,4,u32(firstData,4)+shapeLength);set32(firstData,spgr.start+4,u32(firstData,spgr.start+4)+shapeLength);
    set32(firstData,dg.data,u32(firstData,dg.data)+count);set32(firstData,dg.data+4,firstId+count-1);
    replacements.set(first,biff(first.type,firstData));
    // El reverso no trae SolverContainer: se inserta al terminar sus objetos,
    // antes de Window2. Así se mantienen intactos los grupos de la simbología.
    const solver=sheetRecords.find(r=>r.type===0xec&&u16(r.data,2)===0xf005);
    let insertion=solver;
    if(!insertion){let last=sheetRecords.findLastIndex(r=>r.type===0xec)+1;while([0x5d,0x1b6,0x3c].includes(sheetRecords[last]?.type))last++;insertion=sheetRecords[last];}
    if(!insertion)throw new Error('No se encontró el cierre del dibujo de la plantilla.');
    const added=[];for(const shape of newShapes){const data=object.data.slice();set16(data,6,objectId++);added.push(biff(0xec,shape),biff(0x5d,data));}
    replacements.set(insertion,join([...added,biff(insertion.type,insertion.data)]));
  }
  const chunks=[];for(let p=0,i=0;p<newGroup.length;p+=8224,i++)chunks.push(biff(originals[i]?.type??0x3c,newGroup.slice(p,p+8224)));
  replacements.set(originals[0],join(chunks));for(const r of originals.slice(1))replacements.set(r,new Uint8Array());
  return {replacement:record=>replacements.get(record)};
}
