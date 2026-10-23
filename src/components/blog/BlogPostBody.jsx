import Markdown from 'react-markdown';
import './BlogPostBody.css';

// Shared by the public post page and the editor's preview, so the preview always
// matches what readers see.
const BlogPostBody = ({ title, blocks }) => (
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
                <img
                  src={image.url}
                  alt={image.caption || `${title} photo`}
                  loading="lazy"
                  className="blog-post-body-image"
                />
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
  </div>
);

export default BlogPostBody;
