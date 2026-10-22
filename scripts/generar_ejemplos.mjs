// Genera una muestra usando exactamente las mismas funciones de la aplicación.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createInventory,selectRoad} from '../dist/js/model.js';
import {documentValues,makeExcel,makePdf} from '../dist/js/documents.js';
const root=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('dist/data/caminos.json',root),'utf8'));
const inventory={...selectRoad(createInventory(),catalog.roads.find(r=>r.code==='4-0080-00')),number:'EJEMPLO-001',surface:'2'};
const entry=(station,rest={})=>({id:`ejemplo-${station}`,station,diameter:'',culvertLength:'',headwallNumber:'',headwallType:'',observations:'',...rest});
inventory.sheets[0].stations=[
  entry('0,0',{observations:'Inicio del recorrido'}),
  entry('4,9',{diameter:'0,80',culvertLength:'6,50',headwallNumber:'2',headwallType:'Toma',observations:'Huecos 2x2 (6)'}),
  entry('12,678',{diameter:'1.25',culvertLength:'8.5',observations:'Alcantarilla con sedimentos'})
];
const values=documentValues(inventory),output=new URL('ejemplos/',root);await mkdir(output,{recursive:true});
await writeFile(new URL('ejemplo.xls',output),makeExcel(await readFile(new URL('dist/templates/DPA-301-original.xls',root)),values));
await writeFile(new URL('ejemplo.pdf',output),await makePdf(await readFile(new URL('dist/templates/DPA-301-original.pdf',root)),values));
await writeFile(new URL('ejemplo.json',output),JSON.stringify({application:'MOPT-DPA-301',backupVersion:1,inventory},null,2));
console.log('Ejemplos de Excel, PDF y respaldo generados.');
