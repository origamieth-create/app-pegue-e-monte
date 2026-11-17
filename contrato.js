// Página pública do contrato: a cliente lê e aceita pelo celular (sem login).
import * as dados from './dados.js?v=20261117c';

const $ = (s, r = document) => r.querySelector(s);
const raiz = $('#raiz');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const params = new URLSearchParams(location.search);
const token = params.get('c') || '';
const zap = (n, t) => `https://wa.me/55${String(n || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')}?text=${encodeURIComponent(t)}`;
const dataBR = (iso) => (iso ? new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '') : '');
const quando = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function textoFinal(c) {
  return String(c.texto || '')
    .replace(/\{cpf\}/g, c.aceito_cpf || '_______________')
    .replace(/\{endereco\}/g, c.aceito_endereco || '_______________________________');
}
function folha(c) {
  return `<div class="folha">${esc(textoFinal(c))}${c.aceito_em
    ? `<div class="aceite">Aceito eletronicamente por <b>${esc(c.aceito_nome || '')}</b>${c.aceito_cpf ? `, CPF ${esc(c.aceito_cpf)}` : ''}, em ${esc(quando(c.aceito_em))}.</div>` : ''}</div>`;
}
function topo(c) {
  return `<div class="loja-ct">${c.logo_url ? `<img src="${esc(c.logo_url)}" alt="">` : ''}<b>${esc(c.loja || '')}</b>
    <span class="pequeno">Contrato da sua reserva · Kit ${esc(c.kit || '')}</span></div>`;
}

async function iniciar() {
  let c = null;
  try { c = token.length >= 20 || dados.MODO_DEMO ? await dados.contratoPublico(token) : null; } catch (e) { /* mostra aviso abaixo */ }
  if (!c) {
    raiz.innerHTML = '<div class="aviso-tela"><h1>Contrato não encontrado</h1><p class="pequeno">Confira se o link está completo ou peça um novo link para a loja.</p></div>';
    return;
  }
  if (params.get('pdf') === '1') { raiz.innerHTML = topo(c) + folha(c); setTimeout(() => window.print(), 600); return; }
  if (c.aceito_em) return telaAceito(c);

  raiz.innerHTML = `${topo(c)}
    ${folha(c)}
    <form class="coluna nao-imprimir" novalidate>
      <label class="campo">Seu nome completo<input name="nome" autocomplete="name" value="${esc(c.cliente || '')}" maxlength="120"></label>
      ${c.pede_cpf ? `<label class="campo">Seu CPF<input name="cpf" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" maxlength="14"></label>
      <label class="campo">Seu endereço<input name="endereco" autocomplete="street-address" placeholder="Rua, número, bairro e cidade" maxlength="300"></label>` : ''}
      <label class="check"><input type="checkbox" name="li"> Li e concordo com o contrato de locação</label>
      <div class="erro oculto" id="erro"></div>
      <button class="btn verde cheio" type="submit" style="min-height:54px;font-size:17px">Aceitar contrato</button>
      <p class="centro pequeno" style="margin:0">Guardamos a data e a hora do seu aceite.</p>
    </form>`;
  const form = $('form', raiz);
  const erro = $('#erro', raiz);
  form.li.onchange = () => form.li.closest('.check').classList.toggle('marcado', form.li.checked);
  if (form.cpf) form.cpf.addEventListener('input', () => {
    const d = form.cpf.value.replace(/\D/g, '').slice(0, 11);
    form.cpf.value = d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  });
  form.onsubmit = async (e) => {
    e.preventDefault();
    erro.classList.add('oculto');
    if (!form.li.checked) { erro.textContent = 'Marque "Li e concordo" para aceitar.'; erro.classList.remove('oculto'); return; }
    const botao = form.querySelector('button[type=submit]');
    botao.disabled = true; botao.textContent = 'Enviando…';
    try {
      await dados.aceitarContrato(token, form.nome.value, form.cpf ? form.cpf.value : '', form.endereco ? form.endereco.value : '');
      telaAceito(await dados.contratoPublico(token));
      window.scrollTo(0, 0);
    } catch (e2) {
      erro.textContent = e2.message || 'Não deu certo. Tente de novo.'; erro.classList.remove('oculto');
      botao.disabled = false; botao.textContent = 'Aceitar contrato';
    }
  };
}

function telaAceito(c) {
  const primeiro = String(c.aceito_nome || '').split(' ')[0];
  raiz.innerHTML = `<div class="nao-imprimir coluna" style="gap:12px">
      ${topo(c)}
      <div class="ok-grande" aria-hidden="true">✅</div>
      <h2 class="centro" style="font-size:26px;margin:0">Contrato aceito!</h2>
      <p class="centro" style="margin:0">Obrigada, ${esc(primeiro)}. A ${esc(c.loja || 'loja')} já recebeu seu aceite.${c.retirada ? `<br><b>Retirada: ${esc(dataBR(c.retirada))}</b>` : ''}</p>
      <button class="btn contorno cheio" id="pdf">⬇️ Baixar minha cópia (PDF)</button>
      ${c.whatsapp ? `<a class="btn verde cheio" href="${esc(zap(c.whatsapp, `Oi! Aceitei o contrato da minha reserva do kit ${c.kit || ''}.`))}" target="_blank" rel="noopener">💬 Falar com a ${esc(c.loja || 'loja')}</a>` : ''}
    </div>
    <div class="so-impressao">${folha(c)}</div>`;
  $('#pdf', raiz).onclick = () => window.print();
}

iniciar();
