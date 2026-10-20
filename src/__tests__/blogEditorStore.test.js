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
});
