import {characterType,type Entity} from './model';
const common=[{key:'role',label:'Роль в истории',max:1000},{key:'motivation',label:'Мотивация',max:3000},{key:'notes',label:'Заметки мастера',max:10000}];
export function characterFields(entity:Entity){return characterType(entity)==='npc'?[
 {key:'appearance',label:'Внешность',max:3000},
 {key:'distinguishingFeatures',label:'Отличительные особенности',max:3000},
 {key:'motivation',label:'Цели и мотивация',max:3000},common[0],common[2],
]:common;}
