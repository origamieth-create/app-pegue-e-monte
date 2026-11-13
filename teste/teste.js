// Página do teste grátis (link dos anúncios): cria a conta, começa o teste de 7 dias,
// guarda de qual anúncio veio e avisa o Pixel do Meta.
// Esta página é independente dos arquivos do app: usa só o config.js e o mesmo login do app
// (o Supabase guarda a sessão no navegador, então ao abrir o app a pessoa já está logada).
import { SUPABASE_URL, SUPABASE_ANON_KEY, WHATSAPP_SUPORTE } from '../config.js?v=20261113b';

const dados = (() => {
  const MODO_DEMO = !/^https:\/\/.+\.supabase\.co\/?$/.test(SUPABASE_URL);
  let sb = null;
  const cliente = async () => {
    if (!sb) {
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return sb;
  };
  const amigavel = (e) => {
    const msg = (e && (e.message || e.error_description)) || String(e);
    if (/User already registered/i.test(msg)) return 'Esse e-mail já tem conta.';
    if (/Password should be/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (/Failed to fetch|NetworkError/i.test(msg)) return 'Sem conexão. Confira a internet e tente de novo.';
    return msg;
  };
  return {
    MODO_DEMO,
    async sessaoAtual() {
      if (MODO_DEMO) return null;
      const { data } = await (await cliente()).auth.getSession();
      return data.session;
    },
    async criarConta(email, senha) {
      if (MODO_DEMO) return { precisaConfirmar: false, usuario: null };
      const { data, error } = await (await cliente()).auth.signUp({ email, password: senha });
      if (error) throw new Error(amigavel(error));
      return { precisaConfirmar: !data.session, usuario: data.user?.id || null };
    },
    async iniciarTeste(origem, telefone) {
      if (MODO_DEMO) return { ok: true };
      const { data, error } = await (await cliente()).rpc('iniciar_teste', { p_origem: origem, p_telefone: telefone });
      if (error) throw new Error(amigavel(error));
      return data;
    },
  };
})();

const PIXEL_META = '1489696249388385';
const $ = (s) => document.querySelector(s);
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sem memória do navegador */ } };
const ler = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };

// 1) Origem do anúncio (UTMs do Meta). Fica guardada mesmo se a pessoa recarregar a página.
const CAMPOS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
const url = new URLSearchParams(location.search);
let origem = { pagina: 'teste' };
CAMPOS.forEach((c) => { const v = url.get(c); if (v) origem[c] = v.slice(0, 200); });
if (Object.keys(origem).length > 1) guardar('apm-origem-teste', JSON.stringify(origem));
else { try { origem = JSON.parse(ler('apm-origem-teste')) || origem; } catch (e) { /* segue */ } }

// 2) Pixel do Meta (não carrega na versão de demonstração).
if (!dados.MODO_DEMO) {
  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', PIXEL_META);
  window.fbq('track', 'PageView');
}
const idEvento = (nome) => `${nome}-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)}`;
function avisarPixel(conta) {
  if (dados.MODO_DEMO || !window.fbq) return;
  const chave = `apm-pixel-cadastro-${conta}`;
  if (ler(chave)) return;
  const ids = { cadastro: idEvento('cadastro'), teste: idEvento('teste') };
  const extra = { content_name: 'teste-gratis', content_category: origem.utm_campaign || 'direto' };
  window.fbq('track', 'CompleteRegistration', extra, { eventID: ids.cadastro });
  window.fbq('track', 'StartTrial', { ...extra, value: 0, currency: 'BRL' }, { eventID: ids.teste });
  guardar(chave, JSON.stringify({ ...ids, em: new Date().toISOString() }));
}

// 3) WhatsApp do suporte e aviso de quem já tem conta neste celular.
$('#zap').href = `https://wa.me/55${String(WHATSAPP_SUPORTE).replace(/\D/g, '')}?text=${encodeURIComponent('Oi! Tenho uma dúvida sobre o teste grátis do App Pegue e Monte.')}`;
dados.sessaoAtual().then((s) => { if (s) $('#ja-conta').classList.remove('oculto'); }).catch(() => {});

// 4) Botão fixo no rodapé: some quando o formulário está na tela.
const form = $('#cadastro');
const fixo = $('#fixo');
const irForm = () => { form.scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(() => form.email.focus({ preventScroll: true }), 500); };
$('#ir-form').onclick = irForm;
$('#ir-form-fim').onclick = irForm;
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([i]) => fixo.classList.toggle('escondido', i.isIntersecting), { threshold: 0.15 }).observe(form);
}

// Máscara simples do WhatsApp: (51) 99999-0000
form.whatsapp.addEventListener('input', () => {
  const d = form.whatsapp.value.replace(/\D/g, '').slice(0, 11);
  form.whatsapp.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
});

// 5) Cadastro
form.onsubmit = async (e) => {
  e.preventDefault();
  const erro = $('#erro');
  const botao = form.querySelector('button[type=submit]');
  const mostrar = (html) => { erro.innerHTML = html; erro.classList.remove('oculto'); };
  erro.classList.add('oculto');
  const email = form.email.value.trim().toLowerCase();
  const zap = form.whatsapp.value.replace(/\D/g, '');
  const senha = form.senha.value;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { mostrar('Digite um e-mail válido.'); form.email.focus(); return; }
  if (zap.length < 10 || zap.length > 11) { mostrar('Digite seu WhatsApp com DDD, por exemplo (51) 99999-0000.'); form.whatsapp.focus(); return; }
  if (senha.length < 6) { mostrar('A senha precisa ter pelo menos 6 caracteres.'); form.senha.focus(); return; }

  botao.disabled = true;
  botao.textContent = 'Criando sua conta…';
  try {
    const r = await dados.criarConta(email, senha);
    guardar('apm-teste-whatsapp', zap);
    avisarPixel(r.usuario || email);
    if (r.precisaConfirmar) {
      mostrar('<b>Quase lá!</b> Enviamos um link para o seu e-mail. Toque nele para ativar a conta (confira também o spam).');
      erro.classList.add('sucesso');
      botao.textContent = 'Conta criada';
      return;
    }
    try { await dados.iniciarTeste(origem, zap); } catch (e2) { /* o app tenta de novo ao abrir */ }
    guardar('apm-novidades-vistas', '2026-11-16'); // conta nova não precisa do aviso de novidades
    botao.textContent = 'Pronto! Abrindo seu app…';
    setTimeout(() => { location.href = '../'; }, 700); // dá tempo do Pixel enviar
  } catch (e3) {
    const msg = String(e3.message || '');
    if (/already|registered|tem conta|existe|cadastrad/i.test(msg)) {
      mostrar('Esse e-mail já tem conta. <a href="../">Entrar no app</a>');
    } else {
      mostrar(msg || 'Não deu certo. Tente de novo em instantes.');
    }
    botao.disabled = false;
    botao.textContent = 'Começar meu teste grátis';
  }
};
