// App Pegue e Monte — recebe as notificações (administrador e lojas).
// IMPORTANTE: este arquivo NÃO guarda cópia do app (não tem "fetch"),
// então o app sempre abre a versão mais nova publicada.
// O aviso chega sem conteúdo; aqui só buscamos o TIPO (sem nome nem telefone de ninguém).

const ADMIN = {
  teste: ['Novo teste grátis', 'Toque para ver no painel.', 'admin.html?aba=clientes&f=teste'],
  venda: ['Venda realizada', 'Toque para ver no painel.', 'admin.html?aba=pagamentos'],
  convertido: ['Teste virou assinante', 'Toque para ver no painel.', 'admin.html?aba=clientes&f=ativa'],
  recusado: ['Pagamento recusado', 'Toque para ver no painel.', 'admin.html?aba=pagamentos'],
  ping: ['Notificações funcionando', 'Toque para ver no painel.', 'admin.html'],
};
const LOJA = {
  reserva: ['Nova reserva pelo seu link 🎉', 'Toque para ver e confirmar o sinal.', (a) => 'index.html' + (a.ref ? '?reserva=' + a.ref : '')],
  contrato: ['Contrato aceito', 'A cliente aceitou o contrato. Toque para ver.', (a) => 'index.html' + (a.ref ? '?reserva=' + a.ref : '')],
  resumo: ['Seu dia hoje', null, () => 'index.html'],
  teste_acabando: ['Seu teste grátis termina amanhã', 'Toque para escolher seu plano e continuar com tudo.', () => 'index.html?planos=1'],
  promo_teste: ['Um presente do seu teste grátis', 'Plano anual com 53% de desconto liberado. Toque para ver.', () => 'index.html?planos=1'],
  promo_montagem: ['A gente monta sua loja para você', 'No plano anual, nossa equipe cadastra até 50 kits para você. Toque para ver.', () => 'index.html?planos=1'],
  mensagem: [null, 'Toque para ver no app.', () => 'index.html'],
  pagamento: ['Pagamento não aprovado', 'Não conseguimos cobrar sua assinatura. Toque para regularizar.', () => 'index.html'],
  teste: ['Avisos funcionando', 'Você vai receber um aviso a cada nova reserva pelo link.', () => 'index.html'],
};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

async function lerGuardado(nome) {
  const cache = await caches.open('apm-avisos');
  const r = await cache.match('/apm-avisos/' + nome);
  return r ? r.text() : null;
}
async function buscar(cfg, rpc, token) {
  if (!token) return [];
  try {
    const r = await fetch(cfg.url + '/rest/v1/rpc/' + rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.chave, Authorization: 'Bearer ' + cfg.chave },
      body: JSON.stringify({ p_token: token }),
    });
    const lista = r.ok ? await r.json() : [];
    return Array.isArray(lista) ? lista : [];
  } catch (e) { return []; }
}

self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let titulo = 'Novidade no App Pegue e Monte';
    let corpo = 'Toque para abrir o app.';
    let url = 'index.html';
    let tag = 'apm-aviso';
    try {
      const cfg = JSON.parse((await lerGuardado('cfg')) || '{}');
      if (cfg.url && cfg.chave) {
        const [adm, loja] = await Promise.all([
          buscar(cfg, 'notificacoes_recentes', await lerGuardado('token')),
          buscar(cfg, 'avisos_loja_recentes', await lerGuardado('token-loja')),
        ]);
        const a = adm[0]; const l = loja[0];
        // Usa o aviso mais recente entre os dois (o mesmo celular pode ser do administrador e de uma loja).
        if (l && (!a || new Date(l.criado_em) >= new Date(a.criado_em)) && LOJA[l.tipo]) {
          const [t, c, u] = LOJA[l.tipo];
          titulo = t || l.corpo || titulo; corpo = (t ? (c || l.corpo) : c) || 'Toque para ver.'; url = u(l); tag = 'apm-loja-' + l.id;
        } else if (a && ADMIN[a.tipo]) {
          [titulo, corpo, url] = ADMIN[a.tipo]; tag = 'apm-admin-' + a.id;
        }
      }
    } catch (erro) { /* mostra o aviso genérico */ }
    await self.registration.showNotification(titulo, {
      body: corpo,
      icon: 'icone-192.png',
      badge: 'icone-192.png',
      tag,
      data: { url },
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = e.notification.data && e.notification.data.url ? e.notification.data.url : 'index.html';
  const alvo = new URL(destino, self.registration.scope).href;
  const pagina = destino.split('?')[0];
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of abertas) {
      const caminho = new URL(c.url).pathname;
      const nome = caminho.endsWith('/') ? 'index.html' : caminho.split('/').pop();
      if (nome === pagina && 'focus' in c) { await c.navigate(alvo).catch(() => {}); return c.focus(); }
    }
    return self.clients.openWindow(alvo);
  })());
});
