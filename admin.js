// =====================================================================
// App Pegue e Monte — painel do administrador
// Só abre para e-mails cadastrados na tabela "administradores".
// Quem confere é o banco de dados: esta página só mostra o resultado.
// =====================================================================
import * as dados from './dados.js?v=20261117a';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=20261117a';

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
  teste: 'Em teste',
  teste_encerrado: 'Teste acabou',
  cortesia: 'Cortesia',
};
const FILTROS = [
  ['todos', 'Todos'], ['ativa', 'Ativas'], ['teste', 'Em teste'], ['parada', 'Paradas'], ['teste_encerrado', 'Teste acabou'], ['carencia', 'Pagamento pendente'], ['lead', 'Leads'],
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
  admin_teste: ['Você liberou o teste de 7 dias', '#1E5FA8'],
  teste_automatico: ['Criou conta e começou o teste', '#0E7C86'],
};
// ---------------------------------------------------------------------
// Teste grátis: dia do teste, primeiros passos e mensagens prontas
// ---------------------------------------------------------------------
function diaDoTeste(c) {
  if (!c.teste_inicio) return null;
  return Math.min(7, Math.max(1, Math.floor((Date.now() - new Date(c.teste_inicio).getTime()) / 864e5) + 1));
}
function passosDe(c) { return [Number(c.kits) > 0, Number(c.reservas) > 0, !!c.link_copiado_em]; }
// "Parada": em teste há 2 dias ou mais e ainda sem nenhum kit.
function estaParada(c) { return c.situacao === 'teste' && Number(c.kits || 0) === 0 && (diaDoTeste(c) || 1) >= 2; }
const MSGS_TESTE = [
  [1, 'Dia 1 · boas-vindas', (n) => `Oi${n}! Aqui é do App Pegue e Monte 💛 Seu teste de 7 dias já está liberado. Comece cadastrando 1 kit com foto, leva 2 minutinhos. Qualquer dúvida é só me chamar aqui!`],
  [3, 'Dia 3 · quem não cadastrou kit', (n) => `Oi${n}! Vi que você ainda não cadastrou seu primeiro kit. Quer que eu te ajude? Me manda a foto de um kit e a lista de peças que eu te mostro como fica 😉`],
  [5, 'Dia 5 · dica do link', (n) => `Oi${n}! Dica de ouro: coloque seu link de reservas na bio do Instagram. Suas clientes veem os kits, escolhem a data livre e o pedido chega pronto no seu WhatsApp 🎈`],
  [6, 'Dia 6 · acaba amanhã', (n) => `Oi${n}! Seu teste termina amanhã. Para continuar com seus kits, fotos e reservas, é só assinar com o mesmo e-mail do teste. Quer o link?`],
];
function msgDoDia(dia, c = {}) {
  const m = (d) => MSGS_TESTE.find(([x]) => x === d);
  if (dia >= 6) return m(6);
  if (dia >= 5) return m(5);
  if (dia >= 3) return Number(c.kits || 0) === 0 ? m(3) : m(5); // já tem kit: manda a dica do link
  return m(1);
}
function rotuloOrigem(o) {
  if (!o || !o.utm_source) return '<span class="tag-origem">💬 WhatsApp / direto</span>';
  return [`📣 ${o.utm_source === 'meta' ? 'Anúncio' : esc(o.utm_source)}${o.utm_campaign ? ': ' + esc(o.utm_campaign) : ''}`,
    o.utm_medium ? `Conjunto: ${esc(o.utm_medium)}` : '', o.utm_content ? `Anúncio: ${esc(o.utm_content)}` : '']
    .filter(Boolean).map((t) => `<span class="tag-origem">${t}</span>`).join('');
}

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
    const pedido = new URLSearchParams(location.search);
    if (['resumo', 'clientes', 'pagamentos'].includes(pedido.get('aba'))) estado.aba = pedido.get('aba');
    if (pedido.get('f')) estado.filtro = pedido.get('f');
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
  [estado.resumo, estado.clientes, estado.eventos, estado.origem, estado.fin, estado.taxas] = await Promise.all([
    dados.adminResumo(), dados.adminClientes(), dados.adminEventos(120), dados.adminTestesOrigem().catch(() => null),
    dados.adminFinanceiro().catch(() => null), dados.adminTaxas().catch(() => []),
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
  if (estado.aba === 'resumo') { abaResumo(tela); ligarResumoExtras(tela); }
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
      <span class="rot" style="margin-top:8px">${estado.fin
        ? `Comissão mensal estimada (já sem as taxas da Cakto): <b style="color:#fff">${reais(estado.fin.mensal_estimado_liquido)}</b>`
        : `Receita mensal estimada: <b style="color:#fff">${reais(r.receita_mensal_estimada)}</b>`}</span>
    </div>
    ${cartaoNotificacoes()}

    <h2>Em ${esc(nomeMes)}</h2>
    <div class="grade-num">
      ${cartaoNum('Vendas novas', m.vendas, 'bom')}
      ${cartaoNum('Renovações pagas', m.renovacoes, 'bom')}
      ${cartaoNum('Faturamento bruto', reais(estado.fin ? estado.fin.mes_bruto : m.faturamento), 'bom')}
      ${estado.fin ? cartaoNum('Comissão líquida (sem taxas)', reais(estado.fin.mes_liquido), 'bom') : ''}
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

    <h2>Teste grátis de 7 dias</h2>
    <div class="grade-num">
      ${cartaoNum('Em teste agora', (r.teste || {}).em_teste || 0)}
      ${cartaoNum('Acabou sem assinar', (r.teste || {}).encerrados || 0, (r.teste || {}).encerrados ? 'alerta' : '')}
      ${cartaoNum('Viraram assinantes', (r.teste || {}).convertidos || 0, 'bom')}
      ${cartaoNum('Conversão do teste', (r.teste || {}).total ? Math.round(((r.teste.convertidos || 0) / r.teste.total) * 100) + '%' : '—', 'bom')}
    </div>

    ${estado.origem ? `<h2>Testes por origem</h2>
    <div class="grade-num">
      ${cartaoNum('Anúncio: testes', estado.origem.anuncio.total)}
      ${cartaoNum('Anúncio: viraram assinantes', estado.origem.anuncio.convertidos, 'bom')}
      ${cartaoNum('WhatsApp/direto: testes', estado.origem.direto.total)}
      ${cartaoNum('WhatsApp/direto: assinantes', estado.origem.direto.convertidos, 'bom')}
    </div>
    ${(estado.origem.por_campanha || []).length ? `<section class="cartao coluna"><h3>Por campanha</h3>${estado.origem.por_campanha.map((x) => `<div class="linha-flex entre pequeno"><span>${esc(x.campanha)}</span><b>${x.total} testes · ${x.convertidos} assinantes</b></div>`).join('')}</section>` : ''}` : ''}

    ${estado.fin ? `<h2>Comissão líquida</h2>
    <div class="grade-num">
      ${cartaoNum('Total bruto recebido', reais(estado.fin.total_bruto))}
      ${cartaoNum('Total líquido (sem taxas)', reais(estado.fin.total_liquido), 'bom')}
      ${cartaoNum('Migraram para o anual', estado.fin.migraram_anual || 0)}
    </div>
    <p class="pequeno" style="margin:0">O líquido é a comissão que a própria Cakto informa em cada venda (já sem as taxas).</p>
    ${estado.fin.taxas_configuradas ? '' : '<div class="cartao pequeno" style="background:#FFF6E3;border-color:#F1D9A4">Alguma venda antiga veio sem a comissão da Cakto. Para ela, o app usa as taxas abaixo: preencha para o valor ficar certo.</div>'}
    <details class="cartao coluna" id="taxas"><summary style="font-weight:800;cursor:pointer">Taxas da Cakto (só para vendas sem a comissão informada)</summary>
      ${(estado.taxas || []).map((t) => `<div class="linha-taxa" data-forma="${esc(t.forma)}">
        <b>${esc(({ pix: 'Pix', pix_auto: 'Pix Automático', credit_card: 'Cartão', boleto: 'Boleto', outro: 'Outros' })[t.forma] || t.forma)}</b>
        <label>% <input type="number" step="0.01" min="0" max="100" value="${Number(t.percentual)}" data-campo="percentual"></label>
        <label>R$ <input type="number" step="0.01" min="0" value="${Number(t.fixo)}" data-campo="fixo"></label>
      </div>`).join('')}
      <button class="btn principal cheio" id="salvar-taxas">Salvar taxas</button>
    </details>` : ''}

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
// ---------------------------------------------------------------------
// Notificações no celular (só administrador)
// ---------------------------------------------------------------------
function suportaAvisos() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
function cartaoNotificacoes() {
  if (!suportaAvisos()) return '';
  const ativo = Notification.permission === 'granted' && localStorage.getItem('apm-avisos-ativos') === '1';
  return `<section class="cartao coluna" id="cartao-avisos" style="border:2px solid #1F7A52;background:#EAF7EF;gap:10px">
    <div style="display:flex;gap:12px;align-items:center"><div style="font-size:34px" aria-hidden="true">🔔</div><div>
      <b style="font-size:17px">Notificações no celular</b>
      <div class="pequeno">${ativo ? 'Ativadas neste celular. Você recebe: novo teste grátis, venda realizada, teste que virou assinante e pagamento recusado.'
        : 'Avisos de novo teste grátis, venda realizada, teste que virou assinante e pagamento recusado.'}</div></div></div>
    ${ativo ? '<button class="btn contorno cheio" id="testar-avisos">Enviar uma notificação de teste</button>'
      : '<button class="btn verde cheio" id="ativar-avisos">Ativar notificações</button>'}
    ${Notification.permission === 'denied' ? '<div class="pequeno" style="color:#B3202E">As notificações estão bloqueadas no navegador. Toque no cadeado ao lado do endereço, abra Permissões e libere Notificações.</div>' : ''}
  </section>`;
}
function chaveParaBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
async function ativarAvisos(botao) {
  const texto = botao.textContent;
  botao.disabled = true; botao.textContent = 'Ativando…';
  try {
    if (dados.MODO_DEMO) throw new Error('Na demonstração as notificações não são enviadas.');
    const reg = await navigator.serviceWorker.register('sw.js?v=2', { scope: './' });
    await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Você não permitiu as notificações. Dá para liberar depois nas configurações do navegador.');
    const r = await fetch(`${SUPABASE_URL}/functions/v1/notificar-admin?acao=chave`);
    const { publica } = await r.json();
    if (!publica) throw new Error('Não consegui pegar a chave das notificações.');
    let inscricao = await reg.pushManager.getSubscription();
    if (!inscricao) inscricao = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(publica) });
    const token = await dados.adminSalvarPush(inscricao.endpoint);
    const cache = await caches.open('apm-avisos');
    await cache.put('/apm-avisos/token', new Response(String(token)));
    await cache.put('/apm-avisos/cfg', new Response(JSON.stringify({ url: SUPABASE_URL, chave: SUPABASE_ANON_KEY })));
    localStorage.setItem('apm-avisos-ativos', '1');
    aviso('Notificações ativadas neste celular!');
    desenhar();
  } catch (e) {
    aviso(e.message || 'Não deu certo. Tente de novo.');
    botao.disabled = false; botao.textContent = texto;
  }
}
// Registro dos acessos do modo suporte (só aparece aqui no painel).
async function desenharLogSuporte(tela) {
  let log = [];
  try { log = await dados.adminSuporteLog(); } catch (e) { return; }
  if (!log || !log.length) return;
  const quando = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const sec = document.createElement('section');
  sec.className = 'cartao coluna';
  sec.innerHTML = `<h3 style="margin:0">Acessos do modo suporte</h3>
    ${log.slice(0, 15).map((x) => `<div class="linha-flex entre pequeno"><span>${esc(x.loja)}</span><b>${esc(quando(x.inicio))} até ${esc(new Date(x.fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))}</b></div>`).join('')}`;
  tela.appendChild(sec);
}
function ligarResumoExtras(tela) {
  desenharLogSuporte(tela);
  const at = $('#ativar-avisos', tela);
  if (at) at.onclick = () => ativarAvisos(at);
  const te = $('#testar-avisos', tela);
  if (te) te.onclick = async () => {
    te.disabled = true;
    try { await dados.adminTestarPush(); aviso('Pronto! A notificação de teste deve chegar em alguns segundos.'); }
    catch (e) { aviso(e.message); }
    te.disabled = false;
  };
  const st = $('#salvar-taxas', tela);
  if (st) st.onclick = async () => {
    st.disabled = true; st.textContent = 'Salvando…';
    try {
      for (const linha of $$('.linha-taxa', tela)) {
        const pct = Number(linha.querySelector('[data-campo="percentual"]').value || 0);
        const fixo = Number(linha.querySelector('[data-campo="fixo"]').value || 0);
        await dados.adminDefinirTaxa(linha.dataset.forma, pct, fixo);
      }
      await carregar(); desenhar(); aviso('Taxas salvas. Os valores líquidos já foram recalculados.');
    } catch (e) { aviso(e.message); st.disabled = false; st.textContent = 'Salvar taxas'; }
  };
}

function filtrados() {
  const b = estado.busca.trim().toLowerCase();
  return estado.clientes.filter((c) =>
    (estado.filtro === 'todos' || c.situacao === estado.filtro || (estado.filtro === 'parada' && estaParada(c))) &&
    (!b || [c.email, c.nome, c.negocio, c.telefone, c.whatsapp].some((v) => String(v || '').toLowerCase().includes(b))));
}

function abaClientes(tela) {
  const contagem = (f) => (f === 'todos' ? estado.clientes.length
    : f === 'parada' ? estado.clientes.filter(estaParada).length
    : estado.clientes.filter((c) => c.situacao === f).length);
  tela.innerHTML = `
    <form class="cartao coluna" id="liberar-form" novalidate>
      <h2>Liberar acesso para um e-mail</h2>
      <p class="pequeno">Teste de 7 dias: para quem pediu pelo WhatsApp. Sem prazo: testadoras, parcerias ou quem pagou por fora. A pessoa cria a conta no app com este e-mail.</p>
      <label class="campo"><span>E-mail</span><input type="email" name="email" inputmode="email" autocomplete="off" placeholder="cliente@email.com" required></label>
      <button class="btn verde cheio" type="submit" data-tipo="teste">🎁 Liberar teste de 7 dias</button>
      <button class="btn contorno cheio" type="submit" data-tipo="acesso">Liberar acesso sem prazo</button>
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
    const botao = e.submitter || e.currentTarget.querySelector('button');
    if (botao.dataset.tipo === 'teste') await liberarTeste(email, botao);
    else await definirAcesso(email, true, botao);
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
  const liberada = ['ativa', 'carencia', 'cortesia', 'teste'].includes(c.situacao);
  const primeiroNome = String(c.nome || '').split(' ')[0];
  const msg = c.situacao === 'lead'
    ? `Oi${primeiroNome ? ', ' + primeiroNome : ''}! Vi que você se interessou pelo App Pegue e Monte. Posso te ajudar com alguma dúvida?`
    : c.situacao === 'teste_encerrado'
      ? `Oi${primeiroNome ? ', ' + primeiroNome : ''}! Seu teste do App Pegue e Monte terminou. Gostou? Assinando com o mesmo e-mail, seus kits e reservas continuam lá. Posso te ajudar?`
      : `Oi${primeiroNome ? ', ' + primeiroNome : ''}! Aqui é do App Pegue e Monte.`;
  const infos = [];
  if (c.plano && c.plano !== 'manual') infos.push(['Plano', c.plano === 'anual' ? (c.migrou_anual_em ? 'Anual (migrou do mensal)' : 'Anual') : 'Mensal']);
  if (c.forma_pagamento) infos.push(['Pagamento', ({ pix: 'Pix', pix_auto: 'Pix Automático', credit_card: 'Cartão', boleto: 'Boleto' })[c.forma_pagamento] || c.forma_pagamento]);
  if (c.plano === 'manual') infos.push(['Plano', 'Liberado por você']);
  if (tel) infos.push(['Telefone', telefoneBonito(tel)]);
  if (c.negocio) infos.push(['Negócio', c.negocio]);
  infos.push(['Conta no app', c.tem_conta ? 'Criada' : 'Ainda não criou']);
  if (c.tem_conta) infos.push(['Kits / reservas', `${c.kits || 0} / ${c.reservas || 0}`]);
  if (c.tem_conta) infos.push(['Último acesso', haQuanto(c.ultimo_acesso)]);
  if (c.primeira_compra) infos.push(['Cliente desde', data(c.primeira_compra)]);
  if (Number(c.total_pago)) infos.push(['Total pago', reais(c.total_pago)]);
  if (Number(c.total_liquido)) infos.push(['Líquido (sem taxas)', reais(c.total_liquido)]);
  if (c.situacao === 'carencia' && c.carencia_ate) infos.push(['Bloqueia em', dataHora(c.carencia_ate)]);
  if (c.situacao === 'teste' && c.teste_ate) infos.push(['Teste termina', dataHora(c.teste_ate)]);
  if (c.situacao === 'teste_encerrado' && c.teste_ate) infos.push(['Teste acabou em', data(c.teste_ate)]);
  if (c.ultimo_aviso_evento) infos.push(['Último aviso', `${(EVENTO[c.ultimo_aviso_evento] || [c.ultimo_aviso_evento])[0]} (${data(c.ultimo_aviso)})`]);

  const emTeste = c.situacao === 'teste';
  const dia = diaDoTeste(c);
  const parada = estaParada(c);
  const passos = passosDe(c);
  const nomeMsg = primeiroNome ? ', ' + primeiroNome : '';
  const [, rotuloMsg, textoMsg] = emTeste ? msgDoDia(dia || 1, c) : [];
  const blocoTeste = emTeste ? `
    <div class="linha-flex" style="gap:8px;flex-wrap:wrap;align-items:center">
      <b class="pequeno">Dia ${dia || 1} de 7</b>
      <span class="passos-adm">${passos.map((ok) => `<i class="${ok ? 'ok' : ''}"></i>`).join('')} ${passos.filter(Boolean).length} de 3 passos</span>
      ${parada ? '<span class="sit sit-teste_encerrado">Parada</span>' : ''}
    </div>
    ${parada ? '<div class="aviso-parada">Ainda não cadastrou nenhum kit. Vale chamar hoje.</div>' : ''}
    ${tel ? `<div class="acoes">
      <a class="btn mini verde" href="${esc(linkZap(tel, textoMsg(nomeMsg)))}" target="_blank" rel="noopener">💬 Mensagem: ${esc(rotuloMsg)}</a>
      <button class="btn mini contorno" data-msgs="${esc(c.email)}">Outras mensagens</button>
    </div>` : ''}` : '';
  const origem = (c.teste_inicio || c.origem) ? `<div class="linha-flex" style="gap:6px;flex-wrap:wrap">${rotuloOrigem(c.origem)}</div>` : '';

  return `<article class="cartao pessoa" data-email="${esc(c.email)}">
    <div class="cab"><div style="min-width:0"><div class="nome">${esc(nome)}</div><div class="email">${esc(c.email)}</div></div>${sit(c.situacao)}</div>
    ${blocoTeste}
    ${origem}
    <div class="infos">${infos.map(([k, v]) => `<div>${esc(k)}<br><b>${esc(v)}</b></div>`).join('')}</div>
    <div class="acoes">
      ${c.slug ? `<button class="btn mini principal" data-suporte="1">Entrar na loja para ajudar</button>` : ''}
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
  $$('[data-msgs]', lista).forEach((b) => {
    b.onclick = () => {
      const c = estado.clientes.find((x) => x.email === b.dataset.msgs);
      const tel = c.telefone || c.whatsapp;
      const n = String(c.nome || '').split(' ')[0];
      const caixa = b.closest('.pessoa');
      const ja = caixa.querySelector('.lista-msgs');
      if (ja) { ja.remove(); return; }
      caixa.insertAdjacentHTML('beforeend', `<div class="lista-msgs coluna">${MSGS_TESTE.map(([, rot, txt]) => `
        <a class="msg-pronta" href="${esc(linkZap(tel, txt(n ? ', ' + n : '')))}" target="_blank" rel="noopener"><b>${esc(rot)}</b><span>${esc(txt(n ? ', ' + n : ''))}</span></a>`).join('')}</div>`);
    };
  });
  $$('[data-suporte]', lista).forEach((b) => {
    b.onclick = async () => {
      const email = b.closest('[data-email]').dataset.email;
      b.disabled = true; b.textContent = 'Entrando…';
      try {
        await dados.adminEntrarLoja(email);
        location.href = 'index.html';
      } catch (e) {
        aviso(e.message || 'Não deu para entrar na loja.');
        b.disabled = false; b.textContent = 'Entrar na loja para ajudar';
      }
    };
  });
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

async function liberarTeste(email, botao) {
  const texto = botao.textContent;
  botao.disabled = true; botao.textContent = 'Aguarde…';
  try {
    const r = await dados.adminLiberarTeste(email, 7);
    if (dados.MODO_DEMO) {
      const c = estado.clientes.find((x) => x.email === email);
      const novo = { situacao: 'teste', status: 'teste', teste_inicio: new Date().toISOString(), teste_ate: r.teste_ate };
      if (c) Object.assign(c, novo); else estado.clientes.unshift({ email, tem_conta: false, ...novo });
    } else {
      await carregar();
    }
    desenhar();
    aviso(`Teste de 7 dias liberado para ${email} (até ${dataHora(r.teste_ate)}).`);
  } catch (e) {
    aviso(e.message || 'Não deu certo. Tente de novo.');
    if (botao.isConnected) { botao.disabled = false; botao.textContent = texto; }
  }
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
