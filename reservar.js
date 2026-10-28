// =====================================================================
// App Pegue e Monte — link público de reservas (a cliente final usa)
// Endereço: reservar.html?l=<link-do-negocio>
// =====================================================================
import * as dados from './dados.js';

const { hojeISO, somaDias } = dados;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reais = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const paraData = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
const maiuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const dataLonga = (iso) => maiuscula(paraData(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }));
const linkZap = (n, t) => { let d = String(n).replace(/\D/g, ''); if (d.length <= 11) d = '55' + d; return `https://wa.me/${d}?text=${encodeURIComponent(t)}`; };
const FECHAR = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ESQ = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
const DIR = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

const slug = (new URLSearchParams(location.search).get('l') || '').toLowerCase();
let loja = null;

function aviso(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('oculto');
  clearTimeout(aviso.t); aviso.t = setTimeout(() => t.classList.add('oculto'), 3500);
}
function abrirPainel(titulo, corpo, aoMontar) {
  const p = $('#painel');
  p.innerHTML = `<div class="painel-fundo"><div class="painel" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
    <div class="painel-topo"><h2>${esc(titulo)}</h2><button class="fechar" aria-label="Fechar">${FECHAR}</button></div>${corpo}</div></div>`;
  $('.fechar', p).onclick = fechar;
  $('.painel-fundo', p).addEventListener('click', (e) => { if (e.target.classList.contains('painel-fundo')) fechar(); });
  document.body.style.overflow = 'hidden';
  aoMontar && aoMontar($('.painel', p));
}
function fechar() { $('#painel').innerHTML = ''; document.body.style.overflow = ''; }

async function iniciar() {
  const raiz = $('#raiz');
  if (!slug) { raiz.innerHTML = '<div class="erro">Link incompleto. Peça o link de reservas para a loja.</div>'; return; }
  try {
    loja = await dados.catalogoPublico(slug);
  } catch (e) {
    raiz.innerHTML = `<div class="erro">${esc(e.message)}</div>`; return;
  }
  if (!loja) { raiz.innerHTML = '<div class="erro">Este link de reservas não está disponível.</div>'; return; }
  document.title = `Reservas · ${loja.nome}`;
  raiz.innerHTML = `
    <header class="cabeca">
      ${loja.logo_url ? `<img src="${esc(loja.logo_url)}" alt="">` : ''}
      <h1>${esc(loja.nome)}</h1>
      <p class="pequeno">Escolha o kit e veja as datas livres. A reserva é confirmada depois do sinal.</p>
    </header>
    ${loja.kits.length ? `<div class="grade">${loja.kits.map((k) => `
      <button class="cartao clicavel kit" data-kit="${esc(k.id)}">
        ${k.foto_url ? `<img class="foto-kit" src="${esc(k.foto_url)}" alt="" loading="lazy">` : '<div class="foto-kit foto-vazia">Sem foto</div>'}
        <span class="nome">${esc(k.nome)}</span>
        <span class="preco">${reais(k.preco)}</span>
        <span class="btn principal mini">Ver datas livres</span>
      </button>`).join('')}</div>` : '<p class="vazio-txt centro">Nenhum kit disponível no momento.</p>'}
    <a class="btn contorno cheio" href="${esc(linkZap(loja.whatsapp, 'Oi! Vim pelo link de reservas e tenho uma dúvida.'))}" target="_blank" rel="noopener">Tirar dúvida no WhatsApp</a>
    <p class="rodape">Reservas por App Pegue e Monte</p>`;
  $$('[data-kit]').forEach((b) => (b.onclick = () => escolherData(loja.kits.find((k) => k.id === b.dataset.kit))));
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
      <p class="dica" style="margin-top:8px">Datas riscadas já estão reservadas.</p>`;
    const muda = (delta) => { mes = dados.isoDe(new Date(ano, m - 1 + delta, 1)).slice(0, 7); desenhar(p); };
    $('#ant', area).onclick = () => { if (mes > h.slice(0, 7)) muda(-1); };
    $('#prox', area).onclick = () => muda(1);
    $$('[data-d]', area).forEach((b) => (b.onclick = () => { escolhida = b.dataset.d; desenhar(p); mostrarForm(p); }));
  };

  const mostrarForm = (p) => {
    const f = $('#form', p);
    f.classList.remove('oculto');
    $('#data-escolhida', p).textContent = dataLonga(escolhida);
    f.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  abrirPainel(kit.nome, `
    ${kit.foto_url ? `<img class="foto-kit" src="${esc(kit.foto_url)}" alt="">` : ''}
    <div class="linha-flex entre"><span class="preco" style="font-family:'Fredoka',sans-serif;font-size:22px;font-weight:600">${reais(kit.preco)}</span>
      ${Number(kit.sinal) > 0 ? `<span class="pequeno">Sinal para reservar: <b>${reais(kit.sinal)}</b></span>` : ''}</div>
    <h3>Escolha a data da festa</h3>
    <div class="cartao" id="cal"></div>
    <form id="form" class="coluna oculto" novalidate>
      <div class="cartao" style="background: var(--lilas)"><div class="pequeno">Data da festa</div><b id="data-escolhida"></b></div>
      <label class="campo">Seu nome<input name="nome" maxlength="80" autocomplete="name" required></label>
      <label class="campo">Seu WhatsApp (com DDD)<input name="zap" inputmode="tel" autocomplete="tel" placeholder="(51) 99999-0000" required></label>
      <div class="erro oculto" id="erro"></div>
      <button class="btn principal cheio" type="submit">Pedir reserva</button>
      <p class="dica centro">Seu pedido segura a data até a loja confirmar o sinal.</p>
    </form>`, (p) => {
    desenhar(p);
    const form = $('#form', p);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const erro = $('#erro', p);
      erro.classList.add('oculto');
      const nome = form.nome.value.trim();
      const zap = form.zap.value.replace(/\D/g, '');
      if (!escolhida) { erro.textContent = 'Escolha a data da festa no calendário.'; erro.classList.remove('oculto'); return; }
      if (nome.length < 2) { erro.textContent = 'Digite seu nome.'; erro.classList.remove('oculto'); return; }
      if (zap.length < 10 || zap.length > 13) { erro.textContent = 'Digite seu WhatsApp com DDD.'; erro.classList.remove('oculto'); return; }
      const b = $('button[type=submit]', form);
      b.disabled = true; b.textContent = 'Enviando…';
      try {
        const r = await dados.solicitarReserva(slug, kit.id, escolhida, nome, zap);
        sucesso(kit, escolhida, nome, zap, r);
      } catch (err) {
        erro.textContent = err.message; erro.classList.remove('oculto');
        delete cache[escolhida.slice(0, 7)];
        b.disabled = false; b.textContent = 'Pedir reserva';
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
  const texto = `Olá! Acabei de pedir uma reserva pelo link:\n\n`
    + `Kit: ${kit.nome}\nFesta: ${dataLonga(data)}\nNome: ${nome}\nWhatsApp: ${zapFormatado(zap)}\n\n`
    + (temSinal ? `Vou fazer o Pix do sinal de ${reais(r.sinal)} e mando o comprovante aqui.` : 'Como faço para confirmar?');
  const link = linkZap(r.whatsapp, texto);
  abrirPainel('Falta só um passo', `
    <p>Sua data está guardada. Agora <b>envie o pedido para a loja pelo WhatsApp</b> para ela confirmar sua reserva.</p>
    <a class="btn verde cheio" id="enviar-zap" href="${esc(link)}" target="_blank" rel="noopener" style="min-height:56px;font-size:18px">Enviar pedido pelo WhatsApp</a>
    <div class="cartao" style="background: var(--lilas)">
      <div class="pequeno">Seu pedido</div>
      <b>${esc(kit.nome)}</b> · ${esc(dataLonga(data))}
    </div>
    ${temSinal ? `
      <div class="cartao coluna">
        <b>Depois, faça o Pix do sinal de ${reais(r.sinal)}</b>
        ${r.chave_pix ? `<div class="pequeno">Chave Pix:</div><div class="pix">${esc(r.chave_pix)}</div><button class="btn claro cheio" id="copiar-pix">Copiar chave Pix</button>` : '<p class="pequeno">A loja vai te passar a chave Pix pelo WhatsApp.</p>'}
        <p class="pequeno">Mande o comprovante na mesma conversa do WhatsApp.</p>
      </div>` : ''}
    <p class="dica centro">A reserva fica confirmada quando a loja receber o sinal.</p>`, (p) => {
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
