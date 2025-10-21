import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { createEditor, Descendant, Editor, Transforms, Text, Range, Point, Element as SlateElement, Node, Path, BaseEditor } from 'slate';
import { Slate, Editable, withReact, ReactEditor, useSlate, useSelected, useFocused } from 'slate-react';
import { withHistory } from 'slate-history';
import isHotkey from 'is-hotkey';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Bold, 
  Italic, 
  Strikethrough, 
  Code, 
  List, 
  ListOrdered,
  Quote,
  Link,
  ChevronDown,
  Send,
  Smile,
  Paperclip,
  Hash,
  AtSign,
  X,
  Upload,
  FileImage,
  FileText,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Define custom element and leaf types
type CustomText = { 
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  link?: string;
};

type ParagraphElement = { type: 'paragraph'; children: CustomText[] };
type CodeBlockElement = { type: 'code-block'; children: CustomText[] };
type QuoteElement = { type: 'quote'; children: CustomText[] };
type ListItemElement = { type: 'list-item'; children: CustomText[] };
type BulletedListElement = { type: 'bulleted-list'; children: (ListItemElement | CustomText)[] };
type NumberedListElement = { type: 'numbered-list'; children: (ListItemElement | CustomText)[] };
type MentionElement = { type: 'mention'; userId: string; userName: string; children: CustomText[] };

type CustomElement = 
  | ParagraphElement 
  | CodeBlockElement 
  | QuoteElement 
  | ListItemElement 
  | BulletedListElement 
  | NumberedListElement
  | MentionElement;

declare module 'slate' {
  interface CustomTypes {
    Editor: any;
    Element: CustomElement;
    Text: CustomText;
  }
}

// Hotkey mappings
const HOTKEYS: Record<string, string> = {
  'mod+b': 'bold',
  'mod+i': 'italic',
  'mod+shift+x': 'strike',
  'mod+e': 'code',
  'mod+shift+c': 'code-block',
  'mod+shift+7': 'numbered-list',
  'mod+shift+8': 'bulleted-list',
  'mod+shift+9': 'quote',
};

interface FileUpload {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  url?: string;
  thumbnailUrl?: string;
  error?: string;
}

interface RichTextEditorProps {
  value: string;
  formattedValue?: string;
  onChange: (value: string, formattedValue: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  mentions?: { id: string; name: string; email: string }[];
  onMentionSearch?: (search: string) => void;
  className?: string;
  showAttachment?: boolean;
  onAttachmentClick?: () => void;
  showEmoji?: boolean;
  onEmojiClick?: () => void;
  onFilesSelected?: (files: File[]) => void;
  uploadProgress?: { [key: string]: number };
  attachedFiles?: FileUpload[];
  onRemoveFile?: (fileId: string) => void;
  maxFileSize?: number;
  acceptedFileTypes?: string[];
}

export function RichTextEditor({
  value,
  formattedValue,
  onChange,
  onSubmit,
  placeholder = 'Type a message...',
  disabled = false,
  mentions = [],
  onMentionSearch,
  className,
  showAttachment = true,
  onAttachmentClick,
  showEmoji = true,
  onEmojiClick,
  onFilesSelected,
  uploadProgress = {},
  attachedFiles = [],
  onRemoveFile,
  maxFileSize = 50 * 1024 * 1024, // 50MB default
  acceptedFileTypes = ['image/*', 'video/*', 'audio/*', 'application/pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.zip', '.rar']
}: RichTextEditorProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionTarget, setMentionTarget] = useState<Range | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize editor with plugins
  const editor = useMemo(
    () => withMentions(withHistory(withReact(createEditor()))),
    []
  );

  // Reset editor content when value prop changes to empty
  useEffect(() => {
    if (!value && editor.children.length > 0) {
      // Check if editor has content but value is empty - reset it
      const currentText = editor.children
        .map((n: any) => Node.string(n))
        .join('\n')
        .trim();
      
      if (currentText) {
        // Reset editor to empty state
        Transforms.delete(editor, {
          at: {
            anchor: Editor.start(editor, []),
            focus: Editor.end(editor, [])
          }
        });
        
        // Insert empty paragraph
        Transforms.insertNodes(editor, {
          type: 'paragraph',
          children: [{ text: '' }]
        } as any);
      }
    }
  }, [value, editor]);

  // File handling functions
  const handleFileSelect = (files: FileList | null) => {
    if (!files || !onFilesSelected) return;

    const validFiles = Array.from(files).filter(file => {
      if (file.size > maxFileSize) {
        console.error(`File ${file.name} exceeds maximum size of ${maxFileSize} bytes`);
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev - 1);
    if (dragCounter - 1 === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const handleAttachmentClick = () => {
    if (onAttachmentClick) {
      onAttachmentClick();
    } else {
      fileInputRef.current?.click();
    }
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Initialize editor value
  const initialValue: Descendant[] = useMemo(() => {
    if (formattedValue) {
      try {
        return JSON.parse(formattedValue);
      } catch {
        return [{ type: 'paragraph', children: [{ text: value || '' }] }];
      }
    }
    return [{ type: 'paragraph', children: [{ text: value || '' }] }];
  }, [value, formattedValue]);

  // Track if toolbar buttons are active
  const isMarkActive = (editor: Editor, format: string) => {
    const marks = Editor.marks(editor);
    return marks ? marks[format as keyof typeof marks] === true : false;
  };

  const isBlockActive = (editor: Editor, format: string) => {
    const { selection } = editor;
    if (!selection) return false;

    const [match] = Array.from(
      Editor.nodes(editor, {
        at: Editor.unhangRange(editor, selection),
        match: n =>
          !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === format,
      })
    );

    return !!match;
  };

  // Toggle mark formatting
  const toggleMark = (editor: Editor, format: string) => {
    const isActive = isMarkActive(editor, format);

    if (isActive) {
      Editor.removeMark(editor, format);
    } else {
      Editor.addMark(editor, format, true);
    }
  };

  // Toggle block formatting
  const toggleBlock = (editor: Editor, format: string) => {
    const isActive = isBlockActive(editor, format);
    const isList = format === 'bulleted-list' || format === 'numbered-list';

    Transforms.unwrapNodes(editor, {
      match: n =>
        !Editor.isEditor(n) &&
        SlateElement.isElement(n) &&
        (n.type === 'bulleted-list' || n.type === 'numbered-list'),
      split: true,
    });

    const newProperties: any = {
      type: isActive ? 'paragraph' : isList ? 'list-item' : format,
    };

    Transforms.setNodes<SlateElement>(editor, newProperties);

    if (!isActive && isList) {
      const block = { type: format, children: [] } as any;
      Transforms.wrapNodes(editor, block);
    }
  };

  // Insert link
  const insertLink = (url: string) => {
    if (!url) return;

    const { selection } = editor;
    const isCollapsed = selection && Range.isCollapsed(selection);

    if (isCollapsed) {
      Transforms.insertNodes(editor, {
        type: 'paragraph',
        children: [{ text: url, link: url }],
      } as any);
    } else {
      Editor.addMark(editor, 'link', url);
    }

    setShowLinkInput(false);
    setLinkUrl('');
  };

  // Insert mention
  const insertMention = (user: { id: string; name: string }) => {
    if (!mentionTarget) return;

    Transforms.select(editor, mentionTarget);
    
    const mention: MentionElement = {
      type: 'mention',
      userId: user.id,
      userName: user.name,
      children: [{ text: `@${user.name}` }],
    };
    
    Transforms.insertNodes(editor, mention);
    Transforms.move(editor);
    
    setMentionTarget(null);
    setShowMentionDropdown(false);
    setMentionSearch('');
  };

  // Handle editor changes
  const handleChange = (newValue: Descendant[]) => {
    // Extract plain text - don't trim here to preserve user input
    const plainText = newValue
      .map(n => Node.string(n))
      .join('\n');
      
    // Serialize to formatted value (JSON)
    const formatted = JSON.stringify(newValue);
    
    // Always call onChange to update parent state
    onChange(plainText, formatted);

    // Handle @ mentions
    const { selection } = editor;
    
    if (selection && Range.isCollapsed(selection)) {
      const [start] = Range.edges(selection);
      const wordBefore = Editor.before(editor, start, { unit: 'word' });
      const before = wordBefore && Editor.before(editor, wordBefore);
      const beforeRange = before && Editor.range(editor, before, start);
      const beforeText = beforeRange && Editor.string(editor, beforeRange);
      const beforeMatch = beforeText && beforeText.match(/^@(\w*)$/);
      
      if (beforeMatch) {
        setMentionTarget(beforeRange);
        setMentionSearch(beforeMatch[1]);
        setShowMentionDropdown(true);
        setMentionIndex(0);
        if (onMentionSearch) {
          onMentionSearch(beforeMatch[1]);
        }
      } else {
        setMentionTarget(null);
        setShowMentionDropdown(false);
      }
    }
  };

  // Render element
  const renderElement = useCallback((props: any) => {
    switch (props.element.type) {
      case 'code-block':
        return <CodeBlockElement {...props} />;
      case 'quote':
        return <QuoteElement {...props} />;
      case 'bulleted-list':
        return <ul className="list-disc pl-6" {...props.attributes}>{props.children}</ul>;
      case 'numbered-list':
        return <ol className="list-decimal pl-6" {...props.attributes}>{props.children}</ol>;
      case 'list-item':
        return <li {...props.attributes}>{props.children}</li>;
      case 'mention':
        return <MentionElement {...props} />;
      default:
        return <p {...props.attributes}>{props.children}</p>;
    }
  }, []);

  // Render leaf
  const renderLeaf = useCallback((props: any) => {
    return <Leaf {...props} />;
  }, []);

  // Handle key down
  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Submit on Enter (without shift)
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
      return;
    }

    // Handle hotkeys
    for (const hotkey in HOTKEYS) {
      if (isHotkey(hotkey, event)) {
        event.preventDefault();
        const mark = HOTKEYS[hotkey];
        
        if (['bold', 'italic', 'strike', 'code'].includes(mark)) {
          toggleMark(editor, mark);
        } else {
          toggleBlock(editor, mark);
        }
      }
    }

    // Handle mention dropdown navigation
    if (showMentionDropdown && mentions.length > 0) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setMentionIndex(mentionIndex >= mentions.length - 1 ? 0 : mentionIndex + 1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          setMentionIndex(mentionIndex <= 0 ? mentions.length - 1 : mentionIndex - 1);
          break;
        case 'Tab':
        case 'Enter':
          event.preventDefault();
          insertMention(mentions[mentionIndex]);
          break;
        case 'Escape':
          event.preventDefault();
          setShowMentionDropdown(false);
          break;
      }
    }
  };

  const filteredMentions = mentions.filter(user => 
    user.name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
    user.email.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  return (
    <div 
      className={cn("relative", className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedFileTypes.join(',')}
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
      />

      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary rounded-md flex items-center justify-center">
          <div className="text-center">
            <Upload className="h-12 w-12 mx-auto mb-2 text-primary animate-pulse" />
            <p className="text-lg font-semibold">Drop files here</p>
            <p className="text-sm text-muted-foreground">Release to upload</p>
          </div>
        </div>
      )}

      {/* File Previews */}
      {attachedFiles.length > 0 && (
        <div className="p-3 border-b bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Attached Files ({attachedFiles.length})</span>
            {onRemoveFile && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => attachedFiles.forEach(f => onRemoveFile(f.id))}
              >
                Clear all
              </Button>
            )}
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {attachedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 p-2 bg-background/50 rounded-md"
              >
                {file.file.type.startsWith('image/') ? (
                  <FileImage className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                ) : (
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.file.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(file.file.size)}
                    </span>
                    {file.status === 'uploading' && (
                      <div className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="text-xs">{uploadProgress[file.id] || 0}%</span>
                      </div>
                    )}
                    {file.status === 'success' && (
                      <span className="text-xs text-green-600">✓ Uploaded</span>
                    )}
                    {file.status === 'error' && (
                      <span className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {file.error || 'Failed'}
                      </span>
                    )}
                  </div>
                </div>
                {onRemoveFile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onRemoveFile(file.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Slate editor={editor} initialValue={initialValue} onChange={handleChange}>
        {/* Formatting Toolbar */}
        <div className="flex items-center gap-1 p-2 border-b border-gray-200 bg-white">
          <ToolbarButton
            active={isMarkActive(editor, 'bold')}
            onMouseDown={(e) => {
              e.preventDefault();
              toggleMark(editor, 'bold');
            }}
            tooltip="Bold (⌘B)"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          
          <ToolbarButton
            active={isMarkActive(editor, 'italic')}
            onMouseDown={(e) => {
              e.preventDefault();
              toggleMark(editor, 'italic');
            }}
            tooltip="Italic (⌘I)"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          
          <ToolbarButton
            active={isMarkActive(editor, 'strike')}
            onMouseDown={(e) => {
              e.preventDefault();
              toggleMark(editor, 'strike');
            }}
            tooltip="Strikethrough (⌘⇧X)"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          
          <div className="w-px h-6 bg-border mx-1" />
          
          <ToolbarButton
            active={isBlockActive(editor, 'code-block')}
            onMouseDown={(e) => {
              e.preventDefault();
              toggleBlock(editor, 'code-block');
            }}
            tooltip="Code Block (⌘⇧C)"
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>
          
          <ToolbarButton
            active={isBlockActive(editor, 'bulleted-list')}
            onMouseDown={(e) => {
              e.preventDefault();
              toggleBlock(editor, 'bulleted-list');
            }}
            tooltip="Bulleted List"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          
          <ToolbarButton
            active={isBlockActive(editor, 'numbered-list')}
            onMouseDown={(e) => {
              e.preventDefault();
              toggleBlock(editor, 'numbered-list');
            }}
            tooltip="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          
          <ToolbarButton
            active={isBlockActive(editor, 'quote')}
            onMouseDown={(e) => {
              e.preventDefault();
              toggleBlock(editor, 'quote');
            }}
            tooltip="Quote Block"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          
          <div className="w-px h-6 bg-border mx-1" />
          
          <Popover open={showLinkInput} onOpenChange={setShowLinkInput}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                title="Add Link"
              >
                <Link className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="flex gap-2">
                <Input
                  ref={linkInputRef}
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Enter URL..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      insertLink(linkUrl);
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => insertLink(linkUrl)}
                >
                  Add
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Editor */}
        <div className="relative bg-white">
          <Editable
            ref={editorRef as any}
            className="min-h-[100px] max-h-[300px] overflow-y-auto p-3 focus:outline-none text-gray-900 placeholder:text-gray-500"
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            placeholder={placeholder}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            spellCheck
            autoFocus
          />

          {/* Mention Dropdown */}
          {showMentionDropdown && filteredMentions.length > 0 && (
            <div className="absolute bottom-full mb-2 left-0 w-64 max-h-48 overflow-y-auto bg-popover border rounded-md shadow-md z-50">
              {filteredMentions.map((user, index) => (
                <button
                  key={user.id}
                  className={cn(
                    "w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2",
                    index === mentionIndex && "bg-muted"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(user);
                  }}
                  onMouseEnter={() => setMentionIndex(index)}
                >
                  <AtSign className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 truncate">
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Toolbar */}
        <div className="flex items-center justify-between p-2 border-t border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            {showAttachment && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={handleAttachmentClick}
                disabled={disabled}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            )}
            {showEmoji && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={onEmojiClick}
                disabled={disabled}
              >
                <Smile className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <Button
            size="sm"
            onClick={onSubmit}
            disabled={disabled || !value.trim()}
            className="bg-[#007a5a] hover:bg-[#006644] text-white font-semibold"
            data-testid="send-button"
          >
            <Send className="h-4 w-4 mr-1" />
            Send
          </Button>
        </div>
      </Slate>
    </div>
  );
}

// Toolbar button component
function ToolbarButton({
  active,
  children,
  onMouseDown,
  tooltip
}: {
  active: boolean;
  children: React.ReactNode;
  onMouseDown: (event: React.MouseEvent) => void;
  tooltip: string;
}) {
  return (
    <Button
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      className="h-8 px-2"
      onMouseDown={onMouseDown}
      title={tooltip}
    >
      {children}
    </Button>
  );
}

// Element components
function CodeBlockElement({ attributes, children }: any) {
  return (
    <pre className="bg-muted p-2 rounded-md font-mono text-sm" {...attributes}>
      <code>{children}</code>
    </pre>
  );
}

function QuoteElement({ attributes, children }: any) {
  return (
    <blockquote className="border-l-4 border-muted-foreground/30 pl-4 italic" {...attributes}>
      {children}
    </blockquote>
  );
}

function MentionElement({ attributes, children, element }: any) {
  const selected = useSelected();
  const focused = useFocused();
  
  return (
    <span
      {...attributes}
      contentEditable={false}
      className={cn(
        "inline-block px-1 py-0.5 mx-1 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded",
        selected && focused && "bg-blue-500/30"
      )}
    >
      {children}
    </span>
  );
}

// Leaf component for inline formatting
function Leaf({ attributes, children, leaf }: any) {
  if (leaf.bold) {
    children = <strong>{children}</strong>;
  }

  if (leaf.italic) {
    children = <em>{children}</em>;
  }

  if (leaf.strike) {
    children = <s>{children}</s>;
  }

  if (leaf.code) {
    children = (
      <code className="px-1 py-0.5 bg-muted rounded text-sm font-mono">
        {children}
      </code>
    );
  }

  if (leaf.link) {
    children = (
      <a
        href={leaf.link}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 dark:text-blue-400 underline hover:opacity-80"
      >
        {children}
      </a>
    );
  }

  return <span {...attributes}>{children}</span>;
}

// Mention plugin
const withMentions = (editor: Editor) => {
  const { isInline, isVoid } = editor;

  editor.isInline = (element: any) => {
    return element.type === 'mention' ? true : isInline(element);
  };

  editor.isVoid = (element: any) => {
    return element.type === 'mention' ? true : isVoid(element);
  };

  return editor;
};