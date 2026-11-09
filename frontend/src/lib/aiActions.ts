/** Apply AI-returned board actions. Strictly additive: the AI can only add shapes. */

import type { Editor } from '@tldraw/tldraw';
import type { AiAction } from './ws';

const SHAPE_KINDS = new Set(['rectangle', 'ellipse', 'line', 'arrow']);
const SIZES = new Set(['s', 'm', 'l', 'xl']);
const COLORS = new Set([
  'black', 'grey', 'lightgrey', 'brown', 'orange', 'red', 'darkorange',
  'darkred', 'pink', 'lightgreen', 'green', 'darkgreen', 'skyblue',
  'blue', 'darkblue', 'purple', 'yellow',
]);

function aiId(): string {
  return `shape_ai${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function viewportCenter(editor: Editor): { x: number; y: number } {
  const cam = editor.getCamera();
  const vp = editor.getViewportScreenBounds();
  return {
    x: (vp.w / 2 - cam.x) / cam.z,
    y: (vp.h / 2 - cam.y) / cam.z,
  };
}

/**
 * Create the AI's proposed shapes relative to the viewport center.
 * Returns the IDs of every shape that was created (for "Undo AI changes").
 */
export function applyAiActions(editor: Editor, actions: AiAction[]): string[] {
  const created: string[] = [];
  const c = viewportCenter(editor);

  actions.slice(0, 5).forEach((action, i) => {
    const dy = i * 140;
    const color = COLORS.has(action.color ?? '') ? (action.color as string) : 'blue';
    const base = {
      x: (action.x ?? 0),
      y: (action.y ?? 0),
    };

    if (action.op === 'add_text' && typeof action.text === 'string' && action.text.trim()) {
      const shapeId = aiId();
      editor.createShapes([
        {
          id: shapeId,
          type: 'text',
          props: {
            x: c.x - 220 + base.x,
            y: c.y - 260 + base.y + dy,
            w: 440,
            h: 80,
            text: action.text,
            color,
            size: SIZES.has(action.size ?? '') ? (action.size as 's' | 'm' | 'l' | 'xl') : 'm',
            fontFamily: 'code',
            meta: { ai: true },
          },
        },
      ] as never);
      created.push(shapeId);
      return;
    }

    if (action.op === 'add_shape' && SHAPE_KINDS.has(action.shape ?? '')) {
      const shapeId = aiId();
      editor.createShapes([
        {
          id: shapeId,
          type: action.shape,
          props: {
            x: c.x - 180 + base.x,
            y: c.y - 200 + base.y + dy,
            w: Math.min(1400, Math.max(40, action.w ?? 280)),
            h: Math.min(900, Math.max(40, action.h ?? 140)),
            color,
            fill: 'semi-transparent',
            meta: { ai: true },
          },
        },
      ] as never);
      created.push(shapeId);
    }
  });

  return created;
}

/** Delete only the shapes the AI created. Student work is never touched. */
export function undoAiActions(editor: Editor, ids: string[]): void {
  const live = ids.filter((id) => editor.getShape(id as never) != null);
  if (live.length) editor.deleteShapes(live as never);
}
