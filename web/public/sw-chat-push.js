/* Conecta Chat Web Push. A service worker intentionally receives no private text,
   sender identity, conversation ID, or attachment metadata. */
self.addEventListener('push',function(event){
  event.waitUntil(self.registration.showNotification('Conecta · Nova mensagem',{
    body:'Você recebeu uma nova mensagem.',
    icon:'/icon.svg',
    badge:'/icon.svg',
    tag:'conecta-chat',
    data:{url:'/mensagens'}
  }));
});
self.addEventListener('notificationclick',function(event){
  event.notification.close();
  event.waitUntil((async function(){
    const open=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const page of open){
      if(new URL(page.url).origin===self.location.origin){
        await page.focus();
        await page.navigate('/mensagens');
        return;
      }
    }
    await self.clients.openWindow('/mensagens');
  })());
});
