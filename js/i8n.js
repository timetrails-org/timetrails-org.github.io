// === 配置（仅本地） ===
const LANG_LIST       = "/languages.json"; // 本地语言清单
const I18N_DIR        = "/i18n";           // 文案目录
const FALLBACK_CODE   = "en";              // 回退语言
const STORAGE_KEY     = "timetrails.lang"; // 本地存储 key

// 浏览器 locale -> 你的代码 的映射（可按需扩展）
const BROWSER_MAP = {
  "zh": "zh-Hans",
  "zh-CN": "zh-Hans",
  "zh-SG": "zh-Hans",
  "zh-TW": "zh-Hant",
  "zh-HK": "zh-HK",
  "en-GB": "en-GB",
  "en-AU": "en-AU",
  "en-CA": "en-CA",
  "en-IN": "en-IN",
  "fr-CA": "fr-CA",
  "es-MX": "es-MX",
  "es-419": "es-419",
  "pt-BR": "pt-BR",
  "pt-PT": "pt-PT",
  "nl-BE": "nl-BE"
};


let LANGUAGES = [];   // { code, name, displayName } 来自 /languages.json
let currentLang = FALLBACK_CODE;
let dict = {};        // 当前语言字典
let dictFallback = {}; // 英文字典

// ---------- 工具 ----------
const qs  = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${url} ${res.status}`);
  return res.json();
}

async function loadLanguagesList() {
  return fetchJson(LANG_LIST);
}

async function loadDict(code) {
  // 先保证英文回退在内存
  if (!Object.keys(dictFallback).length) {
    try {
      dictFallback = await fetchJson(`${I18N_DIR}/${FALLBACK_CODE}.json`);
    } catch (e) {
      console.error("[i18n] 无法加载英文回退字典：", e);
      dictFallback = {};
    }
  }
  // 加载目标语言，失败则用英文
  try {
    return await fetchJson(`${I18N_DIR}/${code}.json`);
  } catch (e) {
    console.warn(`[i18n] ${code} 缺失或加载失败，回退 ${FALLBACK_CODE}`);
    return dictFallback;
  }
}

function getNested(obj, path) {
  return path.split(".").reduce((o, k) => (o && o[k] != null ? o[k] : undefined), obj);
}

function t(key) {
  const v = getNested(dict, key);
  if (v != null) return v;
  const fb = getNested(dictFallback, key);
  return fb != null ? fb : key; // 英文也无 → 返回 key
}

function applyI18nToDOM() {
  qsa("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const txt = t(key);
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      el.placeholder = txt;
    } else {
      el.textContent = txt;
    }
  });
  document.documentElement.setAttribute("lang", currentLang);
}

function detectInitialLang() {
  // 优先顺序：localStorage → URL ?lang= → 浏览器语言 → fallback
  const url = new URL(location.href);
  const fromQuery   = url.searchParams.get("lang");
  const fromStore   = localStorage.getItem(STORAGE_KEY);
  const browserLang = navigator.language || navigator.userLanguage || "";

  const candidates = [fromStore, fromQuery, BROWSER_MAP[browserLang], browserLang, FALLBACK_CODE]
    .filter(Boolean);

  for (const c of candidates) {
    if (LANGUAGES.some(l => l.code === c)) return c;
    const base = c.split("-")[0];
    if (LANGUAGES.some(l => l.code === base)) return base;
  }
  return FALLBACK_CODE;
}

function populateLangSwitcher() {
  const sel = qs("#lang-switcher");
  if (!sel) return;
  sel.innerHTML = "";
  LANGUAGES.forEach(({ code, displayName }) => {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = displayName || code;
    sel.appendChild(opt);
  });
  sel.value = currentLang;
  sel.addEventListener("change", async () => {
    await setLanguage(sel.value);
  });
}

async function setLanguage(code) {
  currentLang = code;
  localStorage.setItem(STORAGE_KEY, code);
  dict = await loadDict(code);
  applyI18nToDOM();
  // 同步 URL 参数（便于分享）
  const url = new URL(location.href);
  url.searchParams.set("lang", code);
  history.replaceState({}, "", url.toString());
}

// ---------- 启动 ----------
(async function initI18n() {
  try {
    LANGUAGES = await loadLanguagesList();
  } catch (e) {
    console.error("[i18n] 读取 /languages.json 失败：", e);
    // 保底仅英文
    LANGUAGES = [{ code: "en", name: "English", displayName: "English" }];
  }
  currentLang = detectInitialLang();
  await setLanguage(currentLang);
  populateLangSwitcher();
})();
