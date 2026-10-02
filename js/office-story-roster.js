/* Adapt character references on a story copy. The authored cards, IDs, timing,
   choices and scoring fields stay in the original story files. */
(function(global){
 const R=global.WorkSimRoster;
 global.adaptStoryToRoster=function(story,team,gender='m'){
  const aliases=new Map(),bindings=new Map();
  const legacyRoleIds={acnh_18:'acnh_52',acnh_19:'acnh_55',acnh_37:'acnh_19'};
  const friendGender={'윤하린':'f','정수빈':'f','임도윤':'m','백하은':'f','차은우':'m','하지원':'f'};
  const teamNames=Object.fromEntries(R.data.characters.map(c=>[c.team_name,c.team_code]));
  const own=R.team(team),player=R.player(team,gender),peer=own.find(c=>c.player_selectable&&c.model_id!==player.model_id);
  for(const [name,info] of Object.entries(story.npcs||{})){
   let row=R.byId(story.fixed_roster_version ? info.ch : (legacyRoleIds[info.ch]||info.ch));
   if(info.binding==='peer')row=peer;
   else if(info.binding==='player')row=player;
   else if(story.fixed_roster_version){if(row){aliases.set(name,row.display_name);bindings.set(row.display_name,row);}continue;}
   if(['lead','senior','chief'].includes(info.seat))row=own.find(c=>c.seat_id===info.seat)||row;
   else if(info.seat==='staff'||info.role==='동기')row=peer;
   else if(!info.seat&&!info.role&&/동기|신입/.test(info.persona?.note||'')){
    const department=Object.keys(teamNames).find(n=>(info.persona?.note||'').includes(n));
    row=department?R.player(teamNames[department],friendGender[name]||'f'):peer;
   }
   if(row){aliases.set(name,row.display_name);bindings.set(row.display_name,row);}
  }
  const replacements=[...aliases].sort((a,b)=>b[0].length-a[0].length);
  function text(value){let result=value;for(const [from,to] of replacements)result=result.split(from).join(to);return result;}
  const protectedKeys=new Set(['id','ch','model_id','teamKey','team_code','seat','requires','code']);
  function walk(value,key){
   if(typeof value==='string')return protectedKeys.has(key)?value:text(value);
   if(Array.isArray(value))return value.map(v=>walk(v,key));
   if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[aliases.get(k)||k,walk(v,k)]));
   return value;
  }
  const adapted=walk(story,'');
  for(const [name,info] of Object.entries(adapted.npcs||{})){
   const row=bindings.get(name)||R.byId(info.ch);if(!row)continue;info.ch=row.model_id;
   info.role=row.title;info.teamKey=row.team_code;info.team=row.team_name;
   if(row.team_code===team)info.seat=row.seat_id;else delete info.seat;
  }
  for(const target of adapted.dests||[]){
   const row=R.data.characters.find(c=>c.display_name===target.name);
   if(row){target.teamKey=row.team_code;if(row.team_code===team)target.seat=row.seat_id;else delete target.seat;}
  }
  // Persisted trust keys from earlier progress retain their values by identity.
  adapted.character_aliases=Object.fromEntries(aliases);
  return adapted;
 };
 global.officePersonName=function(name){
  const story=typeof D!=='undefined'?D:null;
  const info=story?.npcs?.[name];const row=R.byId(info?.ch);
  return row?.display_name||story?.character_aliases?.[name]||name;
 };
})(window);
