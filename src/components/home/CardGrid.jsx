import homeCards from '../../data/homeCards';
import Card from './Card';

export default function CardGrid() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 p-[5px] justify-items-center items-center lg:grid-rows-[300px_300px]">
      {homeCards.map((card) => (
        <Card key={card.title} card={card} />
      ))}
    </div>
  );
}
