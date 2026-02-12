export default function AnchorNav() {
  return (
    <nav className="flex justify-around bg-black py-2">
      {['resume', 'projects', 'diagrams'].map((id) => (
        <a
          key={id}
          href={`#${id}`}
          className="no-underline text-white font-bold px-2.5 py-1.5 text-base lg:text-[1.4rem] rounded-md border-2 border-transparent bg-black font-display tracking-[5px] transition-all duration-500 lg:hover:bg-white lg:hover:text-black lg:hover:scale-110 lg:hover:bg-gradient-to-br lg:hover:from-white lg:hover:via-[#7a7a7a] lg:hover:to-neon-blue capitalize"
        >
          {id}
        </a>
      ))}
    </nav>
  );
}
