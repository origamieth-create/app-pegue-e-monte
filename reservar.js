// =====================================================================
// App Pegue e Monte — link público de reservas (a cliente final usa)
// Endereço: reservar.html?l=<link-do-negocio>
// =====================================================================
import * as dados from './dados.js?v=20261125a';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=20261121e';

// Demonstração do site: botões de WhatsApp mostram um aviso em vez de abrir conversa.
if (dados.DEMONSTRACAO_SITE) {
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href*="wa.me/"]');
    if (!a) return;
    e.preventDefault();
    const t = document.getElementById('toast');
    if (t) { t.textContent = 'Na versão real, o pedido chega direto no WhatsApp da loja'; t.classList.remove('oculto'); setTimeout(() => t.classList.add('oculto'), 3200); }
  }, true);
}

const { hojeISO, somaDias } = dados;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Foto inteira dentro de um quadro quadrado (sem cortar), com fundo desfocado.
function fotoCaixa(url, alt = '', lazy = false) {
  const u = String(url || '').replace(/["'()\\]/g, (c) => encodeURIComponent(c));
  return `<span class="foto-caixa" style="--fundo-foto:url('${u}')"><img src="${esc(url)}" alt="${esc(alt)}"${lazy ? ' loading="lazy"' : ''}></span>`;
}
// Fotos do kit (a primeira é a principal)
function fotosDe(k) {
  if (Array.isArray(k.fotos) && k.fotos.length) return k.fotos;
  return k.foto_url ? [k.foto_url] : [];
}
function galeria(fotos) {
  if (!fotos.length) return '';
  if (fotos.length === 1) return fotoCaixa(fotos[0]);
  return `<div><div class="galeria" id="galeria">${fotos.map((f, i) => fotoCaixa(f, `Foto ${i + 1} do kit`, i > 0)).join('')}</div>
    ${fotos.length > 8 ? `<div class="pontos-galeria contagem"><span id="galeria-n">1</span> / ${fotos.length}</div>`
      : `<div class="pontos-galeria">${fotos.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>`}</div>`;
}
function ligarGaleria(p) {
  const g = p.querySelector('#galeria');
  if (!g) return;
  const pontos = [...p.querySelectorAll('.pontos-galeria i')];
  g.addEventListener('scroll', () => {
    const atual = Math.round(g.scrollLeft / g.clientWidth);
    pontos.forEach((pt, i) => pt.classList.toggle('on', i === atual));
    const n = p.querySelector('#galeria-n'); if (n) n.textContent = String(atual + 1);
  }, { passive: true });
}
const reais = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const paraData = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
const maiuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const dataLonga = (iso) => maiuscula(paraData(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }));
const linkZap = (n, t) => { let d = String(n).replace(/\D/g, ''); if (d.length <= 11) d = '55' + d; return `https://wa.me/${d}?text=${encodeURIComponent(t)}`; };
const FECHAR = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ESQ = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
const DIR = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

// Aceita os dois formatos: reservar.html?l=nome-da-loja e /nome-da-loja
const slug = (new URLSearchParams(location.search).get('l')
  || decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g, '').split('/').pop() || '').replace(/\.html$/, '').replace(/^reservar$|^404$|^index$/, '')
  || '').toLowerCase();
let loja = null;
// Prévia da "loja pronta" (montada pelo @ do Instagram e ainda não publicada): reservar.html?previa=ID&t=TOKEN
// Só liga com esses dois parâmetros; o link de reservas das lojas continua igual.
const PREVIA = (() => { const u = new URLSearchParams(location.search); const id = u.get('previa'), t = u.get('t'); return id && t ? { id, t } : null; })();
async function carregarPrevia() {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/loja-pronta`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ acao: 'ver', id: PREVIA.id, token: PREVIA.t }) }).catch(() => null);
  if (!r) throw new Error('Sem conexão. Confira a internet e tente de novo.');
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.previa) return null;
  return d;
}
function moldurasPrevia() {
  const t = document.createElement('div');
  t.className = 'faixa-dona';
  t.innerHTML = '<span style="flex:1;text-align:center"><i class="pic pic-olho"></i> Prévia da sua loja · só você está vendo</span>';
  document.body.prepend(t);
  const b = document.createElement('div');
  b.className = 'barra-previa';
  const lp = `loja-pronta/?p=${encodeURIComponent(PREVIA.id)}&t=${encodeURIComponent(PREVIA.t)}`;
  const travados = (loja.kits || []).filter((k) => k.bloqueado).length;
  b.innerHTML = `<p>${loja.modo === 'desenhos' ? 'Troque os desenhos pelas fotos dos seus kits depois de publicar.' : travados ? `Gostou? Publique e desbloqueie os ${loja.kits.length} kits.` : 'Gostou? Publique e comece a receber reservas hoje.'}</p>
    <div><a class="btn contorno" href="${lp}&email=1">Receber por e-mail</a><a class="btn principal" href="${lp}&publicar=1">Publicar minha loja</a></div>`;
  document.body.appendChild(b);
  document.body.classList.add('com-barra-previa');
}

// Kit com cadeado na prévia: mostra quantos kits esperam e leva para publicar
function abrirTravados() {
  const travados = loja.kits.filter((k) => k.bloqueado);
  const lp = `loja-pronta/?p=${encodeURIComponent(PREVIA.id)}&t=${encodeURIComponent(PREVIA.t)}`;
  const f = document.createElement('div');
  f.className = 'trava-fundo';
  f.innerHTML = `<div class="trava-folha" role="dialog" aria-modal="true" aria-label="Kits com cadeado">
    <h2>Mais ${travados.length} ${travados.length === 1 ? 'kit esperando' : 'kits esperando'} você</h2>
    <p class="pequeno">Eles já estão montados com as fotos do seu Instagram. Publique a loja e todos aparecem para as suas clientes.</p>
    <div class="trava-fotos">${travados.slice(0, 4).map((k) => `<span>${k.foto_url ? `<img src="${esc(k.foto_url)}" alt="">` : ''}<i class="pic pic-cadeado"></i></span>`).join('')}</div>
    <a class="btn principal cheio" href="${lp}&publicar=1">Publicar minha loja</a>
    <button type="button" class="link-btn" data-fechar>Agora não</button></div>`;
  const fechar = () => f.remove();
  f.onclick = (e) => { if (e.target === f || e.target.hasAttribute('data-fechar')) fechar(); };
  document.body.appendChild(f);
}

function aviso(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('oculto');
  clearTimeout(aviso.t); aviso.t = setTimeout(() => t.classList.add('oculto'), 3500);
}
// Telas internas em tela cheia, com botão "Voltar". O voltar do celular
// também fecha a tela em vez de sair da página.
let painelAberto = false;
function abrirPainel(titulo, corpo, aoMontar, classe = '') {
  const p = $('#painel');
  if (!painelAberto) { history.pushState({ painel: true }, ''); painelAberto = true; }
  p.innerHTML = `<div class="painel-fundo ${classe}"><div class="painel" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
    <div class="painel-barra"><button class="btn-voltar" type="button">${ESQ} Voltar</button></div>
    <h1 class="painel-titulo">${esc(titulo)}</h1>${corpo}</div></div>`;
  $('.btn-voltar', p).onclick = () => fechar();
  $('.painel-fundo', p).scrollTop = 0;
  document.body.style.overflow = 'hidden';
  aoMontar && aoMontar($('.painel', p));
}
function fechar(vindoDoCelular) {
  if (!painelAberto) return;
  painelAberto = false;
  $('#painel').innerHTML = '';
  document.body.style.overflow = '';
  if (!vindoDoCelular) history.back();
}
window.addEventListener('popstate', () => fechar(true));

const ICONE_INSTA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>';
function recadoPadrao(loja) {
  return `🎉 Que bom ter você aqui na ${loja}!\n\nNossos kits são pensados com carinho para deixar a sua festa linda e cheia de alegria. 💖\n\nVeja os kits, escolha a data livre e garanta a sua reserva com antecedência.\n\nVamos celebrar juntos esse momento especial! 🥳`;
}
// Uma visita por pessoa por dia; marca se veio pelo Instagram (navegador do Instagram ou link com ?o=ig)
// A dona abriu pelo app ("Ver como a cliente vê"): faixa para voltar ao app (a cliente nunca vê).
const VENDO_COMO_DONA = !!new URLSearchParams(location.search).get('dona');
if (VENDO_COMO_DONA) {
  const faixa = document.createElement('div');
  faixa.className = 'faixa-dona';
  faixa.innerHTML = '<a class="faixa-dona-btn" href="index.html?link=1">‹ Voltar ao app</a><span><i class="pic pic-olho"></i> Você está vendo sua loja como a cliente vê</span>';
  document.body.prepend(faixa);
}
function contarVisita(slug) {
  if (new URLSearchParams(location.search).get('adm') || VENDO_COMO_DONA) return; // o administrador ou a dona olhando não conta como visita
  try {
    const chave = `apm-visita-${slug}-${new Date().toISOString().slice(0, 10)}`;
    if (localStorage.getItem(chave)) return;
    localStorage.setItem(chave, '1');
  } catch (e) { /* segue mesmo assim */ }
  const ig = /Instagram/i.test(navigator.userAgent) || new URLSearchParams(location.search).get('o') === 'ig';
  dados.registrarVisita(slug, ig).catch(() => {});
}
async function iniciar() {
  const raiz = $('#raiz');
  if (!slug && !PREVIA) { raiz.innerHTML = '<div class="erro">Link incompleto. Peça o link de reservas para a loja.</div>'; return; }
  try {
    if (PREVIA) loja = await carregarPrevia();
    else { loja = await dados.catalogoPublico(slug); if (loja) contarVisita(slug); }
  } catch (e) {
    raiz.innerHTML = `<div class="erro">${esc(e.message)}</div>`; return;
  }
  if (!loja && PREVIA) { raiz.innerHTML = '<div class="erro">Esta prévia não está mais disponível. <a href="loja-pronta/">Montar de novo</a></div>'; return; }
  if (!loja) { raiz.innerHTML = '<div class="erro">Este link de reservas não está disponível.</div>'; return; }
  if (PREVIA) moldurasPrevia();
  document.title = `Reservas · ${loja.nome}`;
  loja.kits = dados.ordenarKits(loja.kits, loja.ordem_kits || 'az');
  // prévia: os kits com cadeado ficam sempre depois dos liberados
  if (PREVIA) loja.kits = [...loja.kits.filter((k) => !k.bloqueado), ...loja.kits.filter((k) => k.bloqueado)];
  const travados = loja.kits.filter((k) => k.bloqueado).length;
  const fechadoAgora = (loja.fechado || []).find((f) => f.ate >= hojeISO() && f.de <= dados.somaDias(hojeISO(), 30));
  const categorias = [...new Set(loja.kits.filter((k) => !k.bloqueado).map((k) => (k.categoria || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  raiz.innerHTML = `
    <div class="capa-loja" aria-hidden="true"></div>
    <header class="cabeca">
      ${loja.logo_url ? `<img src="${esc(loja.logo_url)}" alt="Logo de ${esc(loja.nome)}" onload="var r=this.naturalWidth/this.naturalHeight;if(r>0.9&&r<1.1)this.classList.add('logo-quadrada')">` : ''}
      <h1>${esc(loja.nome)}</h1>
      <p class="recado-loja">${esc(loja.recado || recadoPadrao(loja.nome))}</p>
      ${fechadoAgora ? `<p class="nota-amarela pequeno" style="margin:6px 0 0"><i class="pic pic-cadeado"></i> ${esc(fechadoAgora.recado || 'A loja não vai atender')} (${esc(dataCurta2(fechadoAgora.de))}${fechadoAgora.ate !== fechadoAgora.de ? ' a ' + esc(dataCurta2(fechadoAgora.ate)) : ''})</p>` : ''}
      <div class="botoes-loja">
        <a class="btn verde mini" href="${esc(linkZap(loja.whatsapp, 'Oi! Vim pelo link de reservas e tenho uma dúvida.'))}" target="_blank" rel="noopener">Dúvidas? Fale no WhatsApp</a>
        ${loja.instagram ? `<a class="btn insta mini" href="https://instagram.com/${encodeURIComponent(loja.instagram)}" target="_blank" rel="noopener">${ICONE_INSTA} Instagram</a>` : ''}
      </div>
    </header>
    ${loja.kits.length > 1 ? `
    <div class="busca-kits">
      <div class="linha-busca">
        ${categorias.length > 1 || loja.kits.length > 6 ? '<input type="search" id="busca" placeholder="Buscar kit pelo nome" aria-label="Buscar kit pelo nome">' : '<span class="busca-espaco"></span>'}
        <div class="sel-col" role="group" aria-label="Ver kits em 1 ou 2 colunas">
          <button type="button" data-col="1" aria-label="1 coluna"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/></svg></button>
          <button type="button" data-col="2" aria-label="2 colunas"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg></button>
        </div>
      </div>
      ${categorias.length > 1 ? `<div class="filtros-cat" role="tablist">${['Todos', ...categorias].map((c, i) => `<button type="button" class="filtro-cat ${i ? '' : 'ativo'}" data-cat="${i ? esc(c) : ''}">${esc(c)}</button>`).join('')}</div>` : ''}
    </div>` : ''}
    ${travados ? `<div class="nota-trava"><i class="pic pic-cadeado"></i><span><b>Encontramos ${loja.kits.length} kits no seu Instagram.</b> ${loja.kits.length - travados} já ${loja.kits.length - travados === 1 ? 'aparece' : 'aparecem'} aqui; ${travados === 1 ? 'o outro será desbloqueado' : `os outros ${travados} serão desbloqueados`} ao publicar.</span></div>` : ''}
    ${loja.kits.length ? `<div class="grade">${loja.kits.map((k) => k.bloqueado ? `
      <button class="cartao clicavel kit kit-trava" data-trava="1" data-categoria="" data-nome="">
        <span class="trava-foto">${k.foto_url ? `<img src="${esc(k.foto_url)}" alt="" loading="lazy">` : ''}<span class="trava-selo"><span class="trava-circ"><i class="pic pic-cadeado"></i></span><b>Desbloqueado ao publicar</b></span></span>
        <span class="trava-linha"></span><span class="trava-linha curta"></span>
        <span class="btn contorno mini">Ver como desbloquear</span>
      </button>` : `
      <button class="cartao clicavel kit" data-kit="${esc(k.id)}" data-categoria="${esc(k.categoria || '')}" data-nome="${esc(String(k.nome).toLowerCase())}">
        <span style="position:relative; display:block">${k.foto_url ? fotoCaixa(k.foto_url, '', true) : '<div class="foto-kit foto-vazia">Sem foto</div>'}
        ${fotosDe(k).length > 1 ? `<span class="contador-fotos"><i class="pic pic-camera"></i> ${fotosDe(k).length}</span>` : ''}
        ${k.categoria ? `<span class="etiqueta et-categoria cat-foto">${esc(k.categoria)}</span>` : ''}</span>
        <span class="nome">${esc(k.nome)}</span>
        <span class="kit-rodape"><span class="preco">${precoTexto(k)}</span><span class="ver-datas">Ver datas</span></span>
      </button>`).join('')}</div>
    <p class="vazio-txt centro oculto" id="sem-resultado">Nenhum kit encontrado. Tente outra categoria ou outro nome.</p>` : '<p class="vazio-txt centro">Nenhum kit disponível no momento.</p>'}
    <a class="btn contorno cheio" href="${esc(linkZap(loja.whatsapp, 'Oi! Vim pelo link de reservas e tenho uma dúvida.'))}" target="_blank" rel="noopener">Tirar dúvida no WhatsApp</a>
    <p class="rodape"><img src="icone.svg" alt="">Reservas por App Pegue e Monte</p>`;
  $$('[data-kit]').forEach((b) => (b.onclick = () => escolherData(loja.kits.find((k) => k.id === b.dataset.kit))));
  $$('[data-trava]').forEach((b) => (b.onclick = abrirTravados));
  // Filtro por categoria e busca pelo nome
  let catAtual = '';
  const filtrar = () => {
    const termo = ($('#busca') ? $('#busca').value : '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let visiveis = 0;
    $$('[data-kit], [data-trava]').forEach((b) => {
      const nome = b.dataset.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const ok = (!catAtual || b.dataset.categoria === catAtual) && (!termo || nome.includes(termo));
      b.classList.toggle('oculto', !ok); if (ok) visiveis++;
    });
    const vazio = $('#sem-resultado'); if (vazio) vazio.classList.toggle('oculto', visiveis > 0);
  };
  $$('.filtro-cat').forEach((b) => (b.onclick = () => {
    catAtual = b.dataset.cat; $$('.filtro-cat').forEach((x) => x.classList.toggle('ativo', x === b)); filtrar();
  }));
  if ($('#busca')) $('#busca').oninput = filtrar;
  // 1 ou 2 colunas (2 é o padrão); o celular da cliente guarda a escolha
  const colunas = (n) => {
    const g = $('.grade'); if (g) g.classList.toggle('uma-col', n === '1');
    $$('[data-col]').forEach((x) => x.classList.toggle('ativo', x.dataset.col === n));
  };
  let colSalva = '2';
  try { colSalva = localStorage.getItem('apm-colunas') === '1' ? '1' : '2'; } catch (e) { /* segue */ }
  colunas(colSalva);
  $$('[data-col]').forEach((b) => (b.onclick = () => { colunas(b.dataset.col); try { localStorage.setItem('apm-colunas', b.dataset.col); } catch (e) { /* segue */ } }));
  // Link de um kit específico (…?kit=ID): já abre nele
  const kitDoLink = new URLSearchParams(location.search).get('kit');
  const k0 = kitDoLink && loja.kits.find((k) => k.id === kitDoLink && !k.bloqueado);
  if (k0) escolherData(k0);
}

// Variações do kit (opções com preço, sinal, peças extras e foto próprios)
function variacoesDe(k) { return Array.isArray(k && k.variacoes) ? k.variacoes : []; }
function dataCurta2(iso) { const [a, m, d] = iso.split('-'); return `${d}/${m}`; }
function precoTexto(k) {
  if (k.preco_consultar) return 'Preço a consultar';
  const v = variacoesDe(k);
  if (!v.length) return reais(k.preco);
  return 'a partir de ' + reais(Math.min(...v.map((x) => Number(x.preco) || 0)));
}
function linkDoKit(k) {
  const u = new URL(location.href);
  u.search = ''; u.hash = '';
  if (/reservar\.html$/.test(u.pathname)) u.searchParams.set('l', slug);
  u.searchParams.set('kit', k.id);
  return u.toString();
}
async function compartilharKit(k) {
  const link = linkDoKit(k);
  const texto = `Olha este kit da ${loja.nome}: ${k.nome}`;
  if (navigator.share) { try { await navigator.share({ title: k.nome, text: texto, url: link }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  window.open(linkZap('', `${texto}\n${link}`).replace('https://wa.me/55?', 'https://wa.me/?'), '_blank', 'noopener');
}

async function escolherData(kit) {
  const h = hojeISO();
  let mes = h.slice(0, 7);
  let escolhida = null;
  let pulou = false;
  const cache = {};

  const desenhar = async (p) => {
    const [ano, m] = mes.split('-').map(Number);
    const primeiro = new Date(ano, m - 1, 1);
    const dias = new Date(ano, m, 0).getDate();
    const ini = `${mes}-01`; const fim = `${mes}-${String(dias).padStart(2, '0')}`;
    const area = $('#cal', p);
    if (!cache[mes]) {
      area.innerHTML = '<div class="carregando">Buscando datas livres…</div>';
      try { cache[mes] = new Set(PREVIA ? [] : await dados.datasOcupadas(slug, kit.id, ini, fim)); }
      catch (e) { area.innerHTML = `<div class="erro">${esc(e.message)}</div>`; return; }
    }
    const ocupadas = cache[mes];
    let livres = 0;
    let html = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map((d) => `<div class="dsem">${d}</div>`).join('');
    for (let i = 0; i < primeiro.getDay(); i++) html += '<button class="vazio" tabindex="-1" aria-hidden="true"></button>';
    for (let d = 1; d <= dias; d++) {
      const iso = `${mes}-${String(d).padStart(2, '0')}`;
      const passado = iso < h;
      const fora = passado || ocupadas.has(iso);
      if (!fora) livres++;
      html += `<button data-d="${iso}" ${fora ? 'disabled' : ''} class="${iso === escolhida ? 'sel' : ''} ${passado ? 'passado' : ''}" aria-label="${dataLonga(iso)}${fora ? ', indisponível' : ''}">${d}</button>`;
    }
    if (!livres && !pulou && mes === h.slice(0, 7)) { pulou = true; mes = dados.isoDe(new Date(ano, m, 1)).slice(0, 7); return desenhar(p); }
    const nomeMes = maiuscula(primeiro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
    area.innerHTML = `
      <div class="linha-flex entre" style="margin-bottom:8px">
        <button class="fechar" id="ant" aria-label="Mês anterior" ${mes <= h.slice(0, 7) ? 'disabled style="opacity:.3"' : ''}>${ESQ}</button>
        <b>${esc(nomeMes)}</b>
        <button class="fechar" id="prox" aria-label="Próximo mês">${DIR}</button>
      </div>
      <div class="cal">${html}</div>
      <p class="dica" style="margin-top:8px">Datas riscadas já estão reservadas${(loja.fechado || []).some((f) => f.ate >= ini && f.de <= fim) ? ` ou com a loja fechada${(loja.fechado.find((f) => f.ate >= ini && f.de <= fim) || {}).recado ? ` (${esc(loja.fechado.find((f) => f.ate >= ini && f.de <= fim).recado)})` : ''}` : ''}.</p>`;
    const muda = (delta) => { mes = dados.isoDe(new Date(ano, m - 1 + delta, 1)).slice(0, 7); desenhar(p); };
    $('#ant', area).onclick = () => { if (mes > h.slice(0, 7)) muda(-1); };
    $('#prox', area).onclick = () => muda(1);
    $$('[data-d]', area).forEach((b) => (b.onclick = () => { escolhida = b.dataset.d; desenhar(p); mostrarForm(p); }));
  };

  const mostrarForm = async (p) => {
    const f = $('#form', p);
    f.classList.remove('oculto');
    $('#data-escolhida', p).textContent = dataLonga(escolhida);
    const sinal = Number(opcao ? opcao.sinal : kit.sinal) || 0;
    $('#barra-dia', p).textContent = 'Festa: ' + dataLonga(escolhida);
    $('#barra-sinal', p).textContent = kit.preco_consultar ? 'Preço a consultar' : sinal > 0 ? `Sinal de ${reais(sinal)}` : reais(opcao ? opcao.preco : kit.preco);
    $('#barra-res', p).classList.remove('oculto');
    const ta = $('#temas-area', p);
    if (ta) {
      ta.innerHTML = '<div class="carregando">Vendo os temas livres…</div>';
      try { ocupadosTema = PREVIA ? [] : await dados.temasOcupados(slug, kit.id, escolhida); } catch (e) { ocupadosTema = []; }
      if (tema && ocupadosTema.includes(tema)) tema = null;
      const pintar = () => { ta.innerHTML = temasHtml(); $$('[data-tema]', ta).forEach((b) => (b.onclick = () => { tema = b.dataset.tema; pintar(); })); };
      pintar();
    }
    f.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const vars = variacoesDe(kit);
  let opcao = vars[0] || null;
  const fotosDaOpcao = () => (opcao && Array.isArray(opcao.fotos) && opcao.fotos.length ? opcao.fotos : fotosDe(kit));
  const temas = Array.isArray(kit.temas) ? kit.temas : [];
  let tema = null, ocupadosTema = [];
  const precoHtml = () => kit.preco_consultar
    ? `<span class="preco" style="font-family:'Plus Jakarta Sans',sans-serif;font-size:21px;font-weight:800;color:#4A2F73">Preço a consultar</span><span class="pequeno">Escolha a data e peça a reserva: a loja passa o valor pelo WhatsApp.</span>`
    : `<span class="preco" style="font-family:'Plus Jakarta Sans',sans-serif;font-size:22px;font-weight:800">${reais(opcao ? opcao.preco : kit.preco)}</span>
      ${Number(opcao ? opcao.sinal : kit.sinal) > 0 ? `<span class="pequeno">Sinal para reservar: <b>${reais(opcao ? opcao.sinal : kit.sinal)}</b></span>` : ''}`;
  const temasHtml = () => `<div class="temas-link">${temas.map((t) => { const oc = ocupadosTema.includes(t.id); return `<button type="button" class="tema-link ${tema === t.id ? 'sel' : ''}" data-tema="${esc(t.id)}" ${oc ? 'disabled' : ''}>
      ${t.foto ? `<img src="${esc(t.foto)}" alt="">` : '<span class="tema-sem"><i class="pic pic-paleta"></i></span>'}<b>${esc(t.nome)}</b>${oc ? '<small>já reservado</small>' : ''}</button>`; }).join('')}</div>`;
  const pecasHtml = () => {
    const base = Array.isArray(kit.pecas) ? kit.pecas : [];
    const extras = opcao && Array.isArray(opcao.extras) ? opcao.extras.filter(Boolean) : [];
    if (!base.length && !extras.length) return '';
    return `<div class="pecas-kit"><b>O que vem no kit</b><div>${base.map((x) => `<span>${esc(x)}</span>`).join('')}${extras.map((x) => `<span class="extra">${esc(x)}</span>`).join('')}</div></div>`;
  };
  abrirPainel(kit.nome, `
    <div class="kit-topo">
      <div id="galeria-area">${galeria(fotosDaOpcao())}</div>
      <div class="kit-botoes"><button type="button" class="bq-redondo" id="kit-voltar" aria-label="Voltar">${ESQ}</button>
        ${PREVIA ? '' : `<button type="button" class="bq-redondo" id="compartilhar-kit" aria-label="Compartilhar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M8 8l4-4 4 4"/><path d="M6 12v7h12v-7"/></svg></button>`}</div>
    </div>
    <div class="kit-folha">
    ${kit.categoria ? `<span class="etiqueta et-categoria">${esc(kit.categoria)}</span>` : ''}
    <div class="kit-nome-linha"><h1 class="kit-nome">${esc(kit.nome)}</h1><div id="preco-area" class="kit-preco">${precoHtml()}</div></div>
    ${vars.length ? `<h3 style="margin-bottom:0">Escolha a opção</h3>
    <div class="opcoes-kit">${vars.map((v, i) => `<button type="button" class="opcao-kit ${i ? '' : 'sel'}" data-op="${esc(v.id)}"><b>${esc(v.nome)}</b><span>${reais(v.preco)}</span></button>`).join('')}</div>` : ''}
    <div id="pecas-area">${pecasHtml()}</div>
    <h3>Escolha a data da festa</h3>
    <div class="cartao" id="cal"></div>
    <form id="form" class="coluna oculto" novalidate>
      <div class="cartao" style="background: var(--lilas)"><div class="pequeno">Data da festa</div><b id="data-escolhida"></b></div>
      ${temas.length ? '<h3 style="margin:4px 0 0">Escolha o tema</h3><div id="temas-area"></div>' : ''}
      <label class="campo">Seu nome<input name="nome" maxlength="80" autocomplete="name" required></label>
      <label class="campo">Seu WhatsApp<div class="campo-pre"><span>+55</span><input name="zap" inputmode="tel" autocomplete="tel" placeholder="(51) 99999-0000" required></div></label>
      <div class="erro oculto" id="erro"></div>
      <button class="btn principal cheio" type="submit">Pedir reserva</button>
      <p class="dica centro">${loja.confirmar ? 'A loja confere a data e confirma pelo WhatsApp.' : 'Seu pedido segura a data até a loja confirmar o sinal.'}</p>
    </form>
    </div>
    <div class="barra-reservar oculto" id="barra-res"><div><small id="barra-dia"></small><b id="barra-sinal"></b></div><button type="button" class="btn principal" id="barra-bt">Reservar</button></div>`, (p) => {
    ligarGaleria(p);
    $('#kit-voltar', p).onclick = () => fechar();
    $('#barra-bt', p).onclick = () => { const f = $('#form', p); f.scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(() => f.nome.focus(), 400); };
    desenhar(p);
    if ($('#compartilhar-kit', p)) $('#compartilhar-kit', p).onclick = () => compartilharKit(kit);
    $$('[data-op]', p).forEach((b) => (b.onclick = () => {
      opcao = vars.find((v) => v.id === b.dataset.op) || opcao;
      $$('[data-op]', p).forEach((x) => x.classList.toggle('sel', x === b));
      $('#galeria-area', p).innerHTML = galeria(fotosDaOpcao());
      ligarGaleria(p);
      $('#preco-area', p).innerHTML = precoHtml();
      $('#pecas-area', p).innerHTML = pecasHtml();
      const enviar = $('#form button[type=submit]', p);
      if (enviar) enviar.textContent = `Pedir reserva: ${opcao.nome}`;
    }));
    const form = $('#form', p);
    if (opcao) $('button[type=submit]', form).textContent = `Pedir reserva: ${opcao.nome}`;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const erro = $('#erro', p);
      erro.classList.add('oculto');
      const nome = form.nome.value.trim();
      let zap = form.zap.value.replace(/\D/g, '').replace(/^0+/, '');
      if (zap.length > 11 && zap.startsWith('55')) zap = zap.slice(2);
      if (!escolhida) { erro.textContent = 'Escolha a data da festa no calendário.'; erro.classList.remove('oculto'); return; }
      if (temas.length && !tema) { erro.textContent = 'Escolha o tema da festa.'; erro.classList.remove('oculto'); return; }
      if (nome.length < 2) { erro.textContent = 'Digite seu nome.'; erro.classList.remove('oculto'); return; }
      if (zap.length < 10 || zap.length > 11) { erro.textContent = 'Confira seu WhatsApp: digite o DDD e o número, por exemplo (51) 99999-0000.'; erro.classList.remove('oculto'); return; }
      const b = $('button[type=submit]', form);
      if (PREVIA) { erro.textContent = 'Isto é uma prévia: os pedidos chegam para você depois de publicar a loja.'; erro.classList.remove('oculto'); return; }
      b.disabled = true; b.textContent = 'Enviando…';
      try {
        const r = await dados.solicitarReserva(slug, kit.id, escolhida, nome, zap, opcao ? opcao.id : null, tema);
        const nomeTema = r.tema || (temas.find((t) => t.id === tema) || {}).nome;
        sucesso({ ...kit, nome: (opcao ? `${kit.nome} – ${opcao.nome}` : kit.nome) + (nomeTema ? ` (tema ${nomeTema})` : '') }, escolhida, nome, zap, r);
      } catch (err) {
        erro.textContent = err.message; erro.classList.remove('oculto');
        delete cache[escolhida.slice(0, 7)];
        if (/tema/i.test(err.message)) mostrarForm(p);
        b.disabled = false; b.textContent = opcao ? `Pedir reserva: ${opcao.nome}` : 'Pedir reserva';
      }
    };
  }, 'pn-kit');
}

function zapFormatado(n) {
  const d = String(n).replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

function sucesso(kit, data, nome, zap, r) {
  const temSinal = Number(r.sinal) > 0;
  const confirmar = !!r.confirmar;
  const texto = `Olá! Acabei de pedir uma reserva pelo link:\n\n`
    + `Kit: ${kit.nome}\nFesta: ${dataLonga(data)}\nNome: ${nome}\nWhatsApp: ${zapFormatado(zap)}\n\n`
    + (r.consultar ? 'Qual o valor? Pode me passar?' : confirmar ? 'Pode confirmar se a data está livre?' : temSinal ? `Vou fazer o Pix do sinal de ${reais(r.sinal)} e mando o comprovante aqui.` : 'Como faço para confirmar?');
  const link = linkZap(r.whatsapp, texto);
  abrirPainel(confirmar ? 'Pedido enviado!' : 'Falta só um passo', `
    <p>${confirmar ? 'Sua data está <b>pré-reservada</b>. Envie o pedido pelo WhatsApp: a loja confere e confirma por lá. <b>Só faça o Pix depois da confirmação.</b>' : 'Sua data está guardada. Agora <b>envie o pedido para a loja pelo WhatsApp</b> para ela confirmar sua reserva.'}</p>
    <a class="btn verde cheio" id="enviar-zap" href="${esc(link)}" target="_blank" rel="noopener" style="min-height:56px;font-size:18px">Enviar pedido pelo WhatsApp</a>
    <div class="cartao" style="background: var(--lilas)">
      <div class="pequeno">Seu pedido</div>
      <b>${esc(kit.nome)}</b> · ${esc(dataLonga(data))}
    </div>
    ${temSinal && !confirmar ? `
      <div class="cartao coluna">
        <b>Depois, faça o Pix do sinal de ${reais(r.sinal)}</b>
        ${r.chave_pix ? `<div class="pequeno">Chave Pix:</div><div class="pix">${esc(r.chave_pix)}</div><button class="btn claro cheio" id="copiar-pix">Copiar chave Pix</button>` : '<p class="pequeno">A loja vai te passar a chave Pix pelo WhatsApp.</p>'}
        <p class="pequeno">Mande o comprovante na mesma conversa do WhatsApp.</p>
      </div>` : ''}
    <p class="dica centro">${confirmar ? 'A reserva fica confirmada depois que a loja aceitar e receber o sinal.' : 'A reserva é confirmada pela loja. Se a data não puder ser atendida, a loja devolve o sinal.'}</p>`, (p) => {
    const c = $('#copiar-pix', p);
    if (c) c.onclick = async () => {
      try { await navigator.clipboard.writeText(r.chave_pix); aviso('Chave Pix copiada!'); }
      catch (e) { prompt('Copie a chave Pix:', r.chave_pix); }
    };
    const z = $('#enviar-zap', p);
    z.addEventListener('click', () => {
      setTimeout(() => { z.textContent = 'Abrir o WhatsApp de novo'; z.classList.remove('verde'); z.classList.add('contorno'); }, 400);
    });
  });
}

iniciar();
