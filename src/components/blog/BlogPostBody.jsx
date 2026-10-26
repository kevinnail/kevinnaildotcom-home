import { useState } from 'react';
import Markdown from 'react-markdown';
import PhotoViewer from './PhotoViewer';
import './BlogPostBody.css';

// Shared by the public post page and the editor's preview, so the preview always
// matches what readers see.
const BlogPostBody = ({ title, blocks }) => {
  const [openPhotoIndex, setOpenPhotoIndex] = useState(null);

  // Every photo in the post, in order, so the viewer steps across images blocks.
  const photos = blocks.flatMap((block) => (block.type === 'images' ? block.images : []));

  return (
    <div className="blog-post-body">
      {blocks.map((block) => {
        if (block.type === 'images') {
          if (block.images.length === 0) return null;
          return (
            <div
              key={block.id}
              className={`blog-post-body-images ${block.images.length > 1 ? 'blog-post-body-images-grid' : ''}`}
            >
              {block.images.map((image) => (
                <figure key={image.imageId} className="blog-post-body-figure">
                  <button
                    type="button"
                    className="blog-post-body-image-button"
                    onClick={() => setOpenPhotoIndex(photos.indexOf(image))}
                    aria-label={`Enlarge ${image.caption || `${title} photo`}`}
                  >
                    <img
                      src={image.url}
                      alt={image.caption || `${title} photo`}
                      loading="lazy"
                      className="blog-post-body-image"
                    />
                  </button>
                  {image.caption && (
                    <figcaption className="blog-post-body-caption">{image.caption}</figcaption>
                  )}
                </figure>
              ))}
            </div>
          );
        }
        return (
          <div key={block.id} className="blog-post-body-text">
            <Markdown>{block.body}</Markdown>
          </div>
        );
      })}

      {openPhotoIndex !== null && (
        <PhotoViewer
          photos={photos}
          index={openPhotoIndex}
          title={title}
          onChangeIndex={setOpenPhotoIndex}
          onClose={() => setOpenPhotoIndex(null)}
        />
      )}
    </div>
  );
};

export default BlogPostBody;
