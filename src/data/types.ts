export type RecipeSource = 'shared' | 'personal';
export type Category = 'Завтраки'|'Закуски'|'Супы'|'Салаты'|'Горячее'|'Гарниры'|'Соусы'|'Выпечка'|'Десерты'|'Напитки'|'Заготовки'|'Полуфабрикаты';
export type Ingredient = { id:string; name:string; amount:number|string; unit:string };
export type RecipeStep = { id:string; text:string; duration?:string };
export type Recipe = { id:string; source:RecipeSource; ownerId?:string; title:string; category:Category; author?:string; servings:number; time:string; difficulty:string; image?:string; ingredients:Ingredient[]; steps:RecipeStep[]; freezer?:{prep:string; after:string; storage:string; conditions:string} };
export const categories:Category[]=['Завтраки','Закуски','Супы','Салаты','Горячее','Гарниры','Соусы','Выпечка','Десерты','Напитки','Заготовки','Полуфабрикаты'];
export const units=['г','кг','мл','л','шт.','ст. л.','ч. л.','стакан','°C','°'];
