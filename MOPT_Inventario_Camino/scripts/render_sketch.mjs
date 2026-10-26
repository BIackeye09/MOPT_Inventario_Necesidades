// Adaptador local para generar ejemplos y verificar el croquis fuera del navegador.
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {SKETCH_FRAME} from '../dist/js/sketch-model.js';
export function renderExampleSketch(sketch) {
  return new Promise((resolve,reject)=>{
    const child=execFile(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',
      [fileURLToPath(new URL('./render_sketch.py',import.meta.url))],{encoding:'buffer',maxBuffer:12*1024*1024},
      (error,stdout,stderr)=>error?reject(new Error(stderr.toString()||error.message)):resolve(new Uint8Array(stdout)));
    child.stdin.end(JSON.stringify({sketch,frame:SKETCH_FRAME}));
  });
}
