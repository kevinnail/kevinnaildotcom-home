/**
 * The mosaic tile vocabulary, in one place so the grid classes and the layout
 * math can never drift apart.
 *
 * `wide` collapses to a single cell on small screens so mobile stays a plain
 * two-column stack; `hero` and `tall` keep their shape at every breakpoint.
 */
export const spanClasses = {
  hero: 'col-span-2 row-span-2',
  wide: 'lg:col-span-2',
  tall: 'row-span-2',
  default: '',
};

/** Grid cells each size consumes, per breakpoint. */
export const cellCost = {
  hero: { desktop: 4, mobile: 4 },
  wide: { desktop: 2, mobile: 1 },
  tall: { desktop: 2, mobile: 2 },
  default: { desktop: 1, mobile: 1 },
};

export const COLUMNS = { desktop: 4, mobile: 2 };

/** Total cells the given cards occupy at each breakpoint. */
export function countCells(cards) {
  return cards.reduce(
    (totals, card) => {
      const cost = cellCost[card.size] ?? cellCost.default;
      return {
        desktop: totals.desktop + cost.desktop,
        mobile: totals.mobile + cost.mobile,
      };
    },
    { desktop: 0, mobile: 0 },
  );
}
