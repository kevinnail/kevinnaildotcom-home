import { describe, it, expect } from 'vitest';
import { slugify } from '../lib/utils/blogBlocks.js';

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
