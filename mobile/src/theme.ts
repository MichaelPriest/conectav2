export const theme={
 bg:'#F7F5FA',surface:'#FFFFFF',primary:'#6040B6',primaryDark:'#392171',
 dark:'#22183B',muted:'#766D84',line:'#EAE4F2',pink:'#E66EA0',mint:'#DDF5EA',
 subtle:'#F0ECFA',danger:'#BB3153'
} as const;
export const formatDate=(value:string)=>new Date(value).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
