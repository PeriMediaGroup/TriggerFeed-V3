"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TipTapLink from "@tiptap/extension-link";
import { Link2, List, ListOrdered } from "lucide-react";

import {
  normalizePostBodyForEditor,
  sanitizeRichPostHtml,
} from "@/features/posts/lib/richText";

function normalizeLinkHref(value = "") {
  const href = `${value}`.trim();

  if (!href) {
    return "";
  }

  if (/^https?:\/\//i.test(href)) {
    return href;
  }

  return `https://${href}`;
}

function isSafeLinkHref(value = "") {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function ToolbarButton({ active = false, disabled = false, onClick, children, label }) {
  return (
    <button
      type="button"
      className={
        active
          ? "rich-text-editor__button rich-text-editor__button--active"
          : "rich-text-editor__button"
      }
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      title={label}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  id,
  value = "",
  onChange,
  placeholder = "",
  disabled = false,
  insertion = null,
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        dropcursor: false,
        heading: false,
        horizontalRule: false,
        strike: false,
      }),
      TipTapLink.configure({
        autolink: false,
        defaultProtocol: "https",
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
        isAllowedUri: (url) => isSafeLinkHref(normalizeLinkHref(url)),
      }),
    ],
    content: normalizePostBodyForEditor(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        "aria-label": placeholder || "Post content",
        class: "rich-text-editor__content",
        id,
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      onChange(sanitizeRichPostHtml(activeEditor.getHTML()));
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor || value) {
      return;
    }

    if (!editor.isEmpty) {
      editor.commands.setContent(normalizePostBodyForEditor(""));
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor || !insertion?.text) {
      return;
    }

    editor.chain().focus().insertContent(insertion.text).run();
    onChange(sanitizeRichPostHtml(editor.getHTML()));
  }, [editor, insertion, onChange]);

  function setLink() {
    if (!editor) {
      return;
    }

    const previousUrl = editor.getAttributes("link").href || "";
    const nextUrl = window.prompt("Link URL", previousUrl);

    if (nextUrl === null) {
      return;
    }

    const normalizedUrl = normalizeLinkHref(nextUrl);

    if (!normalizedUrl) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onChange(sanitizeRichPostHtml(editor.getHTML()));
      return;
    }

    if (!isSafeLinkHref(normalizedUrl)) {
      window.alert("Use a safe http or https URL.");
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: normalizedUrl })
      .run();
    onChange(sanitizeRichPostHtml(editor.getHTML()));
  }

  return (
    <div className="rich-text-editor">
      <div className="rich-text-editor__toolbar" aria-label="Post formatting">
        <ToolbarButton
          active={editor?.isActive("bold")}
          disabled={!editor || disabled}
          label="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("italic")}
          disabled={!editor || disabled}
          label="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("link")}
          disabled={!editor || disabled}
          label="Link"
          onClick={setLink}
        >
          <Link2 size={15} strokeWidth={2.25} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("bulletList")}
          disabled={!editor || disabled}
          label="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={16} strokeWidth={2.25} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          active={editor?.isActive("orderedList")}
          disabled={!editor || disabled}
          label="Numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={16} strokeWidth={2.25} aria-hidden="true" />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
