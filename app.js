// Area soci Circolo A.R.S. Alto Friuli — pagina statica, nessun server.
// data.enc e' pubblicato dall'app CalendarioCircoloARS (Impostazioni -> Portale web soci).
// Password soci nota solo ai soci: senza di essa data.enc resta illeggibile (AES-GCM).

// URL del Web App Google Apps Script che registra gli accessi su un Google Sheet (vedi
// apps-script/Codice.gs). Vuoto = tracciamento disattivato, il portale funziona comunque.
const URL_LOG = "https://script.google.com/macros/s/AKfycbzGUxa6lS4VI2KGOsOjIAyDo63s5tIAYkEJKefnNyMBRsYR0ri6UEWyPVFp8oPewJyv/exec";

const MESI = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto",
              "settembre","ottobre","novembre","dicembre"];

let datiPortale = null;      // { generato, eventi[], comunicazioni[] } dopo decifratura
let annoVista, meseVista;    // 1-based, mese correntemente mostrato nel mini-calendario
let passwordSessione = null; // tenuta in memoria (mai salvata) per decifrare i singoli documenti su richiesta

document.getElementById("formLogin").addEventListener("submit", onSubmitLogin);
document.getElementById("mostraPassword").addEventListener("change", e => {
  document.getElementById("password").type = e.target.checked ? "text" : "password";
});
document.getElementById("btnEsci").addEventListener("click", () => location.reload());
document.getElementById("btnMesePrec").addEventListener("click", () => spostaMese(-1));
document.getElementById("btnMeseSucc").addEventListener("click", () => spostaMese(1));
caricaNominativi();

// soci.json e' pubblicato in chiaro (nominativi radioamatoriali, per legge gia' pubblici) insieme
// a data.enc: serve per popolare la tendina prima ancora che la password venga inserita.
async function caricaNominativi() {
  const select = document.getElementById("nome");
  try {
    const risposta = await fetch("soci.json", { cache: "no-store" });
    if (!risposta.ok) throw new Error("soci.json mancante");
    const nominativi = await risposta.json();
    if (nominativi.length === 0) throw new Error("elenco vuoto");
    nominativi.forEach(n => {
      const opzione = document.createElement("option");
      opzione.value = n;
      opzione.textContent = n;
      select.appendChild(opzione);
    });
  } catch {
    select.firstElementChild.textContent = "Elenco nominativi non disponibile";
  }
}

async function onSubmitLogin(e) {
  e.preventDefault();
  const nome = document.getElementById("nome").value.trim();
  const password = document.getElementById("password").value;
  const erroreEl = document.getElementById("erroreLogin");
  const btnEntra = document.getElementById("btnEntra");
  erroreEl.hidden = true;

  // Blocca click ripetuti mentre una richiesta e' gia' in corso (rete lenta, doppio tap):
  // altrimenti piu' tentativi in parallelo si accavallano sullo stesso DOM.
  if (btnEntra.disabled) return;
  btnEntra.disabled = true;

  try {
    const risposta = await fetch("data.enc", { cache: "no-store" });
    if (!risposta.ok) throw new Error("data.enc mancante");
    const busta = await risposta.json();

    const chiave = await derivaChiave(password, base64ToBytes(busta.salt), busta.iterazioni);
    const cifratoConTag = concatBytes(base64ToBytes(busta.cifrato), base64ToBytes(busta.tag));
    const chiaro = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(busta.nonce) }, chiave, cifratoConTag);

    datiPortale = JSON.parse(new TextDecoder().decode(chiaro));
    passwordSessione = password;
    registraAccesso(nome, "ok");

    document.getElementById("login").hidden = true;
    document.getElementById("contenuto").hidden = false;

    const oggi = new Date();
    annoVista = oggi.getFullYear();
    meseVista = oggi.getMonth() + 1;
    aggiornaVista();
  } catch (err) {
    console.error("Login portale fallito:", err);
    registraAccesso(nome, "errore");
    erroreEl.textContent = "Password errata, o dati del portale non ancora pubblicati.";
    erroreEl.hidden = false;
  } finally {
    btnEntra.disabled = false;
  }
}

function registraAccesso(nome, esito) {
  if (!URL_LOG) return;
  // Fire-and-forget: un log non riuscito (rete assente, ecc.) non deve mai bloccare l'accesso.
  fetch(URL_LOG, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ nome, esito })
  }).catch(() => {});
}

async function derivaChiave(password, salt, iterazioni) {
  const materiale = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: iterazioni, hash: "SHA-256" },
    materiale, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
}

function base64ToBytes(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

function concatBytes(a, b) {
  const risultato = new Uint8Array(a.length + b.length);
  risultato.set(a, 0);
  risultato.set(b, a.length);
  return risultato;
}

function spostaMese(delta) {
  meseVista += delta;
  if (meseVista < 1) { meseVista = 12; annoVista--; }
  if (meseVista > 12) { meseVista = 1; annoVista++; }
  aggiornaVista();
}

function aggiornaVista() {
  disegnaCalendario();
  disegnaListaEventi();
  disegnaComunicazioni();
}

// Stesso algoritmo di HomeViewModel.Carica lato app WPF: griglia di 6 settimane (42 celle),
// lunedi' come primo giorno, un evento compare su ogni giorno del suo intervallo DataInizio..DataFine.
function disegnaCalendario() {
  document.getElementById("testoMeseAnno").textContent = `${MESI[meseVista - 1]} ${annoVista}`;

  const primoGiorno = new Date(annoVista, meseVista - 1, 1);
  const giorniPrimaDelMese = (primoGiorno.getDay() + 6) % 7; // Domenica=0 in JS, come DayOfWeek in C#
  const primoLunediGriglia = new Date(primoGiorno);
  primoLunediGriglia.setDate(primoLunediGriglia.getDate() - giorniPrimaDelMese);

  const eventiMese = (datiPortale.eventi || []).filter(ev => {
    const fine = new Date(ev.dataFine + "T00:00:00");
    const inizio = new Date(ev.dataInizio + "T00:00:00");
    const ultimoGiornoMese = new Date(annoVista, meseVista, 0);
    return inizio <= ultimoGiornoMese && fine >= primoGiorno;
  });

  const griglia = document.getElementById("grigliaGiorni");
  griglia.innerHTML = "";
  for (let i = 0; i < 42; i++) {
    const data = new Date(primoLunediGriglia);
    data.setDate(data.getDate() + i);
    const inMeseCorrente = data.getMonth() === meseVista - 1 && data.getFullYear() === annoVista;

    const eventiGiorno = eventiMese.filter(ev => {
      const inizio = new Date(ev.dataInizio + "T00:00:00");
      const fine = new Date(ev.dataFine + "T00:00:00");
      return inizio <= data && fine >= data;
    });

    const cella = document.createElement("div");
    cella.className = "cella-giorno" + (inMeseCorrente ? "" : " fuori-mese");
    const numero = document.createElement("div");
    numero.className = "numero-giorno";
    numero.textContent = data.getDate();
    cella.appendChild(numero);

    eventiGiorno.forEach(ev => {
      const chip = document.createElement("div");
      chip.className = "chip-evento";
      chip.style.background = ev.colore || "#DAECF8";
      chip.title = ev.titolo;
      chip.textContent = ev.titolo;
      cella.appendChild(chip);
    });

    griglia.appendChild(cella);
  }
}

// Stessi due bucket (prossimo mese / prossimi 3 mesi) di HomeViewModel, calcolati da oggi
// (non dal mese mostrato nel mini-calendario, che si puo' navigare avanti/indietro a parte).
function disegnaListaEventi() {
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const unMese = new Date(oggi); unMese.setMonth(unMese.getMonth() + 1);
  const treMesi = new Date(oggi); treMesi.setMonth(treMesi.getMonth() + 3);

  const eventi = (datiPortale.eventi || []).map(ev => ({
    ...ev, inizio: new Date(ev.dataInizio + "T00:00:00"), fine: new Date(ev.dataFine + "T00:00:00")
  })).sort((a, b) => a.inizio - b.inizio);

  const prossimoMese = eventi.filter(ev => ev.inizio >= oggi && ev.inizio <= unMese);
  const prossimi3Mesi = eventi.filter(ev => ev.inizio > unMese && ev.inizio <= treMesi);

  renderListaEventi("listaEventiProssimoMese", prossimoMese);
  renderListaEventi("listaEventiProssimi3Mesi", prossimi3Mesi);
}

function renderListaEventi(idContenitore, eventi) {
  const contenitore = document.getElementById(idContenitore);
  contenitore.innerHTML = "";
  if (eventi.length === 0) {
    contenitore.innerHTML = '<p class="vuoto">Nessun evento.</p>';
    return;
  }
  eventi.forEach(ev => {
    const periodo = ev.dataInizio === ev.dataFine
      ? formattaData(ev.dataInizio)
      : `${formattaData(ev.dataInizio)} – ${formattaData(ev.dataFine)}`;
    const scheda = document.createElement("div");
    scheda.className = "scheda-evento";
    scheda.style.borderLeft = `4px solid ${ev.colore || "#DAECF8"}`;
    scheda.innerHTML = `<div class="titolo">${escapeHtml(periodo)} — ${escapeHtml(ev.titolo)}</div>
                         <div class="dettaglio">${escapeHtml(ev.tipo || "")}</div>`;
    contenitore.appendChild(scheda);
  });
}

function disegnaComunicazioni() {
  const contenitore = document.getElementById("listaComunicazioni");
  contenitore.innerHTML = "";
  const comunicazioni = datiPortale.comunicazioni || [];
  if (comunicazioni.length === 0) {
    contenitore.innerHTML = '<p class="vuoto">Nessuna comunicazione.</p>';
    return;
  }
  comunicazioni.forEach(c => {
    const scheda = document.createElement("div");
    scheda.className = "scheda-comunicazione";
    const nota = c.nota ? `<div class="nota">${escapeHtml(c.nota)}</div>` : "";
    const azione = c.fileDisponibile
      ? `<button type="button" class="btn-apri-documento">Apri</button><span class="stato-documento"></span>`
      : `<span class="stato-documento">File non più disponibile (oltre 30 giorni)</span>`;
    scheda.innerHTML = `<div class="titolo">${escapeHtml(c.nome)}</div>
                         <div class="dettaglio">${escapeHtml(c.categoria || "")} — ${formattaData(c.data)}</div>
                         ${nota}
                         ${azione}`;
    const bottone = scheda.querySelector(".btn-apri-documento");
    if (bottone) bottone.addEventListener("click", e => apriComunicazione(c, e.target));
    contenitore.appendChild(scheda);
  });
}

const MIME_PER_ESTENSIONE = { ".pdf": "application/pdf" };

// Scarica e decifra il singolo documento solo quando richiesto (non tutto insieme al login):
// stessa cifratura di data.enc, con la password gia' usata per entrare. I PDF si aprono nel
// browser (supporto nativo), gli altri formati vengono scaricati.
async function apriComunicazione(c, bottone) {
  const statoEl = bottone.nextElementSibling;
  bottone.disabled = true;
  statoEl.textContent = "Apertura...";
  try {
    const risposta = await fetch(`docs/${c.id}.enc`, { cache: "no-store" });
    if (!risposta.ok) throw new Error("documento non trovato");
    const busta = await risposta.json();

    const chiave = await derivaChiave(passwordSessione, base64ToBytes(busta.salt), busta.iterazioni);
    const cifratoConTag = concatBytes(base64ToBytes(busta.cifrato), base64ToBytes(busta.tag));
    const chiaro = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(busta.nonce) }, chiave, cifratoConTag);

    const estensione = busta.estensione || c.estensione || "";
    const tipoMime = MIME_PER_ESTENSIONE[estensione.toLowerCase()] || "application/octet-stream";
    const url = URL.createObjectURL(new Blob([chiaro], { type: tipoMime }));

    if (tipoMime === "application/pdf") {
      window.open(url, "_blank");
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = c.nome + estensione;
      link.click();
    }
    statoEl.textContent = "";
  } catch (err) {
    console.error("Apertura documento fallita:", err);
    statoEl.textContent = "Errore apertura.";
  } finally {
    bottone.disabled = false;
  }
}

function formattaData(iso) {
  const [a, m, g] = iso.split("-");
  return `${g}/${m}/${a}`;
}

function escapeHtml(testo) {
  const div = document.createElement("div");
  div.textContent = testo ?? "";
  return div.innerHTML;
}
