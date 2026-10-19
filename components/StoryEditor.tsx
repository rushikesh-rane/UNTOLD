
'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
} from 'react';
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  type NodeViewProps,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Markdown } from '@tiptap/markdown';

export type StoryEditorHandle = {
  insertImage: (src: string, alt: string) => void;
  focus: () => void;
};

type StoryEditorProps = {
  value: string;
  onChange: (markdown: string) => void;
  editable?: boolean;
};

function StoryImageNode({
  node,
  deleteNode,
}: NodeViewProps) {
  return (
    <NodeViewWrapper className="story-image-node">
      <div className="story-image-frame">
        <img
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          draggable={false}
        />

        <button
          type="button"
          className="story-image-delete"
          contentEditable={false}
          aria-label="Remove image from chapter"
          title="Remove image"
          onClick={deleteNode}
        >
          ×
        </button>
      </div>
    </NodeViewWrapper>
  );
}

const StoryImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(StoryImageNode);
  },
});

const StoryEditor = forwardRef<StoryEditorHandle, StoryEditorProps>(
  function StoryEditor(
    { value, onChange, editable = true },
    ref
  ) {
    const editor = useEditor({
      extensions: [
        StarterKit,
        StoryImage.configure({
          inline: false,
          allowBase64: false,
        }),
        Markdown,
      ],
      content: value,
      contentType: 'markdown',
      immediatelyRender: false,
      editable,
      onUpdate: ({ editor }) => {
        onChange(editor.getMarkdown());
      },
    });

    useEffect(() => {
      if (!editor) return;

      // Tiptap renders image nodes through React (flushSync), which React forbids while it is
      // still rendering/committing. Deferring to a microtask runs it right after, safely.
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled || editor.isDestroyed) return;
        if (editor.getMarkdown() !== value) {
          editor.commands.setContent(value, {
            contentType: 'markdown',
            emitUpdate: false,
          });
        }
      });

      return () => {
        cancelled = true;
      };
    }, [editor, value]);

    useImperativeHandle(
      ref,
      () => ({
        insertImage(src, alt) {
          if (!editor) return;

          editor
            .chain()
            .focus()
            .setImage({ src, alt })
            .run();
        },
        focus() {
          editor?.commands.focus();
        },
      }),
      [editor]
    );

    return (
      <div className="story-editor">
        <EditorContent editor={editor} />
      </div>
    );
  }
);

export default StoryEditor;
