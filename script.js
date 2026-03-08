import { ROCKETS } from "./data/rockets.js";
import { PERSONS } from "./data/persons.js";

const ALL = { ...ROCKETS, ...PERSONS };

function normalizeForSearch(input) {
  return (input ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s·•|/\\,.:;'"“”‘’()[\]{}<>!?+-=_~`@#$%^&*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstLine(text) {
  const s = (text ?? "").toString().trim();
  if (!s) return "";
  const line = s.split("\n")[0].trim();
  return line.length > 180 ? line.slice(0, 180).trim() + "…" : line;
}

function extractYearSort(subtitle) {
  const s = (subtitle ?? "").toString();

  const y4 = s.match(/(1[0-9]{3}|20[0-9]{2})/);
  if (y4) return parseInt(y4[1], 10);

  const c = s.match(/~?\s*([0-9]{1,2})\s*세기/);
  if (c) {
    const century = parseInt(c[1], 10);
    return Math.max(0, (century - 1) * 100 + 50);
  }

  return 9999;
}

function yearLabelFromSubtitle(subtitle) {
  const s = (subtitle ?? "").toString().trim();
  const y4 = s.match(/(1[0-9]{3}|20[0-9]{2})/);
  if (y4) return y4[1];

  const c = s.match(/~?\s*([0-9]{1,2})\s*세기/);
  if (c) return `~${c[1]}세기`;

  return s.split("·")[0]?.trim() || "—";
}

function eraFromYearSort(year) {
  if (year <= 1850) return "early";
  if (year <= 1957) return "ww2";
  if (year <= 1980) return "space";
  return "modern";
}

function allList() {
  return Object.entries(ALL)
    .map(([id, r]) => {
      const ySort = extractYearSort(r.subtitle);
      return {
        id,
        ...r,
        _yearSort: ySort,
        _yearLabel: yearLabelFromSubtitle(r.subtitle),
        _era: eraFromYearSort(ySort),
      };
    })
    .sort((a, b) => a._yearSort - b._yearSort);
}

function timelineList() {
  return allList().filter((x) => !x.id.endsWith("_person"));
}

function personList() {
  return allList().filter((x) => x.id.endsWith("_person"));
}

function applyTheme(theme) {
  const root = document.documentElement;
  const btn = document.getElementById("themeBtn");
  const next = theme === "light" ? "dark" : "light";

  root.setAttribute("data-theme", theme);

  if (btn) {
    btn.textContent = theme === "light" ? "☀️" : "🌙";
    btn.setAttribute("aria-label", `테마 전환 (${next}로)`);
  }

  try {
    localStorage.setItem("theme", theme);
  } catch (_) {}
}

function initTheme() {
  const saved = (() => {
    try {
      return localStorage.getItem("theme");
    } catch (_) {
      return null;
    }
  })();

  applyTheme(saved === "light" ? "light" : "dark");

  const btn = document.getElementById("themeBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(cur === "light" ? "dark" : "light");
  });
}

function renderTimeline(listEl, items) {
  const frag = document.createDocumentFragment();

  items.forEach((r) => {
    const li = document.createElement("li");
    li.className = "event";
    li.dataset.id = r.id;
    li.dataset.era = r._era;
    li.dataset.tags = (r.tags || []).join(" ");

    const year = document.createElement("div");
    year.className = "event__year";
    year.textContent = r._yearLabel;

    const a = document.createElement("a");
    a.className = "event__card event__card--link";
    a.href = `rocket.html?id=${encodeURIComponent(r.id)}`;

    const h3 = document.createElement("h3");
    h3.textContent = r.title;

    const p = document.createElement("p");
    p.textContent = firstLine(r.overview) || "상세 보기로 이동";

    const hint = document.createElement("span");
    hint.className = "card__hint";
    hint.textContent = "클릭하여 상세 보기 →";

    a.append(h3, p, hint);
    li.append(year, a);
    frag.appendChild(li);
  });

  listEl.innerHTML = "";
  listEl.appendChild(frag);
}

function initIndexIfNeeded() {
  const list = document.getElementById("timelineList");
  if (!list) return;

  const qEl = document.getElementById("q");
  const eraEl = document.getElementById("era");
  const resetBtn = document.getElementById("resetBtn");
  const emptyEl = document.getElementById("timelineEmpty");

  const items = timelineList();
  renderTimeline(list, items);

  const events = Array.from(list.querySelectorAll(".event"));

  function applyFilter() {
    const q = normalizeForSearch(qEl?.value);
    const era = normalizeForSearch(eraEl?.value);

    let visible = 0;

    events.forEach((li) => {
      const liEra = normalizeForSearch(li.dataset.era);
      const tags = normalizeForSearch(li.dataset.tags);
      const year = normalizeForSearch(li.querySelector(".event__year")?.textContent);
      const title = normalizeForSearch(li.querySelector("h3")?.textContent);
      const desc = normalizeForSearch(li.querySelector("p")?.textContent);

      const eraOk = !era || era === "all" || liEra === era;
      const haystack = `${tags} ${year} ${title} ${desc}`;
      const qOk = !q || haystack.includes(q);

      const show = eraOk && qOk;
      li.classList.toggle("hidden", !show);
      if (show) visible++;
    });

    if (emptyEl) emptyEl.classList.toggle("hidden", visible !== 0);
  }

  qEl?.addEventListener("input", applyFilter);
  eraEl?.addEventListener("change", applyFilter);

  resetBtn?.addEventListener("click", () => {
    if (qEl) qEl.value = "";
    if (eraEl) eraEl.value = "all";
    applyFilter();
  });

  applyFilter();
}

function setText(el, text) {
  if (!el) return;
  el.textContent = text ?? "";
}

function setMultiline(el, text) {
  if (!el) return;
  el.innerHTML = "";
  (text ?? "").split("\n").forEach((line) => {
    const p = document.createElement("p");
    p.textContent = line.trim();
    el.appendChild(p);
  });
}

function loadDetailIfNeeded() {
  const titleEl = document.querySelector("#rTitle");
  if (!titleEl) return;

  const params = new URLSearchParams(window.location.search);
  const id = (params.get("id") || "").trim();

  const isPerson = id.endsWith("_person");
  const items = isPerson ? personList() : timelineList();

  const idx = items.findIndex((x) => x.id === id);
  const data = idx >= 0 ? items[idx] : null;

  if (!data) {
    setText(titleEl, "항목을 찾을 수 없습니다");
    return;
  }

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  function setNavBtn(btn, target) {
    if (!btn) return;

    if (!target) {
      btn.href = "#";
      btn.classList.add("disabled");
      btn.setAttribute("aria-disabled", "true");
      return;
    }

    btn.classList.remove("disabled");
    btn.removeAttribute("aria-disabled");
    btn.href = `rocket.html?id=${encodeURIComponent(target.id)}`;
    btn.setAttribute("aria-label", `${target.title} 상세로 이동`);
  }

  setNavBtn(prevBtn, idx > 0 ? items[idx - 1] : null);
  setNavBtn(nextBtn, idx >= 0 && idx < items.length - 1 ? items[idx + 1] : null);

  setText(titleEl, data.title);
  setText(document.getElementById("rSub"), data.subtitle);

  setMultiline(document.getElementById("rOverview"), data.overview);
  setMultiline(document.getElementById("rTech"), data.tech);
  setMultiline(document.getElementById("rImpact"), data.impact);

  const imgEl = document.getElementById("rImg");
  if (imgEl && data.image?.src) {
    imgEl.src = data.image.src;
    imgEl.alt = data.image.alt || data.title || "이미지";
  }

  if (imgEl) {
    imgEl.referrerPolicy = "no-referrer";

    const originalSrc = imgEl.src;
    let retried = false;

    imgEl.onerror = () => {
      if (!retried && originalSrc) {
        retried = true;
        imgEl.src = `${originalSrc}${originalSrc.includes("?") ? "&" : "?"}t=${Date.now()}`;
        return;
      }

      const svg = encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
          <rect width="100%" height="100%" fill="#111522"/>
          <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
                fill="#a8b1c7" font-size="42" font-family="system-ui, sans-serif">
            이미지 로딩 실패
          </text>
        </svg>`
      );
      imgEl.src = `data:image/svg+xml,${svg}`;
    };
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initIndexIfNeeded();
  loadDetailIfNeeded();

  const form = document.getElementById("contactForm");
  const statusEl = document.getElementById("formStatus");
  const hiddenFrame = document.getElementById("hiddenFrame");
  const submittedAtEl = document.getElementById("submittedAt");
  const pageUrlEl = document.getElementById("pageUrl");
  const userAgentEl = document.getElementById("userAgent");

  let submitted = false;

  if (form) {
    form.addEventListener("submit", () => {
      submitted = true;

      if (submittedAtEl) submittedAtEl.value = new Date().toISOString();
      if (pageUrlEl) pageUrlEl.value = window.location.href;
      if (userAgentEl) userAgentEl.value = navigator.userAgent;

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      if (statusEl) statusEl.textContent = "접수 중입니다...";
    });
  }

  if (hiddenFrame) {
    hiddenFrame.addEventListener("load", () => {
      if (!submitted) return;

      const submitBtn = form?.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = false;
      if (statusEl) statusEl.textContent = "접수가 완료되었습니다.";
      if (form) form.reset();

      submitted = false;
    });
  }
});
