// =====================================================================
// App Pegue e Monte — checkout próprio (Appmax; Pagar.me guardada) dentro do app e das páginas de vendas
// Uso: import { abrirCheckout, checkoutAtivo } from './checkout.js?v=...'
//      abrirCheckout({ plano: 'anual', contexto: 'app' | 'venda', linkReserva: 'https://pay.cakto...' })
// O cartão vira "token" direto na Appmax (Appmax JS) ou na Pagar.me; o número nunca passa pelo nosso servidor.
// =====================================================================
import * as dados from './dados.js?v=20261126a';
import { PAGARME_PK } from './config.js?v=20261121e';

const PASSOS = ['Sua conta', 'Pagamento', 'Acesso'];
const reais = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const so = (v) => String(v ?? '').replace(/\D/g, '');
let planosCache = null;
// Qual função de pagamento usar: a Appmax responde se ela é a ligada; se não, usa a Pagar.me (guardada)
let FUNCAO = 'pagarme';

export async function planos() {
  if (planosCache) return planosCache;
  try {
    const r = await dados.chamarFuncao('appmax', { acao: 'planos' });
    if (r && r.gateway === 'appmax') { FUNCAO = 'appmax'; planosCache = r; return r; }
  } catch (e) { /* função da Appmax ainda não publicada: segue com a Pagar.me */ }
  planosCache = await dados.chamarFuncao('pagarme', { acao: 'planos' });
  return planosCache;
}

// ---------------------------------------------------------------------
// Appmax JS: transforma o cartão em token no navegador e pega o IP de quem compra
// (a Appmax lê os campos pelos nomes card-number, card-holder-name, exp-month, exp-year e cvv)
// ---------------------------------------------------------------------
const appmax = { pronto: null, ip: '', espera: null };
function carregarAppmax(cat) {
  if (appmax.pronto) return appmax.pronto;
  appmax.pronto = new Promise((ok) => {
    if (dados.MODO_DEMO || !cat || !cat.external_id) { ok(false); return; }
    const cli = document.createElement('form'); cli.setAttribute('data-appmax-customer', ''); cli.hidden = true;
    const f = document.createElement('form'); f.setAttribute('data-appmax-checkout', ''); f.method = 'POST'; f.id = 'apm-cartao';
    f.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden';
    f.innerHTML = ['card-number', 'card-holder-name', 'exp-month', 'exp-year', 'cvv'].map((n) => `<input name="${n}" required>`).join('') + '<button type="submit">ok</button>';
    f.addEventListener('submit', (e) => e.preventDefault());
    document.body.append(cli, f);
    const sc = document.createElement('script'); sc.src = cat.script; sc.async = true;
    sc.onload = () => {
      try {
        window.AppmaxScripts.init({
          externalId: cat.external_id,
          onIp: (d) => { appmax.ip = (d && d.ip) || ''; },
          onTokenize: (d) => { const t = d && (d.token || (typeof d === 'string' ? d : '')); if (appmax.espera) { appmax.espera.ok(t); appmax.espera = null; } },
          onError: (err) => { if (appmax.espera) { appmax.espera.erro(err); appmax.espera = null; } },
        });
        ok(true);
      } catch (e) { ok(false); }
    };
    sc.onerror = () => ok(false);
    document.head.appendChild(sc);
  });
  return appmax.pronto;
}
async function tokenAppmax(c) {
  if (!(await appmax.pronto)) throw new Error('Não deu para carregar o pagamento com cartão. Recarregue a página ou pague com Pix.');
  const f = document.getElementById('apm-cartao');
  f.elements['card-number'].value = c.numero; f.elements['card-holder-name'].value = c.titular;
  f.elements['exp-month'].value = c.mes; f.elements['exp-year'].value = c.ano; f.elements.cvv.value = c.cvv;
  const t = await new Promise((ok, erro) => {
    appmax.espera = { ok, erro };
    setTimeout(() => { if (appmax.espera) { appmax.espera = null; erro(new Error('tempo')); } }, 20000);
    if (f.requestSubmit) f.requestSubmit(); else f.querySelector('button').click();
  }).catch(() => '');
  ['card-number', 'card-holder-name', 'exp-month', 'exp-year', 'cvv'].forEach((n) => { f.elements[n].value = ''; });
  if (!t) throw new Error('Confira os dados do cartão.');
  return t;
}
export async function checkoutAtivo() {
  try { return !!(await planos()).ativo; } catch (e) { return false; }
}

function origemAnuncio() {
  const campos = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'src', 'sck'];
  const u = new URLSearchParams(location.search), o = {};
  campos.forEach((c) => { const v = u.get(c); if (v) o[c] = v.slice(0, 200); });
  if (Object.keys(o).length) return o;
  for (const k of ['apm-origem', 'apm-quiz2-origem', 'apm-quiz-origem']) {
    try { const v = JSON.parse(localStorage.getItem(k) || 'null'); if (v && typeof v === 'object') return v; } catch (e) { /* segue */ }
  }
  return null;
}

// Link da Cakto levando junto de onde a pessoa veio (UTMs do anúncio; dentro do app, src=app e o popup em sck),
// para a Utmify saber a campanha e o popup de cada venda.
export function linkCakto(link, popup) {
  try {
    const u = new URL(link);
    const o = origemAnuncio() || {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'sck'].forEach((c) => { if (o[c] && !u.searchParams.get(c)) u.searchParams.set(c, String(o[c]).slice(0, 200)); });
    if (popup && !u.searchParams.get('sck')) { u.searchParams.set('sck', ('popup-' + popup).slice(0, 60)); if (!u.searchParams.get('src')) u.searchParams.set('src', 'app'); }
    return u.href;
  } catch (e) { return link; }
}
// Página de assinatura com a Cakto: avisa o InitiateCheckout (uma vez) e vai para a Cakto na mesma aba
async function irParaCakto(destino, op, cat) {
  if (!window.__apmIniciou) {
    window.__apmIniciou = true;
    garantirPixel();
    const pl = op.plano === 'mensal' ? 'mensal' : 'anual';
    const valor = cat && cat.planos && cat.planos[pl] ? cat.planos[pl].valor / 100 : (pl === 'mensal' ? 29.9 : 167);
    // espera o pixel carregar (no máximo 1,5 s) para o aviso não se perder na troca de página
    for (let i = 0; i < 15 && !(window.fbq && window.fbq.callMethod) && !dados.MODO_DEMO; i++) await new Promise((r) => setTimeout(r, 100));
    evento('InitiateCheckout', { content_name: pl, content_ids: [pl], value: valor, currency: 'BRL', num_items: 1 });
    await new Promise((r) => setTimeout(r, 400));
  }
  location.href = destino;
}

// ---------------------------------------------------------------------
// Pixel do Meta: o checkout carrega sozinho (se a página ainda não tiver) e avisa
// InitiateCheckout (abriu), AddPaymentInfo (Pix gerado / cartão enviado) e Purchase (aprovado).
// A compra também vai pelo servidor (API de Conversões) com o mesmo código, sem contar duas vezes.
// ---------------------------------------------------------------------
const PIXEL_META = '1489696249388385';
function garantirPixel() {
  if (dados.MODO_DEMO || window.fbq) return;
  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', PIXEL_META);
}
function evento(nome, dadosEvento, id) {
  try { garantirPixel(); if (window.fbq) window.fbq('track', nome, dadosEvento || {}, id ? { eventID: id } : undefined); } catch (e) { /* segue */ }
}
// Para páginas que não têm o pixel: carrega e marca a visita (PageView)
export function iniciarPixel() { const tinha = !!window.fbq; garantirPixel(); try { if (!tinha && window.fbq) window.fbq('track', 'PageView'); } catch (e) { /* segue */ } }
function cookie(nome) {
  try { const m = document.cookie.match(new RegExp('(?:^|; )' + nome + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; }
}

function css() {
  if (document.getElementById('ck-css')) return;
  const s = document.createElement('style');
  s.id = 'ck-css';
  s.textContent = `
.ck-veu{position:fixed;inset:0;background:rgba(42,27,61,.42);z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;animation:ckf .2s}
@keyframes ckf{from{opacity:0}}@keyframes cks{from{transform:translateY(40px);opacity:.4}}
.ck{width:100%;max-width:480px;max-height:94vh;overflow:auto;background:#FFFBF7;color:#2A1B3D;border-radius:28px 28px 0 0;padding:10px 22px calc(22px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:14px;font-family:'Plus Jakarta Sans','Nunito Sans',system-ui,-apple-system,sans-serif;animation:cks .25s;box-sizing:border-box}
.ck *{box-sizing:border-box}
.pic { display: inline-block; width: 1.2em; height: 1.2em; vertical-align: -.24em; flex: none; background-color: var(--destaque, #C73B48); -webkit-mask: var(--i) center / contain no-repeat; mask: var(--i) center / contain no-repeat; }
.ck-fo.sel .pic-x { background-color: currentColor; }
.pic-cadeado { --i: url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22black%22 stroke-width=%221.9%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Crect x=%225%22 y=%2211%22 width=%2214%22 height=%2210%22 rx=%222%22/%3E%3Cpath d=%22M8 11V8a4 4 0 0 1 8 0v3%22/%3E%3C/svg%3E"); }
.pic-raio { --i: url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22black%22 stroke-width=%221.9%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22M13 3L5 13.5h6L10 21l8-10.5h-6z%22/%3E%3C/svg%3E"); }
.pic-cartao { --i: url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22black%22 stroke-width=%221.9%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Crect x=%223%22 y=%225.5%22 width=%2218%22 height=%2213%22 rx=%222%22/%3E%3Cpath d=%22M3 10h18M7 15h3%22/%3E%3C/svg%3E"); }
@media(min-width:700px){.ck-veu{align-items:center}.ck{border-radius:28px;max-height:90vh}}
.ck-puxa{width:46px;height:5px;border-radius:9px;background:#DCD3DF;align-self:center}
.ck-cab{display:flex;justify-content:space-between;align-items:center}
.ck-cab b{font-family:'Plus Jakarta Sans','Nunito Sans',system-ui,sans-serif;font-size:21px;font-weight:700}
.ck-x{width:38px;height:38px;border-radius:12px;background:#fff;border:0;box-shadow:0 2px 10px rgba(0,0,0,.08);font-size:18px;color:#8A8093;cursor:pointer}
.ck-passos{display:grid;grid-template-columns:repeat(3,1fr);position:relative}
.ck-passos:before{content:'';position:absolute;top:17px;left:16%;right:16%;height:3px;background:#EDE3D8}
.ck-passos i.b{position:absolute;top:17px;left:16%;height:3px;background:#C73B48}
.ck-p{display:flex;flex-direction:column;align-items:center;gap:6px;position:relative;font-size:13px;color:#6B6175;font-weight:700}
.ck-p span{width:36px;height:36px;border-radius:50%;background:#fff;border:2px solid #EDE3D8;display:grid;place-items:center;font-weight:800;color:#9A90A3}
.ck-p.on span,.ck-p.ok span{background:#C73B48;border-color:#C73B48;color:#fff}.ck-p.on{color:#2A1B3D}
.ck h2{font-family:'Plus Jakarta Sans','Nunito Sans',system-ui,sans-serif;font-size:23px;margin:0;line-height:1.2}
.ck .ck-sub{color:#6B6175;font-size:14.5px;margin:-8px 0 0}
.ck label{display:flex;flex-direction:column;gap:5px;font-size:13.5px;font-weight:700;color:#6B6175}
.ck input,.ck select{width:100%;background:#fff;border:1.5px solid #EDE3D8;border-radius:14px;padding:13px 14px;font:inherit;font-size:16px;color:#2A1B3D;font-weight:600}
.ck input:focus,.ck select:focus{outline:none;border-color:#C73B48}
.ck input.ck-pre{background:#F4FBF7;border-color:#9FD9BC}
.ck-pre-ok{display:block;margin-top:4px;font-size:12px;font-weight:800;color:#1F7A52}
.ck-duas{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ck-btn{background:#C73B48;color:#fff;border:0;border-radius:16px;padding:16px;font:inherit;font-weight:800;font-size:16.5px;cursor:pointer;box-shadow:0 6px 16px rgba(199,59,72,.28);width:100%}
.ck-btn:disabled{opacity:.6;cursor:wait}
.ck-link{background:none;border:0;color:#C73B48;font:inherit;font-weight:800;font-size:14.5px;cursor:pointer;text-align:center;padding:4px}
.ck-seg{text-align:center;color:#8A8093;font-size:12.5px;font-weight:600}
.ck-planos{background:#fff;border-radius:20px;padding:8px;display:flex;flex-direction:column;gap:6px;box-shadow:0 2px 10px rgba(0,0,0,.04)}
.ck-pl{display:grid;grid-template-columns:24px 1fr auto;gap:12px;align-items:center;padding:13px 12px;border-radius:15px;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;width:100%}
.ck-pl.sel{background:#FBEFF0;box-shadow:inset 0 0 0 1.5px #C73B48}
.ck-pl .r{width:22px;height:22px;border-radius:50%;border:2px solid #CFC6D6}.ck-pl.sel .r{border:7px solid #C73B48}
.ck-pl b{font-size:16.5px;display:block}.ck-pl small{color:#6B6175;font-size:12.5px}
.ck-pl .v{font-family:'Plus Jakarta Sans','Nunito Sans',system-ui,sans-serif;font-weight:700;font-size:20px;text-align:right;white-space:nowrap}
.ck-pl .v s{display:block;font-size:12px;color:#9A90A3;font-weight:600;font-family:'Plus Jakarta Sans','Nunito Sans',system-ui,sans-serif}
.ck-selo{display:inline-block;background:#EEF8F2;color:#1F7A52;font-size:11.5px;font-weight:800;border-radius:99px;padding:2px 8px;margin:3px 0}
.ck-formas{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ck-fo{background:#fff;border-radius:16px;padding:13px 14px;border:1.5px solid #EDE3D8;position:relative;font:inherit;color:inherit;text-align:left;cursor:pointer}
.ck-fo.sel{border-color:#C73B48;box-shadow:inset 0 0 0 1px #C73B48}
.ck-fo b{font-size:15.5px;display:block}.ck-fo small{color:#6B6175;font-size:12.5px}
.ck-fo .tag{position:absolute;top:-10px;right:10px;background:#1F7A52;color:#fff;font-size:11px;font-weight:800;border-radius:99px;padding:2px 9px}
.ck-tot{display:flex;justify-content:space-between;font-weight:800;font-size:16px;padding:0 4px}
.ck-qr{width:230px;height:230px;margin:0 auto;background:#fff;border-radius:22px;padding:14px;box-shadow:0 2px 12px rgba(0,0,0,.06)}
.ck-qr svg,.ck-qr img{width:100%;height:100%}
.ck-cod{background:#fff;border:1.5px dashed #EDE3D8;border-radius:12px;padding:10px 12px;font-family:monospace;font-size:12px;color:#8A8093;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ck-espera{display:flex;gap:10px;align-items:center;background:#F3ECFC;color:#4A2F73;border-radius:14px;padding:12px 14px;font-size:14px;font-weight:700}
.ck-spin{width:18px;height:18px;border-radius:50%;border:3px solid #CDBDEA;border-top-color:#4A2F73;flex:none;animation:ckr 1s linear infinite}
@keyframes ckr{to{transform:rotate(360deg)}}
.ck-erro{background:#FFF1F2;color:#A32D3A;border-radius:14px;padding:12px 14px;font-size:14px;font-weight:700}
.ck-ok{width:86px;height:86px;border-radius:50%;background:#EEF8F2;display:grid;place-items:center;margin:8px auto 0;font-size:44px;color:#1F7A52}
.ck-centro{text-align:center}
.ck-end{font-size:13px;color:#6B6175;margin-top:-6px}
.ck-oculto{display:none!important}
.ck-oferta{background:#EEF8F2;border:1.5px solid #BFE3CD;border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:8px;font-size:14.5px;color:#1B4D36}
.ck-oferta .ck-btn{background:#1F7A52;box-shadow:none;padding:13px;font-size:15.5px}
.ck-dg{text-align:center}
.ck-dg-ic{width:58px;height:58px;border-radius:18px;background:#FBE9EB;display:grid;place-items:center;margin:4px auto 0}.ck-dg-ic .pic{width:28px;height:28px}
.ck-dg-tag{align-self:center;background:#1F7A52;color:#fff;font-weight:800;font-size:12.5px;border-radius:99px;padding:5px 13px;letter-spacing:.03em;margin-top:4px}
.ck-dg-txt{color:#6B6175;font-size:14.5px;font-weight:600;line-height:1.5;margin:-4px 0 0}
.ck-dg-box{border:2px solid #2A1B3D;border-radius:18px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;gap:10px;text-align:left;background:#fff}
.ck-dg-box small{display:block;color:#6B6175;font-weight:700;font-size:12.5px}
.ck-dg-box b{font-family:'Plus Jakarta Sans','Nunito Sans',system-ui,sans-serif;font-size:26px;font-weight:800;white-space:nowrap}
.ck-dg-box .d{text-align:right;font-size:12.5px;color:#6B6175;font-weight:700;line-height:1.35}.ck-dg-box .d .g{display:block;color:#1F7A52;font-size:14px;font-weight:800}
.ck-dg-cartao{background:#F5F0F7;border-radius:14px;padding:12px 14px;display:flex;gap:10px;align-items:center;font-weight:800;font-size:15px;text-align:left}
.ck-link.sub{color:#6B6175;text-decoration:underline}
.ck-up-ok{display:flex;gap:10px;align-items:center;background:#EAF7F0;color:#1F7A52;border-radius:14px;padding:10px 14px;font-weight:800;font-size:13.5px;text-align:left}
.ck-up-ok svg{flex:none}
.ck-up-tag{align-self:center;background:#C73B48;color:#fff;font-weight:800;font-size:12px;border-radius:99px;padding:5px 13px;letter-spacing:.04em}
.ck-up-box{border:2px solid #2A1B3D;border-radius:18px;padding:12px 16px}
.ck-up-l{display:flex;justify-content:space-between;gap:10px;font-size:14px;font-weight:700;color:#6B6175;padding:3px 0}
.ck-up-l.tot{border-top:1px dashed #DDD3E0;margin-top:6px;padding-top:9px;color:#2A1B3D;font-size:15px;font-weight:800;align-items:center}
.ck-up-l.tot b{font-family:'Plus Jakarta Sans','Nunito Sans',system-ui,sans-serif;font-size:24px}
.ck-up-eco{text-align:center;color:#1F7A52;font-weight:800;font-size:13.5px}
.ck-up-aviso{background:#FFF4E5;color:#8A5A12;border-radius:12px;padding:9px 12px;font-size:12.5px;font-weight:700;text-align:center;line-height:1.4}
.ck-up-sel{display:block;border:1.5px solid #DDD3E0;border-radius:14px;padding:8px 14px;text-align:left}
.ck-up-sel small{display:block;color:#6B6175;font-weight:700;font-size:12px}
.ck .ck-up-sel select{border:0;padding:0;margin:0;width:100%;font:inherit;font-weight:800;font-size:15px;background:none;color:#2A1B3D;box-shadow:none}
.ck-renova{background:#F5F0F7;border-radius:14px;padding:11px 13px;display:flex;gap:10px;align-items:flex-start;font-size:13px;font-weight:700;color:#4A3F57;line-height:1.45;text-align:left}
.ck-renova svg{flex:none;margin-top:1px}.ck-renova b{color:#2A1B3D}
.ck-cupom{display:flex;gap:10px;align-items:center;background:#EAF7F0;border:1.5px dashed #7CC9A3;color:#1F7A52;border-radius:14px;padding:10px 14px;font-weight:800;font-size:13.5px;text-align:left}
.ck-cupom svg{flex:none}.ck-cupom small{display:block;font-weight:700;font-size:12.5px}
.ck-up-mini{text-align:center;color:#8A8194;font-size:11.5px;font-weight:600;line-height:1.4}`;
  document.head.appendChild(s);
}

// ---------------------------------------------------------------------
export async function abrirCheckout(op = {}) {
  css();
  let cat;
  try { cat = await planos(); } catch (e) { cat = null; }
  // troca: os preços podem ter sido lidos antes do login; lê de novo para saber se a conta tem direito
  if (op.troca && cat && !cat.troca) { try { planosCache = null; cat = await planos(); } catch (e) { /* segue com o anual normal */ } }
  if (!cat || !cat.ativo) {
    // checkout próprio desligado: paga na Cakto
    if (op.linkReserva) {
      const destino = linkCakto(op.linkReserva, op.popup);
      if (op.initiate) { await irParaCakto(destino, op, cat); return; }
      const w = window.open(destino, '_blank', 'noopener'); if (!w) location.href = destino;
    }
    return;
  }
  garantirPixel();
  const valorPlano = (pl) => (cat.planos[pl] ? cat.planos[pl].valor / 100 : 0);
  // InitiateCheckout só quando a página de assinatura pede (initiate: true), uma vez por visita
  if (op.initiate && !window.__apmIniciou) { window.__apmIniciou = true; evento('InitiateCheckout', { content_name: op.plano === 'mensal' ? 'mensal' : 'anual', content_ids: [op.plano === 'mensal' ? 'mensal' : 'anual'], value: valorPlano(op.plano === 'mensal' ? 'mensal' : 'anual'), currency: 'BRL', num_items: 1 }); }

  const sessao = await dados.sessaoAtual().catch(() => null);
  const st = {
    contexto: op.contexto || 'app',
    plano: op.plano === 'mensal' ? 'mensal' : 'anual',
    metodo: 'pix',
    parcelas: 1,
    email: (sessao && sessao.user && sessao.user.email) || op.email || '',
    nome: op.nome || '', telefone: op.telefone || '', cpf: '',
    temCliente: !!op.temCliente,
    logado: !!sessao,
    passo: sessao || op.contexto !== 'venda' ? 'plano' : 'conta',
    erro: '', pagamento: null,
  };
  // link dos e-mails com o cupom PRIMEIRA: o desconto já entra (o servidor confere se a pessoa nunca assinou)
  if (String(op.cupom || '').toUpperCase() === 'PRIMEIRA') { st.oferta = 'primeira'; st.plano = 'mensal'; }
  // troca do mensal para o anual pagando só a diferença (o servidor diz se a conta tem direito)
  if (op.troca && sessao && cat.troca && cat.troca.valor > 0) { st.troca = true; st.plano = 'anual'; st.passo = 'troca'; }
  const ehAppmax = FUNCAO === 'appmax';
  if (ehAppmax) carregarAppmax(cat);
  const temCartao = dados.MODO_DEMO || (ehAppmax ? !!cat.cartao : !!PAGARME_PK);
  const empresa = ehAppmax ? 'Appmax' : 'Pagar.me';
  const veu = document.createElement('div');
  veu.className = 'ck-veu';
  veu.innerHTML = '<div class="ck" role="dialog" aria-modal="true" aria-label="Pagamento"></div>';
  document.body.appendChild(veu);
  const caixa = veu.firstChild;
  const travaScroll = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  let consulta = null, fechado = false;
  const fechar = () => {
    fechado = true; st.cartao = null; clearInterval(consulta); veu.remove(); document.body.style.overflow = travaScroll;
    if ((st.passo === 'acesso' || st.passo === 'upsell') && op.aoConcluir) op.aoConcluir();
  };
  veu.addEventListener('click', (e) => { if (e.target === veu && st.passo !== 'acesso' && st.passo !== 'upsell') fechar(); });
  // oferta única de R$ 15 no 1º mês (só depois de o cartão recusar o mensal; o servidor confere)
  const OFERTA_15 = 1500;
  // preço do 1º mês nas ofertas do mensal: R$ 15 (depois do cartão recusado) e cupom PRIMEIRA (link dos e-mails, 50% OFF)
  const OFERTAS = { mes1_15: OFERTA_15, primeira: 1495 };
  const ofertaMes = () => st.plano === 'mensal' && !!OFERTAS[st.oferta];
  const emTroca = () => !!st.troca && st.plano === 'anual';
  const parcelasAnual = () => (emTroca() ? cat.troca.parcelas : cat.parcelas);
  const precoBase = () => (ofertaMes() ? OFERTAS[st.oferta] : emTroca() ? cat.troca.valor : cat.planos[st.plano].valor);
  const totalAtual = () => (st.metodo === 'cartao' && st.plano === 'anual' ? parcelasAnual()[st.parcelas - 1].total : precoBase());

  const cabeca = (n) => {
    const passos = st.contexto === 'venda' ? PASSOS : PASSOS.slice(1);
    const idx = st.contexto === 'venda' ? n : n - 1;
    return `<div class="ck-puxa"></div>
      <div class="ck-cab"><b>${esc(op.titulo || 'App Pegue e Monte')}</b><button class="ck-x" data-fechar aria-label="Fechar">✕</button></div>
      <div class="ck-passos" style="grid-template-columns:repeat(${passos.length},1fr)"><i class="b" style="width:${passos.length > 1 ? (idx / (passos.length - 1)) * 68 : 0}%"></i>
        ${passos.map((t, i) => `<div class="ck-p ${i < idx ? 'ok' : i === idx ? 'on' : ''}"><span>${i < idx ? '✓' : i + 1}</span>${esc(t)}</div>`).join('')}</div>`;
  };
  const erroHtml = () => (st.erro ? `<div class="ck-erro" role="alert">${esc(st.erro)}</div>` : '');
  const seg = `<div class="ck-seg"><i class="pic pic-cadeado"></i> Pagamento seguro pela ${ehAppmax ? 'Appmax' : 'Pagar.me (Stone)'}</div>`;

  function desenhar() {
    if (fechado) return;
    if (st.passo === 'conta') desenharConta();
    else if (st.passo === 'entrar') desenharEntrar();
    else if (st.passo === 'plano') desenharPlano();
    else if (st.passo === 'pix') desenharPix();
    else if (st.passo === 'cartao') desenharCartao();
    else if (st.passo === 'dg_mensal' || st.passo === 'dg_15') desenharOferta();
    else if (st.passo === 'upsell') desenharUpsell();
    else if (st.passo === 'troca') desenharTroca();
    else desenharAcesso();
    const x = caixa.querySelector('[data-fechar]');
    if (x) x.onclick = fechar;
  }

  // 1. Conta (só na página de vendas)
  function desenharConta() {
    caixa.innerHTML = `${cabeca(0)}
      <h2>Falta pouco! Crie seu acesso</h2>
      <p class="ck-sub">Leva 30 segundos. Seus kits e reservas ficam nesta conta.</p>
      ${erroHtml()}
      <form class="ck-form" novalidate style="display:flex;flex-direction:column;gap:12px">
        <label>Seu nome<input name="nome" autocomplete="name" value="${esc(st.nome)}" maxlength="120" required></label>
        <label>E-mail<input name="email" type="email" inputmode="email" autocomplete="email" value="${esc(st.email)}" required${op.preenchido && st.email ? ' class="ck-pre"' : ''}>${op.preenchido && st.email ? '<span class="ck-pre-ok">Já preenchido com o que você digitou</span>' : ''}</label>
        <label>WhatsApp<input name="telefone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(11) 98765-4321" value="${esc(st.telefone)}" required${op.preenchido && st.telefone ? ' class="ck-pre"' : ''}></label>
        <label>Crie uma senha<input name="senha" type="password" autocomplete="new-password" placeholder="mínimo 6 caracteres" minlength="6" required></label>
        <button class="ck-btn" type="submit">Continuar</button>
      </form>
      <button class="ck-link" data-entrar>Já tenho conta: entrar</button>${seg}`;
    caixa.querySelector('[data-entrar]').onclick = () => { st.erro = ''; st.passo = 'entrar'; desenhar(); };
    const f = caixa.querySelector('form');
    f.onsubmit = async (e) => {
      e.preventDefault();
      st.nome = f.nome.value.trim(); st.email = f.email.value.trim().toLowerCase(); st.telefone = f.telefone.value.trim();
      const senha = f.senha.value;
      if (st.nome.length < 2) return mostrarErro('Digite seu nome.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(st.email)) return mostrarErro('Digite um e-mail válido.');
      if (so(st.telefone).length < 10) return mostrarErro('Digite o WhatsApp com DDD.');
      if (senha.length < 6) return mostrarErro('A senha precisa ter pelo menos 6 caracteres.');
      const b = f.querySelector('button'); b.disabled = true; b.textContent = 'Criando…';
      try {
        await dados.criarConta(st.email, senha);
        st.logado = !!(await dados.sessaoAtual().catch(() => null));
        st.erro = ''; st.passo = 'plano'; desenhar();
      } catch (err) {
        if (/registered|already|cadastrad|existe/i.test(err.message)) { st.erro = 'Este e-mail já tem conta. Digite sua senha para continuar.'; st.passo = 'entrar'; desenhar(); return; }
        b.disabled = false; b.textContent = 'Continuar'; mostrarErro(err.message);
      }
    };
  }
  function desenharEntrar() {
    caixa.innerHTML = `${cabeca(0)}
      <h2>Entre na sua conta</h2>
      <p class="ck-sub">Use o e-mail e a senha do app.</p>
      ${erroHtml()}
      <form novalidate style="display:flex;flex-direction:column;gap:12px">
        <label>E-mail<input name="email" type="email" inputmode="email" autocomplete="email" value="${esc(st.email)}" required${op.preenchido && st.email ? ' class="ck-pre"' : ''}>${op.preenchido && st.email ? '<span class="ck-pre-ok">Já preenchido com o que você digitou</span>' : ''}</label>
        <label>Senha<input name="senha" type="password" autocomplete="current-password" required></label>
        <button class="ck-btn" type="submit">Entrar e continuar</button>
      </form>
      <button class="ck-link" data-esqueci>Esqueci a senha</button>
      <button class="ck-link" data-criar style="color:#6B6175">Criar uma conta nova</button>${seg}`;
    caixa.querySelector('[data-criar]').onclick = () => { st.erro = ''; st.passo = 'conta'; desenhar(); };
    caixa.querySelector('[data-esqueci]').onclick = async () => {
      const em = caixa.querySelector('input[name=email]').value.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return mostrarErro('Digite seu e-mail para receber o link.');
      try { await dados.esqueciSenha(em); mostrarErro('Enviamos um link para criar uma senha nova. Confira o e-mail (e o spam).'); }
      catch (err) { mostrarErro(err.message); }
    };
    const f = caixa.querySelector('form');
    f.onsubmit = async (e) => {
      e.preventDefault();
      const b = f.querySelector('button'); b.disabled = true; b.textContent = 'Entrando…';
      try {
        st.email = f.email.value.trim().toLowerCase();
        await dados.entrar(st.email, f.senha.value);
        st.logado = true; st.erro = ''; st.passo = 'plano'; desenhar();
      } catch (err) { b.disabled = false; b.textContent = 'Entrar e continuar'; mostrarErro('E-mail ou senha incorretos.'); }
    };
  }

  // 2. Plano e forma de pagamento
  function desenharPlano() {
    const an = cat.planos.anual, me = cat.planos.mensal;
    const pedeCpf = !st.temCliente;
    const primeiro = (st.nome || '').split(' ')[0];
    caixa.innerHTML = `${cabeca(1)}
      <h2>${primeiro ? esc(primeiro) + ', escolha' : 'Escolha'} seu plano</h2>
      ${st.oferta === 'primeira' ? `<div class="ck-cupom"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F7A52" stroke-width="2"><path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1.6"/></svg><span>Cupom PRIMEIRA aplicado<small>50% OFF no 1º mês do mensal</small></span></div>` : ''}
      <div class="ck-planos">
        <button class="ck-pl ${st.plano === 'anual' ? 'sel' : ''}" data-plano="anual"><span class="r"></span>
          <span><b>Anual</b>${an.de ? `<span class="ck-selo">${Math.round((1 - an.valor / an.de) * 100)}% OFF</span><br>` : ''}<small>${reais(Math.round(an.valor / 12))}/mês · 12 meses</small></span>
          <span class="v">${an.de ? `<s>${reais(an.de)}</s>` : ''}${reais(an.valor)}</span></button>
        <button class="ck-pl ${st.plano === 'mensal' ? 'sel' : ''}" data-plano="mensal"><span class="r"></span>
          <span><b>Mensal</b><small>${OFERTAS[st.oferta] ? `1º mês · depois ${reais(me.valor)}/mês` : 'por mês'}</small></span><span class="v">${OFERTAS[st.oferta] ? `<s>${reais(me.valor)}</s>${reais(OFERTAS[st.oferta])}` : reais(me.valor)}</span></button>
      </div>
      <div class="ck-formas" ${temCartao ? '' : 'style="grid-template-columns:1fr"'}>
        <button class="ck-fo ${st.metodo === 'pix' ? 'sel' : ''}" data-metodo="pix"><span class="tag">Na hora</span><b><i class="pic pic-raio"></i> Pix</b><small>libera em segundos</small></button>
        ${temCartao ? `<button class="ck-fo ${st.metodo === 'cartao' ? 'sel' : ''}" data-metodo="cartao"><b><i class="pic pic-cartao"></i> Cartão</b><small>${st.plano === 'anual' ? 'até 12x' : OFERTAS[st.oferta] ? '1º mês' : 'cobrança automática'}</small></button>` : ''}
      </div>
      ${pedeCpf ? `<label>CPF (para a nota do pagamento)<input name="cpf" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" value="${esc(st.cpf)}" maxlength="14"></label>` : ''}
      ${pedeCpf && !so(st.telefone) && st.contexto !== 'venda' ? `<label>WhatsApp<input name="telefone" type="tel" inputmode="tel" placeholder="(11) 98765-4321" value="${esc(st.telefone)}"></label>` : ''}
      ${erroHtml()}
      <div class="ck-tot"><span>Total</span><span>${reais(precoBase())}</span></div>
      <button class="ck-btn" data-seguir>${st.metodo === 'pix' ? `Gerar Pix de ${reais(precoBase())}` : 'Continuar para o cartão'}</button>${seg}`;
    caixa.querySelectorAll('[data-plano]').forEach((b) => (b.onclick = () => { guardarCampos(); st.plano = b.dataset.plano; st.parcelas = 1; st.erro = ''; desenhar(); }));
    caixa.querySelectorAll('[data-metodo]').forEach((b) => (b.onclick = () => { guardarCampos(); st.metodo = b.dataset.metodo; st.erro = ''; desenhar(); }));
    const cpf = caixa.querySelector('input[name=cpf]');
    if (cpf) cpf.oninput = () => { cpf.value = mascaraCpf(cpf.value); };
    caixa.querySelector('[data-seguir]').onclick = async (e) => {
      guardarCampos();
      if (pedeCpf && !cpfValido(so(st.cpf))) return mostrarErro('Digite um CPF válido.');
      if (pedeCpf && so(st.telefone).length < 10 && st.contexto !== 'venda') return mostrarErro('Digite o WhatsApp com DDD.');
      st.erro = '';
      if (st.metodo === 'cartao') { st.passo = 'cartao'; desenhar(); return; }
      const b = e.currentTarget; b.disabled = true; b.textContent = 'Gerando o Pix…';
      try {
        const r = await pagar({ metodo: 'pix' });
        evento('AddPaymentInfo', { payment_type: 'pix', content_name: st.plano, value: (r.valor || precoBase()) / 100, currency: 'BRL' });
        st.pagamento = r; st.passo = 'pix'; desenhar();
      } catch (err) { b.disabled = false; b.textContent = `Gerar Pix de ${reais(precoBase())}`; mostrarErro(err.message); }
    };
  }
  function guardarCampos() {
    const c = caixa.querySelector('input[name=cpf]'); if (c) st.cpf = c.value;
    const t = caixa.querySelector('input[name=telefone]'); if (t && st.passo === 'plano') st.telefone = t.value;
  }

  // 3a. Pix na tela
  function desenharPix() {
    const p = st.pagamento;
    caixa.innerHTML = `${cabeca(1)}
      <h2>Pague com Pix</h2>
      <p class="ck-sub">${reais(p.valor || precoBase())} · Plano ${st.plano === 'anual' ? 'Anual' : 'Mensal'}</p>
      <div class="ck-qr" id="ck-qr">${p.pix.url ? `<img src="${esc(p.pix.url)}" alt="QR Code do Pix">` : ''}</div>
      <button class="ck-btn" data-copiar>⧉ Copiar código Pix</button>
      <div class="ck-cod">${esc(p.pix.codigo)}</div>
      ${erroHtml()}
      <div class="ck-espera" id="ck-espera"><span class="ck-spin"></span><span>Esperando o pagamento… Assim que pagar, seu acesso libera sozinho.</span></div>
      <div class="ck-seg">O código vale por 30 minutos${temCartao ? ' · <button class="ck-link" data-trocar style="font-size:12.5px;padding:0">Trocar para cartão</button>' : ''}</div>`;
    caixa.querySelector('[data-copiar]').onclick = async (e) => {
      try { await navigator.clipboard.writeText(p.pix.codigo); e.currentTarget.textContent = '✓ Código copiado! Cole no app do banco'; }
      catch (err) { window.prompt('Copie o código Pix:', p.pix.codigo); }
    };
    const tr = caixa.querySelector('[data-trocar]');
    if (tr) tr.onclick = () => { clearInterval(consulta); st.metodo = 'cartao'; st.passo = 'cartao'; desenhar(); };
    desenharQr(p.pix.codigo);
    esperarPagamento(p.id);
  }
  async function desenharQr(codigo) {
    try {
      const { default: qrcode } = await import('./qrcode.mjs?v=20261117c');
      const q = qrcode(0, 'M'); q.addData(codigo); q.make();
      const alvo = caixa.querySelector('#ck-qr');
      if (alvo) alvo.innerHTML = q.createSvgTag({ cellSize: 4, margin: 1, scalable: true });
    } catch (e) { /* fica a imagem da Pagar.me */ }
  }
  function esperarPagamento(id) {
    clearInterval(consulta);
    let voltas = 0;
    const ver = async () => {
      if (fechado) return;
      voltas++;
      try {
        const r = await dados.chamarFuncao(FUNCAO, { acao: 'status', id });
        if (r.status === 'pago') { clearInterval(consulta); st.venceEm = r.vence_em; concluir(r); }
        else if (r.status === 'vencido') { clearInterval(consulta); st.erro = 'Este Pix venceu. Gere outro para continuar.'; st.passo = 'plano'; desenhar(); }
        else if (r.status === 'recusado' && st.passo === 'cartao') { clearInterval(consulta); }
      } catch (e) { /* tenta de novo */ }
      if (voltas > 600) clearInterval(consulta);
    };
    consulta = setInterval(ver, 4000);
  }

  // 3b. Cartão
  // Anual no cartão em 1x (R$ 167, sem troca/upsell): renova sozinho a cada 12 meses; parcelado renova pelo Pix
  const anualAuto = () => st.plano === 'anual' && !emTroca() && Number(st.parcelas) === 1 && totalAtual() === cat.planos.anual.valor;
  const avisoRenovaAnual = () => (anualAuto()
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C73B48" stroke-width="1.8"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/></svg><span><b>Renovação automática.</b> Daqui a 12 meses cobramos ${reais(cat.planos.anual.valor).replace(',00', '')} neste cartão para você não perder o acesso. Avisamos por e-mail 7 dias antes e você cancela quando quiser.</span>`
    : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C73B48" stroke-width="1.8"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/></svg><span><b>Sem cobrança automática.</b> Daqui a 12 meses mandamos o Pix de renovação por e-mail, com aviso antes.</span>`);
  function desenharCartao() {
    const an = st.plano === 'anual';
    caixa.innerHTML = `${cabeca(1)}
      <h2>Pague com cartão</h2>
      <p class="ck-sub">Plano ${an ? 'Anual' : 'Mensal'} · ${reais(totalAtual())}${an ? (anualAuto() ? ' · renova sozinho a cada 12 meses' : '') : ofertaMes() ? ` no 1º mês, depois ${reais(cat.planos.mensal.valor)}/mês` : ' por mês, cobrado automaticamente'}</p>
      ${erroHtml()}
      <form novalidate style="display:flex;flex-direction:column;gap:12px">
        <label>Número do cartão<input name="numero" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000" maxlength="23" required></label>
        <label>Nome impresso no cartão<input name="titular" autocomplete="cc-name" style="text-transform:uppercase" maxlength="60" required></label>
        <div class="ck-duas"><label>Validade<input name="validade" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/AA" maxlength="5" required></label>
          <label>Código (CVV)<input name="cvv" inputmode="numeric" autocomplete="cc-csc" placeholder="3 dígitos" maxlength="4" required></label></div>
        <div class="ck-duas"><label>CEP<input name="cep" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" maxlength="9" required></label>
          <label>Número da casa<input name="num" autocomplete="off" maxlength="10" required></label></div>
        <div class="ck-end" id="ck-end"></div>
        ${an ? `<label>Parcelas<select name="parcelas">${parcelasAnual().map((x) => `<option value="${x.n}" ${x.n === st.parcelas ? 'selected' : ''}>${x.n === 1 ? `1x de ${reais(x.total)} (sem juros)` : `${x.n}x de ${reais(x.parcela)} (total ${reais(x.total)})`}</option>`).join('')}</select></label>` : ''}
        ${an ? `<div class="ck-renova" data-renova>${avisoRenovaAnual()}</div>` : ''}
        <button class="ck-btn" type="submit">Pagar ${reais(totalAtual())}</button>
      </form>
      <button class="ck-link" data-voltar style="color:#6B6175">Voltar e pagar com Pix</button>
      <div class="ck-seg"><i class="pic pic-cadeado"></i> Os dados do cartão vão direto para a ${empresa}. O app não guarda.</div>`;
    const f = caixa.querySelector('form');
    const end = { cep: '', rua: '', bairro: '', cidade: '', uf: '' };
    f.numero.oninput = () => { f.numero.value = so(f.numero.value).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 '); };
    f.validade.oninput = () => { const d = so(f.validade.value).slice(0, 4); f.validade.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d; };
    f.cvv.oninput = () => { f.cvv.value = so(f.cvv.value).slice(0, 4); };
    f.cep.oninput = async () => {
      const d = so(f.cep.value).slice(0, 8);
      f.cep.value = d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
      const alvo = caixa.querySelector('#ck-end');
      if (d.length !== 8) { alvo.textContent = ''; return; }
      try {
        const r = await (await fetch(`https://viacep.com.br/ws/${d}/json/`)).json();
        if (r.erro) { alvo.textContent = 'CEP não encontrado. Confira os números.'; return; }
        Object.assign(end, { cep: d, rua: r.logradouro || '', bairro: r.bairro || '', cidade: r.localidade || '', uf: r.uf || '' });
        alvo.textContent = [r.logradouro, r.bairro, `${r.localidade}/${r.uf}`].filter(Boolean).join(', ');
      } catch (e) { end.cep = d; alvo.textContent = ''; }
    };
    if (f.parcelas) f.parcelas.onchange = () => {
      st.parcelas = Number(f.parcelas.value); f.querySelector('button[type=submit]').textContent = `Pagar ${reais(totalAtual())}`;
      const rn = f.querySelector('[data-renova]'); if (rn) rn.innerHTML = avisoRenovaAnual();
      const sub = caixa.querySelector('.ck-sub'); if (sub) sub.textContent = `Plano Anual · ${reais(totalAtual())}${anualAuto() ? ' · renova sozinho a cada 12 meses' : ''}`;
    };
    caixa.querySelector('[data-voltar]').onclick = () => { st.metodo = 'pix'; st.erro = ''; st.passo = emTroca() ? 'troca' : 'plano'; desenhar(); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const numero = so(f.numero.value), [mm, aa] = f.validade.value.split('/'), cvv = so(f.cvv.value);
      if (numero.length < 13) return mostrarErro('Confira o número do cartão.');
      if (f.titular.value.trim().length < 3) return mostrarErro('Digite o nome como está no cartão.');
      if (!(Number(mm) >= 1 && Number(mm) <= 12) || so(aa).length !== 2) return mostrarErro('Confira a validade (MM/AA).');
      if (cvv.length < 3) return mostrarErro('Confira o código de segurança (CVV).');
      if (so(f.cep.value).length !== 8) return mostrarErro('Digite o CEP do endereço do cartão.');
      if (!f.num.value.trim()) return mostrarErro('Digite o número da casa.');
      const b = f.querySelector('button[type=submit]'); b.disabled = true; b.textContent = 'Processando…';
      try {
        evento('AddPaymentInfo', { payment_type: 'cartao', content_name: st.plano, value: totalAtual() / 100, currency: 'BRL' });
        // guarda o cartão só nesta tela (memória), para tentar o mensal ou a oferta sem digitar de novo
        st.cartao = { numero, titular: f.titular.value.trim().toUpperCase(), mm: Number(mm), aa: Number('20' + so(aa)), cvv, endereco: { ...end, cep: so(f.cep.value), numero: f.num.value.trim() } };
        const token = await tokenizar({ number: numero, holder_name: st.cartao.titular, exp_month: st.cartao.mm, exp_year: st.cartao.aa, cvv });
        const r = await pagar({ metodo: 'cartao', card_token: token, titular: st.cartao.titular, parcelas: st.plano === 'anual' ? st.parcelas : 1, endereco: st.cartao.endereco });
        st.pagamento = r;
        if (r.status === 'pago') { st.venceEm = r.vence_em; aprovado(r); return; }
        if (r.status === 'analise') {
          b.textContent = 'Em análise pelo banco…';
          st.erro = ''; esperarPagamento(r.id);
          const aviso = document.createElement('div'); aviso.className = 'ck-espera';
          aviso.innerHTML = '<span class="ck-spin"></span><span>O banco está conferindo o pagamento. Isso leva poucos minutos; pode deixar esta tela aberta.</span>';
          f.after(aviso);
          return;
        }
        if (proximaOferta()) return;
        b.disabled = false; b.textContent = `Pagar ${reais(totalAtual())}`;
        mostrarErro(r.mensagem || 'Cartão recusado pelo banco. Confira os dados ou pague com Pix, que libera na hora.');
      } catch (err) { b.disabled = false; b.textContent = `Pagar ${reais(totalAtual())}`; mostrarErro(err.message); }
    };
  }
  // Cartão recusado: anual → oferece o mensal no mesmo cartão; mensal → oferta única de R$ 15 no 1º mês
  function proximaOferta() {
    if (!st.cartao) return false;
    if (st.plano === 'anual') { st.erro = ''; st.passo = 'dg_mensal'; desenhar(); return true; }
    if (st.plano === 'mensal' && !st.oferta) { st.erro = ''; st.passo = 'dg_15'; desenhar(); return true; }
    return false;
  }
  function desenharOferta() {
    const me = cat.planos.mensal.valor;
    const quinze = st.passo === 'dg_15';
    const final = st.cartao ? st.cartao.numero.slice(-4) : '';
    caixa.innerHTML = `<div class="ck-puxa"></div>
      ${quinze ? '<span class="ck-dg-tag">OFERTA ÚNICA</span>' : '<div class="ck-dg-ic"><i class="pic pic-cartao"></i></div>'}
      <h2 class="ck-dg">${quinze ? `Comece por ${reais(OFERTA_15).replace(',00', '')} no 1º mês` : 'O cartão não aprovou o anual'}</h2>
      <p class="ck-dg ck-dg-txt">${quinze
        ? `Para você não ficar sem organizar suas reservas: o primeiro mês sai por ${reais(OFERTA_15).replace(',00', '')}. Depois, ${reais(me)} por mês. Cancele quando quiser.`
        : 'Às vezes o limite não cobre o valor de uma vez. Você pode começar pelo plano mensal agora, com o mesmo cartão.'}</p>
      <div class="ck-dg-box">${quinze
        ? `<span><small>1º mês</small><b>${reais(OFERTA_15)}</b></span><span class="d"><span class="g">${reais(me - OFERTA_15)} de desconto</span>depois ${reais(me)}/mês</span>`
        : `<span><small>Plano mensal</small><b>${reais(me)}</b></span><span class="d">por mês<br>cancele quando quiser</span>`}</div>
      ${final ? `<div class="ck-dg-cartao"><i class="pic pic-cartao"></i> Mesmo cartão · final ${esc(final)}</div>` : ''}
      ${erroHtml()}
      <button class="ck-btn" data-sim>${quinze ? `Começar por ${reais(OFERTA_15).replace(',00', '')}` : 'Assinar o mensal'}</button>
      <button class="ck-link sub" data-outro>${quinze ? 'Pagar com Pix' : 'Usar outro cartão ou Pix'}</button>`;
    const sim = caixa.querySelector('[data-sim]');
    sim.onclick = async () => {
      st.plano = 'mensal'; st.parcelas = 1; st.metodo = 'cartao'; st.semUpsell = true;
      if (quinze) st.oferta = 'mes1_15';
      sim.disabled = true; sim.textContent = 'Processando…';
      try {
        const c = st.cartao;
        evento('AddPaymentInfo', { payment_type: 'cartao', content_name: 'mensal', value: precoBase() / 100, currency: 'BRL' });
        const token = await tokenizar({ number: c.numero, holder_name: c.titular, exp_month: c.mm, exp_year: c.aa, cvv: c.cvv });
        const r = await pagar({ metodo: 'cartao', card_token: token, titular: c.titular, parcelas: 1, endereco: c.endereco });
        st.pagamento = r;
        if (r.status === 'pago') { st.venceEm = r.vence_em; concluir(r); return; }
        if (r.status === 'analise') {
          sim.textContent = 'Em análise pelo banco…'; esperarPagamento(r.id);
          const aviso = document.createElement('div'); aviso.className = 'ck-espera';
          aviso.innerHTML = '<span class="ck-spin"></span><span>O banco está conferindo o pagamento. Isso leva poucos minutos; pode deixar esta tela aberta.</span>';
          sim.after(aviso);
          return;
        }
        if (proximaOferta()) return;
        // a oferta também não passou no cartão: volta para a tela do cartão (outro cartão) com o aviso
        st.erro = 'O cartão recusou de novo. Tente outro cartão ou pague com Pix, que libera na hora.'; st.passo = 'cartao'; desenhar();
      } catch (err) { sim.disabled = false; sim.textContent = quinze ? `Começar por ${reais(OFERTA_15).replace(',00', '')}` : 'Assinar o mensal'; mostrarErro(err.message); }
    };
    const outro = caixa.querySelector('[data-outro]');
    outro.onclick = async () => {
      st.plano = 'mensal'; st.parcelas = 1; st.erro = '';
      if (!quinze) { st.metodo = 'pix'; st.passo = 'plano'; desenhar(); return; }
      // oferta no Pix: gera direto o Pix de R$ 15
      st.oferta = 'mes1_15'; st.metodo = 'pix';
      outro.disabled = true; outro.textContent = 'Gerando o Pix…';
      try {
        const r = await pagar({ metodo: 'pix' });
        evento('AddPaymentInfo', { payment_type: 'pix', content_name: 'mensal', value: (r.valor || precoBase()) / 100, currency: 'BRL' });
        st.pagamento = r; st.passo = 'pix'; desenhar();
      } catch (err) { outro.disabled = false; outro.textContent = 'Pagar com Pix'; mostrarErro(err.message); }
    };
  }
  async function tokenizar(card) {
    if (dados.MODO_DEMO) return /^4000/.test(card.number) ? 'token_ruim' : 'token_ok';
    if (ehAppmax) return tokenAppmax({ numero: card.number, titular: card.holder_name, mes: String(card.exp_month).padStart(2, '0'), ano: String(card.exp_year), cvv: card.cvv });
    const r = await fetch(`https://api.pagar.me/core/v5/tokens?appId=${encodeURIComponent(PAGARME_PK)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'card', card }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.id) throw new Error('Confira os dados do cartão.');
    return j.id;
  }
  async function pagar(extra) {
    if (ehAppmax) await Promise.race([appmax.pronto, new Promise((ok) => setTimeout(ok, 1500))]);
    try { return await chamarPagar(extra); } catch (e) {
      // cupom recusado (a pessoa já assinou antes): tira o cupom e mostra o preço normal
      if (st.oferta === 'primeira' && /PRIMEIRA/.test(e.message || '')) {
        st.oferta = ''; st.passo = 'plano'; desenhar();
        throw new Error(`${e.message} O mensal fica ${reais(cat.planos.mensal.valor)}.`);
      }
      throw e;
    }
  }
  function chamarPagar(extra) {
    return dados.chamarFuncao(FUNCAO, {
      acao: 'pagar', plano: st.plano, cpf: so(st.cpf), nome: st.nome, telefone: so(st.telefone), ip: appmax.ip || undefined,
      email: st.logado ? undefined : st.email, origem: origemAnuncio(), popup: op.popup || null,
      fbp: cookie('_fbp'), fbc: cookie('_fbc'), pagina: location.origin + location.pathname,
      oferta: st.oferta && st.plano === 'mensal' ? st.oferta : undefined,
      troca: emTroca() ? true : undefined, ...extra,
    });
  }

  // 4. Acesso liberado
  // Troca do mensal para o anual (link ?anual=1): paga só a diferença, no Pix ou no cartão
  function desenharTroca() {
    const me = cat.planos.mensal.valor, an = cat.planos.anual.valor, t = cat.troca;
    const pago = t.mensal_pago || (an - t.valor);
    const ate = t.vence ? new Date(t.vence).toLocaleDateString('pt-BR') : '';
    caixa.innerHTML = `<div class="ck-puxa"></div>
      <span class="ck-up-tag">SÓ PARA QUEM JÁ É ASSINANTE</span>
      <h2 class="ck-dg">Troque para o anual e pague só a diferença</h2>
      <p class="ck-dg ck-dg-txt">Os ${reais(pago)} que você pagou este mês já contam. A mensalidade é cancelada e você fica 12 meses sem pagar nada.</p>
      <div class="ck-up-box">
        <div class="ck-up-l"><span>12 meses no mensal</span><s>${reais(me * 12)}</s></div>
        <div class="ck-up-l"><span>Anual promocional</span><span style="color:#2A1B3D">${reais(an)}</span></div>
        <div class="ck-up-l"><span>Seu mensal deste mês</span><span>− ${reais(pago)}</span></div>
        <div class="ck-up-l tot"><span>Você paga só</span><b>${reais(t.valor)}</b></div>
      </div>
      ${ate ? `<div class="ck-up-eco">Seu anual vale até ${esc(ate)}</div>` : ''}
      <div class="ck-formas" ${temCartao ? '' : 'style="grid-template-columns:1fr"'}>
        <button class="ck-fo ${st.metodo === 'pix' ? 'sel' : ''}" data-metodo="pix"><span class="tag">Na hora</span><b><i class="pic pic-raio"></i> Pix</b><small>libera na hora</small></button>
        ${temCartao ? `<button class="ck-fo ${st.metodo === 'cartao' ? 'sel' : ''}" data-metodo="cartao"><b><i class="pic pic-cartao"></i> Cartão</b><small>até 12x</small></button>` : ''}
      </div>
      ${erroHtml()}
      <button class="ck-btn" data-seguir>Continuar · ${reais(t.valor)}</button>
      <button class="ck-link sub" data-nao>Agora não</button>
      <p class="ck-up-mini">Depois de pago, o plano muda para anual na hora e a cobrança mensal de ${reais(me)} deixa de existir.</p>`;
    caixa.querySelectorAll('[data-metodo]').forEach((b) => (b.onclick = () => { st.metodo = b.dataset.metodo; st.erro = ''; desenhar(); }));
    caixa.querySelector('[data-nao]').onclick = () => fechar();
    caixa.querySelector('[data-seguir]').onclick = async (e) => {
      st.erro = ''; st.parcelas = 1;
      if (st.metodo === 'cartao') { st.passo = 'cartao'; desenhar(); return; }
      const b = e.currentTarget; b.disabled = true; b.textContent = 'Gerando o Pix…';
      try {
        const r = await pagar({ metodo: 'pix' });
        evento('AddPaymentInfo', { payment_type: 'pix', content_name: 'anual', value: (r.valor || precoBase()) / 100, currency: 'BRL' });
        st.pagamento = r; st.passo = 'pix'; desenhar();
      } catch (err) { b.disabled = false; b.textContent = `Continuar · ${reais(t.valor)}`; mostrarErro(err.message); }
    };
  }
  // Mensal aprovado no cartão: oferece trocar pelo anual pagando só a diferença (upsell), no mesmo cartão
  function aprovado(r) {
    const pode = st.plano === 'mensal' && !st.oferta && !st.semUpsell && st.cartao && r.tipo !== 'renovacao'
      && Array.isArray(cat.upsell) && cat.upsell.length && cat.planos.anual;
    if (!pode) { concluir(r); return; }
    compraFeita(r);
    st.upsellDe = r; st.upParcelas = 1; st.erro = ''; st.passo = 'upsell'; desenhar();
  }
  function desenharUpsell() {
    const me = cat.planos.mensal.valor, an = cat.planos.anual.valor, dif = an - me;
    const p = cat.upsell[st.upParcelas - 1] || cat.upsell[0];
    const opcoes = cat.upsell.map((o) => `<option value="${o.n}"${o.n === st.upParcelas ? ' selected' : ''}>${o.n === 1 ? `1x de ${reais(o.total)}` : `${o.n}x de ${reais(o.parcela)} (total ${reais(o.total)})`}</option>`).join('');
    const final = st.cartao ? st.cartao.numero.slice(-4) : '';
    caixa.innerHTML = `<div class="ck-puxa"></div>
      <div class="ck-up-ok"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1F7A52" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>Plano mensal aprovado. Seu acesso já está liberado.</div>
      <span class="ck-up-tag">PREÇO PROMOCIONAL · SÓ NESTA TELA</span>
      <h2 class="ck-dg">Garanta o anual pelo preço promocional</h2>
      <p class="ck-dg ck-dg-txt">Os ${reais(me)} que você acabou de pagar já contam. Você paga só a diferença e fica 12 meses sem mensalidade.</p>
      <div class="ck-up-box">
        <div class="ck-up-l"><span>12 meses no mensal</span><s>${reais(me * 12)}</s></div>
        <div class="ck-up-l"><span>Anual promocional</span><span style="color:#2A1B3D">${reais(an)}</span></div>
        <div class="ck-up-l"><span>Já pago hoje</span><span>− ${reais(me)}</span></div>
        <div class="ck-up-l tot"><span>Você paga só</span><b>${reais(dif)}</b></div>
      </div>
      <div class="ck-up-eco">Você economiza ${reais(me * 12 - an)} no ano · fica ${reais(Math.round(an / 12))} por mês</div>
      <div class="ck-up-aviso">Esta oferta aparece uma vez só. Se fechar esta tela, para passar ao anual depois você paga os ${reais(an).replace(',00', '')} inteiros.</div>
      <label class="ck-up-sel"><small>Pagamento</small><select data-parc>${opcoes}</select></label>
      ${final ? `<div class="ck-dg-cartao" style="justify-content:center;background:none;padding:0;color:#6B6175;font-size:14px"><i class="pic pic-cartao"></i> Mesmo cartão · final ${esc(final)}</div>` : ''}
      ${erroHtml()}
      <button class="ck-btn" data-sim>Trocar pelo anual · ${reais(p.total)}</button>
      <button class="ck-link sub" data-nao>Continuar no mensal</button>
      <p class="ck-up-mini">Ao tocar no botão, ${reais(p.total)} ${p.n > 1 ? `(${p.n}x de ${reais(p.parcela)}) ` : ''}são cobrados neste cartão e a mensalidade de ${reais(me)} deixa de existir.</p>`;
    caixa.querySelector('[data-parc]').onchange = (e) => { st.upParcelas = Number(e.target.value) || 1; st.erro = ''; desenhar(); };
    caixa.querySelector('[data-nao]').onclick = () => { concluir(st.upsellDe, true); };
    const sim = caixa.querySelector('[data-sim]');
    sim.onclick = async () => {
      sim.disabled = true; sim.textContent = 'Processando…';
      try {
        const c = st.cartao;
        evento('AddPaymentInfo', { payment_type: 'cartao', content_name: 'anual', value: p.total / 100, currency: 'BRL' });
        const token = await tokenizar({ number: c.numero, holder_name: c.titular, exp_month: c.mm, exp_year: c.aa, cvv: c.cvv });
        const r = await dados.chamarFuncao(FUNCAO, { acao: 'upsell', pagamento: st.upsellDe.id, card_token: token, parcelas: st.upParcelas, titular: c.titular });
        if (r.status === 'pago') {
          st.plano = 'anual'; st.parcelas = st.upParcelas; st.venceEm = r.vence_em || st.venceEm;
          compraFeita(r);
          concluir(r, true);
          return;
        }
        if (r.status === 'analise') {
          // o banco está conferindo: o mensal já vale; quando aprovar, o plano muda sozinho
          concluir(st.upsellDe, true);
          st.aviso = 'A troca pelo anual está em análise pelo banco. Assim que aprovar, seu plano muda sozinho.';
          desenhar();
          return;
        }
        // recusou a diferença: segue no mensal, que já está pago
        concluir(st.upsellDe, true);
        st.aviso = r.mensagem || 'O cartão não aprovou a troca. Você continua no plano mensal, que já está pago.';
        desenhar();
      } catch (err) { sim.disabled = false; sim.textContent = `Trocar pelo anual · ${reais(p.total)}`; mostrarErro(err.message); }
    };
  }
  // Compra nova = Purchase (renovação não conta como venda nova no Meta)
  function compraFeita(r) {
    const id = r.id || (st.pagamento && st.pagamento.id);
    const tipo = r.tipo || (st.pagamento && st.pagamento.tipo);
    if (tipo === 'renovacao') return;
    const dadosCompra = { value: (r.valor || (st.pagamento && st.pagamento.valor) || totalAtual()) / 100, currency: 'BRL', content_name: st.plano, content_ids: [st.plano], content_type: 'product' };
    // cartão liberado na hora, ainda na análise antifraude da Appmax: a venda só conta no Meta quando aprovar
    if (r.analise && id) { vigiarAnalise(id, dadosCompra); return; }
    evento('Purchase', dadosCompra, id ? 'compra-' + id : undefined);
  }
  // Confere em segundo plano (mesmo com a janela fechada) até a análise antifraude terminar
  function vigiarAnalise(id, dadosCompra) {
    let voltas = 0;
    const t = setInterval(async () => {
      voltas++;
      try {
        const r = await dados.chamarFuncao(FUNCAO, { acao: 'status', id });
        if (r.status === 'pago' && !r.analise) { clearInterval(t); evento('Purchase', dadosCompra, 'compra-' + id); return; }
        if (r.status === 'recusado') { clearInterval(t); window.dispatchEvent(new CustomEvent('apm-antifraude-recusado')); return; }
      } catch (e) { /* tenta de novo */ }
      if (voltas >= 180) clearInterval(t);
    }, 15000);
  }
  function concluir(r = {}, jaContou = false) {
    st.passo = 'acesso'; st.erro = ''; st.cartao = null;
    if (!jaContou) compraFeita(r);
    desenhar();
  }
  function desenharAcesso() {
    const ate = st.venceEm ? new Date(st.venceEm).toLocaleDateString('pt-BR') : '';
    const noApp = st.contexto === 'app';
    caixa.innerHTML = `${cabeca(st.contexto === 'venda' ? 2 : 2)}
      <div class="ck-ok">✓</div>
      <h2 class="ck-centro">Pagamento aprovado!</h2>
      <p class="ck-sub ck-centro" style="margin-top:-6px">Seu Plano ${st.plano === 'anual' ? 'Anual' : 'Mensal'} está ativo${ate ? ` até ${esc(ate)}` : ''}.</p>
      ${st.aviso ? `<p class="ck-up-aviso">${esc(st.aviso)}</p>` : ''}
      ${noApp ? '<button class="ck-btn" data-fim>Continuar usando o app</button>'
        : `<a class="ck-btn" style="text-align:center;text-decoration:none" href="${esc(linkDoApp())}">Abrir meu app</a>
           ${st.logado ? '' : `<p class="ck-seg">Entre no app com <b>${esc(st.email)}</b> e a senha que você criou.</p>`}`}`;
    const b = caixa.querySelector('[data-fim]');
    if (b) b.onclick = fechar;
  }
  function linkDoApp() {
    const base = op.appUrl || new URL('./', import.meta.url).href;
    return st.logado ? base : base + '?email=' + encodeURIComponent(st.email);
  }
  function mostrarErro(msg) {
    st.erro = msg;
    let el = caixa.querySelector('.ck-erro');
    if (!el) {
      el = document.createElement('div'); el.className = 'ck-erro'; el.setAttribute('role', 'alert');
      const alvo = caixa.querySelector('.ck-btn') || caixa.lastChild;
      const ref = (alvo.closest && alvo.closest('form')) || alvo;
      ref.parentNode.insertBefore(el, ref);
    }
    el.textContent = msg;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  desenhar();
}

function mascaraCpf(v) {
  const d = so(v).slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
}
function cpfValido(c) {
  if (!/^\d{11}$/.test(c) || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (base, f) => { let s = 0; for (const d of base) s += Number(d) * f--; const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(c.slice(0, 9), 10) === Number(c[9]) && dv(c.slice(0, 10), 11) === Number(c[10]);
}
