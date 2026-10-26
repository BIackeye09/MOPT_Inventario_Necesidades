// randomUUID requiere un contexto seguro; el servidor local también admite HTTP.
export const createId=()=>globalThis.crypto?.randomUUID?.()||`inv-${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
