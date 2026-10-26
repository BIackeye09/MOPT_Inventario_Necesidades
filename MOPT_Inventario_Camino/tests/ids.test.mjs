import test from 'node:test';
import assert from 'node:assert/strict';
import {createId} from '../dist/js/ids.js';
import {createGraphic} from '../dist/js/graphics-model.js';
test('crear símbolos funciona por HTTP local sin randomUUID y genera identificadores distintos',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
  try{
    Object.defineProperty(globalThis,'crypto',{value:{},configurable:true});
    const ids=Array.from({length:100},()=>createId());assert.equal(new Set(ids).size,100);
    assert.ok(createGraphic('bacheo').id);assert.notEqual(createGraphic('bacheo').id,createGraphic('bacheo').id);
  } finally{Object.defineProperty(globalThis,'crypto',descriptor);}
});
