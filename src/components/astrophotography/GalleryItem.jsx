export default function GalleryItem({ photo, onClick }) {
  return (
    <div
      className="group relative w-full md:w-[calc(33.33%-16px)] mb-4 overflow-hidden rounded-lg transition-transform duration-300 hover:scale-105 cursor-pointer"
      style={{ boxShadow: '0 0 10px 0 rgba(255, 255, 255, 1)' }}
      onClick={onClick}
    >
      <img
        src={photo.src}
        alt={photo.alt}
        className="w-full h-auto block"
        loading="lazy"
      />
      <div className="absolute bottom-0 left-0 w-full bg-black/70 text-white p-2.5 text-sm opacity-0 translate-y-full transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none caption-overlay">
        {photo.caption}
      </div>
    </div>
  );
}
