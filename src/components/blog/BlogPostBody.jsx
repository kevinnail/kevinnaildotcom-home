import Markdown from 'react-markdown';
import './BlogPostBody.css';

// Shared by the public post page and the editor's preview, so the preview always
// matches what readers see.
const BlogPostBody = ({ blocks }) => (
  <div className="blog-post-body">
    {blocks.map((block) => (
      <div key={block.id} className="blog-post-body-text">
        <Markdown>{block.body}</Markdown>
      </div>
    ))}
  </div>
);

export default BlogPostBody;
