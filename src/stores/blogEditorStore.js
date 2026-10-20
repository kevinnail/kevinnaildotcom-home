import { create } from 'zustand';

const emptyPost = { title: '', category: '', summary: '', blocks: [] };

const moveItem = (items, fromIndex, direction) => {
  const toIndex = fromIndex + direction;
  if (fromIndex === -1 || toIndex < 0 || toIndex >= items.length) return items;

  const moved = [...items];
  [moved[fromIndex], moved[toIndex]] = [moved[toIndex], moved[fromIndex]];
  return moved;
};

export const useBlogEditorStore = create((set) => ({
  ...emptyPost,

  loadPost: (post) =>
    set({
      title: post.title,
      category: post.category,
      summary: post.summary,
      blocks: post.blocks,
    }),

  // Called when the editor unmounts so one post's blocks never leak into the next.
  reset: () => set(emptyPost),

  setTitle: (title) => set({ title }),

  setCategory: (category) => set({ category }),

  setSummary: (summary) => set({ summary }),

  addTextBlock: () =>
    set((state) => ({
      blocks: [...state.blocks, { id: crypto.randomUUID(), type: 'text', body: '' }],
    })),

  removeBlock: (blockId) =>
    set((state) => ({ blocks: state.blocks.filter((block) => block.id !== blockId) })),

  moveBlock: (blockId, direction) =>
    set((state) => ({
      blocks: moveItem(
        state.blocks,
        state.blocks.findIndex((block) => block.id === blockId),
        direction,
      ),
    })),

  updateText: (blockId, body) =>
    set((state) => ({
      blocks: state.blocks.map((block) => (block.id === blockId ? { ...block, body } : block)),
    })),
}));
