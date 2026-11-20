// =========================================================
// ui.js – PAGINA
// Riferimenti agli elementi HTML e funzioni che disegnano.
// Ricevono i dati come parametri e restituiscono elementi:
// non fanno fetch e non leggono lo stato.
// =========================================================

import { SPORT } from "./api.js";

// =========================================================
// ELEMENTI E HELPER
// =========================================================

const $ = (id) => document.getElementById(id);

export const dom = {
  form: $("search-form"),
  input: $("search-input"),
  suggestions: $("suggestions"),
  errorBox: $("error-box"),
  resultsMsg: $("results-msg"),
  resultsGrid: $("results-grid"),
  details: $("details"),
  favGrid: $("fav-grid"),
  favEmpty: $("fav-empty"),
  favCount: $("fav-count"),
  sportFilter: $("sport-filter"),
  appointmentsSection: $("appointments-section"),
  appointmentsBox: $("appointments"),
  appointmentsWarning: $("appointments-warning"),
  modalEl: $("event-modal"),
  modalTitle: $("event-modal-title"),
  modalBody: $("event-modal-body"),
  modalDetailsBtn: $("modal-details-btn"),
  backToTop: $("back-to-top"),
  hero: document.querySelector(".hero"),
};

// Crea un elemento con classe e testo (sempre textContent, mai innerHTML)
export function el(tag, className = "", testo = "") {
  const nodo = document.createElement(tag);
  if (className) nodo.className = className;
  if (testo) nodo.textContent = testo;
  return nodo;
}

export function coloreSport(sport) {
  return `var(${SPORT[sport]?.colore ?? "--sport-other"})`;
}

export function creaSkeleton(altezza, larghezza = "") {
  const box = el("div", "skeleton");
  box.style.height = altezza;
  if (larghezza) box.style.width = larghezza;
  box.setAttribute("aria-hidden", "true");
  return box;
}

export function mostraErrore(messaggio) {
  dom.errorBox.textContent = messaggio;
  dom.errorBox.classList.remove("d-none");
}

export function nascondiErrore() {
  dom.errorBox.classList.add("d-none");
  dom.errorBox.textContent = "";
}

export function mostraMessaggio(testo) {
  dom.resultsMsg.textContent = testo;
  dom.resultsMsg.classList.toggle("d-none", !testo);
}

// =========================================================
// CARD SQUADRA
// =========================================================

export function creaCardSquadra(squadra, indice, preferita) {
  // flex-grow-1: l'ultima card "orfana" di una riga si allarga
  const col = el("div", "col-12 col-md-6 col-lg-4 flex-grow-1 fade-up");
  col.style.setProperty("--i", indice);

  const card = el("article", "team-card h-100 text-center");
  card.dataset.id = squadra.id;
  card.dataset.sport = squadra.sport;
  card.tabIndex = 0;
  card.setAttribute("aria-label", squadra.nome);

  // Logo che "esce" dal bordo superiore
  const logoWrap = el("div", "team-logo-wrap");
  if (squadra.logo) {
    const img = el("img", "team-logo");
    img.src = squadra.logo;
    img.alt = `Logo ${squadra.nome}`;
    img.loading = "lazy";
    logoWrap.append(img);
  }

  // Stellina preferiti
  const star = el("button", `btn-star${preferita ? " is-fav" : ""}`, preferita ? "★" : "☆");
  star.type = "button";
  star.dataset.action = "toggle-fav";
  star.dataset.id = squadra.id;
  star.setAttribute("aria-pressed", String(preferita));
  star.setAttribute("aria-label", preferita ? `Rimuovi ${squadra.nome} dai preferiti` : `Aggiungi ${squadra.nome} ai preferiti`);
  star.title = preferita ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti";

  const nome = el("h3", "team-name", squadra.nome);
  const meta = el("p", "team-meta", [squadra.lega, squadra.paese].filter(Boolean).join(" · "));

  card.append(logoWrap, star, nome, meta);
  if (squadra.sport) {
    card.append(el("span", "sport-pill", squadra.sportLabel));
  }

  col.append(card);
  return col;
}

// Disegna una griglia di card. isPreferita è una funzione (id) => boolean
export function renderGriglia(contenitore, squadre, isPreferita) {
  contenitore.replaceChildren(
    ...squadre.map((s, i) => creaCardSquadra(s, i, isPreferita(s.id)))
  );
}

export function creaSkeletonCards(quante) {
  return Array.from({ length: quante }, () => {
    const col = el("div", "col-12 col-md-6 col-lg-4 flex-grow-1");
    const card = el("div", "team-card skeleton-card h-100 text-center");
    card.setAttribute("aria-hidden", "true");
    const logo = el("div", "team-logo-wrap skeleton");
    card.append(logo);
    ["55%", "75%", "30%"].forEach((larghezza) => {
      const riga = el("div", "skeleton skeleton-line");
      riga.style.width = larghezza;
      card.append(riga);
    });
    col.append(card);
    return col;
  });
}

export function evidenziaCard(id) {
  document.querySelectorAll(".team-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.id === id);
  });
}

// =========================================================
// PARTITE E PANNELLO DETTAGLI
// =========================================================

export function creaScoreboard(evento, grande = false) {
  const testo = evento.punteggio() || evento.oraFormattata() || "VS";
  const classi = ["scoreboard"];
  if (grande) classi.push("scoreboard-lg");
  if (!evento.haPunteggio()) classi.push(testo === "VS" ? "is-vs" : "is-time");
  return el("span", classi.join(" "), testo);
}

export function creaCountdown(evento) {
  const giorni = evento.giorniMancanti();
  if (giorni === null) return null;
  return el("span", `countdown-pill${giorni < 0 ? " is-past" : ""}`, evento.countdown());
}

export function creaRigaEvento(evento) {
  const riga = el("button", "event-row");
  riga.type = "button";
  riga.dataset.eventId = evento.id;
  riga.setAttribute("aria-label", `Dettagli ${evento.casa} contro ${evento.trasferta}`);

  const ora = evento.oraFormattata();
  const data = el("div", "event-date", ora ? `${evento.dataFormattata()} · ${ora}` : evento.dataFormattata());

  const match = el("div", "event-match");
  const scoreboard = evento.haPunteggio() ? creaScoreboard(evento) : el("span", "scoreboard is-vs", "VS");
  match.append(
    el("span", "event-team home", evento.casa),
    scoreboard,
    el("span", "event-team away", evento.trasferta)
  );

  riga.append(data, match);
  return riga;
}

function creaListaEventi(titolo, eventi, testoVuoto) {
  const col = el("div", "col-12 col-md-6");
  col.append(el("h4", "details-subtitle mb-2", titolo));

  if (eventi.length === 0) {
    col.append(el("p", "event-empty mb-0", testoVuoto));
  } else {
    eventi.forEach((evento) => col.append(creaRigaEvento(evento)));
  }
  return col;
}

// Box grande "Prossima partita" nel pannello dettagli
function creaProssimaPartita(evento) {
  const box = el("button", "next-match mb-4");
  box.type = "button";
  box.dataset.eventId = evento.id;

  const intestazione = el("div", "d-flex justify-content-center align-items-center gap-2 mb-3");
  intestazione.append(el("span", "next-label", "Prossima partita"));
  const countdown = creaCountdown(evento);
  if (countdown) intestazione.append(countdown);

  const match = el("div", "event-match mb-2");
  match.append(
    el("span", "event-team home fs-5", evento.casa),
    creaScoreboard(evento, true),
    el("span", "event-team away fs-5", evento.trasferta)
  );

  box.append(intestazione, match, el("div", "event-date mb-0", evento.dataLunga()));
  return box;
}

export function creaSkeletonDettagli() {
  const card = el("div", "details-card p-4");
  card.setAttribute("aria-hidden", "true");
  const titolo = creaSkeleton("2rem", "40%");
  titolo.classList.add("mb-4");
  const box = creaSkeleton("7rem");
  box.classList.add("mb-4");
  card.append(titolo, box, creaSkeleton("5rem"));
  return card;
}

// Pannello completo: titolo, prossima partita, due liste
export function creaPannelloDettagli(squadra, prossimi, ultimi) {
  const card = el("div", "card details-card slide-in");
  const body = el("div", "card-body p-4");
  body.append(el("h3", "details-title mb-4", squadra.nome));

  if (prossimi.length > 0) {
    body.append(creaProssimaPartita(prossimi[0]));
  }

  const row = el("div", "row g-4");
  row.append(
    creaListaEventi("Prossimi eventi", prossimi, "Nessun evento in programma"),
    creaListaEventi("Ultimi risultati", ultimi, "Nessun risultato disponibile")
  );
  body.append(row);
  card.append(body);
  return card;
}

// =========================================================
// MODALE PARTITA (Bootstrap)
// =========================================================

function istanzaModale() {
  // bootstrap è una variabile globale: arriva dallo <script> classico in index.html
  if (!window.bootstrap) {
    console.error("Bootstrap JS non caricato: la modale non può aprirsi.");
    return null;
  }
  return bootstrap.Modal.getOrCreateInstance(dom.modalEl);
}

export function apriModale() {
  istanzaModale()?.show();
}

export function chiudiModale() {
  istanzaModale()?.hide();
}

export function mostraBottoneDettagli(visibile) {
  dom.modalDetailsBtn.classList.toggle("d-none", !visibile);
}

export function mostraCaricamentoModale(titolo) {
  dom.modalTitle.textContent = titolo;
  dom.modalBody.replaceChildren(creaSkeleton("12rem"));
}

function creaSquadraModale(nome, logo) {
  const box = el("div", "text-center");
  if (logo) {
    const img = el("img", "match-team-logo");
    img.src = logo;
    img.alt = `Logo ${nome}`;
    img.addEventListener("error", () => img.remove(), { once: true });
    box.append(img);
  }
  box.append(el("div", "match-team-name", nome));
  return box;
}

export function riempiModaleEvento(evento, prefissoTitolo = "") {
  const titolo = [evento.lega || "Partita", evento.giornata ? `Giornata ${evento.giornata}` : ""]
    .filter(Boolean)
    .join(" · ");
  dom.modalTitle.textContent = prefissoTitolo ? `${prefissoTitolo} · ${titolo}` : titolo;

  // Intestazione: squadre + tabellone + countdown
  const hero = el("div", "match-hero mb-4");
  const teams = el("div", "match-teams");
  teams.append(
    creaSquadraModale(evento.casa, evento.logoCasa),
    creaScoreboard(evento, true),
    creaSquadraModale(evento.trasferta, evento.logoTrasferta)
  );
  hero.append(teams);

  const countdown = creaCountdown(evento);
  if (countdown) {
    const wrap = el("div", "mt-3");
    wrap.append(countdown);
    hero.append(wrap);
  }

  // Informazioni (mostro solo quelle presenti)
  const ora = evento.oraFormattata();
  const info = [
    ["Data", evento.dataLunga()],
    ["Orario", ora ? `${ora} (ora locale)` : ""],
    ["Stadio", evento.stadio],
    ["Città", evento.citta],
    ["Paese", evento.paese],
    ["Stagione", evento.stagione],
    ["Stato", evento.statoTradotto()],
  ].filter(([, valore]) => valore);

  const dl = el("dl", "match-info");
  info.forEach(([etichetta, valore]) => dl.append(el("dt", "", etichetta), el("dd", "", valore)));

  dom.modalBody.replaceChildren(hero, dl);

  if (evento.thumb) {
    const img = el("img", "match-thumb");
    img.src = evento.thumb;
    img.alt = evento.nome || `${evento.casa} vs ${evento.trasferta}`;
    img.loading = "lazy";
    img.addEventListener("error", () => img.remove(), { once: true });
    dom.modalBody.append(img);
  }
}

// Nessuna partita in programma: mostro almeno l'ultimo risultato
export function mostraModaleSenzaPartite(squadra, ultimoRisultato) {
  dom.modalTitle.textContent = squadra.nome;
  const contenuto = [el("p", "empty-msg", `Nessuna partita in programma per ${squadra.nome}.`)];
  if (ultimoRisultato) {
    contenuto.push(el("h3", "details-subtitle mt-3 mb-2", "Ultimo risultato"), creaRigaEvento(ultimoRisultato));
  }
  dom.modalBody.replaceChildren(...contenuto);
}

export function mostraErroreModale(messaggio) {
  dom.modalBody.replaceChildren(el("div", "alert alert-danger mb-0", messaggio));
}

// =========================================================
// MENU SUGGERIMENTI
// =========================================================

export function isMenuAperto() {
  return !dom.suggestions.classList.contains("d-none");
}

export function apriMenu() {
  dom.suggestions.classList.remove("d-none");
  dom.input.setAttribute("aria-expanded", "true");
}

export function chiudiMenu() {
  dom.suggestions.classList.add("d-none");
  dom.input.setAttribute("aria-expanded", "false");
  dom.input.removeAttribute("aria-activedescendant");
}

export function mostraInfoMenu(testo) {
  dom.suggestions.replaceChildren(el("li", "suggestion-info", testo));
  apriMenu();
}

// Evidenzia in verde la parte del nome che corrisponde a quanto digitato
function creaNomeEvidenziato(nome, query) {
  const box = el("div", "suggestion-name");
  const inizio = nome.toLowerCase().indexOf(query.toLowerCase());
  if (inizio === -1) {
    box.textContent = nome;
    return box;
  }
  const fine = inizio + query.length;
  box.append(
    document.createTextNode(nome.slice(0, inizio)),
    el("mark", "", nome.slice(inizio, fine)),
    document.createTextNode(nome.slice(fine))
  );
  return box;
}

export function renderMenu(squadre, query) {
  if (squadre.length === 0) {
    mostraInfoMenu("Nessuna squadra trovata");
    return;
  }

  const voci = squadre.map((squadra, i) => {
    const li = el("li", "suggestion");
    li.id = `suggestion-${i}`;
    li.dataset.index = i;
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", "false");

    const logo = el("img", "suggestion-logo");
    logo.src = squadra.logo;
    logo.alt = "";
    logo.addEventListener("error", () => { logo.style.visibility = "hidden"; }, { once: true });

    const testo = el("div");
    const meta = [squadra.lega, squadra.sportLabel].filter(Boolean).join(" · ");
    testo.append(creaNomeEvidenziato(squadra.nome, query), el("div", "suggestion-meta", meta));

    li.append(logo, testo);
    return li;
  });

  dom.suggestions.replaceChildren(...voci);
  apriMenu();
}

// Evidenzia la voce n. indice; le frecce "girano". Restituisce l'indice usato
export function evidenziaVoce(indice) {
  const voci = dom.suggestions.querySelectorAll(".suggestion");
  if (voci.length === 0) return -1;
  const attivo = (indice + voci.length) % voci.length;
  voci.forEach((voce, i) => {
    voce.classList.toggle("active", i === attivo);
    voce.setAttribute("aria-selected", String(i === attivo));
  });
  dom.input.setAttribute("aria-activedescendant", voci[attivo].id);
  voci[attivo].scrollIntoView({ block: "nearest" });
  return attivo;
}

// =========================================================
// PROSSIMI APPUNTAMENTI
// =========================================================

export function mostraSezioneAppuntamenti(visibile) {
  dom.appointmentsSection.classList.toggle("d-none", !visibile);
}

export function mostraSkeletonAppuntamenti(quanti) {
  dom.appointmentsWarning.classList.add("d-none");
  dom.appointmentsBox.replaceChildren(
    ...Array.from({ length: quanti }, () => {
      const col = el("div", "col-12 col-md-6 col-lg-4");
      col.append(creaSkeleton("6.5rem"));
      return col;
    })
  );
}

export function mostraAvvisoAppuntamenti(nomiFalliti) {
  dom.appointmentsWarning.textContent = `Non è stato possibile caricare: ${nomiFalliti.join(", ")}.`;
  dom.appointmentsWarning.classList.remove("d-none");
}

function creaCardAppuntamento({ evento, squadra }, indice) {
  const col = el("div", "col-12 col-md-6 col-lg-4 fade-up");
  col.style.setProperty("--i", indice);

  const card = el("button", "appointment-card");
  card.type = "button";
  card.dataset.eventId = evento.id;
  card.style.setProperty("--sport-color", coloreSport(squadra.sport));

  const intestazione = el("div", "d-flex justify-content-between align-items-center gap-2 mb-2");
  const ora = evento.oraFormattata();
  intestazione.append(
    creaCountdown(evento) ?? el("span"),
    el("span", "event-date mb-0", ora ? `${evento.dataFormattata()} · ${ora}` : evento.dataFormattata())
  );

  card.append(
    intestazione,
    el("div", "fw-bold mb-1", `${evento.casa} vs ${evento.trasferta}`),
    el("div", "appointment-league", evento.lega || squadra.lega)
  );
  col.append(card);
  return col;
}

// appuntamenti = array di { evento, squadra }, già ordinati
export function renderAppuntamenti(appuntamenti) {
  if (appuntamenti.length === 0) {
    const col = el("div", "col-12");
    col.append(el("p", "empty-msg mb-0", "Nessuna partita in programma per le tue squadre."));
    dom.appointmentsBox.replaceChildren(col);
    return;
  }
  dom.appointmentsBox.replaceChildren(...appuntamenti.map((a, i) => creaCardAppuntamento(a, i)));
}
