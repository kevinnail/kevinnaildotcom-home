import homeCards from '../../data/homeCards';
import Card from './Card';
import { COLUMNS, countCells } from './tileSizes';

// Tile sizes come from the `size` field in data/homeCards.js. Two rules keep
// the mosaic from going ragged:
//
// 1. `grid-flow-dense` backfills gaps, so a wide tile that cannot start in the
//    current column no longer strands the cell beside it. Card order and card
//    size are therefore independent — reorder freely. The tradeoff is that
//    visual order can drift from DOM (and so tab) order.
// 2. Dense packing cannot fix a short *final* row: the cells have to total a
//    multiple of the column count. Costs live in tileSizes.js, and the dev
//    warning below reports the totals rather than making you do the math.
if (import.meta.env.DEV) {
  const cells = countCells(homeCards);
  Object.entries(COLUMNS).forEach(([breakpoint, columns]) => {
    const remainder = cells[breakpoint] % columns;
    if (remainder !== 0) {
      console.info(
        `[CardGrid] ${breakpoint}: ${cells[breakpoint]} cells across ${columns} columns ` +
          `leaves the last row ${columns - remainder} short. Adjust a card's \`size\` ` +
          `in src/data/homeCards.js.`,
      );
    }
  });
}

export default function CardGrid() {
  return (
    <div className="mx-auto grid w-full max-w-[1400px] grid-flow-row-dense grid-cols-2 gap-2.5 p-3 auto-rows-[150px] md:auto-rows-[190px] lg:grid-cols-4 lg:gap-3 lg:p-5 lg:auto-rows-[215px]">
      {homeCards.map((card, index) => (
        <Card key={card.title} card={card} index={index} />
      ))}
    </div>
  );
}
