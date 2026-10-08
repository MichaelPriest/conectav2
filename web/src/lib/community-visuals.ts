/** Neutral visual defaults for platform-created communities until a real cover is uploaded. */
const art:Record<string,{emoji:string;gradient:string}>={
 'musica-playlists':{emoji:'🎵',gradient:'linear-gradient(125deg,#a68bed,#5147a6,#f48fc3)'},
 'fotografia':{emoji:'📸',gradient:'linear-gradient(125deg,#6bcad6,#667bd8,#b3e7f7)'},
 'games':{emoji:'🎮',gradient:'linear-gradient(125deg,#51468c,#9a72dd,#49c5dd)'},
 'tecnologia-ia':{emoji:'🤖',gradient:'linear-gradient(125deg,#408fc9,#513ca9,#83e2ed)'},
 'arte-criatividade':{emoji:'🎨',gradient:'linear-gradient(125deg,#eb84a6,#cc70d5,#f6bf7f)'},
 'livros-historias':{emoji:'📚',gradient:'linear-gradient(125deg,#ddae73,#be7ebd,#856cd7)'},
 'cinema-series':{emoji:'🎬',gradient:'linear-gradient(125deg,#6d527e,#c15ba2,#e4a2b9)'},
 'viagens-cultura':{emoji:'🌍',gradient:'linear-gradient(125deg,#59bbb7,#91c58a,#88d8eb)'},
 'esportes-movimento':{emoji:'🏅',gradient:'linear-gradient(125deg,#63b8a2,#42a3b4,#a6dca9)'},
 'comunidade-conecta':{emoji:'💜',gradient:'linear-gradient(125deg,#926bea,#d587db,#7bc9f6)'}
};
export function communityVisual(slug:string){
 return art[slug]||{emoji:'✨',gradient:'linear-gradient(125deg,#8e75eb,#6fc3da)'};
}
