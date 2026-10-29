// =====================================================================
// App Pegue e Monte — painel do administrador
// Só abre para e-mails cadastrados na tabela "administradores".
// Quem confere é o banco de dados: esta página só mostra o resultado.
// =====================================================================
import * as dados from './dados.js?v=20261029b';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const raiz = $('#raiz');

const estado = { aba: 'resumo', filtro: 'todos', busca: '', resumo: null, clientes: [], eventos: [] };

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function reais(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function data(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'; }
function dataHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function haQuanto(iso) {
  if (!iso) return 'nunca';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  return `há ${dias} dias`;
}
function soDigitos(v) { return String(v || '').replace(/\D/g, ''); }
function telefoneBonito(n) {
  const d = soDigitos(n).replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d || '—';
}
function linkZap(n, texto) {
  let d = soDigitos(n);
  if (d.length <= 11) d = '55' + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}
function mesCurto(aaaamm) {
  const [a, m] = aaaamm.split('-').map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
}

let toastTimer = null;
function aviso(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('oculto');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('oculto'), 3200);
}

const SITUACAO = {
  ativa: 'Ativa',
  carencia: 'Pagamento pendente',
  cancelada: 'Cancelada',
  suspensa: 'Bloqueada',
  lead: 'Lead',
  cortesia: 'Cortesia',
};
const FILTROS = [
  ['todos', 'Todos'], ['ativa', 'Ativas'], ['carencia', 'Pagamento pendente'], ['lead', 'Leads'],
  ['cancelada', 'Canceladas'], ['suspensa', 'Bloqueadas'], ['cortesia', 'Cortesia'],
];
const EVENTO = {
  purchase_approved: ['Compra aprovada', '#1F7A52'],
  subscription_renewed: ['Renovação paga', '#1F7A52'],
  subscription_late_recovered: ['Pagamento recuperado', '#1F7A52'],
  subscription_resumed: ['Assinatura retomada', '#1F7A52'],
  subscription_renewal_refused: ['Renovação recusada', '#9A5B00'],
  subscription_late: ['Pagamento atrasado', '#9A5B00'],
  subscription_canceled: ['Cancelou a assinatura', '#6B6470'],
  subscription_paused: ['Assinatura pausada', '#B3202E'],
  refund: ['Reembolso', '#B3202E'],
  chargeback: ['Chargeback (contestação)', '#B3202E'],
  checkout_abandonment: ['Abandonou o checkout', '#5B3A99'],
  pix_gerado: ['Gerou o Pix', '#5B3A99'],
  boleto_gerado: ['Gerou o boleto', '#5B3A99'],
  purchase_refused: ['Compra recusada', '#9A5B00'],
  admin_liberou: ['Você liberou o acesso', '#1E5FA8'],
  admin_bloqueou: ['Você bloqueou o acesso', '#1E5FA8'],
};
const sit = (s) => `<span class="sit sit-${esc(s)}">${esc(SITUACAO[s] || s)}</span>`;

// ---------------------------------------------------------------------
// Início: confere login e permissão
// ---------------------------------------------------------------------
async function iniciar() {
  try {
    const sessao = await dados.sessaoAtual();
    if (!sessao) return telaAviso('Entre no app primeiro', 'Faça login com o seu e-mail de administrador e depois abra o painel de novo.', 'Ir para o app');
    const eu = await dados.minhaAssinatura();
    if (!eu || !eu.admin) return telaAviso('Página restrita', 'Este painel é só para o administrador do App Pegue e Monte.', 'Voltar ao app');
    await carregar();
    montar();
  } catch (e) {
    telaAviso('Não consegui abrir o painel', e.message || 'Tente de novo em instantes.', 'Voltar ao app');
  }
}

function telaAviso(titulo, texto, botao) {
  raiz.innerHTML = `<div class="aviso-tela"><h1>${esc(titulo)}</h1><p class="pequeno">${esc(texto)}</p><a class="btn principal" href="./">${esc(botao)}</a></div>`;
}

async function carregar() {
  [estado.resumo, estado.clientes, estado.eventos] = await Promise.all([
    dados.adminResumo(), dados.adminClientes(), dados.adminEventos(120),
  ]);
}

function montar() {
  raiz.innerHTML = `
    <header class="topo"><div class="topo-in">
      <a class="btn-voltar" href="./" style="text-decoration:none">‹ Voltar</a>
      <h1>Painel do administrador</h1>
      <nav class="abas-adm" role="tablist">
        <button data-aba="resumo">Resumo</button>
        <button data-aba="clientes">Clientes</button>
        <button data-aba="pagamentos">Pagamentos</button>
      </nav>
    </div></header>
    <main id="tela"></main>`;
  $$('.abas-adm button').forEach((b) => {
    b.onclick = () => { estado.aba = b.dataset.aba; desenhar(); window.scrollTo(0, 0); };
  });
  desenhar();
}

function desenhar() {
  $$('.abas-adm button').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === estado.aba));
  const tela = $('#tela');
  if (estado.aba === 'resumo') abaResumo(tela);
  else if (estado.aba === 'clientes') abaClientes(tela);
  else abaPagamentos(tela);
}

async function atualizar(botao) {
  if (botao) { botao.disabled = true; botao.textContent = 'Atualizando…'; }
  try { await carregar(); desenhar(); aviso('Dados atualizados.'); }
  catch (e) { aviso(e.message); if (botao) { botao.disabled = false; botao.textContent = 'Atualizar'; } }
}

// ---------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------
function cartaoNum(rotulo, valor, classe = '') {
  return `<div class="num-cartao ${classe}"><span class="rot">${esc(rotulo)}</span><b>${esc(valor)}</b></div>`;
}

function abaResumo(tela) {
  const r = estado.resumo;
  const m = r.mes || {};
  const nomeMes = new Date().toLocaleDateString('pt-BR', { month: 'long' });
  const hist = r.historico || [];
  const maior = Math.max(1, ...hist.map((h) => Number(h.faturamento) || 0));
  const partes = [`${r.ativas_mensal} mensal`, `${r.ativas_anual} anual`];
  if (r.ativas_manual) partes.push(`${r.ativas_manual} liberada(s) por você`);

  tela.innerHTML = `
    <div class="destaque">
      <span class="rot">Clientes ativas</span>
      <span class="num">${r.ativas}</span>
      <span class="sub">${esc(partes.join(' · '))}</span>
      <span class="rot" style="margin-top:8px">Receita mensal estimada: <b style="color:#fff">${reais(r.receita_mensal_estimada)}</b></span>
    </div>

    <h2>Em ${esc(nomeMes)}</h2>
    <div class="grade-num">
      ${cartaoNum('Vendas novas', m.vendas, 'bom')}
      ${cartaoNum('Renovações pagas', m.renovacoes, 'bom')}
      ${cartaoNum('Faturamento', reais(m.faturamento), 'bom')}
      ${cartaoNum('Pagamentos recusados', m.falhas, m.falhas ? 'alerta' : '')}
      ${cartaoNum('Cancelamentos', m.cancelamentos, m.cancelamentos ? 'ruim' : '')}
      ${cartaoNum('Reembolsos', m.reembolsos, m.reembolsos ? 'ruim' : '')}
    </div>

    <h2>Situação das assinaturas</h2>
    <div class="grade-num">
      ${cartaoNum('Pagamento pendente', r.carencia, r.carencia ? 'alerta' : '')}
      ${cartaoNum('Canceladas', r.canceladas)}
      ${cartaoNum('Bloqueadas', r.suspensas, r.suspensas ? 'ruim' : '')}
    </div>

    <h2>Uso do app</h2>
    <div class="grade-num">
      ${cartaoNum('Contas criadas', r.contas)}
      ${cartaoNum('Com kit cadastrado', r.contas_usando)}
      ${cartaoNum('Contas novas no mês', m.contas_novas)}
      ${cartaoNum('Reservas no mês', r.reservas_mes)}
      ${cartaoNum('Cortesias', r.cortesias)}
    </div>

    <section class="cartao">
      <h2>Faturamento dos últimos 6 meses</h2>
      <div class="barras">
        ${hist.map((h, i) => `<div class="barra ${i === hist.length - 1 ? 'atual' : ''}" title="${esc(reais(h.faturamento))}">
          <span>${Number(h.faturamento) ? esc(Math.round(h.faturamento)) : ''}</span>
          <i style="height:${Math.round((Number(h.faturamento) || 0) / maior * 100)}%"></i>
          <span>${esc(mesCurto(h.mes))}</span></div>`).join('')}
      </div>
      <p class="pequeno" style="margin-top:10px">Valores em reais, pelos avisos de pagamento da Cakto.</p>
    </section>

    <button class="btn contorno cheio" id="atualizar">Atualizar</button>`;
  $('#atualizar', tela).onclick = (e) => atualizar(e.currentTarget);
}

// ---------------------------------------------------------------------
// Clientes e leads
// ---------------------------------------------------------------------
function filtrados() {
  const b = estado.busca.trim().toLowerCase();
  return estado.clientes.filter((c) =>
    (estado.filtro === 'todos' || c.situacao === estado.filtro) &&
    (!b || [c.email, c.nome, c.negocio, c.telefone, c.whatsapp].some((v) => String(v || '').toLowerCase().includes(b))));
}

function abaClientes(tela) {
  const contagem = (f) => (f === 'todos' ? estado.clientes.length : estado.clientes.filter((c) => c.situacao === f).length);
  tela.innerHTML = `
    <form class="cartao coluna" id="liberar-form" novalidate>
      <h2>Liberar acesso para um e-mail</h2>
      <p class="pequeno">Use para testadoras, parcerias ou para quem pagou por fora. A pessoa cria a conta no app com este e-mail.</p>
      <label class="campo"><span>E-mail</span><input type="email" name="email" inputmode="email" autocomplete="off" placeholder="cliente@email.com" required></label>
      <button class="btn verde cheio" type="submit">Liberar acesso</button>
    </form>

    <label class="campo"><span>Buscar</span><input type="search" id="busca" placeholder="Nome, e-mail, telefone ou negócio" value="${esc(estado.busca)}"></label>
    <div class="filtros">${FILTROS.map(([f, t]) => `<button class="filtro ${estado.filtro === f ? 'ativo' : ''}" data-f="${f}">${esc(t)} (${contagem(f)})</button>`).join('')}</div>
    <div class="linha-flex entre"><span class="pequeno" id="qtd"></span><button class="btn mini contorno" id="exportar">Baixar lista (planilha)</button></div>
    <div class="coluna" id="lista"></div>`;

  $('#liberar-form', tela).onsubmit = async (e) => {
    e.preventDefault();
    const campo = e.currentTarget.email;
    const email = campo.value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { aviso('Digite um e-mail válido.'); campo.focus(); return; }
    await definirAcesso(email, true, e.currentTarget.querySelector('button'));
  };
  $('#busca', tela).oninput = (e) => { estado.busca = e.target.value; desenharLista(); };
  $$('.filtro', tela).forEach((b) => {
    b.onclick = () => { estado.filtro = b.dataset.f; $$('.filtro', tela).forEach((x) => x.classList.toggle('ativo', x === b)); desenharLista(); };
  });
  $('#exportar', tela).onclick = exportar;
  desenharLista();
}

function cartaoPessoa(c) {
  const nome = c.nome || c.negocio || c.email;
  const tel = c.telefone || c.whatsapp;
  const liberada = ['ativa', 'carencia', 'cortesia'].includes(c.situacao);
  const primeiroNome = String(c.nome || '').split(' ')[0];
  const msg = c.situacao === 'lead'
    ? `Oi${primeiroNome ? ', ' + primeiroNome : ''}! Vi que você se interessou pelo App Pegue e Monte. Posso te ajudar com alguma dúvida?`
    : `Oi${primeiroNome ? ', ' + primeiroNome : ''}! Aqui é do App Pegue e Monte.`;
  const infos = [];
  if (c.plano && c.plano !== 'manual') infos.push(['Plano', c.plano === 'anual' ? 'Anual' : 'Mensal']);
  if (c.plano === 'manual') infos.push(['Plano', 'Liberado por você']);
  if (tel) infos.push(['Telefone', telefoneBonito(tel)]);
  if (c.negocio) infos.push(['Negócio', c.negocio]);
  infos.push(['Conta no app', c.tem_conta ? 'Criada' : 'Ainda não criou']);
  if (c.tem_conta) infos.push(['Kits / reservas', `${c.kits || 0} / ${c.reservas || 0}`]);
  if (c.tem_conta) infos.push(['Último acesso', haQuanto(c.ultimo_acesso)]);
  if (c.primeira_compra) infos.push(['Cliente desde', data(c.primeira_compra)]);
  if (Number(c.total_pago)) infos.push(['Total pago', reais(c.total_pago)]);
  if (c.situacao === 'carencia' && c.carencia_ate) infos.push(['Bloqueia em', dataHora(c.carencia_ate)]);
  if (c.ultimo_aviso_evento) infos.push(['Último aviso', `${(EVENTO[c.ultimo_aviso_evento] || [c.ultimo_aviso_evento])[0]} (${data(c.ultimo_aviso)})`]);

  return `<article class="cartao pessoa" data-email="${esc(c.email)}">
    <div class="cab"><div style="min-width:0"><div class="nome">${esc(nome)}</div><div class="email">${esc(c.email)}</div></div>${sit(c.situacao)}</div>
    <div class="infos">${infos.map(([k, v]) => `<div>${esc(k)}<br><b>${esc(v)}</b></div>`).join('')}</div>
    <div class="acoes">
      ${tel ? `<a class="btn mini verde" href="${esc(linkZap(tel, msg))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
      <a class="btn mini contorno" href="mailto:${esc(c.email)}">E-mail</a>
      ${c.slug ? `<a class="btn mini contorno" href="reservar.html?l=${encodeURIComponent(c.slug)}" target="_blank" rel="noopener">Ver link</a>` : ''}
      ${liberada
        ? `<button class="btn mini perigo" data-acao="bloquear">Bloquear acesso</button>`
        : `<button class="btn mini claro" data-acao="liberar">Liberar acesso</button>`}
    </div>
  </article>`;
}

function desenharLista() {
  const lista = $('#lista');
  if (!lista) return;
  const itens = filtrados();
  $('#qtd').textContent = `${itens.length} pessoa(s)`;
  lista.innerHTML = itens.length
    ? itens.map(cartaoPessoa).join('')
    : '<p class="pequeno centro" style="padding:20px 0">Ninguém por aqui ainda.</p>';
  $$('[data-acao]', lista).forEach((b) => {
    b.onclick = () => {
      const email = b.closest('[data-email]').dataset.email;
      const liberar = b.dataset.acao === 'liberar';
      // Toque duplo para confirmar (sem janelas de confirmação do navegador)
      if (b.dataset.confirmar !== '1') {
        b.dataset.confirmar = '1';
        b.textContent = liberar ? 'Toque de novo para liberar' : 'Toque de novo para bloquear';
        setTimeout(() => {
          if (b.isConnected && b.dataset.confirmar === '1') {
            b.dataset.confirmar = '';
            b.textContent = liberar ? 'Liberar acesso' : 'Bloquear acesso';
          }
        }, 4000);
        return;
      }
      definirAcesso(email, liberar, b);
    };
  });
}

async function definirAcesso(email, liberar, botao) {
  if (botao) { botao.disabled = true; botao.textContent = 'Aguarde…'; }
  try {
    await dados.adminDefinirAcesso(email, liberar);
    if (dados.MODO_DEMO) {
      const c = estado.clientes.find((x) => x.email === email);
      if (c) c.situacao = liberar ? 'ativa' : 'suspensa';
      else estado.clientes.unshift({ email, situacao: 'ativa', plano: 'manual', tem_conta: false });
    } else {
      await carregar();
    }
    desenhar();
    aviso(liberar ? `Acesso liberado para ${email}.` : `Acesso bloqueado para ${email}.`);
  } catch (e) {
    aviso(e.message || 'Não deu certo. Tente de novo.');
    if (botao && botao.isConnected) { botao.disabled = false; botao.textContent = liberar ? 'Liberar acesso' : 'Bloquear acesso'; }
  }
}

function exportar() {
  const itens = filtrados();
  const colunas = [
    ['Situação', (c) => SITUACAO[c.situacao] || c.situacao], ['Nome', (c) => c.nome], ['E-mail', (c) => c.email],
    ['Telefone', (c) => c.telefone || c.whatsapp], ['Plano', (c) => c.plano], ['Negócio', (c) => c.negocio],
    ['Conta criada', (c) => (c.tem_conta ? 'sim' : 'não')], ['Kits', (c) => c.kits], ['Reservas', (c) => c.reservas],
    ['Total pago', (c) => String(Number(c.total_pago || 0).toFixed(2)).replace('.', ',')],
    ['Cliente desde', (c) => (c.primeira_compra ? data(c.primeira_compra) : '')],
    ['Último acesso', (c) => (c.ultimo_acesso ? data(c.ultimo_acesso) : '')],
  ];
  const cel = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [colunas.map(([t]) => cel(t)).join(';'), ...itens.map((c) => colunas.map(([, f]) => cel(f(c))).join(';'))].join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `clientes-pegue-e-monte-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ---------------------------------------------------------------------
// Pagamentos (histórico dos avisos da Cakto)
// ---------------------------------------------------------------------
function abaPagamentos(tela) {
  const ev = estado.eventos;
  tela.innerHTML = `
    <p class="pequeno">Tudo o que a Cakto avisou, do mais novo para o mais antigo.</p>
    <div class="coluna">
      ${ev.length ? ev.map((e) => {
        const [rotulo, cor] = EVENTO[e.evento] || [e.evento, '#6B6470'];
        return `<div class="cartao evento">
          <span class="bola" style="background:${cor}"></span>
          <div class="txt"><div style="font-weight:800">${esc(rotulo)}${e.plano && !String(e.evento).startsWith('admin_') ? ` · ${e.plano === 'anual' ? 'Anual' : 'Mensal'}` : ''}</div>
            <div class="quem">${esc(e.nome ? `${e.nome} · ${e.email}` : e.email || 'sem e-mail')}</div>
            <div class="pequeno">${esc(dataHora(e.recebido_em))}</div></div>
          ${e.valor ? `<span class="valor">${esc(reais(e.valor))}</span>` : ''}
        </div>`;
      }).join('') : '<p class="pequeno centro" style="padding:20px 0">Nenhum aviso da Cakto ainda. Eles aparecem aqui assim que a primeira compra acontecer.</p>'}
    </div>
    <button class="btn contorno cheio" id="atualizar">Atualizar</button>`;
  $('#atualizar', tela).onclick = (e) => atualizar(e.currentTarget);
}

iniciar();
