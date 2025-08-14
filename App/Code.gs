/**
 * Fuel & Train Sheets Backend
 * Tabs expected:
 *  - Food Log: id,date,time,item,calories,protein,carbs,fat,notes
 *  - Activity Log: id,date,type,durationMin,intensity,deviceCalories,avgHR,rpe,notes
 *  - Meal Plans: id,name,servings,calories,protein,carbs,fat,items
 *  - Daily Summary: date,caloriesEaten,protein,carbs,fat,activeKcals,tdee,targetIntake,remaining
 *  - Settings: key,value
 *
 * Deploy: Publish > Deploy as web app > Execute as Me, Who has access: Anyone with the link.
 * Copy the Web app URL into the app Settings.
 */
function doPost(e){
  var data = JSON.parse(e.postData.contents);
  var action = data.action;
  var payload = data.payload || {};
  var result = {};
  if(action === 'bootstrap'){
    result.foods = readRows_('Food Log');
    result.exercises = readRows_('Activity Log');
    result.meals = readRows_('Meal Plans');
    result.settingsKV = readSettings_();
  } else if(action === 'upsert'){
    upsertRow_(payload.sheet, payload.row);
    result.ok = true;
  } else if(action === 'delete'){
    deleteById_(payload.sheet, payload.id);
    result.ok = true;
  } else if(action === 'list'){
    result.rows = readRows_(payload.sheet);
  } else if(action === 'settings.get'){
    result.settings = readSettings_();
  } else if(action === 'settings.set'){
    setSettings_(payload.kv || {}); result.ok = true;
  } else {
    result.error = 'Unknown action';
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
function doGet(e){
  return ContentService.createTextOutput(JSON.stringify({ok:true, ts: new Date().toISOString()})).setMimeType(ContentService.MimeType.JSON);
}
function ss_(){ return SpreadsheetApp.getActiveSpreadsheet(); }
function getOrCreateSheet_(name, headers){
  var ss = ss_(); var sh = ss.getSheetByName(name);
  if(!sh){ sh = ss.insertSheet(name); }
  var h = sh.getRange(1,1,1,sh.getMaxColumns()).getValues()[0].filter(String);
  if(headers && h.length === 0){ sh.getRange(1,1,1,headers.length).setValues([headers]); }
  return sh;
}
function ensureHeaders_(name, headers){
  var sh = getOrCreateSheet_(name, headers);
  var existing = sh.getRange(1,1,1,sh.getMaxColumns()).getValues()[0].filter(String);
  if(headers && existing.length < headers.length){
    sh.getRange(1,existing.length+1,1,headers.length-existing.length).setValues([headers.slice(existing.length)]);
  }
  return sh;
}
function readRows_(name){
  var headersMap = {
    'Food Log': ['id','date','time','item','calories','protein','carbs','fat','notes'],
    'Activity Log': ['id','date','type','durationMin','intensity','deviceCalories','avgHR','rpe','notes'],
    'Meal Plans': ['id','name','servings','calories','protein','carbs','fat','items']
  };
  var headers = headersMap[name] || null;
  var sh = ensureHeaders_(name, headers);
  var lastRow = sh.getLastRow();
  if(lastRow < 2) return [];
  var lastCol = sh.getLastColumn();
  var data = sh.getRange(1,1,lastRow,lastCol).getValues();
  var head = data[0];
  var rows = [];
  for(var i=1;i<data.length;i++){
    var row = data[i];
    if(row.filter(String).length===0) continue;
    var obj = {};
    for(var j=0;j<head.length;j++){ obj[head[j]] = row[j]; }
    rows.push(obj);
  }
  return rows;
}
function upsertRow_(name, row){
  var rows = readRows_(name);
  var headers = Object.keys(rows[0] || row);
  var sh = ensureHeaders_(name, headers);
  var head = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var idIndex = head.indexOf('id');
  if(idIndex < 0){ head.push('id'); sh.getRange(1,1,1,head.length).setValues([head]); idIndex = head.indexOf('id'); }
  var idCol = idIndex+1;
  var lastRow = sh.getLastRow();
  var idMap = {};
  if(lastRow >= 2){
    var ids = sh.getRange(2,idCol,lastRow-1,1).getValues().flat();
    ids.forEach(function(v, idx){ idMap[String(v)] = idx + 2; });
  }
  var rowArr = new Array(head.length).fill('');
  for(var k in row){ var idx = head.indexOf(k); if(idx >= 0) rowArr[idx] = row[k]; }
  var targetRow = idMap[String(row.id)];
  if(targetRow){ sh.getRange(targetRow,1,1,head.length).setValues([rowArr]); }
  else { sh.appendRow(rowArr); }
}
function deleteById_(name, id){
  var sh = getOrCreateSheet_(name);
  var head = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var idIdx = head.indexOf('id'); if(idIdx < 0) return;
  var lastRow = sh.getLastRow(); if(lastRow < 2) return;
  var ids = sh.getRange(2,idIdx+1,lastRow-1,1).getValues();
  for(var i=0;i<ids.length;i++){ if(String(ids[i][0]) === String(id)){ sh.deleteRow(i+2); return; } }
}
function readSettings_(){
  var sh = ensureHeaders_('Settings', ['key','value']);
  var last = sh.getLastRow();
  var kv = {}; if(last<2) return kv;
  var data = sh.getRange(2,1,last-1,2).getValues();
  data.forEach(function(r){ kv[String(r[0])] = r[1]; });
  return kv;
}
function setSettings_(kv){
  var sh = ensureHeaders_('Settings', ['key','value']);
  var existing = readSettings_();
  for(var k in kv){ existing[k] = kv[k]; }
  var rows = Object.keys(existing).map(function(k){ return [k, existing[k]]; });
  if(rows.length){
    sh.getRange(2,1,sh.getLastRow(),2).clearContent();
    sh.getRange(2,1,rows.length,2).setValues(rows);
  }
}
