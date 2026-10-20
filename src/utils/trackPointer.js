/**
 * Follows the cursor and feeds its position to the panel as CSS custom props,
 * which drive the `.spotlight` edge light in index.css. Written straight to the
 * DOM node (no state) so moving the mouse never triggers a React render.
 */
export default function trackPointer(event) {
  const panel = event.currentTarget;
  const bounds = panel.getBoundingClientRect();
  panel.style.setProperty('--pointer-x', `${event.clientX - bounds.left}px`);
  panel.style.setProperty('--pointer-y', `${event.clientY - bounds.top}px`);
}
