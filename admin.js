// =====================================================================
// App Pegue e Monte — painel do administrador
// Só abre para e-mails cadastrados na tabela "administradores".
// Quem confere é o banco de dados: esta página só mostra o resultado.
// =====================================================================
import * as dados from './dados.js?v=20261125a';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=20261121e';

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
function passosDe(c) { return [!!(estado.logos || {})[String(c.email || '').toLowerCase()], Number(c.kits) > 0, Number(c.reservas) > 0, !!c.link_copiado_em]; }
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
  if (!o || !o.utm_source) return '<span class="tag-origem">WhatsApp / direto</span>';
  return [`${o.utm_source === 'meta' ? 'Anúncio' : esc(o.utm_source)}${o.utm_campaign ? ': ' + esc(o.utm_campaign) : ''}`,
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
    if (Object.prototype.hasOwnProperty.call(TITULOS_ADM, pedido.get('aba') || '')) estado.aba = pedido.get('aba');
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
  estado.carregadoEm = new Date();
  [estado.resumo, estado.clientes, estado.origem, estado.painel, estado.cancelarCakto] = await Promise.all([
    dados.adminResumo(), dados.adminClientes(), dados.adminTestesOrigem().catch(() => null), dados.adminPainel().catch(() => null),
    dados.adminCancelarCakto().catch(() => []),
  ]);
  estado.recup = await carregarRecuperacao().catch(() => null);
  [estado.crm, estado.crmMsgs, estado.logos, estado.saude] = await Promise.all([dados.adminCrm().catch(() => null), dados.adminCrmMensagens().catch(() => ({})),
    dados.adminLogos().catch(() => ({})), dados.adminSaude().catch(() => null)]);
}

const MENU_ADM = [
  ['Visão geral', [
    ['resumo', 'Resumo', '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'],
    ['saude', 'Saúde da base', '<path d="M3 12h4l3-8 4 16 3-8h4"/>'],
    ['funil', 'Funil do teste', '<path d="M3 4h18l-7 8v6l-4 2v-8z"/>'],
    ['abordagem', 'Abordagem', '<path d="M4 6h16M4 12h10M4 18h7"/>'],
    ['estudo', 'Estudo de conversão', '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>'],
    ['popups', 'Popups e ofertas', '<rect x="4" y="5" width="16" height="12" rx="2"/><path d="M8 21h8"/>'],
    ['quiz', 'Funil do quiz', '<path d="M9 9a3 3 0 115 2c-1 .7-2 1.3-2 3M12 18h.01"/><circle cx="12" cy="12" r="9.5"/>'],
    ['ia', 'IA', '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'],
  ]],
  ['Comunicação', [
    ['mensagens', 'Mensagens', '<path d="M4 5h16v11H8l-4 4z"/>'],
    ['emails', 'E-mails', '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'],
  ]],
  ['Clientes', [
    ['clientes', 'Clientes', '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c1-4 4-6 7-6s6 2 7 6M16 4a3.5 3.5 0 010 7M22 20c-.5-2.5-2-4-4-5"/>'],
    ['montagem', 'Montagem', '<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"/>'],
    ['pagamentos', 'Pagamentos', '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>'],
  ]],
];
const TITULOS_ADM = { resumo: 'Resumo', saude: 'Saúde da base', funil: 'Funil do teste grátis', abordagem: 'Quadro de abordagem', estudo: 'Estudo de conversão', popups: 'Popups e ofertas', quiz: 'Funil do quiz 2 (página com vídeo)', ia: 'IA: loja pelo Instagram e catálogo', mensagens: 'Central de mensagens', emails: 'E-mails automáticos', clientes: 'Clientes', montagem: 'Montagem contratada', pagamentos: 'Pagamentos' };
function montar() {
  const itens = MENU_ADM.flatMap(([, l]) => l);
  raiz.innerHTML = `
    <div class="adm">
    <aside class="lado">
      <a class="marca" href="./"><img src="icone.svg" alt=""><span><b>Pegue e Monte</b><small>Painel do administrador</small></span></a>
      ${MENU_ADM.map(([g, l]) => `<div class="grupo">${esc(g)}</div>${l.map(([id, t, ic]) => `<button data-aba="${id}"><svg viewBox="0 0 24 24">${ic}</svg>${esc(t)}</button>`).join('')}`).join('')}
      <div class="rodape"><a class="item" href="./"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>Voltar ao app</a></div>
    </aside>
    <header class="topo"><div class="topo-in">
      <a class="btn-voltar" href="./" style="text-decoration:none">‹ Voltar</a>
      <h1>Painel do administrador</h1>
      <nav class="abas-adm" role="tablist">
        ${itens.map(([id, t]) => `<button data-aba="${id}">${esc(t)}</button>`).join('')}
      </nav>
    </div></header>
    <main id="tela"></main>
    </div>`;
  $$('[data-aba]').forEach((b) => {
    b.onclick = () => { estado.aba = b.dataset.aba; desenhar(); window.scrollTo(0, 0); };
  });
  desenhar();
}

function desenhar() {
  $$('[data-aba]').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === estado.aba));
  // No celular as abas rolam para o lado: deixa a aba aberta sempre à vista
  const abaAtiva = document.querySelector('.abas-adm button.ativa');
  if (abaAtiva && abaAtiva.scrollIntoView) abaAtiva.scrollIntoView({ block: 'nearest', inline: 'center' });
  const tela = $('#tela');
  if (estado.aba === 'resumo') { abaResumo(tela); ligarResumoExtras(tela); }
  else if (estado.aba === 'saude') abaSaude(tela);
  else if (estado.aba === 'funil') abaFunil(tela);
  else if (estado.aba === 'abordagem') abaAbordagem(tela);
  else if (estado.aba === 'estudo') abaEstudo(tela);
  else if (estado.aba === 'popups') abaPopups(tela);
  else if (estado.aba === 'quiz') abaQuiz(tela);
  else if (estado.aba === 'ia') abaIA(tela);
  else if (estado.aba === 'mensagens') abaMensagens(tela);
  else if (estado.aba === 'emails') abaEmails(tela);
  else if (estado.aba === 'montagem') abaMontagem(tela);
  else if (estado.aba === 'clientes') abaClientes(tela);
  else abaPagamentos(tela);
  // Barra do topo: título da página, hora da última atualização e botão Atualizar
  const barra = document.createElement('div');
  barra.className = 'barra-topo';
  const hora = (estado.carregadoEm || new Date()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  barra.innerHTML = `<div><h1>${esc(TITULOS_ADM[estado.aba] || 'Painel')}</h1><span class="atu">Atualizado às ${esc(hora)}</span></div>
    <button class="btn principal mini" id="atualizar-topo">Atualizar</button>`;
  tela.prepend(barra);
  $('#atualizar-topo', barra).onclick = (e) => atualizar(e.currentTarget);
}

async function atualizar(botao) {
  if (botao) { botao.disabled = true; botao.textContent = 'Atualizando…'; }
  try { await carregar(); desenhar(); aviso('Dados atualizados.'); }
  catch (e) { aviso(e.message); if (botao) { botao.disabled = false; botao.textContent = 'Atualizar'; } }
}

// ---------------------------------------------------------------------
// CRM do teste grátis: cálculos usados pelo Funil, Abordagem e Estudo
// ---------------------------------------------------------------------
const ETAPAS = [
  [1, 'Criou a conta', 'todo mundo que se cadastrou', 'Sem loja'],
  [2, 'Criou a loja', 'terminou a primeira tela', 'Sem kit'],
  [3, 'Cadastrou kit', 'pode ser só de teste', 'Só kit teste'],
  [4, 'Catálogo', '2+ kits com foto', 'Catálogo'],
  [5, 'Divulgou', 'catálogo + 5 visitas no link ou visita do Instagram', 'Divulgou'],
  [6, 'Reserva real', '1 reserva de cliente (pelo link ou anotada no app)', 'Reserva real'],
  [7, 'Usando', '3+ reservas de clientes ou contrato', 'Usando'],
];
const DIA_MS = 864e5;
function crmAssinou(p) { return !!(p.assinou_em || ['mensal', 'anual'].includes(p.plano)); }
function crmEmTeste(p) { return !crmAssinou(p) && p.teste_ate && new Date(p.teste_ate).getTime() > Date.now(); }
function crmDiasSemUso(p) { return p.ultimo_uso ? Math.floor((Date.now() - new Date(p.ultimo_uso).getTime()) / DIA_MS) : 99; }
function crmDiaDoTeste(p) { return Math.min(7, Math.max(1, Math.floor((Date.now() - new Date(p.teste_inicio).getTime()) / DIA_MS) + 1)); }
function crmAtividade(p) { const d = crmDiasSemUso(p); return d <= 1 ? 'ativa' : d <= 3 ? 'esfriando' : 'sumiu'; }
function crmFiltrados() {
  const per = String(estado.funilDias ?? 30);
  const origem = estado.funilOrigem || 'todas';
  return (estado.crm || []).filter((p) => {
    if (per !== '0' && !noPeriodo(p.teste_inicio, per)) return false;
    if (origem === 'todas') return true;
    if (origem === 'sem') return !p.campanha;
    return p.campanha === origem;
  });
}
function filtrosCrm() {
  const camps = [...new Set((estado.crm || []).map((p) => p.campanha).filter(Boolean))].sort();
  const per = [['hoje', 'Hoje'], ['ontem', 'Ontem'], ['7', '7 dias'], ['30', '30 dias'], ['90', '90 dias'], ['0', 'Desde o início']];
  const ori = [['todas', 'Todas as origens'], ...camps.map((c) => [c, c]), ['sem', 'Sem anúncio']];
  const d = String(estado.funilDias ?? 30), o = estado.funilOrigem || 'todas';
  return `<div class="filtros-crm">
    <label>Começaram o teste<select id="f-dias">${per.map(([v, t]) => `<option value="${v}" ${v === d ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
    <label>Origem do anúncio<select id="f-origem">${ori.map(([v, t]) => `<option value="${esc(v)}" ${v === o ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
  </div>`;
}
function ligarFiltrosCrm(tela) {
  const d = $('#f-dias', tela), o = $('#f-origem', tela);
  if (d) d.onchange = () => { estado.funilDias = d.value; desenhar(); };
  if (o) o.onchange = () => { estado.funilOrigem = o.value; desenhar(); };
}
function bolinhas(lista) {
  const c = { ativa: 0, esfriando: 0, sumiu: 0 };
  lista.forEach((p) => { c[crmAtividade(p)]++; });
  return `<span class="bolas"><span><i class="dot d-g"></i>${c.ativa}</span><span><i class="dot d-y"></i>${c.esfriando}</span><span><i class="dot d-r"></i>${c.sumiu}</span></span>`;
}

function abaFunil(tela) {
  if (!estado.crm) { tela.innerHTML = '<div class="cartao">Não consegui carregar os dados do funil. Toque em Atualizar.</div>'; return; }
  const todos = crmFiltrados();
  const emTeste = todos.filter(crmEmTeste);
  const terminaram = todos.filter((p) => new Date(p.teste_ate).getTime() <= Date.now() || crmAssinou(p));
  const assinaram = terminaram.filter(crmAssinou);
  const conv = terminaram.length ? Math.round((assinaram.length / terminaram.length) * 100) : 0;
  const tempos = todos.filter((p) => p.primeiro_kit_em).map((p) => (new Date(p.primeiro_kit_em) - new Date(p.teste_inicio)) / DIA_MS);
  const tempoKit = tempos.length ? (tempos.reduce((a, b) => a + b, 0) / tempos.length) : null;
  const abandonos = {};
  todos.filter((p) => !crmAssinou(p) && new Date(p.teste_ate).getTime() <= Date.now() && p.ultimo_uso).forEach((p) => {
    const d = Math.min(7, Math.max(1, Math.floor((new Date(p.ultimo_uso) - new Date(p.teste_inicio)) / DIA_MS) + 1));
    abandonos[d] = (abandonos[d] || 0) + 1;
  });
  const diaAband = Object.entries(abandonos).sort((a, b) => b[1] - a[1])[0];
  const lojas = todos.filter((p) => p.negocio_id);
  const comIg = lojas.filter((p) => Number(p.visitas_instagram) > 0).length;
  const novas7 = todos.filter((p) => Date.now() - new Date(p.teste_inicio).getTime() <= 7 * DIA_MS).length;
  const total = todos.length || 1;
  const chegaram = ETAPAS.map(([n]) => todos.filter((p) => Number(p.etapa) >= n).length);
  const perdas = chegaram.map((c, i) => (i ? chegaram[i - 1] - c : 0));
  const maiorPerda = perdas.indexOf(Math.max(...perdas));
  // Desenho do funil (fluxo que afina a cada etapa)
  const W = 700, H = 118, col = W / ETAPAS.length;
  const alt = chegaram.map((c) => Math.max(6, (c / total) * H));
  const yt = alt.map((h) => (H - h) / 2), yb = alt.map((h) => (H + h) / 2), q = col / 4, n = alt.length;
  let caminho = `M0,${yt[0]} L${col - q},${yt[0]}`;
  for (let k = 1; k < n; k++) caminho += ` C${k * col},${yt[k - 1]} ${k * col},${yt[k]} ${k * col + q},${yt[k]} L${(k + 1) * col - q},${yt[k]}`;
  caminho += ` L${W},${yt[n - 1]} L${W},${yb[n - 1]} L${(n - 1) * col + q},${yb[n - 1]}`;
  for (let k = n - 1; k >= 1; k--) caminho += ` C${k * col},${yb[k]} ${k * col},${yb[k - 1]} ${k * col - q},${yb[k - 1]} L${(k - 1) * col + q},${yb[k - 1]}`;
  caminho += ` L0,${yb[0]} Z`;
  const ativos = emTeste;
  const porEtapa = ETAPAS.map(([n]) => ativos.filter((p) => Number(p.etapa) === n));
  const acabaLogo = emTeste.filter((p) => new Date(p.teste_ate).getTime() - Date.now() <= 2 * DIA_MS).length;
  const semAssinar30 = todos.filter((p) => !crmAssinou(p) && new Date(p.teste_ate).getTime() <= Date.now()).length;
  const copiouSemVisita = lojas.filter((p) => p.link_copiado_em && !Number(p.visitas)).length;
  const visitas = lojas.reduce((t, p) => t + Number(p.visitas || 0), 0);

  tela.innerHTML = `
    ${filtrosCrm()}
    <div class="kpis-crm">
      <div class="kpi"><small>Em teste agora</small><b>${emTeste.length}</b><i class="p">${novas7} começaram nos últimos 7 dias</i></div>
      <div class="kpi"><small>Teste → assinatura</small><b>${conv}%</b><i>${assinaram.length} de ${terminaram.length} que terminaram</i></div>
      <div class="kpi"><small>Tempo até o 1º kit</small><b>${tempoKit == null ? '—' : tempoKit < 1 ? 'menos de 1 dia' : tempoKit.toFixed(1).replace('.', ',') + ' dia'}</b><i>média de quem cadastrou</i></div>
      <div class="kpi"><small>Dia em que mais param</small><b>${diaAband ? 'Dia ' + diaAband[0] : '—'}</b><i class="n">${diaAband ? `${diaAband[1]} não voltaram depois desse dia` : 'ainda sem dados'}</i></div>
      <div class="kpi"><small>Links com visitas do Instagram</small><b>${comIg}</b><i>de ${lojas.length} lojas criadas</i></div>
    </div>
    <div class="grade-crm">
      <section class="cartao">
        <div class="cab-crm"><h2>Até onde as pessoas chegam</h2><span>${todos.length} cadastros</span></div>
        <div class="funil">
          <svg class="fluxo" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="gf" x1="0" x2="1"><stop offset="0" stop-color="#3B6CF6"/><stop offset="1" stop-color="#B04A9E"/></linearGradient></defs><path d="${caminho}" fill="url(#gf)"/></svg>
          ${ETAPAS.map(([n, t, d], i) => `<div class="col"><div class="t" title="${esc(d)}">${esc(t)}</div><div class="pc">${Math.round((chegaram[i] / total) * 100)}%</div><div class="v">${chegaram[i]}${i && perdas[i] ? `<small>−${perdas[i]}</small>` : ''}</div></div>`).join('')}
        </div>
        ${maiorPerda > 0 && perdas[maiorPerda] ? `<div class="nota-crm">O maior buraco está entre <b>${esc(ETAPAS[maiorPerda - 1][1].toLowerCase())}</b> e <b>${esc(ETAPAS[maiorPerda][1].toLowerCase())}</b>: ${perdas[maiorPerda]} pessoas pararam ali.</div>` : ''}
        <div class="cab-crm" style="margin-top:18px"><h2>Quem está em teste agora, por etapa</h2><span>${ativos.length} pessoas</span></div>
        <div class="etapas-mini">${ETAPAS.map(([n, , , curto], i) => `<div class="e ${i === maiorPerda - 1 && porEtapa[i].length ? 'on' : ''}"><small>${esc(curto)}</small><b>${porEtapa[i].length}</b>${bolinhas(porEtapa[i])}</div>`).join('')}</div>
        <div class="leg"><span><i class="dot d-g"></i>entrou hoje ou ontem</span><span><i class="dot d-y"></i>2 a 3 dias sem entrar</span><span><i class="dot d-r"></i>4+ dias sem entrar</span></div>
      </section>
      <section class="cartao">
        <div class="cab-crm"><h2>Situação</h2></div>
        <div class="lista-crm">
          <div><span><i class="dot d-g"></i>Em teste e ativas</span><b>${emTeste.filter((p) => crmAtividade(p) === 'ativa').length}</b></div>
          <div><span><i class="dot d-y"></i>Em teste, esfriando</span><b>${emTeste.filter((p) => crmAtividade(p) === 'esfriando').length}</b></div>
          <div><span><i class="dot d-r"></i>Em teste, sumiram</span><b>${emTeste.filter((p) => crmAtividade(p) === 'sumiu').length}</b></div>
          <div><span><i class="dot d-b"></i>Teste acaba em até 2 dias</span><b>${acabaLogo}</b></div>
          <div><span><i class="dot d-c"></i>Acabou sem assinar</span><b>${semAssinar30}</b></div>
          <div><span><i class="dot d-g"></i>Assinaram</span><b>${assinaram.length}</b></div>
        </div>
        <div class="cab-crm" style="margin-top:18px"><h2>Divulgação do link</h2></div>
        <div class="lista-crm">
          <div><span>Lojas com visitas vindas do Instagram</span><b>${comIg}</b></div>
          <div><span>Copiaram o link e ainda sem visitas</span><b>${copiouSemVisita}</b></div>
          <div><span>Visitas totais nos links</span><b>${visitas.toLocaleString('pt-BR')}</b></div>
        </div>
        <p class="dica" style="margin-top:12px">As visitas e o "último uso" começaram a ser contados com esta atualização.</p>
      </section>
    </div>`;
  ligarFiltrosCrm(tela);
}

// ---------------------------------------------------------------------
// Quadro de abordagem: uma aba por etapa, lista limpa e ficha da pessoa
// ---------------------------------------------------------------------
const MSG_ETAPA = {
  1: 'Oi! Vi que você criou sua conta no App Pegue e Monte 😊 Ficou alguma dúvida na primeira tela? Se quiser, me manda o nome da sua loja e o WhatsApp que eu deixo tudo pronto pra você.',
  2: 'Oi! Vi que você já criou sua loja no App Pegue e Monte 🎉 Quer que eu cadastre o seu primeiro kit pra você? É só me mandar aqui as fotos e o nome do kit.',
  3: 'Oi! Vi que você já cadastrou seu primeiro kit 👏 Quer ajuda para colocar os outros com foto? Assim o seu link fica completo para mandar para as clientes.',
  4: 'Seu catálogo ficou lindo! 😍 Agora é só colocar o link de reservas na bio do Instagram e mandar para as clientes. Quer que eu te mostre como?',
  5: 'Vi que o seu link de reservas já está no ar 🎉 Quando chegar a primeira reserva, o app te avisa. Quer uma dica de como divulgar nos stories?',
  6: 'Parabéns pela reserva que chegou pelo seu link! 🎉 Viu como a cliente reserva sozinha? Seu teste acaba em {dias}. Quer garantir o seu acesso sem perder nada?',
  7: 'Que bom ver você usando o app de verdade! 🙌 Seu teste acaba em {dias}. Quer que eu te mande o link para garantir o seu acesso sem perder nada do que já cadastrou?',
  0: 'Oi! Seu teste do App Pegue e Monte terminou, mas seus kits e reservas continuam guardados 😊 Quer que eu te mande a condição especial para continuar?',
};
function grupoAbordagem(p) {
  if (crmAssinou(p)) return 'assinou';
  if (!crmEmTeste(p)) return 'nao';
  return String(p.etapa || 1);
}
function textoDias(p) {
  const ms = new Date(p.teste_ate).getTime() - Date.now();
  if (ms <= 864e5) return 'menos de 1 dia';
  const d = Math.ceil(ms / 864e5);
  return d === 1 ? '1 dia' : `${d} dias`;
}
function quandoCurto(iso) {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`;
}
function motivosHoje(p) {
  const m = [];
  const g = grupoAbordagem(p);
  if (g !== 'nao' && g !== 'assinou') {
    if (new Date(p.teste_ate).getTime() - Date.now() <= 864e5) m.push(['Teste acaba em menos de 1 dia', 't-lil']);
    if (crmDiasSemUso(p) >= 4) m.push(['4+ dias sem entrar', 't-red']);
  }
  if (g === 'nao' && Date.now() - new Date(p.teste_ate).getTime() <= 2 * 864e5) m.push(['Dentro das 48 h da oferta', 't-gry']);
  if (p.checkout_em && !crmAssinou(p) && Date.now() - new Date(p.checkout_em).getTime() <= 7 * 864e5) m.unshift(['Foi ao checkout e não assinou', 't-yel']);
  if (p.ultimo_contato_em && p.ultimo_uso && new Date(p.ultimo_uso) > new Date(p.ultimo_contato_em) && g !== 'assinou') m.push(['Mexeu no app depois do seu contato', 't-grn']);
  return m;
}
const ABAS_ABORD = [['geral', 'Resumo geral'], ...ETAPAS.map(([n, , , c]) => [String(n), c]), ['nao', 'Não assinou'], ['assinou', 'Assinaram']];

function abaAbordagem(tela) {
  if (!estado.crm) { tela.innerHTML = '<div class="cartao">Não consegui carregar os dados. Toque em Atualizar.</div>'; return; }
  const todos = crmFiltrados();
  const grupos = {};
  todos.forEach((p) => { const g = grupoAbordagem(p); (grupos[g] = grupos[g] || []).push(p); });
  const sub = estado.abordAba || 'geral';
  const qtd = (id) => (grupos[id] || []).length;
  const abas = `<div class="etabas">${ABAS_ABORD.map(([id, t]) => `<button class="${sub === id ? 'on' : ''}" data-sub="${id}">${esc(t)}${id !== 'geral' ? `<b>${qtd(id)}</b>` : ''}</button>`).join('')}</div>`;

  if (sub === 'geral') {
    const hoje = todos.map((p) => [p, motivosHoje(p)]).filter(([, m]) => m.length)
      .sort((a, b) => b[1].length - a[1].length).slice(0, 20);
    const perdas = ETAPAS.map(([n], i) => (i ? todos.filter((p) => Number(p.etapa) >= ETAPAS[i - 1][0]).length - todos.filter((p) => Number(p.etapa) >= n).length : 0));
    const maior = perdas.indexOf(Math.max(...perdas)) - 1;
    const semContato = (l) => l.filter((p) => !p.ultimo_contato_em).length;
    tela.innerHTML = `${filtrosCrm()}${abas}
      <div class="g-resumo">
        ${ETAPAS.map(([n, , , c], i) => { const l = grupos[String(n)] || []; return `<button class="e-res ${i === maior && l.length ? 'on' : ''}" data-sub="${n}">
          <small>${n}. ${esc(c)}</small><b>${l.length}</b>${bolinhas(l)}
          <span class="a">${i === maior && l.length ? 'Maior perda do funil · ' : ''}${semContato(l)} sem contato</span></button>`; }).join('')}
        <button class="e-res" data-sub="nao"><small>Não assinou</small><b>${qtd('nao')}</b>
          <span class="bolas"><span>${(grupos.nao || []).filter((p) => crmDiasSemUso(p) <= 3).length} ainda abrem o app</span></span>
          <span class="a">${(grupos.nao || []).filter((p) => Date.now() - new Date(p.teste_ate).getTime() <= 2 * 864e5).length} dentro das 48 h da oferta</span></button>
      </div>
      <section class="cartao"><div class="cab-crm"><h2>Para falar hoje</h2><span>${hoje.length} pessoas</span></div>
        ${hoje.length ? `<div class="lista-hoje">${hoje.map(([p, m]) => `<button class="lh" data-email="${esc(p.email)}">
          <b>${esc(p.loja || p.email)}</b>
          <span class="tags">${m.map(([t, c]) => `<span class="tag ${c}">${esc(t)}</span>`).join('')}</span><span class="et">${esc(grupoAbordagem(p) === 'nao' ? 'Não assinou' : ETAPAS[(p.etapa || 1) - 1][3])}</span>
          <span class="dia">${grupoAbordagem(p) === 'nao' ? 'acabou ' + quandoCurto(p.teste_ate) : 'Dia ' + crmDiaDoTeste(p) + ' de 7'}</span></button>`).join('')}</div>`
          : '<p class="pequeno">Ninguém precisa de contato urgente agora.</p>'}
      </section>
      <div class="leg"><span><i class="dot d-g"></i>entrou hoje ou ontem</span><span><i class="dot d-y"></i>2 a 3 dias sem entrar</span><span><i class="dot d-r"></i>4+ dias sem entrar</span></div>`;
  } else {
    const lista = (grupos[sub] || []).slice().sort((a, b) => crmDiasSemUso(b) - crmDiasSemUso(a));
    const sel = lista.find((p) => p.email === estado.abordSel) || lista[0];
    tela.innerHTML = `${filtrosCrm()}${abas}
      <div class="wrap-abord">
        <div class="lista-abord">${lista.length ? `
          <div class="la cab"><span></span><span>Loja</span><span>${sub === 'nao' ? 'Teste acabou' : sub === 'assinou' ? 'Assinou' : 'Dia do teste'}</span><span>Último uso</span><span>Contato</span></div>
          ${lista.map((p) => `<button class="la ${sel && sel.email === p.email ? 'sel' : ''}" data-email="${esc(p.email)}">
            <i class="dot ${{ ativa: 'd-g', esfriando: 'd-y', sumiu: 'd-r' }[crmAtividade(p)]}"></i>
            <b>${esc(p.loja || p.email)}</b>
            <span>${sub === 'nao' ? quandoCurto(p.teste_ate) : sub === 'assinou' ? quandoCurto(p.assinou_em) : 'Dia ' + crmDiaDoTeste(p) + ' de 7'}</span>
            <span class="c">${quandoCurto(p.ultimo_uso)}</span>
            <span class="c">${p.ultimo_contato_em ? new Date(p.ultimo_contato_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'}</span></button>`).join('')}`
          : '<p class="pequeno" style="padding:18px">Ninguém nesta etapa agora.</p>'}
        </div>
        <div id="ficha">${sel ? fichaPessoa(sel) : ''}</div>
      </div>
      <div class="leg"><span><i class="dot d-g"></i>entrou hoje ou ontem</span><span><i class="dot d-y"></i>2 a 3 dias sem entrar</span><span><i class="dot d-r"></i>4+ dias sem entrar</span></div>`;
    if (sel) ligarFicha(tela, sel);
  }
  $$('[data-sub]', tela).forEach((b) => { b.onclick = () => { estado.abordAba = b.dataset.sub; estado.abordSel = null; desenhar(); }; });
  $$('[data-email]', tela).forEach((b) => {
    b.onclick = () => {
      const p = (estado.crm || []).find((x) => x.email === b.dataset.email);
      if (!p) return;
      const g = grupoAbordagem(p);
      estado.abordAba = g;
      estado.abordSel = p.email;
      desenhar();
      const f = $('#ficha'); if (f && window.innerWidth < 1024) f.scrollIntoView({ behavior: 'smooth' });
    };
  });
  ligarFiltrosCrm(tela);
}

function fichaPessoa(p) {
  const g = grupoAbordagem(p);
  const marcos = [
    ['Criou a conta', p.conta_em || p.teste_inicio],
    ['Criou a loja', p.loja_em],
    ['Cadastrou o 1º kit', p.primeiro_kit_em],
    ['Copiou o link', p.link_copiado_em],
    ['1ª reserva de cliente real', p.primeira_reserva_real_em],
  ];
  const et = g === 'nao' ? 0 : Number(p.etapa) || 1;
  const propria = (estado.crmMsgs || {})[et];
  const msg = (propria || MSG_ETAPA[et] || '').replace(/\{dias\}/g, textoDias(p));
  const tel = p.telefone || p.whatsapp_loja;
  const depois = p.ultimo_contato_em && p.ultimo_uso && new Date(p.ultimo_uso) > new Date(p.ultimo_contato_em);
  return `<section class="cartao ficha">
    <span class="tag t-lil">${esc(g === 'nao' ? 'Não assinou' : g === 'assinou' ? 'Assinou' : ETAPAS[(p.etapa || 1) - 1][3])}</span>
    <h2 style="margin:6px 0 2px">${esc(p.loja || 'Ainda sem loja')}</h2>
    <div class="pequeno">${esc(p.email)}${g === 'nao' ? ` · teste acabou ${quandoCurto(p.teste_ate)}` : g === 'assinou' ? ` · assinou ${quandoCurto(p.assinou_em)}${p.plano ? ' · ' + (p.plano === 'anual' ? 'anual' : 'mensal') : ''}` : ` · dia ${crmDiaDoTeste(p)} de 7 · acaba ${new Date(p.teste_ate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`}${p.campanha ? ` · origem: ${esc(p.campanha)}` : ''}</div>
    <div class="tl">
      ${marcos.map(([t, d]) => `<div class="${d ? '' : 'no'}">${esc(t)}<small>${d ? dataHora(d) : 'ainda não'}</small></div>`).join('')}
      <div>Último uso do app<small>${p.ultimo_uso ? dataHora(p.ultimo_uso) : '—'}${p.ultimo_contato_em ? (depois ? ' · <b style="color:var(--pos)">mexeu no app depois do seu contato</b>' : ' · <b style="color:var(--warn)">não mexeu depois do seu contato</b>') : ''}</small></div>
    </div>
    ${blocoInteresse(p)}
    <div class="nums-ficha"><span><b>${p.kits || 0}</b> kits (${p.kits_foto || 0} com foto)</span><span><b>${p.reservas || 0}</b> reservas</span><span><b>${p.visitas_instagram || 0}</b> visitas do Instagram</span></div>
    <b class="pequeno" style="color:var(--tinta)">Mensagem pronta desta etapa${propria ? ' <span class="tag t-lil">sua versão</span>' : ''}</b>
    <textarea id="ficha-msg" rows="4">${esc(msg)}</textarea>
    <div class="msg-acoes">
      <button class="link-btn" id="msg-salvar" data-et="${et}">Salvar como padrão desta etapa</button>
      ${propria ? `<button class="link-btn" id="msg-original" data-et="${et}">Voltar ao texto original</button>` : ''}
    </div>
    <p class="dica" style="margin-top:-6px">Use <b>{dias}</b> no texto para o app colocar quantos dias faltam do teste.</p>
    <div class="botoes-ficha">
      ${tel ? `<a class="btn verde" id="ficha-zap" href="${esc(linkZap(tel, msg))}" target="_blank" rel="noopener">Abrir no WhatsApp</a>` : '<span class="pequeno">Sem telefone cadastrado</span>'}
      ${p.slug ? `<a class="btn contorno" href="${esc(linkVerLoja(p.slug))}" target="_blank" rel="noopener">Ver loja</a>` : ''}
      ${p.slug ? '<button class="btn principal" id="ficha-loja">Entrar na loja</button>' : ''}
      ${p.slug ? '<button class="btn contorno" id="ficha-leitura" title="Vê tudo por dentro, sem poder alterar nada">Só olhar por dentro</button>' : ''}
    </div>
    <b class="pequeno" style="color:var(--tinta)">Contatos e anotações</b>
    ${(p.contatos || []).length ? `<div class="hist">${p.contatos.map((c) => `<div><b>${dataHora(c.quando)}</b>${c.nota ? ` · <i>"${esc(c.nota)}"</i>` : ' · contato feito'}</div>`).join('')}</div>` : '<p class="pequeno">Nenhum contato registrado ainda.</p>'}
    <textarea id="ficha-nota" rows="2" maxlength="500" placeholder="Anotação rápida (opcional)"></textarea>
    <button class="btn contorno" id="ficha-contatei">Marcar como contatada hoje</button>
  </section>`;
}
function ligarFicha(tela, p) {
  const msg = $('#ficha-msg', tela), zap = $('#ficha-zap', tela);
  const tel = p.telefone || p.whatsapp_loja;
  if (msg && zap) msg.oninput = () => { zap.href = linkZap(tel, msg.value); };
  const lj = $('#ficha-loja', tela);
  if (lj) lj.onclick = async () => {
    lj.disabled = true; lj.textContent = 'Entrando…';
    try { await entrarNaLoja(p.email); lj.disabled = false; lj.textContent = 'Entrar na loja'; }
    catch (e) { aviso(e.message); lj.disabled = false; lj.textContent = 'Entrar na loja'; }
  };
  const lt = $('#ficha-leitura', tela);
  if (lt) lt.onclick = async () => {
    lt.disabled = true; lt.textContent = 'Entrando…';
    try { await entrarNaLoja(p.email, true); lt.disabled = false; lt.textContent = 'Só olhar por dentro'; }
    catch (e) { aviso(e.message); lt.disabled = false; lt.textContent = 'Só olhar por dentro'; }
  };
  const sv = $('#msg-salvar', tela);
  if (sv) sv.onclick = async () => {
    // Guarda com {dias} no lugar dos dias desta pessoa, para servir para todas
    const texto = msg.value.split(textoDias(p)).join('{dias}');
    sv.disabled = true;
    try { await dados.adminSalvarMensagemCrm(Number(sv.dataset.et), texto); estado.crmMsgs = await dados.adminCrmMensagens(); aviso('Mensagem salva como padrão desta etapa.'); desenhar(); }
    catch (e) { aviso(e.message); sv.disabled = false; }
  };
  const og = $('#msg-original', tela);
  if (og) og.onclick = async () => {
    og.disabled = true;
    try { await dados.adminSalvarMensagemCrm(Number(og.dataset.et), ''); estado.crmMsgs = await dados.adminCrmMensagens(); aviso('Voltou ao texto original.'); desenhar(); }
    catch (e) { aviso(e.message); og.disabled = false; }
  };
  const ct = $('#ficha-contatei', tela);
  if (ct) ct.onclick = async () => {
    ct.disabled = true; ct.textContent = 'Salvando…';
    try {
      await dados.adminCrmContato(p.email, $('#ficha-nota', tela).value);
      estado.crm = await dados.adminCrm();
      aviso('Contato registrado.');
      desenhar();
    } catch (e) { aviso(e.message); ct.disabled = false; ct.textContent = 'Marcar como contatada hoje'; }
  };
}

// ---------------------------------------------------------------------
// Nível de interesse e interações com popups (ficha da pessoa)
// ---------------------------------------------------------------------
const NOMES_POPUP = {
  fim_teste: 'Fim do teste (oferta conforme o uso)', promo_dia2: 'Popup do 2º dia (oferta conforme o uso)', assinar_agora: 'Botão "Assinar agora"', fim_mes1: 'Fim do 1º mês (R$ 14,90)',
  aviso_promo: 'Notificação da promoção', comemoracao_link: 'Comemoração da 1ª reserva pelo link', black_friday: 'Black Friday (anual R$ 167)',
  faixa: 'Faixa de pagamento', outro: 'Outros botões de assinar', promo_montagem: 'Montamos sua loja (2º dia, menos de 3 kits)', mensagem: 'Mensagem da Central',
};
const NOMES_ACAO = { viu: 'Viu', clicou: 'Clicou em', fechou: 'Fechou', olhou_10s: 'Ficou 10+ segundos olhando', checkout: 'Foi ao checkout pelo' };
const NOMES_PLANO = { anual_promo: 'anual R$ 167', anual: 'anual R$ 269', mensal: 'mensal' };
function nivelInteresse(p) {
  if (crmAssinou(p)) return 5;
  const a = new Set((p.interacoes || []).map((i) => i.acao));
  if (a.has('checkout')) return 4;
  if (a.has('olhou_10s')) return 3;
  if (a.has('clicou') || (p.interacoes || []).some((i) => ['assinar_agora', 'aviso_promo'].includes(i.popup))) return 2;
  return (p.interacoes || []).length ? 1 : 0;
}
const NOMES_NIVEL = ['Ainda não viu nenhuma oferta', 'Só viu as ofertas', 'Abriu a notificação ou tocou em "Assinar agora"', 'Ficou olhando os planos', 'Foi ao checkout', 'Assinou'];
function blocoInteresse(p) {
  const n = nivelInteresse(p);
  const lista = (p.interacoes || []).slice(0, 6);
  return `<div class="interesse"><div class="cab-crm" style="margin:0"><b class="pequeno" style="color:var(--tinta)">Nível de interesse</b><span>${esc(NOMES_NIVEL[n])}</span></div>
    <div class="nivel">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= n ? 'on' : ''}"></i>`).join('')}</div>
    ${lista.length ? `<div class="hist">${lista.map((i) => `<div><b>${dataHora(i.quando)}</b> · ${esc(NOMES_ACAO[i.acao] || i.acao)} ${esc(i.acao === 'checkout' ? (NOMES_POPUP[i.popup] || i.popup).toLowerCase() + (i.detalhe ? ' (' + (NOMES_PLANO[i.detalhe] || i.detalhe) + ')' : '') : (NOMES_POPUP[i.popup] || i.popup).toLowerCase())}</div>`).join('')}
      ${p.checkout_em && !crmAssinou(p) ? '<div style="color:var(--warn)">Nenhuma compra chegou da Cakto depois do checkout.</div>' : ''}</div>` : ''}
  </div>`;
}

// ---------------------------------------------------------------------
// Estudo de conversão
// ---------------------------------------------------------------------
function barrasH(itens, max) {
  return itens.map(([rot, v, extra]) => `<div class="hb"><span>${esc(rot)}</span><div class="b"><i style="width:${max ? Math.round((v / max) * 100) : 0}%"></i></div><b>${v}${extra ? `<small>${esc(extra)}</small>` : ''}</b></div>`).join('');
}
function abaEstudo(tela) {
  if (!estado.crm) { tela.innerHTML = '<div class="cartao">Não consegui carregar os dados. Toque em Atualizar.</div>'; return; }
  const todos = crmFiltrados();
  const assinaram = todos.filter(crmAssinou);
  const naEtapa = ETAPAS.map(([n]) => assinaram.filter((p) => Number(p.etapa_na_assinatura || p.etapa) === n).length);
  const aprox = assinaram.filter((p) => !p.etapa_na_assinatura).length;
  const terminaram = todos.filter((p) => crmAssinou(p) || new Date(p.teste_ate).getTime() <= Date.now());
  const faixas = [['Sem kit (1–2)', [1, 2]], ['Só kit de teste (3)', [3]], ['Catálogo montado (4)', [4]], ['Divulgou o link (5)', [5]], ['Reserva real (6–7)', [6, 7]]];
  const linhas = faixas.map(([rot, ns]) => {
    const g = terminaram.filter((p) => ns.includes(Number(p.etapa_na_assinatura || p.etapa)));
    const a = g.filter(crmAssinou).length;
    return [rot, g.length, a, g.length ? Math.round((a / g.length) * 100) : 0];
  });
  const naoConv = todos.filter((p) => !crmAssinou(p) && new Date(p.teste_ate).getTime() <= Date.now() && p.ultimo_uso);
  const porDia = [1, 2, 3, 4, 5, 6, 7].map((d) => naoConv.filter((p) => Math.min(7, Math.max(1, Math.floor((new Date(p.ultimo_uso) - new Date(p.teste_inicio)) / DIA_MS) + 1)) === d).length);
  const maxDia = Math.max(1, ...porDia);
  const diaPico = porDia.indexOf(Math.max(...porDia)) + 1;
  const camps = [...new Set(todos.map((p) => p.campanha || '(sem anúncio)'))];
  const porCamp = camps.map((c) => {
    const g = todos.filter((p) => (p.campanha || '(sem anúncio)') === c);
    const t = g.filter((p) => crmAssinou(p) || new Date(p.teste_ate).getTime() <= Date.now());
    const a = g.filter(crmAssinou).length;
    return [c, g.length, g.filter((p) => Number(p.etapa) >= 4).length, a, t.length ? Math.round((a / t.length) * 100) : 0];
  }).sort((x, y) => y[1] - x[1]);
  const top = naEtapa.indexOf(Math.max(...naEtapa));
  const ate5 = naEtapa.slice(4).reduce((a, b) => a + b, 0);
  tela.innerHTML = `${filtrosCrm()}
    <div class="grade-estudo">
      <section class="cartao"><div class="cab-crm"><h2>Em que etapa estavam quando assinaram</h2><span>${assinaram.length} assinaturas</span></div>
        ${barrasH(ETAPAS.map(([n, t], i) => [`${n}. ${t}`, naEtapa[i]]), Math.max(1, ...naEtapa))}
        ${assinaram.length ? `<div class="nota-crm">${ate5} de ${assinaram.length} assinantes já tinham <b>divulgado o link</b> (ou passado dessa etapa) quando assinaram. A etapa mais comum na hora de assinar é <b>${esc(ETAPAS[top][1].toLowerCase())}</b>.</div>` : '<p class="pequeno">Ainda não há assinaturas no período.</p>'}
        ${aprox ? `<p class="dica" style="margin-top:8px">${aprox} assinatura(s) antigas usam a etapa atual, porque aconteceram antes de o app começar a guardar a etapa no momento da compra.</p>` : ''}
      </section>
      <section class="cartao"><div class="cab-crm"><h2>Chance de assinar pela etapa que alcançou</h2><span>só quem já terminou o teste</span></div>
        <div class="tabela"><div class="tr th"><span>Etapa mais alta</span><span>Pessoas</span><span>Assinaram</span><span>Conversão</span></div>
        ${linhas.map(([r, n, a, c]) => `<div class="tr"><span>${esc(r)}</span><span>${n}</span><span>${a}</span><b class="${c >= 40 ? 'pos' : c === 0 && n ? 'neg' : ''}">${c}%</b></div>`).join('')}</div>
      </section>
      <section class="cartao"><div class="cab-crm"><h2>Em que dia do teste as pessoas param de entrar</h2><span>quem não assinou</span></div>
        <div class="dias">${porDia.map((v, i) => `<div><span class="vv">${v}</span><i style="height:${Math.round((v / maxDia) * 130)}px"></i>Dia ${i + 1}</div>`).join('')}</div>
        ${naoConv.length ? `<div class="nota-crm">O <b>dia ${diaPico}</b> concentra quem para de entrar: vale um contato nesse dia para quem ainda não cadastrou kit.</div>` : ''}
      </section>
      <section class="cartao"><div class="cab-crm"><h2>Por anúncio de origem</h2></div>
        <div class="tabela t5"><div class="tr th"><span>Origem</span><span>Cadastros</span><span>Montaram catálogo</span><span>Assinaram</span><span>Conversão</span></div>
        ${porCamp.map(([c, n, cat, a, cv]) => `<div class="tr"><span title="${esc(c)}">${esc(c)}</span><span>${n}</span><span>${cat}</span><span>${a}</span><b>${cv}%</b></div>`).join('')}</div>
      </section>
    </div>`;
  ligarFiltrosCrm(tela);
}

// ---------------------------------------------------------------------
// Popups e ofertas
// ---------------------------------------------------------------------
// Oferta conforme o uso: quem viu o anual ou o mensal em destaque e se comprou
// Loja pronta pelo Instagram (página /loja-pronta): prévias, e-mails deixados, quem foi pagar e quem pagou
const reaisAdm = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
async function desenharOfertasUso(caixa, dias) {
  if (!caixa) return;
  let lista = null;
  try {
    if (dados.MODO_DEMO) {
      const h = (m) => new Date(Date.now() - m * 6e4).toISOString();
      lista = [{ em: 'juliana@exemplo.com', no: 'Juliana Mendes', kits: 6, oferta: 'anual', viu: [{ onde: 'Popup 2º dia', oferta: 'anual', q: h(600) }], comprou: 'anual', comprou_em: h(590) },
        { em: 'carla@exemplo.com', no: 'Carla Souza', kits: 1, oferta: 'mensal', viu: [{ onde: 'Popup 2º dia', oferta: 'mensal', q: h(900) }, { onde: 'E-mail 5º dia', oferta: 'mensal', q: h(60) }], comprou: null }];
    } else lista = await rpcAdmin('admin_ofertas', { p_dias: dias });
  } catch (e) { lista = null; }
  if (!caixa.isConnected) return;
  if (!lista) { caixa.innerHTML = ''; return; }
  const grupo = (o) => lista.filter((x) => x.oferta === o);
  const cmp = (o) => grupo(o).filter((x) => x.comprou);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const kpi = (o) => {
    const g = grupo(o), c = cmp(o);
    const an = c.filter((x) => x.comprou === 'anual').length, me = c.length - an;
    return `<div class="kpi"><small>Viram o ${o} em destaque</small><b>${g.length}</b><i>${o === 'anual' ? '3 kits ou mais' : '0 a 2 kits'}</i></div>
      <div class="kpi"><small>Compraram</small><b>${c.length}</b><i class="p">${pct(c.length, g.length)}%${c.length ? ` · ${[an ? `${an} anual` : '', me ? `${me} mensal` : ''].filter(Boolean).join(', ')}` : ''}</i></div>`;
  };
  const dh = (q) => { const d = new Date(q); return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`; };
  caixa.innerHTML = `<section class="cartao"><div class="cab-crm"><h2>Oferta conforme o uso</h2><span>3 kits ou mais: anual em destaque · 0 a 2 kits: mensal em destaque</span></div>
    <div class="kpis-crm k4" style="margin:10px 0">${kpi('anual')}${kpi('mensal')}</div>
    ${lista.length ? `<p class="pequeno" style="margin:0 0 6px">Cada cliente, qual oferta viu (popup do 2º dia, tela de fim de teste, fim do 1º mês ou e-mail do 5º dia) e se comprou.</p>
    <div class="pg-lista">${lista.slice(0, 200).map((x) => `<div class="pg-ab"><div style="min-width:0"><b class="t">${esc(x.no || x.loja || x.em)}</b>
      <small>${esc(x.em)} · ${x.kits ?? 0} ${Number(x.kits) === 1 ? 'kit' : 'kits'} · <span class="st ${x.oferta === 'anual' ? 'st-pago' : 'st-pix_pendente'}">${x.oferta === 'anual' ? 'Anual' : 'Mensal'} em destaque</span></small>
      <small>Viu: ${esc((x.viu || []).map((v) => `${v.onde} (${v.oferta}) ${dh(v.q)}`).join(' · '))}</small></div>
      <div class="ld"><span class="v" style="color:${x.comprou ? 'var(--pos)' : 'var(--texto2)'}">${x.comprou ? `Comprou ${esc(x.comprou)} · ${esc(dh(x.comprou_em))}` : 'Ainda não comprou'}</span></div></div>`).join('')}</div>`
    : '<p class="pequeno">Ainda não há dados. Começa a contar depois desta atualização.</p>'}</section>`;
}
async function abaPopups(tela) {
  const dias = { hoje: '1', ontem: '2' }[String(estado.funilDias ?? 30)] || String(estado.funilDias ?? 30);
  tela.innerHTML = '<div id="popups-c" class="coluna" style="gap:16px"><div class="cartao">Carregando…</div></div>';
  const alvo = $('#popups-c', tela);
  let lista = [];
  try { lista = await dados.adminPopups(Number(dias)); } catch (e) { alvo.innerHTML = `<div class="cartao">${esc(e.message)}</div>`; return; }
  if (estado.aba !== 'popups' || !alvo.isConnected) return;
  const soma = (k) => lista.reduce((t, x) => t + Number(x[k] || 0), 0);
  const viram = soma('viram'), cliques = soma('clicaram'), ck = soma('checkout'), ass = soma('assinaram');
  const melhor = lista.filter((x) => x.viram >= 5).map((x) => [x, x.assinaram / x.viram]).sort((a, b) => b[1] - a[1])[0];
  const per = [['hoje', 'Hoje'], ['ontem', 'Hoje e ontem'], ['7', '7 dias'], ['30', '30 dias'], ['90', '90 dias'], ['0', 'Desde o início']];
  const escolhido = String(estado.funilDias ?? 30);
  alvo.innerHTML = `
    <div class="nota-crm" style="margin:0">Os popups que você mesma envia (com a lista de quem recebeu) ficam em <button class="link-btn" id="ir-msgs">Mensagens › Mensagens enviadas</button>. Ninguém recebe a mesma mensagem duas vezes.</div>
    <div id="ofertas-uso"></div>
    ${blocoNiveis()}
    <div class="filtros-crm"><label>Período<select id="f-dias">${per.map(([v, t]) => `<option value="${v}" ${v === escolhido ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label></div>
    <div class="kpis-crm">
      <div class="kpi"><small>Pessoas que viram ofertas</small><b>${viram}</b><i>somando todos os popups</i></div>
      <div class="kpi"><small>Clicaram para assinar</small><b>${cliques}</b><i class="p">${viram ? Math.round((cliques / viram) * 100) : 0}% de quem viu</i></div>
      <div class="kpi"><small>Foram ao checkout</small><b>${ck}</b><i>da Cakto</i></div>
      <div class="kpi"><small>Assinaram em até 7 dias</small><b>${ass}</b><i class="p">${ck ? Math.round((ass / ck) * 100) : 0}% de quem foi ao checkout</i></div>
      <div class="kpi"><small>Oferta que mais converte</small><b style="font-size:17px;margin-top:6px">${melhor ? esc(NOMES_POPUP[melhor[0].popup] || melhor[0].popup) : '—'}</b><i>${melhor ? Math.round(melhor[1] * 100) + '% de quem viu assinou' : 'precisa de mais dados'}</i></div>
    </div>
    <section class="cartao"><div class="cab-crm"><h2>Cada popup e oferta</h2><span>pessoas diferentes em cada coluna</span></div>
      ${lista.length ? `<div class="tabela t7"><div class="tr th"><span>Popup / oferta</span><span>Viram</span><span>Clicaram</span><span>Fecharam</span><span>Checkout</span><span>Assinaram depois</span><span>Resultado</span></div>
      ${lista.map((x) => `<div class="tr"><span>${esc(NOMES_POPUP[x.popup] || x.popup)}</span><span>${x.viram}</span>
        <span>${x.clicaram}${x.viram ? `<small>${Math.round((x.clicaram / x.viram) * 100)}%</small>` : ''}</span><span>${x.fecharam}</span>
        <span>${x.checkout}${x.checkout ? `<small>${[['checkout_anual_promo', 'anual 167'], ['checkout_anual', 'anual 269'], ['checkout_mensal', 'mensal']].filter(([k]) => x[k]).map(([k, t]) => `${t}: ${x[k]}`).join(' · ')}</small>` : ''}</span>
        <b class="${x.assinaram ? 'pos' : ''}">${x.assinaram}</b>
        <span class="mini-barra"><i style="width:${x.viram ? Math.round((x.clicaram / x.viram) * 100) : 0}%;background:var(--acc)"></i><i style="width:${x.viram ? Math.round((x.assinaram / x.viram) * 100) : 0}%;background:var(--pos)"></i></span></div>`).join('')}</div>
      <div class="leg"><span><i class="dot" style="background:var(--acc)"></i>clicaram</span><span><i class="dot d-g"></i>assinaram</span><span>"Assinaram depois" conta quem assinou em até 7 dias depois de ver aquele popup (pelo aviso da Cakto).</span></div>`
      : '<p class="pequeno">Ainda não há dados. Os popups começam a ser medidos depois desta atualização.</p>'}
    </section>
    <section class="cartao"><div class="cab-crm"><h2>Como o nível de interesse é calculado</h2><span>aparece na ficha de cada pessoa em Abordagem</span></div>
      <div class="niveis">${NOMES_NIVEL.slice(1).map((t, i) => `<div><span class="nivel mini">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= i + 1 ? 'on' : ''}"></i>`).join('')}</span>${esc(t)}</div>`).join('')}</div>
      <p class="dica" style="margin-top:8px">O app sabe que a pessoa foi ao checkout, mas não vê o que ela faz dentro da Cakto. Quando a compra acontece, a Cakto avisa e ela passa para o nível 5.</p>
    </section>`;
  const d = $('#f-dias', alvo);
  if (d) d.onchange = () => { estado.funilDias = d.value; desenhar(); };
  desenharOfertasUso($('#ofertas-uso', alvo), Number(dias));
  const im = $('#ir-msgs', alvo);
  if (im) im.onclick = () => { estado.aba = 'mensagens'; desenhar(); window.scrollTo(0, 0); };
  ligarNiveis(alvo);
}

// ---------------------------------------------------------------------
// Saúde da base: tempo de vida, valor por cliente, renovações e a
// leitura automática de onde as clientes travam
// ---------------------------------------------------------------------
const MES_MS = 30.44 * 864e5;
function num1(v) { return Number(v).toFixed(1).replace('.', ','); }
function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
function leituraAutomatica(saude) {
  const achados = [];
  const crm = estado.crm || [];
  const ate = (n) => crm.filter((p) => Number(p.etapa) >= n).length;
  // 1) maior perda do funil
  const perdas = ETAPAS.slice(1).map(([n], i) => [i, ate(ETAPAS[i][0]) - ate(n)]);
  const [ip, vp] = perdas.sort((a, b) => b[1] - a[1])[0] || [0, 0];
  if (vp > 0) achados.push(['alta', `Maior travamento: entre "${ETAPAS[ip][1].toLowerCase()}" e "${ETAPAS[ip + 1][1].toLowerCase()}"`,
    `${vp} pessoas (${pct(vp, ate(ETAPAS[ip][0]))}% de quem chegou em "${ETAPAS[ip][1].toLowerCase()}") pararam aí.`,
    ip === 1 ? 'Ofereça cadastrar o 1º kit por elas (modo suporte) e reforce o vídeo passo a passo.' : ip === 0 ? 'A primeira tela pode estar confusa: chame no WhatsApp quem parou nela.' : ip === 3 ? 'Mostre como colocar o link na bio do Instagram logo depois do catálogo.' : 'Use a mensagem pronta dessa etapa no quadro de abordagem.', 'abordagem']);
  // 2) loja sem kit há mais de 48 h
  const semKit48 = crm.filter((p) => crmEmTeste(p) && Number(p.etapa) === 2 && p.loja_em && Date.now() - new Date(p.loja_em).getTime() > 2 * 864e5);
  if (semKit48.length) achados.push(['media', `${semKit48.length} lojas em teste estão há mais de 48 h sem nenhum kit`, 'Quem não cadastra kit nos 2 primeiros dias quase nunca assina.', 'Chame hoje e ofereça cadastrar o primeiro kit por elas.', 'abordagem']);
  // 3) copiou o link e ninguém visitou
  const semVisita = crm.filter((p) => p.link_copiado_em && !Number(p.visitas) && Date.now() - new Date(p.link_copiado_em).getTime() > 864e5);
  if (semVisita.length) achados.push(['media', `${semVisita.length} copiaram o link de reservas, mas ninguém visitou`, 'Provavelmente não colocaram o link na bio nem mandaram para as clientes.', 'Mande o passo a passo de como colocar o link na bio do Instagram.', 'abordagem']);
  // 4) catálogo montado e não divulgou
  const naoDivulgou = crm.filter((p) => crmEmTeste(p) && Number(p.etapa) === 4);
  if (naoDivulgou.length) achados.push(['info', `${naoDivulgou.length} montaram o catálogo, mas ainda não divulgaram`, 'Elas estão a um passo da etapa que mais converte.', 'Mostre um exemplo de stories com o link de reservas.', 'abordagem']);
  // 5) foram ao checkout e não assinaram
  const ck = crm.filter((p) => p.checkout_em && !crmAssinou(p) && Date.now() - new Date(p.checkout_em).getTime() <= 7 * 864e5);
  if (ck.length) achados.push(['alta', `${ck.length} foram ao checkout nos últimos 7 dias e não assinaram`, 'Estão muito perto de assinar: pode ter sido dúvida no pagamento ou no plano.', 'Chame no WhatsApp perguntando se ficou alguma dúvida no pagamento.', 'abordagem']);
  // 6) dia do teste em que mais param
  const fim = crm.filter((p) => !crmAssinou(p) && new Date(p.teste_ate).getTime() <= Date.now() && p.ultimo_uso);
  if (fim.length >= 3) {
    const cont = {}; fim.forEach((p) => { const d = Math.min(7, Math.max(1, Math.floor((new Date(p.ultimo_uso) - new Date(p.teste_inicio)) / DIA_MS) + 1)); cont[d] = (cont[d] || 0) + 1; });
    const [d, q] = Object.entries(cont).sort((a, b) => b[1] - a[1])[0];
    achados.push(['info', `O dia ${d} do teste é quando mais gente para de usar`, `${q} de ${fim.length} que não assinaram usaram o app pela última vez nesse dia.`, `Programe um contato no dia ${d} para quem ainda não chegou à etapa "divulgou".`, 'estudo']);
  }
  // 7) conversão por etapa: onde a chance de assinar salta
  const term = crm.filter((p) => crmAssinou(p) || new Date(p.teste_ate).getTime() <= Date.now());
  const conv = (n) => { const g = term.filter((p) => Number(p.etapa_na_assinatura || p.etapa) >= n); return [g.length, pct(g.filter(crmAssinou).length, g.length)]; };
  const saltos = ETAPAS.slice(1).map(([n]) => [n, conv(n)[1] - conv(n - 1)[1], conv(n)]).filter(([, , [q]]) => q >= 3).sort((a, b) => b[1] - a[1]);
  if (saltos.length && saltos[0][1] > 0) achados.push(['info', `Quem chega em "${ETAPAS[saltos[0][0] - 1][1].toLowerCase()}" assina muito mais`, `A chance de assinar vai para ${saltos[0][2][1]}% (+${saltos[0][1]} pontos).`, 'Concentre as mensagens em levar as pessoas até essa etapa.', 'estudo']);
  // 8) pagamentos e cancelamentos
  if (saude && saude.length) {
    const rec = saude.reduce((t, c) => t + Number(c.recusas || 0), 0), recup = saude.reduce((t, c) => t + Number(c.recuperados || 0), 0);
    if (rec - recup > 0) achados.push(['media', `${rec - recup} pagamentos recusados não foram recuperados`, `De ${rec} recusas, ${recup} voltaram a pagar.`, 'Mande o link para atualizar o cartão ou pagar por Pix assim que vier a recusa.', 'pagamentos']);
    const cedo = saude.filter((c) => c.saiu_em && new Date(c.saiu_em) - new Date(c.primeira_compra) <= 40 * 864e5).length;
    const sairam = saude.filter((c) => c.saiu_em).length;
    if (cedo) achados.push([cedo / Math.max(1, sairam) >= 0.4 ? 'alta' : 'media', `${cedo} de ${sairam} cancelamentos foram no 1º mês`, 'Quem sai cedo geralmente não chegou a usar o link de reservas com clientes reais.', 'Na primeira semana depois da compra, confira se a loja já recebeu reserva pelo link.', 'clientes']);
  }
  const peso = { alta: 0, media: 1, info: 2 };
  return achados.sort((a, b) => peso[a[0]] - peso[b[0]]);
}
function abaSaude(tela) {
  const saude = estado.saude || [];
  if (!saude.length) { tela.innerHTML = '<div class="cartao">Ainda não há clientes pagantes para calcular. Toque em Atualizar.</div>'; return; }
  const agora = Date.now();
  const vida = saude.map((c) => Math.max(0, ((c.saiu_em ? new Date(c.saiu_em).getTime() : agora) - new Date(c.primeira_compra).getTime()) / MES_MS));
  const vidaMedia = vida.reduce((a, b) => a + b, 0) / vida.length;
  const ord = [...vida].sort((a, b) => a - b), mediana = ord[Math.floor(ord.length / 2)];
  const ativas = saude.filter((c) => c.ativa).length;
  const sairam30 = saude.filter((c) => c.saiu_em && agora - new Date(c.saiu_em).getTime() <= 30 * 864e5).length;
  const churn = (ativas + sairam30) ? sairam30 / (ativas + sairam30) : 0;
  const vidaEsperada = churn > 0 ? 1 / churn : null;
  const totalLiq = saude.reduce((t, c) => t + Number(c.total_liquido || 0), 0);
  const mesesPagos = vida.reduce((a, b) => a + Math.max(1, b), 0);
  const ticketMes = totalLiq / Math.max(1, mesesPagos);
  const ltvReal = totalLiq / saude.length;
  const ltvEst = vidaEsperada ? ticketMes * vidaEsperada : null;
  const mensais = saude.filter((c) => c.plano !== 'anual' && agora - new Date(c.primeira_compra).getTime() > 35 * 864e5);
  const renovou = mensais.filter((c) => Number(c.renovacoes) > 0).length;
  const curva = [1, 2, 3, 4, 5, 6].map((m) => {
    const coorte = saude.filter((c) => agora - new Date(c.primeira_compra).getTime() >= m * MES_MS);
    const ficou = coorte.filter((c) => !c.saiu_em || new Date(c.saiu_em) - new Date(c.primeira_compra) >= m * MES_MS).length;
    return [m, coorte.length, pct(ficou, coorte.length)];
  });
  const viaTeste = saude.filter((c) => c.teste_inicio);
  const vidaTeste = viaTeste.length ? viaTeste.map((c) => ((c.saiu_em ? new Date(c.saiu_em).getTime() : agora) - new Date(c.primeira_compra).getTime()) / MES_MS).reduce((a, b) => a + b, 0) / viaTeste.length : null;
  const achados = leituraAutomatica(saude);
  const nomesAba = { abordagem: 'Abrir Abordagem', estudo: 'Ver Estudo', pagamentos: 'Ver Pagamentos', clientes: 'Ver Clientes' };
  tela.innerHTML = `
    <div class="kpis-crm">
      <div class="kpi"><small>Vida média da cliente</small><b>${num1(vidaMedia)} meses</b><i>metade fica até ${num1(mediana)} meses</i></div>
      <div class="kpi"><small>Valor médio por cliente</small><b>${reais(ltvReal)}</b><i>já recebido, sem taxas</i></div>
      <div class="kpi"><small>Valor esperado por cliente</small><b>${ltvEst ? reais(ltvEst) : '—'}</b><i>${vidaEsperada ? `${reais(ticketMes)}/mês × ${num1(vidaEsperada)} meses` : 'sem cancelamentos nos últimos 30 dias'}</i></div>
      <div class="kpi"><small>Cancelamento por mês</small><b>${Math.round(churn * 100)}%</b><i class="${churn > 0.1 ? 'n' : 'p'}">${sairam30} saíram nos últimos 30 dias</i></div>
      <div class="kpi"><small>Renovaram o mensal</small><b>${pct(renovou, mensais.length)}%</b><i>${renovou} de ${mensais.length} com mais de 1 mês</i></div>
    </div>
    <div class="grade-crm">
      <section class="cartao"><div class="cab-crm"><h2>Leitura automática: onde as clientes travam</h2><span>${achados.length} pontos</span></div>
        ${achados.length ? `<div class="achados">${achados.map(([sev, t, d, sug, aba]) => `<div class="achado ${sev}">
          <span class="sev">${{ alta: 'Atenção', media: 'Melhorar', info: 'Oportunidade' }[sev]}</span>
          <b>${esc(t)}</b><p>${esc(d)}</p><p class="sug">→ ${esc(sug)}</p>
          ${aba ? `<button class="link-btn" data-ir="${aba}">${esc(nomesAba[aba] || 'Abrir')}</button>` : ''}</div>`).join('')}</div>`
          : '<p class="pequeno">Nada travando agora. Ótimo sinal!</p>'}
        <p class="dica" style="margin-top:10px">Esta leitura é refeita sozinha a cada atualização, com base no funil, nas visitas, nos popups e nos pagamentos.</p>
      </section>
      <div class="coluna" style="gap:16px">
        <section class="cartao"><div class="cab-crm"><h2>Quantas continuam assinando</h2><span>por mês desde a 1ª compra</span></div>
          ${barrasH(curva.filter(([, n]) => n).map(([m, n, p]) => [`Depois de ${m} ${m === 1 ? 'mês' : 'meses'}`, p, `${n} clientes`]), 100).replace(/<b>(\d+)<small>/g, '<b>$1%<small>')}
        </section>
        <section class="cartao"><div class="cab-crm"><h2>Base de clientes</h2></div>
          <div class="lista-crm">
            <div><span><i class="dot d-g"></i>Pagantes ativas</span><b>${ativas}</b></div>
            <div><span><i class="dot d-c"></i>Já pagaram alguma vez</span><b>${saude.length}</b></div>
            <div><span>Mensal / anual</span><b>${saude.filter((c) => c.ativa && c.plano !== 'anual').length} / ${saude.filter((c) => c.ativa && c.plano === 'anual').length}</b></div>
            <div><span>Recusas recuperadas</span><b>${saude.reduce((t, c) => t + Number(c.recuperados || 0), 0)} de ${saude.reduce((t, c) => t + Number(c.recusas || 0), 0)}</b></div>
            ${vidaTeste != null ? `<div><span>Vida média de quem veio do teste grátis</span><b>${num1(vidaTeste)} meses</b></div>` : ''}
          </div>
          <p class="dica" style="margin-top:10px">Vida média conta quem ainda está ativa até hoje. O valor esperado usa o cancelamento dos últimos 30 dias.</p>
        </section>
      </div>
    </div>`;
  $$('[data-ir]', tela).forEach((b) => { b.onclick = () => { estado.aba = b.dataset.ir; desenhar(); window.scrollTo(0, 0); }; });
}

// ---------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------
function cartaoNum(rotulo, valor, classe = '') {
  return `<div class="num-cartao ${classe}"><span class="rot">${esc(rotulo)}</span><b>${esc(valor)}</b></div>`;
}

// Períodos (no fuso do aparelho): Hoje, Ontem, 7 dias, 30 dias, Mês
function faixaPeriodo(p) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const menos = (n) => { const d = new Date(hoje); d.setDate(d.getDate() - n); return d.getTime(); };
  if (p === 'hoje') return [hoje.getTime(), Infinity];
  if (p === 'ontem') return [menos(1), hoje.getTime()];
  if (p === 'mes') return [new Date(hoje.getFullYear(), hoje.getMonth(), 1).getTime(), Infinity];
  const n = Number(p);
  if (n > 0) return [menos(n - 1), Infinity];
  return [0, Infinity];
}
function noPeriodo(iso, p) { const t = new Date(iso).getTime(); const [a, b] = faixaPeriodo(p); return t >= a && t < b; }
function abasPeriodo(lista, atual, attr) {
  return `<div class="etabas" style="margin-bottom:14px">${lista.map(([v, t]) => `<button class="${v === atual ? 'on' : ''}" ${attr}="${v}">${esc(t)}</button>`).join('')}</div>`;
}
function linhaBarra(rot, v, max, dir, sub) {
  return `<div class="lb"><span>${esc(rot)}</span><div class="b"><i style="width:${max ? Math.max(v > 0 ? 2 : 0, Math.round((v / max) * 100)) : 0}%"></i></div><span class="v">${dir}${sub ? `<small>${sub}</small>` : ''}</span></div>`;
}
const FORMA_NOME = { pix: 'Pix', cartao: 'Cartão', boleto: 'Boleto', outro: 'Outra forma' };

function abaResumo(tela) {
  const P = estado.painel, r = estado.resumo || {};
  const per = estado.resPer || 'hoje';
  if (!P) {
    tela.innerHTML = `${cartaoNotificacoes()}<div class="cartao">Não consegui carregar os números do painel. Toque em Atualizar.</div>`;
    return;
  }
  const pagos = P.pagamentos.filter((x) => x.st === 'pago' && noPeriodo(x.q, per));
  const soma = (l, k) => l.reduce((t, x) => t + Number(x[k] || 0), 0);
  const novas = pagos.filter((x) => x.tp === 'nova'), renov = pagos.filter((x) => x.tp === 'renovacao');
  const testes = (P.testes || []).filter((t) => noPeriodo(t.t, per));
  const viraram = testes.filter((t) => t.a).length;
  const at = P.ativas || {};
  const semForma = Math.max(0, (at.total || 0) - (at.pix || 0) - (at.cartao || 0));
  const ta = P.teste_ate_assinar || {};
  const faixasTa = [['No mesmo dia', ta.mesmo_dia], ['1 a 3 dias', ta.d1_3], ['4 a 7 dias', ta.d4_7], ['Depois do teste', ta.depois]];
  const meses = (P.meses || []);
  const primeiro = meses.findIndex((m) => Number(m.bruto) || Number(m.ativos));
  const mm = primeiro < 0 ? meses.slice(-6) : meses.slice(Math.max(primeiro, meses.length - 12));
  const maxFat = Math.max(1, ...mm.map((m) => Number(m.liquido) || 0));
  const maxAt = Math.max(1, ...mm.map((m) => Number(m.ativos) || 0));
  const qtdPlano = (l) => { const a = l.filter((x) => x.pl === 'anual').length; return `${a} anual · ${l.length - a} mensal`; };
  const qtdForma = (l) => `Pix ${l.filter((x) => x.fo === 'pix').length} · Cartão ${l.filter((x) => x.fo === 'cartao').length}`;
  const pend = (r.carencia || 0), canc = (r.canceladas || 0), bloq = (r.suspensas || 0);

  const cc = estado.cancelarCakto || [];
  tela.innerHTML = `
    ${cartaoNotificacoes()}
    ${cc.length ? `<section class="cartao coluna nota-amarela" style="gap:8px"><b>Cancele o mensal na Cakto (${cc.length})</b>
      <span class="pequeno">Estas clientes assinaram pelo checkout novo e ainda têm o mensal da Cakto. Cancele lá para não cobrar duas vezes e toque em "Já cancelei".</span>
      ${cc.map((x) => `<div class="linha-flex entre pequeno" style="gap:10px"><span><b>${esc(x.nome || x.email)}</b> · ${esc(x.email)} · ${esc(dataHora(x.quando))}</span><button class="btn mini contorno" data-cakto-ok="${esc(x.email)}">Já cancelei</button></div>`).join('')}
    </section>` : ''}
    ${abasPeriodo([['hoje', 'Hoje'], ['ontem', 'Ontem'], ['7', '7 dias'], ['mes', 'Mês']], per, 'data-res-per')}
    <div class="kpis-crm k4">
      <div class="kpi"><small>Faturamento líquido</small><b>${esc(reais(soma(pagos, 'l')))}</b><i>bruto ${esc(reais(soma(pagos, 'b')))}</i></div>
      <div class="kpi"><small>Vendas novas</small><b>${novas.length}</b><i>${esc(novas.length ? qtdPlano(novas) + ' · ' + qtdForma(novas) : 'nenhuma no período')}</i></div>
      <div class="kpi"><small>Renovações</small><b>${renov.length}</b><i>${esc(renov.length ? qtdForma(renov) : 'nenhuma no período')}</i></div>
      <div class="kpi"><small>Testes iniciados</small><b>${testes.length}</b><i class="${viraram ? 'p' : ''}">${testes.length ? `${pct(viraram, testes.length)}% viraram assinantes` : 'nenhum no período'}</i></div>
    </div>
    <div class="res-grade">
      <section class="cartao"><div class="cab-crm"><h2>Assinaturas ativas</h2><span>agora</span></div>
        <div class="mini-num"><div><small>Total</small><b>${at.total || 0}</b></div><div><small>Anual</small><b>${at.anual || 0}</b></div><div><small>Mensal</small><b>${at.mensal || 0}</b></div></div>
        <div class="mini-num d2" style="margin-top:10px"><div><small>No Pix</small><b>${at.pix || 0}</b></div><div><small>No cartão</small><b>${at.cartao || 0}</b></div></div>
        ${semForma ? `<p class="dica" style="margin-top:8px">${semForma} sem a forma de pagamento informada pela Cakto.</p>` : ''}
        ${at.manual ? `<p class="dica" style="margin-top:4px">Mais ${at.manual} liberada(s) por você, sem pagamento.</p>` : ''}
        ${pend || canc || bloq ? `<div class="lista-crm" style="margin-top:8px">
          ${pend ? `<div><span><i class="dot d-y"></i>Pagamento pendente</span><b>${pend}</b></div>` : ''}
          ${canc ? `<div><span><i class="dot d-c"></i>Canceladas</span><b>${canc}</b></div>` : ''}
          ${bloq ? `<div><span><i class="dot d-r"></i>Bloqueadas</span><b>${bloq}</b></div>` : ''}</div>` : ''}
      </section>
      <section class="cartao"><div class="cab-crm"><h2>Do teste grátis até assinar</h2><span>${ta.total ? `média ${esc(num1(ta.media || 0))} dias` : ''}</span></div>
        ${ta.total ? faixasTa.map(([t, v]) => linhaBarra(t, Number(v) || 0, ta.total, `${pct(Number(v) || 0, ta.total)}%`, `${Number(v) || 0} ${Number(v) === 1 ? 'pessoa' : 'pessoas'}`)).join('')
          : '<p class="pequeno">Ainda não há assinaturas vindas do teste.</p>'}
      </section>
    </div>
    <section class="cartao"><div class="cab-crm"><h2>Faturamento por mês</h2><span>líquido (já sem as taxas da Cakto) · bruto embaixo</span></div>
      ${mm.map((m) => linhaBarra(mesCurto(m.mes), Number(m.liquido) || 0, maxFat, esc(reais(m.liquido)), `bruto ${esc(reais(m.bruto))}`)).join('')}
    </section>
    <section class="cartao"><div class="cab-crm"><h2>Assinantes mês a mês</h2><span>ativas no fim do mês · contas novas embaixo</span></div>
      ${mm.map((m) => linhaBarra(mesCurto(m.mes), Number(m.ativos) || 0, maxAt, String(Number(m.ativos) || 0), `+${Number(m.contas_novas) || 0} contas`)).join('')}
    </section>
    ${estado.origem ? `<section class="cartao"><div class="cab-crm"><h2>Testes por origem</h2><span>desde o início</span></div>
      <div class="lista-crm">
        <div><span>Anúncio</span><b>${estado.origem.anuncio.total} testes · ${estado.origem.anuncio.convertidos} assinantes</b></div>
        <div><span>WhatsApp / direto</span><b>${estado.origem.direto.total} testes · ${estado.origem.direto.convertidos} assinantes</b></div>
        ${(estado.origem.por_campanha || []).map((x) => `<div><span>${esc(x.campanha)}</span><b>${x.total} testes · ${x.convertidos} assinantes</b></div>`).join('')}
      </div></section>` : ''}`;
  $$('[data-res-per]', tela).forEach((b) => (b.onclick = () => { estado.resPer = b.dataset.resPer; desenhar(); }));
  $$('[data-cakto-ok]', tela).forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    try { await dados.adminCaktoCancelado(b.dataset.caktoOk); estado.cancelarCakto = (estado.cancelarCakto || []).filter((x) => x.email !== b.dataset.caktoOk); desenhar(); }
    catch (e) { aviso(e.message); b.disabled = false; }
  }));
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
  let ativo = false;
  try { ativo = Notification.permission === 'granted' && localStorage.getItem('apm-avisos-ativos') === '1'; } catch (e) { /* segue */ }
  if (ativo) return ''; // já ativadas: o cartão some (volta sozinho se a permissão for tirada)
  return `<section class="cartao coluna" id="cartao-avisos" style="gap:10px">
    <div style="display:flex;gap:12px;align-items:center"><div style="font-size:34px" aria-hidden="true">🔔</div><div>
      <b style="font-size:17px">Notificações no celular</b>
      <div class="pequeno">${ativo ? 'Ativadas neste celular. Você recebe: novo teste grátis, venda realizada, teste que virou assinante e pagamento recusado.'
        : 'Avisos de novo teste grátis, venda realizada, teste que virou assinante e pagamento recusado.'}</div></div></div>
    ${ativo ? '<button class="btn contorno cheio" id="testar-avisos">Enviar uma notificação de teste</button>'
      : '<button class="btn verde cheio" id="ativar-avisos">Ativar notificações</button>'}
    ${Notification.permission === 'denied' ? '<div class="pequeno" style="color:var(--neg)">As notificações estão bloqueadas no navegador. Toque no cadeado ao lado do endereço, abra Permissões e libere Notificações.</div>' : ''}
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
// Modo suporte: cada loja abre numa aba nova; o painel continua aberto nesta.
async function entrarNaLoja(email, soLeitura) {
  let aba = null;
  try { aba = window.open('', '_blank'); if (aba) aba.document.write('<p style="font:16px sans-serif;padding:24px">Abrindo a loja…</p>'); } catch (e) { aba = null; }
  try {
    const r = await dados.adminEntrarLoja(email, soLeitura);
    const url = 'index.html?suporte=' + encodeURIComponent(r.negocio_id);
    if (aba && !aba.closed) aba.location.href = url; else location.href = url;
  } catch (e) {
    try { if (aba) aba.close(); } catch (x) { /* segue */ }
    throw e;
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
    <label class="campo"><span>Buscar</span><input type="search" id="busca" placeholder="Nome, e-mail, telefone ou negócio" value="${esc(estado.busca)}"></label>
    <div class="filtros">${FILTROS.map(([f, t]) => `<button class="filtro ${estado.filtro === f ? 'ativo' : ''}" data-f="${f}">${esc(t)} (${contagem(f)})</button>`).join('')}</div>
    <div class="nota-crm" style="margin:0"><b>Leads</b> = pessoas que passaram pela Cakto (geraram Pix, tiveram cartão recusado ou abriram o checkout) mas ainda não têm teste nem assinatura. Vale chamar no WhatsApp.</div>
    <div class="linha-flex entre"><span class="pequeno" id="qtd"></span><button class="btn mini contorno" id="exportar">Baixar lista (planilha)</button></div>
    <section class="cartao lista-cli"><div id="lista"></div></section>
    <details class="cartao coluna"><summary style="font-weight:800;cursor:pointer">Liberar acesso sem prazo</summary>
    <form class="coluna" id="liberar-form" novalidate style="margin-top:10px">
      <p class="pequeno">Para testadoras, parcerias ou quem pagou por fora. A pessoa cria a conta no app com este e-mail. (O teste de 7 dias já é automático para todo novo cadastro.)</p>
      <label class="campo"><span>E-mail</span><input type="email" name="email" inputmode="email" autocomplete="off" placeholder="cliente@email.com" required></label>
      <button class="btn principal cheio" type="submit" data-tipo="acesso">Liberar acesso sem prazo</button>
    </form></details>`;

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
  if (c.tem_conta && c.conta_criada_em) {
    const d = Math.floor((Date.now() - new Date(c.conta_criada_em).getTime()) / 864e5);
    infos.push(['No app há', `${d <= 0 ? 'menos de 1 dia' : d === 1 ? '1 dia' : d + ' dias'} (desde ${data(c.conta_criada_em)})`]);
  } else infos.push(['Conta no app', c.tem_conta ? 'Criada' : 'Ainda não criou']);
  if (c.tem_conta) infos.push(['Kits / reservas', `${c.kits || 0} / ${c.reservas || 0}`]);
  if (c.tem_conta) infos.push(['Último uso', haQuanto(c.ultimo_acesso)]);
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
      <span class="passos-adm">${passos.map((ok) => `<i class="${ok ? 'ok' : ''}"></i>`).join('')} ${passos.filter(Boolean).length} de 4 passos</span>
      ${parada ? '<span class="sit sit-teste_encerrado">Parada</span>' : ''}
    </div>
    ${parada ? '<div class="aviso-parada">Ainda não cadastrou nenhum kit. Vale chamar hoje.</div>' : ''}
    ${tel ? `<div class="acoes">
      <a class="btn mini verde" href="${esc(linkZap(tel, textoMsg(nomeMsg)))}" target="_blank" rel="noopener">Mensagem: ${esc(rotuloMsg)}</a>
      <button class="btn mini contorno" data-msgs="${esc(c.email)}">Outras mensagens</button>
    </div>` : ''}` : '';
  const origem = (c.teste_inicio || c.origem) ? `<div class="linha-flex" style="gap:6px;flex-wrap:wrap">${rotuloOrigem(c.origem)}</div>` : '';

  const semLoja = c.tem_conta && !c.negocio;
  const aberta = (estado.abertos || new Set()).has(c.email);
  const rotulo = c.situacao === 'ativa' && ['anual', 'mensal'].includes(c.plano) ? `Ativa · ${c.plano === 'anual' ? 'Anual' : 'Mensal'}`
    : c.situacao === 'teste' ? `Em teste · dia ${dia || 1}` : (SITUACAO[c.situacao] || c.situacao);
  const direita = c.tem_conta ? `${c.kits || 0} kit${Number(c.kits) === 1 ? '' : 's'} · ${c.reservas || 0} reserva${Number(c.reservas) === 1 ? '' : 's'}`
    : c.ultimo_aviso_evento ? `${(EVENTO[c.ultimo_aviso_evento] || [c.ultimo_aviso_evento])[0]} ${data(c.ultimo_aviso).slice(0, 5)}` : '';
  return `<article class="cli pessoa ${aberta ? 'aberta' : ''}" data-email="${esc(c.email)}">
    <button class="cli-cab" data-abrir="1" aria-expanded="${aberta}">
      <span class="sit sit-${esc(c.situacao)}">${esc(rotulo)}</span>
      <span class="n"><b>${esc(c.negocio || nome)}</b><small>${esc(c.email)}</small></span>
      <span class="r">${esc(direita)}</span><span class="seta" aria-hidden="true">›</span>
    </button>
    <div class="cli-corpo" ${aberta ? '' : 'hidden'}>
    ${semLoja ? '<div class="aviso-parada">Criou a conta, mas <b>ainda não criou a loja</b> (parou na primeira tela). Vale chamar para ajudar a terminar o cadastro.</div>' : ''}
    ${blocoTeste}
    ${origem}
    <div class="infos">${infos.map(([k, v]) => `<div>${esc(k)}<br><b>${esc(v)}</b></div>`).join('')}</div>
    <div class="acoes">
      ${c.slug ? `<a class="btn mini contorno" href="${esc(linkVerLoja(c.slug))}" target="_blank" rel="noopener">Ver loja</a>` : ''}
      ${c.slug ? `<button class="btn mini principal" data-suporte="1">Entrar na loja para ajudar</button>` : ''}
      ${c.slug ? `<button class="btn mini contorno" data-leitura="1">Só olhar</button>` : ''}
      ${tel ? `<a class="btn mini verde" href="${esc(linkZap(tel, msg))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
      <a class="btn mini contorno" href="mailto:${esc(c.email)}">E-mail</a>
      ${c.tem_conta || c.teste_inicio || c.plano ? '<button class="btn mini contorno" data-editar="1">Editar dados</button>' : ''}
      ${c.slug ? `<a class="btn mini contorno" href="reservar.html?l=${encodeURIComponent(c.slug)}" target="_blank" rel="noopener">Ver link</a>` : ''}
      ${liberada
        ? `<button class="btn mini perigo" data-acao="bloquear">Bloquear acesso</button>`
        : `<button class="btn mini claro" data-acao="liberar">Liberar acesso</button>`}
    </div>
    </div>
  </article>`;
}

// Editar dados da cliente: formulário, resumo do que muda e confirmação
function soDigitosAdm(v) {
  let d = String(v || '').replace(/\D/g, '').replace(/^0+/, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return d;
}
async function editarCliente(c) {
  if (!c) return;
  const tel0 = soDigitosAdm(c.telefone || ''), zap0 = soDigitosAdm(c.whatsapp || '');
  const caixa = document.createElement('div');
  caixa.className = 'modal-adm';
  caixa.innerHTML = `<div class="modal-in cartao coluna" role="dialog" aria-modal="true">
    <div class="cab-crm" style="margin:0"><h2>Editar dados da cliente</h2><button class="link-btn" id="ed-x">Fechar</button></div>
    <p class="pequeno" style="margin:0">A senha não muda. Kits, fotos e reservas continuam iguais.</p>
    <form class="coluna" id="ed-form" novalidate>
      <label class="campo"><span>Nome</span><input name="nome" maxlength="80" value="${esc(c.nome || '')}" placeholder="Nome da cliente"></label>
      <label class="campo"><span>E-mail de login</span><input name="email" type="email" value="${esc(c.email)}"><span class="dica" id="ed-dica-email"></span></label>
      <label class="campo"><span>Telefone do cadastro</span><div class="campo-pre"><span>+55</span><input name="telefone" inputmode="tel" value="${esc(tel0)}" placeholder="51999990000"></div></label>
      ${c.negocio ? `<label class="campo"><span>WhatsApp da loja (aparece no link de reservas)</span><div class="campo-pre"><span>+55</span><input name="whatsapp" inputmode="tel" value="${esc(zap0)}"></div></label>` : ''}
      <div id="ed-resumo"></div>
      <div class="linha-flex" style="gap:8px;justify-content:flex-end"><button type="button" class="btn contorno" id="ed-cancelar">Cancelar</button><button class="btn principal" id="ed-salvar">Revisar alterações</button></div>
    </form>
    <div id="ed-hist"></div>
  </div>`;
  document.body.appendChild(caixa);
  const fechar = () => caixa.remove();
  $('#ed-x', caixa).onclick = fechar; $('#ed-cancelar', caixa).onclick = fechar;
  caixa.onclick = (e) => { if (e.target === caixa) fechar(); };
  const f = $('#ed-form', caixa);
  f.email.oninput = () => { $('#ed-dica-email', caixa).textContent = f.email.value.trim().toLowerCase() !== c.email ? 'Ela vai passar a entrar no app com este e-mail.' : ''; };
  dados.adminHistoricoCliente(c.email).then((h) => {
    if (!h || !h.length) return;
    const nomes = { email: 'E-mail', nome: 'Nome', telefone: 'Telefone', whatsapp_loja: 'WhatsApp da loja' };
    $('#ed-hist', caixa).innerHTML = `<b class="pequeno" style="color:var(--tinta)">Alterações anteriores</b><div class="hist">${h.map((x) => `<div><b>${dataHora(x.quando)}</b> · ${esc(nomes[x.campo] || x.campo)}: ${esc(x.antes || '—')} → ${esc(x.depois || '—')}</div>`).join('')}</div>`;
  }).catch(() => {});
  let confirmando = false;
  f.onsubmit = async (e) => {
    e.preventDefault();
    const novo = { nome: f.nome.value.trim(), email: f.email.value.trim().toLowerCase(), telefone: soDigitosAdm(f.telefone.value), whatsapp_loja: f.whatsapp ? soDigitosAdm(f.whatsapp.value) : null };
    const mud = [];
    if (novo.nome !== (c.nome || '')) mud.push(['Nome', c.nome || '—', novo.nome || '—']);
    if (novo.email !== c.email) mud.push(['E-mail de login', c.email, novo.email]);
    if (novo.telefone !== tel0) mud.push(['Telefone', tel0 || '—', novo.telefone || '—']);
    if (f.whatsapp && novo.whatsapp_loja !== zap0) mud.push(['WhatsApp da loja', zap0 || '—', novo.whatsapp_loja || '—']);
    const resumo = $('#ed-resumo', caixa), bt = $('#ed-salvar', caixa);
    if (!mud.length) { resumo.innerHTML = '<p class="pequeno">Nada foi alterado.</p>'; return; }
    if (novo.email !== c.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(novo.email)) { resumo.innerHTML = '<p class="pequeno" style="color:var(--neg)">Confira o e-mail novo.</p>'; return; }
    if (!confirmando) {
      resumo.innerHTML = `<div class="interesse"><b class="pequeno" style="color:var(--tinta)">Confira antes de salvar</b>${mud.map(([k, a, d]) => `<div class="pequeno">${esc(k)}: <s>${esc(a)}</s> → <b style="color:var(--tinta)">${esc(d)}</b></div>`).join('')}</div>`;
      bt.textContent = 'Confirmar e salvar'; confirmando = true; return;
    }
    bt.disabled = true; bt.textContent = 'Salvando…';
    try {
      await dados.adminEditarCliente(c.email, {
        nome: novo.nome !== (c.nome || '') ? novo.nome : null,
        email: novo.email !== c.email ? novo.email : null,
        telefone: novo.telefone !== tel0 ? novo.telefone : null,
        whatsapp_loja: f.whatsapp && novo.whatsapp_loja !== zap0 ? novo.whatsapp_loja : null,
      });
      fechar(); aviso('Dados atualizados.');
      await carregar(); desenhar();
    } catch (err) {
      resumo.innerHTML = `<p class="pequeno" style="color:var(--neg)">${esc(err.message)}</p>`;
      bt.disabled = false; bt.textContent = 'Confirmar e salvar';
    }
  };
}

function desenharLista() {
  const lista = $('#lista');
  if (!lista) return;
  const itens = filtrados();
  $('#qtd').textContent = `${itens.length} pessoa(s)`;
  lista.innerHTML = itens.length
    ? itens.map(cartaoPessoa).join('')
    : '<p class="pequeno centro" style="padding:20px 0">Ninguém por aqui ainda.</p>';
  $$('[data-abrir]', lista).forEach((b) => {
    b.onclick = () => {
      const art = b.closest('.cli');
      const ab = estado.abertos || (estado.abertos = new Set());
      const email = art.dataset.email;
      if (ab.has(email)) ab.delete(email); else ab.add(email);
      const on = ab.has(email);
      art.classList.toggle('aberta', on);
      b.setAttribute('aria-expanded', String(on));
      art.querySelector('.cli-corpo').hidden = !on;
    };
  });
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
  $$('[data-editar]', lista).forEach((b) => {
    b.onclick = () => editarCliente(estado.clientes.find((x) => x.email === b.closest('[data-email]').dataset.email));
  });
  $$('[data-suporte]', lista).forEach((b) => {
    b.onclick = async () => {
      const email = b.closest('[data-email]').dataset.email;
      b.disabled = true; b.textContent = 'Entrando…';
      try {
        await entrarNaLoja(email);
        b.disabled = false; b.textContent = 'Entrar na loja para ajudar';
      } catch (e) {
        aviso(e.message || 'Não deu para entrar na loja.');
        b.disabled = false; b.textContent = 'Entrar na loja para ajudar';
      }
    };
  });
  $$('[data-leitura]', lista).forEach((b) => {
    b.onclick = async () => {
      b.disabled = true; b.textContent = 'Entrando…';
      try { await entrarNaLoja(b.closest('[data-email]').dataset.email, true); b.disabled = false; b.textContent = 'Só olhar'; }
      catch (e) { aviso(e.message || 'Não deu para entrar na loja.'); b.disabled = false; b.textContent = 'Só olhar'; }
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
    ['Último uso', (c) => (c.ultimo_acesso ? data(c.ultimo_acesso) : '')],
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
const ST_PAG = { pago: 'Pago', pix_pendente: 'Pix pendente', pendente: 'Atrasado', recusado: 'Recusado', cancelado: 'Cancelado', abandono: 'Abandonou' };
const EV_CANCEL = { refund: 'reembolso', chargeback: 'contestação', subscription_canceled: 'cancelou' };
const EMAIL_REC = { carrinho: 'E-mail de carrinho', checkout: 'E-mail de carrinho', pix_pendente: 'Pix por e-mail', pix_vencido: 'Pix não pago', cartao_recusado: 'E-mail de recusa' };
const ZAP_REC = {
  abandono: 'Oi{nome}! Vi que você começou a assinar o App Pegue e Monte e não terminou. Ficou alguma dúvida? Te ajudo a finalizar por aqui 😊',
  pix_pendente: 'Oi{nome}! Vi que você gerou o Pix do App Pegue e Monte, mas ele não foi pago. Quer que eu te ajude a finalizar? Se o Pix venceu, te mando o link para gerar outro 😊',
  recusado: 'Oi{nome}! Vi que o pagamento no cartão não passou. Quer tentar no Pix ou começar pelo plano mensal? Te ajudo por aqui 😊',
};
// Chama uma função do banco direto (sem depender de versão nova do dados.js)
async function rpcAdmin(nome, args = {}) {
  const sessao = await dados.sessaoAtual();
  if (!sessao || !sessao.access_token) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: 'POST', body: JSON.stringify(args),
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${sessao.access_token}`, 'Content-Type': 'application/json' },
  });
  if (!r.ok) return null; // banco ainda sem a atualização: a tela continua funcionando sem essa parte
  return r.json();
}
// Dados da recuperação (abandonos, telefones, e-mails enviados e vendas recuperadas)
async function carregarRecuperacao() {
  if (dados.MODO_DEMO) {
    const h = (m) => new Date(Date.now() - m * 6e4).toISOString();
    return { abandonos: [{ q: h(65), em: 'juliana.festas@exemplo.com', no: 'Juliana Mendes', pl: 'anual', v: 167 }, { q: h(190), em: 'carla.kits@exemplo.com', no: 'Carla Souza', pl: 'mensal', v: 29.9 }],
      recuperados: [{ q: h(30), em: 'ana@exemplo.com', v: 167, pl: 'anual', de: 'pix_gerado' }],
      contatos: { 'juliana.festas@exemplo.com': { tel: '5511987654321', emails: [{ t: 'carrinho', q: h(5), ab: true, cl: false }] }, 'carla.kits@exemplo.com': { tel: '21996541122', emails: [] } } };
  }
  const sessao = await dados.sessaoAtual();
  if (!sessao || !sessao.access_token) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_recuperacao`, {
    method: 'POST', body: '{}',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${sessao.access_token}`, 'Content-Type': 'application/json' },
  });
  if (!r.ok) return null; // banco ainda sem a atualização 26: a tela continua funcionando sem essa parte
  return r.json();
}
function zapRecuperacao(tel, tipo, nome) {
  if (String(tel || '').replace(/\D/g, '').length < 10) return '';
  const n = String(nome || '').trim().split(/\s+/)[0] || '';
  return linkZap(tel, (ZAP_REC[tipo] || ZAP_REC.abandono).replace('{nome}', n ? ', ' + n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : ''));
}
function telBonito(tel) {
  const d = String(tel || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}
function emailsRec(c) {
  return (c && c.emails || []).map((m) => `<span class="em-rec">✉ ${esc(EMAIL_REC[m.t] || m.t)}: <i class="${m.ab || m.cl ? '' : 'na'}">enviado ${esc(dataHora(m.q))}${m.pr ? ' · ' + esc(m.pr) : m.cl ? ' · clicou' : m.ab ? ' · abriu' : ''}</i></span>`).join('');
}
function abaPagamentos(tela) {
  const P = estado.painel;
  if (!P) { tela.innerHTML = '<div class="cartao">Não consegui carregar os pagamentos. Toque em Atualizar.</div>'; return; }
  const R = estado.recup || { abandonos: [], recuperados: [], contatos: {} };
  const f = estado.pagF || (estado.pagF = { per: '7', aba: 'pago', plano: '', forma: '', tipo: '' });
  if (!f.aba) f.aba = 'pago';
  const filtro = (x) => (!f.plano || x.pl === f.plano) && (!f.forma || x.fo === f.forma) && (!f.tipo || x.tp === f.tipo);
  const doPer = P.pagamentos.filter((x) => noPeriodo(x.q, f.per)).filter(filtro);
  const aband = (R.abandonos || []).filter((x) => noPeriodo(x.q, f.per) && (!f.plano || x.pl === f.plano))
    .map((x) => ({ ...x, st: 'abandono', b: x.v }));
  const grupo = { pago: doPer.filter((x) => x.st === 'pago'), pix_pendente: doPer.filter((x) => x.st === 'pix_pendente'),
    recusado: doPer.filter((x) => x.st === 'recusado'), abandono: aband, outros: doPer.filter((x) => x.st === 'pendente' || x.st === 'cancelado') };
  const recup = (R.recuperados || []).filter((x) => noPeriodo(x.q, f.per) && (!f.plano || x.pl === f.plano));
  const somaRec = recup.reduce((t, x) => t + Number(x.v || 0), 0);
  const cart = (k, rot, sub) => `<button class="kpi ${f.aba === k ? 'on' : ''}" data-pag-aba="${k}"><small>${esc(rot)}</small><b>${grupo[k].length}</b><i>${esc(sub)}</i></button>`;
  const pill = (campo, v, t) => `<button class="${f[campo] === v ? 'on' : ''}" data-pag-c="${campo}" data-pag-v="${v}">${esc(t)}</button>`;
  const PER_NOME = { hoje: 'hoje', ontem: 'ontem', 7: 'nos 7 dias', 30: 'nos 30 dias' };
  const EXPLICA = {
    pago: 'Pagamentos aprovados (vendas novas e renovações).',
    pix_pendente: 'Gerou o Pix e não pagou. Quem pagar depois sai daqui e conta como recuperada.',
    recusado: 'Cartão recusado e não pagou de outro jeito. Quem pagar depois sai daqui e conta como recuperada.',
    abandono: 'Deixou nome, e-mail e WhatsApp no checkout e saiu sem pagar. Quando a pessoa paga, sai daqui sozinha e conta como recuperada.',
    outros: 'Cobranças atrasadas, cancelamentos, reembolsos e contestações.',
  };
  const lista = grupo[f.aba] || [];
  const linha = (x) => {
    const c = (R.contatos || {})[x.em] || {};
    const zap = x.st === 'pago' || x.st === 'cancelado' || x.st === 'pendente' ? '' : zapRecuperacao(c.tel, x.st, x.no);
    const etiqueta = x.st === 'cancelado' ? (EV_CANCEL[x.ev] || 'Cancelado').replace(/^./, (l) => l.toUpperCase()) : ST_PAG[x.st] || x.st;
    const titulo = [x.pl === 'anual' ? 'Anual' : x.pl === 'mensal' ? 'Mensal' : '', FORMA_NOME[x.fo] || '', x.tp === 'nova' ? 'venda nova' : x.tp === 'renovacao' ? 'renovação' : ''].filter(Boolean).join(' · ');
    return `<div class="pg-ab">
      <div style="min-width:0"><b class="t">${esc(x.no || x.em)}</b>
        <small>${esc([x.no ? x.em : '', telBonito(c.tel)].filter(Boolean).join(' · '))}</small>
        <small><span class="st st-${esc(x.st)}">${esc(etiqueta)}</span> ${esc([titulo, dataHora(x.q), x.st === 'abandono' ? 'Cakto' : x.gw === 'pagarme' ? 'Pagar.me' : x.gw === 'appmax' ? 'Appmax' : 'Cakto'].filter(Boolean).join(' · '))}</small>
        ${x.cp || x.pp ? `<small>${esc([x.cp ? 'Anúncio: ' + x.cp : '', x.pp ? 'Popup: ' + (NOMES_POPUP[x.pp] || x.pp) : ''].filter(Boolean).join(' · '))}</small>` : ''}
        ${x.st === 'pago' ? '' : emailsRec(c)}</div>
      <div class="ld"><span class="v">${x.b ? esc(reais(x.b)) : ''}</span>${zap ? `<a class="zapb" href="${esc(zap)}" target="_blank" rel="noopener">Chamar no WhatsApp</a>` : ''}</div></div>`;
  };
  tela.innerHTML = `
    ${abasPeriodo([['hoje', 'Hoje'], ['ontem', 'Ontem'], ['7', '7 dias'], ['30', '30 dias']], f.per, 'data-pag-per')}
    <div class="kpis-crm k4">
      ${cart('pago', 'Pagos', reais(grupo.pago.reduce((t, x) => t + Number(x.b || 0), 0)))}
      ${cart('pix_pendente', 'Pix pendentes', 'gerou o Pix e não pagou')}
      ${cart('recusado', 'Recusados', 'cartão recusado')}
      ${cart('abandono', 'Abandonados', 'deixou os dados e saiu')}
    </div>
    ${estado.recup ? `<div class="rec-faixa">✓ Recuperados ${esc(PER_NOME[f.per] || '')}: ${recup.length} ${recup.length === 1 ? 'venda' : 'vendas'} · ${esc(reais(somaRec))} <span>(pagaram 1 hora ou mais depois de sair sem pagar)</span></div>` : ''}
    <div class="pills-adm" style="margin:4px 0 2px">
      ${pill('plano', '', 'Todos')}${pill('plano', 'anual', 'Anual')}${pill('plano', 'mensal', 'Mensal')}
      <span style="width:10px"></span>${pill('forma', '', 'Pix e cartão')}${pill('forma', 'pix', 'Só Pix')}${pill('forma', 'cartao', 'Só cartão')}
      <span style="width:10px"></span>${pill('tipo', '', 'Novas e renovações')}${pill('tipo', 'nova', 'Vendas novas')}${pill('tipo', 'renovacao', 'Renovações')}
      ${grupo.outros.length ? `<span style="width:10px"></span><button class="${f.aba === 'outros' ? 'on' : ''}" data-pag-aba="outros">Atrasados e cancelamentos (${grupo.outros.length})</button>` : ''}
    </div>
    <section class="cartao">
      <p class="pequeno" style="margin:0 0 4px">${esc(EXPLICA[f.aba] || '')}</p>
      ${f.aba === 'abandono' && !estado.recup ? '<p class="pequeno centro" style="padding:16px 0">Os abandonos aparecem depois da atualização do banco (passo 1).</p>'
        : lista.length ? `<div class="pg-lista">${lista.slice(0, 300).map(linha).join('')}</div>`
        : '<p class="pequeno centro" style="padding:16px 0">Ninguém aqui neste período com esses filtros.</p>'}
    </section>
    <p class="dica">O botão "Chamar no WhatsApp" abre a conversa com uma mensagem pronta para cada caso. Pix que já foi pago aparece só como Pago.</p>`;
  $$('[data-pag-per]', tela).forEach((b) => (b.onclick = () => { f.per = b.dataset.pagPer; desenhar(); }));
  $$('[data-pag-aba]', tela).forEach((b) => (b.onclick = () => { f.aba = b.dataset.pagAba; desenhar(); }));
  $$('[data-pag-c]', tela).forEach((b) => (b.onclick = () => { f[b.dataset.pagC] = b.dataset.pagV; desenhar(); }));
}

// =====================================================================
// V.0.0.7 — Ver loja, níveis de interesse, Central de mensagens,
// e-mails automáticos e montagem contratada
// =====================================================================
function linkVerLoja(slug) {
  const bonito = /(^|\.)pegueemonte\.com$/.test(location.hostname);
  return bonito ? `${location.origin}/${encodeURIComponent(slug)}?adm=1` : `reservar.html?l=${encodeURIComponent(slug)}&adm=1`;
}
function nomeDe(email) {
  const c = (estado.clientes || []).find((x) => x.email === email);
  const n = String((c && c.nome) || '').trim().split(/\s+/)[0] || '';
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : '';
}
function abrirFicha(email) {
  const p = (estado.crm || []).find((x) => x.email === email);
  if (!p) { aviso('Essa pessoa não está no funil do teste.'); return; }
  const g = grupoAbordagem(p);
  estado.abordAba = g === 'assinou' ? 'geral' : g;
  estado.abordSel = p.email;
  estado.aba = 'abordagem';
  desenhar(); window.scrollTo(0, 0);
}

// ---------- Níveis de interesse (página Popups e ofertas) ----------
const MSG_NIVEL = {
  1: 'Oi{nome}! Vi que você está testando o App Pegue e Monte. Já conseguiu cadastrar seus kits? Se quiser, te ajudo por aqui 😊',
  2: 'Oi{nome}! Vi que você deu uma olhada nos planos do app. Ficou alguma dúvida? Posso te explicar rapidinho.',
  3: 'Oi{nome}! Vi que você ficou olhando os planos. Quer que eu te ajude a escolher o melhor para a sua loja?',
  4: 'Oi{nome}! Vi que você chegou a escolher um plano. Ficou alguma dúvida? Posso te ajudar a finalizar 😊',
  5: 'Oi{nome}! Obrigado por assinar o App Pegue e Monte 💖 Qualquer dúvida, é só me chamar por aqui.',
};
function ultimaInteracao(p) { return (p.interacoes || [])[0] || null; }
function ultimoBotao(p) { const c = (p.interacoes || []).find((i) => i.acao === 'checkout'); return c ? (NOMES_PLANO[c.detalhe] || c.detalhe || '') : ''; }
function blocoNiveis() {
  const crm = estado.crm || [];
  if (!crm.length) return '';
  const cont = [0, 0, 0, 0, 0, 0];
  crm.forEach((p) => { cont[nivelInteresse(p)]++; });
  const sel = estado.nivelSel ?? 4;
  const lista = crm.filter((p) => sel === 'todos' || nivelInteresse(p) === sel)
    .sort((a, b) => new Date((ultimaInteracao(b) || {}).quando || 0) - new Date((ultimaInteracao(a) || {}).quando || 0));
  const pilula = (n) => `<button class="nivel-pilula ${sel === n ? 'on' : ''}" data-nivel="${n}">
      <span class="nivel mini">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= n ? 'on' : ''}"></i>`).join('')}</span>
      <b>${cont[n]}</b><span>${esc(NOMES_NIVEL[n])}</span></button>`;
  return `<section class="cartao"><div class="cab-crm"><h2>Níveis de interesse</h2><span>toque num nível para ver quem está nele</span></div>
    <div class="niveis-pilulas">${[1, 2, 3, 4, 5].map(pilula).join('')}
      <button class="nivel-pilula ${sel === 'todos' ? 'on' : ''}" data-nivel="todos"><b>${crm.length}</b><span>Todos os níveis${cont[0] ? ` (${cont[0]} ainda não viram oferta)` : ''}</span></button></div>
    ${lista.length ? `<div class="tabela t-niveis"><div class="tr th"><span>Pessoa / loja</span><span>Última interação</span><span>Botão</span><span>Teste</span><span>Etapa</span><span>Último uso</span><span></span></div>
      ${lista.slice(0, 80).map((p) => {
        const u = ultimaInteracao(p); const n = nivelInteresse(p); const nome = nomeDe(p.email);
        const tel = p.telefone || p.whatsapp_loja;
        const msg = (MSG_NIVEL[n] || MSG_NIVEL[1]).replace('{nome}', nome ? `, ${nome}` : '');
        const g = grupoAbordagem(p);
        return `<div class="tr"><span>${esc(nome ? nome + ' · ' : '')}${esc(p.loja || p.email)}<small>${esc(p.email)}</small></span>
          <span>${u ? `${esc(quandoCurto(u.quando))}<small>${esc(NOMES_POPUP[u.popup] || u.popup)}</small>` : '—'}</span>
          <span>${esc(ultimoBotao(p) || '—')}</span>
          <span>${g === 'assinou' ? 'assinou' : g === 'nao' ? 'acabou' : 'dia ' + crmDiaDoTeste(p)}</span>
          <span>${esc((ETAPAS[(p.etapa || 1) - 1] || [])[3] || '')}</span>
          <span>${esc(quandoCurto(p.ultimo_uso))}</span>
          <span class="acoes-linha">${tel ? `<a class="btn verde mini" href="${esc(linkZap(tel, msg))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}<button class="btn contorno mini" data-ficha="${esc(p.email)}">Ficha</button></span></div>`;
      }).join('')}</div>${lista.length > 80 ? `<p class="dica">Mostrando as 80 interações mais recentes de ${lista.length}.</p>` : ''}`
      : '<p class="pequeno">Ninguém neste nível agora.</p>'}
    <p class="dica" style="margin-top:8px">A mensagem do WhatsApp já vai pronta para o nível de cada pessoa.</p>
  </section>`;
}
function ligarNiveis(el) {
  $$('[data-nivel]', el).forEach((b) => (b.onclick = () => { estado.nivelSel = b.dataset.nivel === 'todos' ? 'todos' : Number(b.dataset.nivel); desenhar(); }));
  $$('[data-ficha]', el).forEach((b) => (b.onclick = () => abrirFicha(b.dataset.ficha)));
}

// ---------- Central de mensagens ----------
const GRUPOS_MSG = [
  ['todas', 'Todas'], ['teste', 'Em teste'], ['ativas', 'Assinantes ativas'], ['mensal', 'Mensal'], ['anual', 'Anual'],
  ['pendente', 'Pagamento pendente'], ['acabou', 'Teste acabou sem assinar'],
];
const DESTINOS_MSG = [
  ['', 'Sem botão'], ['tela:kits', 'Tela: Kits'], ['tela:agenda', 'Tela: Agenda'], ['tela:hoje', 'Tela: Início'], ['tela:mais', 'Tela: Mais'],
  ['planos', 'Planos (assinar)'], ['video', 'Vídeo passo a passo'], ['zap', 'WhatsApp do suporte'], ['link', 'Um link (endereço)'],
];
function publicoMensagem(f) {
  const crmPor = Object.fromEntries((estado.crm || []).map((p) => [p.email, p]));
  return (estado.clientes || []).filter((c) => c.tem_conta && c.slug).filter((c) => {
    if (f.modo === 'pessoas') return f.pessoas.has(c.email);
    const g = f.grupos;
    const sit = c.situacao;
    let ok = g.has('todas')
      || (g.has('teste') && sit === 'teste')
      || (g.has('ativas') && sit === 'ativa')
      || (g.has('mensal') && sit === 'ativa' && c.plano === 'mensal')
      || (g.has('anual') && sit === 'ativa' && c.plano === 'anual')
      || (g.has('pendente') && sit === 'carencia')
      || (g.has('acabou') && sit === 'teste_encerrado');
    if (!g.size) ok = true;
    const p = crmPor[c.email];
    if (ok && f.etapas.size) ok = !!p && f.etapas.has(Number(p.etapa));
    if (ok && f.semEntrar) {
      const ult = c.ultimo_acesso ? (Date.now() - new Date(c.ultimo_acesso).getTime()) / 864e5 : 999;
      ok = ult >= f.semEntrar;
    }
    return ok;
  });
}
async function abaMensagens(tela) {
  const f = estado.msgForm || (estado.msgForm = { modo: 'grupo', grupos: new Set(['teste']), etapas: new Set(), semEntrar: 0, pessoas: new Set(), busca: '',
    titulo: '', texto: '', destino: '', botao: '', link: '', imagem: '', quando: 'agora', data: '', dias: 7 });
  const alvo = publicoMensagem(f);
  const todos = (estado.clientes || []).filter((c) => c.tem_conta && c.slug);
  const termo = f.busca.trim().toLowerCase();
  const busca = termo ? todos.filter((c) => `${c.email} ${c.negocio || ''} ${c.nome || ''}`.toLowerCase().includes(termo)).slice(0, 30) : [];
  tela.innerHTML = `<div class="msg-grade">
    <section class="cartao coluna"><h2 style="margin:0">1. Mensagem</h2>
      <label class="campo"><span>Título</span><input id="m-titulo" maxlength="80" value="${esc(f.titulo)}" placeholder="Ex.: Novidade: compartilhe cada kit 🎉"></label>
      <label class="campo"><span>Texto</span><textarea id="m-texto" rows="5" maxlength="600" placeholder="O que você quer contar para as clientes?">${esc(f.texto)}</textarea></label>
      <div class="campo"><span>Imagem (opcional)</span>
        ${f.imagem ? `<div class="linha-flex" style="gap:10px"><img src="${esc(f.imagem)}" alt="" style="width:90px;height:60px;object-fit:cover;border-radius:8px"><button class="link-btn" id="m-tirar-img">Tirar imagem</button></div>`
          : '<label class="btn contorno mini" style="cursor:pointer;align-self:flex-start">＋ Enviar imagem<input type="file" accept="image/*" id="m-img" class="oculto"></label>'}</div>
      <div class="campo"><span>Botão (opcional)</span>
        <div class="grade-2"><input id="m-botao" maxlength="40" value="${esc(f.botao)}" placeholder="Texto do botão, ex.: Ver meus kits"><select id="m-destino">${DESTINOS_MSG.map(([v, t]) => `<option value="${v}" ${f.destino === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
        ${f.destino === 'link' ? `<input id="m-link" value="${esc(f.link)}" placeholder="https://..." style="margin-top:8px">` : ''}</div>
    </section>
    <section class="cartao coluna"><h2 style="margin:0">2. Para quem</h2>
      <div class="pills-adm"><button class="${f.modo === 'grupo' ? 'on' : ''}" data-modo="grupo">Por grupo</button><button class="${f.modo === 'pessoas' ? 'on' : ''}" data-modo="pessoas">Escolher pessoas</button></div>
      ${f.modo === 'grupo' ? `
        <div class="pills-adm">${GRUPOS_MSG.map(([v, t]) => `<button class="${f.grupos.has(v) ? 'on' : ''}" data-grupo="${v}">${esc(t)}</button>`).join('')}</div>
        <span class="pequeno">Etapa do funil do teste (opcional)</span>
        <div class="pills-adm">${ETAPAS.map(([n, , , c]) => `<button class="${f.etapas.has(n) ? 'on' : ''}" data-etapa="${n}" title="${esc(c)}">${n}. ${esc(c)}</button>`).join('')}</div>
        <span class="pequeno">Dias sem entrar no app</span>
        <div class="pills-adm">${[[0, 'Qualquer'], [2, '2+'], [4, '4+'], [7, '7+']].map(([v, t]) => `<button class="${f.semEntrar === v ? 'on' : ''}" data-sem="${v}">${t}</button>`).join('')}</div>`
      : `<input id="m-busca" value="${esc(f.busca)}" placeholder="Buscar por nome, loja ou e-mail">
        <div class="lista-pessoas">${busca.map((c) => `<label class="check-adm"><input type="checkbox" data-pessoa="${esc(c.email)}" ${f.pessoas.has(c.email) ? 'checked' : ''}> ${esc(c.negocio || c.email)} <small>${esc(c.email)}</small></label>`).join('') || (termo ? '<p class="pequeno">Ninguém encontrado.</p>' : '<p class="pequeno">Digite para buscar.</p>')}</div>
        ${f.pessoas.size ? `<p class="pequeno"><b>Escolhidas:</b> ${[...f.pessoas].map(esc).join(', ')} <button class="link-btn" id="m-limpar">limpar</button></p>` : ''}`}
      <h2 style="margin:6px 0 0">3. Quando</h2>
      <div class="pills-adm"><button class="${f.quando === 'agora' ? 'on' : ''}" data-quando="agora">Enviar agora</button><button class="${f.quando === 'agendar' ? 'on' : ''}" data-quando="agendar">Agendar</button></div>
      ${f.quando === 'agendar' ? `<input type="datetime-local" id="m-data" value="${esc(f.data)}"><span class="dica">Sai na hora marcada (pode atrasar até 1 hora).</span>` : ''}
      <label class="campo"><span>Fica no app por</span><select id="m-dias">${[1, 3, 7, 15, 30].map((d) => `<option value="${d}" ${Number(f.dias) === d ? 'selected' : ''}>${d} dia${d > 1 ? 's' : ''}</option>`).join('')}</select></label>
      <div class="linha-flex entre" style="margin-top:auto"><b>Vai para <span style="color:var(--acc)">${alvo.length} ${alvo.length === 1 ? 'pessoa' : 'pessoas'}</span></b><button class="btn principal" id="m-enviar" ${alvo.length ? '' : 'disabled'}>${f.quando === 'agendar' ? 'Agendar' : 'Enviar'}</button></div>
      <p class="dica" style="margin:0">Aparece como popup na próxima vez que a pessoa abrir o app (uma vez só) e vira notificação no celular de quem ativou os avisos. Quem já recebeu uma mensagem com o mesmo título não recebe de novo.</p>
    </section>
    <section class="cartao"><h2 style="margin:0 0 10px">Prévia no celular</h2>
      <div class="celular-previa"><div class="notif-previa">🔔 <b>${esc(f.titulo || 'Título da mensagem')}</b><br>Toque para ver no app.</div>
        <div class="popup-previa">${f.imagem ? `<img src="${esc(f.imagem)}" alt="">` : ''}<b>${esc(f.titulo || 'Título da mensagem')}</b><p>${esc(f.texto || 'O texto aparece aqui.')}</p>${f.botao && f.destino ? `<span class="bt">${esc(f.botao)}</span>` : ''}<small>Fechar</small></div></div>
    </section>
  </div>
  <section class="cartao" id="m-historico"><div class="cab-crm"><h2>Mensagens enviadas</h2><span>carregando…</span></div></section>`;
  const sync = () => {
    const g = (id) => $(id, tela);
    f.titulo = g('#m-titulo').value; f.texto = g('#m-texto').value; f.botao = g('#m-botao').value; f.destino = g('#m-destino').value;
    if (g('#m-link')) f.link = g('#m-link').value;
    if (g('#m-data')) f.data = g('#m-data').value;
    f.dias = Number(g('#m-dias').value);
  };
  const redesenhar = () => { sync(); desenhar(); };
  ['#m-titulo', '#m-texto', '#m-botao'].forEach((id) => { $(id, tela).onchange = redesenhar; });
  $('#m-destino', tela).onchange = redesenhar;
  $$('[data-modo]', tela).forEach((b) => (b.onclick = () => { sync(); f.modo = b.dataset.modo; desenhar(); }));
  $$('[data-grupo]', tela).forEach((b) => (b.onclick = () => { sync(); const v = b.dataset.grupo; if (f.grupos.has(v)) f.grupos.delete(v); else f.grupos.add(v); desenhar(); }));
  $$('[data-etapa]', tela).forEach((b) => (b.onclick = () => { sync(); const v = Number(b.dataset.etapa); if (f.etapas.has(v)) f.etapas.delete(v); else f.etapas.add(v); desenhar(); }));
  $$('[data-sem]', tela).forEach((b) => (b.onclick = () => { sync(); f.semEntrar = Number(b.dataset.sem); desenhar(); }));
  $$('[data-quando]', tela).forEach((b) => (b.onclick = () => { sync(); f.quando = b.dataset.quando; desenhar(); }));
  const bu = $('#m-busca', tela);
  if (bu) { bu.oninput = () => { clearTimeout(abaMensagens.t); abaMensagens.t = setTimeout(() => { sync(); f.busca = bu.value; desenhar(); const n = $('#m-busca'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 350); }; }
  $$('[data-pessoa]', tela).forEach((c) => (c.onchange = () => { sync(); if (c.checked) f.pessoas.add(c.dataset.pessoa); else f.pessoas.delete(c.dataset.pessoa); desenhar(); }));
  const lp = $('#m-limpar', tela); if (lp) lp.onclick = () => { sync(); f.pessoas.clear(); desenhar(); };
  const ti = $('#m-tirar-img', tela); if (ti) ti.onclick = () => { sync(); f.imagem = ''; desenhar(); };
  const im = $('#m-img', tela);
  if (im) im.onchange = async () => {
    const arq = im.files[0]; if (!arq) return;
    sync(); aviso('Enviando imagem…');
    try { f.imagem = await dados.enviarFoto(arq, 1000); desenhar(); } catch (e) { aviso(e.message); }
  };
  $('#m-enviar', tela).onclick = async (e) => {
    sync();
    const b = e.currentTarget;
    if (f.titulo.trim().length < 2 || f.texto.trim().length < 2) { aviso('Escreva o título e o texto da mensagem.'); return; }
    if (f.destino && !f.botao.trim()) { aviso('Escreva o texto do botão.'); return; }
    if (f.destino === 'link' && !/^https:\/\//.test(f.link.trim())) { aviso('O link precisa começar com https://'); return; }
    if (f.quando === 'agendar' && !f.data) { aviso('Escolha a data e a hora do envio.'); return; }
    const pessoas = publicoMensagem(f).map((c) => c.email);
    if (!confirm(`${f.quando === 'agendar' ? 'Agendar' : 'Enviar'} a mensagem "${f.titulo}" para ${pessoas.length} ${pessoas.length === 1 ? 'pessoa' : 'pessoas'}?`)) return;
    b.disabled = true; b.textContent = 'Enviando…';
    const publico = f.modo === 'pessoas' ? `${pessoas.length} escolhidas` : [...f.grupos].map((g) => (GRUPOS_MSG.find(([v]) => v === g) || [g, g])[1]).join(', ')
      + (f.etapas.size ? ` · etapas ${[...f.etapas].join(', ')}` : '') + (f.semEntrar ? ` · ${f.semEntrar}+ dias sem entrar` : '');
    try {
      const r = await dados.adminCriarMensagem({
        titulo: f.titulo.trim(), texto: f.texto.trim(), imagem_url: f.imagem || null,
        botao_texto: f.destino ? f.botao.trim() : null, botao_destino: f.destino === 'link' ? f.link.trim() : f.destino || null,
        publico, dias: f.dias, enviar_em: f.quando === 'agendar' ? new Date(f.data).toISOString() : null,
      }, pessoas);
      estado.msgForm = null;
      aviso(`Mensagem ${f.quando === 'agendar' ? 'agendada' : 'enviada'} para ${r.pessoas} ${r.pessoas === 1 ? 'pessoa' : 'pessoas'}.${r.ja_receberam ? ` ${r.ja_receberam} já tinham recebido e ficaram de fora.` : ''}`);
      desenhar();
    } catch (err) { aviso(err.message); b.disabled = false; b.textContent = f.quando === 'agendar' ? 'Agendar' : 'Enviar'; }
  };
  // Histórico
  const hist = $('#m-historico', tela);
  let lista = [];
  try { lista = await dados.adminMensagens(); } catch (e) { hist.innerHTML = `<p class="pequeno">${esc(e.message)}</p>`; return; }
  if (!hist.isConnected) return;
  const SIT = { agendada: 'Agendada', enviada: 'No ar', pausada: 'Pausada', encerrada: 'Encerrada' };
  hist.innerHTML = `<div class="cab-crm"><h2>Mensagens enviadas</h2><span>${lista.length}</span></div>
    ${lista.length ? `<div class="tabela t-msgs"><div class="tr th"><span>Mensagem</span><span>Para</span><span>Viram</span><span>Clicaram</span><span>Fecharam</span><span>Assinaram</span><span></span></div>
    ${lista.map((m) => `<div class="tr"><span>${esc(m.titulo)}<small>${esc(SIT[m.status] || m.status)} · ${esc(dataHora(m.enviar_em))} · ${esc(m.publico || '')}</small></span>
      <span>${m.pessoas}</span><span>${m.viram}<small>${pct(m.viram, m.pessoas)}%</small></span><span>${m.clicaram}<small>${pct(m.clicaram, m.viram)}% de quem viu</small></span><span>${m.fecharam}</span><b class="${m.assinaram ? 'pos' : ''}">${m.assinaram}</b>
      <span class="acoes-linha"><button class="btn contorno mini" data-alvos="${m.id}">Quem recebeu</button>${m.status === 'enviada' || m.status === 'agendada' ? `<button class="btn contorno mini" data-msg="${m.id}" data-st="pausada">Pausar</button>` : ''}${m.status === 'pausada' ? `<button class="btn contorno mini" data-msg="${m.id}" data-st="agendada">Retomar</button>` : ''}${m.status !== 'encerrada' ? `<button class="btn contorno mini" data-msg="${m.id}" data-st="encerrada">Encerrar</button>` : ''}</span></div>`).join('')}</div>`
    : '<p class="pequeno">Nenhuma mensagem enviada ainda.</p>'}`;
  $$('[data-alvos]', hist).forEach((b) => (b.onclick = async () => {
    const linha = b.closest('.tr');
    const ja = linha.nextElementSibling;
    if (ja && ja.classList.contains('alvos')) { ja.remove(); return; }
    b.disabled = true;
    try {
      const l = await dados.adminMensagemAlvos(Number(b.dataset.alvos));
      const st = (a) => (a.clicou_em ? 'clicou' : a.viu_em ? (a.fechou_em ? 'viu e fechou' : 'viu') : 'ainda não abriu o app');
      linha.insertAdjacentHTML('afterend', `<div class="alvos">${l.length ? l.map((a) => `<div><span>${esc(a.loja || a.email)} <small>${esc(a.email)}</small></span><small>${esc(st(a))}${a.viu_em ? ' · ' + esc(dataHora(a.viu_em)) : ''}</small></div>`).join('') : '<p class="pequeno">Ninguém nesta mensagem.</p>'}</div>`);
    } catch (e) { aviso(e.message); }
    b.disabled = false;
  }));
  $$('[data-msg]', hist).forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    try { await dados.adminMudarMensagem(Number(b.dataset.msg), b.dataset.st); desenhar(); } catch (e) { aviso(e.message); b.disabled = false; }
  }));
}

// ---------- E-mails automáticos ----------
const EMAILS_TIPOS = [
  ['boas_vindas', 'Boas-vindas · mande a foto de um kit', 'na hora do cadastro'],
  ['parada_1', 'Parada: sem loja (etapa 1)', '24 h parada'],
  ['parada_2', 'Parada: sem kit (etapa 2)', '24 h parada'],
  ['parada_3', 'Parada: 1 kit (etapa 3)', '24 h parada'],
  ['parada_4', 'Parada: não divulgou (etapa 4)', '24 h parada'],
  ['parada_5', 'Parada: sem reserva (etapa 5)', '24 h parada'],
  ['primeira_reserva', '1ª reserva de cliente real', 'quando acontece'],
  ['dia2_montagem', 'Dia 2 · 1º kit com a foto (só quem tem 0 kits)', '2º dia'],
  ['dia2_promo', 'Dia 2 · 53% OFF (3+ kits)', '2º dia'],
  ['dia5_resumo', 'Antigo · dia 5 resumo', 'trocado pela oferta do dia 5'],
  ['teste_amanha', 'Dia 6 · teste acaba amanhã', '6º dia'],
  ['dia5_anual', 'Dia 5 · oferta do anual (3 kits ou mais)', '5º dia'],
  ['dia5_mensal', 'Dia 5 · oferta do mensal (0 a 2 kits)', '5º dia'],
  ['teste_acabou', 'Dia 7 · teste acabou (link fora do ar)', '7º dia'],
  ['promo_ultimo_dia', 'Dia 9 · link continua fora do ar', '9º dia'],
  ['carrinho', 'Recuperação · carrinho abandonado', '1 h depois (no app: 2 h)'],
  ['pix_pendente', 'Recuperação · Pix gerado (com o código)', '10 min depois'],
  ['pix_vencido', 'Recuperação · Pix não pago', '1 h depois'],
  ['cartao_recusado', 'Recuperação · cartão recusado', '1 h depois'],
  ['checkout', 'Antigo · foi ao checkout e não comprou', 'trocado pelo carrinho'],
  ['mes1_liberado', '1º mês · acesso liberado', 'na hora da compra'],
  ['mes1_acabando', '1º mês · termina em 3 dias', '3 dias antes'],
];
async function abaEmails(tela) {
  tela.innerHTML = '<div id="em-c" class="coluna" style="gap:16px"><div class="cartao">Carregando…</div></div>';
  const alvo = $('#em-c', tela);
  const dias = String(estado.emailDias ?? 30);
  let r;
  try { r = await dados.adminEmails(Number(dias)); } catch (e) { alvo.innerHTML = `<div class="cartao">${esc(e.message)}</div>`; return; }
  if (estado.aba !== 'emails' || !alvo.isConnected) return;
  const por = Object.fromEntries((r.tipos || []).map((t) => [t.tipo, t]));
  const proprios = new Set((r.modelos || []).map((m) => m.tipo));
  const soma = (k) => (r.tipos || []).reduce((t, x) => t + Number(x[k] || 0), 0);
  const env = soma('enviados');
  const per = [['7', '7 dias'], ['30', '30 dias'], ['90', '90 dias'], ['0', 'Desde o início']];
  alvo.innerHTML = `
    <section class="cartao linha-flex entre" style="gap:12px;flex-wrap:wrap">
      <div><b>${r.pausados ? '⏸️ Envio pausado' : '🟢 Envio ligado'}</b><div class="pequeno">Saem sozinhos a cada 15 minutos (boas-vindas a qualquer hora; os do teste das 8h às 20h; os de recuperação das 8h às 22h, e o do Pix com o código até 23h) · no máximo 1 por dia por pessoa (o do Pix com o código não conta) · param quando ela assina.</div></div>
      <div class="linha-flex" style="gap:8px"><label class="pequeno">Período <select id="em-dias">${per.map(([v, t]) => `<option value="${v}" ${v === dias ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <button class="btn ${r.pausados ? 'principal' : 'contorno'} mini" id="em-pausar">${r.pausados ? 'Retomar envios' : 'Pausar todos'}</button></div>
    </section>
    <div class="kpis-crm">
      <div class="kpi"><small>Enviados</small><b>${env}</b></div>
      <div class="kpi"><small>Abertos</small><b>${pct(soma('abertos'), env)}%</b><i>${soma('abertos')} e-mails</i></div>
      <div class="kpi"><small>Clicaram</small><b>${pct(soma('clicaram'), env)}%</b><i>${soma('clicaram')} cliques</i></div>
      <div class="kpi"><small>Assinaram em até 7 dias</small><b>${soma('assinaram')}</b></div>
      <div class="kpi"><small>Descadastros</small><b>${r.descadastros || 0}</b><i>${soma('problemas')} voltaram ou deram erro</i></div>
    </div>
    <section class="cartao"><div class="tabela t-emails"><div class="tr th"><span>E-mail</span><span>Quando sai</span><span>Enviados</span><span>Abertos</span><span>Clicaram</span><span>Assinaram</span><span></span></div>
      ${EMAILS_TIPOS.map(([t, nome, quando]) => { const x = por[t] || {}; const e = Number(x.enviados || 0); return `<div class="tr">
        <span>${esc(nome)}${proprios.has(t) ? ' <span class="tag t-lil">seu texto</span>' : ''}</span><span>${esc(quando)}</span><span>${e}</span>
        <span>${e ? pct(x.abertos, e) + '%' : '—'}</span><span>${e ? pct(x.clicaram, e) + '%' : '—'}</span><b class="${x.assinaram ? 'pos' : ''}">${x.assinaram || 0}</b>
        <span class="acoes-linha"><button class="btn contorno mini" data-em-editar="${t}">Editar</button><button class="btn contorno mini" data-em-previa="${t}">Prévia</button></span></div>`; }).join('')}
    </div>
    <p class="dica" style="margin-top:8px">Aberturas e cliques aparecem depois que o aviso (webhook) do Resend estiver ligado. Todo e-mail tem o botão de WhatsApp e o link "Não quero mais receber".</p></section>`;
  $('#em-dias', alvo).onchange = (e) => { estado.emailDias = e.target.value; desenhar(); };
  $('#em-pausar', alvo).onclick = async (e) => {
    e.currentTarget.disabled = true;
    try { await dados.adminEmailsPausar(!r.pausados); aviso(r.pausados ? 'Envios retomados.' : 'Envios pausados.'); desenhar(); } catch (err) { aviso(err.message); e.currentTarget.disabled = false; }
  };
  $$('[data-em-previa]', alvo).forEach((b) => (b.onclick = () => previaEmail(b.dataset.emPrevia)));
  $$('[data-em-editar]', alvo).forEach((b) => (b.onclick = () => editarEmail(b.dataset.emEditar, (r.modelos || []).find((m) => m.tipo === b.dataset.emEditar))));
}
function modalAdm(html) {
  const caixa = document.createElement('div');
  caixa.className = 'modal-adm';
  caixa.innerHTML = `<div class="modal-in cartao coluna" role="dialog" aria-modal="true" style="max-width:680px">${html}</div>`;
  caixa.onclick = (e) => { if (e.target === caixa) caixa.remove(); };
  document.body.append(caixa);
  return caixa;
}
async function previaEmail(tipo) {
  const nome = (EMAILS_TIPOS.find(([t]) => t === tipo) || [, tipo])[1];
  const m = modalAdm(`<div class="cab-crm" style="margin:0"><h2>${esc(nome)}</h2><button class="link-btn" data-x>Fechar</button></div><div class="pequeno" id="pv-assunto">Carregando…</div><iframe id="pv" style="width:100%;height:560px;border:0;border-radius:12px;background:#fff"></iframe>
    <div class="linha-flex" style="gap:8px;justify-content:flex-end"><button class="btn contorno" id="pv-teste">Enviar teste para mim</button></div>`);
  $('[data-x]', m).onclick = () => m.remove();
  $('#pv-teste', m).onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Enviando…';
    try { const r = await dados.adminEmailTeste(tipo); aviso(`E-mail de teste enviado para ${r.para}.`); b.textContent = 'Enviado!'; }
    catch (err) { aviso(err.message); b.disabled = false; b.textContent = 'Enviar teste para mim'; }
  };
  try {
    const r = await dados.adminPreviaEmail(tipo);
    $('#pv-assunto', m).innerHTML = `<b>Assunto:</b> ${esc(r.assunto)} <span class="dica">(dados de exemplo)</span>`;
    $('#pv', m).srcdoc = r.html;
  } catch (e) { $('#pv-assunto', m).textContent = e.message; }
}
async function editarEmail(tipo, proprio) {
  const nome = (EMAILS_TIPOS.find(([t]) => t === tipo) || [, tipo])[1];
  const m = modalAdm(`<div class="cab-crm" style="margin:0"><h2>Editar: ${esc(nome)}</h2><button class="link-btn" data-x>Fechar</button></div>
    <p class="pequeno" id="ed-carregando">Carregando o texto…</p>
    <form class="coluna oculto" id="ed-email" novalidate>
      <label class="campo"><span>Assunto</span><input name="assunto" maxlength="120"></label>
      <label class="campo"><span>Texto (deixe uma linha em branco entre os parágrafos)</span><textarea name="texto" rows="8" maxlength="2000"></textarea></label>
      <label class="campo"><span>Texto do botão</span><input name="botao" maxlength="40"></label>
      <p class="dica" style="margin:0">Pode usar: <b>{nome}</b> (primeiro nome), <b>{loja}</b>, <b>{kits}</b>, <b>{reservas}</b>, <b>{visitas}</b>, <b>{data_fim}</b> (fim do teste), <b>{data_promo}</b> (fim do desconto). As caixas de oferta, resumo e o botão de WhatsApp continuam automáticos.</p>
      <div class="linha-flex" style="gap:8px;justify-content:space-between;flex-wrap:wrap">
        ${proprio ? '<button type="button" class="btn contorno" id="ed-original">Voltar ao texto original</button>' : '<span></span>'}
        <button class="btn principal" id="ed-salvar">Salvar</button></div>
    </form>`);
  $('[data-x]', m).onclick = () => m.remove();
  const form = $('#ed-email', m);
  try {
    const r = await dados.adminPreviaEmail(tipo);
    const base = proprio || r.padrao;
    form.assunto.value = base.assunto; form.texto.value = base.texto; form.botao.value = base.botao || '';
    $('#ed-carregando', m).remove(); form.classList.remove('oculto');
  } catch (e) {
    if (proprio) { form.assunto.value = proprio.assunto; form.texto.value = proprio.texto; form.botao.value = proprio.botao || ''; $('#ed-carregando', m).remove(); form.classList.remove('oculto'); }
    else $('#ed-carregando', m).textContent = e.message;
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (form.assunto.value.trim().length < 2 || form.texto.value.trim().length < 2) { aviso('Preencha o assunto e o texto.'); return; }
    const b = $('#ed-salvar', m); b.disabled = true;
    try { await dados.adminSalvarEmailModelo(tipo, form.assunto.value, form.texto.value, form.botao.value); aviso('Texto salvo. Os próximos e-mails já saem assim.'); m.remove(); desenhar(); }
    catch (err) { aviso(err.message); b.disabled = false; }
  };
  const og = $('#ed-original', m);
  if (og) og.onclick = async () => {
    og.disabled = true;
    try { await dados.adminSalvarEmailModelo(tipo, null, null, null); aviso('Voltou ao texto original.'); m.remove(); desenhar(); }
    catch (err) { aviso(err.message); og.disabled = false; }
  };
}

// ---------- Montagem contratada ----------
function somarDiasUteis(iso, n) {
  const d = new Date(iso);
  let faltam = n;
  while (faltam > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) faltam--; }
  return d;
}
// ---------------------------------------------------------------------
// Funil do quiz 2: até onde cada visitante chegou (anônimo)
// ---------------------------------------------------------------------
const PASSOS_QUIZ = [
  ['abriu', 'Abriu a página'],
  ['comecou', 'Começou o quiz'],
  ['p1', 'Pergunta 1 · tempo no pegue e monte'],
  ['p2', 'Pergunta 2 · quantos kits'],
  ['p3', 'Pergunta 3 · onde anota as reservas'],
  ['p4', 'Pergunta 4 · kit reservado duas vezes'],
  ['p5', 'Pergunta 5 · tempo no WhatsApp'],
  ['p6', 'Pergunta 6 · fotos e preços organizados'],
  ['p7', 'Pergunta 7 · contrato'],
  ['concluiu', 'Terminou o quiz'],
  ['video', 'Chegou no vídeo'],
  ['som', 'Ligou o som'],
  ['v25', 'Assistiu 25% com som'],
  ['v50', 'Assistiu 50% com som'],
  ['v75', 'Assistiu 75% com som'],
  ['botao', 'Chegou no pitch (2:17) · botão apareceu'],
  ['planos', 'Clicou em "Ver os planos"'],
  ['checkout', 'Clicou para pagar (anual + mensal)'],
];
async function abaQuiz(tela) {
  const f = estado.quizFiltro || (estado.quizFiltro = { dias: 7, anuncio: '' });
  tela.innerHTML = '<div id="qz-c" class="coluna" style="gap:16px"><div class="cartao">Carregando…</div></div>';
  const alvo = $('#qz-c', tela);
  let d;
  try { d = await dados.adminFunilQuiz('quiz2', f.dias, f.anuncio); } catch (e) { alvo.innerHTML = `<div class="cartao">${esc(e.message)}</div>`; return; }
  if (estado.aba !== 'quiz' || !alvo.isConnected) return;
  const et = { ...(d.etapas || {}) };
  et.checkout = Number(et.checkout_anual || 0) + Number(et.checkout_mensal || 0);
  const topo = Number(et.abriu || 0) || 1;
  const valores = PASSOS_QUIZ.map(([id]) => Number(et[id] || 0));
  let maior = 0, onde = -1;
  valores.forEach((v, i) => { if (i && valores[i - 1] - v > maior) { maior = valores[i - 1] - v; onde = i; } });
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const respostas = d.respostas || [];
  alvo.innerHTML = `
    <div class="etabas">${[[1, 'Hoje'], [7, '7 dias'], [30, '30 dias'], [90, '90 dias']].map(([n, t]) => `<button class="${f.dias === n ? 'on' : ''}" data-qd="${n}">${t}</button>`).join('')}</div>
    ${(d.anuncios || []).length ? `<label class="campo" style="max-width:420px"><span>Anúncio</span><select id="qz-an"><option value="">Todos os anúncios</option>${d.anuncios.map((a) => `<option value="${esc(a.anuncio === '(sem anúncio)' ? '' : a.anuncio)}" ${f.anuncio === a.anuncio ? 'selected' : ''}>${esc(a.anuncio)}</option>`).join('')}</select></label>` : ''}
    <div class="kpis-crm">
      <div class="kpi"><small>Abriram a página</small><b>${et.abriu || 0}</b></div>
      <div class="kpi"><small>Terminaram o quiz</small><b>${pct(et.concluiu || 0, topo)}%</b><i>${et.concluiu || 0} pessoas</i></div>
      <div class="kpi"><small>Ligaram o som do vídeo</small><b>${pct(et.som || 0, et.video || 0)}%</b><i>de quem chegou no vídeo</i></div>
      <div class="kpi"><small>Viram os planos</small><b>${et.planos || 0}</b><i>${pct(et.planos || 0, topo)}% de quem abriu</i></div>
      <div class="kpi"><small>Clicaram para pagar</small><b>${et.checkout}</b><i class="p">${et.checkout_anual || 0} anual · ${et.checkout_mensal || 0} mensal</i></div>
    </div>
    <section class="cartao">
      <div class="cab-crm"><h2>Até onde as pessoas chegam</h2><span>cada pessoa conta uma vez por passo</span></div>
      <div class="qz-lista">${PASSOS_QUIZ.map(([id, t], i) => `<div class="qz-l ${i === onde ? 'buraco' : ''}">
        <span class="qz-t">${esc(t)}</span>
        <span class="qz-barra"><i style="width:${pct(valores[i], topo)}%"></i></span>
        <b>${valores[i]}</b><small>${pct(valores[i], topo)}%</small>
        <em>${i && valores[i - 1] - valores[i] > 0 ? '−' + (valores[i - 1] - valores[i]) : ''}</em></div>`).join('')}</div>
      ${onde > 0 && maior ? `<div class="nota-crm">O maior buraco está entre <b>${esc(PASSOS_QUIZ[onde - 1][1].toLowerCase())}</b> e <b>${esc(PASSOS_QUIZ[onde][1].toLowerCase())}</b>: ${maior} pessoas pararam ali.</div>` : ''}
    </section>
    ${respostas.length ? `<section class="cartao"><div class="cab-crm"><h2>O que responderam</h2></div>
      <div class="qz-resp">${PASSOS_QUIZ.filter(([id]) => /^p\d$/.test(id)).map(([id, t]) => {
        const rs = respostas.filter((r) => r.etapa === id); const tot = rs.reduce((a, r) => a + Number(r.n), 0);
        return rs.length ? `<div><b>${esc(t)}</b>${rs.map((r) => `<div class="qz-r"><span>${esc(r.detalhe || '—')}</span><span class="qz-barra"><i style="width:${pct(r.n, tot)}%"></i></span><small>${pct(r.n, tot)}%</small></div>`).join('')}</div>` : '';
      }).join('')}</div></section>` : ''}
    ${(d.anuncios || []).length ? `<section class="cartao"><div class="cab-crm"><h2>Por anúncio</h2><span>utm_content do link</span></div>
      <div class="tabela"><div class="tr th qz-an"><span>Anúncio</span><span>Abriram</span><span>Terminaram</span><span>Som</span><span>Planos</span><span>Pagar</span></div>
      ${d.anuncios.map((a) => `<div class="tr qz-an"><span>${esc(a.anuncio)}</span><span>${a.abriu}</span><span>${a.concluiu} <small>${pct(a.concluiu, a.abriu)}%</small></span><span>${a.som}</span><span>${a.planos}</span><span><b>${a.checkout}</b> <small>${pct(a.checkout, a.abriu)}%</small></span></div>`).join('')}</div></section>` : ''}
    <p class="dica">Conta só quem abriu o app.pegueemonte.com/quiz2. "Clicou para pagar" é o clique no botão do plano: a compra em si aparece em Pagamentos e na Utmify.</p>`;
  $$('[data-qd]', alvo).forEach((b) => (b.onclick = () => { f.dias = Number(b.dataset.qd); abaQuiz(tela); }));
  const an = $('#qz-an', alvo);
  if (an) an.onchange = () => { f.anuncio = an.value; abaQuiz(tela); };
}

async function abaIA(tela) {
  const f = estado.iaFiltro || (estado.iaFiltro = { dias: 0 });
  tela.innerHTML = '<div id="ia-c" class="coluna" style="gap:16px"><div class="cartao">Carregando…</div></div>';
  const alvo = $('#ia-c', tela);
  const demoLp = () => {
    const h = (m) => new Date(Date.now() - m * 6e4).toISOString();
    return { total: 42, prontas: 37, com_email: 19, publicar: 8, pagaram: 3, convertidas: 2, no_app: 11, completas: 2, custo: 38.4, aprovar: [{ id: 'demo-1', instagram: 'festasdabia', custo: 3.96, faltam: 214, estimativa: 4.5, liberados: 27, pedido_em: h(40) }], ultimas: [
      { criado_em: h(30), instagram: 'festasdamaria', status: 'pronta', modo: 'instagram', email: 'maria@exemplo.com', publicar_em: h(25), convertida_em: null, kits: 8, onde: 'pagina', custo: 0.62, completa: null },
      { criado_em: h(70), instagram: 'kitsdaju', status: 'pronta', modo: 'instagram', email: 'ju@exemplo.com', publicar_em: null, convertida_em: h(60), kits: 31, onde: 'app', custo: 3.84, completa: 'pronta' }] };
  };
  const demoG = { teste_cat: 31, teste_cat_assinaram: 9, teste_ig: 11, teste_ig_assinaram: 4, teste_total: 38, teste_total_assinaram: 12, sem_ia: 96, sem_ia_assinaram: 8, assin_cat: 17, assin_ig: 2, assin_total: 18 };
  const [d, lp, g] = await Promise.all([
    dados.adminIaResultados(f.dias).catch(() => null),
    (dados.MODO_DEMO ? Promise.resolve(demoLp()) : rpcAdmin('admin_previas', { p_dias: f.dias || 3650 })).catch(() => null),
    (dados.MODO_DEMO ? Promise.resolve(demoG) : rpcAdmin('admin_ia_grupos', { p_dias: f.dias })).catch(() => null),
  ]);
  if (estado.aba !== 'ia' || !alvo.isConnected) return;
  if (!d && !lp && !g) { alvo.innerHTML = '<div class="cartao">Não deu para carregar agora. Tente de novo.</div>'; return; }
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const n = (k) => Number((d || {})[k] || 0);
  const m = (k) => Number((lp || {})[k] || 0);
  const q = (k) => Number((g || {})[k] || 0);
  const usd = (v) => 'US$ ' + (Number(v) || 0).toFixed(2).replace('.', ',');
  const linha = (passos) => {
    const topo = passos[0][1] || 1;
    return `<div class="ia-passos">${passos.map(([t, v], i) => `<div class="ia-p"><b>${v}</b><span>${esc(t)}</span>${i ? `<small>${pct(v, topo)}%</small>` : '<small>&nbsp;</small>'}<i style="width:${Math.max(4, pct(v, topo))}%"></i></div>`).join('')}</div>`;
  };
  const dh = (q) => { const x = new Date(q); return `${x.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${x.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`; };
  const situ = (x) => x.convertida_em ? ['Loja criada', 'st-pago'] : x.publicar_em ? ['Foi pagar', 'st-pix_pendente'] : x.email ? ['Deixou o e-mail', 'st-pix_pendente'] : x.status === 'pronta' ? ['Viu a prévia', ''] : ['Não terminou', ''];
  const SIT = { assinou: ['Assinou depois', 'ok'], ja_era: ['Já era assinante', ''], nao: ['Ainda não assinou', 'nao'] };
  const aprovar = (lp && lp.aprovar) || [];
  alvo.innerHTML = `
    <div class="etabas">${[[0, 'Desde o início'], [7, '7 dias'], [30, '30 dias'], [90, '90 dias']].map(([v, t]) => `<button class="${f.dias === v ? 'on' : ''}" data-iad="${v}">${t}</button>`).join('')}</div>
    ${aprovar.length ? `<div class="aprovar-lc" style="margin:0"><b>Passaram de R$ 4 na loja completa (${aprovar.length})</b>
      <p class="pequeno" style="margin:2px 0 8px">Aprovar continua a busca nos posts que faltaram. Recusar deixa a loja com os kits que já entraram.</p>
      ${aprovar.map((x) => `<div class="pg-ab"><div style="min-width:0"><b class="t">@${esc(x.instagram)}</b>
        <small>${x.liberados || 0} kits já entraram · gastou ${reaisAdm(x.custo)} · mais ${reaisAdm(x.estimativa)} para terminar</small></div>
        <div class="ld"><button class="btn mini verde" data-lc-sim="${esc(x.id)}">Aprovar</button><button class="btn mini contorno" data-lc-nao="${esc(x.id)}">Recusar</button></div></div>`).join('')}</div>` : ''}
    <div class="kpis-crm k4" style="margin:0">
      <div class="kpi"><small>Gasto com IA</small><b>${reaisAdm(m('custo'))}</b><i>loja pelo Instagram${d ? ` · catálogo ${usd(d.custo_usd)}` : ''}</i></div>
      ${g ? `<div class="kpi"><small>Usaram no teste grátis</small><b>${q('teste_total')}</b><i class="p">${q('teste_total_assinaram')} assinaram depois · ${pct(q('teste_total_assinaram'), q('teste_total'))}%</i></div>
      <div class="kpi"><small>Assinantes que usaram</small><b>${q('assin_total')}</b><i>catálogo ${q('assin_cat')} · loja completa ${q('assin_ig')}</i></div>` : ''}
      <div class="kpi"><small>Pagaram pela página</small><b>${m('pagaram')}</b><i>/loja-pronta · de ${m('prontas')} que viram</i></div>
    </div>
    ${g ? `<section class="cartao"><div class="cab-crm"><h2>No teste grátis</h2><span>quantas usaram e quantas assinaram depois</span></div>
      <div class="ia-grupo">
        ${[['IA do catálogo', 'teste_cat'], ['Loja pelo Instagram', 'teste_ig'], ['Total', 'teste_total']].map(([t, k]) => `<div class="ia-gl${k === 'teste_total' ? ' tot' : ''}"><span>${esc(t)}</span><b>${q(k)}<small>usaram</small></b><b class="ok">${q(k + '_assinaram')}<small>assinaram</small></b><em>${pct(q(k + '_assinaram'), q(k))}%</em></div>`).join('')}
      </div>
      <p class="pequeno" style="margin:10px 0 0">Para comparar: contas novas que não usaram IA no teste assinam <b>${pct(q('sem_ia_assinaram'), q('sem_ia'))}%</b> (${q('sem_ia_assinaram')} de ${q('sem_ia')}).</p></section>` : ''}
    ${lp ? `<section class="cartao"><div class="cab-crm"><h2>Página /loja-pronta</h2><span>quem chega pelo anúncio e paga direto</span></div>
      ${linha([['Digitaram o @', m('total')], ['Viram a loja', m('prontas')], ['Deixaram o e-mail', m('com_email')], ['Pagaram', m('pagaram')]])}</section>` : ''}
    <details class="cartao ia-mais"><summary>Ver lojas, uma por uma</summary>
      ${(lp && (lp.ultimas || []).length) ? `<h3>Pelo Instagram</h3><div class="pg-lista">${lp.ultimas.slice(0, 100).map((x) => { const [t, c] = situ(x); return `<div class="pg-ab"><div style="min-width:0"><b class="t">${x.instagram && x.instagram !== '-' ? '@' + esc(x.instagram) : 'Sem Instagram'}</b>
        <small>${esc(dh(x.criado_em))} · ${x.kits} ${Number(x.kits) === 1 ? 'kit' : 'kits'}${x.completa ? ' · loja completa' : ''} · ${reaisAdm(x.custo)}</small></div>
        <div class="ld"><span class="st ${c}">${t}</span></div></div>`; }).join('')}</div>` : ''}
      ${(d && (d.lojas || []).length) ? `<h3>Pelo catálogo</h3><div class="tabela"><div class="tr th ia-lj"><span>Loja</span><span>Kits</span><span>Quando</span><span>Assinatura</span></div>
        ${d.lojas.map((l) => `<div class="tr ia-lj"><span>${esc(l.loja || '—')}</span><span>${Number(l.kits) || 0}</span><span>${esc(dataHora(l.quando))}</span><span><em class="ia-sit ${(SIT[l.situacao] || ['', ''])[1]}">${esc((SIT[l.situacao] || [l.situacao])[0])}</em></span></div>`).join('')}</div>` : ''}
    </details>`;
  $$('[data-iad]', alvo).forEach((b) => (b.onclick = () => { f.dias = Number(b.dataset.iad); abaIA(tela); }));
  const decidir = async (b, sim) => {
    $$('[data-lc-sim],[data-lc-nao]', alvo).forEach((x) => { x.disabled = true; });
    try {
      const r = dados.MODO_DEMO ? { ok: true } : await rpcAdmin('admin_completa_decidir', { p_id: b.dataset.lcSim || b.dataset.lcNao, p_aprovar: sim });
      aviso(r && r.ok ? (sim ? 'Aprovado: a IA continua a loja dessa cliente nos próximos minutos.' : 'Recusado: a loja fica com os kits que já entraram.') : ((r && r.mensagem) || 'Não deu certo. Tente de novo.'));
    } catch (e) { aviso('Não deu certo. Tente de novo.'); }
    if (dados.MODO_DEMO) { b.closest('.pg-ab').remove(); return; }
    abaIA(tela);
  };
  $$('[data-lc-sim]', alvo).forEach((b) => { b.onclick = () => decidir(b, true); });
  $$('[data-lc-nao]', alvo).forEach((b) => { b.onclick = () => decidir(b, false); });
}

async function abaMontagem(tela) {
  tela.innerHTML = '<div id="mt-c" class="coluna" style="gap:16px"><div class="cartao">Carregando…</div></div>';
  const alvo = $('#mt-c', tela);
  let lista = [];
  try { lista = await dados.adminMontagens(); } catch (e) { alvo.innerHTML = `<div class="cartao">${esc(e.message)}</div>`; return; }
  if (estado.aba !== 'montagem' || !alvo.isConnected) return;
  const grupos = {
    andamento: lista.filter((m) => m.pediu_em && !m.concluida_em),
    naopediu: lista.filter((m) => !m.pediu_em && !m.concluida_em),
    concluidas: lista.filter((m) => m.concluida_em),
  };
  const sub = estado.mtAba || (grupos.andamento.length || !grupos.naopediu.length ? 'andamento' : 'naopediu');
  const atrasadas = grupos.andamento.filter((m) => somarDiasUteis(m.pediu_em, 3) < new Date()).length;
  const kitsMes = lista.filter((m) => m.concluida_em && new Date(m.concluida_em).getMonth() === new Date().getMonth()).reduce((t, m) => t + Math.max(0, Number(m.kits_agora) - Number(m.kits_inicio)), 0);
  const conc = grupos.concluidas.filter((m) => m.pediu_em);
  const media = conc.length ? conc.reduce((t, m) => t + (new Date(m.concluida_em) - new Date(m.pediu_em)) / 864e5, 0) / conc.length : null;
  const linhas = grupos[sub] || [];
  alvo.innerHTML = `
    <div class="etabas">${[['andamento', 'Em andamento'], ['naopediu', 'Não pediu ainda'], ['concluidas', 'Concluídas']].map(([id, t]) => `<button class="${sub === id ? 'on' : ''}" data-mt="${id}">${t}<b>${grupos[id].length}</b></button>`).join('')}</div>
    <div class="kpis-crm">
      <div class="kpi"><small>Kits montados pela equipe (mês)</small><b>${kitsMes}</b></div>
      <div class="kpi"><small>Tempo médio até concluir</small><b>${media == null ? '—' : num1(media) + ' dias'}</b></div>
      <div class="kpi"><small>Atrasadas (mais de 3 dias úteis)</small><b class="${atrasadas ? 'neg' : 'pos'}">${atrasadas}</b></div>
    </div>
    <section class="cartao">${linhas.length ? `<div class="tabela t-montagem"><div class="tr th"><span>Cliente / loja</span><span>Assinou</span><span>Pediu a montagem</span><span>Kits cadastrados</span><span>Prazo</span><span></span></div>
      ${linhas.map((m) => {
        const feitos = Math.max(0, Number(m.kits_agora || 0) - Number(m.kits_inicio || 0));
        const prazo = m.pediu_em ? somarDiasUteis(m.pediu_em, 3) : null;
        const atras = prazo && !m.concluida_em && prazo < new Date();
        const nome = String(m.nome || '').split(' ')[0];
        const msg = m.pediu_em ? `Oi${nome ? ', ' + nome : ''}! Aqui é da equipe do App Pegue e Monte. Estamos montando a sua loja 😊` : `Oi${nome ? ', ' + nome : ''}! Vi que você assinou o app, e a montagem da loja está incluída. Me manda as fotos, os nomes e os preços dos seus kits por aqui que a nossa equipe cadastra tudo para você 😊`;
        return `<div class="tr"><span>${esc(m.loja || m.email)}<small>${esc(m.email)}</small></span><span>${esc(data(m.assinou_em))}</span>
          <span>${m.pediu_em ? esc(data(m.pediu_em)) : '<span class="tag t-red">ainda não pediu</span>'}</span>
          <span><small><b>${m.kits_agora || 0}</b> kits · ${feitos} pela montagem</small></span>
          <span>${prazo ? `<b class="${atras ? 'neg' : ''}">${prazo.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</b>${atras ? '<small>atrasada</small>' : ''}` : '—'}${m.concluida_em ? `<small>concluída ${esc(data(m.concluida_em))}</small>` : ''}</span>
          <span class="acoes-linha">
            ${m.telefone ? `<a class="btn verde mini" href="${esc(linkZap(m.telefone, msg))}" target="_blank" rel="noopener">${m.pediu_em ? 'WhatsApp' : 'Lembrar no WhatsApp'}</a>` : ''}
            ${m.slug ? `<button class="btn contorno mini" data-mt-loja="${esc(m.email)}">Entrar na loja</button>` : ''}
            ${!m.pediu_em ? `<button class="btn contorno mini" data-mt-id="${m.id}" data-mt-campo="pediu">Marcar que pediu</button>` : ''}
            ${!m.concluida_em ? `<button class="btn principal mini" data-mt-id="${m.id}" data-mt-campo="concluida">Concluir</button>` : `<button class="btn contorno mini" data-mt-id="${m.id}" data-mt-campo="reabrir">Reabrir</button>`}
          </span></div>`;
      }).join('')}</div>` : '<p class="pequeno">Ninguém aqui agora.</p>'}
      <p class="dica" style="margin-top:8px">Entra aqui quem recebeu a oferta "Montamos sua loja" e assinou o plano anual. O prazo é de 3 dias úteis depois que ela pede a montagem. "Kits cadastrados" conta sozinho pelos kits da loja.</p></section>`;
  $$('[data-mt]', alvo).forEach((b) => (b.onclick = () => { estado.mtAba = b.dataset.mt; desenhar(); }));
  $$('[data-mt-id]', alvo).forEach((b) => (b.onclick = async () => {
    if (b.dataset.mtCampo === 'concluida' && !confirm('Marcar a montagem desta loja como concluída?')) return;
    b.disabled = true;
    try { await dados.adminMontagemMarcar(Number(b.dataset.mtId), b.dataset.mtCampo); desenhar(); } catch (e) { aviso(e.message); b.disabled = false; }
  }));
  $$('[data-mt-loja]', alvo).forEach((b) => (b.onclick = async () => {
    b.disabled = true; b.textContent = 'Entrando…';
    try { await entrarNaLoja(b.dataset.mtLoja); b.disabled = false; b.textContent = 'Entrar na loja'; } catch (e) { aviso(e.message); b.disabled = false; b.textContent = 'Entrar na loja'; }
  }));
}

iniciar();
