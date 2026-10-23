import { describe, it, expect, beforeEach } from 'vitest';
import { useBlogEditorStore } from '../stores/blogEditorStore';

const savedPost = {
  id: '6f1d2c3b-0000-4000-8000-000000000007',
  slug: 'ridge-hike',
  title: 'Ridge Hike',
  category: 'Hiking',
  summary: 'Two days up the ridge.',
  blocks: [
    { id: 'block-a', type: 'text', body: 'Trailhead at dawn.' },
    { id: 'block-b', type: 'text', body: 'The ridge above camp.' },
    { id: 'block-c', type: 'text', body: 'Back at the car.' },
  ],
};

const blockIds = () => useBlogEditorStore.getState().blocks.map((block) => block.id);

describe('blogEditorStore', () => {
  beforeEach(() => {
    useBlogEditorStore.getState().reset();
  });

  // Otherwise the editor opens a saved post with empty fields.
  it('loads a saved post title, category, summary and blocks', () => {
    useBlogEditorStore.getState().loadPost(savedPost);

    const { title, category, summary, blocks } = useBlogEditorStore.getState();
    expect(title).toBe('Ridge Hike');
    expect(category).toBe('Hiking');
    expect(summary).toBe('Two days up the ridge.');
    expect(blocks).toEqual(savedPost.blocks);
  });

  // Otherwise opening a second post shows the first post's blocks.
  it('reset clears everything a loaded post put in the store', () => {
    useBlogEditorStore.getState().loadPost(savedPost);
    useBlogEditorStore.getState().reset();

    const { title, category, summary, blocks } = useBlogEditorStore.getState();
    expect({ title, category, summary, blocks }).toEqual({
      title: '',
      category: '',
      summary: '',
      blocks: [],
    });
  });

  // Otherwise two new blocks share an id and editing one changes both.
  it('adds an empty text block at the end with a fresh unique id', () => {
    useBlogEditorStore.getState().loadPost(savedPost);
    useBlogEditorStore.getState().addTextBlock();
    useBlogEditorStore.getState().addTextBlock();

    const { blocks } = useBlogEditorStore.getState();
    expect(blocks).toHaveLength(5);
    expect(blocks[3]).toEqual({ id: expect.any(String), type: 'text', body: '' });
    expect(new Set(blockIds()).size).toBe(5);
  });

  // Otherwise Remove takes out the wrong block.
  it('removes only the named block', () => {
    useBlogEditorStore.getState().loadPost(savedPost);
    useBlogEditorStore.getState().removeBlock('block-b');

    expect(blockIds()).toEqual(['block-a', 'block-c']);
  });

  // Otherwise Move up and Move down put blocks in the wrong place.
  it('moves a block up and down', () => {
    useBlogEditorStore.getState().loadPost(savedPost);
    useBlogEditorStore.getState().moveBlock('block-c', -1);
    expect(blockIds()).toEqual(['block-a', 'block-c', 'block-b']);

    useBlogEditorStore.getState().moveBlock('block-a', 1);
    expect(blockIds()).toEqual(['block-c', 'block-a', 'block-b']);
  });

  // Otherwise moving past either end drops a block or wraps it around.
  it('does nothing when moving the first block up or the last block down', () => {
    useBlogEditorStore.getState().loadPost(savedPost);
    useBlogEditorStore.getState().moveBlock('block-a', -1);
    useBlogEditorStore.getState().moveBlock('block-c', 1);

    expect(blockIds()).toEqual(['block-a', 'block-b', 'block-c']);
  });

  // Otherwise typing in one text block changes another.
  it('updates the text of only the named block', () => {
    useBlogEditorStore.getState().loadPost(savedPost);
    useBlogEditorStore.getState().updateText('block-b', 'The **ridge** in fog.');

    const { blocks } = useBlogEditorStore.getState();
    expect(blocks[1]).toEqual({ id: 'block-b', type: 'text', body: 'The **ridge** in fog.' });
    expect(blocks[0].body).toBe('Trailhead at dawn.');
    expect(blocks[2].body).toBe('Back at the car.');
  });

  // Otherwise edits to the title, category or summary are lost on save.
  it('updates title, category and summary', () => {
    useBlogEditorStore.getState().setTitle('Ridge Hike, Day Two');
    useBlogEditorStore.getState().setCategory('Backpacking');
    useBlogEditorStore.getState().setSummary('Three days to Table Lake.');

    const { title, category, summary } = useBlogEditorStore.getState();
    expect({ title, category, summary }).toEqual({
      title: 'Ridge Hike, Day Two',
      category: 'Backpacking',
      summary: 'Three days to Table Lake.',
    });
  });

  describe('image blocks', () => {
    const uploadedImages = [
      { id: 'image-1', url: 'https://media.example.com/blog/ridge.webp' },
      { id: 'image-2', url: 'https://media.example.com/blog/camp.webp' },
      { id: 'image-3', url: 'https://media.example.com/blog/summit.webp' },
    ];

    const addImagesBlockWithUploads = () => {
      useBlogEditorStore.getState().loadPost(savedPost);
      useBlogEditorStore.getState().addImagesBlock();
      const imagesBlock = useBlogEditorStore.getState().blocks[3];
      useBlogEditorStore.getState().addImages(imagesBlock.id, uploadedImages);
      return imagesBlock.id;
    };

    const imagesOf = (blockId) =>
      useBlogEditorStore.getState().blocks.find((block) => block.id === blockId).images;

    // Otherwise Add photos has nowhere to put the uploads, or adds them to the wrong place.
    it('adds an empty images block at the end', () => {
      useBlogEditorStore.getState().loadPost(savedPost);
      useBlogEditorStore.getState().addImagesBlock();

      const { blocks } = useBlogEditorStore.getState();
      expect(blocks).toHaveLength(4);
      expect(blocks[3]).toEqual({ id: expect.any(String), type: 'images', images: [] });
    });

    // Otherwise a second batch of photos replaces the first instead of joining it.
    it('appends uploaded images with an empty caption, and later uploads after them', () => {
      const blockId = addImagesBlockWithUploads();
      useBlogEditorStore
        .getState()
        .addImages(blockId, [{ id: 'image-4', url: 'https://media.example.com/blog/lake.webp' }]);

      expect(imagesOf(blockId)).toEqual([
        { imageId: 'image-1', url: 'https://media.example.com/blog/ridge.webp', caption: '' },
        { imageId: 'image-2', url: 'https://media.example.com/blog/camp.webp', caption: '' },
        { imageId: 'image-3', url: 'https://media.example.com/blog/summit.webp', caption: '' },
        { imageId: 'image-4', url: 'https://media.example.com/blog/lake.webp', caption: '' },
      ]);
    });

    // Otherwise Remove takes out the wrong photo.
    it('removes only the named image', () => {
      const blockId = addImagesBlockWithUploads();
      useBlogEditorStore.getState().removeImage(blockId, 'image-2');

      expect(imagesOf(blockId).map((image) => image.imageId)).toEqual(['image-1', 'image-3']);
    });

    // Otherwise Move left and Move right put photos in the wrong place or drop one past an end.
    it('moves an image left and right, and does nothing past either end', () => {
      const blockId = addImagesBlockWithUploads();
      useBlogEditorStore.getState().moveImage(blockId, 'image-3', -1);
      expect(imagesOf(blockId).map((image) => image.imageId)).toEqual([
        'image-1',
        'image-3',
        'image-2',
      ]);

      useBlogEditorStore.getState().moveImage(blockId, 'image-1', -1);
      useBlogEditorStore.getState().moveImage(blockId, 'image-2', 1);
      expect(imagesOf(blockId).map((image) => image.imageId)).toEqual([
        'image-1',
        'image-3',
        'image-2',
      ]);
    });

    // Otherwise typing one photo's caption changes another's.
    it('updates the caption of only the named image', () => {
      const blockId = addImagesBlockWithUploads();
      useBlogEditorStore.getState().updateCaption(blockId, 'image-2', 'Camp at dusk');

      expect(imagesOf(blockId).map((image) => image.caption)).toEqual(['', 'Camp at dusk', '']);
    });

    // Otherwise editing photos changes the post's text blocks.
    it('leaves text blocks untouched while editing images', () => {
      const blockId = addImagesBlockWithUploads();
      useBlogEditorStore.getState().removeImage(blockId, 'image-1');

      expect(useBlogEditorStore.getState().blocks.slice(0, 3)).toEqual(savedPost.blocks);
    });
  });
});
