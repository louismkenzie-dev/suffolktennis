// Stage controller. record.mjs drives it through window.stage:
//   await stage.ready                       fonts + hero clip decoded
//   stage.scene(id, opts)                   switch to a scene (see SCENES)
//   stage.setText({ kicker, title, lines }) animate the text zone
//   stage.setStatus({ time, bg, ink })      phone status bar
//   stage.fade(on)                          fade to navy
//   stage.setLead("desk"|"phone")           which device leads (16:9 only)
//   stage.setTimeScale(t)                   slow every animation by t (capture)
//   stage.pump(on)                          continuous-repaint loop for capture
//   stage.seekHero(t)                       offline render: hero clip + title at t seconds
//   stage.layout                            "wide" | "tall"
(() => {
  const qs = new URLSearchParams(location.search);
  const layout = qs.get("layout") === "tall" ? "tall" : "wide";
  document.body.dataset.layout = layout;

  const $ = (id) => document.getElementById(id);
  const layers = { hero: $("hero"), app: $("app"), chapter: $("chapter"), end: $("end") };
  const heroVideo = $("heroVideo");
  const deskZone = $("deskZone");
  // 9:16 is phone-only (BRIEF shot list): drop the desktop window before its
  // iframe is ever loaded, so the tall recording pays nothing for it.
  if (layout === "tall" && deskZone) deskZone.remove();

  // Slow-motion capture (record.mjs --timescale). The live pass is driven at
  // 1/TS speed and the frame timestamps are divided back down, which is what
  // multiplies the effective frame rate. Everything timed on this page slows
  // with it: JS waits go through wait(), and every CSS animation/transition
  // gets playbackRate = 1/TS from the repaint pump.
  let TS = 1;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms * TS));
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  // Chapter cards hold 1.5 s (BRIEF shot list). captions.mjs assumes the same
  // number (CHAPTER_CARD_S) to centre the caption while a card is up.
  const CHAPTER_MS = 1500;

  // Scene copy. The recorder can override any field through opts.
  const SCENES = {
    1: { mode: "hero", kicker: "Suffolk Tennis", title: "Performance & Reports" },
    2: { mode: "app", lead: "desk", enter: true, kicker: "The Suffolk Tennis app", title: "Performance & Reports", lines: ["One app.", "Coaches capture it.", "Parents follow it."], status: { bg: "#ffffff" } },
    3: { mode: "app", lead: "phone", chapter: { kicker: "Chapter one", title: "For coaches", sub: "Register · Rate · Send" }, chapterMs: CHAPTER_MS, kicker: "For coaches", title: "It starts at the register", status: { bg: "#ffffff" } },
    4: { mode: "app", lead: "phone", kicker: "For coaches", title: "Nine areas. One tap each.", status: { bg: "#ffffff" } },
    5: { mode: "app", lead: "phone", kicker: "For coaches", title: "End session. Reports sent.", status: { bg: "#ffffff" } },
    6: { mode: "app", lead: "desk", chapter: { kicker: "Chapter two", title: "For parents", sub: "Your child's progress, in your pocket" }, chapterMs: CHAPTER_MS, kicker: "For parents", title: "It lands in your Parent Hub", status: { bg: "#ffffff" } },
    7: { mode: "app", lead: "desk", kicker: "For parents", title: "Every area. Every comment.", status: { bg: "#ffffff" } },
    8: { mode: "app", lead: "desk", kicker: "For parents", title: "Watch the trend", status: { bg: "#ffffff" } },
    9: { mode: "end" },
  };

  /* ----- sizing: scale the 418×916 phone into its zone ----- */
  function fitPhone() {
    const zone = document.querySelector(".phone-zone").getBoundingClientRect();
    const s = Math.min(zone.width / 418, zone.height / 916);
    document.documentElement.style.setProperty("--phone-scale", s.toFixed(4));
    return s;
  }
  window.addEventListener("resize", fitPhone);

  /* ----- text helpers ----- */
  function words(el, text, stagger = 0.16, delay = 0) {
    el.textContent = "";
    if (!text) return;
    text.split(/\s+/).forEach((w, i) => {
      const span = document.createElement("span");
      span.className = "w";
      span.textContent = w;
      span.style.animationDelay = `${(delay + i * stagger).toFixed(2)}s`;
      el.appendChild(span);
    });
  }

  function setText({ kicker, title, lines, stagger = 0.16, lineDelay = 1.2, lineStagger = 1.1 } = {}) {
    const k = $("kicker");
    if (kicker !== undefined) {
      k.classList.remove("on");
      k.textContent = kicker;
      void k.offsetWidth;
      k.classList.add("on");
    }
    if (title !== undefined) words($("title"), title, stagger, 0.15);
    const ul = $("lines");
    ul.textContent = "";
    (lines ?? []).forEach((t, i) => {
      const li = document.createElement("li");
      li.textContent = t;
      li.style.animationDelay = `${(lineDelay + i * lineStagger).toFixed(2)}s`;
      ul.appendChild(li);
    });
  }

  function setStatus({ time = "auto", bg, ink } = {}) {
    // "auto" shows the phone's real clock (the context runs on Europe/London). The
    // recorder passes a fixed time instead so the status bar agrees with the
    // frozen clock the mocked app prints (arrived / ended / sent).
    if (time === "auto") time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (time) $("statusTime").textContent = time;
    if (bg) document.documentElement.style.setProperty("--screen-bg", bg);
    if (ink) document.documentElement.style.setProperty("--status-ink", ink);
  }

  function show(name) {
    for (const [n, el] of Object.entries(layers)) el.classList.toggle("on", n === name);
  }

  /* ----- dip through navy: never dissolve one composed layout into another ----- */
  // 0.22 s to navy, switch layers while the frame is solid, 0.4 s back.
  async function dip(switchLayers) {
    const f = $("fade");
    f.classList.remove("out", "on");
    f.classList.add("dip");
    void f.offsetWidth;
    f.classList.add("on");
    await wait(240);
    for (const el of Object.values(layers)) el.classList.add("snap");
    switchLayers();
    await nextFrame();
    for (const el of Object.values(layers)) el.classList.remove("snap");
    f.classList.add("out");
    f.classList.remove("on");
    await wait(420);
    f.classList.remove("dip", "out");
  }

  let chapterTimer = null;
  function chapter({ kicker, title, sub }, holdMs) {
    const inner = document.querySelector(".chapter-inner");
    $("chapterKicker").textContent = kicker ?? "";
    // Copy starts once the card is opaque (the .layer fade is 0.3 s).
    words($("chapterTitle"), title, 0.14, 0.45);
    $("chapterSub").textContent = sub ?? "";
    inner.classList.remove("out");
    layers.chapter.classList.add("on");
    // Restart the rule/kicker/sub animations.
    for (const sel of [".chapter-rule", ".chapter-kicker", ".chapter-sub"]) {
      const el = document.querySelector(sel); el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
    }
    clearTimeout(chapterTimer);
    return new Promise((resolve) => {
      // Copy fades first, then the solid card lifts off the app.
      setTimeout(() => inner.classList.add("out"), Math.max(0, holdMs - 250) * TS);
      chapterTimer = setTimeout(() => { layers.chapter.classList.remove("on"); resolve(); }, holdMs * TS);
    });
  }

  function restartEndCard() {
    for (const el of layers.end.querySelectorAll(".lockup, .strap span, .url, .mascot")) { el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; }
  }

  /* ----- scenes ----- */
  async function scene(id, opts = {}) {
    const s = { ...(SCENES[id] ?? { mode: "app" }), ...opts };
    $("fade").classList.remove("on");
    if (s.mode === "hero") {
      $("heroKicker").textContent = s.kicker ?? "";
      $("heroKicker").classList.remove("on"); void $("heroKicker").offsetWidth; $("heroKicker").classList.add("on");
      words($("heroTitle"), s.title, 0.32, 0.9);
      show("hero");
      heroVideo.currentTime = 0;
      if (s.paused) { heroVideo.pause(); return; }
      try { await heroVideo.play(); } catch (e) { console.warn("hero play", e); }
      return;
    }
    if (s.mode === "end") {
      await dip(() => { show("end"); restartEndCard(); heroVideo.pause(); });
      return;
    }
    // app
    setStatus(s.status ?? {});
    const phone = $("phone");
    fitPhone();
    const wasOn = layers.app.classList.contains("on");
    if (s.chapter) {
      // Card first; the recorder navigates the app behind it once the card is
      // opaque. Text zone and phone are switched while the card covers them.
      const p = chapter(s.chapter, s.chapterMs ?? CHAPTER_MS);
      setTimeout(() => { show("app"); layers.chapter.classList.add("on"); setText(s); setLead(s.lead); }, 350 * TS);
      // Show returns immediately; the card resolves on its own.
      await p;
      return;
    }
    const enter = s.enter && !wasOn;
    const switchLayers = () => {
      setLead(s.lead);
      if (enter) { phone.classList.remove("enter"); void phone.offsetWidth; phone.classList.add("enter"); }
      setText(s);
      show("app");
      heroVideo.pause();
    };
    // Coming from the hero (or the end card): dip through navy instead of
    // cross-fading the hero title into the stage title.
    if (!wasOn) await dip(switchLayers); else switchLayers();
  }

  function fade(on = true) { $("fade").classList.toggle("on", on); }

  /* ----- which device leads this scene (16:9 only) ----- */
  // The active device is full opacity and a little forward; the other sits
  // back, dimmed and slightly smaller (stage.css .lead / .back). The tall cut
  // has no desktop, so the phone always leads there.
  function setLead(which) {
    if (!which) return;
    const devs = { desk: $("desk"), phone: $("phone") };
    const lead = deskZone && devs.desk ? which : "phone";
    for (const [name, el] of Object.entries(devs)) {
      if (!el) continue;
      el.classList.toggle("lead", name === lead);
      el.classList.toggle("back", name !== lead);
    }
  }

  /* ----- continuous repaint pump + slow motion ----- */
  // Chromium's screencast only emits a frame when something is drawn, so a
  // 1 px element is repainted (colour) and re-composited (transform) on every
  // requestAnimationFrame. A repaint on the parent composites the whole
  // viewport, both app iframes included. The same loop keeps every running
  // animation at playbackRate 1/TS.
  let pumpOn = false, pumpEl = null;
  function scaleAnimations() {
    if (TS === 1) return;
    const r = 1 / TS;
    for (const a of document.getAnimations()) { if (a.playbackRate !== r) a.playbackRate = r; }
  }
  function pump(on = true) {
    pumpOn = !!on;
    if (!pumpOn) { if (pumpEl) { pumpEl.remove(); pumpEl = null; } return false; }
    if (!pumpEl) {
      pumpEl = document.createElement("div");
      pumpEl.id = "pump";
      // Navy on navy in the top-left corner: 1 px, invisible in the cut.
      pumpEl.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;z-index:2147483647;pointer-events:none;will-change:transform,background-color;background:#0E1D39";
      document.documentElement.appendChild(pumpEl);
    }
    let k = 0;
    const step = () => {
      if (!pumpOn) return;
      k++;
      pumpEl.style.backgroundColor = k % 2 ? "#0E1D39" : "#0E1D3A";
      pumpEl.style.transform = `translateX(${(k % 2) * 0.01}px)`;
      scaleAnimations();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return true;
  }
  function setTimeScale(t = 1) {
    TS = Math.max(0.05, Number(t) || 1);
    document.documentElement.style.setProperty("--ts", String(TS));
    heroVideo.playbackRate = 1 / TS;
    scaleAnimations();
    return TS;
  }
  /** Restart the background sweep after seekHero() paused every animation. */
  function resumeBackground() {
    const g = document.querySelector(".ground");
    if (g) for (const a of g.getAnimations()) a.play();
    scaleAnimations();
  }

  /* ----- offline hero render: pose everything at t seconds ----- */
  // Used by record.mjs to render scene 1 frame by frame at exactly 25 fps
  // (the live screencast cannot keep up with full-frame b-roll). Every CSS
  // animation/transition on the page and the clip itself are seeked to t.
  async function seekHero(t) {
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = t * 1000; }
    if (Math.abs(heroVideo.currentTime - t) > 0.0005) {
      await new Promise((resolve) => {
        const done = () => { heroVideo.removeEventListener("seeked", done); resolve(); };
        heroVideo.addEventListener("seeked", done);
        setTimeout(done, 2000);
        heroVideo.currentTime = t;
      });
    }
    await nextFrame();
    return { video: heroVideo.currentTime, animations: document.getAnimations().length };
  }

  const ready = (async () => {
    fitPhone();
    await document.fonts.ready;
    // Pull the faces the stage actually uses so the first frame is already in Archivo/Hanken.
    await Promise.all([
      document.fonts.load('700 40px "Archivo"'),
      document.fonts.load('500 20px "Hanken Grotesk"'),
      document.fonts.load('600 20px "Hanken Grotesk"'),
    ]).catch(() => {});
    await new Promise((resolve) => {
      if (heroVideo.readyState >= 4) return resolve();
      heroVideo.addEventListener("canplaythrough", resolve, { once: true });
      heroVideo.addEventListener("error", resolve, { once: true });
      setTimeout(resolve, 8000);
    });
    const fams = [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, ""));
    return { layout, phoneScale: fitPhone(), fonts: { archivo: fams.includes("Archivo"), hanken: fams.includes("Hanken Grotesk") }, heroReady: heroVideo.readyState >= 3 };
  })();

  window.stage = { ready, scene, setText, setStatus, fade, dip, seekHero, fitPhone, setLead, setTimeScale, pump, resumeBackground, layout, SCENES, layers, CHAPTER_MS };
})();
