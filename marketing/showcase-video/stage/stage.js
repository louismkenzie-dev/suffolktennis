// Stage controller. record.mjs drives it through window.stage:
//   await stage.ready                       fonts + hero clip decoded
//   stage.scene(id, opts)                   switch to a scene (see SCENES)
//   stage.setText({ kicker, title, lines }) animate the text zone
//   stage.setStatus({ time, bg, ink })      phone status bar
//   stage.fade(on)                          fade to navy
//   stage.layout                            "wide" | "tall"
(() => {
  const qs = new URLSearchParams(location.search);
  const layout = qs.get("layout") === "tall" ? "tall" : "wide";
  document.body.dataset.layout = layout;

  const $ = (id) => document.getElementById(id);
  const layers = { hero: $("hero"), app: $("app"), chapter: $("chapter"), end: $("end") };
  const heroVideo = $("heroVideo");

  // Scene copy. The recorder can override any field through opts.
  const SCENES = {
    1: { mode: "hero", kicker: "Suffolk Tennis", title: "Performance & Reports" },
    2: { mode: "app", enter: true, kicker: "The Suffolk Tennis app", title: "Performance & Reports", lines: ["One app.", "Coaches capture it.", "Parents follow it."], status: { bg: "#ffffff" } },
    3: { mode: "app", chapter: { kicker: "Chapter one", title: "For coaches", sub: "Register · Rate · Send" }, kicker: "For coaches", title: "It starts at the register", status: { bg: "#ffffff" } },
    4: { mode: "app", kicker: "For coaches", title: "Nine areas. One tap each.", status: { bg: "#ffffff" } },
    5: { mode: "app", kicker: "For coaches", title: "End session. Reports sent.", status: { bg: "#ffffff" } },
    6: { mode: "app", chapter: { kicker: "Chapter two", title: "For parents", sub: "Your child's progress, in your pocket" }, kicker: "For parents", title: "It lands in your Parent Hub", status: { bg: "#ffffff" } },
    7: { mode: "app", kicker: "For parents", title: "Every area. Every comment.", status: { bg: "#ffffff" } },
    8: { mode: "app", kicker: "For parents", title: "Watch the trend", status: { bg: "#ffffff" } },
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
    // "auto" shows the phone's real clock (the context runs on Europe/London), so it agrees
    // with the timestamps the app itself prints (arrived / ended / sent).
    if (time === "auto") time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (time) $("statusTime").textContent = time;
    if (bg) document.documentElement.style.setProperty("--screen-bg", bg);
    if (ink) document.documentElement.style.setProperty("--status-ink", ink);
  }

  function show(name) {
    for (const [n, el] of Object.entries(layers)) el.classList.toggle("on", n === name);
  }

  let chapterTimer = null;
  function chapter({ kicker, title, sub }, holdMs) {
    $("chapterKicker").textContent = kicker ?? "";
    words($("chapterTitle"), title, 0.14, 0.15);
    $("chapterSub").textContent = sub ?? "";
    layers.chapter.classList.add("on");
    // Restart the rule/kicker/sub animations.
    for (const sel of [".chapter-rule", ".chapter-kicker", ".chapter-sub"]) {
      const el = document.querySelector(sel); el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
    }
    clearTimeout(chapterTimer);
    return new Promise((resolve) => {
      chapterTimer = setTimeout(() => { layers.chapter.classList.remove("on"); resolve(); }, holdMs);
    });
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
      try { heroVideo.currentTime = 0; await heroVideo.play(); } catch (e) { console.warn("hero play", e); }
      return;
    }
    if (s.mode === "end") {
      show("end");
      // Restart the end-card animations so a repeat call replays them.
      for (const el of layers.end.querySelectorAll(".lockup, .strap span, .url, .mascot")) { el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; }
      return;
    }
    // app
    setStatus(s.status ?? {});
    const phone = $("phone");
    fitPhone();
    const wasOn = layers.app.classList.contains("on");
    if (s.chapter) {
      // Card first; the recorder navigates the app behind it. Text zone and
      // phone are switched while the card covers them.
      const p = chapter(s.chapter, s.chapterMs ?? 1900);
      setTimeout(() => { show("app"); layers.chapter.classList.add("on"); setText(s); }, 250);
      // Show returns immediately; the card resolves on its own.
      await p;
      return;
    }
    if (s.enter && !wasOn) { phone.classList.remove("enter"); void phone.offsetWidth; phone.classList.add("enter"); }
    setText(s);
    show("app");
  }

  function fade(on = true) { $("fade").classList.toggle("on", on); }

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

  window.stage = { ready, scene, setText, setStatus, fade, fitPhone, layout, SCENES, layers };
})();
