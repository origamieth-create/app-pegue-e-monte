// =====================================================================
// App Pegue e Monte — app da dona
// Abas: Hoje, Agenda, Kits, Mais
// =====================================================================
import * as dados from './dados.js?v=20261121e';
import { abrirCheckout, planos as planosCheckout } from './checkout.js?v=20261121e';
import { PERMITIR_CADASTRO, EMAIL_SUPORTE, WHATSAPP_SUPORTE, LINK_MENSAL, LINK_ANUAL, LINK_ANUAL_PROMO, DEMO_SITE, LINK_PLANOS, SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=20261121e';

const { hojeISO, somaDias, cruza } = dados;

const estado = {
  negocio: null,
  kits: [],
  reservas: [],
  gastos: [],
  mesFin: null,
  aba: 'hoje',
  mes: hojeISO().slice(0, 7),   // AAAA-MM mostrado na agenda
  dia: hojeISO(),               // dia selecionado na agenda
};

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function reais(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function numero(v) { const n = Number(String(v).replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : 0; }
function paraData(iso) { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); }
function dataCurta(iso) { return paraData(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', ''); }
function maiuscula(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function dataLonga(iso) { return maiuscula(paraData(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })); }
function recadoPadrao(loja) {
  return `🎉 Que bom ter você aqui na ${loja}!\n\nNossos kits são pensados com carinho para deixar a sua festa linda e cheia de alegria. 💖\n\nVeja os kits, escolha a data livre e garanta a sua reserva com antecedência.\n\nVamos celebrar juntos esse momento especial! 🥳`;
}
function soDigitos(v) { return String(v || '').replace(/\D/g, ''); }
// WhatsApp: aceita com ou sem 55/+55/0 na frente e guarda só DDD + número.
function normalizarZap(v) {
  let d = soDigitos(v).replace(/^0+/, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return d;
}
function campoZap(nome, valor) {
  return `<div class="campo-pre"><span>+55</span><input name="${nome}" inputmode="tel" autocomplete="tel" value="${esc(valor ? zapFormatado(valor) : '')}" placeholder="(51) 99999-0000" required></div>
    <span class="dica zap-dica">Só o DDD e o número. O +55 do Brasil já está aqui.</span>`;
}
function ligarCampoZap(input) {
  if (!input) return;
  const dica = input.closest('label').querySelector('.zap-dica');
  input.addEventListener('input', () => {
    const d = normalizarZap(input.value).slice(0, 11);
    input.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
    const ok = d.length === 0 || d.length === 10 || d.length === 11;
    dica.textContent = ok ? 'Só o DDD e o número. O +55 do Brasil já está aqui.' : `Faltam números: digite DDD + número (${d.length} de 11).`;
    dica.classList.toggle('alerta', !ok);
  });
}
function limparInstagram(v) {
  return String(v || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@+/, '').replace(/[/?#].*$/, '').toLowerCase();
}
function zapFormatado(n) {
  const d = soDigitos(n).replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}
function linkZap(n, texto) {
  let d = soDigitos(n);
  if (d.length <= 11) d = '55' + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}
function slugDe(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
// No endereço oficial, o link fica bonito: app.pegueemonte.com/nome-da-loja
const DOMINIO_LINK_BONITO = /(^|\.)pegueemonte\.com$/;
function linkPublico(slug) {
  if (DOMINIO_LINK_BONITO.test(location.hostname)) return `${location.origin}/${encodeURIComponent(slug)}`;
  return new URL(`reservar.html?l=${encodeURIComponent(slug)}`, location.href).href;
}
// Nomes que não podem virar link (já são páginas do app)
const LINKS_RESERVADOS = ['admin', 'reservar', 'index', 'app', 'api', 'manifest', 'icone', 'login', 'suporte', 'ajuda', 'www'];
function kitDe(id) { return estado.kits.find((k) => k.id === id) || { nome: 'Kit removido', pecas: [] }; }
// Modo suporte "só leitura": o administrador vê tudo, mas nada pode ser alterado.
function soLeitura() { return !!(estado.suporte && estado.suporte.somente_leitura); }
function podeEditar() { return estado.suporte ? !soLeitura() : !!(estado.assinatura && estado.assinatura.liberado); }
// Variações do kit (ex.: Básico, Com escadinha, Com cômoda)
function variacoesDe(k) { return Array.isArray(k && k.variacoes) ? k.variacoes : []; }
function nomeKitReserva(r) { const k = kitDe(r.kit_id); return k.nome + (r.tema ? ' · tema ' + r.tema : '') + (r.variacao ? ' – ' + r.variacao : ''); }
function precoKitTexto(k) {
  if (k.preco_consultar) return 'Preço a consultar';
  const v = variacoesDe(k);
  if (!v.length) return reais(k.preco);
  return 'a partir de ' + reais(Math.min(...v.map((x) => Number(x.preco) || 0)));
}
function pecasComVariacao(k, v) { return [...(k.pecas || []), ...((v && v.extras) || []).filter(Boolean)]; }
function linkDoKit(k) {
  const base = linkPublico(estado.negocio.slug);
  return base + (base.includes('?') ? '&' : '?') + 'kit=' + encodeURIComponent(k.id);
}

const STATUS = {
  aguardando_sinal: 'Aguardando sinal',
  confirmada: 'Confirmada',
  retirada: 'Com a cliente',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};
const etiqueta = (status, texto) => `<span class="etiqueta et-${status}">${esc(texto || STATUS[status] || status)}</span>`;

const BANDEIRINHAS = '<svg class="bandeirinhas" viewBox="0 0 480 64" aria-hidden="true"><path d="M4 6 Q120 34 240 10 Q360 -10 476 18" fill="none" stroke="#2A1B3D" stroke-width="3" stroke-linecap="round"/><path d="M28 13 L60 19 L42 52 Z" fill="#E4505C"/><path d="M84 22 L116 25 L98 58 Z" fill="#FFC94A"/><path d="M140 25 L172 23 L156 58 Z" fill="#5B3A99"/><path d="M196 18 L228 13 L214 48 Z" fill="#E4505C"/><path d="M252 9 L284 5 L270 40 Z" fill="#FFC94A"/><path d="M308 3 L340 3 L324 38 Z" fill="#1F7A52"/><path d="M364 4 L396 7 L378 42 Z" fill="#E4505C"/><path d="M420 10 L452 15 L434 48 Z" fill="#FFC94A"/></svg>';

const ICONE = {
  hoje: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  agenda: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>',
  kits: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
  mais: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  fechar: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  mais1: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  zap: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z"/></svg>',
  esq: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  dir: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  logo: '<svg width="72" height="72" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="128" fill="#E4505C"/><path d="M84 150 Q256 236 428 150" fill="none" stroke="#FFFBF7" stroke-width="14" stroke-linecap="round"/><path d="M114 166 L180 182 L142 246 Z" fill="#FFC94A" stroke="#FFC94A" stroke-width="10" stroke-linejoin="round"/><path d="M222 190 L290 190 L256 262 Z" fill="#FFFBF7" stroke="#FFFBF7" stroke-width="10" stroke-linejoin="round"/><path d="M398 166 L332 182 L370 246 Z" fill="#FFC94A" stroke="#FFC94A" stroke-width="10" stroke-linejoin="round"/><path d="M168 336 L230 396 L346 282" fill="none" stroke="#FFFBF7" stroke-width="42" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  marca: '<svg width="30" height="30" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="128" fill="#E4505C"/><path d="M84 150 Q256 236 428 150" fill="none" stroke="#FFFBF7" stroke-width="14" stroke-linecap="round"/><path d="M114 166 L180 182 L142 246 Z" fill="#FFC94A" stroke="#FFC94A" stroke-width="10" stroke-linejoin="round"/><path d="M222 190 L290 190 L256 262 Z" fill="#FFFBF7" stroke="#FFFBF7" stroke-width="10" stroke-linejoin="round"/><path d="M398 166 L332 182 L370 246 Z" fill="#FFC94A" stroke="#FFC94A" stroke-width="10" stroke-linejoin="round"/><path d="M168 336 L230 396 L346 282" fill="none" stroke="#FFFBF7" stroke-width="42" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

let toastTimer = null;
function aviso(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('oculto');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('oculto'), 3200);
}

// Executa uma ação com o botão travado e mostra o erro, se houver.
async function acao(botao, fn) {
  const texto = botao ? botao.innerHTML : '';
  if (botao) { botao.disabled = true; botao.textContent = 'Aguarde…'; }
  try { return await fn(); }
  catch (e) { aviso(e.message || 'Algo deu errado. Tente de novo.'); return undefined; }
  finally { if (botao && botao.isConnected) { botao.disabled = false; botao.innerHTML = texto; } }
}

// ---------------------------------------------------------------------
// Telas internas (detalhe da reserva, formulários, checklist)
// Abrem em tela cheia, com botão "Voltar" no topo. O botão voltar do
// celular também volta para a tela anterior em vez de sair do app.
// ---------------------------------------------------------------------
let painelAberto = false;
let fecharRecorteAberto = null;
let voltarAtual = null;

function abrirPainel(titulo, corpo, aoMontar, voltar) {
  const p = $('#painel');
  if (!painelAberto) { history.pushState({ painel: true }, ''); painelAberto = true; }
  voltarAtual = voltar || null;
  p.innerHTML = `
    <div class="painel-fundo">
      <div class="painel" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
        <div class="painel-barra"><button class="btn-voltar" type="button">${ICONE.esq} Voltar</button></div>
        <h1 class="painel-titulo">${esc(titulo)}</h1>
        ${corpo}
      </div>
    </div>`;
  $('.btn-voltar', p).onclick = voltarPainel;
  $('.painel-fundo', p).scrollTop = 0;
  document.body.style.overflow = 'hidden';
  if (aoMontar) aoMontar($('.painel', p));
}
// Janela por cima da tela (usa o mesmo controle do botão voltar do celular).
// ---------------------------------------------------------------------
// Medição dos popups e ofertas (o que a pessoa viu e fez; nada pessoal)
// ---------------------------------------------------------------------
let popupAtual = null, popupTimer = null, popupFoiCheckout = false;
function rastrear(popup, acao, detalhe) {
  if (estado.suporte || DEMO_SITE) return;
  dados.registrarInteracao(popup, acao, detalhe).catch(() => {});
}
function popupMedido(nome) {
  popupAtual = nome; popupFoiCheckout = false;
  rastrear(nome, 'viu');
  clearTimeout(popupTimer);
  popupTimer = setTimeout(() => { if (popupAtual === nome) rastrear(nome, 'olhou_10s'); }, 10000);
}
function fimDoPopupMedido() {
  if (popupAtual && !popupFoiCheckout) rastrear(popupAtual, 'fechou');
  popupAtual = null; clearTimeout(popupTimer);
}
// Qualquer botão de assinar (checkout da Cakto) conta como "foi ao checkout"
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a) return;
  const h = a.getAttribute('href');
  const detalhe = h === LINK_ANUAL_PROMO ? 'anual_promo' : h === LINK_ANUAL ? 'anual' : h === LINK_MENSAL ? 'mensal' : null;
  if (!detalhe) return;
  const nome = popupAtual || (a.closest('#bloqueio') ? 'fim_teste' : a.closest('#faixa') ? 'faixa' : 'outro');
  popupFoiCheckout = true;
  rastrear(nome, 'checkout', detalhe);
  // Checkout próprio (Pagar.me) ligado: paga aqui dentro, sem sair do app
  if (checkoutProprio() && !DEMO_SITE) {
    e.preventDefault();
    abrirPagamento(detalhe === 'mensal' ? 'mensal' : 'anual', h);
  }
}, true);
function checkoutProprio() { return !!(estado.checkout && estado.checkout.ativo) && !estado.suporte; }
function abrirPagamento(plano, linkReserva) {
  const a = estado.assinatura || {};
  if (document.getElementById('bloqueio')) { document.getElementById('bloqueio').remove(); document.body.style.overflow = ''; }
  fecharPainel();
  abrirCheckout({
    plano, contexto: 'app', linkReserva,
    email: a.email, telefone: (estado.negocio && estado.negocio.whatsapp) || '', temCliente: !!a.cliente_pagarme,
    aoConcluir: () => { recarregar().then(() => aviso('Pagamento confirmado! Obrigada 💛')).catch(() => location.reload()); },
  });
}
// Textos dos planos seguem os preços do checkout próprio quando ele está ligado
function precoAnualCheckout() {
  const c = estado.checkout;
  if (!checkoutProprio() || !c.planos) return null;
  const v = c.planos.anual.valor, p12 = (c.parcelas || [])[11];
  return { valor: v, de: c.planos.anual.de, mes: Math.round(v / 12), p12: p12 ? p12.parcela : null };
}
const reaisC = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function abrirPopup(corpo, aoMontar) {
  const p = $('#painel');
  if (!painelAberto) { history.pushState({ painel: true }, ''); painelAberto = true; }
  voltarAtual = null;
  p.innerHTML = `<div class="popup-fundo"><div class="popup" role="dialog" aria-modal="true">${corpo}</div></div>`;
  document.body.style.overflow = 'hidden';
  $('.popup-fundo', p).onclick = (e) => { if (e.target.classList.contains('popup-fundo')) fecharPainel(); };
  if (aoMontar) aoMontar($('.popup', p));
}

// ---------------------------------------------------------------------
// Novidades: aparece uma vez por atualização, na primeira vez que a
// dona abre o app depois que os arquivos novos forem publicados.
// ---------------------------------------------------------------------
const NOVIDADES = {
  versao: '2026-11-20',
  desde: '2026-11-19T20:00:00Z', // contas criadas depois disso já nascem com tudo
  ia: true, // só aparece para quem já tem a IA liberada
  itens: [
    ['✨', 'Montar catálogo com IA', 'Mande fotos, prints, PDF ou o link do Drive. A IA separa os kits com nome e preço, e você só confere e aprova.'],
  ],
};
// Vídeo tutorial da IA (arquivo na mesma pasta do app). Se o arquivo não existir, o link não aparece.
const IA_VIDEO = 'ia-tutorial.mp4';
let iaVideoExiste = null;
async function temVideoIA() {
  if (iaVideoExiste === null) {
    try { const r = await fetch(IA_VIDEO, { method: 'HEAD', cache: 'no-store' }); iaVideoExiste = r.ok && !/text\/html/.test(r.headers.get('content-type') || ''); }
    catch (e) { iaVideoExiste = false; }
  }
  return iaVideoExiste;
}
function verVideoIA(voltar) {
  abrirPopup(`
    <h2 class="centro" style="font-size:22px;margin:0">Como montar seu catálogo com IA</h2>
    <video class="ia-video" src="${IA_VIDEO}" controls autoplay playsinline preload="auto"></video>
    <button class="btn contorno cheio" id="iav-ok">${voltar ? 'Voltar' : 'Fechar'}</button>`, (p) => {
    $('#iav-ok', p).onclick = () => { const v = $('video', p); if (v) v.pause(); if (voltar) voltar(); else fecharPainel(); };
  });
}
function mostrarNovidades() {
  const chave = 'apm-novidades-vistas';
  let vista = '';
  try { vista = localStorage.getItem(chave) || ''; } catch (e) { /* sem armazenamento: mostra mesmo assim */ }
  if (DEMO_SITE || vista >= NOVIDADES.versao) return;
  if (NOVIDADES.ia && !iaLigada()) return; // a IA ainda não está liberada para esta conta: mostra depois
  // Conta criada depois da atualização já nasce com tudo: não precisa do aviso.
  const criado = estado.negocio && estado.negocio.criado_em;
  // (a atualização foi publicada em 13/11 às 14h; contas criadas depois disso não veem o aviso)
  if (criado && String(criado) >= NOVIDADES.desde) { marcar(); return; }
  function marcar() { try { localStorage.setItem(chave, NOVIDADES.versao); } catch (e) { /* ignora */ } }
  abrirPopup(`
    ${BANDEIRINHAS}
    <h2 class="centro" style="font-size:26px">Novidades no app 🎉</h2>
    <p class="centro pequeno">Acabamos de atualizar o App Pegue e Monte. Veja o que chegou:</p>
    <div class="coluna" style="gap:10px">
      ${NOVIDADES.itens.map(([ic, t, d]) => `
        <div class="novidade"><span class="novidade-ic">${ic}</span><div><b>${esc(t)}</b><p class="pequeno">${esc(d)}</p></div></div>`).join('')}
    </div>
    <button class="btn principal cheio" id="nov-msg">Montar meu catálogo com IA</button>
    <button class="btn contorno cheio oculto" id="nov-video">▶ Ver o vídeo de como funciona</button>
    <button class="btn contorno cheio" id="nov-ok">Entendi</button>`, (p) => {
    marcar();
    $('#nov-ok', p).onclick = () => fecharPainel();
    $('#nov-msg', p).onclick = () => { fecharPainel(); irPara('kits'); setTimeout(iaEnviar, 300); };
    temVideoIA().then((ok) => { const b = $('#nov-video', p); if (ok && b) { b.classList.remove('oculto'); b.onclick = () => verVideoIA(); } });
  });
}

function voltarPainel() {
  if (voltarAtual) { const f = voltarAtual; f(); } else fecharPainel();
}
function fecharPainel(vindoDoCelular) {
  if (!painelAberto) return;
  fimDoPopupMedido();
  painelAberto = false;
  voltarAtual = null;
  $('#painel').innerHTML = '';
  document.body.style.overflow = '';
  if (!vindoDoCelular) history.back();
}
window.addEventListener('popstate', () => {
  // Voltar do celular com o ajuste de foto aberto: fecha só o ajuste.
  if (fecharRecorteAberto) {
    const f = fecharRecorteAberto; f();
    if (painelAberto) history.pushState({ painel: true }, '');
    return;
  }
  if (!painelAberto) return;
  if (voltarAtual) {
    history.pushState({ painel: true }, '');
    const f = voltarAtual; f();
  } else {
    fecharPainel(true);
  }
});

// =====================================================================
// Início
// =====================================================================
// Demonstração do site: os botões de WhatsApp das clientes de exemplo não
// abrem conversa de verdade (os números são fictícios). O suporte continua normal.
function faixaDemo() {
  if (DEMO_SITE) return `<div class="faixa demo faixa-site"><span>Você está na <b>demonstração</b>: mexa à vontade, os dados são de exemplo.</span><a class="btn verde mini" href="${esc(LINK_PLANOS)}" target="_top">Quero usar com meus kits</a></div>`;
  return '<div class="faixa demo">Modo demonstração: os dados são de exemplo e ficam só neste aparelho.</div>';
}
function ligarDemoSite() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href*="wa.me/"]');
    if (!a) return;
    if (WHATSAPP_SUPORTE && a.href.includes(soDigitos(WHATSAPP_SUPORTE))) return;
    e.preventDefault();
    aviso('Na versão real, abre o WhatsApp da cliente com a mensagem pronta 😉');
  }, true);
}

async function iniciar() {
  if (DEMO_SITE) ligarDemoSite();
  if (dados.MODO_DEMO) $('#faixa').innerHTML = faixaDemo();
  // Link "Esqueci minha senha": o Supabase entra logado e apaga o endereço do link logo ao iniciar,
  // então lemos o tipo ANTES e não deixamos a tela inicial cobrir a tela de nova senha.
  const hashLink = location.hash || '';
  let recuperandoSenha = hashLink.includes('type=recovery');
  const linkVencido = /error_code=otp_expired|error=access_denied/.test(hashLink);
  await dados.aoMudarLogin((evento) => {
    if (evento === 'PASSWORD_RECOVERY') { recuperandoSenha = true; telaNovaSenha(); }
  });
  try {
    const sessao = await dados.sessaoAtual();
    if (recuperandoSenha && sessao) return telaNovaSenha();
    if (linkVencido && !sessao) {
      history.replaceState(null, '', location.pathname);
      telaLogin('entrar');
      const caixaErro = $('#erro-login');
      if (caixaErro) { caixaErro.textContent = 'Esse link de senha venceu ou já foi usado. Toque em "Esqueci minha senha" e use o e-mail mais novo.'; caixaErro.classList.remove('oculto'); }
      return;
    }
    if (!sessao && new URLSearchParams(location.search).get('instalar')) {
      // Instalar não depende de login: mostra o convite já na tela de entrar.
      try { history.replaceState(null, '', location.pathname); } catch (e) { /* segue */ }
      telaLogin('entrar');
      setTimeout(convidarInstalacao, 500);
      return;
    }
    if (!sessao) return telaLogin(new URLSearchParams(location.search).has('bemvinda') && PERMITIR_CADASTRO ? 'criar' : 'entrar');
    await carregarTudo();
  } catch (e) {
    $('#raiz').innerHTML = `<main><div class="erro">${esc(e.message)}</div><button class="btn" onclick="location.reload()">Tentar de novo</button></main>`;
  }
}

async function carregarTudo() {
  estado.suporte = await dados.suporteAtual().catch(() => null);
  [estado.negocio, estado.assinatura] = await Promise.all([dados.meuNegocio(), dados.minhaAssinatura()]);
  marcarRelogio();
  dados.registrarUso().catch(() => {}); // só marca a data de uso; nunca atrapalha o app
  const a = estado.assinatura || {};
  // Aba de suporte cuja loja já foi fechada: nunca abre a conta do administrador aqui
  if (dados.lojaSuporteDaAba() && (!estado.suporte || !estado.negocio)) { dados.sairDaLojaNestaAba(); location.href = 'admin.html?aba=clientes'; return; }
  if (estado.suporte && !estado.negocio) { await dados.suporteSair().catch(() => {}); location.href = 'admin.html'; return; }
  if (!estado.suporte && !a.cortesia && !a.encontrada) {
    // Conta nova sem compra: ganha 7 dias de teste grátis (uma vez por e-mail).
    try { await dados.iniciarTeste(); estado.assinatura = await dados.minhaAssinatura(); marcarRelogio(); } catch (e) { /* segue para a tela de assinatura */ }
    if (!estado.assinatura.encontrada) return telaSemAssinatura();
  }
  if (!estado.negocio) return telaConfiguracaoInicial();
  [estado.kits, estado.reservas, estado.gastos, estado.montagem, estado.ia, estado.estruturas, estado.fechados] = await Promise.all([dados.listarKits(), dados.listarReservas(), dados.listarGastos().catch(() => []), estado.suporte ? null : dados.minhaMontagem().catch(() => null), dados.iaSituacao().catch(() => null), dados.listarEstruturas().catch(() => []), dados.listarFechados().catch(() => [])]);
  estado.carregadoEm = Date.now();
  if (!estado.suporte && !DEMO_SITE) planosCheckout().then((c) => { estado.checkout = c; }).catch(() => { estado.checkout = null; });
  montarApp();
}

async function recarregar() {
  const antes = estado.assinatura ? estado.assinatura.liberado : null;
  [estado.kits, estado.reservas, estado.gastos, estado.assinatura, estado.estruturas, estado.fechados] = await Promise.all([
    dados.listarKits(), dados.listarReservas(), dados.listarGastos().catch(() => []), dados.minhaAssinatura(), dados.listarEstruturas().catch(() => []), dados.listarFechados().catch(() => [])]);
  marcarRelogio();
  estado.carregadoEm = Date.now();
  if (antes !== estado.assinatura.liberado) { montarApp(); return; }
  desenharAba();
}

// =====================================================================
// Assinatura: aviso de pagamento com contador e link para regularizar
// =====================================================================
// Diferença entre o relógio do servidor e o do aparelho, para o contador não depender da hora do celular.
let diferencaRelogio = 0;
function marcarRelogio() {
  const a = estado.assinatura;
  if (a && a.agora) diferencaRelogio = new Date(a.agora).getTime() - Date.now();
}
function agoraServidor() { return Date.now() + diferencaRelogio; }
function tempoRestante(ms) {
  const min = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(min / 1440); const h = Math.floor((min % 1440) / 60); const m = min % 60;
  return `${d ? d + 'd ' : ''}${h}h ${String(m).padStart(2, '0')}min`;
}

// Situação para a faixa: null (tudo certo), 'teste', 'teste_fim', 'carencia', 'cancelada' ou 'suspensa'
function situacaoAssinatura() {
  const a = estado.assinatura || {};
  if (a.cortesia || a.status === 'ativa') return null;
  if (a.status === 'teste') return a.liberado ? 'teste' : 'teste_fim';
  if (a.status === 'cancelada') return 'cancelada';
  if (a.liberado && a.carencia_ate) return 'carencia';
  return 'suspensa';
}

function dataHora(iso) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}
function botaoZapSuporte(texto) {
  if (!WHATSAPP_SUPORTE) return '';
  return `<a class="zap-pequeno" href="${esc(linkZap(WHATSAPP_SUPORTE, texto))}" target="_blank" rel="noopener">${ICONE.zap} Problema ou dúvida? Fale no WhatsApp</a>`;
}
const ZAP_PAGAMENTO = 'Oi! Sou cliente do App Pegue e Monte e preciso de ajuda com o pagamento da minha assinatura.';

// Pagamento pendente: Pix pronto (cenário A) ou cobrança enviada por e-mail (cenário B).
// Quem já é assinante NÃO faz compra nova: paga a cobrança que já foi gerada.
function popupPagamento() {
  const a = estado.assinatura || {};
  const temPix = !!(a.pix_codigo && a.pix_vence && new Date(a.pix_vence).getTime() > agoraServidor());
  if (!temPix && a.gateway === 'pagarme') {
    // pagou pela Pagar.me: paga aqui mesmo (Pix na hora ou outro cartão)
    planosCheckout().then((c) => { estado.checkout = c; abrirPagamento(a.plano === 'anual' ? 'anual' : 'mensal', null); })
      .catch(() => aviso('Não consegui abrir o pagamento agora. Tente de novo em instantes.'));
    return;
  }
  const corpo = temPix ? `
    <h2 class="centro" style="font-size:24px">Renove com Pix</h2>
    <p class="centro pequeno">A cobrança da sua assinatura já está pronta. Pague aqui mesmo, sem sair do app:</p>
    <div class="pix-qr" id="pix-qr" aria-label="QR Code do Pix"></div>
    <button class="btn principal cheio" id="pix-copiar">Copiar código Pix</button>
    <p class="centro pequeno"><b>Vale até ${esc(dataHora(a.pix_vence))}</b></p>
    <ol class="passos-pix pequeno">
      <li>Toque em <b>Copiar código Pix</b>.</li>
      <li>Abra o app do seu banco e escolha <b>Pix Copia e Cola</b>.</li>
      <li>Cole o código e confirme. Pronto!</li>
    </ol>
    <button class="btn verde cheio" id="pix-paguei">Já paguei, verificar</button>
    ${botaoZapSuporte(ZAP_PAGAMENTO)}` : `
    <h2 class="centro" style="font-size:24px">Pagamento pendente</h2>
    <p class="centro">Para continuar usando o app, pague a <b>cobrança da sua assinatura</b> que a Cakto enviou para o seu e-mail:</p>
    <p class="centro email-destaque">${esc(a.email || '')}</p>
    <p class="centro pequeno">Não achou? Procure por <b>"Cakto"</b> e confira também a caixa de <b>spam</b> e de <b>promoções</b>.</p>
    <div class="nota-amarela pequeno">Não é preciso fazer uma compra nova: é só pagar a cobrança que já foi enviada.</div>
    <button class="btn verde cheio" id="pix-paguei">Já paguei, verificar</button>
    ${botaoZapSuporte(ZAP_PAGAMENTO)}`;
  abrirPopup(corpo + '<button class="link-btn" id="pix-fechar">Fechar</button>', async (p) => {
    $('#pix-fechar', p).onclick = () => fecharPainel();
    $('#pix-paguei', p).onclick = (e) => acao(e.currentTarget, async () => {
      await recarregar();
      const ok = estado.assinatura.status === 'ativa' || estado.assinatura.cortesia;
      if (ok) fecharPainel();
      aviso(ok ? 'Pagamento confirmado! Obrigada 💛' : 'Ainda não recebemos a confirmação. Pode levar alguns minutos.');
    });
    if (!temPix) return;
    $('#pix-copiar', p).onclick = async () => {
      try { await navigator.clipboard.writeText(a.pix_codigo); aviso('Código Pix copiado! Agora cole no app do banco.'); }
      catch (e) { prompt('Copie o código Pix:', a.pix_codigo); }
    };
    try {
      const { default: qrcode } = await import('./qrcode.mjs?v=20261117c');
      const q = qrcode(0, 'M'); q.addData(a.pix_codigo); q.make();
      $('#pix-qr', p).innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    } catch (e) { $('#pix-qr', p).remove(); }
  });
}

// ---------------------------------------------------------------------
// Conversão do teste grátis
// ---------------------------------------------------------------------
const HORAS_OFERTA_FIM = 48; // anual com desconto fica 48 h depois que o teste acaba
function resumoDoTeste() {
  const res = (estado.reservas || []).filter((r) => r.status !== 'cancelada');
  return {
    kits: (estado.kits || []).length,
    reservas: res.length,
    total: res.reduce((t, r) => t + (Number(r.valor_total) || 0), 0),
    peloLink: res.filter((r) => r.origem === 'link').length,
  };
}
function textoResumoTeste() {
  const x = resumoDoTeste();
  if (!x.kits && !x.reservas) return '';
  const partes = [];
  if (x.kits) partes.push(`${x.kits} ${x.kits === 1 ? 'kit cadastrado' : 'kits cadastrados'}`);
  if (x.reservas) partes.push(`${x.reservas} ${x.reservas === 1 ? 'reserva organizada' : 'reservas organizadas'}`);
  if (x.peloLink) partes.push(`${x.peloLink} pelo seu link`);
  return partes.join(' · ') + (x.total ? ` · ${reais(x.total)} em festas` : '');
}
function fimDaOfertaAnual() {
  const a = estado.assinatura || {};
  return a.teste_ate ? new Date(a.teste_ate).getTime() + HORAS_OFERTA_FIM * 3600e3 : 0;
}
// A promoção do anual libera no 2º dia do teste e vai até 48 h depois que o teste acaba.
function inicioDaPromo() {
  const a = estado.assinatura || {};
  return a.teste_ate ? new Date(a.teste_ate).getTime() - 6 * 864e5 : 0; // teste de 7 dias: começa no 2º dia
}
function promoAnualLiberada() {
  const agora = agoraServidor();
  return !!inicioDaPromo() && agora >= inicioDaPromo() && agora < fimDaOfertaAnual();
}
// Oferta "Montamos sua loja" (só no anual): para quem tinha menos de 3 kits quando a promoção abriu.
function montagemOfertada() {
  if (!estado.negocio || situacaoAssinatura() !== 'teste' && !promoAnualLiberada()) return false;
  const chave = `apm-montagem-ofertada-${estado.negocio.id}`;
  let ja = false;
  try { ja = !!localStorage.getItem(chave); } catch (e) { /* segue */ }
  if (ja) return true;
  if (!promoAnualLiberada() || (estado.kits || []).length >= 3) return false;
  try { localStorage.setItem(chave, '1'); } catch (e) { /* segue */ }
  if (!estado.suporte) dados.registrarOfertaMontagem().catch(() => {});
  return true;
}
function planosHtml() {
  const fim = fimDaOfertaAnual();
  const promo = promoAnualLiberada();
  const montagem = promo && montagemOfertada();
  const anual = promo
    ? `<div class="plano anual"><span class="fita">${agoraServidor() < fim - HORAS_OFERTA_FIM * 3600e3 ? 'PROMOÇÃO DO TESTE GRÁTIS' : 'OFERTA DE FIM DE TESTE'}</span><span class="desc">53% OFF</span>
        <div class="nome">Plano anual</div>
        <div class="de">De R$ 358,80</div>
        <div class="por">R$ 167 <small>por 12 meses</small></div>
        <div class="mes">Sai por R$ 13,92 por mês · ou parcele no cartão</div>
        ${estado.ia && estado.ia.disponivel ? '<div class="ia-plano-item">✨ IA monta seu catálogo: ilimitado</div>' : ''}
        ${montagem ? '<div class="montagem-extra">✓ Nossa equipe cadastra seus kits para você</div>' : ''}
        ${fim - agoraServidor() <= HORAS_OFERTA_FIM * 3600e3 ? `<div class="contagem-oferta">Oferta termina em <b id="oferta-relogio">${tempoRestante(fim - agoraServidor())}</b></div>` : ''}
        <a class="btn verde cheio" style="min-height:52px;font-size:17px" href="${esc(LINK_ANUAL_PROMO)}" target="_blank" rel="noopener">${montagem ? 'Quero o anual com a loja montada' : 'Quero o anual com desconto'}</a>
      </div>`
    : precoAnualCheckout() ? `<div class="plano anual"><span class="desc">${Math.round((1 - precoAnualCheckout().valor / precoAnualCheckout().de) * 100)}% OFF</span><div class="nome">Plano anual</div>
        <div class="de">De ${reaisC(precoAnualCheckout().de)}</div>
        <div class="por">${reaisC(precoAnualCheckout().valor).replace(',00', '')} <small>por 12 meses</small></div>
        <div class="mes">Sai por ${reaisC(precoAnualCheckout().mes)} por mês · ou parcele no cartão</div>
        ${estado.ia && estado.ia.disponivel ? '<div class="ia-plano-item">✨ IA monta seu catálogo: ilimitado</div>' : ''}
        <a class="btn verde cheio" style="min-height:52px;font-size:17px" href="${esc(LINK_ANUAL)}" target="_blank" rel="noopener">Assinar o anual</a>
      </div>`
    : `<div class="plano anual"><div class="nome">Plano anual</div>
        <div class="por">R$ 269 <small>por 12 meses</small></div>
        <div class="mes">ou 12x de R$ 27,79 no cartão</div>
        ${estado.ia && estado.ia.disponivel ? '<div class="ia-plano-item">✨ IA monta seu catálogo: ilimitado</div>' : ''}
        <a class="btn verde cheio" style="min-height:52px;font-size:17px" href="${esc(LINK_ANUAL)}" target="_blank" rel="noopener">Assinar o anual</a>
      </div>`;
  return `<div class="planos">${anual}
      <div class="plano mensal">
        <div class="nome">Plano mensal</div>
        <div class="por">R$ 29,90 <small>por mês</small></div>
        ${estado.ia && estado.ia.disponivel ? '<div class="ia-plano-item">✨ IA monta seu catálogo: ilimitado</div>' : ''}
        ${montagem ? '<div class="montagem-extra">✓ Nossa equipe cadastra seus kits para você</div>' : ''}
        <a class="btn contorno cheio" href="${esc(LINK_MENSAL)}" target="_blank" rel="noopener">Assinar o mensal</a>
      </div>
    </div>`;
}
let relogioOferta = null;
function ligarRelogioOferta(raiz) {
  clearInterval(relogioOferta);
  relogioOferta = setInterval(() => {
    const el = $('#oferta-relogio', raiz);
    if (!el || !document.body.contains(el)) { clearInterval(relogioOferta); return; }
    const falta = fimDaOfertaAnual() - agoraServidor();
    el.textContent = falta > 0 ? tempoRestante(falta) : 'agora';
  }, 1000);
}
function blocoResumoTeste(titulo) {
  const t = textoResumoTeste();
  return t ? `<div class="resumo-teste"><b>${esc(titulo)}</b><span>${esc(t)}</span></div>` : '';
}
// Durante o teste: escolher o plano a qualquer momento.
function popupPlanosTeste(origem = 'assinar_agora') {
  const a = estado.assinatura || {};
  abrirPopup(`
    ${BANDEIRINHAS}
    <h2 class="centro" style="font-size:24px;margin:0">Garanta seu acesso</h2>
    ${blocoResumoTeste('O que você já montou no app')}
    <p class="centro pequeno" style="margin:0">A cobrança começa no dia em que você assina. Tudo o que você cadastrou continua aqui.</p>
    ${planosHtml()}
    <div class="nota-amarela pequeno">Assine com o <b>mesmo e-mail do teste</b> (<b>${esc(a.email || '')}</b>) para não perder nada do que já cadastrou.</div>
    <button class="link-btn" id="planos-fechar">Agora não</button>`, (p) => {
    $('#planos-fechar', p).onclick = () => fecharPainel();
    ligarRelogioOferta(p);
    popupMedido(origem);
  });
}
// 2º dia do teste: mostra a promoção do anual uma vez. Depois ela fica no "Assinar agora".
function mostrarPromoDoTeste() {
  if (situacaoAssinatura() !== 'teste' || !promoAnualLiberada() || painelAberto || !estado.negocio) return;
  const chave = `apm-promo-teste-vista-${estado.negocio.id}`;
  try { if (localStorage.getItem(chave)) return; localStorage.setItem(chave, '1'); } catch (e) { return; }
  const a = estado.assinatura || {};
  if (montagemOfertada()) {
    abrirPopup(`
    ${BANDEIRINHAS}
    <span class="selo-presente">🎁 PRESENTE DO SEU 2º DIA</span>
    <h2 class="centro" style="font-size:25px;margin:0">A gente <span style="color:var(--destaque)">monta sua loja</span> para você</h2>
    <p class="centro pequeno" style="margin:0">Assine hoje (anual ou mensal) e nossa equipe cadastra seus kits com fotos, preços e peças.</p>
    <div class="nota-amarela pequeno centro"><b>1</b> Assine · <b>2</b> Chame a equipe no WhatsApp · <b>3</b> Mande as fotos dos kits</div>
    ${planosHtml()}
    ${WHATSAPP_SUPORTE ? `<a class="btn contorno cheio" href="${esc(linkZap(WHATSAPP_SUPORTE, 'Oi! Quero saber como funciona a montagem da loja pela equipe.'))}" target="_blank" rel="noopener">${ICONE.zap} Tirar dúvidas no WhatsApp</a>` : ''}
    <div class="nota-amarela pequeno">Assine com o <b>mesmo e-mail do teste</b> (<b>${esc(a.email || '')}</b>) para não perder nada do que já cadastrou.</div>
    <button class="link-btn" id="promo-fechar">Agora não</button>`, (p) => {
      $('#promo-fechar', p).onclick = () => fecharPainel();
      ligarRelogioOferta(p);
      popupMedido('promo_montagem');
    });
    return;
  }
  abrirPopup(`
    ${BANDEIRINHAS}
    <h2 class="centro" style="font-size:24px;margin:0">Um presente do seu teste grátis 🎁</h2>
    ${blocoResumoTeste('O que você já montou no app')}
    <p class="centro pequeno" style="margin:0">Liberamos o plano anual com <b>53% de desconto</b> para quem está testando. A cobrança começa no dia em que você assina.</p>
    ${planosHtml()}
    <div class="nota-amarela pequeno">Assine com o <b>mesmo e-mail do teste</b> (<b>${esc(a.email || '')}</b>) para não perder nada do que já cadastrou.</div>
    <p class="centro pequeno" style="margin:0">A oferta fica guardada no botão <b>"Assinar agora"</b>, no topo do app.</p>
    <button class="link-btn" id="promo-fechar">Continuar testando</button>`, (p) => {
    $('#promo-fechar', p).onclick = () => fecharPainel();
    popupMedido('promo_dia2');
  });
}

// Primeira reserva feita pela cliente no link: comemora uma vez.
const COMEMORAR_LINK_DESDE = '2026-11-17T00:00:00Z';
function comemorarReservaPeloLink() {
  if (painelAberto || $('#bloqueio') || !estado.negocio) return;
  const chave = `apm-link-comemorado-${estado.negocio.id}`;
  let ja = '';
  try { ja = localStorage.getItem(chave) || ''; } catch (e) { return; }
  if (ja) return;
  // Só reserva de cliente de verdade: ignora a reserva de teste feita no app e quando a dona testa o próprio link.
  const zapLoja = normalizarZap(estado.negocio.whatsapp);
  const r = (estado.reservas || []).find((x) => x.origem === 'link'
    && String(x.criado_em || '') >= COMEMORAR_LINK_DESDE
    && normalizarZap(x.cliente_whatsapp) !== zapLoja
    && !/teste/i.test(x.cliente_nome || ''));
  if (!r) return;
  try { localStorage.setItem(chave, '1'); } catch (e) { /* segue */ }
  const emTeste = situacaoAssinatura() === 'teste';
  abrirPopup(`
    ${BANDEIRINHAS}
    <div class="centro" style="font-size:44px;line-height:1">🎉</div>
    <h2 class="centro" style="font-size:24px;margin:0">Uma cliente reservou sozinha pelo seu link!</h2>
    <p class="centro" style="margin:0"><b>${esc(r.cliente_nome || 'Uma cliente')}</b> escolheu o kit <b>${esc(nomeKitReserva(r))}</b> para ${esc(dataLonga(r.data_festa))}.</p>
    <p class="centro pequeno" style="margin:0">É isso que o app faz por você todo dia: a cliente escolhe o kit e a data livre, e o pedido chega pronto.</p>
    <button class="btn principal cheio" id="cl-ver">Ver a reserva</button>
    ${emTeste ? '<button class="btn verde cheio" id="cl-planos">Garantir meu acesso</button>' : ''}
    <button class="link-btn" id="cl-ok">Fechar</button>`, (p) => {
    $('#cl-ok', p).onclick = () => fecharPainel();
    $('#cl-ver', p).onclick = () => abrirReserva(r.id);
    const pl = $('#cl-planos', p); if (pl) pl.onclick = () => { rastrear('comemoracao_link', 'clicou'); popupFoiCheckout = true; popupPlanosTeste('comemoracao_link'); };
    popupMedido('comemoracao_link');
  });
}

// Fim do teste grátis: escolhe o plano ou continua só olhando (sem criar nem alterar). Os dados ficam guardados.
function bloqueioFimDoTeste() {
  const a = estado.assinatura || {};
  let caixa = $('#bloqueio');
  if (!caixa) { caixa = document.createElement('div'); caixa.id = 'bloqueio'; document.body.appendChild(caixa); }
  caixa.innerHTML = `<div class="popup-fundo bloqueio"><div class="popup" role="dialog" aria-modal="true">
    ${BANDEIRINHAS}
    <h2 class="centro" style="font-size:24px;margin:0">Seu teste grátis terminou</h2>
    ${blocoResumoTeste('Não perca o que você já montou')}
    <p class="centro pequeno" style="margin:0">Escolha seu plano e continue de onde parou. Seus kits, fotos e reservas estão guardados.</p>
    ${planosHtml()}
    <div class="nota-amarela pequeno">Assine com o <b>mesmo e-mail do teste</b> (<b>${esc(a.email || '')}</b>) para não perder nada do que já cadastrou.</div>
    <button class="btn contorno cheio" id="teste-verificar">Já assinei, verificar</button>
    <button class="btn contorno cheio" id="teste-olhar">Só ver minhas reservas por enquanto</button>
    ${botaoZapSuporte('Oi! Meu teste do App Pegue e Monte terminou e tenho uma dúvida.')}
    <button class="link-btn" id="teste-sair">Sair do app</button>
    ${dados.MODO_DEMO && !DEMO_SITE ? '<button class="btn contorno cheio" id="demo-normal">Demonstração: voltar ao normal</button>' : ''}
  </div></div>`;
  document.body.style.overflow = 'hidden';
  $('#teste-verificar', caixa).onclick = (e) => acao(e.currentTarget, async () => {
    await recarregar();
    if (situacaoAssinatura() !== 'teste_fim') { caixa.remove(); document.body.style.overflow = ''; aviso('Assinatura confirmada! Bem-vinda 💛'); }
    else aviso('Ainda não recebemos a confirmação. Pode levar alguns minutos.');
  });
  const normal = $('#demo-normal', caixa);
  if (normal) normal.onclick = async () => { dados.demoSimular('normal'); caixa.remove(); document.body.style.overflow = ''; await recarregar(); montarApp(); };
  $('#teste-sair', caixa).onclick = async () => { await dados.sair(); caixa.remove(); document.body.style.overflow = ''; telaLogin('entrar'); };
  if (popupAtual !== 'fim_teste') popupMedido('fim_teste');
  $('#teste-olhar', caixa).onclick = () => { fimDoPopupMedido(); clearInterval(relogioOferta); caixa.remove(); document.body.style.overflow = ''; try { sessionStorage.setItem('apm-fim-teste-visto', '1'); } catch (e) { /* segue */ } };
  ligarRelogioOferta(caixa);
}

let relogioFaixa = null;
let popupPagamentoMostrado = false;
function ajustarAlturaFaixa() {
  const f = $('#faixa');
  document.documentElement.style.setProperty('--altura-faixa', (f ? f.offsetHeight : 0) + 'px');
}
// Modo suporte: faixa só para o administrador, com a loja desta aba e "Sair".
function desenharFaixaSuporte(faixa, base) {
  const fim = new Date(estado.suporte.ate).getTime();
  faixa.innerHTML = base + `
    <div class="faixa-suporte" role="status">
      <span class="selo">${soLeitura() ? 'SÓ LEITURA' : 'MODO SUPORTE'}</span>
      <span class="t">Loja: <b>${esc(estado.suporte.nome || estado.negocio.nome)}</b></span>
      <button class="btn mini" id="suporte-sair">Sair</button>
    </div>`;
  $('#suporte-sair', faixa).onclick = async (e) => {
    e.currentTarget.disabled = true;
    await dados.suporteSair().catch(() => {});
    dados.sairDaLojaNestaAba();
    if (window.opener) { try { window.close(); } catch (x) { /* segue */ } }
    location.href = 'admin.html?aba=clientes';
  };
  relogioFaixa = setInterval(() => {
    if (fim - agoraServidor() <= 0) { clearInterval(relogioFaixa); dados.sairDaLojaNestaAba(); location.href = 'admin.html?aba=clientes'; }
  }, 60000);
}

function desenharFaixaAssinatura() {
  clearInterval(relogioFaixa);
  setTimeout(ajustarAlturaFaixa, 0);
  const faixa = $('#faixa');
  const base = dados.MODO_DEMO ? faixaDemo() : '';
  if (estado.suporte) { desenharFaixaSuporte(faixa, base); return; }
  const sit = situacaoAssinatura();
  if (sit !== 'teste_fim' && $('#bloqueio')) { $('#bloqueio').remove(); document.body.style.overflow = ''; }
  const ass = estado.assinatura || {};
  if (!sit && ass.status === 'ativa' && ass.gateway === 'pagarme' && ass.pix_codigo && ass.vence_em) {
    faixa.innerHTML = base + `
      <div class="faixa-pagamento teste" role="status">
        <div>🔔 <b>Sua assinatura renova dia ${esc(new Date(ass.vence_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }))}.</b> O Pix já está pronto: pague e continue usando sem parar.</div>
        <button class="btn mini" id="faixa-renovar">Pagar com Pix</button>
      </div>`;
    $('#faixa-renovar', faixa).onclick = popupPagamento;
    return;
  }
  if (!sit) { faixa.innerHTML = base; return; }
  const a = estado.assinatura;

  if (sit === 'teste') {
    const dias = Math.max(1, Math.ceil((new Date(a.teste_ate).getTime() - agoraServidor()) / 864e5));
    faixa.innerHTML = base + `
      <div class="faixa-pagamento teste" role="status">
        <div>🎁 <b>Seu teste grátis termina ${dias === 1 ? 'amanhã' : `em ${dias} dias`}.</b> ${textoResumoTeste() ? `Você já tem ${esc(textoResumoTeste())}.` : 'Assine com este mesmo e-mail e continue com tudo que cadastrou.'}</div>
        <button class="btn mini" id="faixa-planos">Assinar agora</button>
      </div>`;
    $('#faixa-planos', faixa).onclick = () => popupPlanosTeste('assinar_agora');
    return;
  }
  if (sit === 'teste_fim') {
    faixa.innerHTML = base + `
      <div class="faixa-pagamento" role="alert">
        <div><b>Seu teste grátis terminou.</b> Você ainda vê suas reservas, mas não pode criar nem alterar nada, e seu link de reservas está pausado.</div>
        <button class="btn mini" id="faixa-fim-planos">Ver planos</button>
      </div>`;
    $('#faixa-fim-planos', faixa).onclick = () => bloqueioFimDoTeste();
    let visto = '';
    try { visto = sessionStorage.getItem('apm-fim-teste-visto') || ''; } catch (e) { /* segue */ }
    if (!visto) bloqueioFimDoTeste();
    return;
  }

  if (sit === 'cancelada') {
    const ainda = a.liberado && a.carencia_ate;
    faixa.innerHTML = base + `
      <div class="faixa-pagamento ${ainda ? '' : 'suspensa'}" role="alert">
        <div><b>Sua assinatura foi cancelada.</b> ${ainda
          ? `Seu acesso termina em <b id="contagem">${tempoRestante(new Date(a.carencia_ate).getTime() - agoraServidor())}</b>.`
          : 'Você ainda vê suas reservas, mas não pode criar ou alterar nada, e seu link de reservas está fora do ar.'}
        Assine de novo com o <b>mesmo e-mail</b> (${esc(a.email || '')}) para recuperar seus kits, fotos e reservas.</div>
        <div class="linha-flex" style="flex-wrap:wrap">
          <a class="btn mini" href="${esc(LINK_MENSAL)}" target="_blank" rel="noopener">Assinar de novo</a>
          ${ainda ? '' : '<button class="btn mini contorno-claro" id="ja-paguei">Já assinei</button>'}
        </div>
        ${botaoZapSuporte(ZAP_PAGAMENTO)}
      </div>`;
  } else {
    const temPix = !!(a.pix_codigo && a.pix_vence);
    const emCarencia = sit === 'carencia';
    faixa.innerHTML = base + `
      <div class="faixa-pagamento ${emCarencia ? '' : 'suspensa'}" role="alert">
        <div>${emCarencia
          ? `<b>Pagamento da assinatura pendente.</b> Pague em <b id="contagem">${tempoRestante(new Date(a.carencia_ate).getTime() - agoraServidor())}</b> para não perder o acesso.`
          : '<b>Assinatura suspensa.</b> Você ainda vê suas reservas, mas não pode criar ou alterar nada, e seu link de reservas está fora do ar.'}</div>
        <div class="linha-flex" style="flex-wrap:wrap">
          <button class="btn mini" id="como-pagar">${temPix ? 'Pagar com Pix' : 'Como pagar'}</button>
          ${emCarencia ? '' : '<button class="btn mini contorno-claro" id="ja-paguei">Já paguei</button>'}
        </div>
        ${botaoZapSuporte(ZAP_PAGAMENTO)}
      </div>`;
    $('#como-pagar').onclick = popupPagamento;
    // Abre o aviso de pagamento sozinho uma vez ao entrar.
    if (!popupPagamentoMostrado && !$('#painel').innerHTML) { popupPagamentoMostrado = true; setTimeout(popupPagamento, 300); }
  }

  const jaPaguei = $('#ja-paguei');
  if (jaPaguei) jaPaguei.onclick = (e) => acao(e.currentTarget, async () => {
    await recarregar();
    aviso(estado.assinatura.liberado ? 'Pagamento confirmado!' : 'Ainda não recebemos a confirmação. Pode levar alguns minutos.');
  });
  if ($('#contagem')) {
    relogioFaixa = setInterval(() => {
      const resta = new Date(a.carencia_ate).getTime() - agoraServidor();
      const c = $('#contagem');
      if (c) c.textContent = tempoRestante(resta);
      if (resta <= 0) { clearInterval(relogioFaixa); recarregar().catch(() => {}); }
    }, 30000);
  }
}

function telaSemAssinatura() {
  const email = (estado.assinatura && estado.assinatura.email) || '';
  desenharFaixaAssinatura();
  $('#faixa').innerHTML = dados.MODO_DEMO ? $('#faixa').innerHTML : '';
  $('#raiz').innerHTML = `
    <div class="entrada"><div class="caixa">
      ${BANDEIRINHAS}<div class="logo-app">${ICONE.logo}</div>
      <h1 class="centro">Falta ativar sua assinatura</h1>
      <p class="centro">Não encontramos uma assinatura para <b>${esc(email)}</b>.</p>
      <p class="centro pequeno">Se você já comprou, confira se entrou com o <b>mesmo e-mail usado na compra</b>. A confirmação do pagamento pode levar alguns minutos.</p>
      <button class="btn verde cheio" id="verificar">Já paguei, verificar de novo</button>
      <a class="btn principal cheio" href="${esc(LINK_ANUAL)}" target="_blank" rel="noopener">${precoAnualCheckout() ? `Assinar o anual: ${reaisC(precoAnualCheckout().valor)}` : 'Assinar o anual: R$ 269 ou 12x de R$ 27,79'}</a>
      <a class="btn contorno cheio" href="${esc(LINK_MENSAL)}" target="_blank" rel="noopener">Assinar o mensal: R$ 29,90</a>
      <button type="button" class="link-btn" id="trocar">Entrar com outro e-mail</button>
    </div></div>`;
  $('#verificar').onclick = (e) => acao(e.currentTarget, async () => {
    await carregarTudo();
    const a = estado.assinatura || {};
    if (!a.cortesia && !a.encontrada) aviso('Ainda não recebemos a confirmação. Tente de novo em alguns minutos.');
  });
  $('#trocar').onclick = async () => { await dados.sair(); telaLogin('entrar'); };
}

// Quando a dona volta para o app (troca de aplicativo e volta), busca pedidos novos.
let ouvindoVolta = false;
function atualizarAoVoltar() {
  if (ouvindoVolta) return;
  ouvindoVolta = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !estado.negocio || !$('#tela')) return;
    if (Date.now() - (estado.carregadoEm || 0) < 30000) return;
    if ($('#painel').innerHTML) return; // não atrapalha um formulário aberto
    recarregar().catch(() => {});
  });
}

// Número vermelho no Início = total de alertas da tela
// (atrasadas + aguardando sinal + retiradas de hoje + devoluções de hoje).
function contarAlertas() {
  const h = hojeISO();
  const ativas = estado.reservas.filter((r) => r.status !== 'cancelada');
  return ativas.filter(estaAtrasada).length
    + ativas.filter((r) => r.status === 'aguardando_sinal').length
    + ativas.filter((r) => r.status === 'confirmada' && r.data_retirada === h).length
    + ativas.filter((r) => r.status === 'retirada' && r.data_devolucao === h).length;
}
function atualizarContador() {
  const c = $('#cont-hoje');
  if (!c) return;
  const n = contarAlertas();
  c.textContent = n > 9 ? '9+' : String(n);
  c.classList.toggle('oculto', n === 0);
  const b = c.closest('button');
  if (b) b.setAttribute('aria-label', n ? `Início, ${n} alerta(s)` : 'Início');
}

// =====================================================================
// Entrar, criar conta, recuperar senha
// =====================================================================
// ---------------------------------------------------------------------
// Pixel do Meta: carrega só na tela de criar conta e avisa o cadastro
// (CompleteRegistration + StartTrial) uma única vez por conta.
// ---------------------------------------------------------------------
const PIXEL_META = '1489696249388385';
function carregarPixel() {
  if (dados.MODO_DEMO || window.fbq) return;
  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', PIXEL_META);
  window.fbq('track', 'PageView');
}
function idEvento(nome) {
  const aleatorio = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  return `${nome}-${aleatorio}`;
}
function avisarCadastroPixel(conta) {
  if (dados.MODO_DEMO) return;
  const chave = `apm-pixel-cadastro-${conta}`;
  try { if (localStorage.getItem(chave)) return; } catch (e) { /* segue */ }
  carregarPixel();
  const ids = { cadastro: idEvento('cadastro'), teste: idEvento('teste') };
  window.fbq('track', 'CompleteRegistration', {}, { eventID: ids.cadastro });
  window.fbq('track', 'StartTrial', { value: 0, currency: 'BRL' }, { eventID: ids.teste });
  try { localStorage.setItem(chave, JSON.stringify({ ...ids, em: new Date().toISOString() })); } catch (e) { /* segue */ }
}

// Sugere a correção de e-mails digitados errado (gamil.com, hotmial.com, gmail.com.br…)
const DOMINIOS_EMAIL = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.br', 'yahoo.com', 'icloud.com', 'live.com', 'uol.com.br', 'bol.com.br', 'terra.com.br', 'hotmail.com.br', 'outlook.com.br', 'msn.com'];
function distanciaTexto(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}
function sugerirEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 1) return null;
  const nome = e.slice(0, at); const dom = e.slice(at + 1);
  if (!dom || DOMINIOS_EMAIL.includes(dom)) return null;
  const fixos = { 'gmail.com.br': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.cm': 'gmail.com', 'hotmail': 'hotmail.com', 'hotmail.co': 'hotmail.com', 'outlook': 'outlook.com', 'icloud': 'icloud.com' };
  if (fixos[dom]) return `${nome}@${fixos[dom]}`;
  let melhor = null; let menor = 3;
  for (const d of DOMINIOS_EMAIL) { const dist = distanciaTexto(dom, d); if (dist < menor) { menor = dist; melhor = d; } }
  return melhor && menor <= 2 ? `${nome}@${melhor}` : null;
}
function ligarSugestaoEmail(input) {
  if (!input) return;
  const caixa = document.createElement('div');
  caixa.className = 'sugestao-email oculto';
  (input.closest('label') || input).insertAdjacentElement('afterend', caixa);
  const checar = () => {
    const s = sugerirEmail(input.value);
    caixa.classList.toggle('oculto', !s);
    if (!s) return;
    caixa.textContent = 'Você quis dizer ';
    const b = document.createElement('button'); b.type = 'button'; b.textContent = s;
    b.onclick = () => { input.value = s; caixa.classList.add('oculto'); input.dispatchEvent(new Event('input', { bubbles: true })); };
    caixa.append(b, '?');
  };
  input.addEventListener('blur', checar);
  input.addEventListener('input', () => { if (!caixa.classList.contains('oculto')) checar(); });
}

function telaLogin(modo) {
  if (modo === 'criar') carregarPixel();
  const titulos = { entrar: 'Entrar', criar: 'Criar conta', esqueci: 'Recuperar senha' };
  $('#raiz').innerHTML = `
    <div class="entrada"><form class="caixa" novalidate>
      ${BANDEIRINHAS}<div class="logo-app">${ICONE.logo}</div>
      <h1 class="centro">App Pegue e Monte</h1>
      <p class="centro pequeno">${modo === 'esqueci' ? 'Enviaremos um link para você criar uma nova senha.' : modo === 'criar' ? 'Crie sua conta com seu e-mail e uma senha. Já comprou? Use o <b>mesmo e-mail da compra</b>.' : 'Sua agenda de kits no celular.'}</p>
      <label class="campo">E-mail<input type="email" name="email" autocomplete="email" inputmode="email" required></label>
      ${modo !== 'esqueci' ? `<label class="campo">Senha<input type="password" name="senha" autocomplete="${modo === 'criar' ? 'new-password' : 'current-password'}" minlength="6" required></label>` : ''}
      <div class="erro oculto" id="erro-login"></div>
      <button class="btn principal cheio" type="submit">${titulos[modo]}</button>
      ${modo === 'entrar' ? `<button type="button" class="link-btn" data-modo="esqueci">Esqueci minha senha</button>` : ''}
      ${modo === 'entrar' && PERMITIR_CADASTRO ? `<button type="button" class="link-btn" data-modo="criar">Ainda não tenho conta</button>` : ''}
      ${modo !== 'entrar' ? `<button type="button" class="link-btn" data-modo="entrar">Voltar para entrar</button>` : ''}
      ${modo === 'entrar' && !DEMO_SITE ? `<a class="btn-conheca" href="https://app.pegueemonte.com/Comprar/" target="_blank" rel="noopener">Ainda não é assinante? <b>Conheça o App Pegue e Monte</b></a>` : ''}
      <div class="ajuda-login">
        <span class="pequeno">Precisa de ajuda?</span>
        ${WHATSAPP_SUPORTE ? `<a class="btn verde mini" href="${esc(linkZap(WHATSAPP_SUPORTE, 'Oi! Preciso de ajuda para entrar no App Pegue e Monte.'))}" target="_blank" rel="noopener">${ICONE.zap} WhatsApp</a>` : ''}
      </div>
    </form></div>`;
  $$('[data-modo]').forEach((b) => (b.onclick = () => telaLogin(b.dataset.modo)));
  const form = $('form');
  if (modo === 'criar') ligarSugestaoEmail(form.email);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const senha = form.senha ? form.senha.value : '';
    const caixaErro = $('#erro-login');
    caixaErro.classList.add('oculto');
    caixaErro.classList.remove('sucesso');
    const botao = $('button[type=submit]', form);
    botao.disabled = true;
    try {
      if (!email.includes('@')) throw new Error('Digite um e-mail válido.');
      if (modo === 'esqueci') {
        await dados.esqueciSenha(email);
        caixaErro.innerHTML = '<b>Pronto!</b> Se esse e-mail tiver conta, você vai receber em instantes um link para criar uma nova senha. Não chegou? Confira a caixa de spam ou fale com o suporte aqui embaixo.';
        caixaErro.classList.add('sucesso');
        caixaErro.classList.remove('oculto');
        return;
      }
      if (senha.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      if (modo === 'criar') {
        const r = await dados.criarConta(email, senha);
        avisarCadastroPixel(r.usuario || email.toLowerCase());
        if (r.precisaConfirmar) {
          caixaErro.textContent = 'Conta criada! Abra o e-mail que enviamos e clique no link para confirmar. Depois é só entrar.';
          caixaErro.classList.remove('oculto');
          return;
        }
      } else {
        await dados.entrar(email, senha);
      }
      await carregarTudo();
    } catch (err) {
      caixaErro.textContent = err.message;
      caixaErro.classList.remove('oculto');
    } finally {
      if (botao.isConnected) botao.disabled = false;
    }
  };
}

function telaNovaSenha() {
  fecharPainel();
  $('#raiz').innerHTML = `
    <div class="entrada"><form class="caixa">
      ${BANDEIRINHAS}<div class="logo-app">${ICONE.logo}</div>
      <h1 class="centro">Nova senha</h1>
      <label class="campo">Nova senha<input type="password" name="senha" minlength="6" autocomplete="new-password" required></label>
      <div class="erro oculto" id="erro-senha"></div>
      <button class="btn principal cheio" type="submit">Salvar senha</button>
    </form></div>`;
  const form = $('form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    try {
      if (form.senha.value.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      await dados.trocarSenha(form.senha.value);
      history.replaceState(null, '', location.pathname);
      aviso('Senha alterada!');
      await carregarTudo();
    } catch (err) {
      $('#erro-senha').textContent = err.message;
      $('#erro-senha').classList.remove('oculto');
    }
  };
}

// =====================================================================
// Configuração inicial e dados do negócio
// =====================================================================
function campoInstagram(n) {
  return `<label class="campo">Instagram da loja (opcional)<div class="campo-pre"><span>@</span><input name="instagram" maxlength="60" value="${esc(n.instagram || '')}" placeholder="sualoja" autocapitalize="off" autocomplete="off"></div>
      <span class="dica">Aparece como botão no seu link de reservas.</span></label>`;
}
function camposNegocio(n, inicial) {
  return `
    <label class="campo">Nome do seu negócio<input name="nome" maxlength="80" value="${esc(n.nome || '')}" placeholder="Ex.: Festas da Maria" required></label>
    <label class="campo">Seu link de reservas
      <input name="slug" maxlength="40" value="${esc(n.slug || '')}" placeholder="festas-da-maria" autocapitalize="off" required>
      <span class="dica" id="previa-link">${esc(linkPublico(n.slug || 'seu-link'))}</span>
    </label>
    <label class="campo">Seu WhatsApp${campoZap('whatsapp', n.whatsapp)}</label>
    ${inicial ? campoInstagram(n) : ''}
    <label class="campo">Chave Pix para o sinal<input name="chave_pix" maxlength="120" value="${esc(n.chave_pix || '')}" placeholder="E-mail, CPF, CNPJ, celular ou chave aleatória"></label>
    ${inicial ? '' : `
    <div class="grade-2">
      <label class="campo">Retirada (dias antes da festa)<input name="dias_antes" type="number" inputmode="numeric" min="0" max="7" value="${n.dias_antes ?? 1}"></label>
      <label class="campo">Devolução (dias depois)<input name="dias_depois" type="number" inputmode="numeric" min="0" max="7" value="${n.dias_depois ?? 1}"></label>
    </div>
    <p class="dica">Esses dias definem quanto tempo o kit fica bloqueado quando a cliente reserva pelo link.</p>`}`;
}

function lerCamposNegocio(form, inicial) {
  const c = {
    nome: form.nome.value.trim(),
    slug: slugDe(form.slug.value),
    whatsapp: normalizarZap(form.whatsapp.value),
    chave_pix: form.chave_pix.value.trim() || null,
    instagram: limparInstagram(form.instagram.value) || null,
  };
  if (c.instagram && !/^[a-z0-9._]{1,30}$/.test(c.instagram)) throw new Error('Confira o @ do Instagram: só letras, números, ponto e _.');
  if (!inicial) {
    c.dias_antes = Math.min(7, Math.max(0, parseInt(form.dias_antes.value, 10) || 0));
    c.dias_depois = Math.min(7, Math.max(0, parseInt(form.dias_depois.value, 10) || 0));
  }
  if (c.nome.length < 2) throw new Error('Digite o nome do seu negócio.');
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(c.slug)) throw new Error('O link precisa ter de 3 a 40 letras ou números, sem espaços.');
  if (LINKS_RESERVADOS.includes(c.slug)) throw new Error('Esse link é reservado pelo app. Escolha outro, como o nome da sua loja.');
  if (c.whatsapp.length < 10 || c.whatsapp.length > 11) throw new Error('Confira o WhatsApp: digite o DDD e o número, por exemplo (51) 99999-0000.');
  return c;
}

function ligarPreviaLink(form) {
  let mexeuNoLink = !!form.slug.value;
  form.slug.addEventListener('input', () => { mexeuNoLink = true; $('#previa-link', form).textContent = linkPublico(slugDe(form.slug.value) || 'seu-link'); });
  form.nome.addEventListener('input', () => {
    if (mexeuNoLink) return;
    form.slug.value = slugDe(form.nome.value);
    $('#previa-link', form).textContent = linkPublico(form.slug.value || 'seu-link');
  });
}

function telaConfiguracaoInicial() {
  $('#raiz').innerHTML = `
    <div class="entrada"><form class="caixa" novalidate>
      ${BANDEIRINHAS}<div class="logo-app">${ICONE.logo}</div>
      <h1 class="centro">Vamos começar</h1>
      <p class="centro pequeno">Quatro informações e seu app está pronto.</p>
      ${camposNegocio({ whatsapp: soDigitos(guardado('apm-teste-whatsapp') || '') || null }, true)}
      <div class="erro oculto" id="erro-cfg"></div>
      <button class="btn principal cheio" type="submit">Pronto, abrir meu app</button>
      <button type="button" class="link-btn" id="sair">Sair</button>
    </form></div>`;
  const form = $('form');
  ligarPreviaLink(form); ligarCampoZap(form.whatsapp); if (form.instagram) form.instagram.addEventListener("input", () => { form.instagram.value = form.instagram.value.replace(/^@+/, "").replace(/\s/g, ""); });
  $('#sair').onclick = async () => { await dados.sair(); telaLogin('entrar'); };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const caixa = $('#erro-cfg');
    caixa.classList.add('oculto');
    await acao($('button[type=submit]', form), async () => {
      try {
        const c = lerCamposNegocio(form, true);
        if (!(await dados.linkDisponivel(c.slug))) throw new Error('Esse link já está em uso. Escolha outro.');
        await dados.salvarNegocio(c);
        estado.mostrarAssistente = true; // conta nova: perguntas da agenda logo de cara
        await carregarTudo();
      } catch (err) { caixa.textContent = err.message; caixa.classList.remove('oculto'); }
    });
  };
}

function painelNegocio() {
  const n = estado.negocio;
  let logo = n.logo_url || null;
  const chRasc = chaveRascunho('loja');
  abrirPainel('Meus dados', `<form class="coluna" novalidate>
      ${faixaRascunho(chRasc)}
      <section class="cartao coluna">
        <div><h3>Seu perfil no link de reservas</h3><span class="dica">É assim que as suas clientes veem o topo do seu link.</span></div>
        <div class="linha-flex" style="gap:14px">
          <div id="logo-area" class="logo-prev"></div>
          <div class="coluna" style="gap:6px; flex:1">
            <label class="btn contorno mini" style="cursor:pointer">Escolher logo<input type="file" accept="image/*" name="logo" class="oculto"></label>
            <button type="button" class="link-btn oculto" id="tirar-logo" style="min-height:32px; padding:0">Tirar logo</button>
          </div>
        </div>
        <label class="campo">Recado para as clientes (opcional)
          <textarea name="recado_link" maxlength="300" rows="3" placeholder="${esc(recadoPadrao(n.nome || 'sua loja'))}">${esc(n.recado_link || '')}</textarea>
          <span class="dica" id="recado-conta"></span>
          <span class="dica">Se deixar em branco, o seu link mostra o recado de exemplo acima.</span>
        </label>
        ${campoInstagram(n)}
      </section>
      <h3 style="margin:6px 0 0">Dados da loja</h3>
      ${camposNegocio(n, false)}
      <div class="erro oculto" id="erro-neg"></div>
      <button class="btn principal cheio" type="submit">Salvar</button></form>`, (p) => {
    const form = $('form', p);
    ligarPreviaLink(form); ligarCampoZap(form.whatsapp); if (form.instagram) form.instagram.addEventListener("input", () => { form.instagram.value = form.instagram.value.replace(/^@+/, "").replace(/\s/g, ""); });
    const area = $('#logo-area', p);
    const tirar = $('#tirar-logo', p);
    const desenharLogo = (txt) => {
      area.innerHTML = logo ? `<img src="${esc(logo)}" alt="Sua logo">` : `<span>${txt || 'Sem logo'}</span>`;
      tirar.classList.toggle('oculto', !logo);
    };
    desenharLogo();
    tirar.onclick = () => { logo = null; desenharLogo(); };
    form.logo.onchange = async () => {
      const arq = form.logo.files[0];
      form.logo.value = '';
      if (!arq) return;
      desenharLogo('Enviando…');
      const ajustada = await recortarFoto(arq, '', { logo: true });
      if (!ajustada) { desenharLogo(); return; }
      try { logo = await dados.enviarFoto(ajustada, 500); } catch (e) { aviso(e.message); }
      desenharLogo();
    };
    const conta = () => { $('#recado-conta', p).textContent = `${form.recado_link.value.length}/300 caracteres`; };
    form.recado_link.oninput = conta; conta();
    // Rascunho dos dados da loja (campos com nome)
    const camposForm = () => [...form.elements].filter((el) => el.name && el.type !== 'file' && el.type !== 'submit');
    ligarFaixaRascunho(p, chRasc, (r) => {
      camposForm().forEach((el) => { if (r[el.name] == null) return; if (el.type === 'checkbox') el.checked = !!r[el.name]; else el.value = r[el.name]; });
      if (r.__logo !== undefined) { logo = r.__logo; desenharLogo(); }
      conta(); const f = $('#rasc-faixa', p); if (f) f.remove();
    });
    let tRasc = 0;
    const guardar = () => { clearTimeout(tRasc); tRasc = setTimeout(() => {
      const d = { __logo: logo }; camposForm().forEach((el) => { d[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
      gravarRascunho(chRasc, d);
    }, 500); };
    form.addEventListener('input', guardar); form.addEventListener('change', guardar);
    form.onsubmit = async (e) => {
      e.preventDefault();
      await acao($('button[type=submit]', form), async () => {
        try {
          const c = lerCamposNegocio(form, false);
          if (c.slug !== estado.negocio.slug && !(await dados.linkDisponivel(c.slug))) throw new Error('Esse link já está em uso. Escolha outro.');
          c.logo_url = logo;
          c.recado_link = form.recado_link.value.trim().slice(0, 300) || null;
          estado.negocio = await dados.salvarNegocio(c);
          apagarRascunho(chRasc);
          fecharPainel(); aviso('Dados salvos!'); montarApp();
        } catch (err) { $('#erro-neg', p).textContent = err.message; $('#erro-neg', p).classList.remove('oculto'); }
      });
    };
  });
}

// =====================================================================
// Estrutura do app e abas
// =====================================================================
function montarApp() {
  desenharFaixaAssinatura();
  $('#raiz').innerHTML = `
    <header class="topo">
      <span class="marca">${ICONE.marca}<span class="marca-nome">${esc(estado.negocio.nome)}</span></span>
      ${podeEditar() ? `<button class="btn principal mini" id="nova-res">${ICONE.mais1} Reserva</button>` : ''}
    </header>
    <main id="tela"></main>
    <nav class="abas" aria-label="Menu principal">
      ${['hoje', 'agenda', 'kits', 'mais'].map((a) => `
        <button data-aba="${a}" aria-label="${{ hoje: 'Início', agenda: 'Agenda', kits: 'Kits', mais: 'Mais' }[a]}">${ICONE[a]}<span>${{ hoje: 'Início', agenda: 'Agenda', kits: 'Kits', mais: 'Mais' }[a]}</span>${a === 'hoje' ? '<span class="contador oculto" id="cont-hoje" aria-hidden="true"></span>' : ''}</button>`).join('')}
    </nav>`;
  $$('nav.abas button').forEach((b) => (b.onclick = () => irPara(b.dataset.aba)));
  const nova = $('#nova-res');
  if (nova) nova.onclick = () => formReserva({});
  atualizarAoVoltar();
  const deHash = location.hash.replace('#', '');
  irPara(['hoje', 'agenda', 'kits', 'mais'].includes(deHash) ? deHash : 'hoje');
  if (abrirPeloAviso()) return;
  if (estado.suporte) return; // no modo suporte não aparece nenhum aviso da dona
  if (estado.mostrarAssistente) { estado.mostrarAssistente = false; setTimeout(() => assistenteAgenda(), 400); return; }
  setTimeout(mostrarNovidades, 600);
  setTimeout(mostrarBlackFriday, 1200);
  setTimeout(comemorarReservaPeloLink, 1800);
  setTimeout(mostrarPromoDoTeste, 2400);
  setTimeout(mostrarMensagensAdmin, 3200);
}

// Quando a dona toca numa notificação: abre a reserva ou os planos.
function abrirPeloAviso() {
  const q = new URLSearchParams(location.search);
  const reserva = q.get('reserva');
  const planos = q.get('planos');
  if (q.get('instalar')) { try { history.replaceState(null, '', location.pathname); } catch (e) { /* segue */ } setTimeout(convidarInstalacao, 500); return true; }
  if (q.get('video')) { try { history.replaceState(null, '', location.pathname); } catch (e) { /* segue */ } setTimeout(abrirVideoTutorial, 400); return true; }
  if (q.get('link')) { try { history.replaceState(null, '', location.pathname); } catch (e) { /* segue */ } irPara('kits'); return true; }
  if (q.get('ia')) { try { history.replaceState(null, '', location.pathname); } catch (e) { /* segue */ } irPara('kits'); setTimeout(iaAbrirPendente, 400); return true; }
  if (!reserva && !planos) return false;
  try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* segue */ }
  if (reserva && (estado.reservas || []).some((r) => r.id === reserva)) { setTimeout(() => abrirReserva(reserva), 300); return true; }
  if (planos && situacaoAssinatura() === 'teste') { setTimeout(() => popupPlanosTeste('aviso_promo'), 300); return true; }
  return false;
}

// ---------------------------------------------------------------------
// Black Friday: anual por R$ 167 só para quem assina o mensal pagando
// com Pix comum (o banco decide quem pode ver: oferta_bf), até 29/11.
// ---------------------------------------------------------------------
function temOfertaBF() {
  const a = estado.assinatura || {};
  return !DEMO_SITE && !!a.oferta_bf && !!a.oferta_bf_ate && agoraServidor() < new Date(a.oferta_bf_ate).getTime();
}
function faltaBF() {
  const ms = Math.max(0, new Date(estado.assinatura.oferta_bf_ate).getTime() - agoraServidor());
  return { d: Math.floor(ms / 864e5), h: Math.floor((ms % 864e5) / 36e5), m: Math.floor((ms % 36e5) / 6e4) };
}
function popupBlackFriday() {
  const a = estado.assinatura || {};
  const f = faltaBF();
  const dois = (n) => String(n).padStart(2, '0');
  abrirPopup(`
    <div class="bf-pop coluna" style="gap:14px">
      <span class="bf-tag">BLACK FRIDAY</span>
      <h2 class="centro" style="font-size:25px;margin:0">Troque o mensal pelo anual com 53% OFF</h2>
      <div class="bf-preco"><span class="de">De R$ 358,80 por ano no mensal</span><span class="por">R$ 167 <small>por 12 meses</small></span><span class="mes">Sai por R$ 13,92 por mês</span></div>
      <div class="relogio" aria-label="Tempo até o fim da oferta"><div><b>${dois(f.d)}</b><span>DIAS</span></div><div><b>${dois(f.h)}</b><span>HORAS</span></div><div><b>${dois(f.m)}</b><span>MIN</span></div></div>
      <a class="btn verde cheio" style="min-height:54px;font-size:17px" href="${esc(LINK_ANUAL_PROMO)}" target="_blank" rel="noopener">Quero o anual por R$ 167</a>
      <div class="bf-nota">Use o <b>mesmo e-mail do app</b> (${esc(a.email || '')}). Seus kits, fotos e reservas continuam iguais, e o mensal no Pix não é mais cobrado: é só não pagar o próximo Pix. Oferta só para quem assina o mensal, até <b>29/11</b>.</div>
      <button class="link-btn" id="bf-fechar" style="color:#bcb3c7">Agora não</button>
    </div>`, (p) => {
    p.classList.add('bf-fundo');
    $('#bf-fechar', p).onclick = () => fecharPainel();
    popupMedido('black_friday');
  });
}
function mostrarBlackFriday() {
  if (!temOfertaBF() || painelAberto || $('#bloqueio')) return;
  const hoje = hojeISO();
  let visto = '';
  try { visto = localStorage.getItem('apm-bf-visto') || ''; } catch (e) { /* segue */ }
  if (visto === hoje) return;
  try { localStorage.setItem('apm-bf-visto', hoje); } catch (e) { /* segue */ }
  popupBlackFriday();
}

// ---------------------------------------------------------------------
// Instalar o app na tela inicial
// ---------------------------------------------------------------------
let pedidoInstalacao = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedidoInstalacao = e; });
window.addEventListener('appinstalled', () => { pedidoInstalacao = null; aviso('App instalado! Agora é só abrir pelo ícone 🎉'); });
function appInstalado() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
}
function ehIphone() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
// Aberto no computador (mouse, sem toque, sem ser celular/tablet): não oferece instalar nem avisos no celular.
function ehComputador() {
  if (/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)) return false;
  if (navigator.maxTouchPoints > 1) return false; // iPad novo se apresenta como Mac
  return !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
}
// Link "Instalar o app" do e-mail de boas-vindas: o navegador só deixa instalar com um toque dentro do app.
function convidarInstalacao() {
  if (appInstalado()) { aviso('O app já está instalado neste celular 🎉'); return; }
  abrirPopup(`
    <div style="font-size:48px;text-align:center" aria-hidden="true">📲</div>
    <h2 class="centro" style="font-size:23px;margin:0">Coloque o app na sua tela inicial</h2>
    <p class="centro pequeno" style="margin:0">Fica com um ícone igual a um aplicativo: é só tocar para abrir sua agenda de kits.</p>
    <button class="btn principal cheio" id="conv-instalar">Instalar agora</button>
    <button class="link-btn" id="conv-depois">Agora não</button>`, (p) => {
    $('#conv-depois', p).onclick = () => fecharPainel();
    $('#conv-instalar', p).onclick = () => { fecharPainel(); setTimeout(instalarApp, 200); };
  });
}
async function instalarApp() {
  if (pedidoInstalacao) {
    pedidoInstalacao.prompt();
    const { outcome } = await pedidoInstalacao.userChoice.catch(() => ({}));
    pedidoInstalacao = null;
    if (outcome === 'accepted') aviso('Instalando… o ícone aparece na sua tela inicial.');
    return;
  }
  const iphone = ehIphone();
  const foraDoSafari = iphone && /CriOS|FxiOS|EdgiOS|Instagram|FBAN|FBAV|Line\/|GSA|Gmail/i.test(navigator.userAgent);
  const passo = (n, t) => `<div class="passo-inst"><b>${n}</b><span>${t}</span></div>`;
  abrirPopup(`
    <h2 class="centro" style="font-size:23px;margin:0">${iphone ? 'Instalar no iPhone' : 'Instalar no celular'}</h2>
    ${foraDoSafari ? '<div class="nota-amarela pequeno">Primeiro abra este app no <b>Safari</b> (no iPhone, só o Safari instala). Copie o endereço e cole no Safari.</div>' : ''}
    ${!iphone ? '<div class="nota-amarela pequeno">Se o app abriu dentro do Gmail ou do Instagram, toque nos <b>3 pontinhos ⋮</b> e em <b>"Abrir no Chrome"</b> antes.</div>' : ''}
    ${iphone
      ? passo(1, 'Toque em <b>Compartilhar</b> <span class="ic-compart">⇧</span> na barra do Safari') + passo(2, 'Role e toque em <b>"Adicionar à Tela de Início"</b> ➕') + passo(3, 'Toque em <b>Adicionar</b>. Pronto, o ícone aparece na sua tela 🎉')
      : passo(1, 'Toque nos <b>3 pontinhos ⋮</b> no canto do navegador') + passo(2, 'Toque em <b>"Instalar app"</b> ou <b>"Adicionar à tela inicial"</b>') + passo(3, 'Confirme. Pronto, o ícone aparece na sua tela 🎉')}
    <button class="btn principal cheio" id="inst-ok">Entendi</button>`, (p) => { $('#inst-ok', p).onclick = () => fecharPainel(); });
}

// ---------------------------------------------------------------------
// Contrato: modelo da dona (Mais > Meu contrato) e contrato de cada reserva
// ---------------------------------------------------------------------
const CONTRATO_PADRAO = `CONTRATO DE LOCAÇÃO DE KIT DE FESTA

Locadora: {loja}
Locatária: {nome} · CPF {cpf}
Endereço: {endereco}

Kit: {kit}
Data da festa: {festa}
Retirada: {retirada} · Devolução: {devolucao}
Valor total: {total} · Sinal: {sinal} · Restante: {restante}

Peças entregues:
{pecas}

1. A locatária se responsabiliza pelas peças até a devolução. Peças danificadas ou não devolvidas serão cobradas pelo valor de reposição.
2. Atraso na devolução: R$ 30,00 por dia.
3. O sinal garante a data e não é devolvido em caso de desistência.`;
const MARCADORES_CONTRATO = [
  ['{nome}', 'nome completo da cliente'], ['{cpf}', 'CPF (a cliente preenche no aceite)'], ['{endereco}', 'endereço (a cliente preenche no aceite)'],
  ['{kit}', 'nome do kit'], ['{pecas}', 'lista de peças'], ['{festa}', 'data da festa'], ['{retirada}', 'data da retirada'],
  ['{devolucao}', 'data da devolução'], ['{total}', 'valor total'], ['{sinal}', 'valor do sinal'], ['{restante}', 'valor que falta'], ['{loja}', 'nome do seu negócio'],
];
function dataContrato(iso) { return paraData(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }).replace('.', ''); }
// Preenche o modelo com os dados da reserva. CPF e endereço ficam para o aceite.
function preencherContrato(modelo, r, pedeCpf) {
  const k = kitDe(r.kit_id) || {};
  const pecas = (r.pecas && r.pecas.length ? r.pecas : (k.pecas || [])).map((x) => `• ${x}`).join('\n') || '• (sem lista de peças)';
  const restante = Math.max(0, Number(r.valor_total) - Number(r.valor_sinal));
  let t = String(modelo || CONTRATO_PADRAO);
  if (!pedeCpf) {
    t = t.replace(/\s*·?\s*CPF:?\s*\{cpf\}/gi, '').split('\n').filter((l) => !/\{cpf\}|\{endereco\}/.test(l)).join('\n');
  }
  const valores = {
    '{nome}': r.cliente_nome, '{kit}': nomeKitReserva(r), '{pecas}': pecas, '{festa}': dataContrato(r.data_festa),
    '{retirada}': dataContrato(r.data_retirada), '{devolucao}': dataContrato(r.data_devolucao), '{total}': reais(r.valor_total),
    '{sinal}': reais(r.valor_sinal), '{restante}': reais(restante), '{loja}': estado.negocio.nome,
  };
  return t.replace(/\{(nome|kit|pecas|festa|retirada|devolucao|total|sinal|restante|loja)\}/g, (m) => valores[m] ?? m);
}
function linkContrato(token) { return new URL('contrato.html?c=' + encodeURIComponent(token), location.href).href.split('#')[0]; }

function painelContrato() {
  const n = estado.negocio;
  const pede = n.contrato_pede_cpf !== false;
  abrirPainel('Meu contrato', `
    <p class="pequeno">Escreva seu contrato uma vez. Em cada reserva, o app troca os marcadores pelos dados da cliente.</p>
    <form class="coluna" novalidate>
      <label class="campo">Texto do contrato<textarea name="modelo" maxlength="8000" rows="18" style="min-height:360px;font-size:14px;line-height:1.45">${esc(String(n.contrato_modelo || '').trim() || CONTRATO_PADRAO)}</textarea></label>
      <div class="pequeno"><b>Toque para inserir:</b></div>
      <div class="marcadores">${MARCADORES_CONTRATO.map(([m, d]) => `<button type="button" class="marcador" data-m="${m}" title="${esc(d)}">${m}</button>`).join('')}</div>
      <label class="check ${pede ? 'marcado' : ''}"><input type="checkbox" name="pede" ${pede ? 'checked' : ''}> Pedir CPF e endereço da cliente no aceite</label>
      <div class="erro oculto" id="erro-ct"></div>
      <button class="btn principal cheio" type="submit">Salvar contrato</button>
      <button class="link-btn" type="button" id="ct-padrao">Voltar ao modelo padrão</button>
    </form>`, (p) => {
    const form = $('form', p);
    const ta = form.modelo;
    form.pede.onchange = () => form.pede.closest('.check').classList.toggle('marcado', form.pede.checked);
    $$('[data-m]', p).forEach((b) => (b.onclick = () => {
      const ini = ta.selectionStart ?? ta.value.length; const fim = ta.selectionEnd ?? ini;
      ta.value = ta.value.slice(0, ini) + b.dataset.m + ta.value.slice(fim);
      ta.focus(); ta.selectionStart = ta.selectionEnd = ini + b.dataset.m.length;
    }));
    $('#ct-padrao', p).onclick = () => { ta.value = CONTRATO_PADRAO; };
    form.onsubmit = (e) => {
      e.preventDefault();
      acao(form.querySelector('button[type=submit]'), async () => {
        const texto = ta.value.trim();
        if (texto.length < 30) { const c = $('#erro-ct', p); c.textContent = 'O contrato ficou muito curto.'; c.classList.remove('oculto'); return; }
        estado.negocio = await dados.salvarNegocio({ contrato_modelo: texto === CONTRATO_PADRAO ? null : texto, contrato_pede_cpf: form.pede.checked });
        aviso('Contrato salvo!');
        fecharPainel();
      });
    };
  });
}

// Cartão "Contrato" dentro da reserva
async function desenharCartaoContrato(caixa, r) {
  if (!caixa) return;
  const ed = podeEditar();
  let c = null;
  try { c = await dados.contratoDaReserva(r.id); } catch (e) { caixa.innerHTML = '<div class="pequeno">Não consegui carregar o contrato.</div>'; return; }
  const situacao = c && c.aceito_em ? '<span class="st ok">Aceito ✓</span>' : c ? '<span class="st esp">Aguardando aceite</span>' : '<span class="st esp">Não enviado</span>';
  const primeiro = r.cliente_nome.split(' ')[0];
  const msg = c ? `Oi, ${primeiro}! Segue o contrato da sua reserva do ${kitComPalavra(nomeKitReserva(r))}. É só abrir, conferir e tocar em "Aceitar contrato": ${linkContrato(c.token)}` : '';
  caixa.innerHTML = `
    <div class="linha-flex entre"><h3 style="margin:0">📄 Contrato</h3>${situacao}</div>
    ${c && c.aceito_em
      ? `<div class="pequeno">Aceito por <b>${esc(c.aceito_nome || '')}</b> em ${esc(new Date(c.aceito_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}</div>
         <div class="linha-flex" style="gap:8px;flex-wrap:wrap"><a class="btn contorno mini" href="${esc(linkContrato(c.token))}" target="_blank" rel="noopener">Ver contrato</a><a class="btn contorno mini" href="${esc(linkContrato(c.token))}&pdf=1" target="_blank" rel="noopener">⬇️ PDF</a></div>`
      : c
        ? `<div class="pequeno">Mande o link para a cliente aceitar pelo celular.</div>
           <div class="linha-flex" style="gap:8px;flex-wrap:wrap">
             <a class="btn verde mini" href="${esc(linkZap(r.cliente_whatsapp, msg))}" target="_blank" rel="noopener">${ICONE.zap} Enviar para aceite</a>
             <a class="btn contorno mini" href="${esc(linkContrato(c.token))}" target="_blank" rel="noopener">Ver contrato</a>
             ${ed ? '<button class="btn contorno mini" id="ct-refazer">Atualizar dados</button>' : ''}
           </div>`
        : `<div class="pequeno">Gere o contrato com os dados desta reserva e mande o link para a cliente aceitar pelo celular.</div>
           ${ed ? '<button class="btn principal mini" id="ct-gerar" style="align-self:flex-start">Gerar contrato</button>' : ''}`}`;
  const gerar = async (b) => acao(b, async () => {
    const pede = estado.negocio.contrato_pede_cpf !== false;
    await dados.gerarContrato(r, preencherContrato(estado.negocio.contrato_modelo, r, pede), pede);
    aviso(c ? 'Contrato atualizado com os dados da reserva.' : 'Contrato pronto! Agora é só enviar para a cliente.');
    desenharCartaoContrato(caixa, r);
  });
  const g = $('#ct-gerar', caixa); if (g) g.onclick = () => gerar(g);
  const rf = $('#ct-refazer', caixa); if (rf) rf.onclick = () => gerar(rf);
}

function irPara(aba) {
  estado.aba = aba;
  if (location.hash !== '#' + aba) history.replaceState(null, '', '#' + aba);
  $$('nav.abas button').forEach((b) => {
    b.classList.toggle('ativa', b.dataset.aba === aba);
    if (b.dataset.aba === aba) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  desenharAba();
  window.scrollTo(0, 0);
}

function desenharAba() {
  const tela = $('#tela');
  if (!tela) return;
  atualizarContador();
  ({ hoje: abaHoje, agenda: abaAgenda, kits: abaKits, mais: abaMais }[estado.aba])(tela);
}

// Reserva atrasada: devolução passou e o kit não voltou, ou a retirada passou e o kit não saiu.
function estaAtrasada(r) {
  const h = hojeISO();
  return (r.status === 'retirada' && r.data_devolucao < h) || (r.status === 'confirmada' && r.data_retirada < h);
}

// Um item de reserva clicável, colorido pela situação
function itemReserva(r, extra) {
  const k = kitDe(r.kit_id);
  const atrasada = estaAtrasada(r);
  return `
    <button class="cartao clicavel res-${atrasada ? 'atrasada' : r.status}" data-res="${esc(r.id)}">
      <div class="item-res">
        <div class="info">
          <div class="nome">${esc(nomeKitReserva(r))} · ${esc(r.cliente_nome)}</div>
          <div class="pequeno">${extra || 'Festa ' + dataCurta(r.data_festa)}</div>
        </div>
        ${atrasada ? etiqueta('atrasada', 'Atrasada') : etiqueta(r.status)}
      </div>
    </button>`;
}
function ligarItens(el) { $$('[data-res]', el).forEach((b) => (b.onclick = () => abrirReserva(b.dataset.res))); }

// ---------------------------------------------------------------------
// INÍCIO: financeiro do mês + alertas
// ---------------------------------------------------------------------
function resumoDoMes(mes) {
  const rs = estado.reservas.filter((r) => r.status !== 'cancelada' && r.data_festa.startsWith(mes));
  let recebido = 0;
  let aReceber = 0;
  rs.forEach((r) => {
    if (r.status === 'aguardando_sinal') return;
    const sinal = Number(r.valor_sinal) || 0;
    const resto = Math.max(0, (Number(r.valor_total) || 0) - sinal);
    if (r.sinal_recebido) recebido += sinal; else aReceber += sinal;
    if (r.restante_recebido) recebido += resto; else aReceber += resto;
  });
  const gastosLista = estado.gastos.filter((g) => g.data.startsWith(mes));
  const gastos = gastosLista.reduce((s, g) => s + (Number(g.valor) || 0), 0);
  const porKit = {};
  rs.forEach((r) => { porKit[r.kit_id] = (porKit[r.kit_id] || 0) + 1; });
  const top = Object.entries(porKit).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => ({ nome: kitDe(id).nome, n }));
  return {
    recebido, aReceber, gastos, gastosLista, lucro: recebido - gastos, top,
    confirmadas: rs.filter((r) => r.status === 'confirmada' || r.status === 'retirada').length,
    aguardando: rs.filter((r) => r.status === 'aguardando_sinal').length,
    concluidas: rs.filter((r) => r.status === 'concluida').length,
    total: rs.length,
  };
}
function mesAnterior(mes) { const [a, m] = mes.split('-').map(Number); return dados.isoDe(new Date(a, m - 2, 1)).slice(0, 7); }
function nomeDoMes(mes) { const [a, m] = mes.split('-').map(Number); return maiuscula(new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })); }

// ---------------------------------------------------------------------
// Primeiros passos: aparece no Início para contas novas (criadas a partir
// desta atualização) até completar os 3 passos ou tocar em "Não mostrar mais".
// ---------------------------------------------------------------------
const PASSOS_DESDE = '2026-11-13T21:00:00Z';
function guardado(chave, valor) {
  try { if (valor === undefined) return localStorage.getItem(chave); localStorage.setItem(chave, valor); } catch (e) { /* sem memória do navegador */ }
  return null;
}
function passosFeitos() {
  const n = estado.negocio || {};
  return {
    perfil: !!n.logo_url,
    kit: estado.kits.length > 0,
    reserva: estado.reservas.length > 0,
    link: !!(n.link_copiado_em || guardado(`apm-link-copiado-${n.id}`)),
  };
}
function mostrarPassos() {
  const n = estado.negocio;
  if (!n || DEMO_SITE || !podeEditar()) return false;
  if (!n.criado_em || n.criado_em < PASSOS_DESDE) return false;
  if (guardado(`apm-passos-ocultos-${n.id}`)) return false;
  const f = passosFeitos();
  if (f.kit && f.reserva && f.link) {
    // Completou agora: parabéns uma única vez.
    if (!guardado(`apm-passos-parabens-${n.id}`)) { guardado(`apm-passos-parabens-${n.id}`, '1'); setTimeout(popupParabens, 400); }
    return false;
  }
  return true;
}
async function copiarMeuLink() {
  const link = linkPublico(estado.negocio.slug);
  try { await navigator.clipboard.writeText(link); aviso('Link copiado! Agora cole na bio do Instagram.'); }
  catch (e) { prompt('Copie o link:', link); }
  guardado(`apm-link-copiado-${estado.negocio.id}`, '1');
  if (!estado.negocio.link_copiado_em) {
    dados.marcarLinkCopiado().catch(() => {});
    estado.negocio.link_copiado_em = new Date().toISOString();
  }
}
function cartaoPassos() {
  const f = passosFeitos();
  const feitos = [f.perfil, f.kit, f.reserva, f.link].filter(Boolean).length;
  const passo = (n, ok, titulo, texto, botao, id, principal) => `
    <div class="passo ${ok ? 'feito' : ''}">
      <div class="bola">${ok ? '✓' : n}</div>
      <div><b>${titulo}</b><span>${texto}</span>${ok ? '' : `<div><button class="btn ${principal ? 'principal' : 'contorno'} mini" id="${id}">${botao}</button></div>`}</div>
    </div>`;
  const proximo = !f.perfil ? 1 : !f.kit ? 2 : !f.reserva ? 3 : 4;
  return `<section class="cartao coluna primeiros">
    <div class="linha-flex entre"><h2>🚀 Comece em 4 passos</h2><b class="pequeno">${feitos} de 4</b></div>
    <div class="prog"><i style="width:${Math.max(4, Math.round((feitos / 4) * 100))}%"></i></div>
    <button class="btn-video" id="passos-video"><span class="play" aria-hidden="true">▶</span><span>Prefere ver como faz? <b>Assista ao vídeo passo a passo (2 min)</b></span></button>
    ${passo(1, f.perfil, 'Coloque sua logo e o seu Instagram', 'Eles aparecem no topo do seu link de reservas.', 'Completar perfil', 'passo-perfil', proximo === 1)}
    ${passo(2, f.kit, 'Cadastre seu primeiro kit', 'Com foto e lista de peças. Leva 2 minutos.', 'Cadastrar kit', 'passo-kit', proximo === 2)}
    ${passo(3, f.reserva, 'Crie uma reserva', 'Pode ser uma de teste, para ver a agenda funcionando.', 'Criar reserva', 'passo-reserva', proximo === 3)}
    ${passo(4, f.link, 'Coloque seu link no Instagram', 'Suas clientes escolhem o kit e a data sozinhas.', 'Copiar meu link', 'passo-link', proximo === 4)}
    <div class="linha-flex entre" style="flex-wrap:wrap;gap:6px">
      ${WHATSAPP_SUPORTE ? `<a class="link-btn" href="${esc(linkZap(WHATSAPP_SUPORTE, 'Oi! Comecei a usar o App Pegue e Monte e preciso de ajuda com os primeiros passos.'))}" target="_blank" rel="noopener">Precisa de ajuda? WhatsApp</a>` : '<span></span>'}
      <button class="link-btn" id="passos-ocultar" style="color:var(--texto2)">Não mostrar mais</button>
    </div>
  </section>`;
}
// Vídeo passo a passo (fica no próprio app; só carrega quando a pessoa toca em assistir)
function abrirVideoTutorial() {
  abrirPopup(`
    <h2 class="centro" style="font-size:22px;margin:0">Como usar o app</h2>
    <video class="video-tutorial" src="tutorial.mp4?v=1" controls playsinline preload="metadata" poster="tutorial-capa.jpg?v=1"></video>
    <button class="btn contorno cheio" id="video-fechar">Fechar</button>`, (p) => {
    const v = $('video', p);
    try { v.play().catch(() => {}); } catch (e) { /* toca quando ela apertar o play */ }
    $('#video-fechar', p).onclick = () => { try { v.pause(); } catch (e) { /* segue */ } fecharPainel(); };
  });
}
function ligarPassos(tela) {
  const liga = (id, fn) => { const b = $('#' + id, tela); if (b) b.onclick = fn; };
  liga('passo-perfil', () => painelNegocio());
  liga('passos-video', abrirVideoTutorial);
  liga('passo-kit', () => formKit(null));
  liga('passo-reserva', () => (estado.kits.length ? formReserva({}) : aviso('Cadastre um kit primeiro (passo 2).')));
  liga('passo-link', async () => { await copiarMeuLink(); desenharAba(); });
  liga('passos-ocultar', () => { guardado(`apm-passos-ocultos-${estado.negocio.id}`, '1'); desenharAba(); });
}
function popupParabens() {
  abrirPopup(`
    <div style="font-size:54px;text-align:center" aria-hidden="true">🎉</div>
    <h2 class="centro" style="font-size:25px">Seu app está pronto!</h2>
    <p class="centro">Você cadastrou seu kit, criou uma reserva e já tem seu link. Agora é só deixar suas clientes reservarem sozinhas.</p>
    <div class="nota-amarela pequeno"><b>Dica:</b> coloque o link na bio do Instagram e na mensagem automática do WhatsApp Business.</div>
    <button class="btn principal cheio" id="parabens-copiar">Copiar meu link de reservas</button>
    <button class="link-btn" id="parabens-fechar">Fechar</button>`, (p) => {
    $('#parabens-copiar', p).onclick = () => copiarMeuLink();
    $('#parabens-fechar', p).onclick = () => fecharPainel();
  });
}

// Assinou o anual com a montagem: cartão fixo até ela pedir a montagem no WhatsApp.
function cartaoMontagem() {
  return ''; // 20/11: aviso retirado da tela inicial (a dona segue pelos passos de configuração)
  // eslint-disable-next-line no-unreachable
  const m = estado.montagem;
  if (!m || m.pediu_em || m.concluida_em || estado.suporte || !WHATSAPP_SUPORTE) return '';
  return `<section class="cartao coluna cartao-montagem">
    <span class="selo-ok">🎉 ASSINATURA ATIVA</span>
    <h2 style="margin:0;font-size:22px">Agora é com a gente: <span style="color:var(--destaque)">vamos montar sua loja</span></h2>
    <p class="pequeno" style="margin:0">Seu plano inclui a montagem dos seus kits pela nossa equipe. Para começar, chame a gente no WhatsApp e mande as fotos, os nomes e os preços dos kits.</p>
    <a class="btn verde cheio" id="pedir-montagem" href="${esc(linkZap(WHATSAPP_SUPORTE, `Oi! Assinei o plano anual com a montagem da loja (${estado.negocio.nome}). Como envio meus kits?`))}" target="_blank" rel="noopener">${ICONE.zap} Pedir a montagem da minha loja</a>
    <p class="dica centro" style="margin:0">A loja fica pronta em até 3 dias úteis depois que você mandar as fotos.</p>
  </section>`;
}
function ligarCartaoMontagem(tela) {
  const b = $('#pedir-montagem', tela);
  if (!b) return;
  b.addEventListener('click', () => {
    dados.montagemPedida().catch(() => {});
    if (estado.montagem) estado.montagem.pediu_em = new Date().toISOString();
    setTimeout(() => { if (estado.aba === 'hoje') desenharAba(); }, 800);
  });
}

// Mensagens do administrador (Central de mensagens): aparece uma vez, como popup.
async function mostrarMensagensAdmin() {
  if (estado.suporte || DEMO_SITE || dados.MODO_DEMO || painelAberto) return;
  let lista = [];
  try { lista = await dados.minhasMensagens(); } catch (e) { return; }
  const m = lista && lista[0];
  if (!m || painelAberto) return;
  dados.marcarMensagem(m.id, 'viu').catch(() => {});
  const destino = String(m.botao_destino || '');
  const ehLink = /^https?:\/\//i.test(destino);
  abrirPopup(`
    ${m.imagem_url ? `<img src="${esc(m.imagem_url)}" alt="" style="width:100%;border-radius:16px;max-height:260px;object-fit:cover">` : ''}
    <h2 style="font-size:23px;margin:0">${esc(m.titulo)}</h2>
    <p style="margin:0;white-space:pre-line;line-height:1.5">${esc(m.texto)}</p>
    ${m.botao_texto ? (ehLink || destino === 'zap'
      ? `<a class="btn principal cheio" id="msg-botao" href="${esc(destino === 'zap' ? linkZap(WHATSAPP_SUPORTE, 'Oi! Vi a mensagem no app e quero saber mais.') : destino)}" target="_blank" rel="noopener">${esc(m.botao_texto)}</a>`
      : `<button class="btn principal cheio" id="msg-botao">${esc(m.botao_texto)}</button>`) : ''}
    <button class="link-btn" id="msg-fechar">Fechar</button>`, (p) => {
    $('#msg-fechar', p).onclick = () => { dados.marcarMensagem(m.id, 'fechou').catch(() => {}); fecharPainel(); };
    const b = $('#msg-botao', p);
    if (b) b.addEventListener('click', () => {
      dados.marcarMensagem(m.id, 'clicou').catch(() => {});
      if (ehLink || destino === 'zap') return;
      fecharPainel();
      if (destino === 'planos') { if (situacaoAssinatura() === 'teste') popupPlanosTeste('mensagem'); else irPara('mais'); return; }
      const aba = destino.replace('tela:', '');
      if (['hoje', 'agenda', 'kits', 'mais'].includes(aba)) irPara(aba);
      if (destino === 'video') abrirVideoTutorial();
    });
  });
}

function abaHoje(tela) {
  const h = hojeISO();
  const mes = estado.mesFin || h.slice(0, 7);
  const atual = resumoDoMes(mes);
  const anterior = resumoDoMes(mesAnterior(mes));
  const temGastos = atual.gastosLista.length > 0;
  let comparacao = '';
  if (temGastos && anterior.gastosLista.length && anterior.lucro > 0) {
    const pct = Math.round(((atual.lucro - anterior.lucro) / anterior.lucro) * 100);
    comparacao = `${pct >= 0 ? '+' : ''}${pct}% em relação a ${nomeDoMes(mesAnterior(mes)).toLowerCase()}`;
  }

  const ativas = estado.reservas.filter((r) => r.status !== 'cancelada');
  const pendentes = ativas.filter((r) => r.status === 'aguardando_sinal').sort((a, b) => a.data_festa.localeCompare(b.data_festa));
  const retiradas = ativas.filter((r) => r.status === 'confirmada' && r.data_retirada === h);
  const devolucoes = ativas.filter((r) => r.status === 'retirada' && r.data_devolucao === h);
  const atrasadas = ativas.filter(estaAtrasada);
  const proximas = ativas.filter((r) => r.status === 'confirmada' && r.data_retirada > h && r.data_retirada <= somaDias(h, 7))
    .sort((a, b) => a.data_retirada.localeCompare(b.data_retirada));

  const bloco = (titulo, cor, lista, extra) => `
    <section class="coluna">
      <div class="secao-titulo"><h2 class="titulo-alerta" style="--cor:${cor}">${titulo}</h2><span class="num-alerta" style="background:${cor}">${lista.length}</span></div>
      <div class="lista">${lista.map((r) => itemReserva(r, extra(r))).join('')}</div>
    </section>`;
  const algumAlerta = atrasadas.length + pendentes.length + retiradas.length + devolucoes.length > 0;

  const comPassos = mostrarPassos();
  tela.innerHTML = `
    ${cartaoMontagem()}
    ${comPassos ? cartaoPassos() : ''}
    <section class="fin">
      <div class="linha-flex entre">
        <button class="fechar" id="fin-ant" aria-label="Mês anterior">${ICONE.esq}</button>
        <div class="centro"><div class="fin-mes">${esc(nomeDoMes(mes))}</div><div class="pequeno">${esc(dataLonga(h))}</div></div>
        <button class="fechar" id="fin-prox" aria-label="Próximo mês">${ICONE.dir}</button>
      </div>
      <div class="fin-destaque">
        <div class="fin-rotulo">${temGastos ? 'Lucro do mês' : 'Recebido no mês'}</div>
        <div class="fin-valor">${reais(temGastos ? atual.lucro : atual.recebido)}</div>
        <div class="fin-sub">${comparacao ? esc(comparacao) : (temGastos ? `${atual.total} reserva(s) no mês` : 'Lance seus gastos para ver o lucro')}</div>
      </div>
      <div class="fin-grade">
        <div class="fin-cartao"><div class="pequeno">Recebido</div><b>${reais(atual.recebido)}</b></div>
        <div class="fin-cartao"><div class="pequeno">A receber</div><b>${reais(atual.aReceber)}</b></div>
        <button class="fin-cartao clicavel-fin" id="ver-gastos"><div class="pequeno">Gastos</div><b>${reais(atual.gastos)}</b></button>
      </div>
      <div class="fin-cartao coluna" style="gap:10px">
        <div class="pequeno">Pedidos do mês</div>
        <div class="legenda">
          <span class="etiqueta et-confirmada">${atual.confirmadas} confirmada${atual.confirmadas === 1 ? '' : 's'}</span>
          <span class="etiqueta et-aguardando_sinal">${atual.aguardando} aguardando sinal</span>
          <span class="etiqueta et-concluida">${atual.concluidas} concluída${atual.concluidas === 1 ? '' : 's'}</span>
        </div>
        ${atual.top.length ? `<div class="pequeno">Mais alugados: <b>${atual.top.map((t) => `${esc(t.nome)} (${t.n})`).join(', ')}</b></div>` : ''}
      </div>
      ${podeEditar() ? `<button class="btn claro cheio" id="novo-gasto">${ICONE.mais1} Lançar gasto</button>` : ''}
    </section>

    <h2 style="margin-top:6px">Alertas</h2>
    ${atrasadas.length ? bloco('Atrasadas', '#B3202E', atrasadas, (r) => r.status === 'retirada'
      ? `<b style="color:#B3202E">Devolução era ${dataCurta(r.data_devolucao)}</b>`
      : `<b style="color:#B3202E">Retirada era ${dataCurta(r.data_retirada)}</b>`) : ''}
    ${pendentes.length ? bloco('Aguardando sinal', '#9A5B00', pendentes, (r) => `${r.origem === 'link' ? 'Pelo link · ' : ''}Festa ${dataCurta(r.data_festa)} · sinal ${reais(r.valor_sinal)}`) : ''}
    ${retiradas.length ? bloco('Retiradas de hoje', '#5B3A99', retiradas, () => 'Abra para conferir as peças') : ''}
    ${devolucoes.length ? bloco('Devoluções de hoje', '#1E5FA8', devolucoes, () => 'Abra para conferir as peças') : ''}
    ${algumAlerta ? '' : '<div class="cartao res-concluida tudo-em-dia"><b>Tudo em dia!</b><div class="pequeno">Nenhuma pendência para hoje.</div></div>'}
    ${proximas.length ? bloco('Próximos 7 dias', '#4E4459', proximas, (r) => `Retirada ${dataCurta(r.data_retirada)}`) : ''}
    ${estado.kits.length === 0 && !comPassos ? `<div class="cartao coluna"><h3>Comece cadastrando seus kits</h3><p class="pequeno">Eles aparecem no seu link de reservas.</p><button class="btn principal" id="ir-kits">Cadastrar meu primeiro kit</button></div>` : ''}`;
  ligarItens(tela);
  ligarCartaoMontagem(tela);
  if (comPassos) ligarPassos(tela);
  const muda = (delta) => { const [a, m] = mes.split('-').map(Number); estado.mesFin = dados.isoDe(new Date(a, m - 1 + delta, 1)).slice(0, 7); abaHoje(tela); };
  $('#fin-ant', tela).onclick = () => muda(-1);
  $('#fin-prox', tela).onclick = () => muda(1);
  $('#ver-gastos', tela).onclick = () => telaGastos(mes);
  const ng = $('#novo-gasto', tela);
  if (ng) ng.onclick = () => formGasto(mes);
  const b = $('#ir-kits', tela);
  if (b) b.onclick = () => irPara('kits');
}

function telaGastos(mes) {
  const lista = estado.gastos.filter((g) => g.data.startsWith(mes)).sort((a, b) => b.data.localeCompare(a.data));
  const total = lista.reduce((s, g) => s + (Number(g.valor) || 0), 0);
  abrirPainel(`Gastos de ${nomeDoMes(mes).toLowerCase()}`, `
    <div class="fin-cartao"><div class="pequeno">Total do mês</div><b style="font-size:22px">${reais(total)}</b></div>
    ${podeEditar() ? `<button class="btn principal cheio" id="add-gasto">${ICONE.mais1} Lançar gasto</button>` : ''}
    <div class="lista">${lista.length ? lista.map((g) => `
      <div class="cartao"><div class="item-res">
        <div class="info"><div class="nome">${esc(g.descricao)}</div><div class="pequeno">${dataCurta(g.data)}</div></div>
        <b>${reais(g.valor)}</b>
        ${podeEditar() ? `<button class="btn perigo mini" data-apagar="${esc(g.id)}" aria-label="Apagar gasto ${esc(g.descricao)}">Apagar</button>` : ''}
      </div></div>`).join('') : '<p class="vazio-txt">Nenhum gasto lançado neste mês.</p>'}</div>`, (p) => {
    const add = $('#add-gasto', p);
    if (add) add.onclick = () => formGasto(mes, () => telaGastos(mes));
    $$('[data-apagar]', p).forEach((b) => (b.onclick = () => {
      if (!confirm('Apagar este gasto?')) return;
      acao(b, async () => { await dados.apagarGasto(b.dataset.apagar); await recarregar(); aviso('Gasto apagado.'); telaGastos(mes); });
    }));
  });
}

function formGasto(mes, depois) {
  if (!podeEditar()) return aviso('Sua assinatura não está ativa.');
  const h = hojeISO();
  const dataPadrao = h.startsWith(mes) ? h : `${mes}-01`;
  abrirPainel('Lançar gasto', `
    <form class="coluna" novalidate>
      <label class="campo">O que foi<input name="descricao" maxlength="120" placeholder="Ex.: balões, frete, peça nova" required></label>
      <div class="grade-2">
        <label class="campo">Valor (R$)<input name="valor" inputmode="decimal" placeholder="0,00" required></label>
        <label class="campo">Data<input type="date" name="data" value="${dataPadrao}" required></label>
      </div>
      <div class="erro oculto" id="erro-gasto"></div>
      <button class="btn principal cheio" type="submit">Salvar gasto</button>
    </form>`, (p) => {
    const form = $('form', p);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const caixa = $('#erro-gasto', p);
      const g = { descricao: form.descricao.value.trim(), valor: numero(form.valor.value), data: form.data.value };
      let erro = '';
      if (!g.descricao) erro = 'Diga o que foi o gasto.';
      else if (!(g.valor > 0)) erro = 'Digite o valor do gasto.';
      else if (!g.data) erro = 'Escolha a data.';
      if (erro) { caixa.textContent = erro; caixa.classList.remove('oculto'); return; }
      await acao($('button[type=submit]', form), async () => {
        try {
          await dados.criarGasto(g);
          await recarregar();
          aviso('Gasto lançado!');
          if (depois) depois(); else fecharPainel();
        } catch (err) { caixa.textContent = err.message; caixa.classList.remove('oculto'); }
      });
    };
  }, depois || null);
}

// ---------------------------------------------------------------------
// AGENDA
// ---------------------------------------------------------------------
function abaAgenda(tela) {
  const [ano, mes] = estado.mes.split('-').map(Number);
  const primeiro = new Date(ano, mes - 1, 1);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const inicioSemana = primeiro.getDay();
  const h = hojeISO();
  const ativas = estado.reservas.filter((r) => r.status !== 'cancelada');
  const festasPorDia = {};
  ativas.forEach((r) => { festasPorDia[r.data_festa] = (festasPorDia[r.data_festa] || 0) + 1; });

  let celulas = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map((d) => `<div class="dsem">${d}</div>`).join('');
  for (let i = 0; i < inicioSemana; i++) celulas += '<button class="vazio" tabindex="-1" aria-hidden="true"></button>';
  for (let d = 1; d <= diasNoMes; d++) {
    const iso = `${estado.mes}-${String(d).padStart(2, '0')}`;
    const n = Math.min(3, festasPorDia[iso] || 0);
    const fech = (estado.fechados || []).some((f) => iso >= f.de && iso <= f.ate);
    celulas += `<button data-dia="${iso}" class="${iso === h ? 'hoje' : ''} ${iso === estado.dia ? 'sel' : ''} ${fech ? 'fechado' : ''}" aria-label="${dataLonga(iso)}${n ? `, ${festasPorDia[iso]} festa(s)` : ''}">
      ${d}<span class="pontos">${'<span class="ponto"></span>'.repeat(n)}</span></button>`;
  }

  const dia = estado.dia;
  const kitsVisiveis = estado.kits.filter((k) => k.ativo || ativas.some((r) => r.kit_id === k.id && cruza(r, dia, dia)));
  const linhas = dados.ordenarKits(kitsVisiveis, estado.negocio.ordem_kits || 'az').map((k) => {
    const rs = ativas.filter((x) => x.kit_id === k.id && cruza(x, dia, dia));
    const qtd = Math.max(1, Number(k.quantidade) || 1);
    const itens = rs.map((r) => {
      let papel = 'Com a cliente';
      if (r.data_festa === dia) papel = 'Dia da festa';
      else if (r.data_retirada === dia) papel = 'Retirada';
      else if (r.data_devolucao === dia) papel = 'Devolução';
      return itemReserva(r, `${papel} · festa ${dataCurta(r.data_festa)}`);
    }).join('');
    const livres = qtd - rs.length;
    if (livres <= 0) return itens;
    return itens + `
      <div class="cartao"><div class="item-res">
        <div class="info"><div class="nome">${esc(k.nome)}</div><div class="pequeno">${qtd > 1 ? `${livres} de ${qtd} livre${livres > 1 ? 's' : ''}` : 'Disponível'}</div></div>
        ${podeEditar() ? `<button class="btn claro mini" data-reservar="${esc(k.id)}">Reservar</button>` : etiqueta('livre', 'Livre')}
      </div></div>`;
  }).join('');
  const fechadoDia = (estado.fechados || []).find((f) => dia >= f.de && dia <= f.ate);
  const lim = estado.negocio.limite_dia;
  const noDia = ativas.filter((x) => cruza(x, dia, dia)).length;
  const usoEstr = (estado.estruturas || []).map((e) => {
    const usados = ativas.filter((x) => cruza(x, dia, dia)).reduce((t, x) => { const kk = kitDe(x.kit_id); const u = (kk.estruturas || []).find((y) => y.id === e.id); return t + (u ? Math.max(1, Number(u.qtd) || 1) : 0); }, 0);
    return usados ? `${esc(e.nome)}: ${usados} de ${e.quantidade}` : '';
  }).filter(Boolean);
  const topoDia = `${fechadoDia ? `<div class="nota-amarela pequeno">🔒 Dia fechado no seu link${fechadoDia.recado ? `: ${esc(fechadoDia.recado)}` : ''}</div>` : ''}
    ${lim || usoEstr.length ? `<div class="pequeno ag-uso">${lim ? `<b>Festas nesse dia: ${noDia} de ${lim}</b>${noDia >= lim ? ' · <span class="ag-no">lotado no link</span>' : ''}` : ''}${usoEstr.length ? `${lim ? ' · ' : ''}${usoEstr.join(' · ')}` : ''}</div>` : ''}`;

  const nomeMes = maiuscula(primeiro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
  tela.innerHTML = `
    <div class="linha-flex entre">
      <button class="fechar" id="mes-ant" aria-label="Mês anterior">${ICONE.esq}</button>
      <h1 style="font-size: 22px">${esc(nomeMes)}</h1>
      <button class="fechar" id="mes-prox" aria-label="Próximo mês">${ICONE.dir}</button>
    </div>
    <div class="cartao"><div class="cal">${celulas}</div></div>
    <section class="coluna">
      <div class="secao-titulo"><h2>${esc(dataLonga(dia))}</h2></div>
      ${topoDia}
      ${kitsVisiveis.length ? `<div class="lista">${linhas}</div>` : '<p class="vazio-txt">Cadastre seus kits na aba Kits para ver a disponibilidade.</p>'}
    </section>`;

  const mudaMes = (delta) => {
    const d = new Date(ano, mes - 1 + delta, 1);
    estado.mes = dados.isoDe(d).slice(0, 7);
    estado.dia = estado.mes === h.slice(0, 7) ? h : `${estado.mes}-01`;
    abaAgenda(tela);
  };
  $('#mes-ant', tela).onclick = () => mudaMes(-1);
  $('#mes-prox', tela).onclick = () => mudaMes(1);
  $$('[data-dia]', tela).forEach((b) => (b.onclick = () => { estado.dia = b.dataset.dia; abaAgenda(tela); }));
  $$('[data-reservar]', tela).forEach((b) => (b.onclick = () => formReserva({ kit_id: b.dataset.reservar, data_festa: dia })));
  ligarItens(tela);
}

// ---------------------------------------------------------------------
// KITS
// ---------------------------------------------------------------------
function abaKits(tela) {
  const n = estado.negocio;
  const ORDENS = [['az', 'A–Z'], ['numero', 'Número do kit'], ['menor', 'Menor preço'], ['maior', 'Maior preço'], ['novos', 'Mais novos']];
  const cartoes = dados.ordenarKits(estado.kits, n.ordem_kits || 'az').map((k) => {
    const nv = variacoesDe(k).length;
    const qtd = Math.max(1, Number(k.quantidade) || 1), nt = (k.temas || []).length;
    return `
    <div class="kit-card-caixa">
    <button class="cartao clicavel kit-card" data-kit="${esc(k.id)}">
      ${k.foto_url ? fotoCaixa(k.foto_url, '', true) : '<div class="foto-kit foto-vazia">Sem foto</div>'}
      <div class="nome">${esc(k.nome)}</div>
      <div class="pequeno">${precoKitTexto(k)} · ${nv ? `${nv} opç${nv === 1 ? 'ão' : 'ões'}` : `${k.pecas.length} peça${k.pecas.length === 1 ? '' : 's'}`}</div>
      ${qtd > 1 || nt ? `<div class="pequeno ag-resumo-kit">✓ Pode sair até ${qtd} por dia${nt ? ` · ${plural(nt, 'tema', 'temas')}` : ''}</div>` : ''}
      ${k.categoria ? `<span class="etiqueta et-categoria">${esc(k.categoria)}</span>` : ''}
      ${k.ativo ? '' : '<span class="etiqueta et-cancelada">Oculto</span>'}
    </button>
    ${k.ativo && !DEMO_SITE ? `<button class="kit-compartilhar" data-compartilhar="${esc(k.id)}" aria-label="Compartilhar o kit ${esc(k.nome)}" title="Compartilhar este kit">↗</button>` : ''}
    </div>`;
  }).join('');
  const insta = n.instagram ? `<a class="btn insta mini" href="https://instagram.com/${encodeURIComponent(n.instagram)}" target="_blank" rel="noopener">📷 @${esc(n.instagram)}</a>` : '';
  tela.innerHTML = `
    <section class="cartao vitrine-loja">
      ${podeEditar() ? '<button class="vitrine-editar" id="vitrine-editar">✏️ Editar</button>' : ''}
      ${n.logo_url ? `<img class="vitrine-logo" src="${esc(n.logo_url)}" alt="Logo da loja">` : ''}
      <div class="vitrine-nome">${esc(n.nome)}</div>
      <p class="vitrine-recado">${esc(n.recado_link || recadoPadrao(n.nome))}</p>
      ${insta}
      <div class="vitrine-links"><a href="${esc(linkDona())}">👀 Ver como a cliente vê</a><button class="link-btn" id="vitrine-copiar">🔗 Copiar link da loja</button></div>
    </section>
    <div id="ia-caixa" class="coluna" style="gap:10px">${cartaoIA()}</div>
    <div class="secao-titulo"><h1>Meus kits</h1>${podeEditar() ? `<button class="btn principal mini" id="novo-kit">${ICONE.mais1} Novo kit</button>` : ''}</div>
    ${estado.kits.length > 1 ? `<label class="ag-ordem">Ordenar: <select id="ordem-kits">${ORDENS.map(([v, t]) => `<option value="${v}" ${(n.ordem_kits || 'az') === v ? 'selected' : ''}>${t}</option>`).join('')}</select><small class="dica">vale também no seu link</small></label>` : ''}
    ${estado.kits.length ? `<div class="kits-grade">${cartoes}</div>` : '<p class="vazio-txt">Nenhum kit ainda. Cadastre o primeiro: foto, nome, preço e a lista de peças.</p>'}`;
  const novo = $('#novo-kit', tela);
  if (novo) novo.onclick = () => formKit(null);
  const ed = $('#vitrine-editar', tela);
  if (ed) ed.onclick = () => painelNegocio();
  $('#vitrine-copiar', tela).onclick = () => copiarMeuLink();
  $$('[data-kit]', tela).forEach((b) => (b.onclick = () => formKit(estado.kits.find((k) => k.id === b.dataset.kit))));
  $$('[data-compartilhar]', tela).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); compartilharKit(estado.kits.find((k) => k.id === b.dataset.compartilhar)); }));
  const ord = $('#ordem-kits', tela);
  if (ord) ord.onchange = () => acao(null, async () => { estado.negocio = await dados.salvarNegocio({ ordem_kits: ord.value }); abaKits(tela); });
  ligarCartaoIA(tela);
  // Situação da IA atualizada (ex.: terminou de organizar enquanto a dona estava em outra aba)
  atualizarIA().then(() => { if (estado.aba === 'kits') redesenharCartaoIA(); });
}

// Compartilhar um kit: o link abre o link de reservas direto nesse kit.
function compartilharKit(k) {
  if (!k) return;
  const link = linkDoKit(k);
  const texto = `${k.nome} · ${estado.negocio.nome}\nVeja as fotos e as datas livres para reservar: ${link}`;
  abrirPopup(`
    <h2 style="font-size:22px;margin:0">Compartilhar "${esc(k.nome)}"</h2>
    <p class="pequeno" style="margin:0">A cliente abre direto neste kit, com as fotos e as datas livres.</p>
    <div class="cartao" style="background: var(--lilas); word-break: break-all; font-weight:700; font-size:13px">${esc(link)}</div>
    <a class="btn verde cheio" href="${esc('https://wa.me/?text=' + encodeURIComponent(texto))}" target="_blank" rel="noopener">${ICONE.zap} Enviar no WhatsApp</a>
    <button class="btn contorno cheio" id="ck-copiar">🔗 Copiar link do kit</button>
    ${navigator.share ? '<button class="btn contorno cheio" id="ck-mais">📤 Mais opções (Instagram, Direct…)</button>' : ''}
    <button class="link-btn" id="ck-fechar">Fechar</button>`, (p) => {
    $('#ck-fechar', p).onclick = () => fecharPainel();
    $('#ck-copiar', p).onclick = async () => {
      try { await navigator.clipboard.writeText(link); aviso('Link do kit copiado!'); }
      catch (e) { prompt('Copie o link do kit:', link); }
    };
    const mais = $('#ck-mais', p);
    if (mais) mais.onclick = () => navigator.share({ title: k.nome, text: `${k.nome} · ${estado.negocio.nome}`, url: link }).catch(() => {});
  });
}

// =====================================================================
// MONTAR CATÁLOGO COM IA
// A IA só organiza: não mexe nas fotos (sempre inteiras no quadro) e não
// inventa nada. Nome, preço, sinal, peças e opções só vêm do que estiver
// ESCRITO no material. A dona confere e aprova kit por kit.
// Teste grátis: até 5 kits (os outros ficam guardados). Pago: ilimitado.
// =====================================================================
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/';
const IA_MAX_FOTOS = dados.MODO_DEMO ? 12 : 40;
const IA_MAX_PRINTS = 6;
const IA_MAX_PAGINAS = 15;

async function atualizarIA() {
  try { estado.ia = await dados.iaSituacao(); } catch (e) { estado.ia = null; }
  return estado.ia;
}
function iaLigada() { return !!(estado.ia && estado.ia.disponivel && podeEditar()); }
function linkDona() {
  const base = linkPublico(estado.negocio.slug);
  return base + (base.includes('?') ? '&' : '?') + 'dona=1';
}
function plural(n, um, varios) { return `${n} ${n === 1 ? um : varios}`; }

function cartaoIA() {
  const ia = estado.ia;
  if (!iaLigada()) return '';
  if (ia.processando) {
    return `<section class="ia-cartao">
      <span class="ia-selo">⏳ Organizando agora</span>
      <p class="ia-t">✨ A IA está organizando seu catálogo</p>
      <p class="ia-p">Leva de 1 a 3 minutos. Pode usar o app normalmente: avisamos quando estiver pronto.</p>
      <button class="ia-bt" data-ia="andamento">Ver andamento</button></section>`;
  }
  let topo = '';
  if (ia.escolher) {
    topo = `<button class="ia-pronto" data-ia="escolher"><span class="ia-pronto-ic">✨</span><span><b>A IA organizou seus kits!</b><small>Escolha quais ${ia.restante === 1 ? 'kit' : `${ia.restante} kits`} você quer montar agora.</small></span><span class="ia-pronto-bt">Escolher</span></button>`;
  } else if (ia.lote && ia.pendentes) {
    topo = ia.liberados
      ? `<button class="ia-pronto verde" data-ia="conferir"><span class="ia-pronto-ic">🎁</span><span><b>${plural(ia.liberados, 'kit liberado', 'kits liberados')}!</b><small>Os kits que a IA guardou no seu teste estão prontos para você conferir.</small></span><span class="ia-pronto-bt">Conferir</span></button>`
      : `<button class="ia-pronto" data-ia="conferir"><span class="ia-pronto-ic">✨</span><span><b>${plural(ia.pendentes, 'kit pronto', 'kits prontos')} para conferir</b><small>A IA terminou. Confira e aprove um por um.</small></span><span class="ia-pronto-bt">Conferir</span></button>`;
  }
  const erro = ia.erro ? `<p class="ia-erro">A última tentativa não deu certo: ${esc(ia.erro)}</p>` : '';
  if (ia.plano === 'teste' && !ia.restante) {
    return `${topo}<section class="ia-cartao cinza">
      <span class="ia-selo">Teste grátis · 0 de ${ia.limite} kits restantes</span>
      <p class="ia-t">✨ Seus ${ia.limite} kits da IA já estão no catálogo</p>
      <p class="ia-p">${ia.guardados ? `${plural(ia.guardados, 'kit está pronto', 'kits estão prontos')} com cadeado esperando. ` : ''}Assine e a IA monta o resto do seu catálogo, sem limite.</p>
      <button class="ia-bt coral" data-ia="assinar">Assinar e liberar ilimitado</button>
      <button class="ia-bt-link" data-ia="comecar">Mandar mais material (fica pronto com cadeado até você assinar)</button></section>`;
  }
  const pago = ia.plano === 'pago';
  return `${topo}<section class="ia-cartao">
    <span class="ia-selo">${ia.suporte ? '🛟 Modo suporte · sem limite (não conta no teste da cliente)' : pago ? '✓ Ilimitado no seu plano' : `Teste grátis · ${ia.restante} de ${ia.limite} kits para o catálogo`}</span>
    <p class="ia-t">✨ ${pago && estado.kits.length ? 'Adicionar kits com IA' : 'Montar meu catálogo com IA'}</p>
    <p class="ia-p">${pago && estado.kits.length ? 'Mande fotos, PDF ou lista de preços quantas vezes quiser. Kits novos, de temporada ou o catálogo inteiro.' : 'Mande suas fotos, PDF ou lista de preços. A IA separa os kits e você só confere e aprova.'}</p>
    ${erro}
    <button class="ia-bt" data-ia="comecar">Começar</button></section>`;
}
function ligarCartaoIA(raiz) {
  $$('[data-ia]', raiz).forEach((b) => (b.onclick = () => {
    const a = b.dataset.ia;
    if (a === 'comecar') iaEnviar();
    else if (a === 'conferir') iaConferir(estado.ia.lote);
    else if (a === 'escolher') iaConferir(estado.ia.escolher);
    else if (a === 'andamento') iaAndamento(estado.ia.processando);
    else if (a === 'assinar') popupPlanosTeste('ia_limite');
  }));
}
function redesenharCartaoIA() {
  const caixa = $('#ia-caixa');
  if (!caixa) return;
  caixa.innerHTML = cartaoIA();
  ligarCartaoIA(caixa);
}
async function iaAbrirPendente() {
  await atualizarIA();
  if (!iaLigada()) { irPara('kits'); return; }
  if (estado.ia.escolher) iaConferir(estado.ia.escolher);
  else if (estado.ia.lote && estado.ia.pendentes) iaConferir(estado.ia.lote);
  else if (estado.ia.processando) iaAndamento(estado.ia.processando);
  else { irPara('kits'); setTimeout(iaEnviar, 300); } // link dos e-mails: abre direto o "Montar com IA"
}

// ----- 2. Enviar o material: passo a passo guiado (uma pergunta por tela) -----
// Em qualquer caminho o botão aceita fotos, prints e PDF juntos: a IA lê tudo.
const IA_ORIGENS = {
  galeria: { ic: '📱', nome: 'Na galeria do celular', sub: 'fotos que você tirou', titulo: 'Da galeria',
    passos: ['Toque no botão abaixo', 'Escolha as <b>fotos dos kits</b> (pode marcar várias de uma vez)', 'Toque em <b>Continuar</b>'] },
  whatsapp: { ic: '💬', nome: 'No WhatsApp', sub: 'catálogo ou fotos que você manda', titulo: 'Do WhatsApp',
    passos: ['Abra o seu <b>catálogo</b> no WhatsApp (ou a conversa onde estão as fotos)', '<b>Tire print</b> das telas com os kits, ou salve as fotos no celular', 'Volte aqui e toque no botão abaixo'] },
  instagram: { ic: '📸', nome: 'No Instagram', sub: 'posts e destaques', titulo: 'Do Instagram',
    passos: ['Abra o seu perfil e os <b>posts dos kits</b> (ou os destaques)', '<b>Tire print</b> de cada kit. Se o preço estiver na legenda, deixe a legenda aparecer no print', 'Volte aqui e toque no botão abaixo'],
    dica: '💡 Fotos originais da galeria ficam com mais qualidade que prints.' },
  pdf: { ic: '📄', nome: 'Num PDF ou catálogo pronto', sub: '', titulo: 'Do PDF',
    passos: ['Toque no botão abaixo', 'Escolha o <b>arquivo do catálogo</b> (PDF) no celular ou no computador', 'Toque em <b>Continuar</b>'] },
  drive: { ic: '☁️', nome: 'No Google Drive', sub: '', titulo: 'Do Google Drive' },
  conversa: { ic: '🗨️', nome: 'Numa conversa do WhatsApp', sub: 'cole a conversa onde os kits foram combinados', titulo: 'Da conversa' },
  misto: { ic: '🤷', nome: 'Um pouco de cada', sub: '', titulo: 'Seus arquivos',
    passos: ['Toque no botão abaixo', 'Escolha <b>fotos, prints e PDF</b>, tudo junto', 'Se tiver uma pasta no Google Drive, cole o link logo abaixo'] },
};
function iaEnviar() {
  if (!iaLigada()) return;
  const mat = { fotos: [], pdfs: [], prints: [], drive: [], texto: '', conversa: '', origens: [] };
  let passo = 1, origem = null, precos = null;
  const ia = estado.ia;
  const total = () => mat.fotos.length + mat.pdfs.length + mat.drive.length;
  const progresso = () => `<div class="ia-passos">${[1, 2, 3, 4].map((n) => `<i class="${n <= passo ? 'f' : ''}"></i>`).join('')}</div>`;
  const opc = (valor, ic, nome, sub, sel) => `<button type="button" class="ia-opc ${sel ? 'sel' : ''}" data-v="${valor}"><span class="ia-opc-ic">${ic}</span><span><b>${nome}</b>${sub ? `<small>${sub}</small>` : ''}</span></button>`;
  const botaoArquivos = (secundario) => `<label class="${secundario ? 'btn contorno cheio' : 'ia-grande'}" style="cursor:pointer">📎 Escolher fotos, prints ou PDF${secundario ? '' : '<small>pode escolher vários de uma vez</small>'}<input type="file" accept="image/*,application/pdf,.pdf,.heic,.heif" multiple class="oculto" id="ia-in-arq"></label>`;
  const campoDrive = () => `<div class="ia-drive-linha"><input id="ia-drive" inputmode="url" placeholder="Cole aqui o link do Google Drive" autocomplete="off"><button type="button" class="btn claro mini" id="ia-drive-ok">Buscar</button></div><span class="dica" id="ia-drive-msg">${mat.drive.length ? `✅ ${plural(mat.drive.length, 'arquivo encontrado', 'arquivos encontrados')} no Drive` : ''}</span>`;
  const escolhidos = () => {
    const partes = [];
    if (mat.fotos.length) partes.push(plural(mat.fotos.length, 'foto ou print', 'fotos ou prints'));
    if (mat.pdfs.length) partes.push(plural(mat.pdfs.length, 'PDF', 'PDFs'));
    if (mat.drive.length) partes.push(plural(mat.drive.length, 'arquivo do Drive', 'arquivos do Drive'));
    return partes.length ? `<div class="ia-escolhidos">✅ ${partes.join(' · ')}<span class="ia-thumbs">${miniaturas(mat.fotos)}</span></div>` : '';
  };
  const telas = {
    1: () => `
      <button type="button" class="ia-video-link oculto" id="ia-ver-video">▶ Ver o vídeo de como funciona</button>
      <p class="ia-perg">Onde estão as fotos dos seus kits hoje?</p>
      <p class="pequeno">Escolha o que tiver mais. Depois dá para mandar de outros lugares também.${ia.plano === 'teste' ? ` No teste grátis: até <b>10 arquivos</b> por envio${ia.restante ? ` e <b>${plural(ia.restante, 'kit', 'kits')}</b> da IA no catálogo.` : '. Seus 5 kits do teste já estão no catálogo: o que a IA preparar agora fica com cadeado até você assinar.'}` : ''}</p>
      ${Object.entries(IA_ORIGENS).map(([v, o]) => opc(v, o.ic, o.nome, o.sub, v === origem)).join('')}`,
    2: () => {
      const o = IA_ORIGENS[origem];
      if (origem === 'conversa') {
        return `<p class="ia-perg">Cole a conversa do WhatsApp</p>
          <div class="passo-inst"><b>1</b><span>No WhatsApp, abra a conversa, toque e segure numa mensagem, marque as mensagens dos kits e toque em <b>Copiar</b>. Ou use <b>⋮ › Mais › Exportar conversa</b> e escolha "sem mídia".</span></div>
          <div class="passo-inst"><b>2</b><span>Cole aqui embaixo (ou anexe o arquivo .txt exportado). Depois escolha as <b>fotos dos kits</b>.</span></div>
          <textarea id="ia-conversa" rows="7" maxlength="60000" placeholder="Cole a conversa aqui">${esc(mat.conversa)}</textarea>
          <label class="btn contorno mini" style="cursor:pointer;align-self:flex-start">📄 Anexar conversa exportada (.txt)<input type="file" accept=".txt,text/plain" class="oculto" id="ia-in-txt"></label>
          <div class="ia-dica">💡 A IA usa só o que foi combinado sobre os kits (nomes, preços, sinal, peças). Se o valor mudou na conversa, vale o último. Conversa fiada e dados pessoais são ignorados.</div>
          ${botaoArquivos(true)}
          ${escolhidos()}
          <button class="btn principal cheio" id="ia-cont" ${total() || mat.conversa.trim() ? '' : 'disabled'}>Continuar</button>`;
      }
      if (origem === 'drive') {
        return `<p class="ia-perg">Cole o link do Google Drive</p>
          <p class="pequeno">O link da pasta (ou do arquivo) com as fotos dos kits.</p>
          ${campoDrive()}
          ${escolhidos()}
          <div class="ia-espaco"></div>
          <button class="btn principal cheio" id="ia-cont" ${total() ? '' : 'disabled'}>Continuar</button>`;
      }
      return `<p class="ia-perg">${origem === 'misto' ? 'Mande seus arquivos' : `Como mandar ${o.titulo.charAt(0).toLowerCase() + o.titulo.slice(1)}`}</p>
        ${o.passos.map((t, n) => `<div class="passo-inst"><b>${n + 1}</b><span>${t}</span></div>`).join('')}
        ${o.dica ? `<div class="ia-dica">${o.dica}</div>` : ''}
        ${origem === 'misto' ? campoDrive() : ''}
        <div class="ia-espaco"></div>
        ${botaoArquivos(false)}
        ${escolhidos()}
        <button class="btn principal cheio" id="ia-cont" ${total() ? '' : 'disabled'}>Continuar</button>`;
    },
    3: () => `
      <p class="ia-perg">Os preços dos kits aparecem nas fotos ou prints?</p>
      ${opc('sim', '✅', 'Sim, estão escritos neles', '', precos === 'sim')}
      ${opc('lista', '📝', 'Não, tenho uma lista separada', 'no WhatsApp, num papel, num print', precos === 'lista')}
      ${opc('digitar', '✍️', 'Não tenho: vou digitar na conferência', '', precos === 'digitar')}
      ${precos === 'lista' ? `<div class="cartao coluna" style="gap:8px">
        <b style="font-size:14.5px">Cole a lista ou mande um print dela</b>
        <textarea id="ia-texto" rows="4" maxlength="15000" placeholder="Ex.: Kit Safari R$ 350, sinal R$ 100">${esc(mat.texto)}</textarea>
        <label class="btn contorno mini" style="cursor:pointer;align-self:flex-start">📷 Mandar print da lista<input type="file" accept="image/*" multiple class="oculto" id="ia-in-prints"></label>
        <span class="ia-thumbs">${miniaturas(mat.prints)}</span></div>` : ''}
      <div class="ia-espaco"></div>
      <button class="btn principal cheio" id="ia-cont" ${precos ? '' : 'disabled'}>Continuar</button>`,
    4: () => `
      <p class="ia-perg">Tudo pronto para a IA organizar</p>
      <div class="cartao ia-resumo-env">
        ${mat.fotos.length ? `<div>🖼️ ${plural(mat.fotos.length, 'foto ou print', 'fotos ou prints')}<span>✓</span></div>` : ''}
        ${mat.pdfs.length ? `<div>📄 ${plural(mat.pdfs.length, 'PDF', 'PDFs')}<span>✓</span></div>` : ''}
        ${mat.drive.length ? `<div>☁️ ${plural(mat.drive.length, 'arquivo do Drive', 'arquivos do Drive')}<span>✓</span></div>` : ''}
        ${mat.conversa.trim() ? '<div>🗨️ Conversa do WhatsApp<span>✓</span></div>' : ''}
        ${mat.texto.trim() || mat.prints.length ? '<div>📝 Lista de preços<span>✓</span></div>' : ''}
      </div>
      ${opc('mais', '➕', 'Mandar mais arquivos', 'de outro lugar (galeria, PDF, Drive…)', false)}
      <div class="ia-aviso"><b>A IA só organiza:</b> não mexe nas suas fotos e não inventa preço. Você confere tudo antes de publicar.</div>
      <div class="erro oculto" id="ia-erro"></div>
      <div class="ia-prog oculto" id="ia-prog"><div class="ia-barra"><i></i></div><span id="ia-prog-tx">Preparando…</span></div>
      <div class="ia-espaco"></div>
      <button class="btn principal cheio" id="ia-ir">✨ Organizar com IA</button>`,
  };
  const titulos = { 1: 'Montar com IA', 2: () => IA_ORIGENS[origem].titulo, 3: 'Os preços', 4: 'Tudo pronto?' };
  const ir = (n) => { passo = n; desenhar(); };
  const voltar = () => { if (passo > 1) ir(passo === 4 && precos ? 3 : passo - 1); else fecharPainel(); };
  const desenhar = () => {
    const t = titulos[passo];
    abrirPainel(typeof t === 'function' ? t() : t, `${progresso()}<div class="coluna ia-tela">${telas[passo]()}</div>`, ligar, voltar);
  };
  const ligar = (p) => {
    const vv = $('#ia-ver-video', p);
    if (vv) temVideoIA().then((ok) => { if (ok) { vv.classList.remove('oculto'); vv.onclick = () => verVideoIA(() => desenhar()); } });
    $$('.ia-opc', p).forEach((b) => (b.onclick = () => {
      const v = b.dataset.v;
      if (passo === 1) { origem = v; if (!mat.origens.includes(v)) mat.origens.push(v); ir(2); }
      else if (passo === 3) { precos = v; if (v !== 'lista') { mat.texto = ''; mat.prints.length = 0; } desenhar(); }
      else if (passo === 4 && v === 'mais') ir(1);
    }));
    const limiteTeste = ia.plano === 'teste' ? 10 : Infinity;
    const usados = () => mat.fotos.length + mat.pdfs.length + mat.drive.length + mat.prints.length;
    const avisoLimite = () => aviso('No teste grátis, cada envio aceita até 10 arquivos. Depois você manda o resto num novo envio.');
    const arq = $('#ia-in-arq', p);
    if (arq) arq.onchange = () => {
      let cortou = false;
      for (const f of arq.files) {
        if (usados() >= limiteTeste) { cortou = true; break; }
        if (/pdf/i.test(f.type) || /\.pdf$/i.test(f.name)) { if (mat.pdfs.length < 3) mat.pdfs.push(f); }
        else mat.fotos.push(f);
      }
      if (cortou) avisoLimite();
      arq.value = '';
      if (mat.fotos.length > IA_MAX_FOTOS) { aviso(`Até ${IA_MAX_FOTOS} fotos por vez. O resto você manda num próximo envio.`); mat.fotos.length = IA_MAX_FOTOS; }
      desenhar();
    };
    const prints = $('#ia-in-prints', p);
    if (prints) prints.onchange = () => {
      mat.texto = ($('#ia-texto', p) || {}).value || mat.texto;
      for (const f of prints.files) { if (usados() >= limiteTeste) { avisoLimite(); break; } mat.prints.push(f); }
      prints.value = '';
      if (mat.prints.length > IA_MAX_PRINTS) { aviso(`Até ${IA_MAX_PRINTS} prints por vez.`); mat.prints.length = IA_MAX_PRINTS; }
      desenhar();
    };
    const texto = $('#ia-texto', p);
    if (texto) texto.oninput = () => { mat.texto = texto.value; };
    const conv = $('#ia-conversa', p);
    if (conv) conv.oninput = () => { mat.conversa = conv.value; const c = $('#ia-cont', p); if (c) c.disabled = !(total() || mat.conversa.trim()); };
    const txt = $('#ia-in-txt', p);
    if (txt) txt.onchange = () => {
      const f = txt.files[0]; txt.value = '';
      if (!f) return;
      const fr = new FileReader();
      fr.onload = () => { mat.conversa = String(fr.result || '').slice(-60000); desenhar(); };
      fr.onerror = () => aviso('Não consegui ler esse arquivo. Copie e cole a conversa.');
      fr.readAsText(f);
    };
    const dOk = $('#ia-drive-ok', p);
    if (dOk) dOk.onclick = (e) => acao(e.currentTarget, async () => {
      const msg = $('#ia-drive-msg', p);
      msg.classList.remove('alerta');
      try {
        const novos = await dados.iaDriveListar($('#ia-drive', p).value.trim());
        const ids = new Set(mat.drive.map((a) => a.id));
        const novosFiltrados = novos.filter((a) => !ids.has(a.id));
        const cabem = Math.max(0, limiteTeste - usados());
        if (novosFiltrados.length > cabem) avisoLimite();
        mat.drive.push(...novosFiltrados.slice(0, cabem));
        desenhar();
      } catch (err) { msg.textContent = err.message; msg.classList.add('alerta'); }
    });
    const cont = $('#ia-cont', p);
    if (cont) cont.onclick = () => {
      if (passo === 3 && precos === 'lista' && !mat.texto.trim() && !mat.prints.length) { aviso('Cole a lista ou mande um print dela. Ou escolha outra opção.'); return; }
      if (passo === 2 && origem === 'conversa') { mat.conversa = ($('#ia-conversa', p) || {}).value || mat.conversa; if (!precos) precos = 'conversa'; ir(4); return; }
      ir(passo === 2 && precos ? 4 : passo + 1);
    };
    const btn = $('#ia-ir', p);
    if (btn) btn.onclick = async () => {
      const caixaErro = $('#ia-erro', p);
      caixaErro.classList.add('oculto');
      btn.disabled = true;
      const prog = $('#ia-prog', p);
      prog.classList.remove('oculto');
      const mostrar = (txt, frac) => { $('#ia-prog-tx', p).textContent = txt; if (frac != null) $('.ia-barra i', p).style.width = Math.round(frac * 100) + '%'; };
      try {
        const material = await prepararMaterial(mat, mostrar);
        if (!material.imagens.length && !material.paginas.length && !material.prints.length && !material.texto) throw new Error(material.avisos[0] || 'Não consegui ler nenhum arquivo. Tente com outras fotos.');
        mostrar('Mandando para a IA…', 1);
        const { lote } = await dados.iaOrganizar({ pasta: material.pasta, imagens: material.imagens, prints: material.prints, paginas: material.paginas, texto: material.texto });
        material.avisos.forEach((a, n) => setTimeout(() => aviso(a), 600 + n * 3400));
        await atualizarIA();
        iaAndamento(lote, { fotos: material.imagens.length, paginas: material.paginas.length, prints: material.prints.length, texto: !!material.texto });
      } catch (e) {
        caixaErro.textContent = e.message || 'Não deu certo. Tente de novo.';
        caixaErro.classList.remove('oculto');
        prog.classList.add('oculto');
        btn.disabled = false;
      }
    };
  };
  desenhar();
}
function miniaturas(arquivos) {
  if (!arquivos.length) return '';
  const mostrar = arquivos.slice(0, 4).map((f) => { try { return `<img src="${esc(URL.createObjectURL(f))}" alt="">`; } catch (e) { return ''; } }).join('');
  return mostrar + (arquivos.length > 4 ? `<span>+${arquivos.length - 4}</span>` : '');
}

// Reduz as fotos, lê os PDFs e envia tudo para a pasta do envio.
async function emParalelo(tarefas, n) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, tarefas.length) }, async () => { while (i < tarefas.length) { const t = tarefas[i++]; await t(); } }));
}
async function prepararMaterial(mat, mostrar) {
  const pasta = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(36).slice(2);
  const fotos = mat.fotos.map((f) => ({ arq: f, origem: 'galeria', nome: f.name }));
  const pdfs = mat.pdfs.map((f) => ({ arq: f, nome: f.name }));
  const avisos = [];
  for (let i = 0; i < mat.drive.length; i++) {
    const d = mat.drive[i];
    mostrar(`Baixando do Google Drive (${i + 1} de ${mat.drive.length})…`, i / mat.drive.length * 0.2);
    try {
      const { blob, nome } = await dados.iaDriveBaixar(d.id);
      const nm = d.tipo === '?' ? (nome || d.nome) : d.nome;
      if (/pdf/i.test(blob.type) || /\.pdf$/i.test(nm)) pdfs.push({ arq: blob, nome: nm });
      else fotos.push({ arq: blob, origem: 'drive', nome: nm });
    } catch (e) { if (!avisos.includes(e.message)) avisos.push(e.message); }
  }
  const paginas = [];
  for (const pdf of pdfs) {
    if (paginas.length >= IA_MAX_PAGINAS) { avisos.push(`A IA lê até ${IA_MAX_PAGINAS} páginas de PDF por vez. Mande o resto num próximo envio.`); break; }
    try {
      const r = await lerPdf(pdf.arq, pdf.nome, IA_MAX_PAGINAS - paginas.length, (tx) => mostrar(tx, 0.25));
      paginas.push(...r.paginas);
      fotos.push(...r.fotos);
      if (r.total > r.paginas.length) avisos.push(`O PDF "${pdf.nome}" tem ${r.total} páginas: a IA leu as ${r.paginas.length} primeiras.`);
    } catch (e) { avisos.push(`Não consegui abrir o PDF "${pdf.nome}".`); }
  }
  if (fotos.length > IA_MAX_FOTOS) { avisos.push(`Mandamos as ${IA_MAX_FOTOS} primeiras fotos. O resto você manda num próximo envio.`); fotos.length = IA_MAX_FOTOS; }
  const imagens = [], prints = [], pags = [];
  let feitos = 0, falhas = 0, naoAbriu = 0, erroEnvio = '';
  const total = fotos.length + mat.prints.length + paginas.length;
  const passo = () => mostrar(`Preparando o material (${++feitos} de ${total})…`, 0.3 + 0.7 * feitos / Math.max(1, total));
  const demo = dados.MODO_DEMO;
  const tarefas = [
    ...fotos.map((f, i) => async () => {
      const id = 'F' + (i + 1);
      let grande = null;
      try { grande = await dados.reduzirFoto(f.arq, demo ? 480 : 1200, demo ? 0.6 : 0.85); } catch (e) { naoAbriu++; }
      if (grande) {
        try {
          const url = await dados.iaEnviarImagem(grande, pasta, id);
          const mini = demo ? url : await dados.iaEnviarImagem(await dados.reduzirFoto(grande, 768, 0.72), pasta, id + '-m');
          // Print de tela (PNG ou nome de captura): guarda também em alta qualidade, só para recortar as fotos dos kits.
          // A IA continua vendo a versão pequena, então o custo não muda.
          let original;
          const ehPrint = /png/i.test(f.arq.type || '') || /screenshot|captura|print|tela|screen/i.test(f.nome || '');
          if (ehPrint && !demo) {
            try { original = await dados.iaEnviarImagem(await dados.reduzirFoto(f.arq, 2600, 0.92), pasta, id + '-o'); } catch (e) { original = undefined; }
          }
          imagens[i] = { id, url, mini, original, origem: f.origem, arquivo: (f.nome || '').slice(0, 80), pagina: f.pagina };
        } catch (e) { falhas++; erroEnvio = e.message || erroEnvio; }
      }
      passo();
    }),
    ...mat.prints.map((f, i) => async () => {
      const id = 'P' + (i + 1);
      let b = null;
      try { b = await dados.reduzirFoto(f, demo ? 480 : 1400, 0.75); } catch (e) { naoAbriu++; }
      if (b) { try { prints[i] = { id, mini: await dados.iaEnviarImagem(b, pasta, id) }; } catch (e) { falhas++; erroEnvio = e.message || erroEnvio; } }
      passo();
    }),
    ...paginas.map((g, i) => async () => {
      const id = 'G' + (i + 1);
      try { pags[i] = { id, n: g.n, arquivo: g.arquivo, texto: g.texto, mini: demo ? '' : await dados.iaEnviarImagem(g.blob, pasta, id) }; } catch (e) { falhas++; erroEnvio = e.message || erroEnvio; }
      passo();
    }),
  ];
  await emParalelo(tarefas, 3);
  if (naoAbriu) avisos.push(`${plural(naoAbriu, 'foto não abriu', 'fotos não abriram')} neste navegador (o formato HEIC do iPhone só abre no Safari). Mande essas fotos como JPG ou use o Safari.`);
  if (falhas) avisos.push(`${plural(falhas, 'arquivo não foi enviado', 'arquivos não foram enviados')}: ${erroEnvio || 'falha na internet'}. Tente de novo.`);
  const texto = [mat.conversa.trim() ? `CONVERSA DO WHATSAPP (use só o que foi combinado sobre os kits; se um valor mudou, vale o último):\n${mat.conversa.trim()}` : '', mat.texto.trim()].filter(Boolean).join('\n\n').slice(-60000);
  return { pasta, imagens: imagens.filter(Boolean), prints: prints.filter(Boolean), paginas: pags.filter(Boolean), texto, avisos };
}
let pdfjsCarregado = null;
function carregarPdfjs() {
  if (!pdfjsCarregado) {
    pdfjsCarregado = import(PDFJS + 'pdf.min.mjs').then((m) => { m.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.mjs'; return m; })
      .catch((e) => { pdfjsCarregado = null; throw e; });
  }
  return pdfjsCarregado;
}
async function lerPdf(arq, nome, maxPaginas, mostrar) {
  const pdfjs = await carregarPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arq.arrayBuffer()) }).promise;
  const paginas = [], fotos = [], vistas = new Set();
  const n = Math.min(doc.numPages, maxPaginas);
  for (let i = 1; i <= n; i++) {
    mostrar(`Lendo o PDF (página ${i} de ${n})…`);
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const texto = tc.items.map((it) => (it.str || '') + (it.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+/g, ' ').trim().slice(0, 4000);
    const vp0 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: Math.min(2.5, 1000 / vp0.width) });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, canvas: c, viewport: vp }).promise;
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.72));
    paginas.push({ blob, n: i, arquivo: nome, texto });
    // As fotos que estão dentro da página (do jeito que foram colocadas no PDF, inteiras)
    try {
      const ops = await page.getOperatorList();
      for (let j = 0; j < ops.fnArray.length; j++) {
        if (ops.fnArray[j] !== pdfjs.OPS.paintImageXObject) continue;
        const idObj = ops.argsArray[j][0];
        if (typeof idObj !== 'string' || vistas.has(idObj)) continue;
        vistas.add(idObj);
        const img = await objetoPdf(page, idObj);
        const b = img && await imagemPdfParaBlob(img);
        if (b) fotos.push({ arq: b, origem: 'pdf', nome, pagina: i });
      }
    } catch (e) { /* segue só com o texto e a imagem da página */ }
    page.cleanup && page.cleanup();
  }
  return { paginas, fotos, total: doc.numPages };
}
function objetoPdf(page, id) {
  const lugar = id.startsWith('g_') ? page.commonObjs : page.objs;
  return new Promise((res) => {
    const t = setTimeout(() => res(null), 5000);
    const fim = (v) => { clearTimeout(t); res(v || null); };
    try { if (lugar.has(id)) fim(lugar.get(id)); else lugar.get(id, fim); } catch (e) { fim(null); }
  });
}
async function imagemPdfParaBlob(img) {
  const w = img.width, h = img.height;
  // ignora ícones, logos pequenas e faixas decorativas
  if (!w || !h || w < 300 || h < 300 || w * h < 150000 || w / h > 4 || h / w > 4) return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (img.bitmap) ctx.drawImage(img.bitmap, 0, 0);
  else if (img.data) {
    const dados_ = ctx.createImageData(w, h);
    const d = dados_.data, s = img.data;
    if (s.length === w * h * 4) d.set(s);
    else if (s.length === w * h * 3) { for (let a = 0, b = 0; a < s.length; a += 3, b += 4) { d[b] = s[a]; d[b + 1] = s[a + 1]; d[b + 2] = s[a + 2]; d[b + 3] = 255; } }
    else return null;
    ctx.putImageData(dados_, 0, 0);
  } else return null;
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
}

// ----- 3. A IA organizando -----
function iaAndamento(loteId, fontes) {
  let parar = false;
  const inicio = Date.now();
  abrirPainel('Montar com IA', `
    <div class="cartao centro coluna" style="gap:10px;padding:20px 16px">
      <div style="font-size:40px" aria-hidden="true">✨</div>
      <h2>Organizando seu catálogo…</h2>
      <div class="ia-barra"><i id="ia-and-barra" style="width:8%"></i></div>
      <p class="pequeno" id="ia-and-fontes">${fontes ? esc([fontes.fotos ? plural(fontes.fotos, 'foto', 'fotos') : '', fontes.paginas ? plural(fontes.paginas, 'página de PDF', 'páginas de PDF') : '', fontes.prints ? plural(fontes.prints, 'print', 'prints') : '', fontes.texto ? 'lista de preços' : ''].filter(Boolean).join(' · ')) : ''}</p>
    </div>
    <div class="cartao ia-etapas" id="ia-etapas"></div>
    <div class="erro oculto" id="ia-and-erro"></div>
    <p class="dica centro">Leva de 1 a 3 minutos. Você pode fechar esta tela: o cartão na aba Kits mostra quando estiver pronto${avisosLigados() ? ' e chega um aviso no celular' : ''}.</p>
    <button class="btn contorno cheio" id="ia-and-fechar">Continuar usando o app</button>`, (p) => {
    $('#ia-and-fechar', p).onclick = () => { parar = true; fecharPainel(); desenharAba(); };
    const etapas = ['Lendo o material', 'Agrupando as fotos por kit', 'Procurando nomes, preços e sinais', 'Preparando para você conferir'];
    const desenharEtapas = (atual) => {
      const el = $('#ia-etapas', p);
      if (!el) return;
      el.innerHTML = etapas.map((t, i) => `<div class="ia-linha ${i < atual ? 'feita' : i === atual ? 'agora' : ''}">${i < atual ? '✅' : i === atual ? '⏳' : '○'} ${t}</div>`).join('');
    };
    const tique = async () => {
      if (parar || !document.body.contains(p)) return;
      const seg = (Date.now() - inicio) / 1000;
      desenharEtapas(seg < 8 ? 0 : seg < 30 ? 1 : seg < 70 ? 2 : 3);
      const barra = $('#ia-and-barra', p); if (barra) barra.style.width = Math.min(92, 8 + seg * 0.8) + '%';
      let l = null;
      try { l = await dados.iaLote(loteId); } catch (e) { /* tenta de novo */ }
      if (parar || !document.body.contains(p)) return;
      if (l && l.status === 'pronto') {
        await atualizarIA();
        desenharEtapas(4);
        setTimeout(() => { if (!parar && document.body.contains(p)) iaConferir(loteId); }, 500);
        return;
      }
      if (l && l.status === 'erro') {
        await atualizarIA();
        const caixa = $('#ia-and-erro', p);
        caixa.innerHTML = `${esc(l.erro || 'Não deu certo.')}`;
        caixa.classList.remove('oculto');
        $('#ia-and-fechar', p).textContent = 'Tentar de novo';
        $('#ia-and-fechar', p).onclick = () => { parar = true; iaEnviar(); };
        return;
      }
      setTimeout(tique, 4000);
    };
    tique();
  }, () => { parar = true; fecharPainel(); desenharAba(); });
}

// Prints de catálogo: a IA indica onde está a foto de cada kit e o app recorta
// aquele pedaço (a foto do kit em si não é alterada).
// Recorte de print: amplia fotos pequenas (até ~1100px) e devolve um pouco da nitidez (leve, sem exagero)
function melhorarRecorte(img, x, y, w, h) {
  const esc = Math.min(3, Math.max(1, 1100 / Math.max(w, h)));
  const c = document.createElement('canvas');
  c.width = Math.round(w * esc); c.height = Math.round(h * esc);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(img, x, y, w, h, 0, 0, c.width, c.height);
  if (esc > 1.05 && c.width * c.height <= 4e6) {
    try {
      const d = g.getImageData(0, 0, c.width, c.height), o = new Uint8ClampedArray(d.data), W = c.width, H = c.height, a = 0.35;
      for (let yy = 1; yy < H - 1; yy++) for (let xx = 1; xx < W - 1; xx++) {
        const i = (yy * W + xx) * 4;
        for (let ch = 0; ch < 3; ch++) {
          const viz = o[i - 4 + ch] + o[i + 4 + ch] + o[i - W * 4 + ch] + o[i + W * 4 + ch];
          d.data[i + ch] = o[i + ch] + a * (4 * o[i + ch] - viz);
        }
      }
      g.putImageData(d, 0, 0);
    } catch (e) { /* imagem de outro site: fica só ampliada */ }
  }
  return c;
}
async function iaRecortar(lote) {
  let mudou = false;
  for (let i = 0; i < lote.kits.length; i++) {
    const k = lote.kits[i];
    if (k.recortado || k.situacao !== 'conferir' || !Array.isArray(k.recortes) || !k.recortes.length) continue;
    const novas = [];
    for (let j = 0; j < k.recortes.length; j++) {
      const r = k.recortes[j];
      try {
        const img = await carregarImagem(r.url);
        if (!img) continue;
        const W = img.naturalWidth, H = img.naturalHeight, folga = 0.006;
        const x = Math.max(0, (r.x - folga) * W), y = Math.max(0, (r.y - folga) * H);
        const w = Math.min(W - x, (r.w + 2 * folga) * W), h = Math.min(H - y, (r.h + 2 * folga) * H);
        if (w < 60 || h < 60) continue;
        const c = melhorarRecorte(img, x, y, w, h);
        const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.93));
        if (!blob) continue;
        const pasta = (String(r.url).match(/\/ia\/([^/]+)\//) || [])[1] || 'recortes';
        novas.push(await dados.iaEnviarImagem(blob, pasta, `R${i + 1}-${j + 1}-${Date.now().toString(36)}`));
      } catch (e) { /* segue sem esse recorte */ }
    }
    k.fotos = [...novas, ...(k.fotos || [])].slice(0, MAX_FOTOS);
    k.recortado = true;
    mudou = true;
  }
  if (mudou) await dados.iaSalvar(lote.id, lote.kits).catch(() => {});
}

// ----- 4 e 5. Conferir 1 a 1 -----
function numOuNada(v) { return String(v ?? '').trim() === '' ? null : numero(v); }
function iaConferir(loteId, posInicial) {
  let lote = null, lista = [], pos = 0, editando = true, fotoAtual = 0; // tudo já editável, sem "Corrigir"
  abrirPainel('Conferir kits', '<div id="ia-conf" class="coluna"><div class="carregando">Carregando…</div></div>', async (p) => {
    const raiz = $('#ia-conf', p);
    try { lote = await dados.iaLote(loteId); }
    catch (e) { raiz.innerHTML = `<div class="erro">${esc(e.message)}</div>`; return; }
    if (lote.escolher > 0) { iaEscolherKits(lote); return; }
    if (lote.kits.some((k) => !k.recortado && k.situacao === 'conferir' && Array.isArray(k.recortes) && k.recortes.length)) {
      raiz.innerHTML = '<div class="carregando">Separando as fotos dos prints…</div>';
      await iaRecortar(lote);
    }
    lista = lote.kits.map((k, i) => i).filter((i) => ['conferir', 'aprovado', 'descartado'].includes(lote.kits[i].situacao));
    if (!lista.length) { iaResumo(lote); return; }
    pos = posInicial != null ? posInicial : Math.max(0, lista.findIndex((i) => lote.kits[i].situacao === 'conferir'));
    const guardados = lote.kits.filter((k) => k.situacao === 'guardado').length;

    const desenhar = () => {
      const k = lote.kits[lista[pos]];
      const fotos = k.fotos || [];
      if (fotoAtual >= fotos.length) fotoAtual = 0;
      const vars = k.variacoes || [];
      const o = k.origem || {};
      const de = (t) => (t ? `<span class="ia-de">${esc(t)}</span>` : '<span class="ia-de nao">não estava no material</span>');
      const editar = (falta) => editando || falta;
      const pontos = lista.map((i, n) => {
        const s = lote.kits[i].situacao;
        return `<i class="${n === pos ? 'agora' : s === 'aprovado' ? 'ok' : s === 'descartado' ? 'fora' : ''}"></i>`;
      }).join('');
      const campoValor = (nome, rotulo, v, falta) => editar(falta)
        ? `<label class="ia-val ${falta ? 'falta' : ''}"><small>${rotulo}</small><input name="${nome}" inputmode="decimal" value="${v == null ? '' : esc(String(v).replace('.', ','))}" placeholder="${falta ? 'Preencha' : ''}"></label>`
        : `<div class="ia-val"><small>${rotulo}</small><b>${reais(v)}</b></div>`;
      const precoBox = vars.length ? '' : k.consultar ? `
        <div class="ia-preco">
          <p class="ia-preco-t">💰 Preço a consultar</p>
          <p class="ia-trecho">No seu link vai aparecer "Preço a consultar": a cliente reserva a data e você passa o valor pelo WhatsApp.</p>
          <button type="button" class="btn claro mini" id="ia-tira-consultar">Colocar preço</button>
        </div>` : `
        <div class="ia-preco">
          <p class="ia-preco-t">💰 Preço e sinal: confira com atenção</p>
          <div class="grade-2">${campoValor('preco', 'Preço', k.preco, k.preco == null)}${campoValor('sinal', 'Sinal', k.sinal, k.sinal == null)}</div>
          ${k.preco == null ? '<button type="button" class="btn claro mini" id="ia-consultar" style="align-self:flex-start">Deixar a consultar</button>' : ''}
          <p class="ia-trecho">${k.preco == null && k.sinal == null ? 'Não encontrei o preço nem o sinal no seu material. Digite ou deixe a consultar.'
            : k.preco == null ? 'Não encontrei o preço no seu material. Digite para poder aprovar.'
            : k.sinal == null ? 'Não encontrei o valor do sinal no seu material. Digite o sinal para poder aprovar.'
            : `Li ${o.preco ? `em: ${esc(o.preco)}` : 'no seu material'}${o.trecho ? `: “${esc(o.trecho)}”` : ''}`}</p>
        </div>`;
      const opcoes = !vars.length ? '' : `
        <div class="ia-preco">
          <p class="ia-preco-t">💰 Opções do kit: confira preço e sinal de cada uma</p>
          ${vars.map((v, i) => `<div class="ia-opcao" data-v="${i}">
            ${editar(!v.nome) ? `<input class="v-nome" value="${esc(v.nome || '')}" placeholder="Nome da opção" maxlength="60">` : `<b>${esc(v.nome)}</b>`}
            <div class="grade-2">${campoValor('vp' + i, 'Preço', v.preco, v.preco == null)}${campoValor('vs' + i, 'Sinal', v.sinal, v.sinal == null)}</div>
            ${(v.extras || []).length ? `<span class="dica">Peças extras: ${esc(v.extras.join(', '))}</span>` : ''}
          </div>`).join('')}
          <p class="ia-trecho">Li ${o.variacoes ? `em: ${esc(o.variacoes)}` : 'no seu material'}${o.trecho ? `: “${esc(o.trecho)}”` : ''}</p>
        </div>`;
      const cabeTeste = estado.ia && estado.ia.plano === 'teste' ? estado.ia.restante || 0 : null;
      const avisoTeste = pos === 0 && cabeTeste != null && lista.length > cabeTeste
        ? `<div class="ia-trava">🔒 <span>No teste grátis, ${cabeTeste ? `<b>${plural(cabeTeste, 'kit da IA pode', 'kits da IA podem')}</b> ir para o catálogo agora` : 'seus 5 kits da IA já estão no catálogo'}. Pode conferir todos: no fim você escolhe ${cabeTeste ? 'quais publicar' : 'guardar'}, e o resto fica pronto com cadeado até você assinar.</span></div>` : '';
      raiz.innerHTML = `
        <div class="linha-flex entre"><span class="ia-pos">Kit ${pos + 1} de ${lista.length}</span>${k.situacao !== 'conferir' ? `<span class="etiqueta ${k.situacao === 'aprovado' ? 'et-confirmada' : 'et-cancelada'}">${k.situacao === 'aprovado' ? 'Aprovado' : 'Descartado'}</span>` : ''}</div>
        <div class="ia-pontos">${pontos}</div>
        ${avisoTeste}
        ${k.existe ? `<div class="ia-existe">⚠️ Parece que você já tem o <b>${esc(k.existe)}</b> no catálogo. Se for o mesmo kit, toque em <b>Descartar</b>.</div>` : ''}
        ${fotos.length ? `<div class="ia-foto-grande">${fotoCaixa(fotos[fotoAtual], 'Foto do kit')}<span class="ia-foto-q">${fotoAtual + 1} de ${fotos.length} · foto inteira</span></div>
          ${fotos.length > 1 ? `<div class="ia-minis">${fotos.map((f, i) => `<button type="button" class="ia-mini ${i === fotoAtual ? 'on' : ''}" data-f="${i}" aria-label="Ver foto ${i + 1}"><img src="${esc(f)}" alt=""></button>`).join('')}</div>` : ''}
          ${editando ? `<div class="linha-flex" style="gap:8px;flex-wrap:wrap">${fotoAtual > 0 ? '<button type="button" class="btn claro mini" id="ia-principal">Tornar principal</button>' : '<span class="dica">Esta é a foto principal.</span>'}${fotos.length > 1 ? '<button type="button" class="btn perigo mini" id="ia-tirar-foto">Tirar esta foto do kit</button>' : ''}</div>` : ''}`
          : '<div class="ia-sem-foto">Sem foto no material. Depois de publicar, abra o kit em Kits e adicione as fotos.</div>'}
        <label class="ia-campo"><span class="ia-rot">Nome ${de(k.nome ? o.nome || 'seu material' : null)}${o.ligacao && k.nome && fotos.length ? `<span class="ia-de nao">${esc(o.ligacao)}</span>` : ''}</span>
          ${editar(!k.nome) ? `<input name="nome" maxlength="80" value="${esc(k.nome || '')}" placeholder="${k.nome ? '' : 'Preencha o nome do kit'}" class="${k.nome ? '' : 'falta'}">` : `<span class="ia-valor">${esc(k.nome)}</span>`}</label>
        <label class="ia-campo"><span class="ia-rot">Peças ${de((k.pecas || []).length ? o.pecas || 'seu material' : null)}</span>
          ${editando ? `<textarea name="pecas" rows="3" placeholder="Opcional: uma peça por linha">${esc((k.pecas || []).join('\n'))}</textarea>`
            : (k.pecas || []).length ? `<span class="ia-valor">${esc(k.pecas.join(', '))}</span>` : '<span class="ia-valor vazio">Opcional</span>'}</label>
        ${opcoes}${precoBox}
        <p class="ia-falta oculto" id="ia-falta"></p>
        <div class="ia-acoes">
          <button type="button" class="btn ${k.existe ? 'principal' : 'contorno'}" id="ia-descartar">Descartar</button>
          <button type="button" class="btn verde" id="ia-aprovar">✓ Aprovar</button>
        </div>
        ${pos > 0 ? '<button type="button" class="link-btn" id="ia-anterior" style="align-self:center">‹ Voltar para o kit anterior</button>' : ''}`;
      // ligações
      $$('[data-f]', raiz).forEach((b) => (b.onclick = () => { lerCampos(); fotoAtual = Number(b.dataset.f); desenhar(); }));
      const princ = $('#ia-principal', raiz);
      if (princ) princ.onclick = () => { lerCampos(); k.fotos.unshift(k.fotos.splice(fotoAtual, 1)[0]); fotoAtual = 0; desenhar(); };
      const tirar = $('#ia-tirar-foto', raiz);
      if (tirar) tirar.onclick = () => { lerCampos(); k.fotos.splice(fotoAtual, 1); fotoAtual = 0; desenhar(); };
      const cons = $('#ia-consultar', raiz);
      if (cons) cons.onclick = () => { lerCampos(); k.consultar = true; k.preco = 0; k.sinal = 0; desenhar(); };
      const tcons = $('#ia-tira-consultar', raiz);
      if (tcons) tcons.onclick = () => { k.consultar = false; k.preco = null; k.sinal = null; desenhar(); };
      $$('input, textarea', raiz).forEach((el) => el.addEventListener('input', () => { lerCampos(); conferirPronto(); }));
      $('#ia-descartar', raiz).onclick = (e) => decidir(e.currentTarget, 'descartado');
      $('#ia-aprovar', raiz).onclick = (e) => decidir(e.currentTarget, 'aprovado');
      const ant = $('#ia-anterior', raiz);
      if (ant) ant.onclick = () => { lerCampos(); pos--; fotoAtual = 0; desenhar(); $('.painel-fundo').scrollTop = 0; };
      conferirPronto();
    };
    // lê o que a dona digitou
    const lerCampos = () => {
      const k = lote.kits[lista[pos]];
      const v = (n) => { const el = $(`[name="${n}"]`, raiz); return el ? el.value : undefined; };
      if (v('nome') !== undefined) k.nome = v('nome').trim().slice(0, 80);
      if (v('pecas') !== undefined) k.pecas = v('pecas').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 100);
      if (v('preco') !== undefined) k.preco = numOuNada(v('preco'));
      if (v('sinal') !== undefined) k.sinal = numOuNada(v('sinal'));
      (k.variacoes || []).forEach((va, i) => {
        const caixa = $(`.ia-opcao[data-v="${i}"]`, raiz);
        const nm = caixa && $('.v-nome', caixa);
        if (nm) va.nome = nm.value.trim().slice(0, 60);
        if (v('vp' + i) !== undefined) va.preco = numOuNada(v('vp' + i));
        if (v('vs' + i) !== undefined) va.sinal = numOuNada(v('vs' + i));
      });
    };
    const oQueFalta = () => {
      lerCampos();
      const k = lote.kits[lista[pos]];
      const falta = [];
      if (!k.nome) falta.push('o nome');
      const vars = k.variacoes || [];
      if (vars.length) {
        if (vars.some((x) => !x.nome)) falta.push('o nome de cada opção');
        if (vars.some((x) => !(x.preco > 0))) falta.push('o preço de cada opção');
        if (vars.some((x) => x.sinal == null)) falta.push('o sinal de cada opção');
      } else if (!k.consultar) {
        if (!(k.preco > 0)) falta.push('o preço (ou deixe a consultar)');
        if (k.sinal == null) falta.push('o sinal');
      }
      return falta;
    };
    const conferirPronto = () => {
      const falta = oQueFalta();
      const bt = $('#ia-aprovar', raiz), msg = $('#ia-falta', raiz);
      if (!bt) return;
      // tira o vermelho do campo assim que a dona preenche
      $$('.ia-val input, .ia-campo input', raiz).forEach((el) => {
        const caixa = el.closest('.ia-val') || el;
        if (el.dataset.faltou === undefined) el.dataset.faltou = caixa.classList.contains('falta') ? '1' : '';
        if (el.dataset.faltou) caixa.classList.toggle('falta', !el.value.trim());
      });
      bt.disabled = falta.length > 0;
      msg.textContent = falta.length ? `Preencha ${falta.join(', ').replace(/, ([^,]*)$/, ' e $1')} para aprovar.` : '';
      msg.classList.toggle('oculto', !falta.length);
    };
    const decidir = async (botao, situacao) => {
      if (situacao === 'aprovado' && oQueFalta().length) { conferirPronto(); return; }
      lerCampos();
      const k = lote.kits[lista[pos]];
      const antes = k.situacao;
      k.situacao = situacao;
      const ok = await acao(botao, async () => { await dados.iaSalvar(lote.id, lote.kits); return true; });
      if (!ok) { k.situacao = antes; return; }
      fotoAtual = 0;
      const prox = lista.findIndex((i, n) => n > pos && lote.kits[i].situacao === 'conferir');
      const qualquer = lista.findIndex((i) => lote.kits[i].situacao === 'conferir');
      if (prox >= 0) pos = prox;
      else if (qualquer >= 0) pos = qualquer;
      else { atualizarIA().then(redesenharCartaoIA); iaResumo(lote); return; }
      desenhar();
      $('.painel-fundo').scrollTop = 0;
    };
    raiz.addEventListener('input', () => conferirPronto());
    desenhar();
  }, () => { fecharPainel(); atualizarIA().then(() => desenharAba()); });
}

// ----- Teste grátis: a dona escolhe quais kits montar agora -----
function miniaturaGuardada(k) {
  if (k.foto) return `<div class="ia-esc-foto">${fotoCaixa(k.foto, k.nome || '')}</div>`;
  const r = k.recorte;
  if (r && r.url && r.w > 0 && r.h > 0) {
    const tam = `${(100 / r.w).toFixed(2)}% ${(100 / r.h).toFixed(2)}%`;
    const pos = `${r.w >= 1 ? 0 : ((r.x / (1 - r.w)) * 100).toFixed(2)}% ${r.h >= 1 ? 0 : ((r.y / (1 - r.h)) * 100).toFixed(2)}%`;
    return `<div class="ia-esc-foto"><div class="ia-esc-recorte" style="aspect-ratio:${(r.w / r.h).toFixed(3)};background-image:url('${esc(r.url)}');background-size:${tam};background-position:${pos}"></div></div>`;
  }
  return '<div class="ia-esc-foto ia-esc-sem">🎈</div>';
}
function iaEscolherKits(lote) {
  const cabe = Math.min(lote.escolher, 10);
  const publicaveis = estado.ia && estado.ia.plano === 'teste' ? estado.ia.restante || 0 : cabe;
  const opcoes = lote.kits.map((k, i) => ({ k, i })).filter((x) => x.k.situacao === 'guardado');
  const marcados = new Set();
  abrirPainel('Escolha seus kits', `
    <p class="ia-perg" style="margin-top:-4px">A IA encontrou ${plural(opcoes.length, 'kit', 'kits')}!</p>
    <p class="pequeno">No teste grátis a IA prepara até <b>${cabe} kits</b> por vez. Escolha ${cabe === 1 ? 'qual' : 'quais'} você quer${publicaveis ? `: desses, <b>${plural(publicaveis, 'kit pode', 'kits podem')}</b> ir para o catálogo agora` : ''}. O resto fica pronto com cadeado e é liberado quando você assinar.</p>
    <div class="ia-esc-grade">${opcoes.map(({ k, i }) => `<button type="button" class="ia-esc" data-i="${i}">${miniaturaGuardada(k)}<span class="ia-esc-nome">${esc(k.nome || 'Kit sem nome')}</span><span class="ia-esc-ck">✓</span></button>`).join('')}</div>
    <div class="erro oculto" id="esc-erro"></div>
    <div class="ia-barra-fixa"><span id="esc-cont">0 de ${cabe} escolhidos</span><button class="btn principal" id="esc-ok" disabled>Montar estes kits</button></div>`, (p) => {
    const atualizar = () => {
      $('#esc-cont', p).textContent = `${marcados.size} de ${cabe} ${cabe === 1 ? 'escolhido' : 'escolhidos'}`;
      $('#esc-ok', p).disabled = !marcados.size;
      $$('.ia-esc', p).forEach((b) => {
        const on = marcados.has(Number(b.dataset.i));
        b.classList.toggle('on', on);
        b.classList.toggle('cheio', !on && marcados.size >= cabe);
      });
    };
    $$('.ia-esc', p).forEach((b) => (b.onclick = () => {
      const i = Number(b.dataset.i);
      if (marcados.has(i)) marcados.delete(i);
      else if (marcados.size < cabe) marcados.add(i);
      else aviso(`No teste grátis são ${cabe} ${cabe === 1 ? 'kit' : 'kits'}. Desmarque um para trocar.`);
      atualizar();
    }));
    $('#esc-ok', p).onclick = (e) => acao(e.currentTarget, async () => {
      await dados.iaEscolher(lote.id, [...marcados]);
      await atualizarIA();
      iaConferir(lote.id);
    });
    atualizar();
  }, () => { fecharPainel(); atualizarIA().then(() => desenharAba()); });
}

// ----- 6. Resumo e publicar -----
function iaResumo(lote) {
  const kits = lote.kits;
  const ap = kits.filter((k) => k.situacao === 'aprovado');
  const desc = kits.filter((k) => k.situacao === 'descartado').length;
  const guard = kits.filter((k) => k.situacao === 'guardado').length;
  const pub = kits.filter((k) => k.situacao === 'publicado').length;
  const linha = (k) => {
    const vars = k.variacoes || [];
    const preco = vars.length ? `a partir de ${reais(Math.min(...vars.map((v) => Number(v.preco) || 0)))} · ${plural(vars.length, 'opção', 'opções')}` : `${reais(k.preco)} · sinal ${reais(k.sinal)}`;
    const st = { aprovado: ['ok', 'Aprovado'], descartado: ['x', 'Descartado'], publicado: ['ok', 'Já publicado'] }[k.situacao] || ['x', k.situacao];
    return `<div class="ia-rk">${k.fotos && k.fotos[0] ? `<img src="${esc(k.fotos[0])}" alt="">` : '<span class="ia-rk-sem">🎈</span>'}<div><b>${esc(k.nome || 'Sem nome')}</b><small>${k.situacao === 'descartado' ? '—' : preco}</small></div><span class="ia-st ${st[0]}">${st[1]}</span></div>`;
  };
  const pago = estado.ia && estado.ia.plano === 'pago';
  // Teste grátis: só cabem alguns kits da IA no catálogo; a dona escolhe quais
  const cabe = estado.ia && estado.ia.plano === 'teste' ? Math.max(0, estado.ia.restante || 0) : Infinity;
  const escolhe = ap.length > cabe;
  const marcados = new Set(ap.slice(0, cabe === Infinity ? ap.length : cabe));
  abrirPainel('Resumo', `
    <div class="ia-res">
      <div class="ok"><b>${ap.length}</b><small>${ap.length === 1 ? 'aprovado' : 'aprovados'}</small></div>
      <div class="x"><b>${desc}</b><small>${desc === 1 ? 'descartado' : 'descartados'}</small></div>
      <div class="g"><b>${guard}</b><small>${guard === 1 ? 'guardado' : 'guardados'}</small></div>
    </div>
    ${escolhe && cabe > 0 ? `<div class="ia-trava">✨ <span>No teste grátis, <b>${plural(cabe, 'kit da IA pode', 'kits da IA podem')}</b> ir para o catálogo agora. Toque nos aprovados para escolher; os outros ficam prontos com cadeado até você assinar.</span></div>` : ''}
    ${escolhe && !cabe ? `<div class="ia-trava">🔒 <span>Seus 5 kits da IA do teste já estão no catálogo. Os aprovados ficam <b>prontos com cadeado</b> e vão para a loja quando você assinar.</span></div>` : ''}
    ${ap.length + desc + pub + guard ? `<div class="cartao ia-lista">${kits.filter((k) => ['aprovado', 'descartado', 'publicado'].includes(k.situacao)).map((k) => (escolhe && cabe > 0 && k.situacao === 'aprovado' ? `<button type="button" class="ia-rk ia-rk-esc ${marcados.has(k) ? 'on' : ''}" data-ap="${ap.indexOf(k)}">${linha(k).replace(/^<div class="ia-rk">|<\/div>$/g, '')}<span class="ia-rk-ck">✓</span></button>` : linha(k))).join('')}${pago ? '' : kits.filter((k) => k.situacao === 'guardado').map((k) => `<div class="ia-rk"><span class="ia-rk-sem">🔒</span><div><b>${esc(k.nome || 'Kit sem nome')}</b><small>liberado quando você assinar</small></div><span class="ia-st x">Guardado</span></div>`).join('')}</div>` : ''}
    ${guard && !pago ? `<div class="ia-trava">🔒 <span><b>${plural(guard, 'kit guardado', 'kits guardados')}</b> esperando. Assine para a IA montar o resto do seu catálogo (ilimitado).</span></div>` : ''}
    <div class="erro oculto" id="ia-pub-erro"></div>
    ${ap.length && escolhe && !cabe ? `<button class="btn principal cheio" id="ia-guardar">Guardar ${plural(ap.length, 'kit', 'kits')} com cadeado</button>` : ''}
    ${ap.length && !(escolhe && !cabe) ? `<button class="btn principal cheio" id="ia-publicar">Publicar ${plural(escolhe ? marcados.size : ap.length, 'kit', 'kits')} no catálogo</button>
      <p class="dica centro">Depois você edita qualquer kit normalmente em Kits.</p>
      <button class="link-btn" id="ia-rever" style="align-self:center">‹ Rever os kits</button>`
      : ''}
    ${!ap.length ? '<button class="btn contorno cheio" id="ia-fim">Fechar</button>' : ''}
    ${(guard || escolhe) && !pago ? '<button class="btn verde cheio" id="ia-assinar">Assinar e liberar ilimitado</button>' : ''}`, (p) => {
    const fim = $('#ia-fim', p); if (fim) fim.onclick = () => { fecharPainel(); atualizarIA().then(() => desenharAba()); };
    const rever = $('#ia-rever', p); if (rever) rever.onclick = () => iaConferir(lote.id, 0);
    const ass = $('#ia-assinar', p); if (ass) ass.onclick = () => { fecharPainel(); setTimeout(() => popupPlanosTeste('ia_limite'), 50); };
    $$('[data-ap]', p).forEach((b) => (b.onclick = () => {
      const k = ap[Number(b.dataset.ap)];
      if (marcados.has(k)) marcados.delete(k);
      else if (marcados.size < cabe) marcados.add(k);
      else { aviso(`No teste grátis cabem ${plural(cabe, 'kit', 'kits')} agora. Desmarque um para trocar.`); return; }
      b.classList.toggle('on', marcados.has(k));
      const pb = $('#ia-publicar', p);
      if (pb) { pb.textContent = `Publicar ${plural(marcados.size, 'kit', 'kits')} no catálogo`; pb.disabled = !marcados.size; }
    }));
    const guardar = $('#ia-guardar', p);
    if (guardar) guardar.onclick = (e) => acao(e.currentTarget, async () => {
      ap.forEach((k) => { k.situacao = 'guardado'; });
      await dados.iaSalvar(lote.id, lote.kits);
      fecharPainel(); await atualizarIA(); desenharAba();
      aviso('Kits guardados com cadeado. Eles vão para a loja quando você assinar.');
    });
    const btn = $('#ia-publicar', p);
    if (!btn) return;
    btn.onclick = async () => {
      // os aprovados que não couberam no teste ficam prontos com cadeado
      if (escolhe) {
        ap.filter((k) => !marcados.has(k)).forEach((k) => { k.situacao = 'guardado'; });
        for (let i = ap.length - 1; i >= 0; i--) if (!marcados.has(ap[i])) ap.splice(i, 1);
      }
      btn.disabled = true;
      const caixa = $('#ia-pub-erro', p);
      caixa.classList.add('oculto');
      let feitos = 0;
      try {
        for (const k of ap) {
          btn.textContent = `Publicando ${feitos + 1} de ${ap.length}…`;
          const vars = (k.variacoes || []).map((v) => ({ id: v.id || 'v' + Math.random().toString(36).slice(2, 9), nome: v.nome, preco: Number(v.preco) || 0, sinal: Number(v.sinal) || 0, extras: v.extras || [], fotos: [] }));
          const barata = [...vars].sort((a, b) => a.preco - b.preco)[0];
          const fotos = (k.fotos || []).slice(0, MAX_FOTOS);
          await dados.salvarKit({
            nome: k.nome, preco: k.consultar ? 0 : barata ? barata.preco : Number(k.preco) || 0, sinal: k.consultar ? 0 : barata ? barata.sinal : Number(k.sinal) || 0,
            pecas: (k.pecas || []).slice(0, 100), categoria: null, fotos, foto_url: fotos[0] || null, ativo: true, variacoes: vars,
            ...(k.consultar ? { preco_consultar: true } : {}),
          });
          k.situacao = 'publicado';
          feitos++;
          await dados.iaSalvar(lote.id, lote.kits).catch(() => {});
        }
        await recarregar();
        await atualizarIA();
        lojaPronta(feitos, ap.map((k) => k.nome));
      } catch (e) {
        await dados.iaSalvar(lote.id, lote.kits).catch(() => {});
        caixa.textContent = `${feitos ? `${plural(feitos, 'kit foi publicado', 'kits foram publicados')}. ` : ''}${e.message || 'Não deu certo.'} Toque de novo para continuar.`;
        caixa.classList.remove('oculto');
        btn.disabled = false;
        btn.textContent = 'Tentar publicar de novo';
        ap.splice(0, feitos);
      }
    };
  }, () => { fecharPainel(); atualizarIA().then(() => desenharAba()); });
}

// ----- 7. Loja pronta -----
function lojaPronta(publicados, nomes = []) {
  const n = estado.negocio;
  const link = linkPublico(n.slug);
  const novos = new Set(nomes);
  const comFoto = estado.kits.filter((k) => k.ativo && k.foto_url).sort((a, b) => novos.has(b.nome) - novos.has(a.nome)).slice(0, 4);
  const textoZap = `Olá! Agora você pode ver todos os kits da ${n.nome} e reservar a sua data pelo link: ${link}`;
  abrirPainel('Sua loja está no ar!', `
    <div class="ia-festa"><div style="font-size:34px" aria-hidden="true">🎉</div><b>${plural(publicados, 'kit publicado', 'kits publicados')}</b><span>Sua cliente já pode escolher e reservar pelo link.</span></div>
    <div class="ia-loja">
      <div class="ia-loja-topo">${n.logo_url ? `<img class="vitrine-logo" src="${esc(n.logo_url)}" alt="">` : ''}<b>${esc(n.nome)}</b></div>
      ${comFoto.length ? `<div class="ia-loja-grade">${comFoto.map((k) => `<div>${fotoCaixa(k.foto_url, k.nome)}<small>${esc(k.nome)}</small></div>`).join('')}</div>` : ''}
    </div>
    <a class="btn contorno cheio" href="${esc(linkDona())}">👀 Ver como a cliente vê</a>
    <div class="ia-link"><span>🔗 ${esc(link.replace(/^https?:\/\//, ''))}</span><button type="button" class="btn claro mini" id="lp-copiar">Copiar</button></div>
    <button class="btn insta cheio" id="lp-bio">📸 Colocar na bio do Instagram</button>
    <div class="grade-2">
      <button class="btn contorno" id="lp-stories">⭐ Postar nos stories</button>
      <a class="btn verde" href="${esc('https://wa.me/?text=' + encodeURIComponent(textoZap))}" target="_blank" rel="noopener">${ICONE.zap} WhatsApp</a>
    </div>
    <button class="link-btn" id="lp-fim" style="align-self:center">Fechar</button>`, (p) => {
    $('#lp-copiar', p).onclick = () => copiarMeuLink();
    $('#lp-bio', p).onclick = () => popupBio(() => lojaPronta(publicados, nomes));
    $('#lp-stories', p).onclick = () => storiesLoja(() => lojaPronta(publicados, nomes));
    $('#lp-fim', p).onclick = () => { fecharPainel(); irPara('kits'); };
  }, () => { fecharPainel(); irPara('kits'); });
}
// ----- 8. Link na bio do Instagram (o Instagram não deixa nenhum app mudar a bio sozinho) -----
async function popupBio(voltar) {
  const n = estado.negocio;
  const link = linkPublico(n.slug);
  let copiou = false;
  try { await navigator.clipboard.writeText(link); copiou = true; dados.marcarLinkCopiado().catch(() => {}); } catch (e) { /* mostra o link para copiar */ }
  const passo = (num, t) => `<div class="passo-inst"><b>${num}</b><span>${t}</span></div>`;
  abrirPainel('Link na bio do Instagram', `
    ${copiou ? '<div class="ia-copiado">✓ Link copiado! Agora é só colar.</div>' : `<div class="cartao" style="background:var(--lilas);word-break:break-all;font-weight:800;font-size:14px">${esc(link)}</div><p class="pequeno">Segure no link acima e copie.</p>`}
    ${passo(1, 'No Instagram, toque em <b>Editar perfil</b>')}
    ${passo(2, 'Toque em <b>Links</b> e depois em <b>Adicionar link externo</b>')}
    ${passo(3, 'Segure no campo, toque em <b>Colar</b> e depois em <b>✓ Concluir</b>')}
    <a class="btn insta cheio" href="${esc(n.instagram ? `https://www.instagram.com/${encodeURIComponent(n.instagram)}/` : 'https://www.instagram.com/')}" target="_blank" rel="noopener">Abrir o Instagram</a>
    <button class="link-btn" id="bio-feito" style="align-self:center">Já coloquei: <b style="color:var(--verde)">marcar como feito ✓</b></button>`, (p) => {
    $('#bio-feito', p).onclick = async () => { await dados.marcarLinkBio().catch(() => {}); aviso('Marcado! Agora suas clientes acham sua loja pela bio. 💛'); if (voltar) voltar(); else fecharPainel(); };
  }, voltar);
}
// ----- 9. Stories: o app monta a imagem com a logo e os kits -----
function carregarImagem(url) {
  return new Promise((res) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });
}
async function gerarImagemStories() {
  const n = estado.negocio;
  const W = 1080, H = 1920;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W * 0.6, H);
  g.addColorStop(0, '#5B3FA6'); g.addColorStop(1, '#E4505C');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  try { await document.fonts.ready; } catch (e) { /* segue */ }
  const redondo = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  const dentro = (img, x, y, w, h) => { const e = Math.min(w / img.width, h / img.height); const iw = img.width * e, ih = img.height * e; ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); };
  let y = 150;
  if (n.logo_url) {
    const logo = await carregarImagem(n.logo_url);
    if (logo) {
      ctx.save(); ctx.beginPath(); ctx.arc(W / 2, y + 110, 110, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.clip();
      dentro(logo, W / 2 - 95, y + 15, 190, 190); ctx.restore();
      y += 250;
    }
  }
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.font = "700 76px Fredoka, 'Nunito Sans', sans-serif";
  ctx.fillText(n.nome.slice(0, 26), W / 2, y + 70, W - 120);
  ctx.font = "600 46px 'Nunito Sans', sans-serif";
  ctx.fillText('Reserve seu kit pelo link 🎈', W / 2, y + 150, W - 120);
  y += 210;
  const recentes = [...estado.kits].sort((a, b) => String(b.criado_em || '').localeCompare(String(a.criado_em || '')));
  const kits = recentes.filter((k) => k.ativo && k.foto_url).slice(0, 4);
  const lado = 440, gap = 30, x0 = (W - lado * 2 - gap) / 2;
  for (let i = 0; i < kits.length; i++) {
    const x = x0 + (i % 2) * (lado + gap), yy = y + Math.floor(i / 2) * (lado + gap);
    ctx.fillStyle = 'rgba(255,255,255,.95)'; redondo(x, yy, lado, lado, 34); ctx.fill();
    const img = await carregarImagem(kits[i].foto_url);
    if (img) { ctx.save(); redondo(x + 14, yy + 14, lado - 28, lado - 28, 24); ctx.clip(); dentro(img, x + 14, yy + 14, lado - 28, lado - 28); ctx.restore(); }
  }
  const ySt = Math.max(y + Math.ceil(kits.length / 2) * (lado + gap) + 40, H - 420);
  ctx.fillStyle = '#fff'; redondo(W / 2 - 330, ySt, 660, 120, 28); ctx.fill();
  ctx.fillStyle = '#2A1B3D'; ctx.font = "700 44px 'Nunito Sans', sans-serif";
  ctx.fillText('🔗 cole o adesivo Link aqui', W / 2, ySt + 76);
  ctx.fillStyle = '#fff'; ctx.font = "600 36px 'Nunito Sans', sans-serif";
  ctx.fillText(linkPublico(n.slug).replace(/^https?:\/\//, ''), W / 2, ySt + 200, W - 120);
  return new Promise((res) => { try { c.toBlob((b) => res(b), 'image/jpeg', 0.9); } catch (e) { res(null); } });
}
async function storiesLoja(voltar) {
  const link = linkPublico(estado.negocio.slug);
  abrirPainel('Divulgar nos stories', '<div id="st-raiz" class="coluna"><div class="carregando">Montando a imagem…</div></div>', async (p) => {
    let blob = null;
    try { blob = await gerarImagemStories(); } catch (e) { blob = null; }
    let copiou = false;
    try { await navigator.clipboard.writeText(link); copiou = true; } catch (e) { /* segue */ }
    const raiz = $('#st-raiz', p);
    if (!raiz) return;
    if (!blob) { raiz.innerHTML = '<div class="erro">Não consegui montar a imagem agora. Tente de novo.</div>'; return; }
    const arquivo = new File([blob], 'minha-loja.jpg', { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    const podeCompartilhar = !!(navigator.canShare && navigator.canShare({ files: [arquivo] }));
    raiz.innerHTML = `
      <img class="st-previa" src="${esc(url)}" alt="Imagem para os stories">
      ${copiou ? '<div class="ia-copiado">✓ Link copiado para o adesivo</div>' : `<div class="cartao" style="background:var(--lilas);word-break:break-all;font-weight:800;font-size:14px">${esc(link)}</div>`}
      ${podeCompartilhar ? '<button class="btn insta cheio" id="st-comp">Compartilhar no Instagram</button>' : `<a class="btn insta cheio" href="${esc(url)}" download="minha-loja.jpg">Baixar a imagem</a>`}
      <p class="dica centro">No story, toque no ícone de adesivo → <b>Link</b> → cole o link.</p>`;
    const comp = $('#st-comp', raiz);
    if (comp) comp.onclick = () => navigator.share({ files: [arquivo] }).catch(() => {});
  }, voltar);
}

// Foto inteira dentro de um quadro quadrado (sem cortar), com fundo desfocado.
function fotoCaixa(url, alt = '', lazy = false) {
  const u = String(url || '').replace(/["'()\\]/g, (c) => encodeURIComponent(c));
  return `<span class="foto-caixa" style="--fundo-foto:url('${u}')"><img src="${esc(url)}" alt="${esc(alt)}"${lazy ? ' loading="lazy"' : ''}></span>`;
}
// ---------------------------------------------------------------------
// Ajuste da foto antes de enviar: a dona arrasta e aproxima a foto dentro
// de um quadrado e vê exatamente o que vai aparecer. Pode também usar a
// foto inteira, sem recorte.
// Devolve: a foto recortada (quadrada), o arquivo original (foto inteira)
// ou null (cancelou).
// ---------------------------------------------------------------------
function recortarFoto(arquivo, posicao, opcoes = {}) {
  const logo = !!opcoes.logo;
  return new Promise((resolver) => {
    const url = URL.createObjectURL(arquivo);
    const fundo = document.createElement('div');
    fundo.className = 'recorte-fundo';
    fundo.innerHTML = `
      <div class="recorte" role="dialog" aria-modal="true" aria-label="Ajustar foto">
        <h2 class="centro">${logo ? 'Ajuste sua logo' : 'Ajuste a foto'}${posicao ? ` <span class="pequeno">(${posicao})</span>` : ''}</h2>
        <p class="centro pequeno">${logo
          ? 'A logo já começa inteira dentro do círculo. Aumente ou diminua com a barrinha (ou com dois dedos) e arraste para centralizar.'
          : 'Arraste para posicionar e aproxime com dois dedos ou com a barrinha. O que estiver no quadrado é o que vai aparecer.'}</p>
        <div class="recorte-area ${logo ? 'logo' : ''}"><img alt="Imagem para ajustar" draggable="false"><span class="recorte-grade" aria-hidden="true"></span></div>
        <label class="recorte-zoom"><span aria-hidden="true">－</span><input type="range" min="${logo ? '0.4' : '1'}" max="4" step="0.01" value="1" aria-label="Aumentar ou diminuir"><span aria-hidden="true">＋</span></label>
        <button class="btn principal cheio" type="button" data-r="ok">${logo ? 'Usar esta logo' : 'Usar este recorte'}</button>
        ${logo ? '' : '<button class="btn contorno cheio" type="button" data-r="inteira">Usar foto inteira</button>'}
        <button class="link-btn" type="button" data-r="cancelar" style="align-self:center">Cancelar</button>
      </div>`;
    document.body.appendChild(fundo);
    const area = $('.recorte-area', fundo);
    const img = $('img', fundo);
    const zoom = $('input[type=range]', fundo);
    let nw = 0, nh = 0, base = 1, escala = 1, x = 0, y = 0;
    const lado = () => area.clientWidth;
    const limitar = () => {
      const L = lado(), w = nw * escala, h = nh * escala;
      x = Math.min(Math.max(0, L - w), Math.max(Math.min(0, L - w), x));
      y = Math.min(Math.max(0, L - h), Math.max(Math.min(0, L - h), y));
    };
    const aplicar = () => { limitar(); img.style.transform = `translate(${x}px, ${y}px) scale(${escala})`; };
    const mudarZoom = (novo, cx, cy) => {
      const L = lado();
      const z = Math.min(4, Math.max(logo ? 0.4 : 1, novo));
      const nova = base * z;
      const px = cx ?? L / 2, py = cy ?? L / 2;
      x = px - (px - x) * (nova / escala);
      y = py - (py - y) * (nova / escala);
      escala = nova; zoom.value = String(z); aplicar();
    };
    img.onload = () => {
      nw = img.naturalWidth; nh = img.naturalHeight;
      const L = lado();
      // Foto preenche o quadrado; logo começa inteira dentro do círculo (com uma folga).
      base = logo ? (0.96 * L) / Math.hypot(nw, nh) : Math.max(L / nw, L / nh);
      escala = base;
      x = (L - nw * escala) / 2; y = (L - nh * escala) / 2;
      img.style.width = nw + 'px'; img.style.height = nh + 'px';
      aplicar();
    };
    img.onerror = () => { fechar(null); aviso('Esse arquivo não parece uma foto.'); };
    img.src = url;
    zoom.oninput = () => mudarZoom(Number(zoom.value));

    // Arrastar e pinçar (mouse e dedo)
    const toques = new Map();
    let distIni = 0, zoomIni = 1;
    area.addEventListener('pointerdown', (e) => {
      area.setPointerCapture(e.pointerId);
      toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (toques.size === 2) {
        const [a, b] = [...toques.values()];
        distIni = Math.hypot(a.x - b.x, a.y - b.y); zoomIni = escala / base;
      }
    });
    area.addEventListener('pointermove', (e) => {
      if (!toques.has(e.pointerId)) return;
      const ant = toques.get(e.pointerId);
      toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (toques.size === 1) {
        x += e.clientX - ant.x; y += e.clientY - ant.y; aplicar();
      } else if (toques.size === 2 && distIni) {
        const [a, b] = [...toques.values()];
        const r = area.getBoundingClientRect();
        mudarZoom(zoomIni * (Math.hypot(a.x - b.x, a.y - b.y) / distIni), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      }
    });
    const soltar = (e) => { toques.delete(e.pointerId); if (toques.size < 2) distIni = 0; };
    area.addEventListener('pointerup', soltar);
    area.addEventListener('pointercancel', soltar);
    area.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = area.getBoundingClientRect();
      mudarZoom(escala / base * (e.deltaY < 0 ? 1.1 : 0.9), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    function fechar(resultado) {
      fecharRecorteAberto = null;
      URL.revokeObjectURL(url);
      fundo.remove();
      resolver(resultado);
    }
    fecharRecorteAberto = () => fechar(null);
    $('[data-r="cancelar"]', fundo).onclick = () => fechar(null);
    const inteira = $('[data-r="inteira"]', fundo);
    if (inteira) inteira.onclick = () => fechar(arquivo);
    $('[data-r="ok"]', fundo).onclick = () => {
      if (logo) {
        // Fundo branco (igual ao círculo do link) e a logo do tamanho que ela escolheu, sem cortes.
        const L = lado(), saida = 500, k = saida / L;
        const c = document.createElement('canvas');
        c.width = saida; c.height = saida;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, saida, saida);
        ctx.drawImage(img, x * k, y * k, nw * escala * k, nh * escala * k);
        c.toBlob((b) => fechar(b || arquivo), 'image/jpeg', 0.92);
        return;
      }
      const L = lado();
      const sx = -x / escala, sy = -y / escala, sl = L / escala;
      const saida = Math.round(Math.min(1200, sl));
      const c = document.createElement('canvas');
      c.width = saida; c.height = saida;
      c.getContext('2d').drawImage(img, sx, sy, sl, sl, 0, 0, saida, saida);
      c.toBlob((b) => fechar(b || arquivo), 'image/jpeg', 0.9);
    };
  });
}

const MAX_FOTOS = 30;
const CATEGORIAS_PADRAO = ['Menino', 'Menina', 'Unissex', 'Chá revelação', 'Chá de bebê', 'Batizado', 'Adulto', 'Casamento', 'Formatura', 'Datas comemorativas'];
function opcoesCategoria(atual) {
  const proprias = estado.kits.map((x) => x.categoria).filter(Boolean);
  const todas = [...new Set([...CATEGORIAS_PADRAO, ...proprias, ...(atual ? [atual] : [])])];
  const extras = todas.filter((c) => !CATEGORIAS_PADRAO.includes(c)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return [...CATEGORIAS_PADRAO, ...extras];
}
function fotosDoKit(k) {
  if (Array.isArray(k.fotos) && k.fotos.length) return [...k.fotos];
  return k.foto_url ? [k.foto_url] : [];
}

// ---------------------------------------------------------------------
// Rascunho: o que a dona está preenchendo fica guardado no aparelho.
// Se der erro, cair a internet, a sessão vencer ou o app fechar, ela recupera.
// ---------------------------------------------------------------------
function chaveRascunho(tipo, id) { return `apm-rasc-${(estado.negocio && estado.negocio.id) || 'x'}-${tipo}-${id || 'novo'}`; }
function lerRascunho(ch) {
  try { const r = JSON.parse(localStorage.getItem(ch) || 'null'); if (r && Date.now() - r.t < 14 * 864e5) return r.d; } catch (e) { /* sem storage */ }
  return null;
}
function gravarRascunho(ch, dadosR) { try { localStorage.setItem(ch, JSON.stringify({ t: Date.now(), d: dadosR })); } catch (e) { /* cheio: segue */ } }
function apagarRascunho(ch) { try { localStorage.removeItem(ch); } catch (e) { /* segue */ } }
function faixaRascunho(ch) {
  return lerRascunho(ch) ? `<div class="ag-rasc" id="rasc-faixa"><span>📝 Você tinha começado a preencher e não salvou.</span><div><button type="button" class="btn principal mini" id="rasc-voltar">Recuperar</button><button type="button" class="link-btn" id="rasc-descartar">Descartar</button></div></div>` : '';
}
function ligarFaixaRascunho(p, ch, recuperar) {
  const v = $('#rasc-voltar', p), d = $('#rasc-descartar', p);
  if (v) v.onclick = () => { const r = lerRascunho(ch); if (r) recuperar(r); };
  if (d) d.onclick = () => { apagarRascunho(ch); const f = $('#rasc-faixa', p); if (f) f.remove(); };
}

function formKit(kit, rascunho) {
  const k0 = kit || { nome: '', preco: '', sinal: '', pecas: [], foto_url: null, fotos: [], ativo: true, variacoes: [], quantidade: 1, temas: [], estruturas: [], preco_consultar: false };
  const k = rascunho ? { ...k0, ...rascunho } : k0;
  const chRasc = chaveRascunho('kit', kit && kit.id);
  let fotos = fotosDoKit(k);
  let temas = (k.temas || []).map((t) => ({ ...t }));
  let enviandoTemas = 0;
  let vars = variacoesDe(k).map((v) => ({ ...v, extras: [...(v.extras || [])], fotos: [...(v.fotos || [])] }));
  let enviando = 0;
  const so = !podeEditar();
  abrirPainel(kit ? 'Editar kit' : 'Novo kit', `
    <form class="coluna" novalidate>
      ${so || rascunho ? '' : faixaRascunho(chRasc)}
      <div id="foto-area"></div>
      ${so ? '' : `<label class="btn contorno cheio" style="cursor:pointer" id="add-foto">Adicionar fotos<input type="file" accept="image/*" name="arquivo" multiple class="oculto"></label>
      <span class="dica" style="margin-top:-6px">Pode colocar várias fotos (até ${MAX_FOTOS}). A primeira é a foto principal: toque numa miniatura para torná-la principal.</span>`}
      <label class="campo">Nome do kit<input name="nome" maxlength="80" value="${esc(k.nome)}" placeholder="Ex.: Safári" required></label>
      <label class="campo">Categoria (opcional)
        <select name="categoria">
          <option value="">Sem categoria</option>
          ${opcoesCategoria(k.categoria).map((c) => `<option value="${esc(c)}" ${c === k.categoria ? 'selected' : ''}>${esc(c)}</option>`).join('')}
          <option value="__nova">➕ Criar nova categoria…</option>
        </select>
      </label>
      <label class="campo oculto" id="campo-nova-cat">Nome da nova categoria
        <input name="nova_categoria" maxlength="40" placeholder="Ex.: Super-heróis" autocomplete="off">
      </label>
      <span class="dica" style="margin-top:-6px">No seu link de reservas, a cliente filtra os kits por categoria.</span>
      <div class="grade-2 ${k.preco_consultar ? 'oculto' : ''}" id="precos-kit">
        <label class="campo">Preço (R$)<input name="preco" inputmode="decimal" value="${esc(k.preco === '' ? '' : String(k.preco).replace('.', ','))}" placeholder="350"></label>
        <label class="campo">Sinal (R$)<input name="sinal" inputmode="decimal" value="${esc(k.sinal === '' ? '' : String(k.sinal).replace('.', ','))}" placeholder="100"></label>
      </div>
      <label class="check ${k.preco_consultar ? 'marcado' : ''}" style="margin-top:-4px"><input type="checkbox" name="consultar" ${k.preco_consultar ? 'checked' : ''} ${so ? 'disabled' : ''}> Preço a consultar</label>
      <span class="dica" style="margin-top:-8px">A cliente reserva a data e você passa o valor pelo WhatsApp.</span>
      <div class="cartao ag-kit-qtd linha-flex entre" style="gap:10px;align-items:center;padding:10px 14px">
        <span><b>Quantos deste kit você tem?</b><br><small class="dica">Comprou mais um? Aumente aqui.</small></span>
        ${contador('kq', Math.max(1, Number(k.quantidade) || 1), 1, 50)}
      </div>
      <div class="campo">
        <label class="check ${temas.length ? 'marcado' : ''}"><input type="checkbox" name="tem_temas" ${temas.length ? 'checked' : ''} ${so ? 'disabled' : ''}> Este kit tem vários temas</label>
        <div id="area-temas" class="cartao coluna ${temas.length ? '' : 'oculto'}" style="padding:10px 12px;gap:8px"></div>
      </div>
      ${(estado.estruturas || []).length ? `<div class="campo">Usa quais peças compartilhadas?
        <div class="ag-sug">${estado.estruturas.map((e) => `<label class="check ${(k.estruturas || []).some((x) => x.id === e.id) ? 'marcado' : ''}" style="flex:0 0 auto"><input type="checkbox" data-estr="${esc(e.id)}" ${(k.estruturas || []).some((x) => x.id === e.id) ? 'checked' : ''} ${so ? 'disabled' : ''}> ${esc(e.nome)}</label>`).join('')}</div></div>` : ''}
      <div class="campo">Peças do kit
        <div class="lista-pecas" id="lista-pecas"></div>
        ${so ? '' : '<button type="button" class="btn claro cheio" id="add-peca">＋ Adicionar mais uma peça</button>'}
        <span class="dica">Essa lista vira o checklist de cada retirada e devolução.</span>
      </div>
      <div class="campo variacoes-kit">
        <label class="check ${vars.length ? 'marcado' : ''}"><input type="checkbox" name="tem_var" ${vars.length ? 'checked' : ''} ${so ? 'disabled' : ''}> Este kit tem variações (opções com preço diferente)</label>
        <span class="dica">Ex.: básico, com escadinha, com cômoda. A agenda continua sendo uma só: reservou qualquer opção, o kit fica ocupado na data.</span>
        <div id="lista-var" class="coluna"></div>
        ${so ? '' : '<button type="button" class="btn claro cheio oculto" id="add-var">＋ Adicionar variação</button>'}
      </div>
      <label class="check ${k.ativo ? 'marcado' : ''}"><input type="checkbox" name="ativo" ${k.ativo ? 'checked' : ''}> Mostrar no link de reservas</label>
      <div class="erro oculto" id="erro-kit"></div>
      ${so ? '' : `<button class="btn principal cheio" type="submit">Salvar kit</button>`}
      ${kit && !so ? `<button class="btn contorno cheio" type="button" id="duplicar-kit">Duplicar kit</button><button class="btn perigo cheio" type="button" id="apagar-kit">Apagar kit</button>` : ''}
    </form>`, (p) => {
    const form = $('form', p);
    const lerQtd = ligarContador(p, 'kq');
    // ----- Preço a consultar -----
    form.consultar.onchange = () => { form.consultar.closest('.check').classList.toggle('marcado', form.consultar.checked); $('#precos-kit', p).classList.toggle('oculto', form.consultar.checked); };
    $$('[data-estr]', p).forEach((c) => (c.onchange = () => c.closest('.check').classList.toggle('marcado', c.checked)));
    // ----- Temas do kit (artes com foto; cada uma sai 1 vez por dia) -----
    const areaTemas = $('#area-temas', p);
    const lerTemas = () => { $$('[data-tn]', areaTemas).forEach((i) => { const t = temas[Number(i.dataset.tn)]; if (t) t.nome = i.value.trim().slice(0, 60); }); };
    const desenharTemas = () => {
      areaTemas.innerHTML = `${temas.map((t, i) => `<div class="ag-tema">${t.foto ? `<img src="${esc(t.foto)}" alt="">` : '<span class="ag-tema-sem">🎨</span>'}
          <input data-tn="${i}" value="${esc(t.nome || '')}" maxlength="60" placeholder="Nome do tema (ex.: Sonic)" ${so ? 'disabled' : ''}>
          ${so ? '' : `<button type="button" class="mini-tirar" data-tt="${i}" aria-label="Tirar tema">×</button>`}</div>`).join('')}
        ${Array.from({ length: enviandoTemas }, () => '<div class="ag-tema"><span class="ag-tema-sem">…</span><span class="dica">Enviando foto…</span></div>').join('')}
        ${so ? '' : `<label class="btn claro mini" style="cursor:pointer;align-self:flex-start">＋ Adicionar temas (fotos)<input type="file" accept="image/*" multiple class="oculto" id="in-temas"></label>
        <button type="button" class="link-btn" id="tema-sem-foto" style="align-self:flex-start">＋ Tema sem foto</button>`}
        <span class="dica">A cliente escolhe o tema no link. Cada tema sai 1 vez por dia.</span>`;
      $$('[data-tt]', areaTemas).forEach((b) => (b.onclick = () => { lerTemas(); temas.splice(Number(b.dataset.tt), 1); desenharTemas(); }));
      const sf = $('#tema-sem-foto', areaTemas);
      if (sf) sf.onclick = () => { lerTemas(); temas.push({ id: 't' + Math.random().toString(36).slice(2, 9), nome: '', foto: null }); desenharTemas(); const ult = $$('[data-tn]', areaTemas).pop(); if (ult) ult.focus(); };
      const inp = $('#in-temas', areaTemas);
      if (inp) inp.onchange = async () => {
        lerTemas();
        const arqs = [...inp.files].slice(0, 200 - temas.length); inp.value = '';
        for (const a of arqs) {
          enviandoTemas++; desenharTemas();
          try { temas.push({ id: 't' + Math.random().toString(36).slice(2, 9), nome: a.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').slice(0, 60), foto: await dados.enviarFoto(a) }); }
          catch (e) { aviso(e.message); }
          finally { enviandoTemas--; lerTemas(); desenharTemas(); }
        }
      };
    };
    desenharTemas();
    form.tem_temas.onchange = () => {
      form.tem_temas.closest('.check').classList.toggle('marcado', form.tem_temas.checked);
      areaTemas.classList.toggle('oculto', !form.tem_temas.checked);
    };
    const dup = $('#duplicar-kit', p);
    if (dup) dup.onclick = () => acao(dup, async () => {
      const { id, criado_em, negocio_id, ...resto } = kit;
      await dados.salvarKit({ ...resto, nome: (kit.nome + ' (cópia)').slice(0, 80), temas: (kit.temas || []).map((t) => ({ ...t })) });
      await recarregar();
      const novo = estado.kits.filter((x) => x.nome === (kit.nome + ' (cópia)').slice(0, 80)).pop();
      aviso('Kit duplicado! Agora é só ajustar.');
      if (novo) formKit(novo); else fecharPainel();
    });
    const area = $('#foto-area', p);
    const desenharFotos = () => {
      const principal = fotos[0]
        ? fotoCaixa(fotos[0], 'Foto principal do kit')
        : `<div class="foto-kit foto-vazia">${enviando ? 'Enviando foto…' : 'Sem foto'}</div>`;
      const minis = fotos.map((f, i) => `
        <div class="mini-foto ${i === 0 ? 'principal' : ''}">
          <button type="button" class="mini-img" data-principal="${i}" aria-label="Tornar foto ${i + 1} a principal"><img src="${esc(f)}" alt=""></button>
          ${i === 0 ? '<span class="mini-tag">Principal</span>' : ''}
          ${so ? '' : `<button type="button" class="mini-tirar" data-tirar="${i}" aria-label="Tirar foto ${i + 1}">×</button>`}
        </div>`).join('');
      const carregando = Array.from({ length: enviando }, () => '<div class="mini-foto carregando-foto">…</div>').join('');
      area.innerHTML = `${principal}${fotos[0] && !so ? '<button type="button" class="btn claro mini" id="ajustar-foto" style="margin-top:6px">✂️ Ajustar esta foto (zoom e posição)</button>' : ''}${fotos.length + enviando > 0 ? `<div class="minis">${minis}${carregando}</div>` : ''}`;
      const aj = $('#ajustar-foto', area);
      if (aj) aj.onclick = () => acao(aj, async () => {
        let blob;
        try { const r = await fetch(fotos[0], { cache: 'no-store' }); if (!r.ok) throw new Error(); blob = await r.blob(); }
        catch (e) { aviso('Não consegui abrir esta foto para ajustar. Tente colocar ela de novo.'); return; }
        const pronta = await recortarFoto(blob, '');
        if (!pronta) return;
        enviando++; desenharFotos();
        try { fotos[0] = await dados.enviarFoto(pronta); } catch (e) { aviso(e.message); } finally { enviando--; desenharFotos(); }
      });
      if (typeof desenharVars === 'function') desenharVars();
      const add = $('#add-foto', p);
      if (add) {
        const cheio = fotos.length + enviando >= MAX_FOTOS;
        add.classList.toggle('oculto', cheio);
        add.firstChild.textContent = fotos.length ? `Adicionar fotos (${fotos.length}/${MAX_FOTOS})` : 'Adicionar fotos';
      }
      if (so) return;
      $$('[data-principal]', area).forEach((b) => (b.onclick = () => {
        const i = Number(b.dataset.principal);
        if (i > 0) { fotos.unshift(fotos.splice(i, 1)[0]); desenharFotos(); }
      }));
      $$('[data-tirar]', area).forEach((b) => (b.onclick = () => {
        fotos.splice(Number(b.dataset.tirar), 1); desenharFotos();
      }));
    };
    // ----- Variações -----
    const listaVar = $('#lista-var', p);
    const lerVars = () => {
      $$('.var-kit', listaVar).forEach((el, i) => {
        if (!vars[i]) return;
        vars[i].nome = $('.v-nome', el).value.trim().slice(0, 60);
        vars[i].preco = numero($('.v-preco', el).value);
        vars[i].sinal = numero($('.v-sinal', el).value);
        vars[i].extras = $('.v-extras', el).value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 30);
      });
    };
    function desenharVars() {
      if (!listaVar) return;
      const ligado = form.tem_var && form.tem_var.checked;
      $('#precos-kit', p).classList.toggle('oculto', ligado);
      const addV = $('#add-var', p);
      if (addV) addV.classList.toggle('oculto', !ligado || vars.length >= 10);
      if (!ligado) { listaVar.innerHTML = ''; return; }
      listaVar.innerHTML = vars.map((v, i) => `
        <div class="var-kit cartao coluna" data-v="${i}">
          <div class="linha-flex entre"><b>Opção ${i + 1}</b>${so ? '' : `<button type="button" class="link-btn v-tirar" data-vt="${i}">Tirar</button>`}</div>
          <label class="campo">Nome da opção<input class="v-nome" maxlength="60" value="${esc(v.nome || '')}" placeholder="Ex.: Com cômoda" ${so ? 'disabled' : ''}></label>
          <div class="grade-2">
            <label class="campo">Preço (R$)<input class="v-preco" inputmode="decimal" value="${esc(v.preco === '' || v.preco == null ? '' : String(v.preco).replace('.', ','))}" placeholder="240" ${so ? 'disabled' : ''}></label>
            <label class="campo">Sinal (R$)<input class="v-sinal" inputmode="decimal" value="${esc(v.sinal === '' || v.sinal == null ? '' : String(v.sinal).replace('.', ','))}" placeholder="80" ${so ? 'disabled' : ''}></label>
          </div>
          <label class="campo">Peças extras desta opção (uma por linha, opcional)<textarea class="v-extras" rows="2" maxlength="1500" placeholder="Ex.: Cômoda branca 3 gavetas" ${so ? 'disabled' : ''}>${esc((v.extras || []).join('\n'))}</textarea></label>
          <div class="campo">Foto desta opção ${fotos.length ? '<span class="dica">(toque para escolher; sem escolha, aparecem as fotos do kit)</span>' : ''}
            ${fotos.length ? `<div class="v-fotos">${fotos.map((f) => `<button type="button" class="v-foto ${(v.fotos || []).includes(f) ? 'on' : ''}" data-vf="${esc(f)}" ${so ? 'disabled' : ''}><img src="${esc(f)}" alt=""></button>`).join('')}</div>` : '<span class="dica">Adicione fotos no topo para escolher a foto de cada opção.</span>'}
          </div>
        </div>`).join('');
      $$('.v-tirar', listaVar).forEach((b) => (b.onclick = () => { lerVars(); vars.splice(Number(b.dataset.vt), 1); if (!vars.length) { form.tem_var.checked = false; form.tem_var.closest('.check').classList.remove('marcado'); } desenharVars(); }));
      $$('.v-foto', listaVar).forEach((b) => (b.onclick = () => {
        lerVars();
        const v = vars[Number(b.closest('.var-kit').dataset.v)];
        const f = b.dataset.vf;
        v.fotos = v.fotos.includes(f) ? v.fotos.filter((x) => x !== f) : [...v.fotos, f];
        desenharVars();
      }));
    }
    const novaVar = () => ({ id: 'v' + Math.random().toString(36).slice(2, 9), nome: '', preco: '', sinal: '', extras: [], fotos: [] });
    if (form.tem_var) form.tem_var.onchange = () => {
      form.tem_var.closest('.check').classList.toggle('marcado', form.tem_var.checked);
      if (form.tem_var.checked && !vars.length) {
        const base = { ...novaVar(), nome: 'Básico', preco: form.preco.value ? numero(form.preco.value) : '', sinal: form.sinal.value ? numero(form.sinal.value) : '' };
        vars = [base, novaVar()];
      }
      desenharVars();
    };
    const addVar = $('#add-var', p);
    if (addVar) addVar.onclick = () => { lerVars(); if (vars.length < 10) vars.push(novaVar()); desenharVars(); const ult = $$('.v-nome', listaVar).pop(); if (ult) ult.focus(); };
    desenharFotos();
    form.ativo.onchange = () => form.ativo.closest('.check').classList.toggle('marcado', form.ativo.checked);
    form.categoria.onchange = () => {
      const nova = form.categoria.value === '__nova';
      $('#campo-nova-cat', p).classList.toggle('oculto', !nova);
      if (nova) form.nova_categoria.focus();
    };
    // Peças: uma linha para cada peça, com botão para adicionar mais
    const listaPecas = $('#lista-pecas', p);
    const linhaPeca = (v = '') => `<div class="linha-peca"><span class="num-peca"></span><input class="peca" maxlength="80" value="${esc(v)}" placeholder="Ex.: Painel redondo" ${so ? 'disabled' : ''}>${so ? '' : '<button type="button" class="tirar-peca" aria-label="Tirar esta peça">×</button>'}</div>`;
    const numerar = () => $$('.num-peca', listaPecas).forEach((el, i) => (el.textContent = `${i + 1}.`));
    const addPeca = (v = '', focar = true) => {
      listaPecas.insertAdjacentHTML('beforeend', linhaPeca(v));
      numerar();
      const inp = listaPecas.lastElementChild.querySelector('input');
      if (focar) inp.focus();
    };
    const pecasIniciais = k.pecas.length ? k.pecas : ['', '', ''];
    pecasIniciais.forEach((v) => addPeca(v, false));
    // Rascunho automático
    if (!so) {
      ligarFaixaRascunho(p, chRasc, (r) => formKit(kit, r));
      let tRasc = 0;
      const guardar = () => { clearTimeout(tRasc); tRasc = setTimeout(() => {
        try { lerVars(); } catch (e) { /* segue */ }
        lerTemas();
        const nome = form.nome.value.trim();
        const pecasR = $$('.peca', p).map((i) => i.value.trim()).filter(Boolean);
        if (!kit && !nome && !fotos.length && !pecasR.length && !temas.length) return;
        gravarRascunho(chRasc, { nome: form.nome.value, preco: form.preco.value === '' ? '' : numero(form.preco.value), sinal: form.sinal.value === '' ? '' : numero(form.sinal.value),
          categoria: form.categoria.value === '__nova' ? (form.nova_categoria.value.trim() || null) : (form.categoria.value || null),
          pecas: pecasR, fotos: fotos.filter((f) => !String(f).startsWith('data:')), foto_url: fotos[0] || null, ativo: form.ativo.checked,
          quantidade: lerQtd(), preco_consultar: form.consultar.checked, temas: form.tem_temas.checked ? temas.map((t) => ({ ...t })) : [],
          variacoes: form.tem_var && form.tem_var.checked ? vars.map((v) => ({ ...v })) : [] });
      }, 500); };
      form.addEventListener('input', guardar); form.addEventListener('change', guardar); p.addEventListener('click', () => setTimeout(guardar, 50));
    }
    listaPecas.addEventListener('click', (e) => {
      const b = e.target.closest('.tirar-peca'); if (!b) return;
      b.closest('.linha-peca').remove();
      if (!listaPecas.children.length) addPeca('', false);
      numerar();
    });
    // Enter numa peça já abre a próxima linha
    listaPecas.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !e.target.classList.contains('peca')) return;
      e.preventDefault();
      const prox = e.target.closest('.linha-peca').nextElementSibling;
      if (prox) prox.querySelector('input').focus(); else if ($$('.peca', listaPecas).length < 100) addPeca();
    });
    const botaoAdd = $('#add-peca', p);
    if (botaoAdd) botaoAdd.onclick = () => { if ($$('.peca', listaPecas).length < 100) addPeca(); };
    if (form.arquivo) {
      form.arquivo.onchange = async () => {
        const vagas = MAX_FOTOS - fotos.length - enviando;
        const arquivos = [...form.arquivo.files].slice(0, Math.max(0, vagas));
        if (form.arquivo.files.length > arquivos.length) aviso(`Cada kit pode ter até ${MAX_FOTOS} fotos.`);
        form.arquivo.value = '';
        if (!arquivos.length) return;
        for (let i = 0; i < arquivos.length; i++) {
          const pronta = await recortarFoto(arquivos[i], arquivos.length > 1 ? `${i + 1} de ${arquivos.length}` : '');
          if (!pronta) continue;
          enviando++; desenharFotos();
          try { fotos.push(await dados.enviarFoto(pronta)); }
          catch (e) { aviso(e.message); }
          finally { enviando--; desenharFotos(); }
        }
      };
    }
    form.onsubmit = async (e) => {
      e.preventDefault();
      const caixa = $('#erro-kit', p);
      caixa.classList.add('oculto');
      lerTemas();
      const comTemas = form.tem_temas.checked && temas.length > 0;
      if (comTemas && temas.some((t) => !t.nome)) { caixa.textContent = 'Dê um nome para cada tema (ex.: Sonic, Moana).'; caixa.classList.remove('oculto'); return; }
      if (enviandoTemas) { caixa.textContent = 'Espere as fotos dos temas terminarem de enviar.'; caixa.classList.remove('oculto'); return; }
      const consultar = form.consultar.checked;
      const novo = {
        nome: form.nome.value.trim(),
        preco: consultar ? 0 : numero(form.preco.value),
        sinal: consultar ? 0 : numero(form.sinal.value),
        preco_consultar: consultar,
        quantidade: lerQtd() || 1,
        temas: comTemas ? temas.map((t) => ({ id: t.id, nome: t.nome, foto: t.foto || null, ...(t.qtd > 1 ? { qtd: t.qtd } : {}) })) : [],
        ...((estado.estruturas || []).length ? { estruturas: $$('[data-estr]', p).filter((c) => c.checked).map((c) => ({ id: c.dataset.estr, qtd: ((k.estruturas || []).find((x) => x.id === c.dataset.estr) || {}).qtd || 1 })) } : {}),
        pecas: $$('.peca', p).map((i) => i.value.trim()).filter(Boolean).slice(0, 100),
        categoria: ((form.categoria.value === '__nova' ? form.nova_categoria.value : form.categoria.value).trim().replace(/\s+/g, ' ').slice(0, 40)) || null,
        fotos: fotos.slice(0, MAX_FOTOS),
        foto_url: fotos[0] || null,
        ativo: form.ativo.checked,
      };
      if (!novo.nome) { caixa.textContent = 'Dê um nome ao kit.'; caixa.classList.remove('oculto'); return; }
      // Variações: o preço e o sinal do kit passam a ser os da opção mais barata ("a partir de")
      if (form.tem_var && form.tem_var.checked) {
        lerVars();
        const semNome = vars.findIndex((v) => !v.nome);
        if (semNome >= 0) { caixa.textContent = `Dê um nome para a opção ${semNome + 1} (ex.: Básico, Com cômoda).`; caixa.classList.remove('oculto'); return; }
        const nomes = vars.map((v) => v.nome.toLowerCase());
        if (new Set(nomes).size !== nomes.length) { caixa.textContent = 'Duas opções estão com o mesmo nome.'; caixa.classList.remove('oculto'); return; }
        novo.variacoes = vars.map((v) => ({ id: v.id, nome: v.nome, preco: Number(v.preco) || 0, sinal: Number(v.sinal) || 0, extras: v.extras || [], fotos: (v.fotos || []).filter((f) => fotos.includes(f)) }));
        const barata = [...novo.variacoes].sort((a, b) => a.preco - b.preco)[0];
        novo.preco = barata.preco; novo.sinal = barata.sinal;
      } else {
        novo.variacoes = [];
      }
      if (form.categoria.value === '__nova' && !novo.categoria) { caixa.textContent = 'Escreva o nome da nova categoria.'; caixa.classList.remove('oculto'); return; }
      if (enviando) { caixa.textContent = 'Espere as fotos terminarem de enviar.'; caixa.classList.remove('oculto'); return; }
      if (kit) novo.id = kit.id;
      await acao($('button[type=submit]', form), async () => {
        await dados.salvarKit(novo);
        apagarRascunho(chRasc);
        fecharPainel(); aviso('Kit salvo!'); await recarregar();
      });
    };
    const apagar = $('#apagar-kit', p);
    if (apagar) {
      apagar.onclick = async () => {
        if (!confirm(`Apagar o kit "${kit.nome}"?`)) return;
        await acao(apagar, async () => { await dados.apagarKit(kit.id); fecharPainel(); aviso('Kit apagado.'); await recarregar(); });
      };
    }
  });
}

// ---------------------------------------------------------------------
// MAIS
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// Avisos de reservas no celular da dona (notificações)
// ---------------------------------------------------------------------
function avisosSuportados() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
function avisosLigados() {
  let v = '';
  try { v = localStorage.getItem(`apm-avisos-loja-${estado.negocio.id}`) || ''; } catch (e) { /* segue */ }
  return !!v && avisosSuportados() && Notification.permission === 'granted';
}
function cartaoAvisosLoja() {
  if (DEMO_SITE || estado.suporte || ehComputador()) return '';
  // Depois de ativar, o cartão some da aba Mais (volta só se os avisos forem desligados no celular).
  if (avisosLigados()) return '';
  return `<section class="cartao coluna avisos-loja">
    <div class="linha-flex" style="gap:12px;align-items:center"><span style="font-size:30px" aria-hidden="true">🔔</span><div><b style="font-size:17px">Avisos de reservas no celular</b><div class="pequeno">Receba um aviso na hora em que uma cliente reservar pelo seu link, mesmo com o app fechado.</div></div></div>
    <button class="btn principal cheio" id="avisos-ativar">Ativar avisos neste celular</button>
  </section>`;
}
function chaveParaBytes(b64) {
  const p = '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function explicarAvisosIphone() {
  const passo = (n, t) => `<div class="passo-inst"><b>${n}</b><span>${t}</span></div>`;
  abrirPopup(`
    <h2 class="centro" style="font-size:23px;margin:0">Avisos no iPhone</h2>
    <p class="centro pequeno" style="margin:0">No iPhone, os avisos só funcionam com o app instalado na tela inicial.</p>
    ${passo(1, 'Instale o app: toque em <b>Compartilhar</b> <span class="ic-compart">⇧</span> no Safari e depois em <b>"Adicionar à Tela de Início"</b>.')}
    ${passo(2, 'Abra o app <b>pelo ícone</b> na tela inicial.')}
    ${passo(3, 'Vá em <b>Mais</b> e toque em <b>"Ativar avisos neste celular"</b>.')}
    <button class="btn principal cheio" id="av-ok">Entendi</button>`, (p) => { $('#av-ok', p).onclick = () => fecharPainel(); });
}
async function ativarAvisosLoja(botao) {
  if (ehIphone() && !appInstalado()) { explicarAvisosIphone(); return; }
  if (!avisosSuportados()) { aviso('Este navegador não aceita avisos. No Android, use o Chrome.'); return; }
  const texto = botao.textContent;
  botao.disabled = true; botao.textContent = 'Ativando…';
  try {
    if (dados.MODO_DEMO) throw new Error('Na demonstração os avisos não são enviados.');
    const reg = await navigator.serviceWorker.register('sw.js?v=2', { scope: './' });
    await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Você não permitiu os avisos. Dá para liberar depois nas configurações do celular.');
    const r = await fetch(`${SUPABASE_URL}/functions/v1/notificar-admin?acao=chave`);
    const { publica } = await r.json();
    if (!publica) throw new Error('Não consegui ligar os avisos agora. Tente de novo em instantes.');
    let inscricao = await reg.pushManager.getSubscription();
    if (!inscricao) inscricao = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(publica) });
    const token = await dados.salvarPushLoja(inscricao.endpoint);
    const cache = await caches.open('apm-avisos');
    await cache.put('/apm-avisos/token-loja', new Response(String(token)));
    await cache.put('/apm-avisos/cfg', new Response(JSON.stringify({ url: SUPABASE_URL, chave: SUPABASE_ANON_KEY })));
    try { localStorage.setItem(`apm-avisos-loja-${estado.negocio.id}`, '1'); } catch (e) { /* segue */ }
    aviso('Avisos ligados neste celular!');
    desenharAba();
  } catch (e) {
    aviso(e.message || 'Não deu certo. Tente de novo.');
    botao.disabled = false; botao.textContent = texto;
  }
}
async function desligarAvisosLoja(botao) {
  botao.disabled = true;
  try {
    const reg = await navigator.serviceWorker.getRegistration('./');
    const inscricao = reg && (await reg.pushManager.getSubscription());
    if (inscricao) await dados.removerPushLoja(inscricao.endpoint).catch(() => {});
    const cache = await caches.open('apm-avisos');
    await cache.delete('/apm-avisos/token-loja');
    // Só cancela a inscrição do celular se ele não for também o celular do administrador.
    const adm = await cache.match('/apm-avisos/token');
    if (inscricao && !adm) await inscricao.unsubscribe().catch(() => {});
  } catch (e) { /* segue */ }
  try { localStorage.removeItem(`apm-avisos-loja-${estado.negocio.id}`); } catch (e) { /* segue */ }
  aviso('Avisos desligados neste celular.');
  desenharAba();
}
function ligarAvisosLoja(tela) {
  const at = $('#avisos-ativar', tela); if (at) at.onclick = () => ativarAvisosLoja(at);
  const de = $('#avisos-desligar', tela); if (de) de.onclick = () => desligarAvisosLoja(de);
  const te = $('#avisos-testar', tela);
  if (te) te.onclick = async () => {
    te.disabled = true;
    try { await dados.lojaTestarPush(); aviso('Pronto! O aviso de teste chega em alguns segundos.'); }
    catch (e) { aviso(e.message); }
    te.disabled = false;
  };
}

// =====================================================================
// Organização da agenda: festas por dia, confirmação das reservas,
// dias fechados e (avançado) peças que os kits dividem.
// A mesma regra roda no banco (agenda_motivo) e aqui (dados.motivoAgenda).
// =====================================================================
function ctxAgenda() {
  return { kits: estado.kits || [], reservas: estado.reservas || [], estruturas: estado.estruturas || [], fechados: estado.fechados || [], limite_dia: (estado.negocio && estado.negocio.limite_dia) || null };
}
function contador(id, valor, min = 1, max = 200) {
  return `<div class="ag-num" data-num="${id}" data-min="${min}" data-max="${max}"><button type="button" data-d="-1" aria-label="Diminuir">−</button><b>${valor}</b><button type="button" data-d="1" aria-label="Aumentar">+</button></div>`;
}
function ligarContador(raiz, id, aoMudar) {
  const c = $(`[data-num="${id}"]`, raiz);
  if (!c) return () => 0;
  const b = $('b', c), min = Number(c.dataset.min), max = Number(c.dataset.max);
  $$('button', c).forEach((bt) => (bt.onclick = () => {
    const v = Math.min(max, Math.max(min, Number(b.textContent) + Number(bt.dataset.d)));
    b.textContent = String(v); if (aoMudar) aoMudar(v);
  }));
  return () => Number(b.textContent);
}
function simulacaoTexto(limite) {
  if (!limite) return `<div class="ag-sim"><div><span>Cada kit, no mesmo dia</span><b class="ag-ok">1 reserva por kit</b></div><div><span>Kits diferentes no mesmo dia</span><b class="ag-ok">✓ aceita</b></div></div>`;
  const ok = limite === 1 ? '1º pedido' : `1º ao ${limite}º pedido`;
  return `<div class="ag-sim"><div><span>Sábado: ${ok}</span><b class="ag-ok">✓ aceita</b></div><div><span>${limite + 1}º pedido no mesmo sábado</span><b class="ag-no">✗ dia lotado</b></div></div>`;
}
// Perguntas da agenda (contas novas logo depois de criar a loja; e "Refazer as perguntas" em Mais)
function assistenteAgenda(depois) {
  const n = estado.negocio;
  let passo = 0, limite = n.limite_dia || 3, semLimite = n.limite_dia == null && !!n.agenda_config_em, confirmar = n.confirmar_whatsapp !== false;
  const fim = () => { fecharPainel(); if (depois) depois(); };
  const telas = [
    () => `<div class="coluna ag-tela ag-centro">
        <div style="font-size:56px" aria-hidden="true">🎈</div>
        <h2 class="ag-titulo">Vamos deixar sua agenda do seu jeito</h2>
        <p class="pequeno" style="margin:0">Só 2 perguntas para o app <b>nunca aceitar reserva a mais</b> do que você consegue entregar.</p>
        <div class="ia-espaco"></div>
        <button class="btn principal cheio" data-ir="1">Começar</button>
        <button class="link-btn" data-fim style="align-self:center">Fazer depois</button></div>`,
    () => `<div class="coluna ag-tela">
        <div class="ia-passos"><i class="f"></i><i></i></div>
        <p class="ia-perg" style="margin:0">Quantas festas você consegue atender no mesmo dia?</p>
        <p class="pequeno" style="margin:-4px 0 4px">Somando todos os seus kits. Pense em carro, tempo e quem ajuda a entregar.</p>
        <div class="${semLimite ? 'ag-apagado' : ''}" id="ag-num-caixa">${contador('limite', limite, 1, 200)}</div>
        <button type="button" class="ia-opc ${semLimite ? 'sel' : ''}" id="ag-sem"><span class="ia-opc-ic">♾️</span><span><b>Não tenho limite</b><small>Cada kit só sai uma vez por dia</small></span></button>
        <div class="ia-espaco"></div>
        <button class="btn principal cheio" data-ir="2">Continuar</button></div>`,
    () => `<div class="coluna ag-tela">
        <div class="ia-passos"><i class="f"></i><i class="f"></i></div>
        <p class="ia-perg" style="margin:0">Quando uma cliente pedir pelo seu link...</p>
        <button type="button" class="ag-opc ${confirmar ? 'sel' : ''}" data-conf="1"><span class="ag-rec">RECOMENDADO</span><b>✅ Eu confirmo pelo WhatsApp antes do Pix</b><small>A data fica guardada até você aceitar.</small></button>
        <button type="button" class="ag-opc ${confirmar ? '' : 'sel'}" data-conf="0"><b>⚡ Mostrar a chave Pix na hora</b><small>Se a data não der, você devolve o sinal.</small></button>
        <div class="ia-espaco"></div>
        <button class="btn principal cheio" data-salvar>Continuar</button></div>`,
    () => `<div class="coluna ag-tela ag-centro">
        <div style="font-size:50px" aria-hidden="true">🎉</div>
        <h2 class="ag-titulo">Pronto!</h2>
        ${simulacaoTexto(semLimite ? null : limite)}
        ${estado.kits.length ? '' : `<p class="pequeno" style="margin:6px 0 0">Agora coloque seus kits no app:</p>
        ${iaLigada() ? '<button type="button" class="ia-opc sel" data-kits="ia" style="padding:15px"><span class="ia-opc-ic">✨</span><span><b>Montar meu catálogo com IA</b><small>Mande fotos, prints, PDF ou a conversa do WhatsApp</small></span></button>' : ''}
        <button type="button" class="ia-opc" data-kits="manual" style="padding:15px"><span class="ia-opc-ic">✍️</span><span><b>${iaLigada() ? 'Prefiro cadastrar sozinha' : 'Cadastrar meu primeiro kit'}</b></span></button>`}
        <div class="ia-espaco"></div>
        ${estado.kits.length ? '<button class="btn principal cheio" data-fim>Fechar</button>' : ''}
        <button class="link-btn" data-ir="1" style="align-self:center">Mudar as respostas</button></div>`,
  ];
  const desenhar = () => abrirPainel(passo ? 'Sua agenda' : '', telas[passo](), (p) => {
    $$('[data-ir]', p).forEach((b) => (b.onclick = () => { passo = Number(b.dataset.ir); desenhar(); }));
    $$('[data-fim]', p).forEach((b) => (b.onclick = fim));
    const lerLimite = ligarContador(p, 'limite', (v) => { limite = v; semLimite = false; const c = $('#ag-num-caixa', p); if (c) c.classList.remove('ag-apagado'); const sb = $('#ag-sem', p); if (sb) sb.classList.remove('sel'); });
    const sem = $('#ag-sem', p);
    if (sem) sem.onclick = () => { semLimite = !semLimite; sem.classList.toggle('sel', semLimite); $('#ag-num-caixa', p).classList.toggle('ag-apagado', semLimite); limite = lerLimite() || limite; };
    $$('[data-conf]', p).forEach((b) => (b.onclick = () => { confirmar = b.dataset.conf === '1'; $$('[data-conf]', p).forEach((x) => x.classList.toggle('sel', x === b)); }));
    const salvar = $('[data-salvar]', p);
    if (salvar) salvar.onclick = () => acao(salvar, async () => {
      estado.negocio = await dados.salvarNegocio({ limite_dia: semLimite ? null : limite, confirmar_whatsapp: confirmar, agenda_config_em: new Date().toISOString() });
      passo = 3; desenhar();
    });
    $$('[data-kits]', p).forEach((b) => (b.onclick = () => { fecharPainel(); if (b.dataset.kits === 'ia') { irPara('kits'); setTimeout(iaEnviar, 300); } else { irPara('kits'); setTimeout(() => formKit(null), 300); } }));
  }, passo > 0 ? () => { passo = Math.max(0, passo - 1); desenhar(); } : null);
  desenhar();
}

// Mais › Organização da agenda (para todas; sem aviso para quem já usa o app)
function painelOrganizacao() {
  const n = estado.negocio;
  const hoje = hojeISO();
  const fechados = (estado.fechados || []).filter((f) => f.ate >= hoje);
  const temEstr = (estado.estruturas || []).length > 0;
  abrirPainel('Organização da agenda', `
    <section class="cartao coluna">
      <h2 style="margin:0">Festas no mesmo dia</h2>
      <p class="pequeno" style="margin:0">Somando todos os kits. Quando chegar nesse número, o dia aparece lotado no seu link.</p>
      <div class="linha-flex entre" style="gap:10px;align-items:center"><div class="${n.limite_dia == null ? 'ag-apagado' : ''}" id="org-num">${contador('lim', n.limite_dia || 3, 1, 200)}</div>
        <label class="check ${n.limite_dia == null ? 'marcado' : ''}" style="flex:0 0 auto;white-space:nowrap"><input type="checkbox" id="org-sem" ${n.limite_dia == null ? 'checked' : ''}> Sem limite</label></div>
    </section>
    <section class="cartao coluna">
      <h2 style="margin:0">Pedidos pelo link</h2>
      <button type="button" class="ag-opc ${n.confirmar_whatsapp !== false ? 'sel' : ''}" data-conf="1"><b>✅ Eu confirmo pelo WhatsApp antes do Pix</b><small>A cliente só vê a chave Pix depois que você aceitar.</small></button>
      <button type="button" class="ag-opc ${n.confirmar_whatsapp === false ? 'sel' : ''}" data-conf="0"><b>⚡ Mostrar a chave Pix na hora</b><small>Se a data não der, você devolve o sinal.</small></button>
    </section>
    <section class="cartao coluna">
      <h2 style="margin:0">Dias fechados</h2>
      <p class="pequeno" style="margin:0">Férias, viagem, feriado: esses dias aparecem indisponíveis no link.</p>
      ${fechados.length ? fechados.map((f) => `<div class="linha-flex entre ag-fechado"><span><b>${esc(dataCurta(f.de))}${f.ate !== f.de ? ' a ' + esc(dataCurta(f.ate)) : ''}</b>${f.recado ? `<small>${esc(f.recado)}</small>` : ''}</span><button type="button" class="btn claro mini" data-tira="${esc(f.id)}">Reabrir</button></div>`).join('') : ''}
      <button type="button" class="btn claro mini" id="org-fechar" style="align-self:flex-start">＋ Fechar dias</button>
    </section>
    <section class="cartao coluna">
      <h2 style="margin:0">Kits que dividem peças</h2>
      <p class="pequeno" style="margin:0">Avançado: só se kits diferentes usam a mesma mesa, escadinha ou outra peça que você tem em pouca quantidade.</p>
      <button type="button" class="btn ${temEstr ? 'claro' : 'contorno'} mini" id="org-estr" style="align-self:flex-start">${temEstr ? `Minhas peças compartilhadas (${estado.estruturas.length})` : 'Configurar'}</button>
    </section>
    <button type="button" class="btn principal cheio" id="org-salvar">Salvar</button>
    <button type="button" class="link-btn" id="org-perguntas" style="align-self:center">Refazer as perguntas</button>`, (p) => {
    let confirmar = n.confirmar_whatsapp !== false;
    const lerLim = ligarContador(p, 'lim', () => { $('#org-sem', p).checked = false; $('#org-sem', p).closest('label').classList.remove('marcado'); $('#org-num', p).classList.remove('ag-apagado'); });
    $('#org-sem', p).onchange = (e) => { e.target.closest('label').classList.toggle('marcado', e.target.checked); $('#org-num', p).classList.toggle('ag-apagado', e.target.checked); };
    $$('[data-conf]', p).forEach((b) => (b.onclick = () => { confirmar = b.dataset.conf === '1'; $$('[data-conf]', p).forEach((x) => x.classList.toggle('sel', x === b)); }));
    $$('[data-tira]', p).forEach((b) => (b.onclick = () => acao(b, async () => { await dados.apagarFechado(b.dataset.tira); estado.fechados = await dados.listarFechados(); painelOrganizacao(); })));
    $('#org-fechar', p).onclick = () => formFecharDias();
    $('#org-estr', p).onclick = () => painelEstruturas();
    $('#org-perguntas', p).onclick = () => assistenteAgenda(() => painelOrganizacao());
    $('#org-salvar', p).onclick = (e) => acao(e.currentTarget, async () => {
      const sem = $('#org-sem', p).checked;
      estado.negocio = await dados.salvarNegocio({ limite_dia: sem ? null : lerLim(), confirmar_whatsapp: confirmar, agenda_config_em: n.agenda_config_em || new Date().toISOString() });
      fecharPainel(); aviso('Agenda salva!'); desenharAba();
    });
  });
}
function formFecharDias() {
  const h = hojeISO();
  abrirPainel('Fechar dias', `<form class="coluna" novalidate>
      <div class="grade-2"><label class="campo">De<input type="date" name="de" value="${h}" min="${h}"></label><label class="campo">Até<input type="date" name="ate" value="${h}" min="${h}"></label></div>
      <label class="campo">Recado para as clientes (opcional)<input name="recado" maxlength="120" placeholder="Ex.: Estamos de férias, voltamos dia 25"></label>
      <div id="fd-aviso"></div>
      <div class="erro oculto" id="fd-erro"></div>
      <button class="btn principal cheio" type="submit">Fechar esses dias</button></form>`, (p) => {
    const form = $('form', p);
    const conferir = () => {
      const de = form.de.value, ate = form.ate.value;
      if (form.ate.value < form.de.value) form.ate.value = form.de.value;
      const tem = (estado.reservas || []).filter((r) => r.status !== 'cancelada' && dados.cruza(r, de, form.ate.value));
      $('#fd-aviso', p).innerHTML = tem.length ? `<div class="nota-amarela pequeno">Já existe${tem.length > 1 ? 'm' : ''} ${plural(tem.length, 'reserva', 'reservas')} nesses dias. Nada é cancelado: só param de entrar pedidos novos.</div>` : '';
    };
    form.de.onchange = conferir; form.ate.onchange = conferir; conferir();
    form.onsubmit = async (e) => {
      e.preventDefault();
      await acao($('button[type=submit]', form), async () => {
        try {
          await dados.salvarFechado({ de: form.de.value, ate: form.ate.value, recado: form.recado.value.trim() || null });
          estado.fechados = await dados.listarFechados();
          aviso('Dias fechados no seu link.'); painelOrganizacao();
        } catch (err) { const c = $('#fd-erro', p); c.textContent = err.message; c.classList.remove('oculto'); }
      });
    };
  }, () => painelOrganizacao());
}
// Avançado: peças que vários kits dividem (mesa, escadinha...)
const SUGESTOES_PECAS = ['Mesa', 'Painel redondo', 'Painel retangular', 'Trio de cilindros', 'Suporte de arco', 'Escadinha', 'Cômoda', 'Boleira'];
function painelEstruturas() {
  const lista = estado.estruturas || [];
  const usoDe = (id) => estado.kits.filter((k) => (k.estruturas || []).some((x) => x.id === id)).length;
  abrirPainel('Peças compartilhadas', `
    <div class="ia-dica">🛒 <b>Comprou mais uma?</b> Aumente aqui. Cada peça a mais abre mais uma vaga na sua agenda no mesmo dia.</div>
    ${lista.map((e) => `<div class="ag-estr" data-e="${esc(e.id)}">
      <div class="ag-estr-t"><b>${esc(e.nome)}</b><small>${plural(usoDe(e.id), 'kit usa', 'kits usam')}${e.fora_qtd && e.fora_ate >= hojeISO() ? ` · ${e.fora_qtd} em conserto até ${esc(dataCurta(e.fora_ate))}` : ''}</small></div>
      ${contador('e' + e.id, e.quantidade, 0, 200)}
      <div class="ag-estr-bt"><button type="button" class="btn claro mini" data-kits-e="${esc(e.id)}">Quais kits usam?</button><button type="button" class="btn claro mini" data-conserto="${esc(e.id)}">Em conserto</button><button type="button" class="link-btn" data-apaga="${esc(e.id)}">Apagar</button></div>
    </div>`).join('') || '<p class="pequeno">Nenhuma peça cadastrada. Toque abaixo para começar.</p>'}
    <div class="ag-sug">${SUGESTOES_PECAS.filter((s) => !lista.some((e) => e.nome.toLowerCase() === s.toLowerCase())).map((s) => `<button type="button" class="btn claro mini" data-nova="${esc(s)}">＋ ${esc(s)}</button>`).join('')}<button type="button" class="btn claro mini" data-nova="">＋ Outra</button></div>
    <button type="button" class="btn principal cheio" id="es-salvar">Salvar</button>`, (p) => {
    const leitores = lista.map((e) => [e, ligarContador(p, 'e' + e.id)]);
    $$('[data-nova]', p).forEach((b) => (b.onclick = () => acao(b, async () => {
      let nome = b.dataset.nova;
      if (!nome) { nome = (prompt('Nome da peça (ex.: Mesa redonda):') || '').trim(); if (!nome) return; }
      const nova = await dados.salvarEstrutura({ nome: nome.slice(0, 40), quantidade: 1 });
      estado.estruturas = await dados.listarEstruturas();
      escolherKitsDaPeca(nova.id);
    })));
    $$('[data-kits-e]', p).forEach((b) => (b.onclick = () => escolherKitsDaPeca(b.dataset.kitsE)));
    $$('[data-conserto]', p).forEach((b) => (b.onclick = () => formConserto(b.dataset.conserto)));
    $$('[data-apaga]', p).forEach((b) => (b.onclick = () => acao(b, async () => {
      if (!confirm('Apagar esta peça? Os kits deixam de dividir ela.')) return;
      await dados.apagarEstrutura(b.dataset.apaga);
      [estado.estruturas, estado.kits] = await Promise.all([dados.listarEstruturas(), dados.listarKits()]);
      painelEstruturas();
    })));
    $('#es-salvar', p).onclick = (ev) => acao(ev.currentTarget, async () => {
      for (const [e, ler] of leitores) {
        const novo = ler();
        if (novo === e.quantidade) continue;
        if (novo < e.quantidade && !(await confirmarDiminuir(e, novo))) return;
        await dados.salvarEstrutura({ id: e.id, quantidade: novo });
      }
      estado.estruturas = await dados.listarEstruturas();
      aviso('Peças salvas!'); painelOrganizacao();
    });
  }, () => painelOrganizacao());
}
// Antes de diminuir: mostra os dias que ficariam sem peça (nada é cancelado)
async function confirmarDiminuir(e, novo) {
  const h = hojeISO();
  const usoDe = (r) => { const k = kitDe(r.kit_id); const x = (k.estruturas || []).find((y) => y.id === e.id); return x ? Math.max(1, Number(x.qtd) || 1) : 0; };
  const dias = {};
  (estado.reservas || []).filter((r) => r.status !== 'cancelada' && r.data_devolucao >= h && usoDe(r)).forEach((r) => {
    for (let x = r.data_retirada < h ? h : r.data_retirada; x <= r.data_devolucao; x = dados.somaDias(x, 1)) dias[x] = (dias[x] || 0) + usoDe(r);
  });
  const ruins = Object.entries(dias).filter(([, v]) => v > novo).sort();
  if (!ruins.length) return true;
  return confirm(`${e.nome}: de ${e.quantidade} para ${novo}.\n\n${ruins.slice(0, 5).map(([d, v]) => `${dataCurta(d)}: ${v} reservas usam ${e.nome.toLowerCase()} (${v - novo} fica sem)`).join('\n')}\n\nNenhuma reserva é cancelada. Combine com as clientes. Diminuir mesmo assim?`);
}
function escolherKitsDaPeca(id) {
  const e = (estado.estruturas || []).find((x) => x.id === id);
  if (!e) return painelEstruturas();
  abrirPainel(`Quais kits usam ${e.nome.toLowerCase()}?`, `
    <p class="pequeno" style="margin:0">Marque todos os kits que levam ${esc(e.nome.toLowerCase())}.</p>
    <div class="coluna" style="gap:6px">${estado.kits.map((k) => `<label class="check ${(k.estruturas || []).some((x) => x.id === id) ? 'marcado' : ''}"><input type="checkbox" data-k="${esc(k.id)}" ${(k.estruturas || []).some((x) => x.id === id) ? 'checked' : ''}> ${esc(k.nome)}</label>`).join('') || '<p class="pequeno">Cadastre seus kits primeiro.</p>'}</div>
    <div class="linha-flex" style="gap:8px"><button type="button" class="btn claro mini" id="pk-todos">Marcar todos</button></div>
    <button type="button" class="btn principal cheio" id="pk-salvar">Salvar</button>`, (p) => {
    $$('input[data-k]', p).forEach((c) => (c.onchange = () => c.closest('label').classList.toggle('marcado', c.checked)));
    $('#pk-todos', p).onclick = () => $$('input[data-k]', p).forEach((c) => { c.checked = true; c.closest('label').classList.add('marcado'); });
    $('#pk-salvar', p).onclick = (ev) => acao(ev.currentTarget, async () => {
      for (const c of $$('input[data-k]', p)) {
        const k = kitDe(c.dataset.k); const tem = (k.estruturas || []).some((x) => x.id === id);
        if (c.checked === tem) continue;
        const nova = c.checked ? [...(k.estruturas || []), { id, qtd: 1 }] : (k.estruturas || []).filter((x) => x.id !== id);
        await dados.salvarKit({ id: k.id, estruturas: nova });
      }
      estado.kits = await dados.listarKits();
      aviso('Kits ligados!'); painelEstruturas();
    });
  }, () => painelEstruturas());
}
function formConserto(id) {
  const e = (estado.estruturas || []).find((x) => x.id === id);
  const h = hojeISO();
  abrirPainel(`${e.nome}: em conserto`, `<form class="coluna" novalidate>
      <p class="pequeno" style="margin:0">Nesses dias, o app conta ${esc(e.nome.toLowerCase())} a menos.</p>
      <label class="campo">Quantas estão fora de uso?${contador('fq', Math.max(1, e.fora_qtd || 1), 1, Math.max(1, e.quantidade))}</label>
      <div class="grade-2"><label class="campo">De<input type="date" name="de" value="${e.fora_de || h}"></label><label class="campo">Até<input type="date" name="ate" value="${e.fora_ate || h}"></label></div>
      <button class="btn principal cheio" type="submit">Salvar</button>
      ${e.fora_qtd ? '<button class="btn contorno cheio" type="button" id="fq-volta">Já voltou do conserto</button>' : ''}</form>`, (p) => {
    const form = $('form', p); const ler = ligarContador(p, 'fq');
    form.onsubmit = (ev) => { ev.preventDefault(); acao($('button[type=submit]', form), async () => {
      if (form.ate.value < form.de.value) form.ate.value = form.de.value;
      await dados.salvarEstrutura({ id, fora_qtd: ler(), fora_de: form.de.value, fora_ate: form.ate.value });
      estado.estruturas = await dados.listarEstruturas(); painelEstruturas();
    }); };
    const v = $('#fq-volta', p);
    if (v) v.onclick = () => acao(v, async () => { await dados.salvarEstrutura({ id, fora_qtd: 0, fora_de: null, fora_ate: null }); estado.estruturas = await dados.listarEstruturas(); painelEstruturas(); });
  }, () => painelEstruturas());
}

function abaMais(tela) {
  const link = linkPublico(estado.negocio.slug);
  const mostrarInstalar = !DEMO_SITE && !appInstalado() && !ehComputador();
  tela.innerHTML = `
    <h1>Mais</h1>
    <button class="cartao clicavel perfil-topo" id="meus-dados">
      <span class="perfil-logo">${estado.negocio.logo_url ? `<img src="${esc(estado.negocio.logo_url)}" alt="">` : esc((estado.negocio.nome || '?').trim().charAt(0).toUpperCase())}</span>
      <span class="perfil-txt"><b>Editar dados</b><span class="perfil-nome">${esc(estado.negocio.nome)}</span><span class="pequeno">Logo, Instagram, recado do link, WhatsApp, Pix e dias de retirada</span></span>
      <span class="perfil-seta" aria-hidden="true">›</span>
    </button>
    ${temOfertaBF() ? `<div class="bf-card"><div style="font-size:30px" aria-hidden="true">🏷️</div><div class="t"><b>Black Friday: anual por R$ 167</b><span>53% OFF · só até 29/11</span></div><button class="btn principal mini" id="ver-bf">Ver oferta</button></div>` : ''}
    ${cartaoAvisosLoja()}
    ${mostrarInstalar ? `<section class="cartao coluna instalar">
      <div style="display:flex;gap:12px;align-items:center"><div style="font-size:36px" aria-hidden="true">📲</div><div><b style="font-size:17px">Instale o app no seu celular</b><div class="pequeno">Abra direto pela tela inicial, como um aplicativo.</div></div></div>
      <button class="btn verde cheio" id="instalar">Instalar o app na tela inicial</button></section>` : ''}
    <section class="cartao coluna mais-link">
      <h2>Meu link de reservas</h2>
      <p class="pequeno">Coloque na bio do Instagram. A cliente escolhe o kit e uma data livre, e o pedido aparece aqui como "aguardando sinal".</p>
      <div class="cartao" style="word-break: break-all; font-weight: 700; background: var(--lilas)">${esc(link)}</div>
      <div class="grade-2">
        <button class="btn" id="copiar">Copiar link</button>
        <a class="btn contorno" href="${esc(linkDona())}">Abrir</a>
      </div>
    </section>
    <section class="coluna mais-atalhos">
      <button class="cartao clicavel" id="organizacao"><div style="font-weight:800">Organização da agenda</div><div class="pequeno">Festas por dia, confirmação dos pedidos e dias fechados</div></button>
      <button class="cartao clicavel" id="mensagens"><div style="font-weight:800">Mensagens do WhatsApp</div><div class="pequeno">Escreva seus textos de sinal, confirmação, retirada e devolução</div></button>
      ${DEMO_SITE ? '' : '<button class="cartao clicavel" id="meu-contrato"><div style="font-weight:800">Meu contrato</div><div class="pequeno">Seu modelo de contrato para enviar em cada reserva</div></button>'}
      ${estado.assinatura && estado.assinatura.admin ? '<a class="cartao clicavel" style="text-decoration:none; background: var(--tinta); color: #fff; border-color: var(--tinta)" href="admin.html"><div style="font-weight:800">Painel do administrador</div><div class="pequeno" style="color:#D9CFE6">Clientes, renovações, leads e acessos</div></a>' : ''}
    </section>
    <section class="cartao coluna mais-ajuda">
      <h2>Precisa de ajuda?</h2>
      <button class="btn contorno cheio" id="ver-video">▶ Ver vídeo passo a passo</button>
      ${WHATSAPP_SUPORTE ? `<a class="btn verde cheio" href="${esc(linkZap(WHATSAPP_SUPORTE, 'Oi! Sou cliente do App Pegue e Monte e tenho uma dúvida.'))}" target="_blank" rel="noopener">${ICONE.zap} Suporte no WhatsApp</a>` : ''}
      <a class="btn contorno cheio" href="mailto:${esc(EMAIL_SUPORTE)}?subject=${encodeURIComponent('Ajuda no App Pegue e Monte')}">Enviar e-mail para o suporte</a>
      <p class="dica centro">${esc(EMAIL_SUPORTE)}</p>
    </section>
    ${DEMO_SITE ? `<a class="btn verde cheio" href="${esc(LINK_PLANOS)}" target="_top">Gostei! Quero usar com meus kits</a><button class="btn contorno cheio" id="demo-reset">Recomeçar a demonstração</button>`
      : dados.MODO_DEMO ? `<section class="cartao coluna"><h2>Testar situações (só na demonstração)</h2>
          ${[['normal', 'Assinatura ativa (normal)'], ['nova', 'Conta nova vazia (primeiros passos)'], ['teste', 'Em teste de 7 dias'], ['teste_fim', 'Teste de 7 dias acabou'], ['pix', 'Pagamento pendente com Pix'], ['email', 'Pagamento pendente sem Pix'], ['suspensa', 'Assinatura suspensa'], ['cancelada', 'Cliente cancelou']]
            .map(([k, t]) => `<button class="btn contorno cheio" data-simular="${k}">${t}</button>`).join('')}
          <button class="btn contorno cheio" id="demo-ia-zerar">Zerar a IA do catálogo (volta aos 5 kits do teste)</button>
          <button class="btn contorno cheio" id="demo-reset">Recomeçar a demonstração</button></section>` : ''}
    ${DEMO_SITE ? '' : '<button class="btn perigo cheio" id="sair">Sair do app</button>'}`;
  const inst = $('#instalar', tela); if (inst) inst.onclick = instalarApp;
  ligarAvisosLoja(tela);
  const vv = $('#ver-video', tela); if (vv) vv.onclick = abrirVideoTutorial;
  const vbf = $('#ver-bf', tela); if (vbf) vbf.onclick = popupBlackFriday;
  const mc = $('#meu-contrato', tela); if (mc) mc.onclick = painelContrato;
  $('#copiar', tela).onclick = () => copiarMeuLink();
  $('#meus-dados', tela).onclick = painelNegocio;
  $('#mensagens', tela).onclick = painelMensagens;
  const org = $('#organizacao', tela); if (org) org.onclick = painelOrganizacao;
  const sairBtn = $('#sair', tela);
  if (sairBtn) sairBtn.onclick = async () => { await dados.sair(); location.hash = ''; telaLogin('entrar'); };
  const iaZ = $('#demo-ia-zerar', tela);
  if (iaZ) iaZ.onclick = async () => { dados.demoIaZerar(); await atualizarIA(); aviso('IA zerada: 5 kits liberados no teste.'); };
  const reset = $('#demo-reset', tela);
  if (reset) reset.onclick = async () => { dados.demoReiniciar(); await carregarTudo(); aviso('Demonstração reiniciada.'); };
  $$('[data-simular]', tela).forEach((b) => (b.onclick = async () => {
    dados.demoSimular(b.dataset.simular); popupPagamentoMostrado = false;
    await recarregar(); montarApp(); window.scrollTo(0, 0);
  }));
}

// =====================================================================
// Reservas: criar, ver, conferir peças
// =====================================================================
// ---------------------------------------------------------------------
// Mensagens de WhatsApp. Cada dona pode escrever os próprios textos em
// Mais > Mensagens do WhatsApp; vazio = texto padrão abaixo.
// ---------------------------------------------------------------------
const TIPOS_MSG = [
  { tipo: 'sinal', campo: 'msg_sinal', titulo: 'Cobrar o sinal', quando: 'Quando chega um pedido e você vai pedir o sinal' },
  { tipo: 'confirmacao', campo: 'msg_confirmacao', titulo: 'Reserva confirmada', quando: 'Depois que o sinal é pago' },
  { tipo: 'retirada', campo: 'msg_retirada', titulo: 'Lembrete de retirada', quando: 'Para lembrar o dia de buscar o kit' },
  { tipo: 'devolucao', campo: 'msg_devolucao', titulo: 'Lembrete de devolução', quando: 'Para lembrar o dia de devolver o kit' },
];
const MARCADORES = [
  ['{nome da cliente}', 'Ana'], ['{kit}', 'kit Safári'], ['{data da festa}', '20/12'],
  ['{retirada}', '19/12'], ['{devolução}', '21/12'], ['{valor do sinal}', 'R$ 100,00'],
  ['{valor total}', 'R$ 350,00'], ['{valor que falta}', 'R$ 250,00'], ['{chave pix}', 'sua chave Pix'], ['{nome da loja}', 'o nome da sua loja'],
];
function textoPadrao(tipo, n) {
  switch (tipo) {
    case 'sinal':
      return 'Oi, {nome da cliente}! Recebi seu pedido do {kit} para a festa de {data da festa}. Para confirmar a reserva, o sinal é de {valor do sinal}'
        + ((n && n.chave_pix) ? '. Chave Pix: {chave pix}' : '') + '. Quando fizer, me manda o comprovante por aqui.';
    case 'confirmacao':
      return 'Oi, {nome da cliente}! Sua reserva do {kit} está confirmada. Festa: {data da festa}. Retirada: {retirada}. Devolução: {devolução}. Qualquer dúvida é só chamar!';
    case 'retirada':
      return 'Oi, {nome da cliente}! Lembrete: a retirada do {kit} é {retirada}. Te espero!';
    case 'devolucao':
      return 'Oi, {nome da cliente}! Espero que a festa tenha sido linda! A devolução do {kit} é {devolução}.';
    default:
      return 'Oi, {nome da cliente}!';
  }
}
// "kit Safári" (sem repetir "kit" quando o nome já começa com Kit)
function kitComPalavra(nome) {
  const t = String(nome || '').trim();
  return /^kit\b/i.test(t) ? t : `kit ${t}`;
}
function preencher(texto, r) {
  const k = kitDe(r.kit_id);
  const n = estado.negocio || {};
  const dia = (iso) => (iso === hojeISO() ? 'hoje' : dataCurta(iso));
  const v = {
    nome: String(r.cliente_nome || '').split(' ')[0], kit: kitComPalavra(nomeKitReserva(r)), festa: dataCurta(r.data_festa),
    retirada: dia(r.data_retirada), devolucao: dia(r.data_devolucao), sinal: reais(r.valor_sinal),
    total: reais(r.valor_total), restante: reais(Math.max(0, Number(r.valor_total || 0) - Number(r.valor_sinal || 0))),
    pix: n.chave_pix || '', loja: n.nome || '',
  };
  // Nomes novos e antigos dos marcadores (textos já salvos continuam funcionando)
  const mapa = {
    'nome da cliente': v.nome, nome: v.nome, kit: v.kit, 'nome do kit': v.kit,
    'data da festa': v.festa, festa: v.festa, retirada: v.retirada, 'devolução': v.devolucao, devolucao: v.devolucao,
    'valor do sinal': v.sinal, sinal: v.sinal, 'valor total': v.total, total: v.total,
    'valor que falta': v.restante, restante: v.restante, 'chave pix': v.pix, pix: v.pix, 'nome da loja': v.loja, loja: v.loja,
  };
  return String(texto)
    .replace(/\bkit\s+\{(kit|nome do kit)\}/gi, '{kit}') // evita "kit kit Safári" nos textos antigos
    .replace(/\{([^{}]{2,20})\}/g, (todo, m) => (Object.prototype.hasOwnProperty.call(mapa, m.toLowerCase()) ? mapa[m.toLowerCase()] : todo));
}
function mensagem(tipo, r) {
  const info = TIPOS_MSG.find((t) => t.tipo === tipo);
  const proprio = info && estado.negocio && String(estado.negocio[info.campo] || '').trim();
  return preencher(proprio || textoPadrao(tipo, estado.negocio), r);
}

function painelMensagens() {
  const n = estado.negocio;
  const exemplo = {
    cliente_nome: 'Ana Paula', kit_id: (estado.kits[0] || {}).id, data_festa: somaDias(hojeISO(), 10),
    data_retirada: somaDias(hojeISO(), 9), data_devolucao: somaDias(hojeISO(), 11),
    valor_total: (estado.kits[0] || {}).preco || 350, valor_sinal: (estado.kits[0] || {}).sinal || 100,
  };
  abrirPainel('Mensagens do WhatsApp', `
    <div class="explica-msg">
      <b>Como funciona</b>
      <p>Estas são as mensagens que o app já deixa prontas no seu WhatsApp. Você só confere e envia.</p>
      <p>As palavras entre chaves <b>{ }</b> são trocadas sozinhas pelos dados de cada reserva. Por exemplo, <b>{nome da cliente}</b> vira <b>Ana</b> e <b>{kit}</b> vira <b>kit Safári</b>.</p>
      <p>Pode mudar o resto do texto como quiser. Para colocar um dado, toque no lugar do texto e depois no botão dele:</p>
    </div>
    <div class="marcadores">${MARCADORES.map(([m, d]) => `<button type="button" class="marcador" data-m="${m}" title="vira: ${esc(d)}">${m.replace(/[{}]/g, '')}</button>`).join('')}</div>
    <form class="coluna" novalidate>
      ${TIPOS_MSG.map((t) => `
        <section class="cartao coluna" style="gap:8px">
          <div><h3>${esc(t.titulo)}</h3><span class="dica">${esc(t.quando)}</span></div>
          <textarea class="msg-texto" name="${t.campo}" data-tipo="${t.tipo}" maxlength="1000" rows="5">${esc(String(n[t.campo] || '').trim() || textoPadrao(t.tipo, n))}</textarea>
          <div class="previa-msg"><span class="dica">Como a cliente vai receber:</span><div class="bolha-zap" data-previa="${t.tipo}"></div></div>
          <button type="button" class="link-btn" data-padrao="${t.tipo}" style="align-self:flex-start; min-height:32px; padding:0">Voltar ao texto padrão</button>
        </section>`).join('')}
      <div class="erro oculto" id="erro-msg"></div>
      <button class="btn principal cheio" type="submit">Salvar mensagens</button>
    </form>`, (p) => {
    const form = $('form', p);
    let ultimo = form.querySelector('textarea');
    const previa = (ta) => { $(`[data-previa="${ta.dataset.tipo}"]`, p).textContent = preencher(ta.value, exemplo); };
    $$('textarea', form).forEach((ta) => {
      previa(ta);
      ta.oninput = () => previa(ta);
      ta.onfocus = () => { ultimo = ta; };
    });
    $$('[data-m]', p).forEach((b) => (b.onclick = () => {
      const ta = ultimo; const ini = ta.selectionStart ?? ta.value.length; const fim = ta.selectionEnd ?? ini;
      ta.value = ta.value.slice(0, ini) + b.dataset.m + ta.value.slice(fim);
      ta.focus(); ta.selectionStart = ta.selectionEnd = ini + b.dataset.m.length; previa(ta);
    }));
    $$('[data-padrao]', p).forEach((b) => (b.onclick = () => {
      const ta = form.querySelector(`[data-tipo="${b.dataset.padrao}"]`);
      ta.value = textoPadrao(b.dataset.padrao, n); previa(ta);
    }));
    form.onsubmit = async (e) => {
      e.preventDefault();
      const campos = {};
      for (const t of TIPOS_MSG) {
        const v = form[t.campo].value.trim();
        campos[t.campo] = (!v || v === textoPadrao(t.tipo, n)) ? null : v.slice(0, 1000);
      }
      await acao($('button[type=submit]', form), async () => {
        try {
          estado.negocio = await dados.salvarNegocio(campos);
          fecharPainel(); aviso('Mensagens salvas!');
        } catch (err) { $('#erro-msg', p).textContent = err.message; $('#erro-msg', p).classList.remove('oculto'); }
      });
    };
  });
}

function formReserva(pre, existente, rascunho) {
  if (!podeEditar()) return aviso('Sua assinatura não está ativa.');
  const chRasc = chaveRascunho('res', existente && existente.id);
  const kitsAtivos = estado.kits.filter((k) => k.ativo || (existente && k.id === existente.kit_id));
  if (!kitsAtivos.length) { aviso('Cadastre um kit primeiro.'); irPara('kits'); return; }
  const n = estado.negocio;
  const r = existente || {};
  const kit0 = kitDe(r.kit_id || pre.kit_id || kitsAtivos[0].id);
  const festa0 = r.data_festa || pre.data_festa || hojeISO();
  abrirPainel(existente ? 'Editar reserva' : 'Nova reserva', `
    <form class="coluna" novalidate>
      ${rascunho ? '' : faixaRascunho(chRasc)}
      <label class="campo">Kit<select name="kit">${kitsAtivos.map((k) => `<option value="${esc(k.id)}" ${k.id === kit0.id ? 'selected' : ''}>${esc(k.nome)}</option>`).join('')}</select></label>
      <label class="campo oculto" id="campo-variacao">Opção do kit<select name="variacao"></select></label>
      <label class="campo oculto" id="campo-tema">Tema<select name="tema"></select></label>
      <label class="campo">Data da festa<input type="date" name="festa" value="${festa0}" required></label>
      <div class="grade-2">
        <label class="campo">Retirada<input type="date" name="retirada" value="${r.data_retirada || somaDias(festa0, -n.dias_antes)}"></label>
        <label class="campo">Devolução<input type="date" name="devolucao" value="${r.data_devolucao || somaDias(festa0, n.dias_depois)}"></label>
      </div>
      <div id="disp"></div>
      <label class="campo">Nome da cliente<input name="nome" maxlength="80" value="${esc(r.cliente_nome || '')}" autocomplete="off" required></label>
      <label class="campo">WhatsApp da cliente${campoZap('zap', r.cliente_whatsapp)}</label>
      <div class="grade-2">
        <label class="campo">Valor total (R$)<input name="valor" inputmode="decimal" value="${esc(String(r.valor_total ?? kit0.preco).replace('.', ','))}"></label>
        <label class="campo">Sinal (R$)<input name="sinal" inputmode="decimal" value="${esc(String(r.valor_sinal ?? kit0.sinal).replace('.', ','))}"></label>
      </div>
      ${existente ? '' : `<label class="check"><input type="checkbox" name="pago"> O sinal já foi pago</label>`}
      <label class="campo">Observação (opcional)<textarea name="obs" maxlength="500" rows="3" placeholder="Ex.: entregar no salão às 14h, cliente pediu balões extras">${esc(r.obs || '')}</textarea></label>
      <div class="erro oculto" id="erro-res"></div>
      <button class="btn principal cheio" type="submit">${existente ? 'Salvar alterações' : 'Criar reserva'}</button>
    </form>`, (p) => {
    const form = $('form', p);
    ligarCampoZap(form.zap);
    // Opções (variações) do kit escolhido
    const encherVariacoes = (kitId, nomeAtual) => {
      const vs = variacoesDe(kitDe(kitId));
      $('#campo-variacao', p).classList.toggle('oculto', !vs.length);
      form.variacao.innerHTML = vs.map((v) => `<option value="${esc(v.id)}" ${v.nome === nomeAtual ? 'selected' : ''}>${esc(v.nome)} · ${reais(v.preco)}</option>`).join('')
        + (nomeAtual && !vs.some((v) => v.nome === nomeAtual) ? `<option value="" selected>${esc(nomeAtual)} (opção antiga)</option>` : '');
    };
    const variacaoEscolhida = () => variacoesDe(kitDe(form.kit.value)).find((v) => v.id === form.variacao.value) || null;
    encherVariacoes(kit0.id, r.variacao || null);
    // Temas do kit escolhido
    const encherTemas = (kitId, temaAtual) => {
      const ts = kitDe(kitId).temas || [];
      $('#campo-tema', p).classList.toggle('oculto', !ts.length);
      form.tema.innerHTML = '<option value="">Escolha o tema</option>' + ts.map((t) => `<option value="${esc(t.id)}" ${t.id === temaAtual ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')
        + (temaAtual && !ts.some((t) => t.id === temaAtual) && r.tema ? `<option value="${esc(temaAtual)}" selected>${esc(r.tema)} (tema antigo)</option>` : '');
    };
    encherTemas(kit0.id, r.tema_id || null);
    // Retirada e devolução combinadas à mão não são trocadas quando muda a data da festa
    let datasManuais = !!existente && (r.data_retirada !== somaDias(r.data_festa, -n.dias_antes) || r.data_devolucao !== somaDias(r.data_festa, n.dias_depois));
    if (!existente) { const v0 = variacaoEscolhida(); if (v0) { form.valor.value = String(v0.preco).replace('.', ','); form.sinal.value = String(v0.sinal).replace('.', ','); } }
    form.variacao.onchange = () => {
      const v = variacaoEscolhida();
      if (v) { form.valor.value = String(v.preco).replace('.', ','); form.sinal.value = String(v.sinal).replace('.', ','); }
    };
    const checar = () => {
      const kitId = form.kit.value;
      const ini = form.retirada.value; const fim = form.devolucao.value;
      const disp = $('#disp', p);
      if (!ini || !fim) { disp.innerHTML = ''; return; }
      const m = dados.motivoAgenda(ctxAgenda(), kitId, form.tema.value || null, ini, fim, r.id || null, true);
      const qtd = Math.max(1, Number(kitDe(kitId).quantidade) || 1);
      const conflito = m === 'kit' && qtd === 1 ? estado.reservas.find((x) => x.id !== r.id && x.kit_id === kitId && x.status !== 'cancelada' && cruza(x, ini, fim)) : null;
      disp.innerHTML = !m ? `<span class="etiqueta et-livre">Kit livre nessas datas</span>`
        : m === 'kit' ? `<div class="erro">${conflito ? `Esse kit já está com ${esc(conflito.cliente_nome)} de ${dataCurta(conflito.data_retirada)} a ${dataCurta(conflito.data_devolucao)}.` : `Os ${qtd} deste kit já estão reservados nessas datas.`}</div>`
        : m === 'tema' ? `<div class="erro">Esse tema já está reservado nessas datas. Escolha outro tema.</div>`
        : `<div class="nota-amarela pequeno">⚠️ ${m === 'fechado' ? 'Você marcou esses dias como fechados.' : m === 'limite' ? `Esse dia já tem ${estado.negocio.limite_dia} festas (o seu limite).` : `Falta ${esc(m.replace('estrutura:', '').toLowerCase())} nesses dias.`} Você pode salvar mesmo assim.</div>`;
    };
    form.festa.onchange = () => {
      if (!form.festa.value) return;
      if (!datasManuais || form.retirada.value > form.festa.value || form.devolucao.value < form.festa.value) {
        form.retirada.value = somaDias(form.festa.value, -n.dias_antes);
        form.devolucao.value = somaDias(form.festa.value, n.dias_depois);
      }
      checar();
    };
    form.tema.onchange = checar;
    form.kit.onchange = () => {
      const k = kitDe(form.kit.value);
      encherVariacoes(k.id, null);
      encherTemas(k.id, null);
      const v = variacaoEscolhida();
      if (!existente || v) { form.valor.value = String(v ? v.preco : k.preco).replace('.', ','); form.sinal.value = String(v ? v.sinal : k.sinal).replace('.', ','); }
      checar();
    };
    form.retirada.onchange = () => { datasManuais = true; checar(); };
    form.devolucao.onchange = () => { datasManuais = true; checar(); };
    if (form.pago) form.pago.onchange = () => form.pago.closest('.check').classList.toggle('marcado', form.pago.checked);
    // Rascunho: recupera o que estava preenchido e guarda enquanto digita
    if (rascunho) {
      if (rascunho.kit && kitsAtivos.some((x) => x.id === rascunho.kit)) { form.kit.value = rascunho.kit; encherVariacoes(rascunho.kit, null); encherTemas(rascunho.kit, rascunho.tema || null); }
      ['variacao', 'tema', 'festa', 'retirada', 'devolucao', 'nome', 'zap', 'valor', 'sinal', 'obs'].forEach((c) => { if (form[c] && rascunho[c] != null && rascunho[c] !== '') form[c].value = rascunho[c]; });
      datasManuais = true;
    }
    ligarFaixaRascunho(p, chRasc, (r) => formReserva(pre, existente, r));
    let tRasc = 0;
    const guardar = () => { clearTimeout(tRasc); tRasc = setTimeout(() => {
      if (!existente && !form.nome.value.trim() && !form.zap.value.trim() && !form.obs.value.trim()) return;
      const d = {}; ['kit', 'variacao', 'tema', 'festa', 'retirada', 'devolucao', 'nome', 'zap', 'valor', 'sinal', 'obs'].forEach((c) => { if (form[c]) d[c] = form[c].value; });
      gravarRascunho(chRasc, d);
    }, 500); };
    form.addEventListener('input', guardar); form.addEventListener('change', guardar);
    checar();

    form.onsubmit = async (e) => {
      e.preventDefault();
      const caixa = $('#erro-res', p);
      caixa.classList.add('oculto');
      const zap = normalizarZap(form.zap.value);
      const campos = {
        kit_id: form.kit.value,
        data_festa: form.festa.value,
        data_retirada: form.retirada.value,
        data_devolucao: form.devolucao.value,
        cliente_nome: form.nome.value.trim(),
        cliente_whatsapp: zap,
        valor_total: numero(form.valor.value),
        valor_sinal: numero(form.sinal.value),
        obs: form.obs.value.trim() || null,
      };
      const temaSel = (kitDe(campos.kit_id).temas || []).find((t) => t.id === form.tema.value);
      if ((kitDe(campos.kit_id).temas || []).length || r.tema_id) { campos.tema_id = form.tema.value || null; campos.tema = temaSel ? temaSel.nome : (form.tema.value && form.tema.value === r.tema_id ? r.tema : null); }
      if (campos.valor_total > 0 && r.valor_a_combinar) campos.valor_a_combinar = false;
      // Opção do kit: guarda o nome e as peças (kit + extras da opção)
      const kitSel = kitDe(campos.kit_id);
      const vSel = variacaoEscolhida();
      const nomeVar = vSel ? vSel.nome : (form.variacao.value === '' && r.variacao && kitSel.id === r.kit_id ? r.variacao : null);
      const mudouOpcao = !existente || nomeVar !== (r.variacao || null) || campos.kit_id !== r.kit_id;
      if (mudouOpcao && (!existente || ['aguardando_sinal', 'confirmada'].includes(r.status))) {
        campos.variacao = nomeVar;
        if (vSel || existente) {
          campos.pecas = pecasComVariacao(kitSel, vSel);
          campos.checklist_retirada = campos.pecas.map(() => false);
          campos.checklist_devolucao = campos.pecas.map(() => false);
        }
      }
      let erro = '';
      if (!campos.data_festa || !campos.data_retirada || !campos.data_devolucao) erro = 'Preencha as três datas.';
      else if (!(campos.data_retirada <= campos.data_festa && campos.data_festa <= campos.data_devolucao)) erro = 'A retirada precisa ser antes ou no dia da festa, e a devolução depois ou no dia.';
      else if (campos.cliente_nome.length < 2) erro = 'Digite o nome da cliente.';
      else if (zap.length < 10 || zap.length > 11) erro = 'Digite o WhatsApp da cliente com DDD.';
      if (erro) { caixa.textContent = erro; caixa.classList.remove('oculto'); return; }
      await acao($('button[type=submit]', form), async () => {
        try {
          let salva;
          if (existente) {
            salva = await dados.atualizarReserva(existente.id, campos);
          } else {
            const pago = form.pago && form.pago.checked;
            salva = await dados.criarReserva({ ...campos, status: pago ? 'confirmada' : 'aguardando_sinal', sinal_recebido: !!pago });
          }
          apagarRascunho(chRasc);
          await recarregar();
          aviso(existente ? 'Reserva atualizada!' : 'Reserva criada!');
          abrirReserva(salva.id);
        } catch (err) { caixa.textContent = err.message; caixa.classList.remove('oculto'); }
      });
    };
  }, existente ? () => abrirReserva(existente.id) : null);
}

// Alterar só a retirada e a devolução (como combinado com a cliente)
function alterarDatas(r) {
  abrirPainel('Alterar retirada e devolução', `<form class="coluna" novalidate>
      <p class="pequeno" style="margin:0">Festa: <b>${esc(dataLonga(r.data_festa))}</b></p>
      <div class="grade-2"><label class="campo">Retirada<input type="date" name="ret" value="${r.data_retirada}" max="${r.data_festa}"></label>
        <label class="campo">Devolução<input type="date" name="dev" value="${r.data_devolucao}" min="${r.data_festa}"></label></div>
      <div id="ad-disp"></div><div class="erro oculto" id="ad-erro"></div>
      <button class="btn principal cheio" type="submit">Salvar datas</button></form>`, (p) => {
    const form = $('form', p);
    const checar = () => {
      const m = form.ret.value && form.dev.value ? dados.motivoAgenda(ctxAgenda(), r.kit_id, r.tema_id || null, form.ret.value, form.dev.value, r.id, true) : null;
      $('#ad-disp', p).innerHTML = !m ? '<span class="etiqueta et-livre">Livre nessas datas</span>'
        : m === 'kit' || m === 'tema' ? `<div class="erro">${esc(dados.mensagemAgenda(m))}</div>`
        : '<div class="nota-amarela pequeno">⚠️ Esses dias passam do seu limite ou estão fechados. Você pode salvar mesmo assim.</div>';
    };
    form.ret.onchange = checar; form.dev.onchange = checar; checar();
    form.onsubmit = (e) => { e.preventDefault(); const c = $('#ad-erro', p); c.classList.add('oculto');
      if (!(form.ret.value && form.dev.value && form.ret.value <= r.data_festa && r.data_festa <= form.dev.value)) { c.textContent = 'A retirada precisa ser antes ou no dia da festa, e a devolução depois ou no dia.'; c.classList.remove('oculto'); return; }
      acao($('button[type=submit]', form), async () => {
        try { await dados.atualizarReserva(r.id, { data_retirada: form.ret.value, data_devolucao: form.dev.value }); await recarregar(); aviso('Datas alteradas!'); abrirReserva(r.id); }
        catch (err) { c.textContent = err.message; c.classList.remove('oculto'); }
      });
    };
  }, () => abrirReserva(r.id));
}
function abrirReserva(id) {
  const r = estado.reservas.find((x) => x.id === id);
  if (!r) { fecharPainel(); return; }
  const k = kitDe(r.kit_id);
  const ed = podeEditar();
  const restante = Math.max(0, Number(r.valor_total) - Number(r.valor_sinal));
  const botoes = [];
  if (ed) {
    if (r.status === 'aguardando_sinal') {
      botoes.push(`<a class="btn verde cheio" href="${esc(linkZap(r.cliente_whatsapp, mensagem('sinal', r)))}" target="_blank" rel="noopener">✅ Aceitar e cobrar o sinal</a>`);
      botoes.push('<button class="btn contorno cheio" data-acao="confirmar">Sinal recebido: confirmar reserva</button>');
      botoes.push('<button class="btn contorno cheio" data-acao="naovai">Não vai dar (avisar a cliente)</button>');
    }
    if (r.status === 'confirmada') {
      botoes.push('<button class="btn principal cheio" data-acao="retirar">Entregar kit (conferir peças)</button>');
      botoes.push(`<a class="btn contorno cheio" href="${esc(linkZap(r.cliente_whatsapp, mensagem('retirada', r)))}" target="_blank" rel="noopener">${ICONE.zap} Lembrar a retirada</a>`);
    }
    if (r.status === 'retirada') {
      botoes.push('<button class="btn principal cheio" data-acao="devolver">Receber devolução (conferir peças)</button>');
      botoes.push(`<a class="btn contorno cheio" href="${esc(linkZap(r.cliente_whatsapp, mensagem('devolucao', r)))}" target="_blank" rel="noopener">${ICONE.zap} Lembrar a devolução</a>`);
    }
    if (['confirmada', 'retirada', 'concluida'].includes(r.status) && restante > 0) {
      botoes.push(`<label class="check ${r.restante_recebido ? 'marcado' : ''}"><input type="checkbox" data-acao="restante" ${r.restante_recebido ? 'checked' : ''}> Restante recebido (${reais(restante)})</label>`);
    }
    if (r.status !== 'concluida') botoes.push('<button class="btn contorno cheio" data-acao="editar">Editar reserva</button>');
    if (['aguardando_sinal', 'confirmada'].includes(r.status)) botoes.push('<button class="btn perigo cheio" data-acao="cancelar">Cancelar reserva</button>');
  }

  const resumoChecklist = (titulo, marcas) => {
    if (!r.pecas.length) return '';
    const faltam = r.pecas.filter((_, i) => !marcas[i]);
    return `<div class="pequeno"><b>${titulo}:</b> ${faltam.length ? `faltou ${esc(faltam.join(', '))}` : 'todas as peças conferidas'}</div>`;
  };

  abrirPainel(nomeKitReserva(r), `
    <div class="linha-flex entre">${estaAtrasada(r) ? etiqueta('atrasada', 'Atrasada') : r.status === 'aguardando_sinal' && r.origem === 'link' ? '<span class="etiqueta et-aguardando_sinal">Pré-reserva · aguardando você</span>' : etiqueta(r.status)}${r.origem === 'link' ? '<span class="pequeno">Pedido pelo link</span>' : ''}</div>
    <div class="cartao coluna">
      <div class="linha-flex entre"><div><div style="font-weight:800">${esc(r.cliente_nome)}</div>
        <div class="pequeno">${esc(zapFormatado(r.cliente_whatsapp))}</div></div>
        <a class="btn claro mini" href="${esc(linkZap(r.cliente_whatsapp, `Oi, ${r.cliente_nome.split(' ')[0]}!`))}" target="_blank" rel="noopener">${ICONE.zap} Chamar</a></div>
      <div class="grade-2">
        <div><div class="pequeno">Festa</div><b>${dataCurta(r.data_festa)}</b></div>
        <div><div class="pequeno">Retirada → devolução</div><b>${dataCurta(r.data_retirada)} → ${dataCurta(r.data_devolucao)}</b>${ed && r.status !== 'concluida' ? ' <button type="button" class="btn claro mini" data-acao="datas" style="min-height:30px;padding:0 10px">✏️ Alterar</button>' : ''}</div>
        <div><div class="pequeno">Valor total</div><b>${r.valor_a_combinar && !Number(r.valor_total) ? '<span class="etiqueta et-aguardando_sinal">combinar valor</span>' : reais(r.valor_total)}</b></div>
        <div><div class="pequeno">Sinal</div><b>${reais(r.valor_sinal)}</b> ${r.sinal_recebido ? '<span class="etiqueta et-concluida">pago</span>' : ''}</div>
      </div>
      ${['retirada', 'concluida'].includes(r.status) ? resumoChecklist('Retirada', r.checklist_retirada) : ''}
      ${r.status === 'concluida' ? resumoChecklist('Devolução', r.checklist_devolucao) : ''}
      ${r.avaria_obs || Number(r.avaria_valor) > 0 ? `<div class="pequeno" style="color: var(--destaque-escuro)"><b>Avaria:</b> ${esc(r.avaria_obs || '')} ${Number(r.avaria_valor) > 0 ? `(${reais(r.avaria_valor)})` : ''}</div>` : ''}
    </div>
    ${r.status !== 'cancelada' ? '<section class="cartao coluna ct" id="ct-reserva"><div class="pequeno">Carregando contrato…</div></section>' : ''}
    <div class="cartao coluna anotacao">
      <label class="campo" style="margin:0">📝 Observação
        <textarea id="obs-reserva" maxlength="500" rows="3" placeholder="Anote o que precisar: horário de entrega, pedido especial, endereço do salão…" ${ed ? '' : 'disabled'}>${esc(r.obs || '')}</textarea>
      </label>
      ${ed ? '<button class="btn claro mini oculto" id="salvar-obs" style="align-self:flex-end">Salvar observação</button>' : ''}
    </div>
    <div class="coluna">${botoes.join('')}</div>`, (p) => {
    desenharCartaoContrato($('#ct-reserva', p), r);
    const obs = $('#obs-reserva', p), salvarObs = $('#salvar-obs', p);
    if (salvarObs) {
      obs.oninput = () => salvarObs.classList.toggle('oculto', obs.value.trim() === (r.obs || ''));
      salvarObs.onclick = () => acao(salvarObs, async () => {
        await dados.atualizarReserva(r.id, { obs: obs.value.trim().slice(0, 500) || null });
        r.obs = obs.value.trim() || null;
        salvarObs.classList.add('oculto');
        aviso('Observação salva!');
        recarregar().catch(() => {});
      });
    }
    const ligar = (nome, fn) => { const b = $(`[data-acao="${nome}"]`, p); if (b) b.addEventListener(b.type === 'checkbox' ? 'change' : 'click', () => fn(b)); };
    ligar('datas', () => alterarDatas(r));
    ligar('naovai', (b) => {
      const primeiro = r.cliente_nome.split(' ')[0];
      const txt = `Oi, ${primeiro}! Infelizmente ${dataCurta(r.data_festa)} não vai dar para o ${kitComPalavra(nomeKitReserva(r))}. 😕 Quer escolher outra data ou outro kit? Veja aqui: ${linkPublico(estado.negocio.slug)}`;
      abrirPopup(`
        <h2 class="centro" style="font-size:22px;margin:0">Avisar ${esc(primeiro)} e liberar a data?</h2>
        <p class="centro pequeno" style="margin:0">A mensagem abre pronta no WhatsApp e a reserva é cancelada, liberando a data no seu link.</p>
        <div class="bolha-zap">${esc(txt)}</div>
        <a class="btn verde cheio" id="nv-ok" href="${esc(linkZap(r.cliente_whatsapp, txt))}" target="_blank" rel="noopener">${ICONE.zap} Avisar e liberar a data</a>
        <button class="link-btn" id="nv-nao">Voltar</button>`, (pp) => {
        $('#nv-nao', pp).onclick = () => abrirReserva(r.id);
        $('#nv-ok', pp).addEventListener('click', () => acao(null, async () => {
          await dados.atualizarReserva(r.id, { status: 'cancelada' });
          await recarregar(); fecharPainel(); aviso('Cliente avisada e data liberada.');
        }));
      });
    });
    ligar('confirmar', (b) => acao(b, async () => {
      await dados.atualizarReserva(r.id, { status: 'confirmada', sinal_recebido: true });
      await recarregar();
      const atual = estado.reservas.find((x) => x.id === r.id);
      abrirPainel('Reserva confirmada!', `
        <p>Quer avisar ${esc(r.cliente_nome.split(' ')[0])} pelo WhatsApp? A mensagem já vai pronta.</p>
        <a class="btn verde cheio" href="${esc(linkZap(atual.cliente_whatsapp, mensagem('confirmacao', atual)))}" target="_blank" rel="noopener">${ICONE.zap} Enviar confirmação</a>
        <button class="btn contorno cheio" id="ok">Agora não</button>`, (p2) => { $('#ok', p2).onclick = () => abrirReserva(r.id); }, () => abrirReserva(r.id));
    }));
    ligar('retirar', () => telaChecklist(r, 'retirada'));
    ligar('devolver', () => telaChecklist(r, 'devolucao'));
    ligar('editar', () => formReserva({}, r));
    ligar('restante', (b) => acao(null, async () => {
      await dados.atualizarReserva(r.id, { restante_recebido: b.checked });
      b.closest('.check').classList.toggle('marcado', b.checked);
      await recarregar();
    }));
    ligar('cancelar', (b) => {
      if (!confirm('Cancelar esta reserva? A data do kit fica livre de novo.')) return;
      acao(b, async () => { await dados.atualizarReserva(r.id, { status: 'cancelada' }); fecharPainel(); aviso('Reserva cancelada.'); await recarregar(); });
    });
  });
}

function telaChecklist(r, tipo) {
  const marcas = [...(tipo === 'retirada' ? r.checklist_retirada : r.checklist_devolucao)];
  while (marcas.length < r.pecas.length) marcas.push(false);
  const titulo = tipo === 'retirada' ? 'Entrega do kit' : 'Devolução do kit';
  const doKit = new Set(kitDe(r.kit_id).pecas || []);
  const itens = r.pecas.map((peca, i) => `
    <label class="check ${marcas[i] ? 'marcado' : ''}"><input type="checkbox" data-i="${i}" ${marcas[i] ? 'checked' : ''}> ${esc(peca)}${r.variacao && !doKit.has(peca) ? ' <span class="tag-opcao">da opção</span>' : ''}</label>`).join('');
  abrirPainel(titulo, `
    <p class="pequeno">${tipo === 'retirada' ? 'Marque cada peça que está saindo com a cliente.' : 'Marque cada peça que voltou inteira. O que não for marcado fica registrado como faltando ou com avaria.'}</p>
    ${r.pecas.length ? `<button class="btn claro cheio" id="todas">Marcar todas</button><div class="coluna">${itens}</div>` : '<p class="vazio-txt">Esse kit não tem lista de peças. Você pode cadastrar na aba Kits.</p>'}
    ${tipo === 'devolucao' ? `
      <div id="avaria" class="coluna">
        <label class="campo">O que aconteceu (opcional)<input name="avaria_obs" maxlength="500" value="${esc(r.avaria_obs || '')}" placeholder="Ex.: vaso trincado"></label>
        <label class="campo">Valor cobrado pela avaria (R$)<input name="avaria_valor" inputmode="decimal" value="${Number(r.avaria_valor) > 0 ? esc(String(r.avaria_valor).replace('.', ',')) : ''}" placeholder="0"></label>
      </div>` : ''}
    <button class="btn principal cheio" id="concluir">${tipo === 'retirada' ? 'Confirmar entrega' : 'Concluir devolução'}</button>
    <button class="btn contorno cheio" id="voltar">Voltar</button>`, (p) => {
    const atualizar = () => {
      $$('[data-i]', p).forEach((c) => {
        const lab = c.closest('.check');
        lab.classList.toggle('marcado', c.checked);
        lab.classList.toggle('faltando', tipo === 'devolucao' && !c.checked);
      });
    };
    $$('[data-i]', p).forEach((c) => (c.onchange = () => { marcas[Number(c.dataset.i)] = c.checked; atualizar(); }));
    const todas = $('#todas', p);
    if (todas) todas.onclick = () => { $$('[data-i]', p).forEach((c) => { c.checked = true; marcas[Number(c.dataset.i)] = true; }); atualizar(); };
    atualizar();
    $('#voltar', p).onclick = () => abrirReserva(r.id);
    $('#concluir', p).onclick = (ev) => {
      const faltam = r.pecas.filter((_, i) => !marcas[i]);
      if (tipo === 'retirada' && faltam.length && !confirm(`${faltam.length} peça(s) não marcada(s). Entregar assim mesmo?`)) return;
      const campos = tipo === 'retirada'
        ? { status: 'retirada', checklist_retirada: marcas }
        : {
          status: 'concluida',
          checklist_devolucao: marcas,
          avaria_obs: ($('[name=avaria_obs]', p).value.trim() || (faltam.length ? `Faltou: ${faltam.join(', ')}` : '')) || null,
          avaria_valor: numero($('[name=avaria_valor]', p).value),
        };
      acao(ev.currentTarget, async () => {
        await dados.atualizarReserva(r.id, campos);
        await recarregar();
        aviso(tipo === 'retirada' ? 'Kit entregue!' : 'Devolução concluída!');
        abrirReserva(r.id);
      });
    };
  }, () => abrirReserva(r.id));
}

iniciar();
