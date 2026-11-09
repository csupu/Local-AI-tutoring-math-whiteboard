/** tldraw whiteboard with keybind tooltips, grid, and theming. */

import { useEffect, useState } from 'react';
import { Tldraw, type Editor } from '@tldraw/tldraw';

interface WhiteboardProps {
  theme: 'dark' | 'light';
  grid: boolean;
  onMount: (editor: Editor) => void;
}

export default function Whiteboard({ theme, grid, onMount }: WhiteboardProps) {
  const [editor, setEditor] = useState<Editor | null>(null);

  useEffect(() => {
    if (!editor) return;
    editor.user.updateUserPreferences({
      colorScheme: theme === 'dark' ? 'dark' : 'light',
      isSnapMode: grid,
    });
  }, [editor, theme, grid]);

  return (
    <Tldraw
      persistenceKey="mathtools-board"
      onMount={(e) => {
        setEditor(e);
        onMount(e);
      }}
    />
  );
}
