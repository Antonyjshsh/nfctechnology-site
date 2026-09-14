(() => {
  const API_URL = "https://etgzagkewmsxxerwelmp.supabase.co/rest/v1/gafforelli_menu_items?select=item_key,category,position,name,price,promo_active,promo_price,promoted_at&order=category.asc,position.asc";
  const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0Z3phZ2tld21zeHhlcndlbG1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMjM1MzksImV4cCI6MjEwNDY5OTUzOX0.OMK12FcSe8enkbeQb-gh0RbrXXYemgrFCQYetZzRuek";

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

  function getGroups() {
    const groups = [];
    try {
      if (typeof topKits !== "undefined") groups.push({
        category: "copao_top", data: topKits, cards: "#topKits .kit-feature", prices: ".kit-label strong"
      });
      if (typeof kits !== "undefined") groups.push({
        category: "copao", data: kits, cards: "#kitGrid .small-card", prices: ".small-info strong"
      });
      if (typeof caipas !== "undefined") groups.push({
        category: "caipa", data: caipas, cards: "#caipaList .product-card", prices: ".product-meta strong"
      });
      if (typeof drinks !== "undefined") groups.push({
        category: "drink", data: drinks, cards: "#drinksList .product-card", prices: ".product-meta strong"
      });
      if (typeof wines !== "undefined") groups.push({
        category: "wine", data: wines, cards: "#winesList .product-card", prices: ".product-meta strong"
      });
      if (typeof convenience !== "undefined") groups.push({
        category: "convenience", data: convenience, cards: "#convenienceList .product-card", prices: ".product-meta strong"
      });
    } catch (e) {
      console.warn("Gerenciamento: não foi possível mapear todos os grupos.", e);
    }
    return groups;
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
      .gm-promos{padding:22px 18px 24px;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.012));border-top:1px solid rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.07)}
      .gm-promos-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:13px}
      .gm-promos-kicker{font-size:9px;letter-spacing:.19em;text-transform:uppercase;color:#a9a9ad;font-weight:800}
      .gm-promos-title{margin:4px 0 0;font-size:21px;line-height:1.05;letter-spacing:-.02em}
      .gm-promos-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .gm-promo-card{position:relative;overflow:hidden;border-radius:18px;background:#121212;border:1px solid rgba(255,255,255,.10);min-width:0;cursor:pointer}
      .gm-promo-media{height:145px;position:relative;overflow:hidden;background:radial-gradient(circle at 50% 35%,rgba(255,255,255,.08),transparent 48%),linear-gradient(150deg,#1a1a1a,#0b0b0b)}
      .gm-promo-media img{width:100%;height:100%;object-fit:cover;display:block}
      .gm-promo-card[data-kit="1"] .gm-promo-media img,.gm-promo-card[data-contain="1"] .gm-promo-media img{object-fit:contain;padding:10px}
      .gm-promo-tag{position:absolute;top:9px;left:9px;padding:5px 8px;border-radius:999px;background:#fff;color:#050505;font-size:9px;font-weight:900;letter-spacing:.08em}
      .gm-promo-info{padding:11px 11px 12px}
      .gm-promo-category{font-size:9px;color:#929297;text-transform:uppercase;letter-spacing:.09em;font-weight:800}
      .gm-promo-name{font-size:13px;font-weight:800;line-height:1.2;margin:4px 0 8px}
      .gm-promo-prices{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap}
      .gm-promo-prices s{font-size:10px;color:#777}
      .gm-promo-prices strong{font-size:15px;color:#fff}
      .gm-promo-empty{font-size:12px;color:#888;padding:5px 0}
      @media(max-width:360px){.gm-promos-grid{grid-template-columns:1fr}.gm-promo-media{height:165px}}
    `;
    document.head.appendChild(style);
  }

  function sourceFor(row, groups) {
    const group = groups.find(g => g.category === row.category);
    if (!group) return null;
    return group.data?.[Number(row.position)] || null;
  }

  function applyRows(rows) {
    ensureStyles();
    const groups = getGroups();

    for (const group of groups) {
      const groupRows = rows
        .filter(r => r.category === group.category)
        .sort((a,b) => Number(a.position) - Number(b.position));

      const cards = [...document.querySelectorAll(group.cards)];

      groupRows.forEach((row, i) => {
        const item = group.data?.[Number(row.position)];
        if (!item) return;

        const normal = money(row.price);
        const promo = row.promo_active && row.promo_price !== null ? money(row.promo_price) : null;

        item._normalPrice = normal;
        item._promoPrice = promo;
        item.price = promo || normal;

        const card = cards[i];
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

        const priceEl = card.querySelector(group.prices);
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
    }

    renderPromotions(rows, groups);
  }

  function renderPromotions(rows, groups) {
    let section = document.getElementById("promocoesDestaque");
    const active = rows
      .filter(r => r.promo_active && r.promo_price !== null)
      .sort((a,b) => new Date(b.promoted_at || 0) - new Date(a.promoted_at || 0));

    if (!active.length) {
      if (section) section.remove();
      return;
    }

    if (!section) {
      section = document.createElement("section");
      section.id = "promocoesDestaque";
      section.className = "gm-promos";
      const nav = document.getElementById("categoryNav");
      if (nav?.parentNode) nav.parentNode.insertBefore(section, nav);
      else document.querySelector(".phone-shell")?.appendChild(section);
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
      const source = sourceFor(row, groups);
      const card = document.createElement("article");
      card.className = "gm-promo-card";
      card.dataset.kit = row.category.startsWith("copao") ? "1" : "0";
      card.dataset.contain = source?.contain ? "1" : "0";
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
        target?.scrollIntoView({behavior:"smooth", block:"start"});
      };
      card.addEventListener("click", go);
      card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") go(); });

      grid.appendChild(card);
    });

    section.appendChild(grid);
  }

  async function refreshManagedMenu() {
    try {
      const res = await fetch(API_URL, {
        headers: {
          apikey: API_KEY,
          Authorization: `Bearer ${API_KEY}`
        },
        cache: "no-store"
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await res.json();
      if (Array.isArray(rows)) applyRows(rows);
    } catch (err) {
      console.warn("Gerenciamento do cardápio indisponível; usando preços locais.", err);
    }
  }

  window.gafforelliRefreshMenu = refreshManagedMenu;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(refreshManagedMenu, 0));
  } else {
    setTimeout(refreshManagedMenu, 0);
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshManagedMenu();
  });
  setInterval(refreshManagedMenu, 30000);
})();