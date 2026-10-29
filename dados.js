// =====================================================================
// Acesso aos dados. Funciona de dois jeitos:
// - Com o Supabase configurado em config.js: dados reais.
// - Sem configurar: MODO DEMONSTRAÇÃO, com dados de exemplo guardados
//   só neste navegador. Serve para ver e testar o app antes de tudo.
// =====================================================================
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=20261029b';

export const MODO_DEMO = !/^https:\/\/.+\.supabase\.co\/?$/.test(SUPABASE_URL);

let sb = null;
async function cliente() {
  if (!sb) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return sb;
}

// Traduz erros técnicos para mensagens que a dona entende.
function erroAmigavel(e) {
  const msg = (e && (e.message || e.error_description)) || String(e);
  if (e && e.code === '23P01') return 'Esse kit já está reservado nesse período. Escolha outra data ou outro kit.';
  if (e && e.code === '23505' && msg.includes('slug')) return 'Esse link já está em uso. Escolha outro.';
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(msg)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/User already registered/i.test(msg)) return 'Esse e-mail já tem conta. Use "Entrar".';
  if (/Password should be/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
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

// =====================================================================
// MODO DEMONSTRAÇÃO
// =====================================================================
const CHAVE_DEMO = 'apm-demo-v1';
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
  return { negocio, kits, reservas, gastos, assinatura, logado: false };
}
function demoLer() {
  try { const s = localStorage.getItem(CHAVE_DEMO); if (s) return JSON.parse(s); } catch (e) { /* sem storage */ }
  return demoInicial();
}
let demo = null;
function D() { if (!demo) demo = demoLer(); return demo; }
function demoSalvar() { try { localStorage.setItem(CHAVE_DEMO, JSON.stringify(demo)); } catch (e) { /* ignora */ } }
function demoConflito(res, ignorarId) {
  return D().reservas.some((x) => x.id !== ignorarId && x.kit_id === res.kit_id && x.status !== 'cancelada'
    && cruza(x, res.data_retirada, res.data_devolucao));
}
export function demoReiniciar() { demo = demoInicial(); demo.logado = true; demoSalvar(); }

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
  if (MODO_DEMO) { D().logado = true; demoSalvar(); return { precisaConfirmar: false }; }
  const s = await cliente();
  const data = await ok(s.auth.signUp({ email, password: senha }));
  return { precisaConfirmar: !data.session };
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
  return ok(s.from('negocios').select('*').maybeSingle());
}
export async function linkDisponivel(slug) {
  if (MODO_DEMO) return true;
  const s = await cliente();
  return ok(s.rpc('link_disponivel', { p_slug: slug }));
}
export async function salvarNegocio(campos) {
  if (MODO_DEMO) { Object.assign(D().negocio, campos); demoSalvar(); return D().negocio; }
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
    const liberado = a.status === 'ativa' || (!!a.carencia_ate && a.carencia_ate > agora);
    return { email: 'demo@exemplo.com', cortesia: false, encontrada: true, ...a, liberado, admin: true, agora };
  }
  const s = await cliente();
  return ok(s.rpc('minha_assinatura'));
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
export async function enviarFoto(arquivo) {
  const blob = await reduzirImagem(arquivo, 1200, 0.82);
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
    if (demoConflito(res)) throw new Error(erroAmigavel({ code: '23P01' }));
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
    if (teste.status !== 'cancelada' && demoConflito(teste, id)) throw new Error(erroAmigavel({ code: '23P01' }));
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
export async function catalogoPublico(slug) {
  if (MODO_DEMO) {
    const n = D().negocio;
    if (slug !== n.slug) return null;
    return { nome: n.nome, whatsapp: n.whatsapp, chave_pix: n.chave_pix, logo_url: n.logo_url,
      dias_antes: n.dias_antes, dias_depois: n.dias_depois,
      kits: D().kits.filter((k) => k.ativo).map(({ id, nome, preco, sinal, foto_url }) => ({ id, nome, preco, sinal, foto_url })) };
  }
  const s = await cliente();
  return ok(s.rpc('catalogo_publico', { p_slug: slug }));
}
export async function datasOcupadas(slug, kitId, de, ate) {
  if (MODO_DEMO) {
    const n = D().negocio; const fora = [];
    for (let d = de; d <= ate; d = somaDias(d, 1)) {
      const ini = somaDias(d, -n.dias_antes); const fim = somaDias(d, n.dias_depois);
      if (D().reservas.some((r) => r.kit_id === kitId && r.status !== 'cancelada' && cruza(r, ini, fim))) fora.push(d);
    }
    return fora;
  }
  const s = await cliente();
  return ok(s.rpc('datas_ocupadas', { p_slug: slug, p_kit: kitId, p_de: de, p_ate: ate }));
}
export async function solicitarReserva(slug, kitId, dataFesta, nome, whatsapp) {
  if (MODO_DEMO) {
    const n = D().negocio; const k = D().kits.find((x) => x.id === kitId);
    const zap = String(whatsapp).replace(/\D/g, '');
    if (zap.length < 10) throw new Error('Informe um WhatsApp válido, com DDD');
    await criarReserva({ kit_id: kitId, data_festa: dataFesta, data_retirada: somaDias(dataFesta, -n.dias_antes),
      data_devolucao: somaDias(dataFesta, n.dias_depois), status: 'aguardando_sinal', origem: 'link',
      cliente_nome: nome.trim(), cliente_whatsapp: zap, valor_total: k.preco, valor_sinal: k.sinal })
      .catch(() => { throw new Error('Este kit acabou de ser reservado para essa data. Escolha outra data ou outro kit.'); });
    return { whatsapp: n.whatsapp, chave_pix: n.chave_pix, sinal: k.sinal, kit: k.nome };
  }
  const s = await cliente();
  return ok(s.rpc('solicitar_reserva', { p_slug: slug, p_kit: kitId, p_data_festa: dataFesta, p_nome: nome, p_whatsapp: whatsapp }));
}

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
    { email: 'demo@exemplo.com', nome: null, situacao: 'cortesia', cortesia: true, tem_conta: true, negocio: 'Festas da Maria (teste)', slug: 'demo', kits: 3, reservas: 4, total_pago: 0, ultimo_acesso: dias(0) },
  ];
  const eventos = clientes.filter((c) => c.ultimo_aviso).map((c) => ({
    recebido_em: c.ultimo_aviso, evento: c.ultimo_aviso_evento, email: c.email, nome: c.nome, telefone: c.telefone, plano: c.plano,
    valor: c.ultimo_aviso_evento === 'purchase_approved' || c.ultimo_aviso_evento === 'subscription_renewed' ? (c.plano === 'anual' ? 269 : 29.9) : null,
  })).sort((a, b) => b.recebido_em.localeCompare(a.recebido_em));
  const resumo = {
    ativas: 3, ativas_mensal: 2, ativas_anual: 1, ativas_manual: 0, carencia: 1, canceladas: 1, suspensas: 0, cortesias: 1,
    receita_mensal_estimada: 82.22,
    mes: { vendas: 2, renovacoes: 1, recuperadas: 0, falhas: 1, cancelamentos: 0, reembolsos: 0, faturamento: 328.8, contas_novas: 3 },
    contas: 6, contas_usando: 5, reservas_mes: 18,
    historico: [5, 4, 3, 2, 1, 0].map((n, i) => ({ mes: mes(n), vendas: [0, 0, 0, 1, 2, 2][i], renovacoes: [0, 0, 0, 0, 1, 1][i], cancelamentos: [0, 0, 0, 0, 1, 0][i], faturamento: [0, 0, 0, 29.9, 328.8, 328.8][i] })),
  };
  return { clientes, eventos, resumo };
}
export async function adminResumo() {
  if (MODO_DEMO) return demoAdmin().resumo;
  const s = await cliente();
  return ok(s.rpc('admin_resumo'));
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
export async function adminDefinirAcesso(email, liberar) {
  if (MODO_DEMO) return { ok: true, email, liberado: liberar };
  const s = await cliente();
  return ok(s.rpc('admin_definir_acesso', { p_email: email, p_liberar: liberar }));
}
