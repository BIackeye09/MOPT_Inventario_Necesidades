// Cada registro ocupa un renglón. El menor se coloca primero, desde abajo.
export const STATION_CAPACITY = 26;
export const TABLE_FONT = Object.freeze({name:'Arial', points:12, colorIndex:8, weight:400});
export const STATION_COLUMNS = Object.freeze({station:'A', diameter:'J', culvertLength:'L', headwallNumber:'N', headwallType:'P', observations:'R'});
export const stationFields = Object.keys(STATION_COLUMNS);
const text = value => String(value ?? '').trim();

export function parseStation(value) {
  const match = /^(\d+)(?:[.,](\d{1,3}))?$/.exec(text(value));
  if (!match) return null;
  // Se completan los metros con ceros; nunca se redondea una estación.
  const metres = Number(match[1]) * 1000 + Number((match[2] || '').padEnd(3,'0'));
  return Number.isSafeInteger(metres) ? metres : null;
}
// La lectura admite enteros antiguos; la captura nueva exige el separador decimal.
export function validStationInput(value) {
  return /^\d+[.,]\d{1,3}$/.test(text(value)) && parseStation(value)!==null;
}
export function sortStations(records=[]) {
  return records.slice().sort((a,b)=>parseStation(a.station)-parseStation(b.station));
}
export function findDuplicateStation(sheets,value,{sheetId,stationId}={}) {
  const metres=parseStation(value);if(metres===null)return null;
  for(const [index,sheet]of sheets.entries())for(const record of sheet.stations||[]) {
    if(sheet.id===sheetId&&record.id===stationId)continue;
    if(parseStation(record.station)===metres)return {sheetIndex:index,record};
  }
  return null;
}
export function duplicateStationValues(sheets=[]) {
  const seen=new Set(),duplicates=new Set();
  for(const sheet of sheets)for(const record of sheet.stations||[]) {
    const value=parseStation(record.station);if(value===null)continue;
    if(seen.has(value))duplicates.add(value);else seen.add(value);
  }
  return duplicates;
}
export function formatStation(value) {
  const metres = parseStation(value);
  return metres === null ? '' : `${Math.floor(metres / 1000)} + ${String(metres % 1000).padStart(3,'0')}`;
}
export function parseMetres(value) {
  const input = text(value).replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(input)) return null;
  const number = Number(input);
  return Number.isFinite(number) && number >= 0 && number <= Number.MAX_SAFE_INTEGER ? number : null;
}
export function formatMetres(value) {
  if (!text(value) || parseMetres(value) === null) return '';
  const [whole, fraction] = text(value).replace(',', '.').split('.');
  return `${whole.replace(/^0+(?=\d)/,'')}${fraction ? ',' + fraction : ''} m`;
}
export function metreNumberFormat(value) {
  const fraction = text(value).replace(',', '.').split('.')[1];
  return `0${fraction ? '.' + '0'.repeat(fraction.length) : ''}" m"`;
}
export function validateStation(record) {
  const errors = [];
  if (!validStationInput(record.station)) errors.push({field:'station',message:'Usá un número, una sola coma o punto y de 1 a 3 decimales. Ejemplos: 2,870; 2.864; 0,0.'});
  for (const [field,label] of [['diameter','diámetro'],['culvertLength','longitud de la alcantarilla']]) {
    if (text(record[field]) && parseMetres(record[field]) === null) errors.push({field,message:`El ${label === 'diámetro' ? 'diámetro' : 'valor de longitud de la alcantarilla'} debe ser un número de metros mayor o igual que cero.`});
  }
  if (text(record.headwallNumber) && (!/^\d+$/.test(text(record.headwallNumber)) || !Number.isSafeInteger(Number(record.headwallNumber)))) {
    errors.push({field:'headwallNumber',message:'Número de cabezales solo admite números enteros mayores o iguales que cero.'});
  }
  for (const field of ['headwallType','observations']) if (text(record[field]).length > 1000) errors.push({field,message:'El texto supera los 1000 caracteres admitidos.'});
  return errors;
}
export function cleanStation(record,{legacy=false}={}) {
  const result = Object.fromEntries(stationFields.map(field => [field,text(record[field])]));
  // Los borradores anteriores podían guardar «2». Se conserva como «2,0».
  if(legacy&&/^\d+$/.test(result.station))result.station+=',0';
  const errors = validateStation(result);
  if (errors.length) throw new Error(errors[0].message);
  return result;
}
export function restoreStations(input) {
  if (input === undefined) return []; // Compatibilidad con los respaldos anteriores.
  if (!Array.isArray(input) || input.length > STATION_CAPACITY) throw new Error('Una hoja del respaldo supera las 26 estaciones de la plantilla.');
  const result = input.map(record => ({id:text(record?.id), ...cleanStation(record || {},{legacy:true})}));
  if (result.some(r => !r.id || r.id.length > 120) || new Set(result.map(r => r.id)).size !== result.length) throw new Error('Los identificadores de las estaciones del respaldo están dañados.');
  return result;
}
export function stationRows(sheet) {
  const records = sheet?.stations || [];
  if (!Array.isArray(records) || records.length > STATION_CAPACITY) throw new Error('Cada hoja admite hasta 26 estaciones. Agregá otra hoja para continuar.');
  return sortStations(records).map((record,index) => {
    const clean = cleanStation(record,{legacy:true});
    return {index, row:49-index, station:formatStation(clean.station),
      diameter:text(clean.diameter) ? parseMetres(clean.diameter) : null,
      culvertLength:text(clean.culvertLength) ? parseMetres(clean.culvertLength) : null,
      headwallNumber:text(clean.headwallNumber) ? Number(clean.headwallNumber) : null,
      headwallType:clean.headwallType, observations:clean.observations,
      diameterText:formatMetres(clean.diameter), culvertLengthText:formatMetres(clean.culvertLength),
      diameterFormat:metreNumberFormat(clean.diameter), culvertLengthFormat:metreNumberFormat(clean.culvertLength)};
  });
}
export function stationExcelEntries(rows = []) {
  return rows.flatMap(row => stationFields.map(field => ({address:STATION_COLUMNS[field] + row.row,
    value:row[field], format:field === 'diameter' ? row.diameterFormat : field === 'culvertLength' ? row.culvertLengthFormat : undefined})));
}
