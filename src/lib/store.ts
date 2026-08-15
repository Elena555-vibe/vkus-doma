import type {Recipe} from '../data/types';
const key='vkus-doma-state'; type State={recipes:Recipe[];favorites:string[];notes:Record<string,string>;cloudSynced?:boolean};
const empty=():State=>({recipes:[],favorites:[],notes:{}});
const get=():State=>{try{const saved=JSON.parse(localStorage.getItem(key)||'');return saved&&Array.isArray(saved.recipes)?saved:empty()}catch{return empty()}};
const personalOnly=(state:State):State=>({recipes:state.recipes.filter(recipe=>recipe.source==='personal'),favorites:state.favorites,notes:state.notes});
export const repo={load:()=>{const state=get();return state.cloudSynced?state:personalOnly(state)},save:(s:State)=>localStorage.setItem(key,JSON.stringify(s)),replaceCloud:(s:State)=>repo.save({...s,cloudSynced:true}),upsert:(recipe:Recipe)=>{const s=repo.load();s.recipes=s.recipes.some(x=>x.id===recipe.id)?s.recipes.map(x=>x.id===recipe.id?recipe:x):[recipe,...s.recipes];repo.save(s)},remove:(id:string)=>{const s=repo.load();s.recipes=s.recipes.filter(x=>x.id!==id);s.favorites=s.favorites.filter(x=>x!==id);delete s.notes[id];repo.save(s)},clear:()=>repo.save(empty())};
