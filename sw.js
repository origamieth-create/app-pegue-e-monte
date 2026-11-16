// App Pegue e Monte — recebe as notificações do administrador.
// IMPORTANTE: este arquivo NÃO guarda cópia do app (não tem "fetch"),
// então o app sempre abre a versão mais nova publicada.
// O aviso chega sem conteúdo; aqui só buscamos o TIPO (sem dados de ninguém).

const TITULOS = {
  teste: 'Novo teste grátis',
  venda: 'Venda realizada',
  convertido: 'Teste virou assinante',
  recusado: 'Pagamento recusado',
  ping: 'Notificações funcionando',
};
const DESTINO = {
  teste: 'admin.html?aba=clientes&f=teste',
  venda: 'admin.html?aba=pagamentos',
  convertido: 'admin.html?aba=clientes&f=ativa',
  recusado: 'admin.html?aba=pagamentos',
  ping: 'admin.html',
};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

async function lerGuardado(nome) {
  const cache = await caches.open('apm-avisos');
  const r = await cache.match('/apm-avisos/' + nome);
  return r ? r.text() : null;
}

self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let tipo = null;
    try {
      const token = await lerGuardado('token');
      const cfg = JSON.parse((await lerGuardado('cfg')) || '{}');
      if (token && cfg.url && cfg.chave) {
        const r = await fetch(cfg.url + '/rest/v1/rpc/notificacoes_recentes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: cfg.chave, Authorization: 'Bearer ' + cfg.chave },
          body: JSON.stringify({ p_token: token }),
        });
        const lista = r.ok ? await r.json() : [];
        if (lista && lista.length) tipo = lista[0].tipo;
      }
    } catch (erro) { /* mostra o aviso genérico */ }
    const titulo = TITULOS[tipo] || 'Novidade no App Pegue e Monte';
    await self.registration.showNotification(titulo, {
      body: 'Toque para ver no painel.',
      icon: 'icone-192.png',
      badge: 'icone-192.png',
      tag: 'apm-' + (tipo || 'aviso') + '-' + Date.now(),
      data: { url: DESTINO[tipo] || 'admin.html' },
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const alvo = new URL(e.notification.data && e.notification.data.url ? e.notification.data.url : 'admin.html', self.registration.scope).href;
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of abertas) {
      if (c.url.includes('admin.html') && 'focus' in c) { await c.navigate(alvo).catch(() => {}); return c.focus(); }
    }
    return self.clients.openWindow(alvo);
  })());
});
