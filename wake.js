/* Mira: Offline-Spracherkennung mit Vosk. Audio bleibt auf dem Tablet, nichts wird gespeichert. */
(() => {
  const $ = s => document.querySelector(s);
  const btn = $("#mic"), stateEl = $("#state"), heard = $("#heard"), show = $("#showheard"), dot = $("#dot");
  const IDLE = "Mikrofon an, warte auf „Hey Mira“";
  // Das kleine deutsche Modell kennt „Mira“ evtl. nicht und hört dann ähnliche Wörter. Varianten hier ergänzen.
  const WAKE = /(?:^|\s)(?:(?:hey|hei|hej|hallo|hi|okay|ok)\s+(?:mir\s?a|mir|mia|maria|mehr\s?a|mirra)|mira|myra|miera|meera|mirra)(?=\s|$)/;
  let model = null, rec = null, ctx = null, stream = null, node = null, src = null, lock = null;
  let on = false, armed = 0, hideT;

  const setState = t => { stateEl.textContent = t; };
  function shown(t) {
    if (!show.checked) return;
    heard.textContent = "Gehört: " + t;
    clearTimeout(hideT);
    hideT = setTimeout(() => { heard.textContent = ""; }, 6000);
  }
  function beep(f) {
    try {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; g.gain.value = 0.08;
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  }
  function run(cmd) { say(cmd, null, true); handle(cmd); }

  function onResult(t) {
    t = (t || "").trim();
    if (t.length < 2) return;
    shown(t);
    const m = t.match(WAKE);
    if (m) {
      const cmd = t.slice(m.index + m[0].length).trim();
      if (cmd) { armed = 0; beep(660); setState(IDLE); return run(cmd); }
      armed = Date.now() + 8000;
      beep(880); setState("Mira hört zu …");
      setTimeout(() => { if (armed && Date.now() >= armed) { armed = 0; setState(IDLE); } }, 8200);
      return;
    }
    if (armed && Date.now() < armed) {
      armed = 0; beep(660); setState(IDLE); run(t);
    }
  }

  async function start() {
    btn.disabled = true;
    try {
      setState("Sprachmodell wird geladen (beim ersten Mal ca. 46 MB) …");
      if (!model) {
        const h = await fetch("model.tar.gz", { method: "HEAD" });
        if (!h.ok) throw new Error("model.tar.gz nicht gefunden (Status " + h.status + ")");
        const t0 = Date.now();
        const tick = setInterval(() => setState("Sprachmodell wird geladen … " + Math.round((Date.now() - t0) / 1000) + " s"), 1000);
        try {
          model = await Promise.race([
            Vosk.createModel("model.tar.gz"),
            new Promise((_, rej) => setTimeout(() => rej(new Error("Zeitüberschreitung nach 3 Minuten beim Laden des Sprachmodells")), 180000))
          ]);
        } finally { clearInterval(tick); }
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
      ctx = new AudioContext();
      if (ctx.state === "suspended") await ctx.resume();
      rec = new model.KaldiRecognizer(ctx.sampleRate);
      rec.on("result", m => onResult(m.result && m.result.text));
      rec.on("partialresult", m => { if (m.result && m.result.partial) shown(m.result.partial); });
      node = ctx.createScriptProcessor(4096, 1, 1);
      node.onaudioprocess = e => { try { rec.acceptWaveform(e.inputBuffer); } catch (err) {} };
      src = ctx.createMediaStreamSource(stream);
      src.connect(node); node.connect(ctx.destination);
      try { lock = await navigator.wakeLock.request("screen"); } catch (e) {}
      on = true; dot.classList.add("on");
      btn.textContent = "Mikrofon ausschalten"; setState(IDLE);
    } catch (e) {
      stop();
      setState("Fehler: " + (e && e.message ? e.message : "Sprachmodell oder Mikrofon nicht verfügbar") + ". Prüfe, ob model.tar.gz hochgeladen ist und das Mikrofon erlaubt wurde.");
    }
    btn.disabled = false;
  }

  function stop() {
    try { node && node.disconnect(); } catch (e) {}
    try { src && src.disconnect(); } catch (e) {}
    try { stream && stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    try { rec && rec.remove(); } catch (e) {}
    try { ctx && ctx.close(); } catch (e) {}
    try { lock && lock.release(); } catch (e) {}
    node = src = stream = rec = ctx = lock = null;
    on = false; armed = 0;
    dot.classList.remove("on"); btn.textContent = "Mikrofon einschalten";
    heard.textContent = "";
  }

  btn.onclick = () => { if (on) { stop(); setState("Mikrofon aus"); } else start(); };
  document.addEventListener("visibilitychange", async () => {
    if (on && document.visibilityState === "visible") { try { lock = await navigator.wakeLock.request("screen"); } catch (e) {} }
  });
})();
