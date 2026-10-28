// =====================================================================
// App Pegue e Monte — app da dona
// Abas: Hoje, Agenda, Kits, Mais
// =====================================================================
import * as dados from './dados.js';
import { PERMITIR_CADASTRO, EMAIL_SUPORTE } from './config.js';

const { hojeISO, somaDias, cruza } = dados;

const estado = {
  negocio: null,
  kits: [],
  reservas: [],
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
function podeEditar() { return !!(estado.negocio && estado.negocio.assinatura_ativa); }

const STATUS = {
  aguardando_sinal: 'Aguardando sinal',
  confirmada: 'Confirmada',
  retirada: 'Com a cliente',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};
const etiqueta = (status, texto) => `<span class="etiqueta et-${status}">${esc(texto || STATUS[status] || status)}</span>`;

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
  logo: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M9 15l2 2 4-4"/></svg>',
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
// Painel deslizante
// ---------------------------------------------------------------------
function abrirPainel(titulo, corpo, aoMontar) {
  const p = $('#painel');
  p.innerHTML = `
    <div class="painel-fundo">
      <div class="painel" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
        <div class="painel-topo"><h2>${esc(titulo)}</h2><button class="fechar" aria-label="Fechar">${ICONE.fechar}</button></div>
        ${corpo}
      </div>
    </div>`;
  $('.fechar', p).onclick = fecharPainel;
  $('.painel-fundo', p).addEventListener('click', (e) => { if (e.target.classList.contains('painel-fundo')) fecharPainel(); });
  document.body.style.overflow = 'hidden';
  if (aoMontar) aoMontar($('.painel', p));
}
function fecharPainel() { $('#painel').innerHTML = ''; document.body.style.overflow = ''; }

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
    if (!sessao) return telaLogin('entrar');
    await carregarTudo();
  } catch (e) {
    $('#raiz').innerHTML = `<main><div class="erro">${esc(e.message)}</div><button class="btn" onclick="location.reload()">Tentar de novo</button></main>`;
  }
}

async function carregarTudo() {
  estado.negocio = await dados.meuNegocio();
  if (!estado.negocio) return telaConfiguracaoInicial();
  [estado.kits, estado.reservas] = await Promise.all([dados.listarKits(), dados.listarReservas()]);
  estado.carregadoEm = Date.now();
  montarApp();
}

async function recarregar() {
  [estado.kits, estado.reservas] = await Promise.all([dados.listarKits(), dados.listarReservas()]);
  estado.carregadoEm = Date.now();
  desenharAba();
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
  if (b) b.setAttribute('aria-label', n ? `Hoje, ${n} pedido(s) aguardando sinal` : 'Hoje');
}

// =====================================================================
// Entrar, criar conta, recuperar senha
// =====================================================================
function telaLogin(modo) {
  const titulos = { entrar: 'Entrar', criar: 'Criar conta', esqueci: 'Recuperar senha' };
  $('#raiz').innerHTML = `
    <div class="entrada"><form class="caixa" novalidate>
      <div class="logo-app">${ICONE.logo}</div>
      <h1 class="centro">App Pegue e Monte</h1>
      <p class="centro pequeno">${modo === 'esqueci' ? 'Enviaremos um link para você criar uma nova senha.' : 'Sua agenda de kits no celular.'}</p>
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
      <div class="logo-app">${ICONE.logo}</div>
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
      <div class="logo-app">${ICONE.logo}</div>
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
  if (!estado.negocio.assinatura_ativa) {
    $('#faixa').innerHTML = '<div class="faixa leitura">Sua assinatura não está ativa. Você pode ver suas reservas, mas não pode criar ou alterar.</div>';
  }
  $('#raiz').innerHTML = `
    <header class="topo">
      <span class="marca">${esc(estado.negocio.nome)}</span>
      ${podeEditar() ? `<button class="btn principal mini" id="nova-res">${ICONE.mais1} Reserva</button>` : ''}
    </header>
    <main id="tela"></main>
    <nav class="abas" aria-label="Menu principal">
      ${['hoje', 'agenda', 'kits', 'mais'].map((a) => `
        <button data-aba="${a}" aria-label="${{ hoje: 'Hoje', agenda: 'Agenda', kits: 'Kits', mais: 'Mais' }[a]}">${ICONE[a]}<span>${{ hoje: 'Hoje', agenda: 'Agenda', kits: 'Kits', mais: 'Mais' }[a]}</span>${a === 'hoje' ? '<span class="contador oculto" id="cont-hoje" aria-hidden="true"></span>' : ''}</button>`).join('')}
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

// Um item de reserva clicável
function itemReserva(r, extra) {
  const k = kitDe(r.kit_id);
  return `
    <button class="cartao clicavel" data-res="${esc(r.id)}">
      <div class="item-res">
        <div class="info">
          <div class="nome">${esc(k.nome)} · ${esc(r.cliente_nome)}</div>
          <div class="pequeno">${extra || 'Festa ' + dataCurta(r.data_festa)}</div>
        </div>
        ${etiqueta(r.status)}
      </div>
    </button>`;
}
function ligarItens(el) { $$('[data-res]', el).forEach((b) => (b.onclick = () => abrirReserva(b.dataset.res))); }

// ---------------------------------------------------------------------
// HOJE
// ---------------------------------------------------------------------
function abaHoje(tela) {
  const h = hojeISO();
  const ativas = estado.reservas.filter((r) => r.status !== 'cancelada');
  const pendentes = ativas.filter((r) => r.status === 'aguardando_sinal').sort((a, b) => a.data_festa.localeCompare(b.data_festa));
  const retiradas = ativas.filter((r) => r.status === 'confirmada' && r.data_retirada === h);
  const devolucoes = ativas.filter((r) => r.status === 'retirada' && r.data_devolucao === h);
  const atrasadas = ativas.filter((r) => (r.status === 'retirada' && r.data_devolucao < h) || (r.status === 'confirmada' && r.data_retirada < h));
  const proximas = ativas.filter((r) => r.status === 'confirmada' && r.data_retirada > h && r.data_retirada <= somaDias(h, 7))
    .sort((a, b) => a.data_retirada.localeCompare(b.data_retirada));

  const bloco = (titulo, lista, extra, vazio) => `
    <section class="coluna">
      <div class="secao-titulo"><h2>${titulo}</h2>${lista.length ? `<span class="pequeno">${lista.length}</span>` : ''}</div>
      ${lista.length ? `<div class="lista">${lista.map((r) => itemReserva(r, extra(r))).join('')}</div>` : `<p class="vazio-txt">${vazio}</p>`}
    </section>`;

  tela.innerHTML = `
    <h1>${esc(dataLonga(h))}</h1>
    ${atrasadas.length ? bloco('Atrasadas', atrasadas, (r) => r.status === 'retirada'
      ? `<b style="color: var(--destaque-escuro)">Devolução era ${dataCurta(r.data_devolucao)}</b>`
      : `<b style="color: var(--destaque-escuro)">Retirada era ${dataCurta(r.data_retirada)}</b>`, '') : ''}
    ${pendentes.length ? bloco('Pedidos aguardando sinal', pendentes, (r) => `${r.origem === 'link' ? 'Pelo link · ' : ''}Festa ${dataCurta(r.data_festa)} · sinal ${reais(r.valor_sinal)}`, '') : ''}
    ${bloco('Retiradas de hoje', retiradas, () => 'Abra para conferir as peças', 'Nenhuma retirada hoje.')}
    ${bloco('Devoluções de hoje', devolucoes, () => 'Abra para conferir as peças', 'Nenhuma devolução hoje.')}
    ${bloco('Próximos 7 dias', proximas, (r) => `Retirada ${dataCurta(r.data_retirada)}`, 'Nada marcado para os próximos dias.')}
    ${estado.kits.length === 0 ? `<div class="cartao coluna"><h3>Comece cadastrando seus kits</h3><p class="pequeno">Eles aparecem no seu link de reservas.</p><button class="btn principal" id="ir-kits">Cadastrar meu primeiro kit</button></div>` : ''}`;
  ligarItens(tela);
  const b = $('#ir-kits', tela);
  if (b) b.onclick = () => irPara('kits');
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
      <div class="cartao"><div style="font-weight:800">Clientes e Financeiro</div><div class="pequeno">Chegam na próxima atualização do app.</div></div>
      <a class="cartao clicavel" style="text-decoration:none" href="mailto:${esc(EMAIL_SUPORTE)}?subject=${encodeURIComponent('Ajuda no App Pegue e Monte')}"><div style="font-weight:800">Preciso de ajuda</div><div class="pequeno">Respondemos por e-mail</div></a>
    </section>
    ${dados.MODO_DEMO ? '<button class="btn contorno cheio" id="demo-reset">Recomeçar a demonstração</button>' : ''}
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
  });
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
    <div class="linha-flex entre">${etiqueta(r.status)}${r.origem === 'link' ? '<span class="pequeno">Pedido pelo link</span>' : ''}</div>
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
        <button class="btn contorno cheio" id="ok">Agora não</button>`, (p2) => { $('#ok', p2).onclick = () => abrirReserva(r.id); });
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
  });
}

iniciar();
