// Vista previa y descargas locales. Se usa el mismo PDF para ver y descargar.
import {documentValues, makePdf, makeExcel, documentFilename,makeInventoryDocuments,checkInventoryTexts} from './documents.js';
import {sheetLabel, validateHeader} from './model.js';
import {loadGraphicAssets} from './graphics-model.js';
import {loadSketchAsset} from './sketch-model.js';
import {makeZip} from './zip.js';
import {hasPendingStation} from './inventory-store.js';

const $ = id => document.getElementById(id);
function download(bytes, mime, name) {
  const url=URL.createObjectURL(new Blob([bytes],{type:mime}));
  const link=document.createElement('a'); link.href=url; link.download=name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}

export function setupDocuments({getInventory, notify}) {
  let resources, cached, pending, timer, generation=0, pdfjs;
  let busy=false;
  const load=()=>resources ||= Promise.all([
    fetch('./templates/DPA-301-original.xls').then(read),
    fetch('./templates/DPA-301-original.pdf').then(read)
  ]).catch(error=>{resources=null;throw error;});
  async function read(response) {
    if (!response.ok) throw new Error('No se pudo cargar la plantilla original. Recargá la aplicación.');
    return new Uint8Array(await response.arrayBuffer());
  }
  async function prepared() {
    // La instantánea evita mezclar una descarga con cambios posteriores del formulario.
    const inventory=structuredClone(getInventory()), values=documentValues(inventory);
    const key=JSON.stringify(values);
    if (cached?.key===key) return cached;
    if (pending?.key===key) return pending.promise;
    const promise=(async()=>{
      const [excelTemplate,pdfTemplate]=await load();
      const assets={...await loadGraphicAssets(values.graphics),...await loadSketchAsset(values.sketch)};
      const pdf=await makePdf(pdfTemplate,values,assets);
      const result={key,inventory,values,pdf,excelTemplate,assets};
      cached=result;return result;
    })();
    pending={key,promise};
    try{return await promise;}finally{if(pending?.promise===promise)pending=null;}
  }
  async function renderer() {
    if (!pdfjs) {
      pdfjs=await import('../vendor/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdf.worker.min.mjs',import.meta.url).href;
    }
    return pdfjs;
  }
  async function paint(bytes, target, pageNumbers, token) {
    const lib=await renderer();
    // PDF.js puede transferir el buffer al worker: se le entrega una COPIA.
    const task=lib.getDocument({data:bytes.slice(),useWasm:false,
      standardFontDataUrl:new URL('../vendor/standard_fonts/',import.meta.url).href});
    const pdf=await task.promise;
    try {
      const fragment=document.createDocumentFragment();
      for (const number of pageNumbers) {
        const page=await pdf.getPage(number), canvas=document.createElement('canvas');
        const label=document.createElement('p'), wrapper=document.createElement('div');
        wrapper.className='pdf-page'; label.className='pdf-page-label';
        label.textContent=number===1?'Frente':'Reverso';
        const available=Math.max(230,Math.min(target.clientWidth-24,820));
        // Más resolución para las líneas finas al consultar el documento.
        const ratio=Math.max(2,Math.min(window.devicePixelRatio||1,3));
        const viewport=page.getViewport({scale:available/612*ratio});
        canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        canvas.style.width='100%';
        canvas.setAttribute('role','img');
        canvas.setAttribute('aria-label',`Plantilla original DPA-301, ${number===1?'frente':'reverso'}`);
        await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
        wrapper.append(label,canvas);fragment.append(wrapper);
      }
      if (token===generation) target.replaceChildren(fragment);
    } finally { await pdf.destroy(); }
  }
  function status(message,error=false) {
    $('document-status').textContent=message;
    $('document-status').classList.toggle('document-error',error);
  }
  async function refreshNow() {
    const token=++generation;
    const inventory=getInventory();
    $('export-sheet-label').textContent=sheetLabel(inventory);
    try {
      // Solo se dibujan las dos caras cuando se abre la vista previa completa.
      if($('preview-dialog').open) {
        $('full-preview').setAttribute('aria-busy','true');
        const doc=await prepared();
        if(token!==generation)return;
        await paint(doc.pdf,$('full-preview'),[1,2],token);
      }
      if(token!==generation)return;
      const missing=validateHeader(inventory).length;
      status(missing?'Podés revisar y descargar este borrador mientras completás los campos.':'Documento listo para revisar y descargar.');
    } catch(error) {
      if(token===generation){
        status(error.message,true);
        const message=document.createElement('p');message.className='preview-error';
        message.textContent=error.message;$('full-preview').replaceChildren(message);
      }
    } finally {if(token===generation)$('full-preview').setAttribute('aria-busy','false');}
  }
  function refresh(){clearTimeout(timer);timer=setTimeout(refreshNow,300);}
  async function openPreview() {
    $('preview-dialog').showModal();
    $('full-preview').textContent='Preparando el documento…';
    clearTimeout(timer);await refreshNow();
  }
  async function exportFile(format) {
    if(busy)return;
    busy=true;
    const buttons=[...document.querySelectorAll('[data-export],[data-export-all]')];
    buttons.forEach(b=>{b.disabled=true;});
    status(format==='pdf'?'Preparando PDF…':'Preparando Excel…');
    try {
      const doc=await prepared();
      const bytes=format==='pdf'?doc.pdf:makeExcel(doc.excelTemplate,doc.values,doc.assets);
      download(bytes,format==='pdf'?'application/pdf':'application/vnd.ms-excel',documentFilename(doc.inventory,format==='pdf'?'pdf':'xls'));
      const message=`${format==='pdf'?'PDF':'Excel'} de ${sheetLabel(doc.inventory).toLowerCase()} descargado: frente y reverso.`;
      status(message);notify(message);
    } catch(error){status(error.message,true);notify(error.message);}
    finally {busy=false;buttons.forEach(b=>{b.disabled=false;});}
  }
  document.querySelectorAll('[data-export]').forEach(button=>button.addEventListener('click',()=>exportFile(button.dataset.export)));
  async function exportAll(format){
    if(busy)return;busy=true;
    const buttons=[...document.querySelectorAll('[data-export],[data-export-all]')];buttons.forEach(button=>{button.disabled=true;});
    $('document-more').open=false;
    try{
      const inventory=structuredClone(getInventory()),[excel,pdf]=await load();
      const result=await makeInventoryDocuments(excel,pdf,inventory,{format,progress:(sheet,total)=>status(`Preparando ${format==='pdf'?'PDF':'Excel'}: hoja ${sheet} de ${total}…`)});
      const code=(inventory.road?.code||'borrador').replace(/[^a-zA-Z0-9-]/g,'_');
      download(format==='pdf'?result:makeZip(result),format==='pdf'?'application/pdf':'application/zip',`Inventario_DPA301_${code}_${format==='pdf'?'completo.pdf':'todos-los-Excel.zip'}`);
      const pending=inventory.sheets.filter(hasPendingStation).length;
      const message=`${format==='pdf'?'PDF completo':'ZIP con todos los Excel'} descargado: ${inventory.sheets.length} hojas con frente y reverso.${pending?' Los formularios pendientes de agregar no se incluyen.':''}`;
      status(message);notify(message);
    }catch(error){status(error.message,true);notify(error.message);}
    finally{busy=false;buttons.forEach(button=>{button.disabled=false;});}
  }
  document.querySelectorAll('[data-export-all]').forEach(button=>button.addEventListener('click',()=>exportAll(button.dataset.exportAll)));
  $('open-preview').addEventListener('click',openPreview);
  refresh();
  return {refresh,checkTexts:async inventory=>checkInventoryTexts(inventory,(await load())[1])};
}
