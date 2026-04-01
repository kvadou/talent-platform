'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  Bars3BottomLeftIcon,
  Bars3Icon,
  Bars3BottomRightIcon,
  ListBulletIcon,
  LinkIcon,
  CodeBracketIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

export interface RichTextEditorRef {
  insertText: (text: string) => void;
  focus: () => void;
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(function RichTextEditor(
  { value, onChange, placeholder, minHeight = '200px' },
  ref
) {
  const [showHtml, setShowHtml] = useState(false);
  const [htmlValue, setHtmlValue] = useState(value);
  const [showLinkPrompt, setShowLinkPrompt] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-brand-purple underline',
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none px-4 py-3',
        style: `min-height: ${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setHtmlValue(html);
      onChange(html);
    },
  });

  // Update editor when value changes externally
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
      setHtmlValue(value);
    }
  }, [value, editor]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      if (editor) {
        editor.chain().focus().insertContent(text).run();
      }
    },
    focus: () => {
      editor?.chain().focus().run();
    },
  }), [editor]);

  // Handle HTML mode changes
  const handleHtmlChange = (newHtml: string) => {
    setHtmlValue(newHtml);
    onChange(newHtml);
    if (editor) {
      editor.commands.setContent(newHtml);
    }
  };

  const addLink = () => {
    setLinkUrl('');
    setShowLinkPrompt(true);
  };

  const handleLinkSubmit = useCallback((url: string) => {
    setShowLinkPrompt(false);
    if (url && editor) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor]);

  const removeLink = () => {
    if (editor) {
      editor.chain().focus().unsetLink().run();
    }
  };

  if (!editor) {
    return (
      <div className="border border-gray-300 rounded-lg p-4 animate-pulse bg-gray-50" style={{ minHeight }} />
    );
  }

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-purple focus-within:border-brand-purple">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50 flex-wrap">
        {/* Text formatting */}
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <BoldIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <ItalicIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Headings */}
        <ToolbarButton
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Heading 1"
        >
          <span className="text-xs font-bold">H1</span>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
        >
          <span className="text-xs font-bold">H2</span>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3"
        >
          <span className="text-xs font-bold">H3</span>
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Text alignment */}
        <ToolbarButton
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          title="Align Left"
        >
          <Bars3BottomLeftIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title="Align Center"
        >
          <Bars3Icon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          title="Align Right"
        >
          <Bars3BottomRightIcon className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Lists */}
        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          <ListBulletIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered List"
        >
          <span className="text-xs font-bold">1.</span>
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Link */}
        <ToolbarButton
          active={editor.isActive('link')}
          onClick={editor.isActive('link') ? removeLink : addLink}
          title={editor.isActive('link') ? 'Remove Link' : 'Add Link'}
        >
          <LinkIcon className="w-4 h-4" />
        </ToolbarButton>

        {/* Spacer */}
        <div className="flex-1" />

        {/* HTML toggle */}
        <button
          type="button"
          onClick={() => setShowHtml(!showHtml)}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
            showHtml
              ? 'bg-brand-purple text-white'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
          }`}
          title={showHtml ? 'Show Editor' : 'Edit HTML'}
        >
          {showHtml ? (
            <>
              <EyeIcon className="w-3.5 h-3.5" />
              Editor
            </>
          ) : (
            <>
              <CodeBracketIcon className="w-3.5 h-3.5" />
              HTML
            </>
          )}
        </button>
      </div>

      {/* Editor / HTML textarea */}
      {showHtml ? (
        <textarea
          value={htmlValue}
          onChange={(e) => handleHtmlChange(e.target.value)}
          className="w-full px-4 py-3 font-mono text-sm focus:outline-none resize-y"
          style={{ minHeight }}
          placeholder={placeholder}
        />
      ) : (
        <EditorContent editor={editor} />
      )}

      <Modal open={showLinkPrompt} onClose={() => setShowLinkPrompt(false)} title="Insert Link">
        <input
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
          placeholder="Enter URL..."
          onKeyDown={(e) => e.key === 'Enter' && handleLinkSubmit(linkUrl)}
          autoFocus
        />
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => setShowLinkPrompt(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
          <button onClick={() => handleLinkSubmit(linkUrl)} className="px-4 py-2 text-white bg-purple-700 rounded-lg hover:bg-purple-800">Insert Link</button>
        </div>
      </Modal>
    </div>
  );
});

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-brand-purple text-white'
          : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  );
}
