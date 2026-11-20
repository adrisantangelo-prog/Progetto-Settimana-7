// =========================================================
// main.js – APP
// Stato, logica delle funzionalità ed event listener.
// Usa api.js per i dati e ui.js per disegnare.
// =========================================================

import { Squadra, cercaSquadre, haRicercaInCache, caricaEventi, trovaEvento } from "./api.js";
import {
  dom, mostraErrore, nascondiErrore, mostraMessaggio,
  renderGriglia, creaSkeletonCards, evidenziaCard,
  creaSkeletonDettagli, creaPannelloDettagli,
  apriModale, chiudiModale, mostraBottoneDettagli, mostraCaricamentoModale,
  riempiModaleEvento, mostraModaleSenzaPartite, mostraErroreModale,
  isMenuAperto, chiudiMenu, mostraInfoMenu, renderMenu, evidenziaVoce,
  mostraSezioneAppuntamenti, mostraSkeletonAppuntamenti, mostraAvvisoAppuntamenti, renderAppuntamenti,
} from "./ui.js";

const STORAGE_KEY = "sportshub-preferite";
const DEBOUNCE_MS = 400;
const MIN_CARATTERI = 2;
const MAX_SUGGERIMENTI = 8;
const MAX_APPUNTAMENTI = 6;

let debounceTimer = null;

// =========================================================
// STATO + LOCALSTORAGE
// =========================================================

function caricaPreferite() {
  try {
    const salvate = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
    return salvate.map((s) => new Squadra(s));
  } catch {
    return [];
  }
}

function salvaPreferite() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stato.preferite));
  } catch (err) {
    console.warn("Impossibile salvare i preferiti:", err);
  }
}

// Tutti i dati dell'app in un solo oggetto
const stato = {
  squadreTrovate: [],          // ultimi risultati della ricerca
  preferite: caricaPreferite(),
  filtroSport: "all",
  squadraModale: null,         // squadra aperta nella modale (se aperta da una preferita)
};

function isPreferita(id) {
  return stato.preferite.some((s) => s.id === id);
}

function trovaSquadra(id) {
  return stato.squadreTrovate.find((s) => s.id === id) ?? stato.preferite.find((s) => s.id === id);
}

function aggiungiPreferita(squadra) {
  if (isPreferita(squadra.id)) return;
  stato.preferite.push(squadra);
  salvaPreferite();
}

function rimuoviPreferita(id) {
  stato.preferite = stato.preferite.filter((s) => s.id !== id);
  salvaPreferite();
}

// =========================================================
// RICERCA E SUGGERIMENTI
// =========================================================

let controller = null;       // AbortController della richiesta in corso
let suggerimenti = [];       // squadre mostrate nel menu
let querySuggerimenti = "";  // testo a cui si riferiscono
let indiceAttivo = -1;       // voce evidenziata con le frecce

function renderRisultati() {
  renderGriglia(dom.resultsGrid, stato.squadreTrovate, isPreferita);
}

// ---------- Ricerca completa (Invio / Cerca): tutte le card ----------

async function eseguiRicerca(testo) {
  const query = testo.trim();
  controller?.abort(); // annulla l'eventuale richiesta precedente

  if (!query) {
    stato.squadreTrovate = [];
    renderRisultati();
    dom.details.replaceChildren();
    nascondiErrore();
    mostraMessaggio("Inizia cercando una squadra qui sopra.");
    return;
  }

  controller = new AbortController();
  nascondiErrore();
  mostraMessaggio("");
  dom.details.replaceChildren();
  dom.resultsGrid.replaceChildren(...creaSkeletonCards(3));

  try {
    stato.squadreTrovate = await cercaSquadre(query, controller.signal);
    renderRisultati();
    if (stato.squadreTrovate.length === 0) mostraMessaggio("Nessuna squadra trovata.");
  } catch (err) {
    if (err.name === "AbortError") return; // non è un errore: ne è partita un'altra
    console.error(err);
    stato.squadreTrovate = [];
    dom.resultsGrid.replaceChildren();
    mostraErrore("Si è verificato un errore durante la ricerca. Controlla la connessione e riprova.");
  }
}

// ---------- Suggerimenti mentre si scrive ----------

function chiudiSuggerimenti() {
  chiudiMenu();
  indiceAttivo = -1;
}

async function aggiornaSuggerimenti(testo) {
  const query = testo.trim();
  controller?.abort();

  if (query.length < MIN_CARATTERI) {
    suggerimenti = [];
    chiudiSuggerimenti();
    return;
  }

  controller = new AbortController();
  if (!haRicercaInCache(query)) mostraInfoMenu("Ricerca in corso…");

  try {
    const squadre = await cercaSquadre(query, controller.signal);
    if (dom.input.value.trim() !== query) return; // l'utente ha già scritto altro
    suggerimenti = squadre.slice(0, MAX_SUGGERIMENTI);
    querySuggerimenti = query;
    indiceAttivo = -1;
    renderMenu(suggerimenti, query);
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error(err);
    mostraInfoMenu("Impossibile caricare i suggerimenti");
  }
}

// Tornando sull'input riapro il menu, se si riferisce ancora a quel testo
function riapriSuggerimenti() {
  if (suggerimenti.length > 0 && dom.input.value.trim() === querySuggerimenti) {
    indiceAttivo = -1;
    renderMenu(suggerimenti, querySuggerimenti);
  }
}

function suggerimentiAperti() {
  return isMenuAperto();
}

function muoviSelezione(passo) {
  indiceAttivo = evidenziaVoce(indiceAttivo + passo);
}

// Invio con una voce evidenziata: la sceglie. Restituisce true se ha scelto
function confermaSelezione() {
  if (indiceAttivo < 0) return false;
  scegliSuggerimento(indiceAttivo);
  return true;
}

// Scelta di un suggerimento: mostro solo quella squadra e apro i suoi dettagli
function scegliSuggerimento(indice) {
  const squadra = suggerimenti[indice];
  if (!squadra) return;

  dom.input.value = squadra.nome;
  chiudiSuggerimenti();

  stato.squadreTrovate = [squadra];
  nascondiErrore();
  mostraMessaggio("");
  renderRisultati();
  mostraDettagli(squadra.id);
}

// =========================================================
// DETTAGLI E MODALE
// =========================================================

let tokenDettagli = 0; // evita che una risposta lenta sovrascriva una più recente

// Pannello sotto le card: prossima partita + due liste (Promise.all in api.js)
async function mostraDettagli(id) {
  const squadra = trovaSquadra(id);
  if (!squadra) return;

  const richiesta = ++tokenDettagli;
  evidenziaCard(id);
  nascondiErrore();
  mostraMessaggio("");
  dom.details.replaceChildren(creaSkeletonDettagli());

  try {
    const { prossimi, ultimi } = await caricaEventi(id);
    if (richiesta !== tokenDettagli) return; // nel frattempo è stata scelta un'altra squadra

    dom.details.replaceChildren(creaPannelloDettagli(squadra, prossimi, ultimi));
    dom.details.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (err) {
    if (richiesta !== tokenDettagli) return;
    console.error(err);
    dom.details.replaceChildren();
    mostraErrore(`Impossibile caricare i dettagli di ${squadra.nome}. Riprova più tardi.`);
  }
}

// Click su un evento qualsiasi → modale con tutti i dati
function apriModaleEvento(idEvento) {
  const trovato = trovaEvento(idEvento);
  if (!trovato) return;
  stato.squadraModale = null;
  mostraBottoneDettagli(false);
  riempiModaleEvento(trovato.evento);
  apriModale();
}

// Click su una squadra preferita → modale con la prossima partita
async function apriModaleSquadra(id) {
  const squadra = trovaSquadra(id);
  if (!squadra) return;

  stato.squadraModale = squadra;
  mostraBottoneDettagli(true);
  mostraCaricamentoModale(squadra.nome);
  apriModale();

  try {
    const { prossimi, ultimi } = await caricaEventi(id);
    if (stato.squadraModale !== squadra) return; // l'utente ha aperto altro

    if (prossimi.length > 0) {
      riempiModaleEvento(prossimi[0], "Prossima partita");
    } else {
      mostraModaleSenzaPartite(squadra, ultimi[0]);
    }
  } catch (err) {
    if (stato.squadraModale !== squadra) return;
    console.error(err);
    mostraErroreModale(`Impossibile caricare le partite di ${squadra.nome}. Riprova più tardi.`);
  }
}

// Bottone "Tutti i dettagli della squadra" nella modale
function dallaModaleAiDettagli() {
  const squadra = stato.squadraModale;
  if (!squadra) return;
  chiudiModale();
  mostraDettagli(squadra.id);
}

// =========================================================
// PROSSIMI APPUNTAMENTI (Promise.allSettled)
// =========================================================

let tokenAppuntamenti = 0;

async function aggiornaAppuntamenti() {
  const richiesta = ++tokenAppuntamenti;
  const squadre = [...stato.preferite];

  if (squadre.length === 0) {
    mostraSezioneAppuntamenti(false);
    return;
  }

  mostraSezioneAppuntamenti(true);
  mostraSkeletonAppuntamenti(Math.min(squadre.length, 3));

  const esiti = await Promise.allSettled(squadre.map((s) => caricaEventi(s.id)));
  if (richiesta !== tokenAppuntamenti) return; // nel frattempo è cambiato qualcosa

  const perId = new Map(); // evita doppioni se due preferite giocano tra loro
  const fallite = [];

  esiti.forEach((esito, i) => {
    if (esito.status === "fulfilled") {
      esito.value.prossimi.forEach((evento) => {
        if (!perId.has(evento.id)) perId.set(evento.id, { evento, squadra: squadre[i] });
      });
    } else {
      fallite.push(squadre[i].nome);
    }
  });

  const appuntamenti = [...perId.values()]
    .filter(({ evento }) => (evento.giorniMancanti() ?? 0) >= 0)
    .sort((a, b) => a.evento.ordine() - b.evento.ordine())
    .slice(0, MAX_APPUNTAMENTI);

  if (fallite.length > 0) mostraAvvisoAppuntamenti(fallite);
  renderAppuntamenti(appuntamenti);
}

// =========================================================
// PREFERITI E FILTRO SPORT
// =========================================================

function renderPreferite() {
  const visibili = stato.filtroSport === "all"
    ? stato.preferite
    : stato.preferite.filter((s) => s.sport === stato.filtroSport);

  renderGriglia(dom.favGrid, visibili, isPreferita);

  if (stato.preferite.length === 0) {
    dom.favEmpty.textContent = "Non hai ancora salvato nessuna squadra. Cercane una con la barra in alto e tocca la ☆ per aggiungerla ai preferiti.";
  } else if (visibili.length === 0) {
    dom.favEmpty.textContent = "Nessuna squadra preferita per questo sport.";
  }
  dom.favEmpty.classList.toggle("d-none", visibili.length > 0);

  // contatore sul bottone fisso ⭐
  dom.favCount.textContent = stato.preferite.length;
  dom.favCount.classList.toggle("d-none", stato.preferite.length === 0);
}

// Stellina: aggiunge o toglie, poi aggiorna tutto ciò che ne dipende
function togglePreferita(id) {
  if (isPreferita(id)) {
    rimuoviPreferita(id);
  } else {
    const squadra = stato.squadreTrovate.find((s) => s.id === id);
    if (!squadra) return;
    aggiungiPreferita(squadra);
  }
  renderPreferite();
  renderRisultati();
  aggiornaAppuntamenti();
}

function impostaFiltro(sport) {
  stato.filtroSport = sport;
  dom.sportFilter.querySelectorAll("[data-sport]").forEach((btn) => {
    const attivo = btn.dataset.sport === sport;
    btn.classList.toggle("active", attivo);
    btn.setAttribute("aria-pressed", String(attivo));
  });
  renderPreferite();
}

// =========================================================
// EVENT LISTENER
// =========================================================

// ---------- Ricerca ----------

// Invio / bottone Cerca: chiude i suggerimenti e mostra tutte le card
dom.form.addEventListener("submit", (e) => {
  e.preventDefault();
  clearTimeout(debounceTimer);
  chiudiSuggerimenti();
  eseguiRicerca(dom.input.value);
});

// Digitazione: suggerimenti dopo 400 ms di pausa (debounce)
dom.input.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  if (dom.input.value.trim() === "") {
    chiudiSuggerimenti();
    eseguiRicerca(""); // campo svuotato: azzero tutto
    return;
  }
  debounceTimer = setTimeout(() => aggiornaSuggerimenti(dom.input.value), DEBOUNCE_MS);
});

// Tastiera nel menu: frecce, Invio, Esc
dom.input.addEventListener("keydown", (e) => {
  if (!suggerimentiAperti()) return;

  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    muoviSelezione(e.key === "ArrowDown" ? 1 : -1);
  } else if (e.key === "Enter") {
    clearTimeout(debounceTimer);
    if (confermaSelezione()) e.preventDefault(); // non invia il form
  } else if (e.key === "Escape") {
    e.preventDefault();
    chiudiSuggerimenti();
  }
});

// mousedown + preventDefault: l'input non perde il focus prima del click
dom.suggestions.addEventListener("mousedown", (e) => e.preventDefault());
dom.suggestions.addEventListener("click", (e) => {
  const voce = e.target.closest(".suggestion");
  if (!voce) return;
  clearTimeout(debounceTimer);
  scegliSuggerimento(Number(voce.dataset.index));
});

dom.input.addEventListener("blur", chiudiSuggerimenti);
dom.input.addEventListener("focus", riapriSuggerimenti);

// ---------- Griglie di card (event delegation) ----------

function creaGestoreGriglia(azioneCard) {
  return (e) => {
    const star = e.target.closest("[data-action='toggle-fav']");
    if (star) {
      togglePreferita(star.dataset.id);
      return;
    }
    const card = e.target.closest(".team-card");
    if (card && !card.classList.contains("skeleton-card")) azioneCard(card.dataset.id);
  };
}

// Risultati → pannello dettagli; Preferite → modale prossima partita
dom.resultsGrid.addEventListener("click", creaGestoreGriglia(mostraDettagli));
dom.favGrid.addEventListener("click", creaGestoreGriglia(apriModaleSquadra));

// Accessibilità: Invio/Spazio sulla card come un click
[dom.resultsGrid, dom.favGrid].forEach((griglia) => {
  griglia.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("team-card")) {
      e.preventDefault();
      e.target.click();
    }
  });
});

// ---------- Eventi (partite) → modale ----------

function gestisciClickEvento(e) {
  const riga = e.target.closest("[data-event-id]");
  if (riga) apriModaleEvento(riga.dataset.eventId);
}

dom.details.addEventListener("click", gestisciClickEvento);
dom.appointmentsBox.addEventListener("click", gestisciClickEvento);
dom.modalBody.addEventListener("click", gestisciClickEvento);
dom.modalDetailsBtn.addEventListener("click", dallaModaleAiDettagli);

// ---------- Filtro sport ----------

dom.sportFilter.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-sport]");
  if (btn) impostaFiltro(btn.dataset.sport);
});

// ---------- Bottone "torna su" ----------

// Visibile solo quando l'header non si vede più
dom.backToTop.classList.add("is-hidden");
if ("IntersectionObserver" in window) {
  new IntersectionObserver(([voce]) => {
    dom.backToTop.classList.toggle("is-hidden", voce.isIntersecting);
  }).observe(dom.hero);
} else {
  dom.backToTop.classList.remove("is-hidden");
}

// ---------- Avvio ----------

renderPreferite();
aggiornaAppuntamenti();
