/** Склоняет «порция» для числительных: 1 порция, 2 порции, 5 порций. */
export function formatServings(value: number): string {
  const absolute = Math.abs(value);
  if (!Number.isFinite(absolute)) return 'порций';

  // Дробные значения в рецепте тоже возможны: «1,5 порции».
  if (!Number.isInteger(absolute)) return 'порции';

  const lastTwo = absolute % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return 'порций';

  switch (absolute % 10) {
    case 1: return 'порция';
    case 2:
    case 3:
    case 4: return 'порции';
    default: return 'порций';
  }
}

export function servingsLabel(value: number): string {
  return `${value} ${formatServings(value)}`;
}
