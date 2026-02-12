export default function SectionHeader({ id, children }) {
  return (
    <h2
      id={id}
      className="text-white w-full border-t border-b border-white py-[5px] font-display bg-black text-2xl md:text-[1.8rem] h-[100px] flex items-center justify-center scroll-mt-0 m-0"
    >
      {children}
    </h2>
  );
}
