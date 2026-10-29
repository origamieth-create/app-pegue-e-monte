// =====================================================================
// App Pegue e Monte — app da dona
// Abas: Hoje, Agenda, Kits, Mais
// =====================================================================
import * as dados from './dados.js';
import { PERMITIR_CADASTRO, EMAIL_SUPORTE, LINK_MENSAL, LINK_ANUAL } from './config.js';

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
function soDigitos(v) { return String(v || '').replace(/\D/g, ''); }
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
function linkPublico(slug) { return new URL(`reservar.html?l=${encodeURIComponent(slug)}`, location.href).href; }
function kitDe(id) { return estado.kits.find((k) => k.id === id) || { nome: 'Kit removido', pecas: [] }; }
function podeEditar() { return !!(estado.assinatura && estado.assinatura.liberado); }

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
function voltarPainel() {
  if (voltarAtual) { const f = voltarAtual; f(); } else fecharPainel();
}
function fecharPainel(vindoDoCelular) {
  if (!painelAberto) return;
  painelAberto = false;
  voltarAtual = null;
  $('#painel').innerHTML = '';
  document.body.style.overflow = '';
  if (!vindoDoCelular) history.back();
}
window.addEventListener('popstate', () => {
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
async function iniciar() {
  if (dados.MODO_DEMO) {
    $('#faixa').innerHTML = '<div class="faixa demo">Modo demonstração: os dados são de exemplo e ficam só neste aparelho.</div>';
  }
  await dados.aoMudarLogin((evento) => {
    if (evento === 'PASSWORD_RECOVERY') telaNovaSenha();
  });
  try {
    const sessao = await dados.sessaoAtual();
    if (!sessao) return telaLogin(new URLSearchParams(location.search).has('bemvinda') && PERMITIR_CADASTRO ? 'criar' : 'entrar');
    await carregarTudo();
  } catch (e) {
    $('#raiz').innerHTML = `<main><div class="erro">${esc(e.message)}</div><button class="btn" onclick="location.reload()">Tentar de novo</button></main>`;
  }
}

async function carregarTudo() {
  [estado.negocio, estado.assinatura] = await Promise.all([dados.meuNegocio(), dados.minhaAssinatura()]);
  marcarRelogio();
  const a = estado.assinatura || {};
  if (!a.cortesia && !a.encontrada) return telaSemAssinatura();
  if (!estado.negocio) return telaConfiguracaoInicial();
  [estado.kits, estado.reservas, estado.gastos] = await Promise.all([dados.listarKits(), dados.listarReservas(), dados.listarGastos().catch(() => [])]);
  estado.carregadoEm = Date.now();
  montarApp();
}

async function recarregar() {
  const antes = estado.assinatura ? estado.assinatura.liberado : null;
  [estado.kits, estado.reservas, estado.gastos, estado.assinatura] = await Promise.all([
    dados.listarKits(), dados.listarReservas(), dados.listarGastos().catch(() => []), dados.minhaAssinatura()]);
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
function linkPagamento() { return (estado.assinatura && estado.assinatura.plano === 'anual') ? LINK_ANUAL : LINK_MENSAL; }
function tempoRestante(ms) {
  const min = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(min / 1440); const h = Math.floor((min % 1440) / 60); const m = min % 60;
  return `${d ? d + 'd ' : ''}${h}h ${String(m).padStart(2, '0')}min`;
}

// Situação para a faixa: null (tudo certo), 'carencia' ou 'suspensa'
function situacaoAssinatura() {
  const a = estado.assinatura || {};
  if (a.cortesia || a.status === 'ativa') return null;
  if (a.liberado && a.carencia_ate) return 'carencia';
  return 'suspensa';
}

let relogioFaixa = null;
function ajustarAlturaFaixa() {
  const f = $('#faixa');
  document.documentElement.style.setProperty('--altura-faixa', (f ? f.offsetHeight : 0) + 'px');
}
function desenharFaixaAssinatura() {
  clearInterval(relogioFaixa);
  setTimeout(ajustarAlturaFaixa, 0);
  const faixa = $('#faixa');
  const base = dados.MODO_DEMO ? '<div class="faixa demo">Modo demonstração: os dados são de exemplo e ficam só neste aparelho.</div>' : '';
  const sit = situacaoAssinatura();
  if (!sit) { faixa.innerHTML = base; return; }
  const a = estado.assinatura;
  const cancelada = a.status === 'cancelada';
  if (sit === 'carencia') {
    faixa.innerHTML = base + `
      <div class="faixa-pagamento" role="alert">
        <div><b>${cancelada ? 'Sua assinatura foi cancelada.' : 'Pagamento não confirmado.'}</b>
        ${cancelada ? 'Reative' : 'Regularize'} em <b id="contagem">${tempoRestante(new Date(a.carencia_ate).getTime() - agoraServidor())}</b> para não perder o acesso.</div>
        <a class="btn mini" href="${esc(linkPagamento())}" target="_blank" rel="noopener">${cancelada ? 'Reativar assinatura' : 'Regularizar pagamento'}</a>
      </div>`;
    relogioFaixa = setInterval(() => {
      const resta = new Date(a.carencia_ate).getTime() - agoraServidor();
      const c = $('#contagem');
      if (c) c.textContent = tempoRestante(resta);
      if (resta <= 0) { clearInterval(relogioFaixa); recarregar().catch(() => {}); }
    }, 30000);
  } else {
    faixa.innerHTML = base + `
      <div class="faixa-pagamento suspensa" role="alert">
        <div><b>Assinatura suspensa.</b> Você ainda vê suas reservas, mas não pode criar ou alterar nada, e seu link de reservas está fora do ar.</div>
        <div class="linha-flex" style="flex-wrap:wrap">
          <a class="btn mini" href="${esc(linkPagamento())}" target="_blank" rel="noopener">Regularizar pagamento</a>
          <button class="btn mini contorno-claro" id="ja-paguei">Já paguei</button>
        </div>
      </div>`;
    $('#ja-paguei').onclick = (e) => acao(e.currentTarget, async () => {
      await recarregar();
      aviso(estado.assinatura.liberado ? 'Pagamento confirmado!' : 'Ainda não recebemos a confirmação. Pode levar alguns minutos.');
    });
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
      <a class="btn principal cheio" href="${esc(LINK_ANUAL)}" target="_blank" rel="noopener">Assinar o anual: R$ 269 ou 12x de R$ 27,79</a>
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

// Número vermelho na aba Hoje com os pedidos aguardando sinal.
function atualizarContador() {
  const c = $('#cont-hoje');
  if (!c) return;
  const n = estado.reservas.filter((r) => r.status === 'aguardando_sinal').length;
  c.textContent = n > 9 ? '9+' : String(n);
  c.classList.toggle('oculto', n === 0);
  const b = c.closest('button');
  if (b) b.setAttribute('aria-label', n ? `Início, ${n} pedido(s) aguardando sinal` : 'Início');
}

// =====================================================================
// Entrar, criar conta, recuperar senha
// =====================================================================
function telaLogin(modo) {
  const titulos = { entrar: 'Entrar', criar: 'Criar conta', esqueci: 'Recuperar senha' };
  $('#raiz').innerHTML = `
    <div class="entrada"><form class="caixa" novalidate>
      ${BANDEIRINHAS}<div class="logo-app">${ICONE.logo}</div>
      <h1 class="centro">App Pegue e Monte</h1>
      <p class="centro pequeno">${modo === 'esqueci' ? 'Enviaremos um link para você criar uma nova senha.' : modo === 'criar' ? 'Crie sua senha usando o <b>mesmo e-mail da compra</b>.' : 'Sua agenda de kits no celular.'}</p>
      <label class="campo">E-mail<input type="email" name="email" autocomplete="email" inputmode="email" required></label>
      ${modo !== 'esqueci' ? `<label class="campo">Senha<input type="password" name="senha" autocomplete="${modo === 'criar' ? 'new-password' : 'current-password'}" minlength="6" required></label>` : ''}
      <div class="erro oculto" id="erro-login"></div>
      <button class="btn principal cheio" type="submit">${titulos[modo]}</button>
      ${modo === 'entrar' ? `<button type="button" class="link-btn" data-modo="esqueci">Esqueci minha senha</button>` : ''}
      ${modo === 'entrar' && PERMITIR_CADASTRO ? `<button type="button" class="link-btn" data-modo="criar">Ainda não tenho conta</button>` : ''}
      ${modo !== 'entrar' ? `<button type="button" class="link-btn" data-modo="entrar">Voltar para entrar</button>` : ''}
    </form></div>`;
  $$('[data-modo]').forEach((b) => (b.onclick = () => telaLogin(b.dataset.modo)));
  const form = $('form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const senha = form.senha ? form.senha.value : '';
    const caixaErro = $('#erro-login');
    caixaErro.classList.add('oculto');
    const botao = $('button[type=submit]', form);
    botao.disabled = true;
    try {
      if (!email.includes('@')) throw new Error('Digite um e-mail válido.');
      if (modo === 'esqueci') {
        await dados.esqueciSenha(email);
        caixaErro.textContent = 'Pronto! Se esse e-mail tiver conta, você vai receber o link em instantes.';
        caixaErro.classList.remove('oculto');
        return;
      }
      if (senha.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      if (modo === 'criar') {
        const r = await dados.criarConta(email, senha);
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
function camposNegocio(n, inicial) {
  return `
    <label class="campo">Nome do seu negócio<input name="nome" maxlength="80" value="${esc(n.nome || '')}" placeholder="Ex.: Festas da Maria" required></label>
    <label class="campo">Seu link de reservas
      <input name="slug" maxlength="40" value="${esc(n.slug || '')}" placeholder="festas-da-maria" autocapitalize="off" required>
      <span class="dica" id="previa-link">${esc(linkPublico(n.slug || 'seu-link'))}</span>
    </label>
    <label class="campo">Seu WhatsApp (com DDD)<input name="whatsapp" inputmode="tel" value="${esc(n.whatsapp ? zapFormatado(n.whatsapp) : '')}" placeholder="(51) 99999-0000" required></label>
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
    whatsapp: soDigitos(form.whatsapp.value).replace(/^55(?=\d{10,11}$)/, ''),
    chave_pix: form.chave_pix.value.trim() || null,
  };
  if (!inicial) {
    c.dias_antes = Math.min(7, Math.max(0, parseInt(form.dias_antes.value, 10) || 0));
    c.dias_depois = Math.min(7, Math.max(0, parseInt(form.dias_depois.value, 10) || 0));
  }
  if (c.nome.length < 2) throw new Error('Digite o nome do seu negócio.');
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(c.slug)) throw new Error('O link precisa ter de 3 a 40 letras ou números, sem espaços.');
  if (c.whatsapp.length < 10 || c.whatsapp.length > 11) throw new Error('Digite o WhatsApp com DDD, só números.');
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
      ${camposNegocio({}, true)}
      <div class="erro oculto" id="erro-cfg"></div>
      <button class="btn principal cheio" type="submit">Pronto, abrir meu app</button>
      <button type="button" class="link-btn" id="sair">Sair</button>
    </form></div>`;
  const form = $('form');
  ligarPreviaLink(form);
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
        await carregarTudo();
      } catch (err) { caixa.textContent = err.message; caixa.classList.remove('oculto'); }
    });
  };
}

function painelNegocio() {
  abrirPainel('Meus dados', `<form class="coluna" novalidate>${camposNegocio(estado.negocio, false)}
      <div class="erro oculto" id="erro-neg"></div>
      <button class="btn principal cheio" type="submit">Salvar</button></form>`, (p) => {
    const form = $('form', p);
    ligarPreviaLink(form);
    form.onsubmit = async (e) => {
      e.preventDefault();
      await acao($('button[type=submit]', form), async () => {
        try {
          const c = lerCamposNegocio(form, false);
          if (c.slug !== estado.negocio.slug && !(await dados.linkDisponivel(c.slug))) throw new Error('Esse link já está em uso. Escolha outro.');
          estado.negocio = await dados.salvarNegocio(c);
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
          <div class="nome">${esc(k.nome)} · ${esc(r.cliente_nome)}</div>
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

  tela.innerHTML = `
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
    ${algumAlerta ? '' : '<div class="cartao res-concluida"><b>Tudo em dia!</b><div class="pequeno">Nenhuma pendência para hoje.</div></div>'}
    ${proximas.length ? bloco('Próximos 7 dias', '#4E4459', proximas, (r) => `Retirada ${dataCurta(r.data_retirada)}`) : ''}
    ${estado.kits.length === 0 ? `<div class="cartao coluna"><h3>Comece cadastrando seus kits</h3><p class="pequeno">Eles aparecem no seu link de reservas.</p><button class="btn principal" id="ir-kits">Cadastrar meu primeiro kit</button></div>` : ''}`;
  ligarItens(tela);
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
    celulas += `<button data-dia="${iso}" class="${iso === h ? 'hoje' : ''} ${iso === estado.dia ? 'sel' : ''}" aria-label="${dataLonga(iso)}${n ? `, ${festasPorDia[iso]} festa(s)` : ''}">
      ${d}<span class="pontos">${'<span class="ponto"></span>'.repeat(n)}</span></button>`;
  }

  const dia = estado.dia;
  const kitsVisiveis = estado.kits.filter((k) => k.ativo || ativas.some((r) => r.kit_id === k.id && cruza(r, dia, dia)));
  const linhas = kitsVisiveis.map((k) => {
    const r = ativas.find((x) => x.kit_id === k.id && cruza(x, dia, dia));
    if (r) {
      let papel = 'Com a cliente';
      if (r.data_festa === dia) papel = 'Dia da festa';
      else if (r.data_retirada === dia) papel = 'Retirada';
      else if (r.data_devolucao === dia) papel = 'Devolução';
      return itemReserva(r, `${papel} · festa ${dataCurta(r.data_festa)}`);
    }
    return `
      <div class="cartao"><div class="item-res">
        <div class="info"><div class="nome">${esc(k.nome)}</div><div class="pequeno">Disponível</div></div>
        ${podeEditar() ? `<button class="btn claro mini" data-reservar="${esc(k.id)}">Reservar</button>` : etiqueta('livre', 'Livre')}
      </div></div>`;
  }).join('');

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
  const cartoes = estado.kits.map((k) => `
    <button class="cartao clicavel kit-card" data-kit="${esc(k.id)}">
      ${k.foto_url ? `<img class="foto-kit" src="${esc(k.foto_url)}" alt="" loading="lazy">` : '<div class="foto-kit foto-vazia">Sem foto</div>'}
      <div class="nome">${esc(k.nome)}</div>
      <div class="pequeno">${reais(k.preco)} · ${k.pecas.length} peça${k.pecas.length === 1 ? '' : 's'}</div>
      ${k.ativo ? '' : '<span class="etiqueta et-cancelada">Fora do link</span>'}
    </button>`).join('');
  tela.innerHTML = `
    <div class="secao-titulo"><h1>Meus kits</h1>${podeEditar() ? `<button class="btn principal mini" id="novo-kit">${ICONE.mais1} Novo kit</button>` : ''}</div>
    ${estado.kits.length ? `<div class="kits-grade">${cartoes}</div>` : '<p class="vazio-txt">Nenhum kit ainda. Cadastre o primeiro: foto, nome, preço e a lista de peças.</p>'}`;
  const novo = $('#novo-kit', tela);
  if (novo) novo.onclick = () => formKit(null);
  $$('[data-kit]', tela).forEach((b) => (b.onclick = () => formKit(estado.kits.find((k) => k.id === b.dataset.kit))));
}

function formKit(kit) {
  const k = kit || { nome: '', preco: '', sinal: '', pecas: [], foto_url: null, ativo: true };
  let foto = k.foto_url;
  const so = !podeEditar();
  abrirPainel(kit ? 'Editar kit' : 'Novo kit', `
    <form class="coluna" novalidate>
      <div id="foto-area">${foto ? `<img class="foto-kit" src="${esc(foto)}" alt="Foto do kit">` : '<div class="foto-kit foto-vazia">Sem foto</div>'}</div>
      ${so ? '' : `<label class="btn contorno cheio" style="cursor:pointer">Escolher foto<input type="file" accept="image/*" name="arquivo" class="oculto"></label>`}
      <label class="campo">Nome do kit<input name="nome" maxlength="80" value="${esc(k.nome)}" placeholder="Ex.: Safári" required></label>
      <div class="grade-2">
        <label class="campo">Preço (R$)<input name="preco" inputmode="decimal" value="${esc(k.preco === '' ? '' : String(k.preco).replace('.', ','))}" placeholder="350"></label>
        <label class="campo">Sinal (R$)<input name="sinal" inputmode="decimal" value="${esc(k.sinal === '' ? '' : String(k.sinal).replace('.', ','))}" placeholder="100"></label>
      </div>
      <label class="campo">Peças do kit (uma por linha)
        <textarea name="pecas" placeholder="Painel redondo&#10;Boleira&#10;Vaso girafa">${esc(k.pecas.join('\n'))}</textarea>
        <span class="dica">Essa lista vira o checklist de cada retirada e devolução.</span>
      </label>
      <label class="check ${k.ativo ? 'marcado' : ''}"><input type="checkbox" name="ativo" ${k.ativo ? 'checked' : ''}> Mostrar no link de reservas</label>
      <div class="erro oculto" id="erro-kit"></div>
      ${so ? '' : `<button class="btn principal cheio" type="submit">Salvar kit</button>`}
      ${kit && !so ? `<button class="btn perigo cheio" type="button" id="apagar-kit">Apagar kit</button>` : ''}
    </form>`, (p) => {
    const form = $('form', p);
    form.ativo.onchange = () => form.ativo.closest('.check').classList.toggle('marcado', form.ativo.checked);
    if (form.arquivo) {
      form.arquivo.onchange = async () => {
        const arq = form.arquivo.files[0];
        if (!arq) return;
        $('#foto-area', p).innerHTML = '<div class="foto-kit foto-vazia">Enviando foto…</div>';
        try {
          foto = await dados.enviarFoto(arq);
          $('#foto-area', p).innerHTML = `<img class="foto-kit" src="${esc(foto)}" alt="Foto do kit">`;
        } catch (e) {
          aviso(e.message);
          $('#foto-area', p).innerHTML = foto ? `<img class="foto-kit" src="${esc(foto)}" alt="">` : '<div class="foto-kit foto-vazia">Sem foto</div>';
        }
      };
    }
    form.onsubmit = async (e) => {
      e.preventDefault();
      const caixa = $('#erro-kit', p);
      caixa.classList.add('oculto');
      const novo = {
        nome: form.nome.value.trim(),
        preco: numero(form.preco.value),
        sinal: numero(form.sinal.value),
        pecas: form.pecas.value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 100),
        foto_url: foto,
        ativo: form.ativo.checked,
      };
      if (!novo.nome) { caixa.textContent = 'Dê um nome ao kit.'; caixa.classList.remove('oculto'); return; }
      if (kit) novo.id = kit.id;
      await acao($('button[type=submit]', form), async () => {
        await dados.salvarKit(novo);
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
function abaMais(tela) {
  const link = linkPublico(estado.negocio.slug);
  tela.innerHTML = `
    <h1>Mais</h1>
    <section class="cartao coluna">
      <h2>Meu link de reservas</h2>
      <p class="pequeno">Coloque na bio do Instagram. A cliente escolhe o kit e uma data livre, e o pedido aparece aqui como "aguardando sinal".</p>
      <div class="cartao" style="word-break: break-all; font-weight: 700; background: var(--lilas)">${esc(link)}</div>
      <div class="grade-2">
        <button class="btn" id="copiar">Copiar link</button>
        <a class="btn contorno" href="${esc(link)}" target="_blank" rel="noopener">Abrir</a>
      </div>
    </section>
    <section class="coluna">
      <button class="cartao clicavel" id="meus-dados"><div class="nome" style="font-weight:800">Meus dados</div><div class="pequeno">Nome, link, WhatsApp, Pix e dias de retirada</div></button>
      <div class="cartao"><div style="font-weight:800">Clientes</div><div class="pequeno">Chega na próxima atualização do app.</div></div>
      <a class="cartao clicavel" style="text-decoration:none" href="mailto:${esc(EMAIL_SUPORTE)}?subject=${encodeURIComponent('Ajuda no App Pegue e Monte')}"><div style="font-weight:800">Preciso de ajuda</div><div class="pequeno">Respondemos por e-mail</div></a>
    </section>
    ${dados.MODO_DEMO ? '<button class="btn contorno cheio" id="demo-falha">Simular: pagamento falhou</button><button class="btn contorno cheio" id="demo-reset">Recomeçar a demonstração</button>' : ''}
    <button class="btn perigo cheio" id="sair">Sair do app</button>
    <p class="pequeno centro">Dica: no celular, use "Adicionar à tela inicial" no menu do navegador para abrir como aplicativo.</p>`;
  $('#copiar', tela).onclick = async () => {
    try { await navigator.clipboard.writeText(link); aviso('Link copiado!'); }
    catch (e) { prompt('Copie o link:', link); }
  };
  $('#meus-dados', tela).onclick = painelNegocio;
  $('#sair', tela).onclick = async () => { await dados.sair(); location.hash = ''; telaLogin('entrar'); };
  const reset = $('#demo-reset', tela);
  if (reset) reset.onclick = async () => { dados.demoReiniciar(); await carregarTudo(); aviso('Demonstração reiniciada.'); };
  const falha = $('#demo-falha', tela);
  if (falha) falha.onclick = async () => { dados.demoSimularFalha(); await recarregar(); montarApp(); };
}

// =====================================================================
// Reservas: criar, ver, conferir peças
// =====================================================================
function mensagem(tipo, r) {
  const k = kitDe(r.kit_id);
  const n = estado.negocio;
  const nome = r.cliente_nome.split(' ')[0];
  switch (tipo) {
    case 'sinal':
      return `Oi, ${nome}! Recebi seu pedido do kit ${k.nome} para a festa de ${dataCurta(r.data_festa)}. `
        + `Para confirmar a reserva, o sinal é de ${reais(r.valor_sinal)}${n.chave_pix ? `. Chave Pix: ${n.chave_pix}` : ''}. `
        + 'Quando fizer, me manda o comprovante por aqui.';
    case 'confirmacao':
      return `Oi, ${nome}! Sua reserva do kit ${k.nome} está confirmada. `
        + `Festa: ${dataCurta(r.data_festa)}. Retirada: ${dataCurta(r.data_retirada)}. Devolução: ${dataCurta(r.data_devolucao)}. `
        + 'Qualquer dúvida é só chamar!';
    case 'retirada':
      return `Oi, ${nome}! Lembrete: a retirada do kit ${k.nome} é ${r.data_retirada === hojeISO() ? 'hoje' : dataCurta(r.data_retirada)}. Te espero!`;
    case 'devolucao':
      return `Oi, ${nome}! Espero que a festa tenha sido linda! A devolução do kit ${k.nome} é ${r.data_devolucao === hojeISO() ? 'hoje' : dataCurta(r.data_devolucao)}.`;
    default:
      return `Oi, ${nome}!`;
  }
}

function formReserva(pre, existente) {
  if (!podeEditar()) return aviso('Sua assinatura não está ativa.');
  const kitsAtivos = estado.kits.filter((k) => k.ativo || (existente && k.id === existente.kit_id));
  if (!kitsAtivos.length) { aviso('Cadastre um kit primeiro.'); irPara('kits'); return; }
  const n = estado.negocio;
  const r = existente || {};
  const kit0 = kitDe(r.kit_id || pre.kit_id || kitsAtivos[0].id);
  const festa0 = r.data_festa || pre.data_festa || hojeISO();
  abrirPainel(existente ? 'Editar reserva' : 'Nova reserva', `
    <form class="coluna" novalidate>
      <label class="campo">Kit<select name="kit">${kitsAtivos.map((k) => `<option value="${esc(k.id)}" ${k.id === kit0.id ? 'selected' : ''}>${esc(k.nome)}</option>`).join('')}</select></label>
      <label class="campo">Data da festa<input type="date" name="festa" value="${festa0}" required></label>
      <div class="grade-2">
        <label class="campo">Retirada<input type="date" name="retirada" value="${r.data_retirada || somaDias(festa0, -n.dias_antes)}"></label>
        <label class="campo">Devolução<input type="date" name="devolucao" value="${r.data_devolucao || somaDias(festa0, n.dias_depois)}"></label>
      </div>
      <div id="disp"></div>
      <label class="campo">Nome da cliente<input name="nome" maxlength="80" value="${esc(r.cliente_nome || '')}" autocomplete="off" required></label>
      <label class="campo">WhatsApp da cliente<input name="zap" inputmode="tel" value="${esc(r.cliente_whatsapp ? zapFormatado(r.cliente_whatsapp) : '')}" placeholder="(51) 99999-0000" required></label>
      <div class="grade-2">
        <label class="campo">Valor total (R$)<input name="valor" inputmode="decimal" value="${esc(String(r.valor_total ?? kit0.preco).replace('.', ','))}"></label>
        <label class="campo">Sinal (R$)<input name="sinal" inputmode="decimal" value="${esc(String(r.valor_sinal ?? kit0.sinal).replace('.', ','))}"></label>
      </div>
      ${existente ? '' : `<label class="check"><input type="checkbox" name="pago"> O sinal já foi pago</label>`}
      <label class="campo">Observação (opcional)<input name="obs" maxlength="500" value="${esc(r.obs || '')}"></label>
      <div class="erro oculto" id="erro-res"></div>
      <button class="btn principal cheio" type="submit">${existente ? 'Salvar alterações' : 'Criar reserva'}</button>
    </form>`, (p) => {
    const form = $('form', p);
    const checar = () => {
      const kitId = form.kit.value;
      const ini = form.retirada.value; const fim = form.devolucao.value;
      const disp = $('#disp', p);
      if (!ini || !fim) { disp.innerHTML = ''; return; }
      const conflito = estado.reservas.find((x) => x.id !== r.id && x.kit_id === kitId && x.status !== 'cancelada' && cruza(x, ini, fim));
      disp.innerHTML = conflito
        ? `<div class="erro">Esse kit já está com ${esc(conflito.cliente_nome)} de ${dataCurta(conflito.data_retirada)} a ${dataCurta(conflito.data_devolucao)}.</div>`
        : `<span class="etiqueta et-livre">Kit livre nessas datas</span>`;
    };
    form.festa.onchange = () => {
      if (!form.festa.value) return;
      form.retirada.value = somaDias(form.festa.value, -n.dias_antes);
      form.devolucao.value = somaDias(form.festa.value, n.dias_depois);
      checar();
    };
    form.kit.onchange = () => {
      const k = kitDe(form.kit.value);
      if (!existente) { form.valor.value = String(k.preco).replace('.', ','); form.sinal.value = String(k.sinal).replace('.', ','); }
      checar();
    };
    form.retirada.onchange = checar;
    form.devolucao.onchange = checar;
    if (form.pago) form.pago.onchange = () => form.pago.closest('.check').classList.toggle('marcado', form.pago.checked);
    checar();

    form.onsubmit = async (e) => {
      e.preventDefault();
      const caixa = $('#erro-res', p);
      caixa.classList.add('oculto');
      const zap = soDigitos(form.zap.value).replace(/^55(?=\d{10,11}$)/, '');
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
          await recarregar();
          aviso(existente ? 'Reserva atualizada!' : 'Reserva criada!');
          abrirReserva(salva.id);
        } catch (err) { caixa.textContent = err.message; caixa.classList.remove('oculto'); }
      });
    };
  }, existente ? () => abrirReserva(existente.id) : null);
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
      botoes.push(`<a class="btn contorno cheio" href="${esc(linkZap(r.cliente_whatsapp, mensagem('sinal', r)))}" target="_blank" rel="noopener">${ICONE.zap} Cobrar o sinal</a>`);
      botoes.push('<button class="btn verde cheio" data-acao="confirmar">Sinal recebido: confirmar</button>');
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

  abrirPainel(k.nome, `
    <div class="linha-flex entre">${estaAtrasada(r) ? etiqueta('atrasada', 'Atrasada') : etiqueta(r.status)}${r.origem === 'link' ? '<span class="pequeno">Pedido pelo link</span>' : ''}</div>
    <div class="cartao coluna">
      <div class="linha-flex entre"><div><div style="font-weight:800">${esc(r.cliente_nome)}</div>
        <div class="pequeno">${esc(zapFormatado(r.cliente_whatsapp))}</div></div>
        <a class="btn claro mini" href="${esc(linkZap(r.cliente_whatsapp, `Oi, ${r.cliente_nome.split(' ')[0]}!`))}" target="_blank" rel="noopener">${ICONE.zap} Chamar</a></div>
      <div class="grade-2">
        <div><div class="pequeno">Festa</div><b>${dataCurta(r.data_festa)}</b></div>
        <div><div class="pequeno">Retirada → devolução</div><b>${dataCurta(r.data_retirada)} → ${dataCurta(r.data_devolucao)}</b></div>
        <div><div class="pequeno">Valor total</div><b>${reais(r.valor_total)}</b></div>
        <div><div class="pequeno">Sinal</div><b>${reais(r.valor_sinal)}</b> ${r.sinal_recebido ? '<span class="etiqueta et-concluida">pago</span>' : ''}</div>
      </div>
      ${r.obs ? `<div class="pequeno"><b>Obs.:</b> ${esc(r.obs)}</div>` : ''}
      ${['retirada', 'concluida'].includes(r.status) ? resumoChecklist('Retirada', r.checklist_retirada) : ''}
      ${r.status === 'concluida' ? resumoChecklist('Devolução', r.checklist_devolucao) : ''}
      ${r.avaria_obs || Number(r.avaria_valor) > 0 ? `<div class="pequeno" style="color: var(--destaque-escuro)"><b>Avaria:</b> ${esc(r.avaria_obs || '')} ${Number(r.avaria_valor) > 0 ? `(${reais(r.avaria_valor)})` : ''}</div>` : ''}
    </div>
    <div class="coluna">${botoes.join('')}</div>`, (p) => {
    const ligar = (nome, fn) => { const b = $(`[data-acao="${nome}"]`, p); if (b) b.addEventListener(b.type === 'checkbox' ? 'change' : 'click', () => fn(b)); };
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
  const itens = r.pecas.map((peca, i) => `
    <label class="check ${marcas[i] ? 'marcado' : ''}"><input type="checkbox" data-i="${i}" ${marcas[i] ? 'checked' : ''}> ${esc(peca)}</label>`).join('');
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
