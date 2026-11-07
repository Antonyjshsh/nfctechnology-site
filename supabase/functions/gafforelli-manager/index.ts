import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const SLUG = "gafforelli";
const IMAGE_BUCKET = "restaurant-menu-images";
const SESSION_MS = 12 * 60 * 60 * 1000;
const MAX_IMAGE = 8 * 1024 * 1024;

const reply = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: CORS });

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

function token() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function slugify(v) {
  return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 64) || ("item-" + Date.now());
}

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET" && req.method !== "POST") {
    return reply({ error: "Método não permitido" }, 405);
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return reply({ error: "Configuração ausente" }, 500);

    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: restaurant, error: restaurantError } = await db
      .from("restaurants").select("*").eq("slug", SLUG).single();
    if (restaurantError || !restaurant) throw new Error("Restaurante não encontrado");

    async function categories() {
      const { data, error } = await db.from("categories").select("*")
        .eq("restaurant_id", restaurant.id)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return data || [];
    }

    async function products() {
      const { data, error } = await db.from("dishes").select("*")
        .eq("restaurant_id", restaurant.id)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return data || [];
    }

    function promoLive(p) {
      if (!p.promo_active || p.promo_price === null) return false;
      const now = Date.now();
      if (p.promo_start && new Date(p.promo_start).getTime() > now) return false;
      if (p.promo_end && new Date(p.promo_end).getTime() <= now) return false;
      return true;
    }

    async function verify(password) {
      const { data, error } = await db.rpc("verify_restaurant_admin_password", {
        p_restaurant_id: restaurant.id,
        p_password: String(password || ""),
      });
      if (error) throw new Error(error.message);
      return data === true;
    }

    async function session() {
      const h = req.headers.get("authorization") || "";
      if (!h.startsWith("Bearer ")) return null;
      const raw = h.slice(7).trim();
      if (!raw) return null;
      const hash = await sha256(raw);
      const { data, error } = await db.from("restaurant_admin_sessions")
        .select("id,expires_at").eq("restaurant_id", restaurant.id)
        .eq("token_hash", hash).gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (error || !data) return null;
      db.from("restaurant_admin_sessions")
        .update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
      return { raw, id: data.id };
    }

    async function requireSession() {
      const s = await session();
      if (!s) {
        const e = new Error("Sessão inválida ou expirada");
        e.status = 401;
        throw e;
      }
      return s;
    }

    const highlightDefault = { image_url: null, title: "Baldão de Kit", price_text: "R$ 30 a R$ 80", show_text: true };
    const highlightFile = "gafforelli-highlight.json";
    async function readHighlight() {
      const { data, error } = await db.storage.from("gafforelli-app").download(highlightFile);
      if (error) {
        if (String(error.statusCode) === "404" || /not found/i.test(error.message)) return highlightDefault;
        throw new Error("Não foi possível carregar o destaque");
      }
      return { ...highlightDefault, ...JSON.parse(await data.text()) };
    }
    async function writeHighlight(value) {
      const { error } = await db.storage.from("gafforelli-app").upload(highlightFile, new Blob([JSON.stringify(value)], { type: "application/json" }), { contentType: "application/json", cacheControl: "0", upsert: true });
      if (error) throw error;
    }

    async function snapshot() {
      return { restaurant, highlight: await readHighlight(), categories: await categories(), products: await products() };
    }

    if (req.method === "GET") {
      const cats = (await categories()).filter((c) => c.is_active);
      const ids = new Set(cats.map((c) => c.id));
      const prods = (await products()).filter(
        (p) => p.is_active && p.is_available && ids.has(p.category_id)
      ).map((p) => Object.assign({}, p, { promo_live: promoLive(p) }));
      return reply({
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          description: restaurant.description,
          logo_url: restaurant.logo_url,
          cover_url: restaurant.cover_url,
          primary_color: restaurant.primary_color,
          secondary_color: restaurant.secondary_color,
          background_color: restaurant.background_color,
          text_color: restaurant.text_color,
          contact_whatsapp: restaurant.contact_whatsapp,
          instagram_url: restaurant.instagram_url,
          menu_subtitle: restaurant.menu_subtitle,
        },
        highlight: await readHighlight().catch(() => highlightDefault),
        categories: cats,
        products: prods,
      });
    }

    const ct = req.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      await requireSession();
      const form = await req.formData();
      if (String(form.get("action") || "") !== "upload_image") {
        return reply({ error: "Ação inválida" }, 400);
      }
      const file = form.get("file");
      const target = String(form.get("target") || "product");
      const productId = String(form.get("product_id") || "");
      if (!(file instanceof File)) return reply({ error: "Selecione uma imagem" }, 400);
      if (!file.type.startsWith("image/")) return reply({ error: "Arquivo inválido" }, 400);
      if (file.size > MAX_IMAGE) return reply({ error: "Imagem acima de 8 MB" }, 400);

      if (target === "highlight") {
        const title = String(form.get("title") || "").trim();
        const priceText = String(form.get("price_text") || "").trim();
        const showText = form.get("show_text");
        if (title.length > 100 || priceText.length > 50 || !["true","false"].includes(showText)) return reply({ error: "Confira os textos do destaque" }, 400);
        const bytes = new Uint8Array(await file.arrayBuffer());
        const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        const png = [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n);
        const webp = new TextDecoder().decode(bytes.slice(0,4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8,12)) === "WEBP";
        const mime = jpeg ? "image/jpeg" : png ? "image/png" : webp ? "image/webp" : null;
        if (!mime || mime !== file.type) return reply({ error: "Envie uma imagem JPG, PNG ou WebP válida" }, 400);
        const path = `${SLUG}/highlights/${crypto.randomUUID()}.${jpeg ? "jpg" : png ? "png" : "webp"}`;
        const { error } = await db.storage.from(IMAGE_BUCKET).upload(path, bytes, { contentType: mime, cacheControl: "31536000", upsert: false });
        if (error) throw error;
        const highlight = { image_url: `${url}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`, title, price_text: priceText, show_text: showText === "true", updated_at: new Date().toISOString() };
        try { await writeHighlight(highlight); } catch (error) {
          await db.storage.from(IMAGE_BUCKET).remove([path]);
          throw error;
        }
        return reply({ ok: true, highlight });
      }

      let ext = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "jpg";
      if (!["jpg","jpeg","png","webp","gif"].includes(ext)) ext = "jpg";
      const folder = target === "logo" || target === "cover" ? target : "products";
      const path = SLUG + "/" + folder + "/" + crypto.randomUUID() + "." + ext;
      const { error: upError } = await db.storage.from(IMAGE_BUCKET)
        .upload(path, await file.arrayBuffer(), {
          contentType: file.type, cacheControl: "31536000", upsert: false,
        });
      if (upError) throw new Error(upError.message);
      const imageUrl = url + "/storage/v1/object/public/" + IMAGE_BUCKET + "/" + path;

      if (target === "product") {
        if (!productId) return reply({ error: "Produto não informado" }, 400);
        const { error } = await db.from("dishes")
          .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
          .eq("id", productId).eq("restaurant_id", restaurant.id);
        if (error) throw new Error(error.message);
      } else if (target === "logo" || target === "cover") {
        const field = target === "logo" ? "logo_url" : "cover_url";
        const patch = { updated_at: new Date().toISOString() };
        patch[field] = imageUrl;
        const { error } = await db.from("restaurants").update(patch).eq("id", restaurant.id);
        if (error) throw new Error(error.message);
      } else {
        return reply({ error: "Destino inválido" }, 400);
      }
      return reply({ ok: true, image_url: imageUrl });
    }

    const body = await req.json();
    const action = String(body && body.action || "");

    if (action === "login") {
      if (!(await verify(body.password))) {
        await new Promise((r) => setTimeout(r, 350));
        return reply({ error: "Senha inválida" }, 401);
      }
      await db.from("restaurant_admin_sessions").delete()
        .eq("restaurant_id", restaurant.id)
        .lt("expires_at", new Date().toISOString());
      const raw = token();
      const expires = new Date(Date.now() + SESSION_MS).toISOString();
      const { error } = await db.from("restaurant_admin_sessions").insert({
        restaurant_id: restaurant.id,
        token_hash: await sha256(raw),
        expires_at: expires,
      });
      if (error) throw new Error(error.message);
      return reply({ ok: true, token: raw, expires_at: expires });
    }

    const s = await requireSession();

    if (action === "logout") {
      await db.from("restaurant_admin_sessions").delete().eq("id", s.id);
      return reply({ ok: true });
    }

    if (action === "reset_highlight") {
      await writeHighlight(highlightDefault);
      return reply({ ok: true, highlight: highlightDefault });
    }
    if (action === "save_highlight") {
      const title = String(body.title ?? "").trim();
      const priceText = String(body.price_text ?? "").trim();
      if (title.length > 100 || priceText.length > 50 || typeof body.show_text !== "boolean") return reply({ error: "Confira os textos do destaque" }, 400);
      const highlight = { ...await readHighlight(), title, price_text: priceText, show_text: body.show_text, updated_at: new Date().toISOString() };
      await writeHighlight(highlight);
      return reply({ ok: true, highlight });
    }

    if (action === "snapshot") return reply(await snapshot());

    if (action === "change_password") {
      const current = String(body.current_password || "");
      const next = String(body.new_password || "");
      if (next.length < 8) return reply({ error: "A nova senha deve ter pelo menos 8 caracteres" }, 400);
      if (!(await verify(current))) return reply({ error: "Senha atual incorreta" }, 401);
      const { error } = await db.rpc("set_restaurant_admin_password", {
        p_restaurant_id: restaurant.id,
        p_new_password: next,
      });
      if (error) throw new Error(error.message);
      await db.from("restaurant_admin_sessions").delete().eq("restaurant_id", restaurant.id);
      return reply({ ok: true, relogin: true });
    }

    if (action === "update_restaurant") {
      const patch = { updated_at: new Date().toISOString() };
      const fields = [
        "name","description","menu_subtitle","contact_whatsapp","instagram_url",
        "primary_color","secondary_color","background_color","text_color",
      ];
      for (const f of fields) if (body[f] !== undefined) patch[f] = body[f];
      const { error } = await db.from("restaurants").update(patch).eq("id", restaurant.id);
      if (error) throw new Error(error.message);
      return reply({ ok: true });
    }

    if (action === "create_category") {
      const name = String(body.name || "").trim();
      if (!name) return reply({ error: "Informe o nome da categoria" }, 400);
      let slug = slugify(body.slug || name);
      const { data: used } = await db.from("categories").select("id")
        .eq("restaurant_id", restaurant.id).eq("slug", slug).maybeSingle();
      if (used) slug += "-" + Date.now().toString().slice(-5);
      const { data: last } = await db.from("categories").select("sort_order")
        .eq("restaurant_id", restaurant.id).order("sort_order", { ascending: false }).limit(1);
      const order = body.sort_order === undefined
        ? Number(last && last[0] ? last[0].sort_order : -1) + 1
        : Number(body.sort_order);
      const { data, error } = await db.from("categories").insert({
        restaurant_id: restaurant.id,
        name, slug,
        emoji: String(body.emoji || ""),
        description: body.description ? String(body.description) : null,
        sort_order: order,
        is_active: body.is_active === undefined ? true : Boolean(body.is_active),
      }).select("*").single();
      if (error) throw new Error(error.message);
      return reply({ ok: true, category: data });
    }

    if (action === "update_category") {
      const id = String(body.id || "");
      const patch = { updated_at: new Date().toISOString() };
      for (const f of ["name","emoji","description","sort_order","is_active"]) {
        if (body[f] !== undefined) patch[f] = body[f];
      }
      const { error } = await db.from("categories").update(patch)
        .eq("id", id).eq("restaurant_id", restaurant.id);
      if (error) throw new Error(error.message);
      return reply({ ok: true });
    }

    if (action === "delete_category") {
      const id = String(body.id || "");
      const { count, error: countError } = await db.from("dishes")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurant.id).eq("category_id", id);
      if (countError) throw new Error(countError.message);
      if ((count || 0) > 0) {
        return reply({ error: "Mova ou exclua os produtos desta categoria antes de excluí-la" }, 409);
      }
      const { error } = await db.from("categories").delete()
        .eq("id", id).eq("restaurant_id", restaurant.id);
      if (error) throw new Error(error.message);
      return reply({ ok: true });
    }

    if (action === "create_product") {
      const name = String(body.name || "").trim();
      const categoryId = String(body.category_id || "");
      const price = Number(body.price);
      if (!name || !categoryId || !Number.isFinite(price) || price < 0) {
        return reply({ error: "Preencha nome, categoria e preço corretamente" }, 400);
      }
      const { data: cat } = await db.from("categories").select("id")
        .eq("id", categoryId).eq("restaurant_id", restaurant.id).maybeSingle();
      if (!cat) return reply({ error: "Categoria inválida" }, 400);

      let itemKey = slugify(name);
      const { data: used } = await db.from("dishes").select("id")
        .eq("restaurant_id", restaurant.id).eq("item_key", itemKey).maybeSingle();
      if (used) itemKey += "-" + Date.now().toString().slice(-5);

      const { data: last } = await db.from("dishes").select("sort_order")
        .eq("restaurant_id", restaurant.id).eq("category_id", categoryId)
        .order("sort_order", { ascending: false }).limit(1);
      const order = body.sort_order === undefined
        ? Number(last && last[0] ? last[0].sort_order : -1) + 1
        : Number(body.sort_order);

      const { data, error } = await db.from("dishes").insert({
        restaurant_id: restaurant.id,
        category_id: categoryId,
        item_key: itemKey,
        name,
        description: body.description ? String(body.description) : null,
        price,
        image_url: body.image_url ? String(body.image_url) : null,
        sort_order: order,
        is_available: body.is_available === undefined ? true : Boolean(body.is_available),
        is_active: body.is_active === undefined ? true : Boolean(body.is_active),
        is_featured: Boolean(body.is_featured),
        featured_order: num(body.featured_order),
        promo_active: false,
      }).select("*").single();
      if (error) throw new Error(error.message);
      return reply({ ok: true, product: data });
    }

    if (action === "update_product") {
      const id = String(body.id || "");
      if (!id) return reply({ error: "Produto inválido" }, 400);
      const patch = { updated_at: new Date().toISOString() };
      for (const f of [
        "category_id","name","description","image_url","sort_order",
        "is_available","is_active","is_featured","featured_order",
      ]) if (body[f] !== undefined) patch[f] = body[f];

      if (body.price !== undefined) {
        const price = Number(body.price);
        if (!Number.isFinite(price) || price < 0) return reply({ error: "Preço inválido" }, 400);
        patch.price = price;
      }

      if (
        body.promo_active !== undefined || body.promo_price !== undefined ||
        body.promo_start !== undefined || body.promo_end !== undefined
      ) {
        if (body.promo_active !== undefined) patch.promo_active = Boolean(body.promo_active);
        if (body.promo_price !== undefined) patch.promo_price = num(body.promo_price);
        if (body.promo_start !== undefined) patch.promo_start = body.promo_start || null;
        if (body.promo_end !== undefined) patch.promo_end = body.promo_end || null;
        if (body.promo_active === true) patch.promoted_at = new Date().toISOString();
        if (body.promo_active === false) {
          patch.promo_price = null;
          patch.promo_start = null;
          patch.promo_end = null;
          patch.promoted_at = null;
        }
      }

      const { data: old } = await db.from("dishes").select("price,promo_price,promo_active")
        .eq("id", id).eq("restaurant_id", restaurant.id).maybeSingle();
      if (!old) return reply({ error: "Produto não encontrado" }, 404);

      const effectivePromoActive = patch.promo_active === undefined ? old.promo_active : patch.promo_active;
      const effectivePromoPrice = patch.promo_price === undefined ? old.promo_price : patch.promo_price;
      const effectivePrice = patch.price === undefined ? Number(old.price) : Number(patch.price);
      if (effectivePromoActive && (effectivePromoPrice === null || effectivePromoPrice < 0)) {
        return reply({ error: "Informe o preço promocional" }, 400);
      }
      if (effectivePromoActive && Number(effectivePromoPrice) >= effectivePrice) {
        return reply({ error: "O preço promocional deve ser menor que o preço normal" }, 400);
      }

      const { data, error } = await db.from("dishes").update(patch)
        .eq("id", id).eq("restaurant_id", restaurant.id).select("*").single();
      if (error) throw new Error(error.message);
      return reply({ ok: true, product: data });
    }

    if (action === "delete_product") {
      const id = String(body.id || "");
      const { data: old } = await db.from("dishes").select("image_url")
        .eq("id", id).eq("restaurant_id", restaurant.id).maybeSingle();
      const { error } = await db.from("dishes").delete()
        .eq("id", id).eq("restaurant_id", restaurant.id);
      if (error) throw new Error(error.message);
      const marker = "/storage/v1/object/public/" + IMAGE_BUCKET + "/";
      if (old && old.image_url && old.image_url.includes(marker)) {
        const path = old.image_url.split(marker)[1];
        if (path) await db.storage.from(IMAGE_BUCKET).remove([path]);
      }
      return reply({ ok: true });
    }

    if (action === "reorder_categories") {
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
      for (let i = 0; i < ids.length; i++) {
        await db.from("categories").update({
          sort_order: i, updated_at: new Date().toISOString(),
        }).eq("id", ids[i]).eq("restaurant_id", restaurant.id);
      }
      return reply({ ok: true });
    }

    if (action === "reorder_products") {
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
      for (let i = 0; i < ids.length; i++) {
        await db.from("dishes").update({
          sort_order: i, updated_at: new Date().toISOString(),
        }).eq("id", ids[i]).eq("restaurant_id", restaurant.id);
      }
      return reply({ ok: true });
    }

    return reply({ error: "Ação desconhecida" }, 400);
  } catch (error) {
    console.error(error);
    const status = Number(error && error.status || 500);
    return reply({
      error: status === 500
        ? "Erro interno: " + (error instanceof Error ? error.message : String(error))
        : error.message,
    }, status);
  }
});