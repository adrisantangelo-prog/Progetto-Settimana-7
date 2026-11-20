// =========================================================
// api.js – DATI
// Classi Squadra ed Evento + tutte le chiamate a TheSportsDB.
// È l'unico file che usa fetch e non tocca mai la pagina.
// =========================================================

const API_BASE = "https://www.thesportsdb.com/api/v1/json/123/";

// Etichette italiane e colori (variabili CSS) per sport
export const SPORT = {
  "Soccer": { label: "Calcio", colore: "--sport-soccer" },
  "Basketball": { label: "Basket", colore: "--sport-basket" },
  "American Football": { label: "Football", colore: "--sport-football" },
  "Rugby": { label: "Rugby", colore: "--sport-rugby" },
};

// Traduzione degli stati partita più comuni restituiti dall'API
const STATI = {
  "Not Started": "Da giocare",
  "NS": "Da giocare",
  "Match Finished": "Terminata",
  "FT": "Terminata",
  "AET": "Terminata ai supplementari",
  "PEN": "Terminata ai rigori",
  "Postponed": "Rinviata",
  "Cancelled": "Annullata",
};

// =========================================================
// CLASSI
// =========================================================

export class Squadra {
  constructor(dati) {
    // Accetta sia i dati grezzi dell'API sia un oggetto già salvato in localStorage
    this.id = dati.idTeam ?? dati.id;
    this.nome = dati.strTeam ?? dati.nome;
    this.logo = dati.strBadge ?? dati.logo ?? "";
    this.lega = dati.strLeague ?? dati.lega ?? "";
    this.paese = dati.strCountry ?? dati.paese ?? "";
    this.sport = dati.strSport ?? dati.sport ?? "";
  }

  get sportLabel() {
    return SPORT[this.sport]?.label ?? this.sport;
  }
}

export class Evento {
  static fmtData = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  static fmtDataLunga = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  static fmtOra = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" });
  static rtf = new Intl.RelativeTimeFormat("it", { numeric: "auto" });

  constructor(dati) {
    this.id = dati.idEvent;
    this.nome = dati.strEvent ?? "";
    this.data = dati.dateEvent;
    this.casa = dati.strHomeTeam;
    this.trasferta = dati.strAwayTeam;
    this.punteggioCasa = dati.intHomeScore;
    this.punteggioTrasferta = dati.intAwayScore;
    // campi extra, usati nella modale
    this.lega = dati.strLeague ?? "";
    this.stagione = dati.strSeason ?? "";
    this.giornata = dati.intRound ?? "";
    this.stadio = dati.strVenue ?? "";
    this.citta = dati.strCity ?? "";
    this.paese = dati.strCountry ?? "";
    this.logoCasa = dati.strHomeTeamBadge ?? "";
    this.logoTrasferta = dati.strAwayTeamBadge ?? "";
    this.thumb = dati.strThumb ?? "";
    this.stato = dati.strStatus ?? "";
    this.orario = dati.strTime ?? "";
    this.timestamp = dati.strTimestamp ?? "";
  }

  // L'orario dell'API è in UTC
  haOrario() {
    if (this.timestamp) return true;
    return /^\d{2}:\d{2}/.test(this.orario) && !this.orario.startsWith("00:00");
  }

  dataOra() {
    if (this.timestamp) {
      const ts = /Z|[+-]\d{2}:?\d{2}$/.test(this.timestamp) ? this.timestamp : `${this.timestamp}Z`;
      const d = new Date(ts);
      if (!Number.isNaN(d.getTime())) return d;
    }
    if (!this.data) return null;
    if (this.haOrario()) {
      return new Date(`${this.data}T${this.orario.slice(0, 5)}:00Z`);
    }
    // senza orario: mezzanotte locale (evita lo slittamento di un giorno)
    return new Date(`${this.data}T00:00:00`);
  }

  dataFormattata() {
    const d = this.dataOra();
    return d ? Evento.fmtData.format(d) : "Data da definire";
  }

  dataLunga() {
    const d = this.dataOra();
    if (!d) return "Data da definire";
    const testo = Evento.fmtDataLunga.format(d); // "lunedì 23 novembre 2026"
    return testo.charAt(0).toUpperCase() + testo.slice(1);
  }

  oraFormattata() {
    return this.haOrario() ? Evento.fmtOra.format(this.dataOra()) : "";
  }

  // Giorni che mancano alla partita (negativo se è già passata)
  giorniMancanti() {
    const d = this.dataOra();
    if (!d) return null;
    const giornoPartita = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const oggi = new Date();
    const giornoOggi = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
    return Math.round((giornoPartita - giornoOggi) / 86_400_000);
  }

  // "oggi", "domani", "tra 5 giorni", "3 giorni fa"
  countdown() {
    const giorni = this.giorniMancanti();
    return giorni === null ? "" : Evento.rtf.format(giorni, "day");
  }

  haPunteggio() {
    const valido = (v) => v !== null && v !== undefined && v !== "";
    return valido(this.punteggioCasa) && valido(this.punteggioTrasferta);
  }

  // "3 : 1" stile tabellone, oppure stringa vuota
  punteggio() {
    return this.haPunteggio() ? `${this.punteggioCasa} : ${this.punteggioTrasferta}` : "";
  }

  statoTradotto() {
    return STATI[this.stato] ?? this.stato;
  }

  // Chiave per ordinare per data
  ordine() {
    return this.dataOra()?.getTime() ?? Number.POSITIVE_INFINITY;
  }
}

// =========================================================
// CHIAMATE API (con cache)
// =========================================================

const cacheRicerche = new Map(); // "arsenal" -> [Squadra, ...]
const cacheEventi = new Map();   // idTeam    -> Promise<{prossimi, ultimi}>
const eventiPerId = new Map();   // idEvent   -> { evento, idTeam }

// ---------- funzioni interne (non esportate) ----------

function costruisciUrl(endpoint, params) {
  const url = new URL(endpoint, API_BASE);
  for (const [chiave, valore] of Object.entries(params)) {
    url.searchParams.set(chiave, valore);
  }
  return url;
}

async function getJson(url, signal) {
  const risposta = await fetch(url, { signal });
  if (!risposta.ok) {
    throw new Error(`Errore HTTP ${risposta.status}`);
  }
  return risposta.json();
}

async function scaricaEventi(idTeam) {
  const urlNext = costruisciUrl("eventsnext.php", { id: idTeam });
  const urlLast = costruisciUrl("eventslast.php", { id: idTeam });

  // Le due chiamate partono in parallelo
  const [next, last] = await Promise.all([getJson(urlNext), getJson(urlLast)]);

  const prossimi = (next.events ?? []).map((e) => new Evento(e));
  const ultimi = (last.results ?? []).map((e) => new Evento(e));

  // Salvo ogni evento per poterlo riaprire nella modale dal suo id
  [...prossimi, ...ultimi].forEach((evento) => eventiPerId.set(evento.id, { evento, idTeam }));

  return { prossimi, ultimi };
}

// ---------- funzioni pubbliche ----------

export function haRicercaInCache(query) {
  return cacheRicerche.has(query.toLowerCase());
}

// Cerca squadre per nome; la stessa ricerca non viene ripetuta
export async function cercaSquadre(query, signal) {
  const chiave = query.toLowerCase();
  if (cacheRicerche.has(chiave)) return cacheRicerche.get(chiave);

  const url = costruisciUrl("searchteams.php", { t: query });
  const dati = await getJson(url, signal);
  const squadre = (dati.teams ?? []).map((t) => new Squadra(t));

  cacheRicerche.set(chiave, squadre);
  return squadre;
}

// Prossime partite + ultimi risultati; ogni squadra si scarica una volta sola
export function caricaEventi(idTeam) {
  if (!cacheEventi.has(idTeam)) {
    const promessa = scaricaEventi(idTeam).catch((err) => {
      cacheEventi.delete(idTeam); // in caso di errore si potrà riprovare
      throw err;
    });
    cacheEventi.set(idTeam, promessa);
  }
  return cacheEventi.get(idTeam);
}

// Ritrova un evento già scaricato a partire dal suo id
export function trovaEvento(idEvento) {
  return eventiPerId.get(idEvento) ?? null;
}
