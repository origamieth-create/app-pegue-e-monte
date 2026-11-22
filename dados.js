// =====================================================================
// Acesso aos dados. Funciona de dois jeitos:
// - Com o Supabase configurado em config.js: dados reais.
// - Sem configurar: MODO DEMONSTRAÇÃO, com dados de exemplo guardados
//   só neste navegador. Serve para ver e testar o app antes de tudo.
// =====================================================================
import { SUPABASE_URL, SUPABASE_ANON_KEY, DEMO_SITE } from './config.js?v=20261121e';

export const MODO_DEMO = !/^https:\/\/.+\.supabase\.co\/?$/.test(SUPABASE_URL);

let sb = null;
// Modo suporte em várias abas: cada aba diz ao banco qual loja está atendendo
export function lojaSuporteDaAba() { try { return sessionStorage.getItem('apm-suporte-loja') || null; } catch (e) { return null; } }
function guardarLojaSuporte(id) { try { if (id) sessionStorage.setItem('apm-suporte-loja', id); else sessionStorage.removeItem('apm-suporte-loja'); } catch (e) { /* segue */ } }
// A aba aberta pelo painel chega com ?suporte=<loja>: guarda nesta aba e limpa o endereço
try {
  const q = new URLSearchParams(location.search).get('suporte');
  if (q && /^[0-9a-fA-F-]{36}$/.test(q) && !/reservar|contrato/.test(location.pathname)) {
    guardarLojaSuporte(q.toLowerCase());
    const u = new URL(location.href); u.searchParams.delete('suporte');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }
} catch (e) { /* segue */ }
export function sairDaLojaNestaAba() { guardarLojaSuporte(null); }
async function cliente() {
  if (!sb) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const loja = lojaSuporteDaAba();
    // O cabeçalho vai só para o banco (rest/v1); fotos e login seguem como sempre
    const comLoja = (input, init = {}) => {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (!url.includes('/rest/v1/')) return fetch(input, init);
      const h = new Headers(init.headers || (typeof input !== 'string' && input.headers) || undefined);
      h.set('x-loja', loja);
      return fetch(input, { ...init, headers: h });
    };
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, loja ? { global: { fetch: comLoja } } : undefined);
  }
  return sb;
}

// Traduz erros técnicos para mensagens que a dona entende.
function erroAmigavel(e) {
  const msg = (e && (e.message || e.error_description)) || String(e);
  if (e && e.code === '23P01') return /reservad|lotad|atendendo/.test(msg) ? msg : 'Esse kit já está reservado nesse período. Escolha outra data ou outro kit.';
  if (e && e.code === '23505' && msg.includes('slug')) return 'Esse link já está em uso. Escolha outro.';
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(msg)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/User already registered/i.test(msg)) return 'Esse e-mail já tem conta. Use "Entrar".';
  if (/Password should be/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/so_leitura/i.test(msg)) return 'Você entrou no modo SÓ LEITURA: dá para ver tudo, mas nada pode ser alterado.';
  if (/row-level security|permission denied/i.test(msg)) return 'Sua assinatura não está ativa, então o app está em modo leitura.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Sem conexão. Confira a internet e tente de novo.';
  return msg;
}
function falha(e) { throw new Error(erroAmigavel(e)); }
async function ok(promessa) {
  const { data, error } = await promessa;
  if (error) falha(error);
  return data;
}

// ---------------------------------------------------------------------
// Datas (sempre no formato AAAA-MM-DD, no fuso do aparelho)
// ---------------------------------------------------------------------
export function hojeISO() { return isoDe(new Date()); }
export function isoDe(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function somaDias(iso, n) {
  const [a, m, d] = iso.split('-').map(Number);
  return isoDe(new Date(a, m - 1, d + n));
}
export function cruza(r, ini, fim) { return r.data_retirada <= fim && r.data_devolucao >= ini; }

// ---------------------------------------------------------------------
// Regra da agenda (a mesma do banco: agenda_motivo). Devolve null se cabe,
// ou o motivo: 'kit' | 'tema' | 'limite' | 'fechado' | 'estrutura:<nome>'.
// tudo = false confere só kit e tema (o resto é aviso para a dona).
// ---------------------------------------------------------------------
export function motivoAgenda(c, kitId, temaId, ret, dev, ignorar = null, tudo = true) {
  const kits = c.kits || [], reservas = (c.reservas || []).filter((r) => r.status !== 'cancelada' && r.id !== ignorar);
  const k = kits.find((x) => x.id === kitId);
  if (!k || !ret || !dev || dev < ret) return 'kit';
  const qtdKit = Math.max(1, Number(k.quantidade) || 1);
  const tema = temaId ? (k.temas || []).find((t) => t.id === temaId) : null;
  const qtdTema = tema ? Math.max(1, Number(tema.qtd) || 1) : 1;
  const est = (k.estruturas || []).map((e) => ({ ...e, s: (c.estruturas || []).find((x) => x.id === e.id) })).filter((e) => e.s);
  const usoDe = (r, id) => { const kk = kits.find((x) => x.id === r.kit_id); const e = kk && (kk.estruturas || []).find((x) => x.id === id); return e ? Math.max(1, Number(e.qtd) || 1) : 0; };
  for (let x = ret, n = 0; x <= dev && n <= 60; x = somaDias(x, 1), n++) {
    const no = reservas.filter((r) => r.data_retirada <= x && r.data_devolucao >= x);
    if (no.filter((r) => r.kit_id === kitId).length >= qtdKit) return 'kit';
    if (temaId && no.filter((r) => r.kit_id === kitId && r.tema_id === temaId).length >= qtdTema) return 'tema';
    if (!tudo) continue;
    if ((c.fechados || []).some((f) => x >= f.de && x <= f.ate)) return 'fechado';
    if (c.limite_dia && no.length >= c.limite_dia) return 'limite';
    for (const e of est) {
      const fora = e.s.fora_de && x >= e.s.fora_de && x <= (e.s.fora_ate || e.s.fora_de) ? Number(e.s.fora_qtd) || 0 : 0;
      const usados = no.reduce((t, r) => t + usoDe(r, e.id), 0);
      if (usados + Math.max(1, Number(e.qtd) || 1) > (Number(e.s.quantidade) || 0) - fora) return 'estrutura:' + e.s.nome;
    }
  }
  return null;
}
const COLLATOR = typeof Intl !== 'undefined' ? new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' }) : null;
// Ordem dos kits (a mesma no app e no link): A–Z com números na ordem certa (Kit 2 antes do Kit 10)
export function ordenarKits(kits, modo) {
  const az = (a, b) => (COLLATOR ? COLLATOR.compare(a.nome || '', b.nome || '') : String(a.nome).localeCompare(String(b.nome)));
  const num = (k) => { const m = String(k.nome || '').match(/\d+/); return m ? Number(m[0]) : Infinity; };
  const preco = (k) => (k.preco_consultar ? Infinity : Number(k.preco) || 0);
  const l = [...(kits || [])];
  if (modo === 'numero') return l.sort((a, b) => num(a) - num(b) || az(a, b));
  if (modo === 'menor') return l.sort((a, b) => preco(a) - preco(b) || az(a, b));
  if (modo === 'maior') return l.sort((a, b) => (b.preco_consultar ? -Infinity : Number(b.preco) || 0) - (a.preco_consultar ? -Infinity : Number(a.preco) || 0) || az(a, b));
  if (modo === 'novos') return l.sort((a, b) => String(b.criado_em || '').localeCompare(String(a.criado_em || '')) || az(a, b));
  return l.sort(az);
}
export function mensagemAgenda(m) {
  if (!m) return null;
  if (m === 'kit') return 'Esse kit já está reservado nessas datas.';
  if (m === 'tema') return 'Esse tema já está reservado nessas datas. Escolha outro tema.';
  if (m === 'fechado') return 'A loja não está atendendo nessa data. Escolha outra data.';
  return 'Essa data já está lotada. Escolha outra data.';
}

// =====================================================================
// MODO DEMONSTRAÇÃO
// =====================================================================
const CHAVE_DEMO = DEMO_SITE ? 'apm-demo-site-v2' : 'apm-demo-v1';
function uid() { return (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2); }

function demoInicial() {
  const h = hojeISO();
  const negocio = { id: 'n1', nome: 'Festas da Maria', slug: 'demo', whatsapp: '51999990000',
    chave_pix: 'maria@email.com', logo_url: null, dias_antes: 1, dias_depois: 1 };
  const kits = [
    { id: 'k1', negocio_id: 'n1', nome: 'Safári', preco: 350, sinal: 100, foto_url: null, ativo: true,
      pecas: ['Painel redondo', 'Boleira de madeira', 'Vaso girafa', 'Bandejas (3)', 'Arco de folhagens'] },
    { id: 'k2', negocio_id: 'n1', nome: 'Jardim Encantado', preco: 380, sinal: 120, foto_url: null, ativo: true,
      pecas: ['Painel romântico', 'Mesa provençal', 'Borboletas (6)', 'Vasos de flores (2)'] },
    { id: 'k3', negocio_id: 'n1', nome: 'Fundo do Mar', preco: 320, sinal: 100, foto_url: null, ativo: true,
      pecas: ['Painel azul', 'Cilindros (3)', 'Peixinhos (5)', 'Boleira'] },
  ];
  const r = (kit, festa, status, nome, zap, extra = {}) => {
    const k = kits.find((x) => x.id === kit);
    return { id: uid(), negocio_id: 'n1', kit_id: kit, data_festa: festa, data_retirada: somaDias(festa, -1),
      data_devolucao: somaDias(festa, 1), status, origem: 'app', cliente_nome: nome, cliente_whatsapp: zap,
      valor_total: k.preco, valor_sinal: k.sinal, sinal_recebido: status !== 'aguardando_sinal',
      restante_recebido: status === 'concluida', pecas: [...k.pecas],
      checklist_retirada: k.pecas.map(() => status === 'retirada' || status === 'concluida'),
      checklist_devolucao: k.pecas.map(() => status === 'concluida'),
      avaria_obs: null, avaria_valor: 0, obs: null, criado_em: new Date().toISOString(), ...extra };
  };
  const reservas = [
    r('k1', somaDias(h, 1), 'confirmada', 'Ana Paula', '51988887777'),
    r('k2', h, 'retirada', 'Bruna Lima', '51977776666'),
    r('k3', somaDias(h, 6), 'aguardando_sinal', 'Carla Souza', '51966665555', { origem: 'link' }),
    r('k1', somaDias(h, -3), 'concluida', 'Daniela Reis', '51955554444'),
    r('k3', somaDias(h, -2), 'retirada', 'Elaine Costa', '51944443333'),
  ];
  const mes = h.slice(0, 7);
  const gastos = [
    { id: uid(), negocio_id: 'n1', data: `${mes}-05`, descricao: 'Balões e fitas', valor: 85 },
    { id: uid(), negocio_id: 'n1', data: `${mes}-12`, descricao: 'Frete de entrega', valor: 60 },
  ];
  const assinatura = { status: 'ativa', plano: 'mensal', carencia_ate: null };
  if (DEMO_SITE) {
    // Demonstração do site: kits com foto, recado no link e já entra logada.
    const fotos = { k1: 'fotos/safari.svg', k2: 'fotos/jardim.svg', k3: 'fotos/fundo-do-mar.svg' };
    kits.forEach((k) => { k.foto_url = fotos[k.id]; k.fotos = [fotos[k.id]]; });
    negocio.recado_link = 'Kits completos para festas inesquecíveis 🎈 Retirada no Centro, de segunda a sábado.';
    negocio.criado_em = new Date().toISOString();
    negocio.logo_url = 'fotos/logo.svg';
    const cat = { k1: 'Menino', k2: 'Menina', k3: 'Menino' };
    kits.forEach((k) => { k.categoria = cat[k.id] || null; });
    kits[0].fotos = ['fotos/safari.svg', 'fotos/jardim.svg', 'fotos/fundo-do-mar.svg'];
    kits.push({ ...kits[1], id: 'k4', nome: 'Chá Revelação Ursinhos', preco: 290, categoria: 'Chá revelação', foto_url: 'fotos/jardim.svg', fotos: ['fotos/jardim.svg'] });
  }
  return { negocio, kits, reservas, gastos, assinatura, logado: DEMO_SITE, geradoEm: Date.now() };
}
function demoLer() {
  try {
    const s = localStorage.getItem(CHAVE_DEMO);
    if (s) {
      const d = JSON.parse(s);
      // Na demonstração do site, os dados de exemplo recomeçam a cada dia (datas sempre atuais).
      if (!DEMO_SITE || (d.geradoEm && Date.now() - d.geradoEm < 20 * 3600 * 1000)) return d;
    }
  } catch (e) { /* sem storage */ }
  return demoInicial();
}
let demo = null;
function D() { if (!demo) demo = demoLer(); return demo; }
function demoSalvar() { try { localStorage.setItem(CHAVE_DEMO, JSON.stringify(demo)); } catch (e) { /* ignora */ } }
function demoCtx() { const d = D(); return { kits: d.kits, reservas: d.reservas, estruturas: d.estruturas || [], fechados: d.fechados || [], limite_dia: d.negocio.limite_dia || null }; }
function demoConflito(res, ignorarId, tudo = false) {
  return motivoAgenda(demoCtx(), res.kit_id, res.tema_id || null, res.data_retirada, res.data_devolucao, ignorarId, tudo);
}
export function demoReiniciar() { demo = demoInicial(); demo.logado = true; demoSalvar(); }
export const DEMONSTRACAO_SITE = DEMO_SITE;

// =====================================================================
// Interface usada pelo app (mesmas funções nos dois modos)
// =====================================================================

// ---------- Login ----------
export async function sessaoAtual() {
  if (MODO_DEMO) return D().logado ? { user: { id: 'demo', email: 'demo@exemplo.com' } } : null;
  const s = await cliente();
  const { data } = await s.auth.getSession();
  return data.session;
}
export async function entrar(email, senha) {
  if (MODO_DEMO) { D().logado = true; demoSalvar(); return; }
  const s = await cliente();
  await ok(s.auth.signInWithPassword({ email, password: senha }));
}
export async function criarConta(email, senha) {
  if (MODO_DEMO) { D().logado = true; demoSalvar(); return { precisaConfirmar: false, usuario: null }; }
  const s = await cliente();
  const data = await ok(s.auth.signUp({ email, password: senha }));
  return { precisaConfirmar: !data.session, usuario: data.user?.id || null };
}
export async function esqueciSenha(email) {
  if (MODO_DEMO) return;
  const s = await cliente();
  await ok(s.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] }));
}
export async function trocarSenha(nova) {
  if (MODO_DEMO) return;
  const s = await cliente();
  await ok(s.auth.updateUser({ password: nova }));
}
export async function sair() {
  if (MODO_DEMO) { D().logado = false; demoSalvar(); return; }
  const s = await cliente();
  await s.auth.signOut();
}
export async function aoMudarLogin(fn) {
  if (MODO_DEMO) return;
  const s = await cliente();
  s.auth.onAuthStateChange((evento) => fn(evento));
}

// ---------- Negócio ----------
export async function meuNegocio() {
  if (MODO_DEMO) return D().negocio;
  const s = await cliente();
  const sup = await suporteAtual().catch(() => null);
  if (sup && sup.negocio_id) return ok(s.from('negocios').select('*').eq('id', sup.negocio_id).maybeSingle());
  const { data: u } = await s.auth.getUser();
  if (!u || !u.user) return null;
  return ok(s.from('negocios').select('*').eq('dono', u.user.id).maybeSingle());
}

// ---------- Modo suporte (administrador dentro da loja de uma cliente) ----------
export async function suporteAtual() {
  if (MODO_DEMO) return null;
  const s = await cliente();
  return ok(s.rpc('suporte_atual'));
}
export async function suporteSair() {
  if (MODO_DEMO) return { ok: true };
  const s = await cliente();
  const r = await ok(s.rpc('suporte_sair'));
  guardarLojaSuporte(null);
  return r;
}
export async function adminEntrarLoja(email, soLeitura) {
  if (MODO_DEMO) throw new Error('Na demonstração não dá para entrar na loja de uma cliente.');
  const s = await cliente();
  return ok(s.rpc('admin_entrar_loja', { p_email: email, p_leitura: !!soLeitura }));
}
export async function adminSuporteLog() {
  if (MODO_DEMO) return [];
  const s = await cliente();
  return ok(s.rpc('admin_suporte_log'));
}

// ---------- Avisos no celular da loja ----------
export async function salvarPushLoja(endpoint) {
  if (MODO_DEMO) return 'demo-token';
  const s = await cliente();
  return ok(s.rpc('salvar_push_loja', { p_endpoint: endpoint }));
}
export async function removerPushLoja(endpoint) {
  if (MODO_DEMO) return { ok: true };
  const s = await cliente();
  return ok(s.rpc('remover_push_loja', { p_endpoint: endpoint }));
}
export async function lojaTestarPush() {
  if (MODO_DEMO) return { ok: true };
  const s = await cliente();
  return ok(s.rpc('loja_testar_push'));
}
// ---------- Loja pronta (prévia montada pelo @ do Instagram) ----------
export async function previaMinha(id, token) {
  if (MODO_DEMO) { try { return JSON.parse(localStorage.getItem('apm-previa-demo') || 'null'); } catch (e) { return null; } }
  const s = await cliente();
  const { data, error } = await s.rpc('previa_minha', { p_id: id || null, p_token: token || null });
  if (error) return null;
  return data || null;
}
export async function previaImportar(id, token, somar = false) {
  if (MODO_DEMO) {
    const pv = await previaMinha(); if (!pv) return { ok: true, kits: 0, ids: [] };
    const pago = (D().assinatura || {}).status === 'ativa', max = pago ? 40 : 10;
    const nomes = new Set(D().kits.map((k) => String(k.nome).trim().toLowerCase()));
    const ids = (pv.kits || []).filter((k) => !somar || !nomes.has(String(k.nome).trim().toLowerCase())).slice(0, max).map((k) => { const novo = { id: uid(), negocio_id: 'n1', nome: k.nome, preco: 0, sinal: 0, foto_url: k.foto_url, fotos: k.foto_url ? [k.foto_url] : [], categoria: k.categoria || null, preco_consultar: true, ativo: true, pecas: [], variacoes: [], temas: [], estruturas: [], quantidade: 1 }; D().kits.push(novo); return { previa: k.id, kit: novo.id }; });
    const resto = (pv.kits || []).slice(max);
    D().previaSit = { pago, instagram: pv.instagram, bloqueados: resto.length, fotos: resto.slice(0, 12).map((k) => ({ foto: k.foto_url })), resto, posts_total: 120, completa: pago ? { fase: 'fila' } : null };
    demoSalvar(); try { localStorage.removeItem('apm-previa-demo'); } catch (e) { /* segue */ }
    return { ok: true, kits: ids.length, ids, limitado: resto.length > 0, bloqueados: resto.length };
  }
  const s = await cliente();
  return ok(s.rpc('previa_importar', { p_id: id, p_token: token || null, p_somar: !!somar }));
}
// Lançamento "Monte sua loja com o seu Instagram": loja sem kits ou só com os kits do teste
export async function lancamentoIgMostrar() {
  if (MODO_DEMO) { const d = D(); return !d.previaSit && (d.kits || []).length === 0; }
  const s = await cliente();
  const { data, error } = await s.rpc('lancamento_ig_mostrar');
  return !error && data === true;
}
// Loja que veio do Instagram: kits com cadeado (teste grátis) e andamento da loja completa (assinatura paga)
export async function previaSituacao() {
  if (MODO_DEMO) {
    const x = D().previaSit; if (!x) return null;
    const pago = (D().assinatura || {}).status === 'ativa';
    if (pago && !x.completa) { x.completa = { fase: 'fila' }; demoSalvar(); }
    return { ...x, pago, resto: undefined };
  }
  const s = await cliente();
  const { data, error } = await s.rpc('previa_situacao');
  if (error) return null;
  return data || null;
}
// Função "loja-pronta" com a sessão da conta (puxar a loja no cadastro; passos da loja completa)
async function lojaPronta(corpo) {
  if (MODO_DEMO) return demoLojaPronta(corpo);
  const s = await cliente();
  const { data } = await s.auth.getSession();
  const tk = data.session && data.session.access_token;
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/functions/v1/loja-pronta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${tk || SUPABASE_ANON_KEY}` },
      body: JSON.stringify(corpo),
    });
  } catch (e) { throw new Error('Sem conexão. Confira a internet e tente de novo.'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.erro) { const e = new Error(d.mensagem || 'Não deu certo agora. Tente de novo em instantes.'); e.codigo = d.erro || 'erro'; throw e; }
  return d;
}
export function puxarInstagram(instagram, aparelho) { return lojaPronta({ acao: 'conta', instagram, aparelho }); }
export function montarPuxada(id, token) { return lojaPronta({ acao: 'montar', id, token }); }
export function lojaCompletaPasso() { return lojaPronta({ acao: 'completa' }); }
function demoLojaPronta(c) {
  const nomes = ['Kit Jardim Encantado', 'Kit Safári', 'Kit Circo', 'Kit Princesa', 'Kit Fundo do Mar', 'Kit Unicórnio', 'Kit Futebol', 'Kit Borboletas', 'Kit Astronauta', 'Kit Fazendinha', 'Kit Chá Revelação', 'Kit Dinossauro', 'Kit Arco-íris', 'Kit Batizado', 'Kit Bailarina', 'Kit Super-heróis', 'Kit Tropical', 'Kit Boho', 'Kit Floresta', 'Kit Sereia', 'Kit Copa', 'Kit Minnie', 'Kit Realeza'];
  const foto = (i) => `loja-pronta/exemplos/${(i % 4) + 1}.jpg`;
  if (c.acao === 'conta') {
    if (!/^[a-z0-9._]{1,30}$/.test(String(c.instagram || ''))) { const e = new Error('Confira o @: só letras, números, ponto e _.'); e.codigo = 'arroba'; return Promise.reject(e); }
    const pv = { id: 'demo-previa', instagram: c.instagram, perfil: { nome: 'SKA Festa', foto: null, bio: 'Pegue & Monte · Decorações · Orçamentos pelo WhatsApp', whatsapp: '51982316117' },
      kits: nomes.map((n, i) => ({ id: `k${i + 1}`, nome: n, categoria: i % 3 === 0 ? 'Menina' : i % 3 === 1 ? 'Menino' : null, foto_url: foto(i), pecas: i < 6 ? ['mesa', 'arco'] : [] })),
      grupo: { frase: 'a mesma mesa e o mesmo arco', curto: 'mesa e arco', nome: 'Mesa e arco', kits: ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'] }, modo: 'instagram' };
    try { localStorage.setItem('apm-previa-demo', JSON.stringify(pv)); } catch (e) { /* segue */ }
    return new Promise((ok) => setTimeout(() => ok({ id: pv.id, token: 'demo', perfil: { nome: pv.perfil.nome, posts_total: 120 } }), 600));
  }
  if (c.acao === 'montar') return new Promise((ok) => setTimeout(() => ok({ ok: true, kits: nomes.length, modo: 'instagram' }), 1500));
  if (c.acao === 'completa') {
    const x = D().previaSit; if (!x || !x.completa) return Promise.resolve({ fase: null });
    const ordem = ['fila', 'buscando', 'analisando', 'analisando2', 'importando', 'pronta'];
    const i = Math.min(ordem.length - 1, ordem.indexOf(x.completa.fase) + 1);
    const fase = ordem[i];
    x.completa = { fase, alvo: 100, vistos: [0, 0, 0, 30, 60, 100][i], novos: [0, 0, 0, 2, 4, 4][i], liberados: fase === 'pronta' ? x.bloqueados + 4 : 0, agenda: fase === 'pronta' ? 3 : 0 };
    if (fase === 'pronta') {
      (x.resto || []).concat(nomes.slice(0, 4).map((n, j) => ({ nome: n + ' 2', foto_url: foto(j) }))).forEach((k) => D().kits.push({ id: uid(), negocio_id: 'n1', nome: k.nome, preco: 0, sinal: 0, foto_url: k.foto_url, fotos: [k.foto_url], categoria: null, preco_consultar: true, ativo: true, pecas: [], variacoes: [], temas: [], estruturas: [], quantidade: 1 }));
      x.bloqueados = 0; x.fotos = []; x.resto = [];
    }
    demoSalvar();
    return new Promise((ok) => setTimeout(() => ok({ ...x.completa, fase: fase === 'analisando2' ? 'analisando' : fase }), 300));
  }
  return Promise.resolve({});
}
export async function linkDisponivel(slug) {
  if (MODO_DEMO) return true;
  const s = await cliente();
  return ok(s.rpc('link_disponivel', { p_slug: slug }));
}
export async function salvarNegocio(campos) {
  if (MODO_DEMO) { D().negocio = Object.assign(D().negocio || { id: 'demo-negocio', criado_em: new Date().toISOString(), limite_dia: null, confirmar_whatsapp: true }, campos); demoSalvar(); return D().negocio; }
  const s = await cliente();
  const { data: u } = await s.auth.getUser();
  const atual = await meuNegocio();
  if (atual) return ok(s.from('negocios').update(campos).eq('id', atual.id).select().single());
  return ok(s.from('negocios').insert({ ...campos, dono: u.user.id }).select().single());
}

// ---------- Assinatura ----------
export async function minhaAssinatura() {
  if (MODO_DEMO) {
    const a = D().assinatura || { status: 'ativa', plano: 'mensal', carencia_ate: null };
    const agora = new Date().toISOString();
    const liberado = a.status === 'ativa' || (a.status !== 'teste' && !!a.carencia_ate && a.carencia_ate > agora)
      || (a.status === 'teste' && !!a.teste_ate && a.teste_ate > agora);
    const oferta_bf = a.status === 'ativa' && (a.plano || 'mensal') === 'mensal' && (a.forma_pagamento || 'pix') === 'pix' && agora < '2026-11-30T02:59:59Z';
    return { email: 'demo@exemplo.com', cortesia: false, encontrada: true, plano: 'mensal', forma_pagamento: 'pix', oferta_bf, oferta_bf_ate: '2026-11-30T02:59:59Z', ...a, liberado, admin: !DEMO_SITE, agora };
  }
  const s = await cliente();
  return ok(s.rpc('minha_assinatura'));
}
export async function iniciarTeste(origem = null, telefone = null) {
  if (MODO_DEMO) {
    if (!D().assinatura) { D().assinatura = { status: 'teste', teste_ate: new Date(Date.now() + 7 * 864e5).toISOString() }; demoSalvar(); }
    return { ok: true };
  }
  const s = await cliente();
  return ok(s.rpc('iniciar_teste', { p_origem: origem, p_telefone: telefone }));
}
// 3º passo dos primeiros passos: guarda quando a dona copiou o link pela primeira vez.
export async function marcarLinkCopiado() {
  const agora = new Date().toISOString();
  if (MODO_DEMO) { if (!D().negocio.link_copiado_em) { D().negocio.link_copiado_em = agora; demoSalvar(); } return; }
  const s = await cliente();
  const atual = await meuNegocio();
  if (!atual || atual.link_copiado_em) return;
  await ok(s.from('negocios').update({ link_copiado_em: agora }).eq('id', atual.id).is('link_copiado_em', null));
}
export async function adminTestesOrigem() {
  if (MODO_DEMO) return { anuncio: { total: 18, convertidos: 4 }, direto: { total: 6, convertidos: 2 }, por_campanha: [{ campanha: 'teste-gratis-novembro', total: 18, convertidos: 4 }] };
  const s = await cliente();
  return ok(s.rpc('admin_testes_origem'));
}
// Demonstração: troca a situação da assinatura para testar as telas.
export function demoSimular(caso) {
  const h = (n) => new Date(Date.now() + n * 3600e3).toISOString();
  if (caso === 'nova') {
    // Conta nova em teste, sem nada cadastrado (para ver os primeiros passos).
    D().kits = []; D().reservas = []; D().gastos = [];
    D().negocio.criado_em = new Date().toISOString(); D().negocio.link_copiado_em = null;
    try { Object.keys(localStorage).filter((k) => k.startsWith('apm-passos-') || k.startsWith('apm-link-copiado-')).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* segue */ }
    caso = 'teste';
  }
  const pix = '00020101021226870014br.gov.bcb.pix2565pix.exemplo.com.br/qr/v2/cobv/demonstracao0000000000005204000053039865406' + '29.905802BR5913DEMONSTRACAO6009SAO PAULO62070503***6304ABCD';
  D().assinatura = ({
    normal: { status: 'ativa', plano: 'mensal' },
    teste: { status: 'teste', teste_ate: h(24 * 7) },
    teste_fim: { status: 'teste', teste_ate: h(-1) },
    pix: { status: 'carencia', plano: 'mensal', carencia_ate: h(48), pix_codigo: pix, pix_vence: h(24) },
    email: { status: 'carencia', plano: 'mensal', carencia_ate: h(48) },
    suspensa: { status: 'suspensa', plano: 'mensal' },
    cancelada: { status: 'cancelada', plano: 'mensal', carencia_ate: h(-1) },
  })[caso] || { status: 'ativa', plano: 'mensal' };
  demoSalvar();
}
export function demoSimularFalha() {
  D().assinatura = { status: 'carencia', plano: 'mensal', carencia_ate: new Date(Date.now() + 48 * 3600 * 1000).toISOString() };
  demoSalvar();
}

// ---------- Kits ----------
export async function listarKits() {
  if (MODO_DEMO) return [...D().kits].sort((a, b) => a.nome.localeCompare(b.nome));
  const s = await cliente();
  return ok(s.from('kits').select('*').order('nome'));
}
export async function salvarKit(kit) {
  if (MODO_DEMO) {
    if (kit.id) Object.assign(D().kits.find((k) => k.id === kit.id), kit);
    else D().kits.push({ ...kit, id: uid(), negocio_id: 'n1' });
    demoSalvar(); return;
  }
  const s = await cliente();
  const neg = await meuNegocio();
  const { id, ...campos } = kit;
  if (id) await ok(s.from('kits').update(campos).eq('id', id));
  else await ok(s.from('kits').insert({ ...campos, negocio_id: neg.id }));
}
export async function apagarKit(id) {
  if (MODO_DEMO) {
    if (D().reservas.some((r) => r.kit_id === id)) throw new Error('Esse kit tem reservas. Em vez de apagar, desligue "Mostrar no link".');
    D().kits = D().kits.filter((k) => k.id !== id); demoSalvar(); return;
  }
  const s = await cliente();
  const { error } = await s.from('kits').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') throw new Error('Esse kit tem reservas. Em vez de apagar, desligue "Mostrar no link".');
    falha(error);
  }
}
export async function enviarFoto(arquivo, max = 1200) {
  const blob = await reduzirImagem(arquivo, max, 0.85);
  if (MODO_DEMO) {
    return new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  }
  const s = await cliente();
  const { data: u } = await s.auth.getUser();
  const caminho = `${u.user.id}/${uid()}.jpg`;
  await ok(s.storage.from('fotos').upload(caminho, blob, { contentType: 'image/jpeg', upsert: false }));
  return s.storage.from('fotos').getPublicUrl(caminho).data.publicUrl;
}
function reduzirImagem(arquivo, max, qualidade) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const esc = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Não consegui ler a foto.'))), 'image/jpeg', qualidade);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Esse arquivo não parece uma foto.'));
    img.src = URL.createObjectURL(arquivo);
  });
}

// ---------- Reservas ----------
export async function listarReservas() {
  const desde = somaDias(hojeISO(), -120);
  if (MODO_DEMO) return D().reservas.filter((r) => r.status !== 'cancelada' && r.data_devolucao >= desde);
  const s = await cliente();
  return ok(s.from('reservas').select('*').neq('status', 'cancelada').gte('data_devolucao', desde).order('data_retirada'));
}
export async function criarReserva(res) {
  if (MODO_DEMO) {
    const m = demoConflito(res, null, res.origem === 'link');
    if (m && (res.origem === 'link' || m === 'kit' || m === 'tema')) throw new Error(mensagemAgenda(m));
    const k = D().kits.find((x) => x.id === res.kit_id);
    const nova = { id: uid(), negocio_id: 'n1', origem: 'app', sinal_recebido: res.status === 'confirmada',
      restante_recebido: false, pecas: [...k.pecas], checklist_retirada: k.pecas.map(() => false),
      checklist_devolucao: k.pecas.map(() => false), avaria_obs: null, avaria_valor: 0, obs: null,
      criado_em: new Date().toISOString(), ...res };
    D().reservas.push(nova); demoSalvar(); return nova;
  }
  const s = await cliente();
  const neg = await meuNegocio();
  return ok(s.from('reservas').insert({ ...res, negocio_id: neg.id }).select().single());
}
export async function atualizarReserva(id, campos) {
  if (MODO_DEMO) {
    const r = D().reservas.find((x) => x.id === id);
    const teste = { ...r, ...campos };
    const mudou = ['kit_id', 'tema_id', 'data_retirada', 'data_devolucao'].some((c) => c in campos && campos[c] !== r[c]) || (r.status === 'cancelada' && teste.status !== 'cancelada');
    const m = teste.status !== 'cancelada' && mudou ? demoConflito(teste, id, false) : null;
    if (m) throw new Error(mensagemAgenda(m));
    Object.assign(r, campos); demoSalvar(); return r;
  }
  const s = await cliente();
  return ok(s.from('reservas').update(campos).eq('id', id).select().single());
}

// ---------- Gastos ----------
export async function listarGastos() {
  const desde = somaDias(hojeISO(), -400);
  if (MODO_DEMO) { if (!D().gastos) D().gastos = []; return D().gastos.filter((g) => g.data >= desde); }
  const s = await cliente();
  return ok(s.from('gastos').select('*').gte('data', desde).order('data', { ascending: false }));
}
export async function criarGasto(g) {
  if (MODO_DEMO) { if (!D().gastos) D().gastos = []; D().gastos.push({ ...g, id: uid(), negocio_id: 'n1' }); demoSalvar(); return; }
  const s = await cliente();
  const neg = await meuNegocio();
  await ok(s.from('gastos').insert({ ...g, negocio_id: neg.id }));
}
export async function apagarGasto(id) {
  if (MODO_DEMO) { D().gastos = (D().gastos || []).filter((g) => g.id !== id); demoSalvar(); return; }
  const s = await cliente();
  await ok(s.from('gastos').delete().eq('id', id));
}

// ---------- Link público ----------
// Conta uma visita no link de reservas (só número por dia; sem dados de quem visitou)
export async function registrarVisita(slug, instagram) {
  if (MODO_DEMO) return;
  const s = await cliente();
  await s.rpc('registrar_visita', { p_slug: slug, p_instagram: !!instagram });
}
export async function catalogoPublico(slug) {
  if (MODO_DEMO) {
    const n = D().negocio;
    if (slug !== n.slug) return null;
    return { nome: n.nome, whatsapp: n.whatsapp, chave_pix: n.confirmar_whatsapp ? null : n.chave_pix, confirmar: !!n.confirmar_whatsapp, logo_url: n.logo_url, recado: n.recado_link || null, instagram: n.instagram || null,
      dias_antes: n.dias_antes, dias_depois: n.dias_depois, ordem_kits: n.ordem_kits || 'az',
      fechado: (D().fechados || []).filter((f) => f.ate >= hojeISO()),
      kits: D().kits.filter((k) => k.ativo).map(({ id, nome, preco, sinal, foto_url, fotos, categoria, pecas, variacoes, temas, preco_consultar, criado_em }) => ({ id, nome, preco, sinal, foto_url, fotos: fotos || [], categoria: categoria || null, pecas: pecas || [], variacoes: variacoes || [], temas: temas || [], preco_consultar: !!preco_consultar, criado_em: criado_em || null })) };
  }
  const s = await cliente();
  return ok(s.rpc('catalogo_publico', { p_slug: slug }));
}
export async function datasOcupadas(slug, kitId, de, ate) {
  if (MODO_DEMO) {
    const n = D().negocio; const fora = [];
    for (let d = de; d <= ate; d = somaDias(d, 1)) {
      const ini = somaDias(d, -n.dias_antes); const fim = somaDias(d, n.dias_depois);
      if (motivoAgenda(demoCtx(), kitId, null, ini, fim, null, true)) fora.push(d);
    }
    return fora;
  }
  const s = await cliente();
  return ok(s.rpc('datas_ocupadas', { p_slug: slug, p_kit: kitId, p_de: de, p_ate: ate }));
}
export async function solicitarReserva(slug, kitId, dataFesta, nome, whatsapp, variacaoId, temaId) {
  if (MODO_DEMO) {
    const n = D().negocio; const k = D().kits.find((x) => x.id === kitId);
    const v = (k.variacoes || []).find((x) => x.id === variacaoId) || null;
    const t = (k.temas || []).length ? (k.temas || []).find((x) => x.id === temaId) : null;
    if ((k.temas || []).length && !t) throw new Error('Escolha o tema do kit');
    const zap = String(whatsapp).replace(/\D/g, '');
    if (zap.length < 10) throw new Error('Informe um WhatsApp válido, com DDD');
    const consultar = !!k.preco_consultar;
    const sinal = consultar ? 0 : v ? v.sinal : k.sinal;
    await criarReserva({ kit_id: kitId, data_festa: dataFesta, data_retirada: somaDias(dataFesta, -n.dias_antes),
      data_devolucao: somaDias(dataFesta, n.dias_depois), status: 'aguardando_sinal', origem: 'link',
      cliente_nome: nome.trim(), cliente_whatsapp: zap, valor_total: consultar ? 0 : v ? v.preco : k.preco, valor_sinal: sinal,
      valor_a_combinar: consultar, tema_id: t ? t.id : null, tema: t ? t.nome : null,
      ...(v ? { variacao: v.nome, pecas: [...(k.pecas || []), ...(v.extras || [])] } : {}) });
    return { whatsapp: n.whatsapp, chave_pix: n.confirmar_whatsapp ? null : n.chave_pix, confirmar: !!n.confirmar_whatsapp, consultar,
      sinal, tema: t ? t.nome : null, kit: k.nome + (v ? ' – ' + v.nome : '') };
  }
  const s = await cliente();
  const args = { p_slug: slug, p_kit: kitId, p_data_festa: dataFesta, p_nome: nome, p_whatsapp: whatsapp };
  if (variacaoId || temaId) args.p_variacao = variacaoId || null;
  if (temaId) args.p_tema = temaId;
  return ok(s.rpc('solicitar_reserva', args));
}
export async function temasOcupados(slug, kitId, data) {
  if (MODO_DEMO) {
    const n = D().negocio; const k = D().kits.find((x) => x.id === kitId);
    return (k.temas || []).filter((t) => motivoAgenda(demoCtx(), kitId, t.id, somaDias(data, -n.dias_antes), somaDias(data, n.dias_depois), null, false) === 'tema').map((t) => t.id);
  }
  const s = await cliente();
  return ok(s.rpc('temas_ocupados', { p_slug: slug, p_kit: kitId, p_data: data }));
}

// ---------- Organização da agenda (estruturas e dias fechados) ----------
export async function listarEstruturas() {
  if (MODO_DEMO) return [...(D().estruturas || [])];
  const s = await cliente();
  return ok(s.from('estruturas').select('*').order('nome'));
}
export async function salvarEstrutura(e) {
  if (MODO_DEMO) {
    const d = D(); if (!d.estruturas) d.estruturas = [];
    if (e.id) Object.assign(d.estruturas.find((x) => x.id === e.id), e); else { e = { ...e, id: uid() }; d.estruturas.push(e); }
    demoSalvar(); return e;
  }
  const s = await cliente();
  const { id, ...campos } = e;
  if (id) return ok(s.from('estruturas').update(campos).eq('id', id).select().single());
  const neg = await meuNegocio();
  return ok(s.from('estruturas').insert({ ...campos, negocio_id: neg.id }).select().single());
}
export async function apagarEstrutura(id) {
  if (MODO_DEMO) { const d = D(); d.estruturas = (d.estruturas || []).filter((x) => x.id !== id); d.kits.forEach((k) => { k.estruturas = (k.estruturas || []).filter((x) => x.id !== id); }); demoSalvar(); return; }
  const s = await cliente();
  const neg = await meuNegocio();
  const { data: ks } = await s.from('kits').select('id, estruturas').eq('negocio_id', neg.id);
  for (const k of ks || []) if ((k.estruturas || []).some((x) => x.id === id)) await ok(s.from('kits').update({ estruturas: k.estruturas.filter((x) => x.id !== id) }).eq('id', k.id));
  await ok(s.from('estruturas').delete().eq('id', id));
}
export async function listarFechados() {
  if (MODO_DEMO) return [...(D().fechados || [])];
  const s = await cliente();
  return ok(s.from('agenda_fechada').select('*').gte('ate', somaDias(hojeISO(), -30)).order('de'));
}
export async function salvarFechado(f) {
  if (MODO_DEMO) { const d = D(); if (!d.fechados) d.fechados = []; const novo = { ...f, id: uid() }; d.fechados.push(novo); demoSalvar(); return novo; }
  const s = await cliente();
  const neg = await meuNegocio();
  return ok(s.from('agenda_fechada').insert({ ...f, negocio_id: neg.id }).select().single());
}
export async function apagarFechado(id) {
  if (MODO_DEMO) { const d = D(); d.fechados = (d.fechados || []).filter((x) => x.id !== id); demoSalvar(); return; }
  const s = await cliente();
  await ok(s.from('agenda_fechada').delete().eq('id', id));
}

// ---------- Montar catálogo com IA ----------
// A IA só organiza: não mexe nas fotos e não inventa nada (o que não está escrito fica em branco).
export function reduzirFoto(arquivo, max, qualidade = 0.85) { return reduzirImagem(arquivo, max, qualidade); }
const IA_LIMITE_TESTE = 5;
function demoIa() { const d = D(); if (!d.ia) d.ia = { usados: 0, lotes: [] }; return d.ia; }
function demoIaPlano() {
  const a = D().assinatura || {};
  if (a.status === 'ativa') return 'pago';
  if (a.status === 'teste') return a.teste_ate && a.teste_ate > new Date().toISOString() ? 'teste' : 'bloqueado';
  if (a.status === 'carencia' && a.carencia_ate > new Date().toISOString()) return 'pago';
  return 'bloqueado';
}
// Demonstração: a "IA" é simulada (lê só linhas como "Kit Safari R$ 350 sinal 100").
function demoIaConcluir(l) {
  if (l.status !== 'processando' || Date.now() - l.criado < 4500) return;
  const ia = demoIa();
  const linhas = [l.entrada.texto || '', ...(l.entrada.paginas || []).map((p) => p.texto || '')].join('\n').split(/\n|;/).map((x) => x.trim()).filter(Boolean);
  const lidos = [];
  for (const linha of linhas) {
    const m = linha.match(/^(.*?)\s*[-–:]?\s*R\$\s*([\d.]+(?:,\d{1,2})?)(?:.*?(?:sinal|entrada)\D*([\d.]+(?:,\d{1,2})?))?/i);
    if (!m || !m[1].trim()) continue;
    const num = (v) => (v ? Number(v.replace(/\./g, '').replace(',', '.')) : null);
    lidos.push({ nome: m[1].trim().slice(0, 80), preco: num(m[2]), sinal: num(m[3]), trecho: linha.slice(0, 160) });
  }
  const fotos = l.entrada.imagens || [];
  const grupos = Math.max(lidos.length, Math.ceil(fotos.length / 2));
  const porGrupo = grupos ? Math.max(1, Math.ceil(fotos.length / grupos)) : 0;
  const kits = [];
  for (let g = 0; g < grupos; g++) {
    const t = lidos[g];
    const fs = fotos.slice(g * porGrupo, g * porGrupo + porGrupo).slice(0, 5).map((f) => f.url);
    if (!t && !fs.length) continue;
    kits.push({ id: 'k' + (g + 1), nome: t ? t.nome : null, preco: t ? t.preco : null, sinal: t ? t.sinal : null, pecas: [], variacoes: [],
      fotos: fs, fotos_todas: fs, existe: t && D().kits.find((k) => k.nome.toLowerCase() === t.nome.toLowerCase()) ? t.nome : null,
      origem: { nome: t ? 'lista de preços' : null, ligacao: t && fs.length ? 'simulação da demonstração' : null, preco: t ? 'lista de preços' : null, trecho: t ? t.trecho : null } });
  }
  const todos = !l.teste || kits.length <= 10;
  kits.forEach((k) => { k.situacao = todos ? 'conferir' : 'guardado'; });
  l.escolher = todos ? 0 : 10;
  l.kits = kits; l.status = kits.length ? 'pronto' : 'erro';
  if (!kits.length) l.erro = 'Na demonstração, escreva na lista linhas como "Kit Safari R$ 350 sinal 100" ou mande fotos.';
  delete l.entrada;
  demoSalvar();
}
function demoIaLiberar() {
  if (demoIaPlano() !== 'pago') return;
  for (const l of demoIa().lotes) { l.escolher = 0; for (const k of l.kits || []) if (k.situacao === 'guardado') { k.situacao = 'conferir'; k.liberado = true; if (l.status === 'fechado') l.status = 'pronto'; } }
}
// Chama uma função do servidor (manda o login, se houver). Usada pelo checkout.
export async function chamarFuncao(nome, corpo) {
  if (MODO_DEMO) return demoPagamento(corpo);
  const s = await cliente();
  const { data } = await s.auth.getSession();
  const tk = data.session && data.session.access_token;
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/functions/v1/${nome}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${tk || SUPABASE_ANON_KEY}` },
      body: JSON.stringify(corpo),
    });
  } catch (e) { throw new Error('Sem conexão. Confira a internet e tente de novo.'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.erro) throw new Error(d.erro || 'Não deu certo agora. Tente de novo em instantes.');
  return d;
}
// Checkout na demonstração: Pix "pago" depois de 2 consultas; cartão 4000... recusado
function demoPagamento(c) {
  const parc = (v) => { const l = [{ n: 1, parcela: v, total: v }]; for (let n = 2; n <= 12; n++) { const p = Math.ceil((v * 0.0347) / (1 - Math.pow(1.0347, -n))); l.push({ n, parcela: p, total: p * n }); } return l; };
  if (c.acao === 'planos') return { ativo: true, planos: { mensal: { valor: 2990 }, anual: { valor: 16700, de: 35880 } }, parcelas: parc(16700) };
  const vence = new Date(Date.now() + (c.plano === 'mensal' ? 30 : 365) * 864e5).toISOString();
  if (c.acao === 'pagar' && c.metodo === 'pix') { demoPagamento.voltas = 0; return { id: 'demo-pix', status: 'pendente', valor: c.plano === 'mensal' ? 2990 : 16700, pix: { codigo: '00020126580014br.gov.bcb.pix0136demo-pegue-e-monte-5204000053039865802BR', url: null, vence } }; }
  if (c.acao === 'pagar') return c.card_token === 'token_ok' ? { id: 'demo-cartao', status: 'pago', vence_em: vence } : { id: 'demo-cartao', status: 'recusado', mensagem: 'Cartão recusado pelo banco. Confira os dados, tente outro cartão ou pague com Pix, que libera na hora.' };
  if (c.acao === 'status') { demoPagamento.voltas = (demoPagamento.voltas || 0) + 1; return demoPagamento.voltas >= 2 ? { status: 'pago', vence_em: vence } : { status: 'pendente' }; }
  return {};
}
async function chamarFuncaoIA(corpo, bruto = false) {
  const s = await cliente();
  const { data } = await s.auth.getSession();
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/functions/v1/catalogo-ia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session && data.session.access_token}`, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify(lojaSuporteDaAba() ? { ...corpo, loja: lojaSuporteDaAba() } : corpo),
    });
  } catch (e) { throw new Error('Sem conexão. Confira a internet e tente de novo.'); }
  if (bruto && r.ok) return r;
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.erro) throw new Error(d.erro || 'A IA não respondeu agora. Tente de novo em instantes.');
  return d;
}
export async function iaSituacao() {
  if (MODO_DEMO) {
    if (DEMO_SITE) return { disponivel: false };
    const ia = demoIa(); const plano = demoIaPlano();
    demoIaLiberar(); ia.lotes.forEach(demoIaConcluir);
    const kits = ia.lotes.filter((l) => l.status === 'pronto').flatMap((l) => l.kits || []);
    const aberto = [...ia.lotes].reverse().find((l) => l.status === 'pronto' && (l.escolher > 0 || (l.kits || []).some((k) => ['conferir', 'aprovado'].includes(k.situacao))));
    const escolher = [...ia.lotes].reverse().find((l) => l.status === 'pronto' && l.escolher > 0);
    const proc = ia.lotes.find((l) => l.status === 'processando');
    const ultErro = [...ia.lotes].reverse().find((l) => l.status === 'erro' && Date.now() - l.criado < 1800e3);
    return { disponivel: plano !== 'bloqueado', plano, limite: IA_LIMITE_TESTE, restante: plano === 'teste' ? Math.max(0, IA_LIMITE_TESTE - ia.usados) : null,
      limite_por_envio: 10, escolher: escolher ? escolher.id : null,
      processando: proc ? proc.id : null, lote: aberto ? aberto.id : null,
      pendentes: kits.filter((k) => ['conferir', 'aprovado'].includes(k.situacao)).length,
      liberados: kits.filter((k) => k.situacao === 'conferir' && k.liberado).length,
      guardados: ia.lotes.flatMap((l) => l.kits || []).filter((k) => k.situacao === 'guardado').length,
      erro: ultErro ? ultErro.erro : null };
  }
  const s = await cliente();
  return ok(s.rpc('ia_situacao'));
}
export async function iaLote(id) {
  if (MODO_DEMO) {
    const l = demoIa().lotes.find((x) => x.id === id);
    if (!l) throw new Error('Envio não encontrado');
    demoIaLiberar(); demoIaConcluir(l);
    const pago = demoIaPlano() === 'pago';
    return { id: l.id, status: l.status, erro: l.erro || null, teste: l.teste, escolher: pago ? 0 : l.escolher || 0,
      kits: (l.kits || []).map((k) => (k.situacao === 'guardado' && !pago ? { situacao: 'guardado', nome: k.nome, foto: (k.fotos || [])[0] || null, recorte: (k.recortes || [])[0] || null } : JSON.parse(JSON.stringify(k)))) };
  }
  const s = await cliente();
  return ok(s.rpc('ia_lote', { p_id: id }));
}
export async function iaSalvar(id, kits) {
  if (MODO_DEMO) {
    const l = demoIa().lotes.find((x) => x.id === id);
    const ia = demoIa(); const teste = demoIaPlano() === 'teste';
    let cabe = teste ? Math.max(0, IA_LIMITE_TESTE - ia.usados) : Infinity, publicou = 0;
    l.kits = l.kits.map((k, i) => {
      if (['guardado', 'publicado'].includes(k.situacao) || !kits[i]) return k;
      let sit = ['conferir', 'aprovado', 'descartado', 'publicado'].includes(kits[i].situacao) || (kits[i].situacao === 'guardado' && teste) ? kits[i].situacao : k.situacao;
      if (sit === 'publicado' && teste) { if (publicou >= cabe) sit = 'aprovado'; else publicou++; }
      return { ...k, ...kits[i], situacao: sit, fotos: (kits[i].fotos || []).filter((f) => (k.fotos_todas || []).includes(f) || String(f).startsWith('data:')).slice(0, 30) };
    });
    ia.usados += publicou;
    if (!l.kits.some((k) => ['conferir', 'aprovado', 'guardado'].includes(k.situacao))) l.status = 'fechado';
    demoSalvar(); return { ok: true };
  }
  const s = await cliente();
  return ok(s.rpc('ia_salvar', { p_id: id, p_kits: kits }));
}
// Envia uma imagem já reduzida para a pasta do envio (fotos dos kits e miniaturas para a IA ler).
export async function iaEnviarImagem(blob, pasta, nome) {
  if (MODO_DEMO) return new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  const s = await cliente();
  const { data: u } = await s.auth.getUser();
  const caminho = `${u.user.id}/ia/${pasta}/${nome}.jpg`;
  await ok(s.storage.from('fotos').upload(caminho, blob, { contentType: 'image/jpeg', upsert: false }));
  return s.storage.from('fotos').getPublicUrl(caminho).data.publicUrl;
}
export async function iaEscolher(id, posicoes) {
  if (MODO_DEMO) {
    const ia = demoIa(); const l = ia.lotes.find((x) => x.id === id);
    const cabe = Math.min(l.escolher || 0, 10);
    if (!posicoes.length) throw new Error('Escolha pelo menos 1 kit');
    if (posicoes.length > cabe) throw new Error(`No teste grátis você pode escolher até ${cabe} kits`);
    let n = 0;
    l.kits.forEach((k, i) => { if (k.situacao === 'guardado' && posicoes.includes(i)) { k.situacao = 'conferir'; n++; } });
    l.escolher = 0; demoSalvar();
    return { ok: true, escolhidos: n };
  }
  const s = await cliente();
  return ok(s.rpc('ia_escolher', { p_id: id, p_posicoes: posicoes }));
}
export async function iaOrganizar(material) {
  if (MODO_DEMO) {
    const ia = demoIa(); const plano = demoIaPlano();
    if (plano === 'bloqueado') throw new Error('Sua assinatura não está ativa. Assine para usar a IA.');
    if (ia.lotes.some((l) => l.status === 'processando')) throw new Error('A IA ainda está organizando o seu último envio. Espere terminar.');
    const l = { id: uid(), status: 'processando', criado: Date.now(), teste: plano === 'teste', kits: [],
      entrada: { texto: material.texto, paginas: (material.paginas || []).map((p) => ({ texto: p.texto })), imagens: (material.imagens || []).map((f) => ({ url: f.url })) } };
    ia.lotes.push(l);
    ia.lotes = ia.lotes.slice(-6);
    demoSalvar();
    return { lote: l.id };
  }
  return chamarFuncaoIA({ acao: 'organizar', ...material });
}
export async function iaDriveListar(link) {
  if (MODO_DEMO) throw new Error('Na demonstração o Google Drive não é lido. Na versão real, sim.');
  return (await chamarFuncaoIA({ acao: 'drive_listar', link })).arquivos || [];
}
export async function iaDriveBaixar(id) {
  const r = await chamarFuncaoIA({ acao: 'drive_baixar', id }, true);
  const nome = decodeURIComponent(r.headers.get('X-Nome') || '');
  return { blob: await r.blob(), nome };
}
export function demoIaZerar() { const d = D(); d.ia = { usados: 0, lotes: [] }; demoSalvar(); }
// Link na bio do Instagram: a dona marca que já colocou (usado nos lembretes)
export async function marcarLinkBio() {
  const agora = new Date().toISOString();
  if (MODO_DEMO) { D().negocio.link_bio_em = agora; demoSalvar(); return; }
  const s = await cliente();
  const atual = await meuNegocio();
  if (!atual) return;
  await ok(s.from('negocios').update({ link_bio_em: agora }).eq('id', atual.id));
}

// ---------- Montagem da loja (oferta do anual) e mensagens do administrador ----------
export async function registrarOfertaMontagem() {
  if (MODO_DEMO) return;
  const s = await cliente();
  await s.rpc('registrar_oferta_montagem');
}
export async function minhaMontagem() {
  if (MODO_DEMO) return null;
  const s = await cliente();
  return ok(s.rpc('minha_montagem'));
}
export async function montagemPedida() {
  if (MODO_DEMO) return;
  const s = await cliente();
  await s.rpc('montagem_pedida');
}
export async function minhasMensagens() {
  if (MODO_DEMO) return [];
  const s = await cliente();
  return ok(s.rpc('minhas_mensagens'));
}
export async function marcarMensagem(id, acao) {
  if (MODO_DEMO) return;
  const s = await cliente();
  await s.rpc('marcar_mensagem', { p_id: id, p_acao: acao });
}
export async function adminCriarMensagem(dados, emails) {
  if (MODO_DEMO) return { id: 1, pessoas: emails.length };
  const s = await cliente();
  return ok(s.rpc('admin_criar_mensagem', { p_dados: dados, p_emails: emails }));
}
export async function adminMensagens() {
  if (MODO_DEMO) return [];
  const s = await cliente();
  return ok(s.rpc('admin_mensagens'));
}
export async function adminMudarMensagem(id, status) {
  if (MODO_DEMO) return;
  const s = await cliente();
  return ok(s.rpc('admin_mudar_mensagem', { p_id: id, p_status: status }));
}
export async function adminFunilQuiz(pagina, dias, anuncio) {
  if (MODO_DEMO) {
    const base = { abriu: 412, comecou: 301, p1: 288, p2: 280, p3: 271, p4: 266, p5: 259, p6: 252, p7: 248, concluiu: 246, video: 240, som: 171, v25: 150, v50: 121, v75: 98, botao: 92, video_fim: 64, planos: 58, checkout_anual: 21, checkout_mensal: 9, whatsapp: 4 };
    return { etapas: base, respostas: [{ etapa: 'p2', detalhe: 'De 6 a 15 kits', n: 120 }, { etapa: 'p2', detalhe: 'De 1 a 5 kits', n: 90 }], anuncios: [{ anuncio: 'Video Teste_01', abriu: 260, concluiu: 160, som: 110, planos: 40, checkout: 22 }, { anuncio: '(sem anúncio)', abriu: 152, concluiu: 86, som: 61, planos: 18, checkout: 8 }] };
  }
  const s = await cliente();
  return ok(s.rpc('admin_funil_quiz', { p_pagina: pagina, p_dias: dias, p_anuncio: anuncio || null }));
}
export async function adminIaResultados(dias) {
  if (MODO_DEMO) {
    const agora = Date.now();
    return { liberado_para: 'todos', usaram: 48, envios: 71, erros: 3, kits_encontrados: 612, publicaram: 37, kits_publicados: 402, ja_assinantes: 6, assinaram_depois: 9, podiam_assinar: 31, custo_usd: 18.4,
      contas_com_ia: 31, contas_com_ia_assinaram: 9, contas_sem_ia: 64, contas_sem_ia_assinaram: 5,
      lojas: [['Festas da Ana', 12, 'assinou'], ['Doce Festa Kits', 5, 'nao'], ['Mundo Pegue e Monte', 23, 'ja_era'], ['Kits da Ju', 5, 'assinou'], ['Encanto Festas', 4, 'nao']]
        .map(([loja, kits, situacao], i) => ({ loja, kits, situacao, quando: new Date(agora - i * 7e6).toISOString() })) };
  }
  const s = await cliente();
  return ok(s.rpc('admin_ia_resultados', { p_dias: dias || 0 }));
}
export async function adminMontagens() {
  if (MODO_DEMO) return [];
  const s = await cliente();
  return ok(s.rpc('admin_montagens'));
}
export async function adminMontagemMarcar(id, campo) {
  if (MODO_DEMO) return;
  const s = await cliente();
  return ok(s.rpc('admin_montagem_marcar', { p_id: id, p_campo: campo }));
}
export async function adminEmails(dias) {
  if (MODO_DEMO) return { pausados: false, descadastros: 0, modelos: [], tipos: [] };
  const s = await cliente();
  return ok(s.rpc('admin_emails', { p_dias: dias }));
}
export async function adminSalvarEmailModelo(tipo, assunto, texto, botao) {
  if (MODO_DEMO) return;
  const s = await cliente();
  return ok(s.rpc('admin_salvar_email_modelo', { p_tipo: tipo, p_assunto: assunto, p_texto: texto, p_botao: botao }));
}
export async function adminEmailsPausar(pausar) {
  if (MODO_DEMO) return;
  const s = await cliente();
  return ok(s.rpc('admin_emails_pausar', { p_pausar: pausar }));
}
async function chamarFuncaoEmails(corpo) {
  if (MODO_DEMO) throw new Error('Na demonstração os e-mails não são enviados.');
  const s = await cliente();
  const { data } = await s.auth.getSession();
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/functions/v1/emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session && data.session.access_token}`, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify(corpo),
    });
  } catch (e) { throw new Error('A função "emails" ainda não está no ar no Supabase.'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.erro) throw new Error(d.erro || 'A função "emails" ainda não está no ar no Supabase.');
  return d;
}
export function adminEmailTeste(tipo) { return chamarFuncaoEmails({ teste: tipo }); }
export function adminPreviaEmail(tipo) { return chamarFuncaoEmails({ previa: tipo }); }

// =====================================================================
// Painel do administrador (só funciona para e-mails da tabela
// "administradores"; o banco recusa qualquer outra pessoa)
// =====================================================================
function demoAdmin() {
  const dias = (n) => new Date(Date.now() - n * 864e5).toISOString();
  const mes = (n) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 7); };
  const clientes = [
    { email: 'maria@festasdamaria.com', nome: 'Maria Souza', telefone: '5511987654321', situacao: 'ativa', status: 'ativa', plano: 'anual', tem_conta: true, negocio: 'Festas da Maria', slug: 'festas-da-maria', kits: 6, reservas: 23, total_pago: 269, primeira_compra: dias(40), ultimo_acesso: dias(0), ultimo_aviso: dias(40), ultimo_aviso_evento: 'purchase_approved' },
    { email: 'julia.kits@gmail.com', nome: 'Júlia Andrade', telefone: '5521998877665', situacao: 'ativa', status: 'ativa', plano: 'mensal', tem_conta: true, negocio: 'Ju Pegue e Monte', slug: 'ju-pegue-e-monte', kits: 3, reservas: 9, total_pago: 59.8, primeira_compra: dias(35), ultimo_acesso: dias(1), ultimo_aviso: dias(4), ultimo_aviso_evento: 'subscription_renewed' },
    { email: 'carla.decor@hotmail.com', nome: 'Carla Lima', telefone: '5531991234567', situacao: 'carencia', status: 'carencia', plano: 'mensal', carencia_ate: new Date(Date.now() + 30 * 36e5).toISOString(), tem_conta: true, negocio: 'Carla Decor', slug: 'carla-decor', kits: 4, reservas: 5, total_pago: 29.9, primeira_compra: dias(31), ultimo_acesso: dias(2), ultimo_aviso: dias(0), ultimo_aviso_evento: 'subscription_renewal_refused' },
    { email: 'bia.festas@gmail.com', nome: 'Beatriz Rocha', telefone: '5541988880000', situacao: 'ativa', status: 'ativa', plano: 'mensal', tem_conta: false, kits: 0, reservas: 0, total_pago: 29.9, primeira_compra: dias(0), ultimo_aviso: dias(0), ultimo_aviso_evento: 'purchase_approved' },
    { email: 'renata.m@gmail.com', nome: 'Renata Melo', telefone: '5551977776666', situacao: 'cancelada', status: 'cancelada', plano: 'mensal', tem_conta: true, negocio: 'Renata Festas', slug: 'renata-festas', kits: 1, reservas: 0, total_pago: 29.9, primeira_compra: dias(50), ultimo_acesso: dias(20), ultimo_aviso: dias(19), ultimo_aviso_evento: 'subscription_canceled' },
    { email: 'lia.festinhas@gmail.com', nome: 'Lia Martins', telefone: '5511955554444', situacao: 'lead', tem_conta: false, kits: 0, reservas: 0, total_pago: 0, ultimo_aviso: dias(1), ultimo_aviso_evento: 'checkout_abandonment' },
    { email: 'paty.kits@gmail.com', nome: null, telefone: null, situacao: 'lead', tem_conta: true, negocio: 'Paty Kits', slug: 'paty-kits', kits: 2, reservas: 0, total_pago: 0, conta_criada_em: dias(3), ultimo_acesso: dias(3) },
    { email: 'aline.kits@gmail.com', nome: 'Aline Prado', telefone: '5551988887777', situacao: 'teste', status: 'teste', teste_inicio: dias(3), teste_ate: new Date(Date.now() + 4 * 864e5).toISOString(), tem_conta: true, negocio: 'Aline Kits', slug: 'aline-kits', kits: 5, reservas: 2, total_pago: 0, ultimo_acesso: dias(0), ultimo_aviso: dias(3), ultimo_aviso_evento: 'teste_automatico', link_copiado_em: null, origem: { utm_source: 'meta', utm_campaign: 'teste-gratis-novembro', utm_medium: 'decoradoras-sul', utm_content: 'carrossel-telas' } },
    { email: 'paty.decor@gmail.com', nome: null, telefone: '5551988776655', situacao: 'teste', status: 'teste', teste_inicio: dias(2), teste_ate: new Date(Date.now() + 5 * 864e5).toISOString(), tem_conta: true, negocio: 'Paty Decorações', slug: 'paty-decoracoes', kits: 0, reservas: 0, total_pago: 0, ultimo_acesso: dias(2), ultimo_aviso: dias(2), ultimo_aviso_evento: 'teste_automatico', origem: { utm_source: 'meta', utm_campaign: 'teste-gratis-novembro', utm_medium: 'decoradoras-sul', utm_content: 'video-gancho-01' } },
    { email: 'sol.festas@gmail.com', nome: 'Sol Ribeiro', telefone: '5551933332222', situacao: 'teste_encerrado', status: 'teste', teste_inicio: dias(9), teste_ate: dias(2), tem_conta: true, negocio: 'Sol Festas', slug: 'sol-festas', kits: 2, reservas: 1, total_pago: 0, ultimo_acesso: dias(2), ultimo_aviso: dias(9), ultimo_aviso_evento: 'admin_teste' },
    { email: 'demo@exemplo.com', nome: null, situacao: 'cortesia', cortesia: true, tem_conta: true, negocio: 'Festas da Maria (teste)', slug: 'demo', kits: 3, reservas: 4, total_pago: 0, ultimo_acesso: dias(0) },
  ];
  const eventos = clientes.filter((c) => c.ultimo_aviso).map((c) => ({
    recebido_em: c.ultimo_aviso, evento: c.ultimo_aviso_evento, email: c.email, nome: c.nome, telefone: c.telefone, plano: c.plano,
    valor: c.ultimo_aviso_evento === 'purchase_approved' || c.ultimo_aviso_evento === 'subscription_renewed' ? (c.plano === 'anual' ? 269 : 29.9) : null,
  })).sort((a, b) => b.recebido_em.localeCompare(a.recebido_em));
  const resumo = {
    ativas: 3, ativas_mensal: 2, ativas_anual: 1, ativas_manual: 0, carencia: 1, canceladas: 1, suspensas: 0, cortesias: 1,
    receita_mensal_estimada: 82.22,
    teste: { em_teste: 1, encerrados: 1, convertidos: 1, total: 3 },
    mes: { vendas: 2, renovacoes: 1, recuperadas: 0, falhas: 1, cancelamentos: 0, reembolsos: 0, faturamento: 328.8, contas_novas: 3 },
    contas: 6, contas_usando: 5, reservas_mes: 18,
    historico: [5, 4, 3, 2, 1, 0].map((n, i) => ({ mes: mes(n), vendas: [0, 0, 0, 1, 2, 2][i], renovacoes: [0, 0, 0, 0, 1, 1][i], cancelamentos: [0, 0, 0, 0, 1, 0][i], faturamento: [0, 0, 0, 29.9, 328.8, 328.8][i] })),
  };
  return { clientes, eventos, resumo };
}
// Painel: pagamentos, vendas, renovações, assinantes e tempo do teste até assinar (SQL 23)
export async function adminPainel() {
  if (MODO_DEMO) return demoPainel();
  const s = await cliente();
  return ok(s.rpc('admin_painel'));
}
export async function adminMensagemAlvos(id) {
  if (MODO_DEMO) return [{ email: 'cliente1@exemplo.com', loja: 'Festas da Lu', viu_em: new Date().toISOString(), clicou_em: null, fechou_em: new Date().toISOString() }, { email: 'cliente2@exemplo.com', loja: 'Doce Decor', viu_em: null, clicou_em: null, fechou_em: null }];
  const s = await cliente();
  return ok(s.rpc('admin_mensagem_alvos', { p_id: id }));
}
function demoPainel() {
  const dia = 864e5, agora = Date.now(), pg = [];
  const nomes = ['Ana Souza', 'Bia Melo', 'Carla Reis', 'Dani Faria', 'Elis Torres', 'Fernanda Lima', 'Gabi Rocha', 'Helo Dias'];
  for (let i = 0; i < 90; i++) {
    const q = new Date(agora - (i * 0.37 + (i % 3) * 0.11) * dia).toISOString();
    const pl = i % 3 === 0 ? 'mensal' : 'anual', fo = i % 2 ? 'cartao' : 'pix';
    const st = i % 11 === 4 ? 'recusado' : i % 13 === 6 ? 'pix_pendente' : i % 17 === 8 ? 'pendente' : i % 29 === 9 ? 'cancelado' : 'pago';
    const b = pl === 'anual' ? 167 : 29.9;
    const n = nomes[i % nomes.length];
    pg.push({ q, st, ev: st === 'pago' ? (i % 4 === 1 ? 'subscription_renewed' : 'purchase_approved') : st === 'recusado' ? 'purchase_refused' : st === 'pix_pendente' ? 'pix_gerado' : st === 'pendente' ? 'subscription_late' : 'refund',
      tp: st === 'pago' ? (i % 4 === 1 ? 'renovacao' : 'nova') : null, pl, fo: st === 'pix_pendente' ? 'pix' : fo, b, l: st === 'pago' ? Math.round(b * 0.93 * 100) / 100 : null,
      em: n.split(' ')[0].toLowerCase() + i + '@exemplo.com', no: n });
  }
  const meses = [];
  for (let k = 11; k >= 0; k--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - k);
    const f = 12 - k;
    meses.push({ mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, bruto: k > 6 ? 0 : 900 * f, liquido: k > 6 ? 0 : 840 * f, ativos: k > 6 ? 0 : 14 * f, contas_novas: 20 + 9 * f });
  }
  const testes = [];
  for (let i = 0; i < 60; i++) testes.push({ t: new Date(agora - i * 0.5 * dia).toISOString(), a: i % 3 === 0 });
  return { agora: new Date().toISOString(), pagamentos: pg, ativas: { total: 142, anual: 96, mensal: 46, pix: 58, cartao: 84, manual: 2 },
    teste_ate_assinar: { total: 40, media: 2.4, mesmo_dia: 14, d1_3: 16, d4_7: 8, depois: 2 }, testes, meses };
}
export async function adminCancelarCakto() {
  if (MODO_DEMO) return [{ email: 'bia@exemplo.com', nome: 'Bia Melo', quando: new Date().toISOString(), plano: 'anual' }];
  const s = await cliente();
  return ok(s.rpc('admin_cancelar_cakto'));
}
export async function adminCaktoCancelado(email) {
  if (MODO_DEMO) return { ok: true };
  const s = await cliente();
  return ok(s.rpc('admin_cakto_cancelado', { p_email: email }));
}
export async function adminResumo() {
  if (MODO_DEMO) return demoAdmin().resumo;
  const s = await cliente();
  return ok(s.rpc('admin_resumo'));
}
// ---------- CRM do teste grátis ----------
function demoCrm() {
  const lojas = ['Festas da Lu', 'Doce Decor', 'Ateliê Mimos', 'Brilho Kids', 'Pegue & Decore', 'Encanto Festas', 'Sonho de Festa',
    'Kids Pegue&Monte', 'Festa Fácil', 'Arte em Festa', 'Pegue Já', 'Mini Mesa Chic', 'Bella Festa', 'Mundo Kids', 'Decora Mais',
    'Festa na Caixa', 'Lá em Casa Festas', 'Toque de Festa', 'Mesa Posta', 'Cia da Festa', 'Ateliê Bia', 'Pequenos Momentos',
    'Casa da Festa', 'Festejar', 'Mimo Kids', 'Encantar', 'Doce Mesa', 'Kit & Festa', 'Rosa Chá', 'Pegue Fest', 'Festinha Boa',
    'Viva Festas', 'Sorrir Festas', 'Mesa de Sonho', 'Alegria Kits', 'Decor da Ju', 'Festa Linda', 'Nuvem Kids', 'Brincar Festas', 'Céu Azul Kits'];
  const camp = ['CJ_MULHERES_VIDEOS', 'CJ_MULHERES_IMAGENS', null];
  const dia = 864e5, agora = Date.now();
  // etapa e dias desde o início de cada pessoa (fixos para a demonstração ficar estável)
  const plano = [[2,1],[2,4],[3,3],[1,1],[2,6],[3,2],[4,5],[5,6],[5,6],[6,5],[7,6],[1,3],[2,2],[3,4],[4,3],
    [2,9],[1,10],[3,12],[2,15],[4,11],[5,9],[3,20],[2,18],[6,14],[7,16],[4,22],[1,25],[3,13],[5,17],[6,21],[2,26],[7,24],[3,9],[4,27],[1,12],[6,10],[2,28],[5,23],[3,29],[7,19]];
  return plano.map(([etapa, d], i) => {
    const ini = agora - d * dia - (i % 5) * 3600e3;
    const fim = ini + 7 * dia;
    const acabou = fim < agora;
    const assinou = acabou ? (etapa >= 6 ? i % 3 !== 0 : etapa >= 4 ? i % 3 === 0 : false) : (etapa === 7 && i % 2 === 0);
    const semUso = [0, 0, 1, 2, 4, 0, 3, 1, 0, 0, 0, 5, 2, 1, 0][i % 15];
    return {
      email: `cliente${i + 1}@exemplo.com`, telefone: `5199${String(1000000 + i * 7919).slice(0, 7)}`,
      status: assinou ? 'ativa' : 'teste', plano: assinou ? (i % 2 ? 'mensal' : 'anual') : null,
      teste_inicio: new Date(ini).toISOString(), teste_ate: new Date(fim).toISOString(),
      campanha: camp[i % 3], fonte: camp[i % 3] ? 'FB' : null,
      assinou_em: assinou ? new Date(Math.min(agora, fim - dia)).toISOString() : null, etapa_na_assinatura: assinou ? etapa : null,
      conta_em: new Date(ini).toISOString(), negocio_id: etapa >= 2 ? `n${i}` : null, loja: etapa >= 2 ? lojas[i] : null,
      slug: etapa >= 2 ? `loja-${i}` : null, loja_em: etapa >= 2 ? new Date(ini + 3600e3).toISOString() : null,
      link_copiado_em: etapa >= 5 ? new Date(ini + 2 * dia).toISOString() : null,
      ultimo_uso: new Date(Math.min(agora, acabou ? ini + Math.min(6, (i % 7) + 1) * dia : agora - semUso * dia)).toISOString(),
      kits: etapa >= 3 ? (etapa >= 4 ? 2 + (i % 5) : 1) : 0, kits_foto: etapa >= 4 ? 2 + (i % 4) : 0,
      primeiro_kit_em: etapa >= 3 ? new Date(ini + (0.3 + (i % 4) * 0.6) * dia).toISOString() : null,
      reservas: etapa >= 6 ? 1 + (i % 5) : etapa >= 3 ? i % 2 : 0,
      primeira_reserva_real_em: etapa >= 6 ? new Date(ini + 3 * dia).toISOString() : null,
      visitas: etapa >= 5 ? 6 + (i * 3) % 40 : 0, visitas_instagram: etapa >= 5 && i % 3 !== 1 ? 2 + (i * 5) % 20 : 0,
      etapa,
      ...demoInteracoes(i, ini, etapa, assinou),
    };
  });
}
function demoInteracoes(i, ini, etapa, assinou) {
  const dia = 864e5, l = [];
  const add = (popup, acao, detalhe, d) => { if (ini + d * dia < Date.now()) l.push({ popup, acao, detalhe, quando: new Date(ini + d * dia).toISOString() }); };
  if (i % 4 !== 3) { add('promo_dia2', 'viu', null, 1.1); add('promo_dia2', i % 3 ? 'fechou' : 'olhou_10s', null, 1.12); }
  if (etapa >= 4 && i % 2 === 0) { add('assinar_agora', 'viu', null, 3.5); add('assinar_agora', 'olhou_10s', null, 3.51); }
  if ((etapa >= 5 && i % 3 !== 1) || assinou) add('assinar_agora', 'checkout', 'anual_promo', 3.52);
  if (etapa >= 6) add('comemoracao_link', 'viu', null, 3);
  l.sort((a, b) => b.quando.localeCompare(a.quando));
  const ck = l.find((x) => x.acao === 'checkout');
  return { interacoes: l, checkout_em: ck ? ck.quando : null };
}
export async function adminSaude() {
  if (MODO_DEMO) return demoSaude();
  const s = await cliente();
  return ok(s.rpc('admin_saude'));
}
function demoSaude() {
  const dia = 864e5, agora = Date.now();
  // [meses desde a 1ª compra, saiu depois de quantos meses (null = ativa), plano, recusas, recuperados]
  const base = [[5, null, 'mensal', 0, 0], [4, null, 'mensal', 1, 1], [4, 1, 'mensal', 1, 0], [3, null, 'anual', 0, 0], [3, null, 'mensal', 0, 0],
    [3, 2, 'mensal', 2, 1], [2, null, 'mensal', 0, 0], [2, null, 'mensal', 0, 0], [2, 1, 'mensal', 1, 0], [2, null, 'anual', 0, 0],
    [1, null, 'mensal', 0, 0], [1, null, 'mensal', 0, 0], [1, 0, 'mensal', 0, 0], [1, null, 'mensal', 1, 1], [1, null, 'anual', 0, 0],
    [0, null, 'mensal', 0, 0], [0, null, 'mensal', 0, 0], [0, null, 'anual', 0, 0], [5, 3, 'mensal', 1, 0], [4, null, 'mensal', 0, 0]];
  return base.map(([m, saiu, plano, rec, recup], i) => {
    const ini = agora - (m * 30.4 + 5 + i) * dia;
    const fimMeses = saiu == null ? m : saiu;
    const pag = plano === 'anual' ? 1 : fimMeses + 1;
    return {
      email: `assinante${i + 1}@exemplo.com`, primeira_compra: new Date(ini).toISOString(),
      ultimo_pagamento: new Date(ini + (pag - 1) * 30.4 * dia).toISOString(), pagamentos: pag, renovacoes: pag - 1,
      recusas: rec, recuperados: recup, saiu_em: saiu == null ? null : new Date(ini + (saiu * 30.4 + 20) * dia).toISOString(),
      total_liquido: plano === 'anual' ? 150.3 : pag * 27.41, plano, status: saiu == null ? 'ativa' : 'cancelada',
      teste_inicio: i % 3 ? new Date(ini - 6 * dia).toISOString() : null, etapa_na_assinatura: i % 3 ? [6, 5, 7, 4, 6][i % 5] : null, ativa: saiu == null,
    };
  });
}
export async function adminLogos() {
  if (MODO_DEMO) return { 'maria@festasdamaria.com': true };
  const s = await cliente();
  return ok(s.rpc('admin_logos'));
}
export async function adminEditarCliente(email, campos) {
  if (MODO_DEMO) throw new Error('Na demonstração não dá para alterar os dados de uma cliente.');
  const s = await cliente();
  return ok(s.rpc('admin_editar_cliente', {
    p_email: email, p_nome: campos.nome ?? null, p_email_novo: campos.email ?? null,
    p_telefone: campos.telefone ?? null, p_whatsapp_loja: campos.whatsapp_loja ?? null,
  }));
}
export async function adminHistoricoCliente(email) {
  if (MODO_DEMO) return [];
  const s = await cliente();
  return ok(s.rpc('admin_historico_cliente', { p_email: email }));
}
export async function adminCrmMensagens() {
  if (MODO_DEMO) { try { return JSON.parse(localStorage.getItem('apm-demo-crm-msgs') || '{}'); } catch (e) { return {}; } }
  const s = await cliente();
  return ok(s.rpc('admin_crm_mensagens'));
}
export async function adminSalvarMensagemCrm(etapa, texto) {
  if (MODO_DEMO) {
    let m = {};
    try { m = JSON.parse(localStorage.getItem('apm-demo-crm-msgs') || '{}'); } catch (e) { /* segue */ }
    if (String(texto || '').trim()) m[etapa] = String(texto).trim(); else delete m[etapa];
    try { localStorage.setItem('apm-demo-crm-msgs', JSON.stringify(m)); } catch (e) { /* segue */ }
    return { ok: true };
  }
  const s = await cliente();
  return ok(s.rpc('admin_salvar_mensagem_crm', { p_etapa: etapa, p_texto: texto || '' }));
}
export async function adminCrmContato(email, nota) {
  if (MODO_DEMO) {
    const k = 'apm-demo-crm-contatos';
    let m = {};
    try { m = JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) { /* segue */ }
    (m[email] = m[email] || []).unshift({ quando: new Date().toISOString(), nota: nota || null });
    try { localStorage.setItem(k, JSON.stringify(m)); } catch (e) { /* segue */ }
    return { ok: true };
  }
  const s = await cliente();
  return ok(s.rpc('admin_crm_contato', { p_email: email, p_nota: nota || '' }));
}
export async function adminCrm() {
  if (MODO_DEMO) {
    let m = {};
    try { m = JSON.parse(localStorage.getItem('apm-demo-crm-contatos') || '{}'); } catch (e) { /* segue */ }
    return demoCrm().map((p, i) => {
      const c = m[p.email] || (i === 1 ? [{ quando: new Date(Date.now() - 864e5).toISOString(), nota: 'Disse que manda as fotos à noite.' }] : []);
      return { ...p, whatsapp_loja: p.telefone, contatos: c, ultimo_contato_em: c[0] ? c[0].quando : null };
    });
  }
  const s = await cliente();
  return ok(s.rpc('admin_crm'));
}
export async function registrarInteracao(popup, acao, detalhe) {
  if (MODO_DEMO) return;
  const s = await cliente();
  await s.rpc('registrar_interacao', { p_popup: popup, p_acao: acao, p_detalhe: detalhe || null });
}
export async function adminPopups(dias) {
  if (MODO_DEMO) return demoPopups();
  const s = await cliente();
  return ok(s.rpc('admin_popups', { p_dias: Number(dias) || 0 }));
}
function demoPopups() {
  return [
    { popup: 'fim_teste', viram: 64, clicaram: 22, olharam: 30, fecharam: 31, checkout: 18, checkout_anual_promo: 13, checkout_anual: 0, checkout_mensal: 5, assinaram: 7 },
    { popup: 'promo_dia2', viram: 71, clicaram: 15, olharam: 24, fecharam: 56, checkout: 11, checkout_anual_promo: 11, checkout_anual: 0, checkout_mensal: 0, assinaram: 3 },
    { popup: 'assinar_agora', viram: 39, clicaram: 9, olharam: 21, fecharam: 27, checkout: 9, checkout_anual_promo: 6, checkout_anual: 0, checkout_mensal: 3, assinaram: 2 },
    { popup: 'aviso_promo', viram: 18, clicaram: 4, olharam: 9, fecharam: 12, checkout: 4, checkout_anual_promo: 4, checkout_anual: 0, checkout_mensal: 0, assinaram: 1 },
    { popup: 'comemoracao_link', viram: 10, clicaram: 4, olharam: 0, fecharam: 6, checkout: 3, checkout_anual_promo: 3, checkout_anual: 0, checkout_mensal: 0, assinaram: 2 },
    { popup: 'black_friday', viram: 8, clicaram: 3, olharam: 4, fecharam: 5, checkout: 3, checkout_anual_promo: 3, checkout_anual: 0, checkout_mensal: 0, assinaram: 0 },
  ];
}
export async function registrarUso() {
  if (MODO_DEMO) return;
  const s = await cliente();
  await s.rpc('registrar_uso');
}

export async function adminClientes() {
  if (MODO_DEMO) return demoAdmin().clientes;
  const s = await cliente();
  return ok(s.rpc('admin_clientes'));
}
export async function adminEventos(limite = 80) {
  if (MODO_DEMO) return demoAdmin().eventos;
  const s = await cliente();
  return ok(s.rpc('admin_eventos', { p_limite: limite }));
}
export async function adminLiberarTeste(email, dias = 7) {
  if (MODO_DEMO) return { ok: true, email, teste_ate: new Date(Date.now() + dias * 864e5).toISOString() };
  const s = await cliente();
  return ok(s.rpc('admin_liberar_teste', { p_email: email, p_dias: dias }));
}
export async function adminDefinirAcesso(email, liberar) {
  if (MODO_DEMO) return { ok: true, email, liberado: liberar };
  const s = await cliente();
  return ok(s.rpc('admin_definir_acesso', { p_email: email, p_liberar: liberar }));
}

// ---------- Contrato ----------
export async function contratoDaReserva(reservaId) {
  if (MODO_DEMO) return (D().contratos || []).find((c) => c.reserva_id === reservaId) || null;
  const s = await cliente();
  return ok(s.from('contratos').select('*').eq('reserva_id', reservaId).maybeSingle());
}
// Cria (ou atualiza, se ainda não foi aceito) o contrato da reserva com o texto já preenchido.
export async function gerarContrato(reserva, texto, pedeCpf) {
  if (MODO_DEMO) {
    D().contratos = D().contratos || [];
    let c = D().contratos.find((x) => x.reserva_id === reserva.id);
    if (!c) { c = { id: 'c' + Date.now(), reserva_id: reserva.id, token: 'demo' + Math.random().toString(36).slice(2) + 'xxxxxxxxxxxxxxxx', criado_em: new Date().toISOString() }; D().contratos.push(c); }
    if (!c.aceito_em) Object.assign(c, { texto, pede_cpf: pedeCpf });
    demoSalvar(); return c;
  }
  const s = await cliente();
  const atual = await contratoDaReserva(reserva.id);
  if (atual && atual.aceito_em) return atual;
  if (atual) return ok(s.from('contratos').update({ texto, pede_cpf: pedeCpf }).eq('id', atual.id).select().single());
  return ok(s.from('contratos').insert({ negocio_id: reserva.negocio_id, reserva_id: reserva.id, texto, pede_cpf: pedeCpf }).select().single());
}
export async function contratoPublico(token) {
  if (MODO_DEMO) {
    const c = (D().contratos || []).find((x) => x.token === token);
    if (!c) return null;
    const r = D().reservas.find((x) => x.id === c.reserva_id) || {};
    const k = D().kits.find((x) => x.id === r.kit_id) || {};
    return { ...c, loja: D().negocio.nome, logo_url: D().negocio.logo_url, whatsapp: D().negocio.whatsapp, kit: k.nome, retirada: r.data_retirada, cliente: r.cliente_nome };
  }
  const s = await cliente();
  return ok(s.rpc('contrato_publico', { p_token: token }));
}
export async function aceitarContrato(token, nome, cpf, endereco) {
  const agente = (navigator.userAgent || '').slice(0, 300);
  if (MODO_DEMO) {
    const c = (D().contratos || []).find((x) => x.token === token);
    if (!c) throw new Error('Contrato não encontrado');
    if (!/\S+\s+\S+/.test(nome.trim())) throw new Error('Digite seu nome completo');
    if (c.pede_cpf && cpf.replace(/\D/g, '').length !== 11) throw new Error('Digite um CPF válido (11 números)');
    if (c.pede_cpf && endereco.trim().length < 8) throw new Error('Digite seu endereço completo');
    Object.assign(c, { aceito_em: new Date().toISOString(), aceito_nome: nome.trim(), aceito_cpf: c.pede_cpf ? cpf : null, aceito_endereco: c.pede_cpf ? endereco.trim() : null });
    demoSalvar(); return { ok: true };
  }
  const s = await cliente();
  return ok(s.rpc('aceitar_contrato', { p_token: token, p_nome: nome, p_cpf: cpf, p_endereco: endereco, p_agente: agente }));
}

// ---------- Notificações do administrador ----------
export async function adminSalvarPush(endpoint) {
  if (MODO_DEMO) return 'demo-token';
  const s = await cliente();
  return ok(s.rpc('salvar_push', { p_endpoint: endpoint }));
}
export async function adminTestarPush() {
  if (MODO_DEMO) return { ok: true };
  const s = await cliente();
  return ok(s.rpc('admin_testar_push'));
}
export async function adminFinanceiro() {
  if (MODO_DEMO) return { mes_bruto: 328.8, mes_liquido: 301.4, total_bruto: 627.7, total_liquido: 575.2, mensal_estimado_liquido: 74.9, taxas_configuradas: true, migraram_anual: 1 };
  const s = await cliente();
  return ok(s.rpc('admin_financeiro'));
}
export async function adminTaxas() {
  if (MODO_DEMO) return [{ forma: 'pix', percentual: 3.99, fixo: 2.49 }, { forma: 'pix_auto', percentual: 3.99, fixo: 2.49 }, { forma: 'credit_card', percentual: 4.99, fixo: 2.49 }, { forma: 'boleto', percentual: 3.99, fixo: 2.49 }, { forma: 'outro', percentual: 4.99, fixo: 2.49 }];
  const s = await cliente();
  return ok(s.rpc('admin_taxas'));
}
export async function adminDefinirTaxa(forma, percentual, fixo) {
  if (MODO_DEMO) return { ok: true };
  const s = await cliente();
  return ok(s.rpc('admin_definir_taxa', { p_forma: forma, p_percentual: percentual, p_fixo: fixo }));
}
