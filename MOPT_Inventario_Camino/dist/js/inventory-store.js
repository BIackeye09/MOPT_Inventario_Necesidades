// Cada inventario ocupa su propio registro local. Guardar el activo no vuelve
// a serializar los croquis de todos los trabajos anteriores.
import {STORAGE_KEY,fromBackup,toBackup,createInventory} from './model.js';
import {createId} from './ids.js';

export const COLLECTION_KEY=`${STORAGE_KEY}.collection`;
const recordKey=id=>`${COLLECTION_KEY}.${encodeURIComponent(id)}`;
const validId=id=>typeof id==='string'&&id.length>0&&id.length<=120;
const emptyIndex=()=>({version:1,activeId:null,entries:[]});
export const hasPendingStation=sheet=>Boolean(sheet.stationDraft&&(sheet.stationDraft.editingId||
  ['station','diameter','culvertLength','headwallNumber','headwallType','observations'].some(k=>String(sheet.stationDraft[k]??'').trim())));
export function inventoryHasData(inventory) {
  return Boolean(inventory.road||inventory.number||inventory.surface||inventory.sheets.length>1||
    inventory.sheets.some(s=>s.stations?.length||s.graphics?.free?.length||s.sketch?.strokes?.length||s.backObservations?.trim()||hasPendingStation(s)));
}
export function inventorySummary(inventory) {
  return {id:inventory.id,number:inventory.number,code:inventory.road?.code||'',
    description:[inventory.road?.from,inventory.road?.to].filter(Boolean).join(' → '),
    createdAt:inventory.createdAt,updatedAt:inventory.updatedAt,sheets:inventory.sheets.length,
    stations:inventory.sheets.reduce((n,s)=>n+(s.stations?.length||0),0),
    pending:inventory.sheets.filter(hasPendingStation).length};
}
export function editableFilename(inventory) {
  const code=(inventory.road?.code||'borrador').replace(/[^a-zA-Z0-9-]/g,'_');
  const date=(inventory.updatedAt||'').slice(0,10).replace(/[^0-9-]/g,'');
  return `Inventario_DPA301_${code}_${date||'sin-fecha'}_${inventory.id.slice(-8).replace(/[^a-zA-Z0-9]/g,'')}.mopt.json`;
}
export class InventoryRepository {
  constructor(storage,catalog){this.storage=storage;this.catalog=catalog;this.seen=new Map();}
  index(){
    const raw=this.storage.getItem(COLLECTION_KEY);if(!raw)return emptyIndex();
    let value;try{value=JSON.parse(raw);}catch{throw new Error('No se pudo leer la lista de inventarios. Sus archivos guardados se conservan.');}
    if(value?.version!==1||!Array.isArray(value.entries)||
      value.entries.some(e=>!validId(e?.id))||new Set(value.entries.map(e=>e.id)).size!==value.entries.length||
      (value.activeId!==null&&!value.entries.some(e=>e.id===value.activeId)))throw new Error('La lista de inventarios no es válida. No se ha reemplazado.');
    return value;
  }
  list(){return this.index().entries.slice().sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));}
  read(id){
    if(!validId(id))throw new Error('El inventario seleccionado no es válido.');
    const raw=this.storage.getItem(recordKey(id));if(!raw)throw new Error('No se encontró el inventario guardado.');
    const inventory=fromBackup(raw,this.catalog);
    if(inventory.id!==id)throw new Error('El archivo guardado no corresponde al inventario elegido.');
    this.seen.set(id,raw);return inventory;
  }
  current(){
    const index=this.index();
    if(index.activeId)return this.read(index.activeId);
    const legacy=this.storage.getItem(STORAGE_KEY);
    return legacy?fromBackup(legacy,this.catalog):null;
  }
  save(inventory){
    if(!validId(inventory.id))throw new Error('El inventario no tiene una identificación válida.');
    const index=this.index(),key=recordKey(inventory.id),previous=this.storage.getItem(key);
    // Una segunda ventana nunca debe sobrescribir silenciosamente otra edición.
    if(this.seen.has(inventory.id)&&previous!==this.seen.get(inventory.id))throw new Error('Este inventario cambió en otra ventana. Guardá una copia editable de tu trabajo antes de volver a abrirlo.');
    if(!this.seen.has(inventory.id)&&previous!==null)throw new Error('Ya existe otro inventario con esa identificación.');
    const raw=toBackup(inventory),summary=inventorySummary(inventory);
    const next={version:1,activeId:inventory.id,entries:[...index.entries.filter(e=>e.id!==inventory.id),summary]};
    // Si falta espacio para el índice, se restaura el registro anterior.
    // No se anuncia «Guardado» hasta que ambos pasos terminan correctamente.
    try{this.storage.setItem(key,raw);this.storage.setItem(COLLECTION_KEY,JSON.stringify(next));}
    catch(error){try{if(previous===null)this.storage.removeItem(key);else this.storage.setItem(key,previous);}catch{/* El error original se comunica al usuario. */}throw error;}
    this.seen.set(inventory.id,raw);return summary;
  }
  open(id){
    const index=this.index();if(!index.entries.some(e=>e.id===id))throw new Error('El inventario ya no está en la lista.');
    const inventory=this.read(id);this.storage.setItem(COLLECTION_KEY,JSON.stringify({...index,activeId:id}));return inventory;
  }
  create(){const inventory=createInventory();this.save(inventory);return inventory;}
  removeArchived(id,currentId){
    if(id===currentId)throw new Error('Abrí otro inventario antes de quitar este trabajo del dispositivo.');
    const index=this.index();if(!index.entries.some(entry=>entry.id===id))throw new Error('El inventario ya no está en la lista.');
    const key=recordKey(id),raw=this.storage.getItem(key),entries=index.entries.filter(entry=>entry.id!==id);
    const next={...index,entries,activeId:index.activeId===id?(entries.some(entry=>entry.id===currentId)?currentId:entries[0]?.id||null):index.activeId};
    try{this.storage.removeItem(key);this.storage.setItem(COLLECTION_KEY,JSON.stringify(next));}
    catch(error){if(raw!==null)try{this.storage.setItem(key,raw);}catch{/* Se conserva el error original. */}throw error;}
    this.seen.delete(id);
  }
  import(raw){
    const inventory=fromBackup(raw,this.catalog);inventory.id=createId();
    // Una importación es una copia independiente y tiene historiales propios.
    const activeIndex=inventory.sheets.findIndex(sheet=>sheet.id===inventory.activeSheetId);
    inventory.sheets.forEach(sheet=>{sheet.id=createId();});
    inventory.activeSheetId=inventory.sheets[Math.max(0,activeIndex)].id;inventory.updatedAt=new Date().toISOString();
    this.save(inventory);return inventory;
  }
}
