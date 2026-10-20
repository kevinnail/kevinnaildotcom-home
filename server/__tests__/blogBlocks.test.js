import { describe, it, expect } from 'vitest';
import { slugify, validateBlocks, toStoredBlocks } from '../lib/utils/blogBlocks.js';

describe('slugify', () => {
  // Otherwise a post's URL keeps capitals and spaces that browsers escape into %20.
  it('lowercases and joins words with single dashes', () => {
    expect(slugify('Sunrise on the Ridge')).toBe('sunrise-on-the-ridge');
  });

  // Otherwise a title with punctuation produces a URL full of doubled dashes.
  it('collapses punctuation and repeated spaces into one dash', () => {
    expect(slugify("M31: Andromeda's   Core, Take 2")).toBe('m31-andromeda-s-core-take-2');
  });

  // Otherwise an accented title loses its letters instead of keeping their base form.
  it('keeps the base letter of accented characters', () => {
    expect(slugify('Café Crème at Mt. Rainier')).toBe('cafe-creme-at-mt-rainier');
  });

  // Otherwise a title wrapped in punctuation gets a URL that starts or ends with a dash.
  it('trims leading and trailing dashes', () => {
    expect(slugify('  --Hello, world!--  ')).toBe('hello-world');
  });

  // Otherwise the create route can't tell a title with no usable characters from a real one.
  it('returns an empty string when nothing alphanumeric remains', () => {
    expect(slugify('!!! 🌌 ???')).toBe('');
  });
});

describe('validateBlocks', () => {
  // Otherwise a brand new draft with no blocks can't be saved.
  it('accepts an empty list', () => {
    expect(validateBlocks([])).toBeNull();
  });

  // Otherwise an empty text block, left while drafting, blocks the save.
  it('accepts text blocks, including an empty body', () => {
    expect(
      validateBlocks([
        { id: 'block-a', type: 'text', body: 'Trailhead at dawn.' },
        { id: 'block-b', type: 'text', body: '' },
      ]),
    ).toBeNull();
  });

  // Otherwise a save with no block list wipes the post's blocks.
  it('rejects anything that is not a list', () => {
    expect(validateBlocks(undefined)).toBe('Blocks must be a list');
    expect(validateBlocks({ id: 'block-a', type: 'text', body: '' })).toBe('Blocks must be a list');
  });

  // Otherwise a stray value in the list is stored as a block the post page can't draw.
  it('rejects a block that is not an object, naming its position', () => {
    expect(validateBlocks([{ id: 'block-a', type: 'text', body: '' }, 'loose text'])).toBe(
      'Block 2 must be an object',
    );
    expect(validateBlocks([null])).toBe('Block 1 must be an object');
  });

  // Otherwise the editor loses track of which block is which after a reload.
  it('rejects a missing or empty id', () => {
    expect(validateBlocks([{ type: 'text', body: '' }])).toBe('Block 1 needs an id');
    expect(validateBlocks([{ id: '', type: 'text', body: '' }])).toBe('Block 1 needs an id');
  });

  // Otherwise moving or removing one of two same-id blocks hits both.
  it('rejects a repeated id', () => {
    expect(
      validateBlocks([
        { id: 'block-a', type: 'text', body: 'one' },
        { id: 'block-a', type: 'text', body: 'two' },
      ]),
    ).toBe('Block 2 repeats the id of an earlier block');
  });

  // Otherwise a block of a kind the post page doesn't know how to draw gets stored.
  it('rejects a missing or unknown type', () => {
    expect(validateBlocks([{ id: 'block-a', body: '' }])).toBe('Block 1 has an unknown type');
    expect(validateBlocks([{ id: 'block-a', type: 'video', url: 'x' }])).toBe(
      'Block 1 has an unknown type',
    );
  });

  // Otherwise a text block with no body or a number for its body is stored.
  it('rejects a text body that is not a string', () => {
    expect(validateBlocks([{ id: 'block-a', type: 'text', body: 42 }])).toBe(
      'Block 1 text must be a string',
    );
    expect(validateBlocks([{ id: 'block-a', type: 'text' }])).toBe('Block 1 text must be a string');
  });
});

describe('toStoredBlocks', () => {
  // Otherwise whatever extra fields the client sends are saved into the post.
  it('keeps only the id, type and body', () => {
    expect(
      toStoredBlocks([{ id: 'block-a', type: 'text', body: 'Trailhead.', extra: true }]),
    ).toEqual([{ id: 'block-a', type: 'text', body: 'Trailhead.' }]);
  });
});
