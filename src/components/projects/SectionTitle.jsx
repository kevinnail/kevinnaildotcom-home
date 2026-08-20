// Shared section heading for the projects-page tabs: a plain title, no rail,
// no tracked caps.
export default function SectionTitle({ children }) {
  return (
    <h2 className="m-0 font-display text-2xl font-bold leading-[1.1] tracking-[0.5px] text-white">
      {children}
    </h2>
  );
}
