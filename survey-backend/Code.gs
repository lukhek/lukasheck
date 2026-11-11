// Google Apps Script: an das erstellte Google Sheet binden.
// Als Web-App bereitstellen: Ausführen als Eigentümer; Zugriff: jeder.
// WICHTIG: Öffentliches Endpoint vor echtem Einsatz durch Abuse-Schutz absichern.
const SHEET_ID='1wBe04VXCxw2k1GKLWmbKFkgAoUUKNbPCJtlReUFkJhk';
const allowed={
 goal:['Mehr Energie im Alltag','Besser schlafen','Langfristig gesund bleiben','Körperliche Leistungsfähigkeit'],
 budget:['Unter 50 €','50–150 €','151–300 €','Über 300 €'],
 support:['Persönliches Coaching','Digitale Tools und Analysen','Wissenschaftlich fundierte Informationen','Aktuell keine']
};
function doPost(e){
 try{
  const data=JSON.parse(e.postData.contents);
  if(!Object.keys(allowed).every(k=>allowed[k].includes(data[k])))throw Error('Ungültige Antwort');
  if(!/^[a-f0-9-]{36}$/.test(data.submissionId))throw Error('Ungültige ID');
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
   const sh=SpreadsheetApp.openById(SHEET_ID).getSheetByName('Antworten');
   const ids=sh.getLastRow()>1?sh.getRange(2,5,sh.getLastRow()-1,1).getValues().flat():[];
   if(!ids.includes(data.submissionId))sh.appendRow([new Date(),data.goal,data.budget,data.support,data.submissionId]);
  }finally{lock.releaseLock()}
  return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
 }catch(err){return ContentService.createTextOutput(JSON.stringify({ok:false})).setMimeType(ContentService.MimeType.JSON)}
}