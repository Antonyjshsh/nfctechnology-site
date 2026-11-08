(() => {
  'use strict';
  const API = 'https://etgzagkewmsxxerwelmp.supabase.co/functions/v1/gafforelli-manager';
  const TOKEN_KEY = 'gafforelli-rating-visitor-v1';
  let products = [], summaries = new Map(), loaded = false, pending = false, selected = null, score = 0, saving = false, opener;
  const voted = new Set();
  const style = document.createElement('style');
  style.textContent = `
    .card[data-product-id]{padding-bottom:42px;aspect-ratio:auto;cursor:pointer}
    .card[data-product-id]>img.main-img{aspect-ratio:1;object-fit:cover;height:auto}
    .card[data-product-id] .no-photo-v2{position:relative;aspect-ratio:1}
    .card[data-product-id] .meta{bottom:54px}
    .product-rating{position:absolute;bottom:0;left:0;right:0;z-index:6;width:100%;min-height:42px;border:0;border-top:1px solid #353027;background:#171510;color:#e4c789;font:600 11px system-ui;cursor:pointer;padding:8px 4px}
    .product-rating:focus-visible,.rating-dialog button:focus-visible{outline:2px solid #edcc89;outline-offset:-3px}
    .rating-dialog{width:min(92vw,420px);max-height:90dvh;overflow:auto;box-sizing:border-box;border:1px solid #51442b;border-radius:22px;background:#141310;color:#fff;padding:0;box-shadow:0 24px 80px #000a;font-family:system-ui}
    .rating-dialog [hidden]{display:none!important}
    .rating-dialog::backdrop{background:#000c;backdrop-filter:blur(5px)}
    .rating-photo{width:100%;height:190px;object-fit:contain;background:#0a0a09;display:block}
    .rating-body{padding:20px}.rating-body h2{font-size:21px;margin:0 35px 8px 0}.rating-price{color:#e5c887;font-weight:700;margin:0 0 14px}
    .rating-summary{font-size:13px;color:#c7bda9;margin:0 0 20px}.rating-close{position:absolute;right:10px;top:10px;width:36px;height:36px;border-radius:50%;border:1px solid #777;background:#111d;color:white;font-size:24px;cursor:pointer}
    .rating-stars{display:flex;justify-content:center;gap:5px;margin:12px 0}.rating-stars button{width:48px;min-height:48px;border:1px solid #574c39;background:#211e18;color:#8f8775;border-radius:12px;font-size:31px;cursor:pointer}
    .rating-stars button.chosen{color:#f5cb6b;border-color:#c7a359;background:#3b301b}
    .rating-label{text-align:center;min-height:20px;font-size:13px;color:#d7cbb4;margin:8px 0 16px}
    .rating-submit{width:100%;min-height:46px;border:0;border-radius:12px;background:#e4c487;color:#17120a;font:750 14px system-ui;cursor:pointer}
    .rating-submit:disabled{opacity:.45;cursor:default}.rating-note{font-size:11px;line-height:1.5;color:#a79f90;text-align:center;margin-bottom:0}.rating-status{font-size:13px;line-height:1.5;color:#e9d3a2;margin:12px 0 0}
  `;
  document.head.append(style);
  const dialog = document.createElement('dialog');
  dialog.className = 'rating-dialog';
  dialog.setAttribute('aria-labelledby', 'ratingTitle');
  dialog.innerHTML = `<button class="rating-close" aria-label="Fechar avaliação">×</button><img class="rating-photo" alt=""><div class="rating-body"><h2 id="ratingTitle"></h2><p class="rating-price"></p><p class="rating-summary"></p><div class="rating-form"><strong>Como foi sua experiência?</strong><div class="rating-stars" role="group" aria-label="Escolha de 1 a 5 estrelas">${[1,2,3,4,5].map(n=>`<button type="button" data-score="${n}" aria-label="${n} ${n===1?'estrela':'estrelas'}" aria-pressed="false">★</button>`).join('')}</div><p class="rating-label">Toque nas estrelas para escolher</p><button class="rating-submit" disabled>Enviar avaliação</button><p class="rating-note">Sem cadastro. Uma avaliação por produto neste navegador.</p></div><p class="rating-status" role="status" aria-live="polite"></p></div>`;
  document.body.append(dialog);
  const $ = s => dialog.querySelector(s);
  function didVote(id) { try { return voted.has(id) || localStorage.getItem('gafforelli-rated:'+id) === 'yes'; } catch { return voted.has(id); } }
  function remember(id) { voted.add(id); try { localStorage.setItem('gafforelli-rated:'+id,'yes'); } catch {} }
  function visitor() {
    let value = localStorage.getItem(TOKEN_KEY);
    if (!/^[0-9a-f]{64}$/.test(value || '')) {
      value = Array.from(crypto.getRandomValues(new Uint8Array(32)), b=>b.toString(16).padStart(2,'0')).join('');
      localStorage.setItem(TOKEN_KEY,value);
    }
    return value;
  }
  function summary(id) {
    if (!loaded) return 'Avaliações indisponíveis no momento';
    const r = summaries.get(id), count = Number(r?.review_count || 0);
    return count ? `★ ${Number(r.average_rating).toFixed(1).replace('.',',')} · ${count} ${count===1?'avaliação':'avaliações'}` : '☆ Seja o primeiro a avaliar';
  }
  function decorate() {
    document.querySelectorAll('.card[data-product-id]').forEach(card => {
      let button = card.querySelector('.product-rating');
      if (!button) { button = document.createElement('button'); button.type='button'; button.className='product-rating'; card.append(button); }
      button.textContent = summary(card.dataset.productId);
      button.setAttribute('aria-label', `${summary(card.dataset.productId)} — ${card.querySelector('.meta strong')?.textContent || 'Produto'}`);
    });
    if (selected && dialog.open) $('.rating-summary').textContent = summary(selected.id);
  }
  async function refresh() {
    if (pending) return;
    pending = true;
    try {
      const r = await fetch(API+'?action=ratings', {cache:'no-store'});
      if (!r.ok) throw new Error();
      const data = await r.json();
      if (!Array.isArray(data.ratings)) throw new Error();
      summaries = new Map(data.ratings.map(x=>[x.dish_id,x])); loaded=true;
    } catch { /* Keep the last confirmed totals during a temporary outage. */ }
    finally { pending=false; decorate(); }
  }
  function open(product, source) {
    selected=product;opener=source;score=0;
    $('#ratingTitle').textContent=product.name;
    $('.rating-price').textContent=Number(product.promo_live ? product.promo_price : product.price).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    $('.rating-photo').hidden=!product.image_url;
    if(product.image_url){$('.rating-photo').src=product.image_url;$('.rating-photo').alt=product.name;}
    $('.rating-summary').textContent=summary(product.id);
    $('.rating-form').hidden=didVote(product.id);
    $('.rating-status').textContent=didVote(product.id)?'Você já avaliou este produto. Obrigado!':'';
    $('.rating-label').textContent='Toque nas estrelas para escolher';
    $('.rating-submit').disabled=true;$('.rating-submit').textContent='Enviar avaliação';
    dialog.querySelectorAll('[data-score]').forEach(b=>{b.classList.remove('chosen');b.setAttribute('aria-pressed','false');b.disabled=false;});
    dialog.showModal();
    refresh();
  }
  $('.rating-close').onclick=()=>{if(!saving)dialog.close();};
  dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
  dialog.addEventListener('close',()=>{selected=null;if(opener?.isConnected)opener.focus();});
  dialog.addEventListener('click',e=>{if(e.target===dialog&&!saving)dialog.close();});
  dialog.querySelectorAll('[data-score]').forEach(button=>button.onclick=()=>{
    score=Number(button.dataset.score);
    dialog.querySelectorAll('[data-score]').forEach(b=>{b.classList.toggle('chosen',Number(b.dataset.score)<=score);b.setAttribute('aria-pressed',String(Number(b.dataset.score)===score));});
    $('.rating-label').textContent=['','Não gostei','Poderia melhorar','Bom','Muito bom','Excelente'][score];
    $('.rating-submit').disabled=false;
  });
  $('.rating-submit').onclick=async()=>{
    if(!selected||!score||saving)return;
    saving=true;$('.rating-submit').disabled=true;$('.rating-submit').textContent='Enviando…';$('.rating-close').disabled=true;
    dialog.querySelectorAll('[data-score]').forEach(b=>b.disabled=true);
    try {
      let token;try{token=visitor();}catch{throw new Error('Permita o armazenamento deste site no navegador para avaliar.');}
      const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'rate_product',product_id:selected.id,rating:score,visitor_token:token})});
      const result=await r.json();
      if(!r.ok&&!result.already_rated)throw new Error(result.error||'Não foi possível salvar. Tente novamente.');
      remember(selected.id);$('.rating-form').hidden=true;
      $('.rating-status').textContent=result.already_rated?'Você já avaliou este produto neste navegador.':'Avaliação salva. Obrigado por compartilhar sua experiência!';
      await refresh();
    } catch(e){$('.rating-status').textContent=e.message;}
    finally{saving=false;$('.rating-submit').disabled=false;$('.rating-submit').textContent='Enviar avaliação';$('.rating-close').disabled=false;dialog.querySelectorAll('[data-score]').forEach(b=>b.disabled=false);}
  };
  document.addEventListener('click',e=>{
    const card=e.target.closest('.card[data-product-id]');if(!card)return;
    const product=products.find(p=>p.id===card.dataset.productId);if(!product)return;
    e.preventDefault();e.stopImmediatePropagation();open(product,card.querySelector('.product-rating'));
  },true);
  document.addEventListener('gafforelli:products',e=>{products=e.detail;decorate();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  window.addEventListener('online',refresh);
  refresh();setInterval(()=>{if(!document.hidden)refresh();},30000);
})();
