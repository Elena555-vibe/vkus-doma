import type { Recipe } from '../data/types';

export type BookBackup = {
  format: 'vkus-doma-book';
  version: 1;
  exportedAt: string;
  recipes: Recipe[];
  favorites: string[];
  notes: Record<string, string>;
};

const isRecipe = (value: unknown): value is Recipe => {
  if (!value || typeof value !== 'object') return false;
  const recipe = value as Partial<Recipe>;
  return typeof recipe.id === 'string' && typeof recipe.title === 'string' && Array.isArray(recipe.ingredients) && Array.isArray(recipe.steps);
};

const asDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

export const createBookBackup = async (state: { recipes: Recipe[]; favorites: string[]; notes: Record<string, string> }, imageUrl: (path: string) => string) : Promise<BookBackup> => ({
  format: 'vkus-doma-book',
  version: 1,
  exportedAt: new Date().toISOString(),
  // The common book is loaded from the server. A backup contains only the
  // user's own recipes, while keeping their favorites and personal notes.
  recipes: await Promise.all(state.recipes.filter(recipe => recipe.source === 'personal').map(async recipe => {
    if (!recipe.image || recipe.image.startsWith('data:')) return recipe;
    try {
      const response = await fetch(imageUrl(recipe.image));
      if (!response.ok) throw new Error('Image unavailable');
      return { ...recipe, image: await asDataUrl(await response.blob()) };
    } catch { return recipe; }
  })),
  favorites: [...new Set(state.favorites.filter(item => typeof item === 'string'))],
  notes: Object.fromEntries(Object.entries(state.notes).filter(([id, note]) => typeof id === 'string' && typeof note === 'string')),
});

export const parseBookBackup = (text: string): BookBackup => {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('Не удалось прочитать файл. Выберите резервную копию «Вкус дома».'); }
  if (!raw || typeof raw !== 'object') throw new Error('Файл резервной копии повреждён.');
  const backup = raw as Partial<BookBackup>;
  if (backup.format !== 'vkus-doma-book' || backup.version !== 1 || !Array.isArray(backup.recipes) || !backup.recipes.every(isRecipe)) throw new Error('Это не резервная копия «Вкус дома» или её формат устарел.');
  return {
    format: 'vkus-doma-book',
    version: 1,
    exportedAt: typeof backup.exportedAt === 'string' ? backup.exportedAt : '',
    recipes: backup.recipes.map(recipe => ({ ...recipe, source: 'personal' as const })),
    favorites: Array.isArray(backup.favorites) ? backup.favorites.filter(item => typeof item === 'string') : [],
    notes: backup.notes && typeof backup.notes === 'object' ? Object.fromEntries(Object.entries(backup.notes).filter(([id, note]) => typeof id === 'string' && typeof note === 'string')) : {},
  };
};

export const downloadBookBackup = async (state: { recipes: Recipe[]; favorites: string[]; notes: Record<string, string> }, imageUrl: (path: string) => string) => {
  const backup = await createBookBackup(state, imageUrl);
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vkus-doma-book-${stamp}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};
