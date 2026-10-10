/**
 * Conecta V2 visual tokens, aligned with web/src/app/globals.css.
 * These colors intentionally match the site brand rather than RN defaults.
 */
export const theme={
 bg:'#F9F9FE',
 surface:'#FFFFFF',
 primary:'#8055F5',
 primaryDark:'#6651E5',
 dark:'#16213F',
 muted:'#75809D',
 line:'#E9EAF6',
 pink:'#F77A9D',
 mint:'#DCF8F0',
 subtle:'#F3EEFF',
 danger:'#BE3054',
 success:'#187C5A',
 warning:'#AC661A',
 aqua:'#49CCF5',
 softBlue:'#EEF8FF',
 shadow:'#302E70'
} as const;
export const formatDate=(value:string)=>new Date(value).toLocaleDateString('pt-BR',{
 day:'2-digit',month:'short'
});
