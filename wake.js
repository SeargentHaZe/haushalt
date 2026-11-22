/* Mira: Offline-Spracherkennung mit Vosk. Audio bleibt auf dem Tablet, nichts wird gespeichert. */
(() => {
  const $ = s => document.querySelector(s);
  const btn = $("#mic"), stateEl = $("#state"), heard = $("#heard"), show = $("#showheard"), dot = $("#dot");
  const IDLE = "Mikrofon an, warte auf „Hey Mira“";
  // Das kleine deutsche Modell kennt „Mira“ evtl. nicht und hört dann ähnliche Wörter. Varianten hier ergänzen.
  const WAKE = /(?:^|\s)(?:(?:hey|hei|hej|hallo|hi|okay|ok|he)\s+m[a-zäöüß]{1,5}(?:\s+a)?|mira|myra|miera|meera|mirra)(?=\s|$)/;
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

  async function checkModelFile() {
    const r = await fetch("model.tar.gz");
    if (!r.ok) throw new Error("model.tar.gz nicht gefunden (Status " + r.status + ")");
    const enc = r.headers.get("content-encoding");
    const total = +r.headers.get("content-length") || 0;
    const reader = r.body.getReader();
    let got = 0, head = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!head) head = value.slice(0, 2);
      got += value.length;
      setState("Sprachmodell wird heruntergeladen … " + (got / 1e6).toFixed(0) + (total ? " von " + (total / 1e6).toFixed(0) : "") + " MB");
    }
    console.log("model.tar.gz:", got, "Bytes, Content-Encoding:", enc, "erste Bytes:", head && [...head]);
    if (!head || head[0] !== 0x1f || head[1] !== 0x8b)
      throw new Error("model.tar.gz ist kein gz-Archiv (erste Bytes: " + (head ? [...head].map(b => b.toString(16)).join(" ") : "keine") + (enc ? ", Content-Encoding: " + enc : "") + ")");
    if (got < 20e6) throw new Error("model.tar.gz ist zu klein (" + (got / 1e6).toFixed(1) + " MB)");
  }

  async function start() {
    btn.disabled = true;
    try {
      setState("Sprachmodell wird geladen (beim ersten Mal ca. 46 MB) …");
      if (!model) {
        await checkModelFile();
        const t0 = Date.now();
        const tick = setInterval(() => setState("Sprachmodell wird entpackt und geladen … " + Math.round((Date.now() - t0) / 1000) + " s (kann einige Minuten dauern)"), 1000);
        try {
          model = await Promise.race([
            Vosk.createModel(new URL("model.tar.gz", location.href).href),
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
      console.error(e);
      if (e && e.name === "NotAllowedError") setState("Mikrofon nicht erlaubt. Erlaube es in den Browser-Einstellungen für diese Seite und schalte es neu ein.");
      else setState("Fehler: " + (e && e.message ? e.message : "Sprachmodell oder Mikrofon nicht verfügbar"));
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
