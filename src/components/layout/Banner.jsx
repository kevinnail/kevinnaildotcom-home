import { Link } from 'react-router-dom';

export default function Banner() {
  return (
    <header className="w-full bg-gradient-to-br from-white via-[#7a7a7a] to-neon-blue relative overflow-hidden border-b-2 border-neon-blue-50">
      <Link to="/">
        <img
          className="h-[90px] md:h-[150px] block mx-auto"
          src="/images/knBanner.png"
          alt="Kevin Nail"
          title="Kevin Nail"
        />
      </Link>
      <span className="block text-center font-display font-bold text-2xl md:text-[1.6rem] tracking-[1px] pb-[5px]">
        ~ Artistry in Every Medium ~
      </span>
    </header>
  );
}
