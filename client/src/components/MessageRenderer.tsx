import { useMemo, useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-sql';
import 'prismjs/themes/prism-tomorrow.css';
import Linkify from 'linkify-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, ChevronUp, ChevronDown, Globe } from 'lucide-react';
import { Node } from 'slate';
import { LinkPreview } from './LinkPreview';
import FilePreview from './FilePreview';

interface FileAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  thumbnailUrl?: string;
  fileSize?: number;
  mimeType?: string;
  metadata?: any;
  uploadedAt?: string;
  uploadedBy?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

interface MessageRendererProps {
  content: string;
  formattedContent?: string | null;
  className?: string;
  showLinkPreviews?: boolean;
  attachments?: FileAttachment[];
  onFileDownload?: (fileId: string) => void;
}


export function MessageRenderer({
  content,
  formattedContent,
  className,
  showLinkPreviews = true,
  attachments = [],
  onFileDownload
}: MessageRendererProps) {
  const [linkPreviews, setLinkPreviews] = useState<LinkPreview[]>([]);
  const [expandedPreviews, setExpandedPreviews] = useState<Set<string>>(new Set());
  const [loadingPreviews, setLoadingPreviews] = useState<Set<string>>(new Set());

  // Parse and render the formatted content
  const renderedContent = useMemo(() => {
    if (!formattedContent) {
      // If no formatted content, render plain text with basic linkification
      return (
        <div className={cn("whitespace-pre-wrap break-words", className)}>
          <Linkify
            options={{
              target: '_blank',
              rel: 'noopener noreferrer',
              className: 'text-blue-600 dark:text-blue-400 hover:underline'
            }}
          >
            {content}
          </Linkify>
        </div>
      );
    }

    try {
      // Parse the Slate.js JSON format
      const nodes = JSON.parse(formattedContent);
      
      // Convert Slate.js nodes to HTML
      const html = nodesToHtml(nodes);
      
      // Sanitize the HTML
      const sanitized = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 's', 'code', 'pre', 
          'blockquote', 'ul', 'ol', 'li', 'a', 'span'
        ],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'data-user-id', 'data-user-name'],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
      });

      // Extract URLs for link previews
      if (showLinkPreviews) {
        const urls = extractUrls(content);
        if (urls.length > 0) {
          loadLinkPreviews(urls);
        }
      }

      return (
        <div 
          className={cn("prose prose-sm dark:prose-invert max-w-none", className)}
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      );
    } catch (error) {
      console.error('Failed to parse formatted content:', error);
      // Fallback to plain text
      return (
        <div className={cn("whitespace-pre-wrap break-words", className)}>
          <Linkify
            options={{
              target: '_blank',
              rel: 'noopener noreferrer',
              className: 'text-blue-600 dark:text-blue-400 hover:underline'
            }}
          >
            {content}
          </Linkify>
        </div>
      );
    }
  }, [formattedContent, content, className]);

  // Highlight code blocks after render
  useEffect(() => {
    if (formattedContent) {
      // Delay to ensure DOM is updated
      setTimeout(() => {
        Prism.highlightAll();
      }, 0);
    }
  }, [formattedContent]);

  // Convert Slate.js nodes to HTML
  function nodesToHtml(nodes: any[]): string {
    return nodes.map(node => nodeToHtml(node)).join('');
  }

  function nodeToHtml(node: any): string {
    if (node.text !== undefined) {
      // Leaf node
      let text = escapeHtml(node.text);
      
      if (node.bold) text = `<strong>${text}</strong>`;
      if (node.italic) text = `<em>${text}</em>`;
      if (node.strike) text = `<s>${text}</s>`;
      if (node.code) text = `<code class="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono">${text}</code>`;
      if (node.link) text = `<a href="${escapeHtml(node.link)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">${text}</a>`;
      
      return text;
    }

    // Element node
    const childrenHtml = node.children ? node.children.map((child: any) => nodeToHtml(child)).join('') : '';
    
    switch (node.type) {
      case 'paragraph':
        return `<p class="mb-2">${childrenHtml}</p>`;
      case 'code-block':
        const codeText = Node.string(node);
        return `<pre class="bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-x-auto"><code class="language-javascript">${escapeHtml(codeText)}</code></pre>`;
      case 'quote':
        return `<blockquote class="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-2">${childrenHtml}</blockquote>`;
      case 'bulleted-list':
        return `<ul class="list-disc pl-6 my-2">${childrenHtml}</ul>`;
      case 'numbered-list':
        return `<ol class="list-decimal pl-6 my-2">${childrenHtml}</ol>`;
      case 'list-item':
        return `<li class="mb-1">${childrenHtml}</li>`;
      case 'mention':
        return `<span class="inline-block px-1.5 py-0.5 mx-1 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded font-medium" data-user-id="${escapeHtml(node.userId)}" data-user-name="${escapeHtml(node.userName)}">@${escapeHtml(node.userName)}</span>`;
      default:
        return childrenHtml;
    }
  }

  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s]+/gi;
    const matches = text.match(urlRegex);
    return matches ? [...new Set(matches)] : [];
  }

  async function loadLinkPreviews(urls: string[]) {
    // Note: In a real implementation, you would fetch preview data from your backend
    // For now, we'll create mock previews
    const previews = urls.map(url => ({
      url,
      title: new URL(url).hostname,
      description: 'Click to visit this link',
      favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}`
    }));
    
    setLinkPreviews(previews);
  }

  function togglePreview(url: string) {
    setExpandedPreviews(prev => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  }

  return (
    <div>
      {renderedContent}
      
      {/* File Attachments */}
      {attachments.length > 0 && (
        <div className="mt-3 space-y-2">
          {attachments.map((file) => (
            <FilePreview
              key={file.id}
              file={file}
              inline={true}
              showFullPreview={true}
              onDownload={onFileDownload ? () => onFileDownload(file.id) : undefined}
              maxHeight="400px"
            />
          ))}
        </div>
      )}
      
      {/* Link Previews */}
      {linkPreviews.length > 0 && (
        <div className="mt-2 space-y-2">
          {linkPreviews.map((preview) => (
            <Card
              key={preview.url}
              className="p-3 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => togglePreview(preview.url)}
            >
              <div className="flex items-start gap-3">
                {preview.favicon && (
                  <img
                    src={preview.favicon}
                    alt=""
                    className="w-5 h-5 mt-0.5 rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium truncate">
                      {preview.title || new URL(preview.url).hostname}
                    </h4>
                    <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                  </div>
                  
                  {expandedPreviews.has(preview.url) && (
                    <>
                      {preview.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {preview.description}
                        </p>
                      )}
                      
                      <a
                        href={preview.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {preview.url}
                      </a>
                    </>
                  )}
                  
                  {!expandedPreviews.has(preview.url) && (
                    <p className="text-xs text-muted-foreground truncate">
                      {preview.url}
                    </p>
                  )}
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePreview(preview.url);
                  }}
                >
                  {expandedPreviews.has(preview.url) ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Add custom styles for Prism
const style = document.createElement('style');
style.textContent = `
  /* Custom Prism styles for dark mode */
  .dark pre[class*="language-"],
  .dark code[class*="language-"] {
    background: rgb(31 41 55); /* gray-800 */
  }
  
  /* Custom styles for inline code */
  .prose code:not([class*="language-"]) {
    padding: 0.125rem 0.25rem;
    background-color: rgb(243 244 246);
    border-radius: 0.25rem;
    font-size: 0.875rem;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
  }
  
  .dark .prose code:not([class*="language-"]) {
    background-color: rgb(31 41 55);
    color: rgb(248 250 252);
  }
  
  /* Mention styles */
  [data-user-id] {
    cursor: pointer;
  }
  
  [data-user-id]:hover {
    background-color: rgb(59 130 246 / 0.3);
  }
`;
document.head.appendChild(style);