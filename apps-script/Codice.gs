// Riceve i log di accesso dal portale (index.html -> registraAccesso) e li scrive come riga
// nel foglio Google collegato a questo script. Un solo file, incollato in script.google.com
// (Estensioni -> Apps Script dal foglio, oppure script.google.com -> Nuovo progetto).
// Nessuna autenticazione: chiunque conosca l'URL puo' scrivere una riga di log (non puo' leggere
// il foglio ne' i dati del portale). Vedi README.md per i passi di distribuzione.
function doPost(e) {
  var dati = JSON.parse(e.postData.contents);
  var foglio = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  foglio.appendRow([new Date(), dati.nome || "(vuoto)", dati.esito || ""]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
