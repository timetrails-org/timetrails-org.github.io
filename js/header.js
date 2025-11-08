// /js/header.js
(function () {
  const cls = "tt-header";
  const html = (k, vars) => (window.__I18N__ ? window.__I18N__.t(k, vars) : k);

  function applyTheme(mode) {
    const root = document.documentElement;
    if (mode === "light" || mode === "dark") {
      root.setAttribute("data-theme", mode);
      localStorage.setItem("tt_theme", mode);
    } else {
      // system
      root.removeAttribute("data-theme");
      localStorage.setItem("tt_theme", "system");
    }
  }

  function currentTheme() {
    return localStorage.getItem("tt_theme") || "system";
  }

  function createHeader(options = {}) {
    const {
      mount = "body",
      brandHref = "/",
      nav = [
        { href: "/", key: "tools.header.nav.home" },
        { href: "/tools/", key: "tools.header.nav.tools" },
        { href: "/tools/locations.html", key: "tools.header.nav.locations" }
      ],
      showTheme = true,
      showLang = true
    } = options;

    const el = document.createElement("header");
    el.className = cls;
    el.innerHTML = `
      <style>
        .${cls}{
          position:sticky; top:0; z-index:9998;
          backdrop-filter: blur(8px);
          background: rgba(15,17,23,0.6);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .${cls}-inner{
          max-width:1200px; margin:0 auto; padding:10px 16px;
          display:flex; align-items:center; gap:12px;
          color:#e6edf3; font-family: -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;
        }
        .${cls}-brand{ font-weight:700; color:#fff; text-decoration:none; font-size:16px; }
        .${cls}-nav{ display:flex; gap:14px; align-items:center; margin-left:8px; flex-wrap:wrap; }
        .${cls}-nav a{ color:#c9d1d9; text-decoration:none; padding:6px 10px; border-radius:8px; }
        .${cls}-nav a:hover{ background:#171b22; color:#fff; }
        .${cls}-spacer{ flex:1; }
        .${cls}-right{ display:flex; gap:10px; align-items:center; }
        .${cls}-sel, .${cls}-btn{
          background:#11141a; color:#e6edf3; border:1px solid #30363d;
          border-radius:8px; padding:6px 10px; cursor:pointer; font-size:12px;
        }
        .${cls}-btn:hover{ background:#171b22; }
        @media (max-width:640px){
          .${cls}-nav{ display:none; }
        }
      </style>
      <div class="${cls}-inner">
        <a class="${cls}-brand" href="${brandHref}" data-i18n="tools.header.brand">${html("tools.header.brand")}</a>
        <nav class="${cls}-nav" aria-label="Primary">
          ${nav.map(item => `<a href="${item.href}" data-i18n="${item.key}">${html(item.key)}</a>`).join("")}
        </nav>
        <div class="${cls}-spacer"></div>
        <div class="${cls}-right">
          ${showTheme ? `
          <select id="tt-theme" class="${cls}-sel" aria-label="${html("tools.header.theme")}">
            <option value="system" data-i18n="tools.header.theme.system">${html("tools.header.theme.system")}</option>
            <option value="light" data-i18n="tools.header.theme.light">${html("tools.header.theme.light")}</option>
            <option value="dark" data-i18n="tools.header.theme.dark">${html("tools.header.theme.dark")}</option>
          </select>` : ``}
          ${showLang ? `
          <select id="tt-lang" class="${cls}-sel" aria-label="${html("tools.header.lang")}"></select>` : ``}
        </div>
      </div>
    `;

    // 挂载
    const mountNode = typeof mount === "string" ? document.querySelector(mount) : mount;
    (mountNode || document.body).prepend(el);

    // 主题
    if (showTheme) {
      const themeSel = el.querySelector("#tt-theme");
      themeSel.value = currentTheme();
      applyTheme(themeSel.value);
      themeSel.addEventListener("change", () => applyTheme(themeSel.value));
    }

    // 语言
    if (showLang) {
      const langSel = el.querySelector("#tt-lang");
      function fillLangs() {
        const langs = (window.__I18N__?.langs && window.__I18N__.langs()) || [{ code: "en", displayName: "English" }];
        langSel.innerHTML = "";
        langs.forEach(l => {
          const opt = document.createElement("option");
          opt.value = l.code; opt.textContent = l.displayName || l.code;
          langSel.appendChild(opt);
        });
        const cur = window.__I18N__?.cur ? window.__I18N__.cur() : "en";
        langSel.value = cur;
      }
      fillLangs();
      langSel.addEventListener("change", () => {
        window.__I18N__?.setLang(langSel.value);
      });
      // 若 i18n 初始化较慢，等它暴露后再刷新一次
      document.addEventListener("DOMContentLoaded", () => setTimeout(fillLangs, 0));
    }

    // 返回实例
    return el;
  }

  // 对外暴露
  window.TTHeader = { create: createHeader };
})();
