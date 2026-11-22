// =====================================================================
// App Pegue e Monte — "Veja sua loja pronta em 1 minuto"
// A pessoa digita o @ do Instagram; a função loja-pronta busca o perfil
// público, a IA separa os kits e a prévia abre na página de reservas
// (reservar.html?previa=...). Publicar = pagar o plano em /assinar.
// =====================================================================
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js?v=20261121e';

const PIXEL_META = '1489696249388385';
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const m = $('#m');
const MARCA = '<div class="marca"><img src="../icone-192.png" alt="">App Pegue e Monte</div>';
const CHECK = '<svg viewBox="0 0 24 24" width="13" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const CHECK_V = '<svg viewBox="0 0 24 24" fill="none" stroke="#2E7D57" stroke-width="2.8" stroke-linecap="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const URL_FN = `${SUPABASE_URL}/functions/v1/loja-pronta`;
const params = new URLSearchParams(location.search);
let atual = null; // { id, token, instagram, perfil, fotos }

// ---------------- Pixel do Meta (visita e cadastro) ----------------
function pixel() {
  if (window.fbq) return;
  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', PIXEL_META);
  window.fbq('track', 'PageView');
}
function evento(nome, d) { try { if (window.fbq) window.fbq('track', nome, d || {}); } catch (e) { /* segue */ } }

// ---------------- Origem (UTMs do anúncio) ----------------
const CAMPOS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'src'];
function origem() {
  const o = {};
  CAMPOS.forEach((c) => { const v = params.get(c); if (v && !v.includes('{{')) o[c] = v.slice(0, 200); });
  if (Object.keys(o).length) { try { localStorage.setItem('apm-origem', JSON.stringify(o)); } catch (e) { /* segue */ } return o; }
  try { return JSON.parse(localStorage.getItem('apm-origem') || 'null'); } catch (e) { return null; }
}
function aparelho() {
  try {
    let a = localStorage.getItem('apm-aparelho');
    if (!a) { a = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2); localStorage.setItem('apm-aparelho', a); }
    return a;
  } catch (e) { return null; }
}
function guardarPrevia(p) { try { localStorage.setItem('apm-previa', JSON.stringify({ id: p.id, t: p.token })); } catch (e) { /* segue */ } }
function previaGuardada() { try { return JSON.parse(localStorage.getItem('apm-previa') || 'null'); } catch (e) { return null; } }

async function chamar(corpo) {
  let r;
  try {
    r = await fetch(URL_FN, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify(corpo) });
  } catch (e) { throw Object.assign(new Error('Sem conexão. Confira a internet e tente de novo.'), { codigo: 'rede' }); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.erro) throw Object.assign(new Error(d.mensagem || 'Algo deu errado. Tente de novo.'), { codigo: d.erro || 'erro' });
  return d;
}
const abrirPrevia = (p) => { location.href = `../reservar.html?previa=${encodeURIComponent(p.id)}&t=${encodeURIComponent(p.token || p.t)}`; };

// ---------------- Tela 1: o @ ----------------
function telaEntrada(msgErro) {
  const doQuiz = (origem() || {}).src === 'quiz';
  m.innerHTML = `${doQuiz ? '<div class="faixa-quiz">Diagnóstico concluído. Agora veja sua loja pronta</div>' : ''}${MARCA}
    <div class="eye">PARA QUEM ALUGA E MONTA FESTAS</div>
    <h1>Veja sua loja pronta em 1 minuto</h1>
    <p class="sub">Digite o @ do seu Instagram. A gente monta sua loja com os seus kits.</p>
    <form id="f" novalidate>
      <label class="campo"><span>@</span><input id="ig" name="ig" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="email" placeholder="sualoja" maxlength="60" aria-label="Seu @ do Instagram"></label>
      <div class="erro ${msgErro ? '' : 'oculto'}" id="err">${esc(msgErro || '')}</div>
      <button class="btn" type="submit">Montar minha loja <span>→</span></button>
    </form>
    <div class="mini">Grátis · sem cartão · leva 1 minuto</div>
    <div class="passos">
      <div class="p"><i><img src="../icones/insta-vermelho.png" alt=""></i>Você digita o seu @</div>
      <div class="p"><i><img src="../icones/brilho-vermelho.png" alt=""></i>A IA separa os seus kits</div>
      <div class="p"><i><img src="../icones/link-vermelho.png" alt=""></i>Sua cliente reserva pelo link</div>
    </div>
    <button class="link" id="sem-ig" type="button">Não tenho Instagram de loja</button>`;
  const ig = $('#ig');
  ig.addEventListener('input', () => { ig.value = ig.value.replace(/^@+/, '').replace(/\s/g, ''); });
  $('#f').onsubmit = (e) => { e.preventDefault(); buscar(ig.value); };
  $('#sem-ig').onclick = () => telaSemInstagram();
}
function limpo(v) { return String(v || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@+/, '').replace(/[/?#].*$/, '').toLowerCase(); }
async function buscar(valor) {
  const ig = limpo(valor);
  if (!/^[a-z0-9._]{1,30}$/.test(ig)) return telaEntrada('Confira o @: só letras, números, ponto e _.');
  m.innerHTML = `<div class="centro"><div class="anel"></div><h1 class="m" style="margin-top:0">Procurando @${esc(ig)}…</h1><p class="sub">Isso leva alguns segundos.</p></div>`;
  try {
    atual = await chamar({ acao: 'buscar', instagram: ig, aparelho: aparelho(), origem: origem() });
    guardarPrevia(atual);
    if (atual.status === 'pronta') return abrirPrevia(atual);
    telaConfirmar();
  } catch (e) {
    if (e.codigo === 'fora') return telaSemInstagram(e.message);
    telaEntrada(e.message);
    const ig2 = $('#ig'); if (ig2) ig2.value = ig;
  }
}

// ---------------- Tela 2: é este o perfil? ----------------
function telaConfirmar() {
  const p = atual.perfil || {};
  const fotos = atual.fotos || [];
  m.innerHTML = `${MARCA}
    <h1 class="m">É este o seu perfil?</h1>
    <div class="perfil">
      <div class="ph"><div class="av">${p.foto ? `<img src="${esc(p.foto)}" alt="">` : ''}</div>
        <div><div class="nm">${esc(p.nome || '@' + atual.instagram)}</div><div class="us">@${esc(atual.instagram)}</div>
        <div class="num">${p.posts_total ? `${Number(p.posts_total).toLocaleString('pt-BR')} publicações` : ''}${p.seguidores ? ` · ${Number(p.seguidores).toLocaleString('pt-BR')} seguidores` : ''}</div></div></div>
      ${p.bio ? `<div class="bio">${esc(p.bio)}</div>` : ''}
      ${fotos.length ? `<div class="grade">${fotos.map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join('')}</div>` : (p.privado ? '<div class="info" style="margin-top:12px">Este perfil é privado. Vamos montar com fotos do seu celular.</div>' : '')}
    </div>
    <button class="btn" id="sim">Sim, montar minha loja <span>→</span></button>
    <button class="link" id="nao" type="button">Não é esse? Digitar outro @</button>`;
  $('#sim').onclick = () => (p.privado || !fotos.length ? telaGaleria() : montar());
  $('#nao').onclick = () => telaEntrada();
}

// ---------------- Tela 3: montando ----------------
function telaMontando(etapa) {
  const itens = ['Perfil encontrado', 'Separando seus kits', 'Montando sua vitrine', 'Criando seu link de reservas'];
  m.innerHTML = `<div class="centro"><div class="anel"></div>
    <h1 class="m" style="margin-top:0">Montando sua loja…</h1>
    <p class="sub" style="margin:0">Estamos olhando suas fotos e separando os kits.</p></div>
    <div class="lst">${itens.map((t, i) => i < etapa ? `<div class="it"><span class="ok">${CHECK}</span>${t}</div>`
      : i === etapa ? `<div class="it"><span class="esp"></span>${t}</div>` : `<div class="it off"><span class="esp"></span>${t}</div>`).join('')}</div>
    <div class="mini" style="margin-top:28px">Só entram as fotos de kits. Recados e outras postagens ficam de fora.</div>`;
}
async function montar() {
  let etapa = 1; telaMontando(etapa);
  const relogio = setInterval(() => { if (etapa < 3) { etapa++; telaMontando(etapa); } }, 9000);
  try {
    for (let i = 0; i < 40; i++) {
      const r = await chamar({ acao: 'montar', id: atual.id, token: atual.token });
      if (r.aguarde) { await new Promise((ok) => setTimeout(ok, 5000)); continue; }
      clearInterval(relogio);
      if (r.semKits) return telaGaleria(true);
      telaMontando(4);
      return setTimeout(() => abrirPrevia(atual), 500);
    }
    throw new Error('A montagem demorou demais. Tente de novo.');
  } catch (e) {
    clearInterval(relogio);
    m.innerHTML = `${MARCA}<h1 class="m">Quase lá</h1><p class="sub">${esc(e.message)}</p>
      <button class="btn" id="de-novo">Tentar de novo</button><button class="link" id="gal" type="button">Montar com fotos do celular</button>`;
    $('#de-novo').onclick = () => montar();
    $('#gal').onclick = () => telaGaleria();
  }
}

// ---------------- Tela 6: fotos da galeria (ou desenhos) ----------------
function reduzir(arquivo) {
  return new Promise((ok, falha) => {
    const img = new Image();
    const url = URL.createObjectURL(arquivo);
    img.onload = () => {
      const max = 1200, k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('Não conseguimos abrir essa foto. Tente outra.')); };
    img.src = url;
  });
}
function telaGaleria(semKits, aviso) {
  const fotos = [];
  const arroba = atual && atual.instagram ? `@${esc(atual.instagram)}` : 'seu perfil';
  const desenhar = () => {
    m.innerHTML = `${MARCA}
      <h1 class="m">Vamos montar com as fotos do seu celular</h1>
      <p class="sub">${aviso ? esc(aviso) : semKits ? `Não conseguimos ver os kits no ${arroba}. Sem problema: escolha até 6 fotos dos seus kits na galeria.` : 'Escolha até 6 fotos dos seus kits na galeria.'}</p>
      <div class="sel3">${fotos.map((u, i) => `<div><img src="${u}" alt=""><em>${i + 1}</em></div>`).join('')}${fotos.length < 6 ? '<label class="mais" aria-label="Escolher fotos">+<input type="file" accept="image/*" multiple class="oculto" id="arq"></label>' : ''}</div>
      <div class="erro oculto" id="err"></div>
      <button class="btn" id="ir" ${fotos.length ? '' : 'disabled'}>Montar minha loja <span>→</span></button>
      <button class="link" id="des" type="button">Não tenho fotos agora</button>
      <div class="info"><img src="../icones/cadeado-vermelho.png" alt="">Suas fotos ficam só na sua loja. Nada é postado no seu Instagram.</div>`;
    const arq = $('#arq');
    if (arq) arq.onchange = async () => {
      const lista = [...arq.files].slice(0, 6 - fotos.length);
      try { for (const f of lista) fotos.push(await reduzir(f)); } catch (e) { $('#err').textContent = e.message; $('#err').classList.remove('oculto'); }
      desenhar();
    };
    $('#ir').onclick = async () => {
      const b = $('#ir'); b.disabled = true; b.textContent = 'Montando…';
      try {
        if (!atual) await criarSemInstagram();
        await chamar({ acao: 'galeria', id: atual.id, token: atual.token, fotos });
        abrirPrevia(atual);
      } catch (e) { $('#err').textContent = e.message; $('#err').classList.remove('oculto'); b.disabled = false; b.innerHTML = 'Montar minha loja <span>→</span>'; }
    };
    $('#des').onclick = async () => {
      const b = $('#des'); b.disabled = true; b.textContent = 'Montando…';
      try {
        if (!atual) await criarSemInstagram();
        await chamar({ acao: 'desenhos', id: atual.id, token: atual.token });
        abrirPrevia(atual);
      } catch (e) { $('#err').textContent = e.message; $('#err').classList.remove('oculto'); b.disabled = false; b.textContent = 'Não tenho fotos agora'; }
    };
  };
  desenhar();
}
// Sem Instagram (ou Instagram fora do ar): pede o nome da loja antes das fotos
function telaSemInstagram(aviso) {
  m.innerHTML = `${MARCA}
    <h1 class="m">Como se chama a sua loja?</h1>
    <p class="sub">${aviso ? esc(aviso) + ' ' : ''}Depois você escolhe as fotos dos seus kits.</p>
    <form id="f" novalidate>
      <input class="ent" id="nome" maxlength="60" placeholder="Ex.: Festas da Maria" autocomplete="organization">
      <div class="erro oculto" id="err"></div>
      <button class="btn" type="submit">Continuar <span>→</span></button>
    </form>
    <button class="link" id="volta" type="button">Voltar e digitar o @</button>`;
  $('#volta').onclick = () => telaEntrada();
  $('#f').onsubmit = (e) => {
    e.preventDefault();
    const nome = $('#nome').value.trim();
    if (nome.length < 2) { $('#err').textContent = 'Digite o nome da sua loja.'; $('#err').classList.remove('oculto'); return; }
    atual = null; telaGaleria(false); semInstagramNome = nome;
  };
}
let semInstagramNome = '';
async function criarSemInstagram() {
  atual = await chamar({ acao: 'criar', nome: semInstagramNome, aparelho: aparelho(), origem: origem() });
  guardarPrevia(atual);
}

// ---------------- Receber por e-mail ----------------
function telaEmail(p) {
  const link = `${location.origin}${location.pathname}?p=${encodeURIComponent(p.id)}&t=${encodeURIComponent(p.t)}`;
  m.innerHTML = `${MARCA}
    <button class="voltar" id="volta" type="button" style="margin-top:22px">‹ Voltar para minha loja</button>
    <h1 class="m" style="margin-top:14px">Receba sua loja no e-mail</h1>
    <p class="sub">Mandamos o link para você terminar quando quiser. Sua prévia fica guardada por 7 dias.</p>
    <form id="f" novalidate>
      <input class="ent" id="em" type="email" inputmode="email" autocomplete="email" placeholder="seu@email.com" maxlength="200">
      <div class="erro oculto" id="err"></div>
      <button class="btn" type="submit">Receber o link</button>
    </form>`;
  $('#volta').onclick = () => abrirPrevia(p);
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const b = $('button[type=submit]'); b.disabled = true; b.textContent = 'Enviando…';
    try {
      const email = $('#em').value.trim();
      await chamar({ acao: 'email', id: p.id, token: p.t, email });
      evento('CompleteRegistration', { content_name: 'loja-pronta', status: true });
      try { localStorage.setItem('apm-previa-email', email); } catch (er) { /* segue */ }
      m.innerHTML = `${MARCA}
        <div class="centro" style="margin-top:40px"><div style="width:64px;height:64px;border-radius:50%;background:#E8F3EC;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">${CHECK_V.replace('<svg', '<svg width="30"')}</div>
        <h1 class="m" style="margin-top:0">Pronto! Olhe seu e-mail</h1>
        <p class="sub">Mandamos o link da sua loja para <b>${esc(email)}</b>. Se não achar, veja a caixa de promoções ou de spam.</p></div>
        <div class="copiar"><span>${esc(link)}</span><button type="button" id="cp">Copiar</button></div>
        <a class="btn r" href="?p=${encodeURIComponent(p.id)}&t=${encodeURIComponent(p.t)}&publicar=1" style="margin-top:18px">Publicar minha loja agora</a>
        <button class="link" id="ver" type="button">Voltar para minha loja</button>`;
      $('#cp').onclick = async () => { try { await navigator.clipboard.writeText(link); $('#cp').textContent = 'Copiado!'; } catch (er) { $('#cp').textContent = 'Segure para copiar'; } };
      $('#ver').onclick = () => abrirPrevia(p);
    } catch (er) { $('#err').textContent = er.message; $('#err').classList.remove('oculto'); b.disabled = false; b.textContent = 'Receber o link'; }
  };
}

// ---------------- Tela 5: publicar (pagamento do plano) ----------------
async function telaPublicar(p) {
  m.innerHTML = '<div class="anel"></div>';
  let v;
  try { v = await chamar({ acao: 'ver', id: p.id, token: p.t }); } catch (e) { return telaEntrada('Esta prévia não está mais disponível. Monte de novo.'); }
  const n = (v.kits || []).length;
  let emailSalvo = ''; try { emailSalvo = localStorage.getItem('apm-previa-email') || ''; } catch (e) { /* segue */ }
  m.innerHTML = `${MARCA}
    <button class="voltar" id="volta" type="button" style="margin-top:22px">‹ Voltar para minha loja</button>
    <h1 class="m" style="margin-top:14px">Publicar minha loja</h1>
    <div class="ck">
      <div>${CHECK_V}${n} ${n === 1 ? 'kit já cadastrado' : 'kits já cadastrados'}${v.modo === 'desenhos' ? ' (troque pelas suas fotos)' : ''}</div>
      <div>${CHECK_V}Seu link de reservas para a bio do Instagram</div>
      <div>${CHECK_V}Agenda que não deixa reservar 2 vezes</div>
      <div>${CHECK_V}Você coloca os preços quando quiser</div>
    </div>
    <div class="preco"><div><small>Plano mensal</small><b>R$ 29,90</b></div><div style="text-align:right"><small>por mês</small><small>cancele quando quiser</small></div></div>
    <form id="f" novalidate>
      <label class="rot" for="em">E-mail (vai ser o seu acesso ao app)</label>
      <input class="ent" id="em" type="email" inputmode="email" autocomplete="email" placeholder="seu@email.com" maxlength="200" value="${esc(emailSalvo)}">
      <label class="rot" for="zap">WhatsApp da loja</label>
      <input class="ent" id="zap" type="tel" inputmode="tel" autocomplete="tel" placeholder="(11) 99999-0000" maxlength="20" value="${esc(v.whatsapp ? formatarZap(v.whatsapp) : '')}">
      <div class="erro oculto" id="err"></div>
      <button class="btn r" type="submit">Pagar e publicar minha loja</button>
    </form>
    <div class="gar"><img src="../icones/escudo-vermelho.png" alt="">7 dias de garantia: não gostou, devolvemos</div>
    <button class="link anual-off" id="anual" type="button"><span class="off-selo">53% OFF</span>Prefere o anual? R$ 167 por 12 meses</button>`;
  $('#volta').onclick = () => abrirPrevia(p);
  const ir = async (plano, b) => {
    const err = $('#err'); err.classList.add('oculto');
    const email = $('#em').value.trim(), zap = $('#zap').value;
    const textoAntes = b.textContent; b.disabled = true; b.textContent = 'Abrindo o pagamento…';
    try {
      await chamar({ acao: 'publicar', id: p.id, token: p.t, email, whatsapp: zap });
      try { localStorage.setItem('apm-previa-email', email); } catch (e) { /* segue */ }
      // origem para a Utmify: anúncio + de onde veio (loja-pronta)
      try { const o = origem() || {}; localStorage.setItem('apm-origem', JSON.stringify({ ...o, src: o.src === 'quiz' ? 'quiz-loja' : 'loja-pronta' })); } catch (e) { /* segue */ }
      location.href = `../assinar/?plano=${plano}&abrir=1`;
    } catch (e) { err.textContent = e.message; err.classList.remove('oculto'); b.disabled = false; b.textContent = textoAntes; }
  };
  $('#f').onsubmit = (e) => { e.preventDefault(); ir('mensal', $('button[type=submit]')); };
  $('#anual').onclick = () => ir('anual', $('#anual'));
  const z = $('#zap'); z.addEventListener('input', () => { const p2 = z.selectionStart === z.value.length; z.value = formatarZap(z.value); if (p2) z.selectionStart = z.selectionEnd = z.value.length; });
}
function formatarZap(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// ---------------- Início ----------------
pixel();
origem();
const pId = params.get('p'), pT = params.get('t');
if (pId && pT) {
  const p = { id: pId, t: pT };
  guardarPrevia({ id: pId, token: pT });
  if (params.get('publicar')) telaPublicar(p);
  else if (params.get('email')) telaEmail(p);
  else abrirPrevia(p);
} else telaEntrada();
