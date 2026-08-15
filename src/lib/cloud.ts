import type { Recipe } from '../data/types';

const tokenKey = 'vkus-doma-cloud-token';
// Один API используется и на Timeweb, и в ранее установленной версии GitHub Pages.
const apiUrl = import.meta.env.VITE_API_URL || 'https://ck663923.tw1.ru/vkus-doma/api/index.php';

export type CloudUser = { id:string; email:string; isAdmin:boolean };
export type CloudState = { recipes:Recipe[]; favorites:string[]; notes:Record<string,string> };

let sessionToken = localStorage.getItem(tokenKey) || '';

async function request<T>(action:string, options:RequestInit = {}):Promise<T>{
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set('Content-Type','application/json');
  if (sessionToken) headers.set('Authorization',`Bearer ${sessionToken}`);
  const response = await fetch(`${apiUrl}?action=${encodeURIComponent(action)}`,{...options,headers});
  const data = await response.json().catch(()=>({error:'Сервер вернул некорректный ответ.'}));
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить запрос.');
  return data as T;
}

export const cloud={
  hasSession:()=>Boolean(sessionToken),
  clear:()=>{sessionToken='';localStorage.removeItem(tokenKey)},
  me:async()=> (await request<{user:CloudUser}>('auth.me')).user,
  register:async(email:string,password:string)=>{const data=await request<{token:string,user:CloudUser}>('auth.register',{method:'POST',body:JSON.stringify({email,password})});sessionToken=data.token;localStorage.setItem(tokenKey,data.token);return data.user},
  login:async(email:string,password:string)=>{const data=await request<{token:string,user:CloudUser}>('auth.login',{method:'POST',body:JSON.stringify({email,password})});sessionToken=data.token;localStorage.setItem(tokenKey,data.token);return data.user},
  logout:async()=>{try{await request('auth.logout',{method:'POST'})}finally{cloud.clear()}},
  requestPasswordReset:async(email:string)=>request('auth.password-reset.request',{method:'POST',body:JSON.stringify({email})}),
  resetPassword:async(token:string,password:string)=>request('auth.password-reset.confirm',{method:'POST',body:JSON.stringify({token,password})}),
  load:async():Promise<CloudState>=>{const [recipes,favorites,notes]=await Promise.all([request<{recipes:Recipe[]}>('recipes.list'),request<{favorites:string[]}>('favorites.list'),request<{notes:Record<string,string>}>('notes.list')]);return {recipes:recipes.recipes,favorites:favorites.favorites,notes:notes.notes}},
  loadPublic:async():Promise<Recipe[]>=> (await request<{recipes:Recipe[]}>('recipes.public')).recipes,
  createRecipe:async(recipe:Recipe)=>request<{recipe:Recipe}>('recipes.create',{method:'POST',body:JSON.stringify(recipe)}),
  updateRecipe:async(recipe:Recipe)=>request<{recipe:Recipe}>('recipes.update&id='+encodeURIComponent(recipe.id),{method:'PUT',body:JSON.stringify(recipe)}),
  deleteRecipe:async(id:string)=>request('recipes.delete&id='+encodeURIComponent(id),{method:'DELETE'}),
  toggleFavorite:async(recipeId:string)=>request<{isFavorite:boolean}>('favorites.toggle',{method:'POST',body:JSON.stringify({recipeId})}),
  saveNote:async(recipeId:string,note:string)=>request('notes.save',{method:'POST',body:JSON.stringify({recipeId,note})}),
  uploadImage:async(file:File)=>{const form=new FormData();form.append('image',file);return request<{path:string}>('uploads.image',{method:'POST',body:form})},
  imageUrl:(path:string)=>path.startsWith('http')||path.startsWith('data:')?path:`${import.meta.env.BASE_URL}${path.replace(/^\//,'')}`,
};
