// =====================================================================
// App Pegue e Monte — checkout próprio (Pagar.me) dentro do app e das páginas de vendas
// Uso: import { abrirCheckout, checkoutAtivo } from './checkout.js?v=...'
//      abrirCheckout({ plano: 'anual', contexto: 'app' | 'venda', linkReserva: 'https://pay.cakto...' })
// O cartão vira "token" direto na Pagar.me (chave pública); o número nunca passa pelo nosso servidor.
// =====================================================================
import * as dados from './dados.js?v=20261121e';
import { PAGARME_PK } from './config.js?v=20261121e';

const PASSOS = ['Sua conta', 'Pagamento', 'Acesso'];
const reais = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const so = (v) => String(v ?? '').replace(/\D/g, '');
let planosCache = null;

export async function planos() {
  if (planosCache) return planosCache;
  planosCache = await dados.chamarFuncao('pagarme', { acao: 'planos' });
  return planosCache;
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
.ck{width:100%;max-width:480px;max-height:94vh;overflow:auto;background:#FFFBF7;color:#2A1B3D;border-radius:28px 28px 0 0;padding:10px 22px calc(22px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:14px;font-family:'Nunito Sans',system-ui,-apple-system,sans-serif;animation:cks .25s;box-sizing:border-box}
.ck *{box-sizing:border-box}
.pic { display: inline-block; width: 1.2em; height: 1.2em; vertical-align: -.24em; flex: none; background-color: var(--destaque, #C73B48); -webkit-mask: var(--i) center / contain no-repeat; mask: var(--i) center / contain no-repeat; }
.ck-fo.sel .pic-x { background-color: currentColor; }
.pic-cadeado { --i: url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22black%22 stroke-width=%221.9%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Crect x=%225%22 y=%2211%22 width=%2214%22 height=%2210%22 rx=%222%22/%3E%3Cpath d=%22M8 11V8a4 4 0 0 1 8 0v3%22/%3E%3C/svg%3E"); }
.pic-raio { --i: url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22black%22 stroke-width=%221.9%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22M13 3L5 13.5h6L10 21l8-10.5h-6z%22/%3E%3C/svg%3E"); }
.pic-cartao { --i: url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22black%22 stroke-width=%221.9%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Crect x=%223%22 y=%225.5%22 width=%2218%22 height=%2213%22 rx=%222%22/%3E%3Cpath d=%22M3 10h18M7 15h3%22/%3E%3C/svg%3E"); }
@media(min-width:700px){.ck-veu{align-items:center}.ck{border-radius:28px;max-height:90vh}}
.ck-puxa{width:46px;height:5px;border-radius:9px;background:#DCD3DF;align-self:center}
.ck-cab{display:flex;justify-content:space-between;align-items:center}
.ck-cab b{font-family:'Fredoka','Nunito Sans',sans-serif;font-size:21px;font-weight:700}
.ck-x{width:38px;height:38px;border-radius:12px;background:#fff;border:0;box-shadow:0 2px 10px rgba(0,0,0,.08);font-size:18px;color:#8A8093;cursor:pointer}
.ck-passos{display:grid;grid-template-columns:repeat(3,1fr);position:relative}
.ck-passos:before{content:'';position:absolute;top:17px;left:16%;right:16%;height:3px;background:#EDE3D8}
.ck-passos i.b{position:absolute;top:17px;left:16%;height:3px;background:#C73B48}
.ck-p{display:flex;flex-direction:column;align-items:center;gap:6px;position:relative;font-size:13px;color:#6B6175;font-weight:700}
.ck-p span{width:36px;height:36px;border-radius:50%;background:#fff;border:2px solid #EDE3D8;display:grid;place-items:center;font-weight:800;color:#9A90A3}
.ck-p.on span,.ck-p.ok span{background:#C73B48;border-color:#C73B48;color:#fff}.ck-p.on{color:#2A1B3D}
.ck h2{font-family:'Fredoka','Nunito Sans',sans-serif;font-size:23px;margin:0;line-height:1.2}
.ck .ck-sub{color:#6B6175;font-size:14.5px;margin:-8px 0 0}
.ck label{display:flex;flex-direction:column;gap:5px;font-size:13.5px;font-weight:700;color:#6B6175}
.ck input,.ck select{width:100%;background:#fff;border:1.5px solid #EDE3D8;border-radius:14px;padding:13px 14px;font:inherit;font-size:16px;color:#2A1B3D;font-weight:600}
.ck input:focus,.ck select:focus{outline:none;border-color:#C73B48}
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
.ck-pl .v{font-family:'Fredoka','Nunito Sans',sans-serif;font-weight:700;font-size:20px;text-align:right;white-space:nowrap}
.ck-pl .v s{display:block;font-size:12px;color:#9A90A3;font-weight:600;font-family:'Nunito Sans',sans-serif}
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
.ck-oferta .ck-btn{background:#1F7A52;box-shadow:none;padding:13px;font-size:15.5px}`;
  document.head.appendChild(s);
}

// ---------------------------------------------------------------------
export async function abrirCheckout(op = {}) {
  css();
  let cat;
  try { cat = await planos(); } catch (e) { cat = null; }
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
  const temCartao = !!PAGARME_PK || dados.MODO_DEMO;
  const veu = document.createElement('div');
  veu.className = 'ck-veu';
  veu.innerHTML = '<div class="ck" role="dialog" aria-modal="true" aria-label="Pagamento"></div>';
  document.body.appendChild(veu);
  const caixa = veu.firstChild;
  const travaScroll = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  let consulta = null, fechado = false;
  const fechar = () => {
    fechado = true; clearInterval(consulta); veu.remove(); document.body.style.overflow = travaScroll;
    if (st.passo === 'acesso' && op.aoConcluir) op.aoConcluir();
  };
  veu.addEventListener('click', (e) => { if (e.target === veu && st.passo !== 'acesso') fechar(); });
  const precoBase = () => cat.planos[st.plano].valor;
  const totalAtual = () => (st.metodo === 'cartao' && st.plano === 'anual' ? cat.parcelas[st.parcelas - 1].total : precoBase());

  const cabeca = (n) => {
    const passos = st.contexto === 'venda' ? PASSOS : PASSOS.slice(1);
    const idx = st.contexto === 'venda' ? n : n - 1;
    return `<div class="ck-puxa"></div>
      <div class="ck-cab"><b>${esc(op.titulo || 'App Pegue e Monte')}</b><button class="ck-x" data-fechar aria-label="Fechar">✕</button></div>
      <div class="ck-passos" style="grid-template-columns:repeat(${passos.length},1fr)"><i class="b" style="width:${passos.length > 1 ? (idx / (passos.length - 1)) * 68 : 0}%"></i>
        ${passos.map((t, i) => `<div class="ck-p ${i < idx ? 'ok' : i === idx ? 'on' : ''}"><span>${i < idx ? '✓' : i + 1}</span>${esc(t)}</div>`).join('')}</div>`;
  };
  const erroHtml = () => (st.erro ? `<div class="ck-erro" role="alert">${esc(st.erro)}</div>` : '');
  const seg = '<div class="ck-seg"><i class="pic pic-cadeado"></i> Pagamento seguro pela Pagar.me (Stone)</div>';

  function desenhar() {
    if (fechado) return;
    if (st.passo === 'conta') desenharConta();
    else if (st.passo === 'entrar') desenharEntrar();
    else if (st.passo === 'plano') desenharPlano();
    else if (st.passo === 'pix') desenharPix();
    else if (st.passo === 'cartao') desenharCartao();
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
        <label>E-mail<input name="email" type="email" inputmode="email" autocomplete="email" value="${esc(st.email)}" required></label>
        <label>WhatsApp<input name="telefone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(11) 98765-4321" value="${esc(st.telefone)}" required></label>
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
        <label>E-mail<input name="email" type="email" inputmode="email" autocomplete="email" value="${esc(st.email)}" required></label>
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
      <div class="ck-planos">
        <button class="ck-pl ${st.plano === 'anual' ? 'sel' : ''}" data-plano="anual"><span class="r"></span>
          <span><b>Anual</b>${an.de ? `<span class="ck-selo">${Math.round((1 - an.valor / an.de) * 100)}% OFF</span><br>` : ''}<small>${reais(Math.round(an.valor / 12))}/mês · 12 meses</small></span>
          <span class="v">${an.de ? `<s>${reais(an.de)}</s>` : ''}${reais(an.valor)}</span></button>
        <button class="ck-pl ${st.plano === 'mensal' ? 'sel' : ''}" data-plano="mensal"><span class="r"></span>
          <span><b>Mensal</b><small>por mês</small></span><span class="v">${reais(me.valor)}</span></button>
      </div>
      <div class="ck-formas" ${temCartao ? '' : 'style="grid-template-columns:1fr"'}>
        <button class="ck-fo ${st.metodo === 'pix' ? 'sel' : ''}" data-metodo="pix"><span class="tag">Na hora</span><b><i class="pic pic-raio"></i> Pix</b><small>libera em segundos</small></button>
        ${temCartao ? `<button class="ck-fo ${st.metodo === 'cartao' ? 'sel' : ''}" data-metodo="cartao"><b><i class="pic pic-cartao"></i> Cartão</b><small>${st.plano === 'anual' ? 'até 12x' : 'cobrança automática'}</small></button>` : ''}
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
        const r = await dados.chamarFuncao('pagarme', { acao: 'status', id });
        if (r.status === 'pago') { clearInterval(consulta); st.venceEm = r.vence_em; concluir(r); }
        else if (r.status === 'vencido') { clearInterval(consulta); st.erro = 'Este Pix venceu. Gere outro para continuar.'; st.passo = 'plano'; desenhar(); }
        else if (r.status === 'recusado' && st.passo === 'cartao') { clearInterval(consulta); }
      } catch (e) { /* tenta de novo */ }
      if (voltas > 600) clearInterval(consulta);
    };
    consulta = setInterval(ver, 4000);
  }

  // 3b. Cartão
  function desenharCartao() {
    const an = st.plano === 'anual';
    caixa.innerHTML = `${cabeca(1)}
      <h2>Pague com cartão</h2>
      <p class="ck-sub">Plano ${an ? 'Anual' : 'Mensal'} · ${reais(totalAtual())}${an ? '' : ' por mês, cobrado automaticamente'}</p>
      ${erroHtml()}
      <form novalidate style="display:flex;flex-direction:column;gap:12px">
        <label>Número do cartão<input name="numero" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000" maxlength="23" required></label>
        <label>Nome impresso no cartão<input name="titular" autocomplete="cc-name" style="text-transform:uppercase" maxlength="60" required></label>
        <div class="ck-duas"><label>Validade<input name="validade" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/AA" maxlength="5" required></label>
          <label>Código (CVV)<input name="cvv" inputmode="numeric" autocomplete="cc-csc" placeholder="3 dígitos" maxlength="4" required></label></div>
        <div class="ck-duas"><label>CEP<input name="cep" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" maxlength="9" required></label>
          <label>Número da casa<input name="num" autocomplete="off" maxlength="10" required></label></div>
        <div class="ck-end" id="ck-end"></div>
        ${an ? `<label>Parcelas<select name="parcelas">${cat.parcelas.map((x) => `<option value="${x.n}" ${x.n === st.parcelas ? 'selected' : ''}>${x.n === 1 ? `1x de ${reais(x.total)} (sem juros)` : `${x.n}x de ${reais(x.parcela)} (total ${reais(x.total)})`}</option>`).join('')}</select></label>` : ''}
        <button class="ck-btn" type="submit">Pagar ${reais(totalAtual())}</button>
      </form>
      <button class="ck-link" data-voltar style="color:#6B6175">Voltar e pagar com Pix</button>
      <div class="ck-seg"><i class="pic pic-cadeado"></i> Os dados do cartão vão direto para a Pagar.me. O app não guarda.</div>`;
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
    if (f.parcelas) f.parcelas.onchange = () => { st.parcelas = Number(f.parcelas.value); f.querySelector('button[type=submit]').textContent = `Pagar ${reais(totalAtual())}`; };
    caixa.querySelector('[data-voltar]').onclick = () => { st.metodo = 'pix'; st.erro = ''; st.passo = 'plano'; desenhar(); };
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
        const token = await tokenizar({ number: numero, holder_name: f.titular.value.trim().toUpperCase(), exp_month: Number(mm), exp_year: Number('20' + so(aa)), cvv });
        const r = await pagar({ metodo: 'cartao', card_token: token, parcelas: st.plano === 'anual' ? st.parcelas : 1,
          endereco: { ...end, cep: so(f.cep.value), numero: f.num.value.trim() } });
        st.pagamento = r;
        if (r.status === 'pago') { st.venceEm = r.vence_em; concluir(r); return; }
        if (r.status === 'analise') {
          b.textContent = 'Em análise pelo banco…';
          st.erro = ''; esperarPagamento(r.id);
          const aviso = document.createElement('div'); aviso.className = 'ck-espera';
          aviso.innerHTML = '<span class="ck-spin"></span><span>O banco está conferindo o pagamento. Isso leva poucos minutos; pode deixar esta tela aberta.</span>';
          f.after(aviso);
          return;
        }
        b.disabled = false; b.textContent = `Pagar ${reais(totalAtual())}`;
        mostrarErro(r.mensagem || 'Cartão recusado pelo banco. Confira os dados ou pague com Pix, que libera na hora.');
        if (st.plano === 'anual') ofertaMensal(r.motivo);
      } catch (err) { b.disabled = false; b.textContent = `Pagar ${reais(totalAtual())}`; mostrarErro(err.message); }
    };
  }
  // Anual recusado no cartão: oferece o mensal (valor bem menor), no mesmo cartão ou no Pix
  function ofertaMensal(motivo) {
    const me = cat.planos.mensal.valor;
    let caixaOferta = caixa.querySelector('.ck-oferta');
    if (!caixaOferta) { caixaOferta = document.createElement('div'); caixaOferta.className = 'ck-oferta'; caixa.querySelector('.ck-erro').after(caixaOferta); }
    caixaOferta.innerHTML = `<b>${motivo === 'limite' ? 'Parece que foi o limite do cartão.' : 'Quer tentar de outro jeito?'}</b>
      <span>Comece pelo <b>plano mensal: ${reais(me)} por mês</b>. Seus kits e reservas ficam iguais, e dá para passar para o anual depois.</span>
      <button type="button" class="ck-btn" data-mensal-cartao>Assinar o mensal neste cartão</button>
      <button type="button" class="ck-link" data-mensal-pix>Pagar o mensal no Pix</button>`;
    caixaOferta.querySelector('[data-mensal-cartao]').onclick = () => {
      const f = caixa.querySelector('form');
      const v = {}; ['numero', 'titular', 'validade', 'cvv', 'cep', 'num'].forEach((c) => { v[c] = f[c] ? f[c].value : ''; });
      st.plano = 'mensal'; st.parcelas = 1; st.erro = ''; desenhar();
      const g = caixa.querySelector('form');
      Object.entries(v).forEach(([c, x]) => { if (g[c]) g[c].value = x; });
      if (g.cep && v.cep) g.cep.dispatchEvent(new Event('input'));
      g.cvv.focus();
    };
    caixaOferta.querySelector('[data-mensal-pix]').onclick = () => { st.plano = 'mensal'; st.metodo = 'pix'; st.parcelas = 1; st.erro = ''; st.passo = 'plano'; desenhar(); };
  }
  async function tokenizar(card) {
    if (dados.MODO_DEMO) return /^4000/.test(card.number) ? 'token_ruim' : 'token_ok';
    const r = await fetch(`https://api.pagar.me/core/v5/tokens?appId=${encodeURIComponent(PAGARME_PK)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'card', card }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.id) throw new Error('Confira os dados do cartão.');
    return j.id;
  }
  async function pagar(extra) {
    return dados.chamarFuncao('pagarme', {
      acao: 'pagar', plano: st.plano, cpf: so(st.cpf), nome: st.nome, telefone: so(st.telefone),
      email: st.logado ? undefined : st.email, origem: origemAnuncio(), popup: op.popup || null,
      fbp: cookie('_fbp'), fbc: cookie('_fbc'), pagina: location.origin + location.pathname, ...extra,
    });
  }

  // 4. Acesso liberado
  function concluir(r = {}) {
    st.passo = 'acesso'; st.erro = '';
    const id = r.id || (st.pagamento && st.pagamento.id);
    const tipo = r.tipo || (st.pagamento && st.pagamento.tipo);
    // Compra nova = Purchase (renovação não conta como venda nova no Meta)
    if (tipo !== 'renovacao') evento('Purchase', { value: (r.valor || (st.pagamento && st.pagamento.valor) || totalAtual()) / 100, currency: 'BRL', content_name: st.plano, content_ids: [st.plano], content_type: 'product' }, id ? 'compra-' + id : undefined);
    desenhar();
  }
  function desenharAcesso() {
    const ate = st.venceEm ? new Date(st.venceEm).toLocaleDateString('pt-BR') : '';
    const noApp = st.contexto === 'app';
    caixa.innerHTML = `${cabeca(st.contexto === 'venda' ? 2 : 2)}
      <div class="ck-ok">✓</div>
      <h2 class="ck-centro">Pagamento aprovado!</h2>
      <p class="ck-sub ck-centro" style="margin-top:-6px">Seu Plano ${st.plano === 'anual' ? 'Anual' : 'Mensal'} está ativo${ate ? ` até ${esc(ate)}` : ''}.</p>
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
