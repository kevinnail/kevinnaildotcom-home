import { create } from 'zustand';

const emptyPost = { title: '', category: '', summary: '', blocks: [] };

const moveItem = (items, fromIndex, direction) => {
  const toIndex = fromIndex + direction;
  if (fromIndex === -1 || toIndex < 0 || toIndex >= items.length) return items;

  const moved = [...items];
  [moved[fromIndex], moved[toIndex]] = [moved[toIndex], moved[fromIndex]];
  return moved;
};

const updateImages = (blocks, blockId, changeImages) =>
  blocks.map((block) =>
    block.id === blockId ? { ...block, images: changeImages(block.images) } : block,
  );

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

  addImagesBlock: () =>
    set((state) => ({
      blocks: [...state.blocks, { id: crypto.randomUUID(), type: 'images', images: [] }],
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

  addImages: (blockId, uploadedImages) =>
    set((state) => ({
      blocks: updateImages(state.blocks, blockId, (images) => [
        ...images,
        ...uploadedImages.map((uploaded) => ({
          imageId: uploaded.id,
          url: uploaded.url,
          caption: '',
        })),
      ]),
    })),

  removeImage: (blockId, imageId) =>
    set((state) => ({
      blocks: updateImages(state.blocks, blockId, (images) =>
        images.filter((image) => image.imageId !== imageId),
      ),
    })),

  moveImage: (blockId, imageId, direction) =>
    set((state) => ({
      blocks: updateImages(state.blocks, blockId, (images) =>
        moveItem(
          images,
          images.findIndex((image) => image.imageId === imageId),
          direction,
        ),
      ),
    })),

  updateCaption: (blockId, imageId, caption) =>
    set((state) => ({
      blocks: updateImages(state.blocks, blockId, (images) =>
        images.map((image) => (image.imageId === imageId ? { ...image, caption } : image)),
      ),
    })),
}));
