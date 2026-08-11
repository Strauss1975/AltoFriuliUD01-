# Area soci — Circolo A.R.S. Alto Friuli

Pagina statica (nessun server): `index.html` mostra calendario eventi e comunicazioni recenti,
protetti da password condivisa. I dati veri e propri sono in `data.enc`, cifrato (AES-GCM) e
illeggibile senza la password — pubblicabile quindi anche su un repository pubblico.

## Setup (una tantum)

1. **Repo GitHub**: crea un repository pubblico chiamato `AltoFriuliUD01`, carica questi file
   nella root (`index.html`, `style.css`, `app.js`, `data.enc` verra' aggiunto dall'app).
2. **GitHub Pages**: Impostazioni del repo -> Pages -> Deploy da branch `main`, cartella `/`.
   L'indirizzo sara' tipo `https://<tuo-utente>.github.io/AltoFriuliUD01/`.
3. **Tracciamento accessi** (Google Apps Script + Google Sheet, gratuito):
   - Crea un nuovo Google Sheet.
   - Estensioni -> Apps Script, incolla il contenuto di `apps-script/Codice.gs`.
   - Distribuisci -> Nuova implementazione -> tipo "App web" -> Esegui come "Me" -> Chi ha
     accesso "Chiunque" -> Distribuisci. Copia l'URL generato.
   - Incolla l'URL nella costante `URL_LOG` in cima a `app.js`, poi fai commit/push.
4. **Clone locale**: clona questo repo su questo PC in una cartella qualsiasi, poi in
   CalendarioCircoloARS -> Impostazioni -> "Portale web soci" scegli quella cartella e imposta
   la passphrase (quella che darai anche ai soci per entrare nella pagina).
5. **Prima pubblicazione**: bottone "Pubblica portale ora" in Impostazioni — genera `data.enc`
   e fa commit+push in automatico (serve `git` configurato con le tue credenziali GitHub sul PC,
   stesso git gia' usato per gli altri progetti).

## Sicurezza

- La password soci va distribuita via WhatsApp/email come gia' fatto per gli altri promemoria.
  E' condivisa (non individuale): se compromessa, cambiala in Impostazioni e ripubblica.
- Il foglio Google con i log di accesso e' privato (visibile solo al tuo account Google).
- `data.enc` e' inutile senza la password: pubblicarlo su un repo pubblico non espone i dati.
