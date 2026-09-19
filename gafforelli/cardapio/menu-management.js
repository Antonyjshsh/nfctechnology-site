(() => {
  "use strict";

  const API_URL = "https://etgzagkewmsxxerwelmp.supabase.co/functions/v1/gafforelli-admin";
  const UPDATE_KEY = "gafforelliMenuUpdatedAt";

  const money = (value) => Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

  const categoryLabels = {
    copao_top: "Copão de Kit",
    copao: "Copão de Kit",
    caipa: "Caipa Gourmet",
    drink: "Drinks 500ml",
    wine: "Vinhos",
    convenience: "Conveniência"
  };

  const sectionTargets = {
    copao_top: "copao",
    copao: "copao",
    caipa: "caipa",
    drink: "drinks",
    wine: "vinhos",
    convenience: "conveniencia"
  };

  const groupDefs = {
    copao_top: { cards: "#topKits .kit-feature", prices: ".kit-label strong" },
    copao: { cards: "#kitGrid .small-card", prices: ".small-info strong" },
    caipa: { cards: "#caipaList .product-card", prices: ".product-meta strong" },
    drink: { cards: "#drinksList .product-card", prices: ".product-meta strong" },
    wine: { cards: "#winesList .product-card", prices: ".product-meta strong" },
    convenience: { cards: "#convenienceList .product-card", prices: ".product-meta strong" }
  };

  function dataForCategory(category) {
    try {
      switch (category) {
        case "copao_top": return typeof topKits !== "undefined" ? topKits : null;
        case "copao": return typeof kits !== "undefined" ? kits : null;
        case "caipa": return typeof caipas !== "undefined" ? caipas : null;
        case "drink": return typeof drinks !== "undefined" ? drinks : null;
        case "wine": return typeof wines !== "undefined" ? wines : null;
        case "convenience": return typeof convenience !== "undefined" ? convenience : null;
        default: return null;
      }
    } catch (_) {
      return null;
    }
  }

  function itemFor(row) {
    const data = dataForCategory(row.category);
    return data?.[Number(row.position)] || null;
  }

  function cardFor(row) {
    const def = groupDefs[row.category];
    if (!def) return null;
    return document.querySelectorAll(def.cards)[Number(row.position)] || null;
  }

  function sourceFor(row) {
    const item = itemFor(row);
    if (item?.image) return item;

    const card = cardFor(row);
    const img = card?.querySelector(".product-media img, .small-media img.contain-img, .small-media img:first-of-type, .kit-bottle, img");
    return img ? {
      image: img.currentSrc || img.src,
      contain: img.classList.contains("contain-img") || row.category.startsWith("copao")
    } : null;
  }

  function ensureStyles() {
    if (document.getElementById("gmStyles")) return;
    const style = document.createElement("style");
    style.id = "gmStyles";
    style.textContent = `
      .gm-price-wrap{display:flex!important;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap}
      .gm-old-price{font-size:10px!important;color:#8d8d8d!important;text-decoration:line-through;font-weight:600!important}
      .gm-new-price{font-size:13px!important;color:#fff!important;font-weight:900!important}
      .gm-card-promo{position:relative}
      .gm-promo-badge{position:absolute;z-index:8;top:8px;left:8px;padding:5px 8px;border-radius:999px;background:#fff;color:#050505;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;box-shadow:0 5px 18px rgba(0,0,0,.28)}
      .gm-promos{position:relative;z-index:3;padding:22px 18px 24px;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.012));border-top:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.07)}
      .gm-promos-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:13px}
      .gm-promos-kicker{font-size:9px;letter-spacing:.19em;text-transform:uppercase;color:#a9a9ad;font-weight:800}
      .gm-promos-title{margin:4px 0 0;font-family:Georgia,"Times New Roman",serif;font-size:24px;line-height:1.05;letter-spacing:-.02em}
      .gm-promos-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .gm-promo-card{position:relative;overflow:hidden;border-radius:18px;background:#121212;border:1px solid rgba(255,255,255,.10);min-width:0;cursor:pointer;box-shadow:0 12px 28px rgba(0,0,0,.16)}
      .gm-promo-media{height:145px;position:relative;overflow:hidden;background:radial-gradient(circle at 50% 35%,rgba(189,148,87,.14),transparent 48%),linear-gradient(150deg,#1a1a1a,#0b0b0b)}
      .gm-promo-media img{width:100%;height:100%;object-fit:cover;display:block}
      .gm-promo-card[data-kit="1"] .gm-promo-media img,.gm-promo-card[data-contain="1"] .gm-promo-media img{object-fit:contain;padding:10px}
      .gm-promo-tag{position:absolute;z-index:2;top:9px;left:9px;padding:5px 8px;border-radius:999px;background:#fff;color:#050505;font-size:9px;font-weight:900;letter-spacing:.08em}
      .gm-promo-info{padding:11px 11px 12px}
      .gm-promo-category{font-size:9px;color:#929297;text-transform:uppercase;letter-spacing:.09em;font-weight:800}
      .gm-promo-name{font-size:13px;font-weight:800;line-height:1.2;margin:4px 0 8px}
      .gm-promo-prices{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap}
      .gm-promo-prices s{font-size:10px;color:#777}
      .gm-promo-prices strong{font-size:15px;color:#fff}
      @media(max-width:360px){.gm-promos-grid{grid-template-columns:1fr}.gm-promo-media{height:165px}}
    `;
    document.head.appendChild(style);
  }

  function applyRows(rows) {
    ensureStyles();

    rows.forEach((row) => {
      const def = groupDefs[row.category];
      if (!def) return;

      const normal = money(row.price);
      const promo = row.promo_active && row.promo_price !== null ? money(row.promo_price) : null;
      const item = itemFor(row);

      // Mantém o modal do cardápio usando o mesmo preço que aparece no card.
      if (item) {
        item._normalPrice = normal;
        item._promoPrice = promo;
        item.price = promo || normal;
      }

      const card = cardFor(row);
      if (!card) return;

      card.dataset.gmItemKey = row.item_key;
      card.classList.toggle("gm-card-promo", !!promo);

      let badge = card.querySelector(":scope > .gm-promo-badge");
      if (promo && !badge) {
        badge = document.createElement("span");
        badge.className = "gm-promo-badge";
        badge.textContent = "Promoção";
        card.appendChild(badge);
      } else if (!promo && badge) {
        badge.remove();
      }

      const priceEl = card.querySelector(def.prices);
      if (priceEl) {
        if (promo) {
          priceEl.classList.add("gm-price-wrap");
          priceEl.innerHTML = `<span class="gm-old-price">${normal}</span><span class="gm-new-price">${promo}</span>`;
        } else {
          priceEl.classList.remove("gm-price-wrap");
          priceEl.textContent = normal;
        }
      }
    });

    renderPromotions(rows);
  }

  function renderPromotions(rows) {
    let section = document.getElementById("promocoesDestaque");
    const active = rows
      .filter(r => r.promo_active && r.promo_price !== null)
      .sort((a,b) => new Date(b.promoted_at || 0) - new Date(a.promoted_at || 0));

    if (!active.length) {
      section?.remove();
      return;
    }

    if (!section) {
      section = document.createElement("section");
      section.id = "promocoesDestaque";
      section.className = "gm-promos";
      const nav = document.getElementById("categoryNav");
      if (nav?.parentNode) nav.parentNode.insertBefore(section, nav);
      else document.querySelector(".app-shell, .phone-shell, body")?.appendChild(section);
    }

    section.replaceChildren();

    const head = document.createElement("div");
    head.className = "gm-promos-head";
    const headText = document.createElement("div");
    headText.innerHTML = `<div class="gm-promos-kicker">Ofertas da casa</div><h2 class="gm-promos-title">Promoções em destaque</h2>`;
    head.appendChild(headText);
    section.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "gm-promos-grid";

    active.forEach(row => {
      const source = sourceFor(row);
      const card = document.createElement("article");
      card.className = "gm-promo-card";
      card.dataset.kit = row.category.startsWith("copao") ? "1" : "0";
      card.dataset.contain = source?.contain ? "1" : "0";
      card.dataset.gmItemKey = row.item_key;
      card.tabIndex = 0;

      const media = document.createElement("div");
      media.className = "gm-promo-media";
      if (source?.image) {
        const img = document.createElement("img");
        img.src = source.image;
        img.alt = row.name;
        media.appendChild(img);
      }
      const tag = document.createElement("span");
      tag.className = "gm-promo-tag";
      tag.textContent = "PROMOÇÃO";
      media.appendChild(tag);

      const info = document.createElement("div");
      info.className = "gm-promo-info";

      const cat = document.createElement("div");
      cat.className = "gm-promo-category";
      cat.textContent = categoryLabels[row.category] || "Destaque";

      const name = document.createElement("div");
      name.className = "gm-promo-name";
      name.textContent = row.name;

      const prices = document.createElement("div");
      prices.className = "gm-promo-prices";
      const oldPrice = document.createElement("s");
      oldPrice.textContent = money(row.price);
      const newPrice = document.createElement("strong");
      newPrice.textContent = money(row.promo_price);
      prices.append(oldPrice, newPrice);

      info.append(cat, name, prices);
      card.append(media, info);

      const go = () => {
        const target = document.getElementById(sectionTargets[row.category]);
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      };
      card.addEventListener("click", go);
      card.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      });

      grid.appendChild(card);
    });

    section.appendChild(grid);
  }

  let refreshing = null;
  async function refreshManagedMenu() {
    if (refreshing) return refreshing;

    refreshing = (async () => {
      try {
        const res = await fetch(`${API_URL}?_=${Date.now()}`, {
          method: "GET",
          cache: "no-store",
          headers: { "Accept": "application/json" }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const payload = await res.json();
        const rows = Array.isArray(payload) ? payload : payload?.items;
        if (!Array.isArray(rows)) throw new Error("Resposta inválida do gerenciamento");

        applyRows(rows);
        document.documentElement.dataset.gafforelliMenuSync = "ok";
      } catch (err) {
        document.documentElement.dataset.gafforelliMenuSync = "error";
        console.warn("Gerenciamento do cardápio indisponível; usando preços locais.", err);
      } finally {
        refreshing = null;
      }
    })();

    return refreshing;
  }

  window.gafforelliRefreshMenu = refreshManagedMenu;

  const start = () => setTimeout(refreshManagedMenu, 0);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshManagedMenu();
  });
  window.addEventListener("pageshow", refreshManagedMenu);
  window.addEventListener("online", refreshManagedMenu);
  window.addEventListener("storage", (event) => {
    if (event.key === UPDATE_KEY) refreshManagedMenu();
  });

  // Mantém promoções/preços sincronizados mesmo se o cliente deixar o cardápio aberto.
  setInterval(refreshManagedMenu, 15000);
})();
