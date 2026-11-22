/* Mira: tolerantere Befehlserkennung. Ersetzt handle() aus index.html. Alles läuft lokal auf dem Tablet. */
(() => {
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const N1 = {null:0,ein:1,eins:1,eine:1,einer:1,zwei:2,zwo:2,drei:3,vier:4,fünf:5,sechs:6,sieben:7,acht:8,neun:9,zehn:10,elf:11,zwölf:12,dreizehn:13,vierzehn:14,fünfzehn:15,sechzehn:16,siebzehn:17,achtzehn:18,neunzehn:19};
  const N10 = {zwanzig:20,dreißig:30,dreissig:30,vierzig:40,fünfzig:50};
  const MONTHS = {januar:1,februar:2,märz:3,maerz:3,april:4,mai:5,juni:6,juli:7,august:8,september:9,oktober:10,november:11,dezember:12};
  const ORD = {erste:1,dritte:3,siebte:7,achte:8};
  const DAYS = ["sonntag","montag","dienstag","mittwoch","donnerstag","freitag","samstag"];
  const TOK = "(\\d{1,2}|[a-zäöüß]+(?:\\s+und\\s+[a-zäöüß]+)?)";
  const p2 = n => String(n).padStart(2, "0");
  const isoD = d => d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());

  function numw(s) {
    s = String(s).trim().toLowerCase().replace(/\s+und\s+/, "und");
    if (/^\d{1,2}$/.test(s)) return +s;
    if (has(N1, s)) return N1[s];
    if (has(N10, s)) return N10[s];
    const m = s.match(/^(ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun)und(zwanzig|dreißig|dreissig|vierzig|fünfzig)$/);
    return m ? N1[m[1]] + N10[m[2]] : NaN;
  }
  function ordw(w) {
    w = w.toLowerCase().replace(/[nrsm]$/, "");
    if (has(ORD, w)) return ORD[w];
    for (const suf of ["ste", "te"]) if (w.endsWith(suf)) { const n = numw(w.slice(0, -suf.length)); if (!isNaN(n)) return n; }
    return NaN;
  }

  // Datum und Uhrzeit aus gesprochenem Text lesen ("morgen um halb zehn", "am dritten dezember um zehn uhr dreißig")
  function when(s) {
    s = " " + s + " ";
    let d = null, hh = null, mm = 0;
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const add = n => { const x = new Date(t0); x.setDate(x.getDate() + n); return x; };
    s = s.replace(/(?:\bum\s+)?\b(\d{1,2}):(\d{2})\b(?:\s*uhr)?/, (m, a, b) => { hh = +a; mm = +b; return " "; });
    if (hh === null) s = s.replace(new RegExp("\\b(viertel nach|viertel vor|dreiviertel|halb|viertel)\\s+" + TOK + "(?:\\s+uhr)?(?=\\s)"), (m, k, a) => {
      const n = numw(a); if (isNaN(n) || n < 1 || n > 24) return m;
      if (k === "viertel nach") { hh = n; mm = 15; }
      else if (k === "viertel vor" || k === "dreiviertel") { hh = (n - 1) || 12; mm = 45; }
      else if (k === "halb") { hh = (n - 1) || 12; mm = 30; }
      else { hh = (n - 1) || 12; mm = 15; }
      return " ";
    });
    if (hh === null) s = s.replace(new RegExp("(?:\\bum\\s+)?\\b" + TOK + "\\s+uhr(?:\\s+" + TOK + ")?"), (m, a, b) => {
      const x = numw(a); if (isNaN(x) || x > 24) return m;
      let tail = "";
      if (b !== undefined) { const y = numw(b); if (!isNaN(y) && y < 60) mm = y; else tail = " " + b; }
      hh = x; return " " + tail + " ";
    });
    if (hh !== null) {
      if (/nachmittag|abend/.test(s) && hh < 12) hh += 12;
      else if (hh >= 1 && hh <= 5 && !/morgens|früh|nachts|vormittag/.test(s)) hh += 12;
      hh = hh % 24;
    }
    s = s.replace(/\sübermorgen(?=\s)/, () => (d = add(2), " "));
    s = s.replace(/\bmorgen\b/, () => (d = add(1), " "));
    s = s.replace(/\bheute\b/, () => (d = add(0), " "));
    s = s.replace(new RegExp("\\bin\\s+" + TOK + "\\s+(tag|tagen|woche|wochen)\\b"), (m, a, u) => {
      const n = numw(a); if (isNaN(n)) return m; d = add(n * (u[0] === "w" ? 7 : 1)); return " ";
    });
    s = s.replace(/\b(?:nächste|nächsten|kommende|kommenden)\s+woche\b/, () => (d = add(7), " "));
    s = s.replace(new RegExp("(?:\\bam\\s+)?\\b" + TOK + "\\.?\\s+(" + Object.keys(MONTHS).join("|") + ")(?:\\s+(\\d{4}))?\\b"), (m, a, mo, y) => {
      let day = /^\d/.test(a) ? +a : ordw(a); if (isNaN(day)) day = numw(a);
      if (isNaN(day) || day < 1 || day > 31) return m;
      const yy = y ? +y : t0.getFullYear();
      let x = new Date(yy, MONTHS[mo] - 1, day);
      if (!y && x < t0) x = new Date(yy + 1, MONTHS[mo] - 1, day);
      d = x; return " ";
    });
    s = s.replace(/(?:\bam\s+)?\b(\d{1,2})\.(\d{1,2})\.?(\d{4})?\b/, (m, a, b, c) => {
      if (+a < 1 || +a > 31 || +b < 1 || +b > 12) return m;
      const yy = c ? +c : t0.getFullYear();
      let x = new Date(yy, +b - 1, +a);
      if (!c && x < t0) x = new Date(yy + 1, +b - 1, +a);
      d = x; return " ";
    });
    s = s.replace(new RegExp("(?:\\b(?:am|nächsten|kommenden)\\s+)?\\b(" + DAYS.join("|") + ")\\b"), (m, w) => {
      d = add((DAYS.indexOf(w) - t0.getDay() + 7) % 7 || 7); return " ";
    });
    const rest = s.replace(/\b(am|um|den|für|bitte|mira|morgens|vormittags|nachmittags|abends|früh|nachts|gegen)\b/g, " ").replace(/\s+/g, " ").trim();
    return { d: d ? isoD(d) : null, h: hh === null ? "" : p2(hh) + ":" + p2(mm), rest };
  }

  function clean(raw) {
    let q = raw.trim().toLowerCase().replace(/[.!?]+(?=\s|$)/g, " ").replace(/[„“"]/g, "").replace(/\s+/g, " ").trim();
    for (let i = 0; i < 3; i++) q = q.replace(/^(bitte|mira|hey|kannst du mir|kannst du|könntest du mir|könntest du|würdest du|ich möchte|ich will|ich würde gerne|mach mal|sag mal)\s+/, "");
    return q.replace(/\beinkaufs?[\s-]*(liste|zettel)\b/g, "liste");
  }

  function showEvents(day) {
    const up = upcoming().filter(v => !day || v.d === day);
    say(up.length ? up.map(v => label(v) + ": " + v.t).join("\n") : (day ? "An dem Tag steht nichts an." : "Es stehen keine Termine an."));
  }

  const HELP = "Das kann ich (immer erst „Hey Mira“ sagen):\n" +
    "• Einkaufsliste: „Setze Milch und Brot auf die Einkaufsliste“, „Ich brauche noch Eier“, „Streiche Milch von der Liste“, „Hake Brot ab“, „Was steht auf der Liste“, „Sende die Liste ans Handy“, „Leere die Liste“\n" +
    "• Termine: „Termin morgen um zehn Uhr Zahnarzt“, „Erinnere mich am dritten Dezember um halb vier an den Friseur“, „Welche Termine habe ich“, „Was habe ich morgen“, „Lösche Termin Zahnarzt“\n" +
    "• Wissen: „Rezept Kürbissuppe“, „Was ist Quinoa“, „Suche Hildesheim“\n" +
    "Kaufen und Bestellen kann ich nicht. Die Liste steht auch links unter „Sprachbefehle“.";

  function handle(raw) {
    const q = clean(raw); let m;
    if (!q) return;
    if (/^(hilfe|befehle|sprachbefehle|was kannst du|was kann ich sagen|was kann ich dich fragen)\b/.test(q)) return say(HELP);
    if (/(bestell|bezahl|überweis)/.test(q) || (/\b(kauf|kaufe|kaufst|kaufen)\b/.test(q) && !/liste|\bwas\b|\bmuss|\bmüssen|brauch|fehlt|noch/.test(q)))
      return say("Bestellen, Kaufen und Bezahlen kann ich nicht und werde es nie können. Ich kann dir aber etwas auf die Einkaufsliste setzen oder für dich suchen.");
    if (/\b(sende|senden|schicke|schicken|schick|teile|teilen)\b.*\b(liste|handy)\b|\bliste\b.*\b(ans handy|aufs handy|an mein handy|auf mein handy|senden|schicken)\b/.test(q)) return sendList();
    if (/^(leere|leeren|lösche|lösch|räume)\s+(die\s+|meine\s+|unsere\s+)?liste(\s+(auf|komplett|ganz|aus))?$|^liste\s+(leeren|löschen|zurücksetzen)$|^(neue liste|liste neu)$/.test(q)) {
      items = []; persist(); return say("Die Liste ist jetzt leer.");
    }
    if (/\b(zeige|zeig|lies|nenne|sag|gib)\b.*\bliste\b|^liste(\s+(anzeigen|vorlesen))?$|\bwas\b.*\b(auf der liste|in der liste|auf meiner liste|fehlt|brauchen wir|brauche ich|muss ich (noch )?(kaufen|einkaufen|besorgen))/.test(q))
      return say(listText() || "Die Liste ist leer.");
    if ((m = q.match(/^(?:hake|hak|haken)\s+(.+?)\s+ab$/) || q.match(/^(?:ich habe|wir haben)\s+(.+?)\s+(?:gekauft|besorgt|erledigt)$/) || q.match(/^(.+?)\s+(?:ist|sind)\s+(?:erledigt|gekauft|besorgt)$/))) {
      const k = m[1].replace(/^(die|den|das|der|ein|eine|einen)\s+/, "");
      const it = items.find(x => x.t.toLowerCase().includes(k));
      if (!it) return say("„" + cap(k) + "“ steht nicht auf der Liste.");
      it.done = true; persist(); return say("„" + it.t + "“ ist abgehakt.");
    }
    if (/(?:lösche|lösch|streiche|streich|entferne|storniere|absagen|sage\s+ab).*termin/.test(q)) {
      const k = q.replace(/\b(lösche|lösch|streiche|streich|entferne|storniere|absagen|sage|ab|den|das|termin|am|um|bitte)\b/g, " ").replace(/\s+/g, " ").trim();
      const i = k ? events.findIndex(v => v.t.toLowerCase().includes(k)) : -1;
      if (i < 0) return say("Welchen Termin meinst du? Du kannst ihn auch rechts mit × löschen.");
      const v = events.splice(i, 1)[0]; persist(); return say("Termin „" + v.t + "“ ist gelöscht.");
    }
    if ((m = q.match(/^(?:streiche|streich|lösche|lösch|entferne|entfern|nimm|nehme)\s+(.+?)(?:\s+(?:von|aus|auf)\s+(?:der|die|meiner|unserer)\s+liste|\s+(?:raus|weg|heraus|runter))?$/))) {
      const k = m[1].replace(/^(die|den|das|der|ein|eine|einen)\s+/, "").replace(/\s+liste$/, "");
      const i = items.findIndex(x => x.t.toLowerCase().includes(k));
      if (i < 0) return say("„" + cap(k) + "“ steht nicht auf der Liste.");
      const it = items.splice(i, 1)[0]; persist(); return say("„" + it.t + "“ ist von der Liste gestrichen.");
    }
    const w = when(q);
    const asks = /^(was|welche|wann|habe ich|haben wir|gibt es|zeig|zeige|lies|sag|nenne|steht|stehen)\b.*(termin|kalender|steht|stehen|anstehen|vor)|^(termine|kalender|meine termine|die termine)\b/.test(q)
      || (/^(was habe ich|was haben wir|was steht|was ist (los|geplant))\b/.test(q) && (w.d || /anstehen|an$/.test(q)));
    if (asks) return showEvents(w.d);
    if ((w.d || w.h) && /termin|erinner|trag|eintrag|notier|merk|kalender/.test(q)) {
      const day = w.d || isoD(new Date());
      const t = cap(w.rest.replace(/\b(erinnere mich|in den kalender|in meinen kalender|im kalender|neuer|neuen|termin|trage|trag|eintragen|erinnere|erinner|merke|merk|notiere|notier|kalender|ein|habe|hab|ich|mich|mir|dass|bitte)\b/g, " ").replace(/\s+/g, " ").trim()) || "Termin";
      events.push({ d: day, h: w.h, t }); persist();
      return say("Eingetragen: " + t + ", " + label({ d: day, h: w.h }) + ".");
    }
    if (/termin|kalender/.test(q)) {
      if (/neu|trag|eintrag/.test(q)) return say("Für welchen Tag? Zum Beispiel: Termin morgen um zehn Uhr Zahnarzt.");
      return showEvents(null);
    }
    if (/\bliste\b/.test(q)) {
      const t = q.replace(/\b(?:auf|in|zu|zur|zum|an|bei|von)\s+(?:die|der|dem|meine|meiner|unsere|unserer)?\s*liste\b/g, " ").replace(/\bliste\b/g, " ")
        .replace(/\b(setze|setz|schreibe|schreib|füge|füg|pack|packe|tue|tu|notiere|merke|stelle|stell|trage|trag|nimm|hinzufügen|hinzu|setzen|schreiben|packen|machen|mach|bitte|mal|noch|doch|auch|mir|uns|dazu|drauf|darauf|jetzt|schnell|ich|brauche|brauch|wir|brauchen)\b/g, " ")
        .replace(/\s+/g, " ").trim();
      return addItems(t);
    }
    if ((m = q.match(/^(?:ich muss noch|ich muss|wir müssen noch|wir müssen|ich brauche noch|ich brauche|ich brauch noch|ich brauch|wir brauchen noch|wir brauchen|besorge|besorg|denk an|denke an|vergiss nicht)\s+(.+)$/)))
      return addItems(m[1].replace(/\s+(kaufen|besorgen|einkaufen|mitbringen|holen)$/, "").replace(/^noch\s+/, ""));
    if (/rezept|\bkoche\b|\bkochen\b/.test(q)) {
      const t = q.replace(/\b(suche|such|zeige|zeig|mir|ein|eine|einen|das|nach|für|rezept|rezepte|wie|koche|kochen|ich|kann|man|zum|von|bitte|was|soll|heute|gibt|es|ideen|idee)\b/g, " ").replace(/\s+/g, " ").trim();
      return recipe(t || q);
    }
    if ((m = q.match(/^(?:suche|such|recherchiere|recherchier|google|finde|informiere mich über|erzähl mir (?:etwas |was )?(?:über|von)|erkläre mir|erklär mir|erkläre|was ist|was sind|was bedeutet|wer ist|wer war|wer sind|wie funktioniert|wo liegt|wann war|warum)\s+(?:nach\s+)?(.+)$/)))
      return lookup(m[1]);
    say("Das habe ich nicht verstanden: „" + raw.trim() + "“\nSag „Hilfe“ für eine Liste der Befehle, oder öffne links „Sprachbefehle“.");
  }

  window.handle = handle;
})();
