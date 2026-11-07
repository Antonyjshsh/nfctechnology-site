(() => {
  "use strict";

  const API = "https://etgzagkewmsxxerwelmp.supabase.co/functions/v1/gafforelli-manager";
  let currentPanel = "highlights";
  let loading = false;

  const money = (v) => Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[c]));

  function injectStyles() {
    if (document.getElementById("menuV2Styles")) return;
    const s = document.createElement("style");
    s.id = "menuV2Styles";
    s.textContent = `
      .highlight-art-only .meta,.highlight-art-only .badge,.highlight-art-only:after{display:none!important}
      .img-modal.highlight-art-only .img-modal-meta,.img-modal.highlight-art-only .img-modal-gradient{display:none!important}
      .promo-badge-v2{position:absolute;z-index:7;top:10px;left:10px;padding:6px 9px;border-radius:999px;background:#fff;color:#050505;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;box-shadow:0 4px 16px rgba(0,0,0,.3)}
      .price-stack-v2{display:flex!important;flex-direction:column;align-items:flex-end;gap:1px;white-space:nowrap}
      .old-price-v2{font-size:10px;color:#bbb;text-decoration:line-through;font-weight:600}
      .new-price-v2{font-size:14px;color:#fff;font-weight:900}
      .empty-v2{grid-column:1/-1;padding:24px 12px;border:1px dashed #2c2c2c;border-radius:16px;color:#888;text-align:center;font-size:12px}
      .no-photo-v2{position:absolute;inset:0;display:grid;place-items:center;background:radial-gradient(circle at 50% 30%,#242424,#111 65%);font-size:42px;color:#777;font-weight:900}
      .status-note-v2{margin:10px 2px 0;color:#858585;font-size:10px;text-align:center}
    `;
    document.head.appendChild(s);
  }

  function productCard(p) {
    const promo = p.promo_live && p.promo_price !== null;
    const image = p.image_url
      ? `<img class="main-img" loading="lazy" src="${esc(p.image_url)}" alt="${esc(p.name)}">`
      : `<div class="no-photo-v2">${esc((p.name || "?").trim().charAt(0).toUpperCase())}</div>`;

    const price = promo
      ? `<b class="price-stack-v2"><span class="old-price-v2">${money(p.price)}</span><span class="new-price-v2">${money(p.promo_price)}</span></b>`
      : `<b>${money(p.price)}</b>`;

    return `<article class="card">
      ${image}
      ${promo ? '<span class="promo-badge-v2">Promoção</span>' : ''}
      <div class="meta"><strong>${esc(p.name)}</strong>${price}</div>
    </article>`;
  }

  function highlightCard(p) {
    return productCard(p).replace('class="card"', 'class="card gm-promo-card"');
  }

  function bindTabs() {
    const tabs = [...document.querySelectorAll(".tab")];
    const panels = [...document.querySelectorAll(".panel")];
    tabs.forEach(btn => btn.addEventListener("click", () => {
      currentPanel = btn.dataset.panel;
      tabs.forEach(x => x.classList.toggle("active", x === btn));
      panels.forEach(p => p.classList.toggle("active", p.id === currentPanel));
      const nav = document.querySelector(".tabs-wrap");
      if (nav) window.scrollTo({ top: nav.offsetTop, behavior: "smooth" });
    }));
  }

  function render(data) {
    injectStyles();
    const r = data.restaurant || {};
    const categories = Array.isArray(data.categories) ? data.categories : [];
    const products = Array.isArray(data.products) ? data.products : [];

    const logo = document.querySelector(".logo");
    if (logo && r.logo_url) logo.src = r.logo_url;
    const title = document.querySelector(".brand h1");
    if (title && r.name) title.textContent = r.name;
    const subtitle = document.querySelector(".brand p");
    if (subtitle && (r.menu_subtitle || r.description)) subtitle.textContent = r.menu_subtitle || r.description;
    const insta = document.querySelector(".brand .insta");
    if (insta && r.instagram_url) insta.href = r.instagram_url;
    const hero = document.querySelector(".hero");
    if (hero && r.cover_url) hero.style.backgroundImage = `linear-gradient(180deg,rgba(0,0,0,.22),#090909 88%),url('${r.cover_url}')`;

    const tabs = document.querySelector(".tabs");
    const main = document.querySelector("main");
    if (!tabs || !main) return;

    const validPanels = new Set(["highlights", ...categories.map(c => "cat-" + c.slug)]);
    if (!validPanels.has(currentPanel)) currentPanel = "highlights";

    tabs.innerHTML = [
      `<button class="tab ${currentPanel === "highlights" ? "active" : ""}" data-panel="highlights">⭐ Destaques</button>`,
      ...categories.map(c => `<button class="tab ${currentPanel === "cat-" + c.slug ? "active" : ""}" data-panel="cat-${esc(c.slug)}">${esc(c.emoji || "•")} ${esc(c.name)}</button>`)
    ].join("");

    const promos = products.filter(p => p.promo_live).sort((a,b) => new Date(b.promoted_at || 0) - new Date(a.promoted_at || 0));

    const highlight = data.highlight || { title: "Baldão de Kit", price_text: "R$ 30 a R$ 80", show_text: true };
    const highlights = `
      <section class="panel ${currentPanel === "highlights" ? "active" : ""}" id="highlights">
        <div class="section-head"><h2>⭐ Destaques</h2><span>${promos.length ? promos.length + " promoções" : "Especial da casa"}</span></div>
        <div class="grid">
          <article class="card feature baldao-feature ${highlight.show_text === false ? "highlight-art-only" : ""}">
            <img class="main-img" src="${esc(highlight.image_url || "/gafforelli/cardapio/assets/baldao-kit.png")}" alt="${esc(highlight.title || "Destaque Gafforelli")}">
            <span class="badge">Destaque</span>
            <div class="meta"><strong>${esc(highlight.title || "")}</strong><b>${esc(highlight.price_text || "")}</b></div>
          </article>
          ${promos.map(highlightCard).join("")}
        </div>
      </section>`;

    const sections = categories.map(c => {
      const list = products.filter(p => p.category_id === c.id);
      return `<section class="panel ${currentPanel === "cat-" + c.slug ? "active" : ""}" id="cat-${esc(c.slug)}">
        <div class="section-head"><h2>${esc(c.emoji || "•")} ${esc(c.name)}</h2><span>${list.length} ${list.length === 1 ? "item" : "itens"}</span></div>
        <div class="grid">${list.length ? list.map(productCard).join("") : '<div class="empty-v2">Nenhum produto disponível nesta categoria.</div>'}</div>
        ${c.description ? `<p class="note">${esc(c.description)}</p>` : ""}
      </section>`;
    }).join("");

    main.innerHTML = highlights + sections;
    bindTabs();

    document.documentElement.dataset.gafforelliMenuV2 = "ok";
  }

  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      const res = await fetch(API + "?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      render(data);
    } catch (e) {
      console.warn("Menu dinâmico indisponível; mantendo versão local.", e);
      document.documentElement.dataset.gafforelliMenuV2 = "fallback";
    } finally {
      loading = false;
    }
  }

  document.addEventListener("click", event => {
    const card = event.target.closest(".card");
    if (card) document.getElementById("imgModal")?.classList.toggle("highlight-art-only", card.classList.contains("highlight-art-only"));
  });
  window.gafforelliRefreshMenu = refresh;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once:true });
  else refresh();

  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  setInterval(refresh, 15000);
})();

