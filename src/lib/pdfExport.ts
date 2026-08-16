import type { Recipe } from '../data/types';

type PdfMakeApi = {
  addVirtualFileSystem: (files: unknown) => void;
  createPdf: (definition: unknown) => { download: (filename: string) => void };
};

const dateLabel = () => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

export async function exportRecipeBook(recipes: Recipe[], ownerName?: string | null) {
  if (!recipes.length) throw new Error('В книге пока нет рецептов для выгрузки.');

  // pdfmake contains embedded Roboto fonts, including Cyrillic characters.
  // It is loaded only when the user requests an export.
  // @ts-expect-error pdfmake does not currently ship TypeScript declarations.
  const pdfModule = await import('pdfmake/build/pdfmake');
  // @ts-expect-error virtual font file has no declaration file.
  const fontsModule = await import('pdfmake/build/vfs_fonts');
  const pdfMake = (pdfModule.default ?? pdfModule) as PdfMakeApi;
  const fonts = fontsModule.default ?? fontsModule;
  pdfMake.addVirtualFileSystem(fonts);

  const groups = [...new Set(recipes.map(recipe => recipe.category))].map(category => ({
    category,
    recipes: recipes.filter(recipe => recipe.category === category),
  }));
  const content: unknown[] = [
    { text: 'Вкус дома', style: 'coverTitle' },
    { text: 'Тёплые рецепты на каждый день', style: 'coverSubtitle' },
    { text: ownerName ? `Книга рецептов: ${ownerName}` : 'Моя кулинарная книга', style: 'coverOwner' },
    { text: `Составлено ${dateLabel()}`, style: 'coverDate' },
    { text: '', pageBreak: 'after' },
    { text: 'Содержание', style: 'tocTitle' },
    { ol: groups.map(group => `${group.category} — ${group.recipes.length}`), style: 'toc' },
  ];

  groups.forEach(group => {
    content.push({ text: group.category, style: 'category', pageBreak: 'before' });
    group.recipes.forEach(recipe => {
      const ingredientGroups = Object.entries(recipe.ingredients.reduce<Record<string, Recipe['ingredients']>>((groups, item) => {
        if (!item.name.trim()) return groups;
        const section = item.section?.trim() || (recipe.category === 'Выпечка' ? 'Тесто' : '');
        (groups[section] ||= []).push(item);
        return groups;
      }, {}));
      const ingredientBlocks = ingredientGroups.flatMap(([section, items]) => [
        ...(section ? [{ text: section, style: 'ingredientSection' }] : []),
        { ul: items.map(item => `${item.name.trim()}${item.amount === '' ? '' : ` — ${item.amount}${item.unit ? ` ${item.unit}` : ''}`}`), style: 'ingredients' },
      ]);
      const steps = recipe.steps
        .filter(step => step.text.trim())
        .map((step, index) => ({ text: `${index + 1}. ${step.text.trim()}${step.duration ? ` (${step.duration})` : ''}`, margin: [0, 0, 0, 6] }));
      const block: unknown[] = [
        { text: recipe.title, style: 'recipeTitle' },
        ...(recipe.author?.trim() ? [{ text: `Автор: ${recipe.author.trim()}`, style: 'author' }] : []),
        { text: [recipe.time, recipe.difficulty, `${recipe.servings} порц.`].filter(Boolean).join(' · '), style: 'meta' },
        ...(ingredientGroups.length ? [{ text: 'Ингредиенты', style: 'sectionTitle' }, ...ingredientBlocks] : []),
        ...(steps.length ? [{ text: 'Приготовление', style: 'sectionTitle' }, { stack: steps, style: 'steps' }] : []),
        ...(recipe.freezer?.prep?.trim() || recipe.freezer?.after?.trim()
          ? [{ text: [recipe.freezer?.prep?.trim() ? `Заморозка: ${recipe.freezer.prep.trim()}` : '', recipe.freezer?.after?.trim() ? `После разморозки: ${recipe.freezer.after.trim()}` : ''].filter(Boolean).join('\n'), style: 'freezer' }]
          : []),
      ];
      content.push({ stack: block, margin: [0, 0, 0, 16] });
    });
  });

  pdfMake.createPdf({
    info: { title: 'Вкус дома — книга рецептов', author: ownerName || 'Вкус дома' },
    pageSize: 'A4',
    pageMargins: [46, 52, 46, 52],
    content,
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#514c49' },
    styles: {
      coverTitle: { fontSize: 40, bold: true, color: '#756181', alignment: 'center', margin: [0, 125, 0, 12] },
      coverSubtitle: { fontSize: 17, color: '#7d7670', alignment: 'center' },
      coverOwner: { fontSize: 15, color: '#604a6e', alignment: 'center', margin: [0, 80, 0, 10] },
      coverDate: { fontSize: 10, color: '#7d7670', alignment: 'center' },
      tocTitle: { fontSize: 25, bold: true, color: '#756181', margin: [0, 0, 0, 18] },
      toc: { fontSize: 12, lineHeight: 1.5 },
      category: { fontSize: 25, bold: true, color: '#756181', margin: [0, 0, 0, 18] },
      recipeTitle: { fontSize: 20, bold: true, color: '#604a6e', margin: [0, 10, 0, 3] },
      author: { fontSize: 10, italics: true, color: '#7d7670', margin: [0, 0, 0, 4] },
      meta: { fontSize: 9, color: '#718561', margin: [0, 0, 0, 12] },
      sectionTitle: { fontSize: 13, bold: true, color: '#756181', margin: [0, 10, 0, 5] },
      ingredientSection: { fontSize: 11, bold: true, color: '#604a6e', margin: [0, 7, 0, 3] },
      ingredients: { fontSize: 10, lineHeight: 1.35 },
      steps: { fontSize: 10, lineHeight: 1.25 },
      freezer: { fontSize: 9, color: '#604a6e', margin: [0, 10, 0, 0] },
    },
    footer: (page: number, pages: number) => ({ text: `Вкус дома · ${page} из ${pages}`, alignment: 'center', fontSize: 8, color: '#8b827f', margin: [0, 12, 0, 0] }),
  }).download(`Вкус-дома-рецепты-${new Date().toISOString().slice(0, 10)}.pdf`);
}
