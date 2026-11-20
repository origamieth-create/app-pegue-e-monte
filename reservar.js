// =====================================================================
// App Pegue e Monte — link público de reservas (a cliente final usa)
// Endereço: reservar.html?l=<link-do-negocio>
// =====================================================================
import * as dados from './dados.js?v=20261121c';

// Demonstração do site: botões de WhatsApp mostram um aviso em vez de abrir conversa.
if (dados.DEMONSTRACAO_SITE) {
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href*="wa.me/"]');
    if (!a) return;
    e.preventDefault();
    const t = document.getElementById('toast');
    if (t) { t.textContent = 'Na versão real, o pedido chega direto no WhatsApp da loja 😉'; t.classList.remove('oculto'); setTimeout(() => t.classList.add('oculto'), 3200); }
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

function aviso(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('oculto');
  clearTimeout(aviso.t); aviso.t = setTimeout(() => t.classList.add('oculto'), 3500);
}
// Telas internas em tela cheia, com botão "Voltar". O voltar do celular
// também fecha a tela em vez de sair da página.
let painelAberto = false;
function abrirPainel(titulo, corpo, aoMontar) {
  const p = $('#painel');
  if (!painelAberto) { history.pushState({ painel: true }, ''); painelAberto = true; }
  p.innerHTML = `<div class="painel-fundo"><div class="painel" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
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
  faixa.innerHTML = '<a class="faixa-dona-btn" href="index.html?link=1">‹ Voltar ao app</a><span>👀 Você está vendo sua loja como a cliente vê</span>';
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
  if (!slug) { raiz.innerHTML = '<div class="erro">Link incompleto. Peça o link de reservas para a loja.</div>'; return; }
  try {
    loja = await dados.catalogoPublico(slug);
    if (loja) contarVisita(slug);
  } catch (e) {
    raiz.innerHTML = `<div class="erro">${esc(e.message)}</div>`; return;
  }
  if (!loja) { raiz.innerHTML = '<div class="erro">Este link de reservas não está disponível.</div>'; return; }
  document.title = `Reservas · ${loja.nome}`;
  loja.kits = dados.ordenarKits(loja.kits, loja.ordem_kits || 'az');
  const fechadoAgora = (loja.fechado || []).find((f) => f.ate >= hojeISO() && f.de <= dados.somaDias(hojeISO(), 30));
  const categorias = [...new Set(loja.kits.map((k) => (k.categoria || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  raiz.innerHTML = `
    <header class="cabeca">
      ${loja.logo_url ? `<img src="${esc(loja.logo_url)}" alt="Logo de ${esc(loja.nome)}">` : ''}
      <h1>${esc(loja.nome)}</h1>
      <p class="recado-loja">${esc(loja.recado || recadoPadrao(loja.nome))}</p>
      <p class="pequeno">Escolha o kit e veja as datas livres. ${loja.confirmar ? 'A loja confere a data e confirma pelo WhatsApp.' : 'A reserva é confirmada depois do sinal.'}</p>
      ${fechadoAgora ? `<p class="nota-amarela pequeno" style="margin:6px 0 0">🔒 ${esc(fechadoAgora.recado || 'A loja não vai atender')} (${esc(dataCurta2(fechadoAgora.de))}${fechadoAgora.ate !== fechadoAgora.de ? ' a ' + esc(dataCurta2(fechadoAgora.ate)) : ''})</p>` : ''}
      <div class="botoes-loja">
        <a class="btn verde mini" href="${esc(linkZap(loja.whatsapp, 'Oi! Vim pelo link de reservas e tenho uma dúvida.'))}" target="_blank" rel="noopener">Dúvidas? Fale no WhatsApp</a>
        ${loja.instagram ? `<a class="btn insta mini" href="https://instagram.com/${encodeURIComponent(loja.instagram)}" target="_blank" rel="noopener">${ICONE_INSTA} Instagram</a>` : ''}
      </div>
    </header>
    ${categorias.length > 1 ? `
    <div class="busca-kits">
      <input type="search" id="busca" placeholder="Buscar kit pelo nome" aria-label="Buscar kit pelo nome">
      <div class="filtros-cat" role="tablist">${['Todos', ...categorias].map((c, i) => `<button type="button" class="filtro-cat ${i ? '' : 'ativo'}" data-cat="${i ? esc(c) : ''}">${esc(c)}</button>`).join('')}</div>
    </div>` : loja.kits.length > 6 ? `<div class="busca-kits"><input type="search" id="busca" placeholder="Buscar kit pelo nome" aria-label="Buscar kit pelo nome"></div>` : ''}
    ${loja.kits.length ? `<div class="grade">${loja.kits.map((k) => `
      <button class="cartao clicavel kit" data-kit="${esc(k.id)}" data-categoria="${esc(k.categoria || '')}" data-nome="${esc(String(k.nome).toLowerCase())}">
        <span style="position:relative; display:block">${k.foto_url ? fotoCaixa(k.foto_url, '', true) : '<div class="foto-kit foto-vazia">Sem foto</div>'}
        ${fotosDe(k).length > 1 ? `<span class="contador-fotos">📷 ${fotosDe(k).length}</span>` : ''}</span>
        ${k.categoria ? `<span class="etiqueta et-categoria">${esc(k.categoria)}</span>` : ''}
        <span class="nome">${esc(k.nome)}</span>
        <span class="preco">${precoTexto(k)}</span>
        <span class="btn principal mini">Ver datas livres</span>
      </button>`).join('')}</div>
    <p class="vazio-txt centro oculto" id="sem-resultado">Nenhum kit encontrado. Tente outra categoria ou outro nome.</p>` : '<p class="vazio-txt centro">Nenhum kit disponível no momento.</p>'}
    <a class="btn contorno cheio" href="${esc(linkZap(loja.whatsapp, 'Oi! Vim pelo link de reservas e tenho uma dúvida.'))}" target="_blank" rel="noopener">Tirar dúvida no WhatsApp</a>
    <p class="rodape"><img src="icone.svg" alt="">Reservas por App Pegue e Monte</p>`;
  $$('[data-kit]').forEach((b) => (b.onclick = () => escolherData(loja.kits.find((k) => k.id === b.dataset.kit))));
  // Filtro por categoria e busca pelo nome
  let catAtual = '';
  const filtrar = () => {
    const termo = ($('#busca') ? $('#busca').value : '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let visiveis = 0;
    $$('[data-kit]').forEach((b) => {
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
  // Link de um kit específico (…?kit=ID): já abre nele
  const kitDoLink = new URLSearchParams(location.search).get('kit');
  const k0 = kitDoLink && loja.kits.find((k) => k.id === kitDoLink);
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
      try { cache[mes] = new Set(await dados.datasOcupadas(slug, kit.id, ini, fim)); }
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
    const ta = $('#temas-area', p);
    if (ta) {
      ta.innerHTML = '<div class="carregando">Vendo os temas livres…</div>';
      try { ocupadosTema = await dados.temasOcupados(slug, kit.id, escolhida); } catch (e) { ocupadosTema = []; }
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
    ? `<span class="preco" style="font-family:'Fredoka',sans-serif;font-size:21px;font-weight:600;color:#4A2F73">Preço a consultar</span><span class="pequeno">Escolha a data e peça a reserva: a loja passa o valor pelo WhatsApp.</span>`
    : `<span class="preco" style="font-family:'Fredoka',sans-serif;font-size:22px;font-weight:600">${reais(opcao ? opcao.preco : kit.preco)}</span>
      ${Number(opcao ? opcao.sinal : kit.sinal) > 0 ? `<span class="pequeno">Sinal para reservar: <b>${reais(opcao ? opcao.sinal : kit.sinal)}</b></span>` : ''}`;
  const temasHtml = () => `<div class="temas-link">${temas.map((t) => { const oc = ocupadosTema.includes(t.id); return `<button type="button" class="tema-link ${tema === t.id ? 'sel' : ''}" data-tema="${esc(t.id)}" ${oc ? 'disabled' : ''}>
      ${t.foto ? `<img src="${esc(t.foto)}" alt="">` : '<span class="tema-sem">🎨</span>'}<b>${esc(t.nome)}</b>${oc ? '<small>já reservado</small>' : ''}</button>`; }).join('')}</div>`;
  const pecasHtml = () => {
    const base = Array.isArray(kit.pecas) ? kit.pecas : [];
    const extras = opcao && Array.isArray(opcao.extras) ? opcao.extras.filter(Boolean) : [];
    if (!base.length && !extras.length) return '';
    return `<p class="pequeno" style="margin:0"><b>Inclui:</b> ${esc(base.join(', '))}${extras.length ? `${base.length ? ', ' : ''}<b style="color:#1F9D63">${esc(extras.join(', '))}</b>` : ''}</p>`;
  };
  abrirPainel(kit.nome, `
    <div id="galeria-area">${galeria(fotosDaOpcao())}</div>
    <div class="linha-flex entre" style="gap:8px"><span></span><button type="button" class="btn claro mini" id="compartilhar-kit">↗ Compartilhar</button></div>
    ${vars.length ? `<h3 style="margin-bottom:0">Escolha a opção</h3>
    <div class="opcoes-kit">${vars.map((v, i) => `<button type="button" class="opcao-kit ${i ? '' : 'sel'}" data-op="${esc(v.id)}"><b>${esc(v.nome)}</b><span>${reais(v.preco)}</span></button>`).join('')}</div>` : ''}
    <div id="pecas-area">${pecasHtml()}</div>
    <div class="linha-flex entre" id="preco-area">${precoHtml()}</div>
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
    </form>`, (p) => {
    ligarGaleria(p);
    desenhar(p);
    $('#compartilhar-kit', p).onclick = () => compartilharKit(kit);
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
  });
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
