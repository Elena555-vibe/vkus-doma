export type RecipeSource = 'shared' | 'personal';
export type Category = 'Выпечка'|'Закуски'|'Супы'|'Салаты'|'Горячее'|'Гарниры'|'Соусы'|'Ароматные заготовки'|'Десерты'|'Напитки'|'Консервация'|'Полуфабрикаты';
export type Ingredient = { id:string; name:string; amount:number|string; unit:string; section?:string };
export type RecipeStep = { id:string; text:string; duration?:string };
export type Recipe = { id:string; source:RecipeSource; ownerId?:string; title:string; category:Category; author?:string; servings:number; time:string; difficulty:string; image?:string; ingredients:Ingredient[]; steps:RecipeStep[]; freezer?:{prep:string; after:string; storage:string; conditions:string} };
export const categories:Category[]=['Выпечка','Закуски','Супы','Салаты','Горячее','Гарниры','Соусы','Ароматные заготовки','Десерты','Напитки','Консервация','Полуфабрикаты'];
export const normalizeCategory = (category: string): Category => {
  if (category === 'Заготовки') return 'Консервация';
  if (category === 'Завтраки' || category === 'Специи') return 'Ароматные заготовки';
  return categories.includes(category as Category) ? category as Category : 'Выпечка';
};
export const units=['г','кг','мл','л','шт.','ст. л.','ч. л.','стак.','°C','°'];
