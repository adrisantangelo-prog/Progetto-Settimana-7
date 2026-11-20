# Progetto-Settimana-7
# SportsHub

Mini-app per cercare squadre sportive (calcio, basket, football americano, rugby),
vedere prossime partite e ultimi risultati, e salvare le squadre preferite.
I dati arrivano da [TheSportsDB](https://www.thesportsdb.com), un'API REST pubblica
con chiave gratuita `123`.

Progetto della Settimana 7: classi, `fetch` con `async/await`, `Promise.all` e
`Promise.allSettled`, `localStorage`, debounce con `AbortController`, moduli ES.

## Indice

1. [Struttura dei file](#struttura-dei-file)
2. [Albero del DOM](#albero-del-dom)
3. [Architettura JavaScript](#architettura-javascript)
4. [api.js – dati](#apijs--dati)
5. [ui.js – pagina](#uijs--pagina)
6. [main.js – app](#mainjs--app)
7. [I flussi principali](#i-flussi-principali)
8. [CSS](#css)
9. [Bootstrap](#bootstrap)
10. [Endpoint e limiti dell'API](#endpoint-e-limiti-dellapi)

---

## Struttura dei file

```
Progetto-Settimana-7/
├── index.html            struttura della pagina (header, sezioni, modale)
├── README.md
└── assets/
    ├── css/
    │   └── style.css     tema scuro "stadio di sera" sopra Bootstrap 5
    └── js/
        ├── api.js        DATI: classi Squadra/Evento + fetch a TheSportsDB + cache
        ├── ui.js         PAGINA: riferimenti HTML + funzioni che disegnano
        └── main.js       APP: stato, localStorage, logica, event listener
```

---

## Albero del DOM

### La parte scritta in `index.html`

Gli elementi con `#id` sono quelli che il JavaScript usa (li trovi nell'oggetto `dom` di `ui.js`).

```
html  [lang="it", data-bs-theme="dark"]
├── head
│   ├── Google Fonts (Bebas Neue, Inter)
│   ├── bootstrap.min.css (CDN)
│   └── assets/css/style.css
│
└── body#top
    │
    ├── header.hero ─────────────────────────────── luci dello stadio + campo
    │   └── div.container
    │       ├── h1.hero-title                        "SportsHub"
    │       ├── p.hero-subtitle
    │       └── form#search-form ──────────────────── ricerca
    │           ├── div.search-box
    │           │   ├── input#search-input           [role="combobox"]
    │           │   └── ul#suggestions               menu suggerimenti (riempito da JS)
    │           └── button[type="submit"]            "Cerca"
    │
    ├── main.container
    │   │
    │   ├── section ────────────────────────────── SQUADRE TROVATE
    │   │   ├── h2#results-title
    │   │   ├── div#error-box.alert-danger           errore (nascosto con d-none)
    │   │   ├── p#results-msg                        "Inizia cercando…" / "Nessuna squadra"
    │   │   ├── div#results-grid.row                 card dei risultati (da JS)
    │   │   └── div#details                          pannello dettagli (da JS)
    │   │
    │   ├── section#preferiti ──────────────────── LE TUE SQUADRE PREFERITE
    │   │   ├── h2#fav-title
    │   │   ├── div#sport-filter.btn-group           Tutti · Calcio · Basket · Football · Rugby
    │   │   ├── p#fav-empty                          messaggio se vuoto
    │   │   └── div#fav-grid.row                     card delle preferite (da JS)
    │   │
    │   └── section#appointments-section ────────── I TUOI PROSSIMI APPUNTAMENTI
    │       ├── h2#appointments-title
    │       ├── div#appointments-warning.alert       squadre che non si sono caricate
    │       └── div#appointments.row                 card degli appuntamenti (da JS)
    │
    ├── nav.floating-nav ──────────────────────── bottoni fissi in basso a destra
    │   ├── a.floating-fav[href="#preferiti"]        ⭐ + span#fav-count
    │   └── a#back-to-top[href="#top"]               ↑ (compare dopo l'header)
    │
    ├── div#event-modal.modal ─────────────────── MODALE PARTITA (Bootstrap)
    │   └── div.modal-dialog > div.modal-content
    │       ├── div.modal-header
    │       │   ├── h2#event-modal-title
    │       │   └── button.btn-close
    │       ├── div#event-modal-body                 contenuto (da JS)
    │       └── div.modal-footer
    │           ├── button#modal-details-btn         "Tutti i dettagli della squadra"
    │           └── button                           "Chiudi"
    │
    ├── script  bootstrap.bundle.min.js              serve per la modale
    └── script[type="module"]  assets/js/main.js     unico ingresso del JavaScript
```

### Le parti create dal JavaScript

**Card squadra** (`creaCardSquadra` in `ui.js`), dentro `#results-grid` e `#fav-grid`:

```
div.col-12.col-md-6.col-lg-4.flex-grow-1      colonna della griglia Bootstrap
└── article.team-card  [data-id, data-sport]  il colore dipende da data-sport
    ├── div.team-logo-wrap > img.team-logo    logo che esce dal bordo
    ├── button.btn-star  [data-action="toggle-fav"]   ☆ / ★
    ├── h3.team-name
    ├── p.team-meta                           campionato · paese
    └── span.sport-pill                       Calcio / Basket / …
```

**Riga partita** (`creaRigaEvento`), nel pannello dettagli e nella modale:

```
button.event-row  [data-event-id]             cliccabile → modale
├── div.event-date                            23/11/2026 · 20:45
└── div.event-match
    ├── span.event-team.home                  squadra di casa
    ├── span.scoreboard                       "3 : 1" oppure "VS"
    └── span.event-team.away                  squadra in trasferta
```

**Pannello dettagli** (`creaPannelloDettagli`), dentro `#details`:

```
div.details-card
└── div.card-body
    ├── h3.details-title                      nome squadra
    ├── button.next-match                     prossima partita in evidenza + countdown
    └── div.row
        ├── div.col-md-6   "Prossimi eventi"  → righe partita
        └── div.col-md-6   "Ultimi risultati" → righe partita
```

---

## Architettura JavaScript

Il codice è diviso in tre moduli ES, ognuno con un compito preciso:

| File | Ruolo | Può… | Non può… |
| --- | --- | --- | --- |
| `api.js` | **dati** | fare `fetch`, creare `Squadra` ed `Evento` | toccare la pagina |
| `ui.js` | **pagina** | creare e mostrare elementi | fare `fetch` o leggere lo stato |
| `main.js` | **app** | usare gli altri due, tenere lo stato, ascoltare gli eventi | — |

### Chi importa chi

```
index.html
   │  <script type="module">
   ▼
main.js ──► api.js
   │
   └─────► ui.js ──► api.js (solo la costante SPORT)
```

Le frecce vanno sempre in una direzione: `api.js` non conosce la pagina,
`ui.js` non conosce lo stato. Così, se cambia l'API si tocca un solo file,
e se cambia la grafica se ne tocca un altro.

I tre file stanno nella stessa cartella, quindi gli `import` sono solo
`./api.js` e `./ui.js`. Ciò che un file non esporta (`export`) resta privato.

---

## api.js – dati

### Costanti

| Nome | A cosa serve |
| --- | --- |
| `API_BASE` | indirizzo base dell'API con la chiave `123` |
| `SPORT` *(esportata)* | per ogni sport: etichetta italiana e variabile CSS del colore (`"Soccer"` → Calcio, `--sport-soccer`) |
| `STATI` | traduzione degli stati partita (`"Match Finished"` → "Terminata") |

### Classe `Squadra`

Trasforma i dati grezzi dell'API in un oggetto con nomi chiari.
Il costruttore accetta sia i dati dell'API (`idTeam`, `strTeam`, `strBadge`…) sia
un oggetto già salvato nel localStorage (`id`, `nome`, `logo`…), grazie all'operatore `??`.

| Proprietà | Dal campo API |
| --- | --- |
| `id` | `idTeam` |
| `nome` | `strTeam` |
| `logo` | `strBadge` |
| `lega` | `strLeague` |
| `paese` | `strCountry` |
| `sport` | `strSport` |
| `sportLabel` *(getter)* | etichetta italiana presa da `SPORT` |

### Classe `Evento`

Una partita. Oltre ai dati (squadre, punteggi, stadio, città, stagione, giornata, loghi…)
ha dei metodi per **formattarsi da sola**, così il resto del codice non deve sapere
com'è fatta una data dell'API.

| Metodo | Cosa restituisce | Esempio |
| --- | --- | --- |
| `dataOra()` | un oggetto `Date` (l'orario dell'API è in UTC) | — |
| `dataFormattata()` | data breve | `23/11/2026` |
| `dataLunga()` | data estesa | `Lunedì 23 novembre 2026` |
| `oraFormattata()` | ora locale, o `""` se manca | `20:45` |
| `giorniMancanti()` | giorni alla partita (negativo se passata) | `3` |
| `countdown()` | testo relativo con `Intl.RelativeTimeFormat` | `tra 3 giorni`, `domani` |
| `haPunteggio()` | `true` se la partita ha un risultato | — |
| `punteggio()` | risultato stile tabellone | `3 : 1` |
| `statoTradotto()` | stato in italiano | `Da giocare` |
| `ordine()` | numero per ordinare le partite per data | — |

I formattatori (`Intl.DateTimeFormat`) sono proprietà `static`: si creano una volta
sola per tutta la classe, non per ogni partita.

### Funzioni

| Funzione | Esportata | Cosa fa |
| --- | --- | --- |
| `costruisciUrl(endpoint, params)` | no | costruisce l'URL con `new URL()` e `searchParams.set()` |
| `getJson(url, signal)` | no | `fetch` + controllo `response.ok`; il `signal` permette di annullare la richiesta |
| `scaricaEventi(idTeam)` | no | scarica **in parallelo** prossimi eventi e ultimi risultati con `Promise.all` |
| `cercaSquadre(query, signal)` | sì | cerca squadre per nome; restituisce un array di `Squadra` |
| `caricaEventi(idTeam)` | sì | restituisce `{ prossimi, ultimi }` (array di `Evento`) |
| `trovaEvento(idEvento)` | sì | ritrova un evento già scaricato dal suo id (serve per la modale) |
| `haRicercaInCache(query)` | sì | dice se una ricerca è già stata fatta |

### Le cache

Tre `Map` evitano di rifare le stesse richieste:

| Map | Chiave → valore | Effetto |
| --- | --- | --- |
| `cacheRicerche` | `"arsenal"` → squadre | premere Cerca dopo i suggerimenti non rifà la richiesta |
| `cacheEventi` | idTeam → Promise | le partite di ogni squadra si scaricano una volta sola |
| `eventiPerId` | idEvent → evento | un click su una partita la ritrova subito |

`cacheEventi` salva la **Promise**, non il risultato: se due parti dell'app chiedono
la stessa squadra nello stesso momento, parte una sola richiesta. Se fallisce,
viene tolta dalla cache così si può riprovare.

---

## ui.js – pagina

Tutte le funzioni creano elementi con `createElement` e `textContent`, mai `innerHTML`
(più sicuro: un testo dell'API non può diventare codice HTML).

### Elementi e helper

| Funzione | Cosa fa |
| --- | --- |
| `dom` *(oggetto)* | raccoglie tutti gli elementi HTML usati, presi una volta sola con `getElementById` |
| `el(tag, classe, testo)` | crea un elemento con classe e testo in una riga |
| `coloreSport(sport)` | restituisce la variabile CSS del colore dello sport |
| `creaSkeleton(altezza, larghezza)` | un rettangolo grigio animato per il caricamento |
| `mostraErrore(msg)` / `nascondiErrore()` | mostra o nasconde l'alert rosso |
| `mostraMessaggio(testo)` | scrive "Inizia cercando…" o "Nessuna squadra trovata" |

### Card squadra

| Funzione | Cosa fa |
| --- | --- |
| `creaCardSquadra(squadra, indice, preferita)` | crea una card completa; `indice` sfasa l'animazione di entrata, `preferita` decide ☆ o ★ |
| `renderGriglia(contenitore, squadre, isPreferita)` | svuota il contenitore e ci mette una card per squadra; `isPreferita` è una funzione passata da `main.js` |
| `creaSkeletonCards(n)` | n card finte grigie durante la ricerca |
| `evidenziaCard(id)` | bordo colorato sulla card selezionata |

### Partite e pannello dettagli

| Funzione | Cosa fa |
| --- | --- |
| `creaScoreboard(evento, grande)` | il "tabellone": punteggio, oppure orario, oppure "VS" |
| `creaCountdown(evento)` | la pillola verde "tra 3 giorni" (grigia se la partita è passata) |
| `creaRigaEvento(evento)` | una riga partita cliccabile (data, casa, tabellone, trasferta) |
| `creaListaEventi(…)` *(privata)* | titolo + righe partita, o un messaggio se la lista è vuota |
| `creaProssimaPartita(evento)` *(privata)* | il box grande "Prossima partita" |
| `creaSkeletonDettagli()` | segnaposto del pannello durante il caricamento |
| `creaPannelloDettagli(squadra, prossimi, ultimi)` | il pannello completo sotto le card |

### Modale partita

| Funzione | Cosa fa |
| --- | --- |
| `apriModale()` / `chiudiModale()` | usano `bootstrap.Modal.getOrCreateInstance()` |
| `mostraBottoneDettagli(visibile)` | mostra "Tutti i dettagli" solo se la modale è aperta da una preferita |
| `mostraCaricamentoModale(titolo)` | titolo + skeleton mentre arrivano i dati |
| `riempiModaleEvento(evento, prefisso)` | loghi, tabellone, countdown e la lista delle informazioni (solo quelle presenti) |
| `mostraModaleSenzaPartite(squadra, ultimo)` | messaggio + ultimo risultato se non ci sono partite in programma |
| `mostraErroreModale(msg)` | alert rosso dentro la modale |

### Menu suggerimenti

| Funzione | Cosa fa |
| --- | --- |
| `renderMenu(squadre, query)` | una voce per squadra con logo e nome; la parte digitata è evidenziata in verde con `<mark>` |
| `mostraInfoMenu(testo)` | una voce di solo testo ("Ricerca in corso…", "Nessuna squadra trovata") |
| `apriMenu()` / `chiudiMenu()` / `isMenuAperto()` | gestiscono la visibilità e `aria-expanded` |
| `evidenziaVoce(indice)` | evidenzia una voce con le frecce; arrivati in fondo si ricomincia dall'alto |

### Prossimi appuntamenti

| Funzione | Cosa fa |
| --- | --- |
| `mostraSezioneAppuntamenti(visibile)` | la sezione si vede solo se ci sono preferite |
| `mostraSkeletonAppuntamenti(n)` | segnaposto durante il caricamento |
| `mostraAvvisoAppuntamenti(nomi)` | alert giallo con le squadre che non si sono caricate |
| `renderAppuntamenti(lista)` | una card per partita, con bordo del colore dello sport |

---

## main.js – app

### Stato

```js
const stato = {
  squadreTrovate: [],          // risultati dell'ultima ricerca
  preferite: caricaPreferite(),// lette dal localStorage all'avvio
  filtroSport: "all",          // filtro attivo sulle preferite
  squadraModale: null,         // squadra aperta nella modale
};
```

La pagina non è mai la "fonte" dei dati: per sapere se una squadra è preferita
si guarda `stato.preferite`, non se nella card c'è una ★.

| Funzione | Cosa fa |
| --- | --- |
| `caricaPreferite()` / `salvaPreferite()` | leggono e scrivono il localStorage con `JSON.parse` / `JSON.stringify`, dentro `try/catch` |
| `isPreferita(id)` | `true` se la squadra è tra le preferite |
| `trovaSquadra(id)` | cerca la squadra tra i risultati, poi tra le preferite (operatore `??`) |
| `aggiungiPreferita(squadra)` / `rimuoviPreferita(id)` | modificano `stato.preferite` e salvano |

### Ricerca e suggerimenti

| Funzione | Cosa fa |
| --- | --- |
| `eseguiRicerca(testo)` | ricerca completa (Invio / Cerca): skeleton, poi tutte le card; un campo vuoto azzera la pagina |
| `aggiornaSuggerimenti(testo)` | dopo 2 caratteri mostra il menu; se nel frattempo l'utente ha scritto altro, la risposta viene ignorata |
| `scegliSuggerimento(indice)` | mostra solo quella squadra e apre subito i suoi dettagli |
| `muoviSelezione(passo)` / `confermaSelezione()` | frecce ↑↓ e Invio nel menu |
| `chiudiSuggerimenti()` / `riapriSuggerimenti()` | chiudono il menu, o lo riaprono tornando sull'input |
| `renderRisultati()` | ridisegna le card dei risultati |

Ogni nuova richiesta annulla quella precedente con `controller.abort()`:
un `AbortError` non è un errore, quindi viene ignorato.

### Dettagli e modale

| Funzione | Cosa fa |
| --- | --- |
| `mostraDettagli(id)` | apre il pannello dettagli sotto le card |
| `apriModaleSquadra(id)` | click su una preferita: modale con la sua prossima partita |
| `apriModaleEvento(idEvento)` | click su una partita qualsiasi: modale con tutti i suoi dati |
| `dallaModaleAiDettagli()` | bottone "Tutti i dettagli": chiude la modale e apre il pannello |

`tokenDettagli` è un contatore: se clicchi due squadre in fretta, la risposta della
prima arriva tardi e viene scartata, perché il token non è più quello attuale.

### Appuntamenti, preferiti e filtro

| Funzione | Cosa fa |
| --- | --- |
| `aggiornaAppuntamenti()` | carica le partite di **tutte** le preferite con `Promise.allSettled`, toglie i doppioni, ordina per data, mostra le prime 6 |
| `renderPreferite()` | applica il filtro sport, disegna le card, aggiorna il contatore sul bottone ⭐ |
| `togglePreferita(id)` | aggiunge o toglie, poi aggiorna preferite, risultati e appuntamenti |
| `impostaFiltro(sport)` | cambia il filtro e il bottone attivo |

**`Promise.all` o `Promise.allSettled`?** `Promise.all` (in `api.js`) si ferma al primo
errore: va bene per prossimi + ultimi della stessa squadra, che servono insieme.
`Promise.allSettled` aspetta tutte le risposte, riuscite o no: se una squadra fallisce,
le altre si vedono comunque.

### Event listener

| Elemento | Evento | Cosa succede |
| --- | --- | --- |
| `#search-form` | `submit` | ricerca completa |
| `#search-input` | `input` | suggerimenti dopo 400 ms di pausa (**debounce** con `setTimeout` / `clearTimeout`) |
| `#search-input` | `keydown` | ↑ ↓ Invio Esc nel menu |
| `#search-input` | `blur` / `focus` | chiude / riapre il menu |
| `#suggestions` | `mousedown` + `click` | sceglie la squadra; `mousedown` + `preventDefault` evita che l'input perda il focus prima del click |
| `#results-grid` | `click` | ☆ → preferiti, card → pannello dettagli |
| `#fav-grid` | `click` | ☆ → togli, card → modale prossima partita |
| griglie | `keydown` | Invio / Spazio su una card come un click (accessibilità) |
| `#details`, `#appointments`, `#event-modal-body` | `click` | una partita → modale |
| `#sport-filter` | `click` | cambia filtro |
| `.hero` | `IntersectionObserver` | mostra il bottone ↑ quando l'header esce dallo schermo |

Le griglie usano la **event delegation**: un solo listener sul contenitore, che con
`e.target.closest()` capisce se il click è sulla stellina o sulla card. Funziona
anche per le card create dopo, senza aggiungere listener a ognuna.

---

## I flussi principali

### Avvio della pagina

1. `main.js` legge le preferite dal localStorage → `stato.preferite`
2. `renderPreferite()` le disegna
3. `aggiornaAppuntamenti()` scarica le partite di tutte con `Promise.allSettled`

### Ricerca con suggerimenti

1. Scrivi "lak" → il listener `input` aspetta 400 ms
2. `aggiornaSuggerimenti()` annulla la richiesta precedente e chiama `cercaSquadre()` di `api.js`
3. `renderMenu()` di `ui.js` mostra le voci
4. Scegli una voce → `scegliSuggerimento()` → card + `mostraDettagli()`

### Clic sulla ☆

1. Il listener della griglia vede `data-action="toggle-fav"`
2. `togglePreferita(id)` → `aggiungiPreferita()` aggiorna lo stato e il localStorage
3. `renderGriglia()` ridisegna le card (☆ → ★)
4. `aggiornaAppuntamenti()` aggiorna gli appuntamenti (la cache evita richieste doppie)

### Clic su una preferita

1. `apriModaleSquadra(id)` apre subito la modale con uno skeleton
2. `caricaEventi(id)` (dalla cache, se c'è)
3. `riempiModaleEvento()` mostra la prossima partita, oppure `mostraModaleSenzaPartite()`

---

## CSS

Il file `style.css` aggiunge un tema "stadio di sera" sopra Bootstrap.
Bootstrap si occupa di griglia e componenti; `style.css` di colori, forme e animazioni.

### Variabili (`:root`)

Tutti i colori sono **variabili CSS**: cambiandone una si aggiorna l'intera pagina.

| Variabile | Uso |
| --- | --- |
| `--sh-bg`, `--sh-surface`, `--sh-surface-2` | sfondo pagina, card, elementi interni |
| `--sh-text`, `--sh-muted` | testo principale e secondario |
| `--sh-accent` | verde campo: bottoni, countdown, filtro attivo |
| `--sh-star`, `--sh-led` | giallo della stellina e delle cifre del tabellone |
| `--sport-soccer` / `-basket` / `-football` / `-rugby` | colore di ogni sport |
| `--font-board` | font "tabellone" (Bebas Neue) per titoli e punteggi |
| `--bs-body-bg`, `--bs-body-color` | variabili di Bootstrap sovrascritte con i nostri colori |

### Sezioni del file

| Sezione | Cosa contiene |
| --- | --- |
| Header | luci dei riflettori e strisce del campo, fatte solo con `radial-gradient` e `repeating-linear-gradient` |
| Suggerimenti | menu a tendina in `position: absolute` sotto l'input |
| Filtro sport | bottoni con stato `.active` |
| Card squadra | striscia colorata in alto, logo che esce dal bordo, stellina |
| Skeleton | rettangoli grigi con un riflesso che scorre (`@keyframes shimmer`) |
| Animazioni | entrata delle card (`fadeUp`) e del pannello (`slideIn`) |
| Tabellone | punteggi gialli su fondo nero, righe partita a 3 colonne con CSS Grid |
| Modale | colori scuri per la modale di Bootstrap |
| Bottoni fissi | ⭐ e ↑ in `position: fixed`, con contatore |

### Tecniche usate

- **Un colore per sport senza JavaScript**: ogni card ha `data-sport="Rugby"`, e il CSS
  assegna il colore giusto:
  ```css
  .team-card[data-sport="Rugby"] { --sport-color: var(--sport-rugby); }
  ```
  Striscia, etichetta e bagliore usano poi `var(--sport-color)`.
- **Logo che esce dalla card**: la card ha `position: relative`, il logo `position: absolute`
  con `transform: translate(-50%, -55%)`.
- **Animazioni sfasate**: ogni card riceve `--i` (0, 1, 2…) e l'animazione parte dopo
  `calc(var(--i) * 70ms)`.
- **Scorrimento morbido**: `scroll-behavior: smooth` per i link `#preferiti` e `#top`.
- **Accessibilità**: con `prefers-reduced-motion: reduce` animazioni e scorrimento morbido si spengono.
- **Mobile**: `@media (max-width: 575.98px)` rimpicciolisce tabellone, filtri e bottoni fissi.

---

## Bootstrap

Bootstrap 5.3 è caricato da CDN: il CSS nel `<head>`, il JS (`bootstrap.bundle.min.js`)
prima di `main.js`, perché serve alla modale.

### Tema scuro

`<html data-bs-theme="dark">` attiva il tema scuro di Bootstrap per tutti i componenti
(input, modale, alert). Le sue variabili (`--bs-body-bg`…) sono poi sovrascritte in `style.css`.

### Griglia (layout responsive)

```html
<div class="row g-3">
  <div class="col-12 col-md-6 col-lg-4 flex-grow-1">…card…</div>
</div>
```

| Classe | Effetto |
| --- | --- |
| `container` | contenuto centrato con margini |
| `row` + `g-3` | riga della griglia con spazio tra le colonne |
| `col-12` | mobile: 1 card per riga |
| `col-md-6` | tablet (≥ 768 px): 2 per riga |
| `col-lg-4` | desktop (≥ 992 px): 3 per riga |
| `flex-grow-1` | l'ultima card rimasta da sola su una riga si allarga |

### Componenti usati

| Componente | Dove |
| --- | --- |
| `card` | pannello dettagli |
| `alert alert-danger` / `alert-warning` | errore di ricerca, squadre non caricate |
| `btn-group` | filtro per sport |
| `btn`, `btn-close`, `form-control` | bottoni, chiusura modale, campo di ricerca |
| `modal` | modale partita (`modal-dialog-centered`, `modal-dialog-scrollable`) |

### Classi di utilità

| Classe | Effetto |
| --- | --- |
| `d-none` | nasconde un elemento: il JS la aggiunge e la toglie con `classList.toggle()` |
| `d-flex`, `gap-2`, `justify-content-between`, `align-items-center` | allineamenti con Flexbox |
| `mb-3`, `mt-4`, `py-5`, `p-4` | margini e padding |
| `text-center`, `fw-bold`, `fs-6`, `small` | testo |
| `visually-hidden` | testo invisibile ma letto dagli screen reader (etichetta dell'input) |

### La modale da JavaScript

```js
bootstrap.Modal.getOrCreateInstance(dom.modalEl).show();  // apre
bootstrap.Modal.getOrCreateInstance(dom.modalEl).hide();  // chiude
```

`bootstrap` è una variabile globale creata da `bootstrap.bundle.min.js`.
I bottoni con `data-bs-dismiss="modal"` chiudono la modale senza bisogno di JavaScript nostro.

---

## Endpoint e limiti dell'API

| Endpoint | Restituisce | Usato da |
| --- | --- | --- |
| `searchteams.php?t={nome}` | squadre (`teams`) | `cercaSquadre()` |
| `eventsnext.php?id={idTeam}` | prossimi eventi (`events`) | `scaricaEventi()` |
| `eventslast.php?id={idTeam}` | ultimi risultati (`results`) | `scaricaEventi()` |

Con la chiave gratuita `123` l'API restituisce dati ridotti: spesso una sola squadra
per ricerca, solo le partite in casa, e non sempre stadio o loghi. Quando un dato manca,
l'app semplicemente non lo mostra.

## Tecnologie

HTML semantico · CSS (variabili, Grid, Flexbox, animazioni) · Bootstrap 5.3.9 ·
JavaScript: classi, moduli ES, `fetch`, `async/await`, `Promise.all` / `allSettled`,
`AbortController`, `localStorage`, `Intl.DateTimeFormat` / `RelativeTimeFormat`,
`IntersectionObserver`, event delegation.