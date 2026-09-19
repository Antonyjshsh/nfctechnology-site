(() => {
  "use strict";

  const API =
  "https://etgzagkewmsxxerwelmp.supabase.co/storage/v1/object/public/gafforelli-menu/menu.json";

  const money = v =>
    Number(v || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

  const norm = v =>
    String(v || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .trim()
      .toLowerCase();

  const containers = {
    copao_top: "#kitGrid",
    copao: "#kitGrid",
    caipa: "#caipaGrid",
    drink: "#drinkGrid",
    wine: "#wineGrid"
  };

  const aliases = {
    "licor-43-2": "Licor 43 + Red Bull"
  };

  function productName(row) {
    let name = aliases[row.item_key] || row.name || "";
    return name.replace(/^Vinho\s+/i, "");
  }

  function findCard(row) {
    const selector = containers[row.category];
    if (!selector) return null;

    const wanted = norm(productName(row));

    const cards = [
      ...document.querySelectorAll(`${selector} .card`)
    ];

    return (
      cards.find(card => {
        const name = card.querySelector(".meta strong")?.textContent;
        return norm(name) === wanted;
      }) ||
      cards.find(card => {
        const name = norm(
          card.querySelector(".meta strong")?.textContent
        );
        return (
          name &&
          (name.includes(wanted) || wanted.includes(name))
        );
      }) ||
      null
    );
  }

  function styles() {
    if (document.getElementById("gmStyles")) return;

    const s = document.createElement("style");
    s.id = "gmStyles";

    s.textContent = `
      .gm-promo-badge{
        position:absolute;
        z-index:10;
        top:10px;
        left:10px;
        background:#fff;
        color:#000;
        border-radius:999px;
        padding:6px 9px;
        font-size:9px;
        font-weight:900;
        text-transform:uppercase;
      }

      .gm-price{
        display:flex!important;
        flex-direction:column;
        align-items:flex-end;
        gap:1px;
      }

      .gm-old{
        color:#aaa;
        font-size:10px;
        text-decoration:line-through;
      }

      .gm-new{
        color:#fff;
        font-size:14px;
        font-weight:900;
      }

      .gm-promo-card{
        position:relative;
      }
    `;

    document.head.appendChild(s);
  }

  function updateCard(row) {
    const card = findCard(row);
    if (!card) return;

    const price = card.querySelector(".meta b");
    if (!price) return;

    const promo =
      row.promo_active &&
      row.promo_price !== null;

    let badge = card.querySelector(".gm-promo-badge");

    if (promo) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "gm-promo-badge";
        badge.textContent = "Promoção";
        card.appendChild(badge);
      }

      price.className = "gm-price";

      price.innerHTML = `
        <span class="gm-old">${money(row.price)}</span>
        <span class="gm-new">${money(row.promo_price)}</span>
      `;
    } else {
      badge?.remove();
      price.className = "";
      price.textContent = money(row.price);
    }
  }

  function renderHighlights(rows) {
    const grid =
      document.querySelector("#highlights .grid");

    if (!grid) return;

    grid
      .querySelectorAll(".gm-promo-card")
      .forEach(el => el.remove());

    const active = rows
      .filter(
        r =>
          r.promo_active &&
          r.promo_price !== null
      )
      .sort(
        (a, b) =>
          new Date(b.promoted_at || 0) -
          new Date(a.promoted_at || 0)
      );

    active.forEach(row => {
      const original = findCard(row);

      const article =
        document.createElement("article");

      article.className =
        "card gm-promo-card";

      const img =
        original?.querySelector("img.main-img");

      if (img) {
        const copy =
          document.createElement("img");

        copy.className = "main-img";
        copy.src = img.currentSrc || img.src;
        copy.alt = row.name;

        article.appendChild(copy);
      }

      const badge =
        document.createElement("span");

      badge.className = "gm-promo-badge";
      badge.textContent = "Promoção";

      const meta =
        document.createElement("div");

      meta.className = "meta";

      const name =
        document.createElement("strong");

      name.textContent = row.name;

      const price =
        document.createElement("b");

      price.className = "gm-price";

      price.innerHTML = `
        <span class="gm-old">${money(row.price)}</span>
        <span class="gm-new">${money(row.promo_price)}</span>
      `;

      meta.append(name, price);
      article.append(badge, meta);

      grid.appendChild(article);
    });
  }

  function apply(rows) {
    styles();

    rows.forEach(updateCard);
    renderHighlights(rows);

    document.documentElement.dataset
      .gafforelliMenuSync = "ok";
  }

  let loading = false;

  async function refresh() {
    if (loading) return;

    loading = true;

    try {
      const response = await fetch(
        `${API}?t=${Date.now()}`,
        {
          cache: "no-store"
        }
      );

      if (!response.ok)
        throw new Error(
          `HTTP ${response.status}`
        );

      const data = await response.json();

      const rows =
        Array.isArray(data)
          ? data
          : data.items;

      if (Array.isArray(rows))
        apply(rows);

    } catch (e) {
      console.error(
        "Erro ao carregar promoções:",
        e
      );
    } finally {
      loading = false;
    }
  }

  window.gafforelliRefreshMenu =
    refresh;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      refresh
    );
  } else {
    refresh();
  }

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden)
        refresh();
    }
  );

  setInterval(refresh, 15000);
})();
