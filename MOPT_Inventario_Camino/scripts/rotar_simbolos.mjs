// Adaptador de generación/QA en Node. La aplicación usa su lienzo del navegador.
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export function rotateExamplePng(bytes,rotation,item) {
  return new Promise((resolve,reject)=>{
    const child=execFile(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',
      [fileURLToPath(new URL('./rotar_simbolos.py',import.meta.url)),JSON.stringify({rotation,width:item.width,height:item.height})],
      {encoding:'buffer',maxBuffer:8*1024*1024},(error,stdout,stderr)=>error?reject(new Error(stderr.toString()||error.message)):resolve(new Uint8Array(stdout)));
    child.stdin.end(bytes);
  });
}
