import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, 
  FileCode, 
  FileImage, 
  FileVideo, 
  FileArchive,
  FileMinus,
  Download,
  Expand,
  X,
  Eye,
  Code2,
  FileSpreadsheet,
  Presentation,
  Music,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';

interface FileMetadata {
  width?: number;
  height?: number;
  duration?: number;
  pages?: number;
  dimensions?: { width: number; height: number };
}

interface FileData {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  thumbnailUrl?: string;
  fileSize?: number;
  mimeType?: string;
  metadata?: FileMetadata;
  uploadedAt?: string;
  uploadedBy?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

interface FilePreviewProps {
  file: FileData;
  className?: string;
  showFullPreview?: boolean;
  onDownload?: () => void;
  inline?: boolean;
  maxHeight?: string;
}

const getFileIcon = (mimeType: string, fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  if (mimeType?.startsWith('image/')) return FileImage;
  if (mimeType?.startsWith('video/')) return FileVideo;
  if (mimeType?.startsWith('audio/')) return Music;
  
  // Document types
  if (mimeType === 'application/pdf' || ext === 'pdf') return FileText;
  if (ext === 'doc' || ext === 'docx') return FileText;
  if (ext === 'xls' || ext === 'xlsx') return FileSpreadsheet;
  if (ext === 'ppt' || ext === 'pptx') return Presentation;
  
  // Code files
  const codeExtensions = ['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'h', 'css', 'html', 'json', 'xml', 'yml', 'yaml'];
  if (codeExtensions.includes(ext)) return FileCode;
  
  // Archives
  const archiveExtensions = ['zip', 'rar', '7z', 'tar', 'gz'];
  if (archiveExtensions.includes(ext)) return FileArchive;
  
  return FileMinus;
};

const getLanguageFromExt = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const langMap: { [key: string]: string } = {
    'js': 'javascript',
    'ts': 'typescript',
    'tsx': 'tsx',
    'jsx': 'jsx',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'css': 'css',
    'html': 'html',
    'json': 'json',
    'xml': 'xml',
    'yml': 'yaml',
    'yaml': 'yaml'
  };
  return langMap[ext] || 'plaintext';
};

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return 'Unknown size';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

export default function FilePreview({ 
  file, 
  className, 
  showFullPreview = false,
  onDownload,
  inline = false,
  maxHeight = "400px"
}: FilePreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [codeContent, setCodeContent] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState(false);
  
  const Icon = getFileIcon(file.mimeType || '', file.fileName);
  const isImage = file.mimeType?.startsWith('image/');
  const isVideo = file.mimeType?.startsWith('video/');
  const isAudio = file.mimeType?.startsWith('audio/');
  const isPDF = file.mimeType === 'application/pdf' || file.fileName.endsWith('.pdf');
  const isCodeFile = ['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'css', 'html', 'json', 'xml', 'yml', 'yaml']
    .includes(file.fileName.split('.').pop()?.toLowerCase() || '');

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      const link = document.createElement('a');
      link.href = file.fileUrl;
      link.download = file.fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  useEffect(() => {
    if (isCodeFile && showFullPreview && !codeContent) {
      setLoadingCode(true);
      fetch(file.fileUrl)
        .then(res => res.text())
        .then(text => {
          setCodeContent(text);
          setLoadingCode(false);
        })
        .catch(() => {
          setLoadingCode(false);
        });
    }
  }, [isCodeFile, showFullPreview, file.fileUrl, codeContent]);

  useEffect(() => {
    if (codeContent && isCodeFile) {
      const language = getLanguageFromExt(file.fileName);
      const highlighted = Prism.highlight(codeContent, Prism.languages[language] || Prism.languages.plaintext, language);
      const codeEl = document.querySelector('.code-preview-content');
      if (codeEl) {
        codeEl.innerHTML = highlighted;
      }
    }
  }, [codeContent, file.fileName, isCodeFile]);

  // Inline image preview
  if (inline && isImage) {
    return (
      <>
        <div 
          className={cn(
            "relative inline-block cursor-pointer group",
            className
          )}
          onClick={() => setIsExpanded(true)}
          data-testid="file-preview-image"
        >
          {!imageLoaded && (
            <Skeleton className="w-full h-48 rounded-md" />
          )}
          <img
            src={file.thumbnailUrl || file.fileUrl}
            alt={file.fileName}
            className={cn(
              "rounded-md transition-opacity",
              imageLoaded ? "opacity-100" : "opacity-0",
              maxHeight && `max-h-[${maxHeight}]`
            )}
            style={{ maxHeight }}
            onLoad={() => setImageLoaded(true)}
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
            <Expand className="h-8 w-8 text-white" />
          </div>
        </div>

        {/* Lightbox */}
        <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
            <DialogHeader className="p-4 pb-2">
              <DialogTitle>{file.fileName}</DialogTitle>
            </DialogHeader>
            <div className="relative overflow-auto">
              <img
                src={file.fileUrl}
                alt={file.fileName}
                className="w-full h-auto"
              />
            </div>
            <div className="p-4 pt-2 flex items-center justify-between border-t">
              <span className="text-sm text-muted-foreground">
                {formatFileSize(file.fileSize)}
              </span>
              <Button onClick={handleDownload} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Inline video preview
  if (inline && isVideo) {
    return (
      <div className={cn("relative rounded-md overflow-hidden bg-black", className)} data-testid="file-preview-video">
        <video
          controls
          className="w-full"
          style={{ maxHeight }}
        >
          <source src={file.fileUrl} type={file.mimeType} />
          Your browser does not support the video tag.
        </video>
        <div className="absolute top-2 right-2">
          <Button
            size="icon"
            variant="secondary"
            onClick={handleDownload}
            className="h-8 w-8"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Inline audio preview
  if (inline && isAudio) {
    return (
      <div className={cn("flex items-center gap-3 p-3 bg-muted/50 rounded-md", className)} data-testid="file-preview-audio">
        <Music className="h-8 w-8 text-muted-foreground" />
        <div className="flex-1">
          <audio controls className="w-full">
            <source src={file.fileUrl} type={file.mimeType} />
            Your browser does not support the audio element.
          </audio>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleDownload}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // PDF preview
  if (inline && isPDF) {
    return (
      <div className={cn("relative", className)} data-testid="file-preview-pdf">
        <div className="border rounded-md p-4 bg-muted/30">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <FileText className="h-10 w-10 text-red-500" />
              <div>
                <p className="font-medium">{file.fileName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(file.fileSize)}
                  {file.metadata?.pages && ` • ${file.metadata.pages} pages`}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => window.open(file.fileUrl, '_blank')}
              >
                <Eye className="h-4 w-4 mr-2" />
                View
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
          {showFullPreview && (
            <iframe
              src={`${file.fileUrl}#toolbar=0`}
              className="w-full h-96 border rounded"
              title={file.fileName}
            />
          )}
        </div>
      </div>
    );
  }

  // Code file preview
  if (inline && isCodeFile) {
    return (
      <div className={cn("relative", className)} data-testid="file-preview-code">
        <div className="border rounded-md bg-gray-900">
          <div className="flex items-center justify-between p-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-blue-400" />
              <span className="text-sm font-mono text-gray-300">{file.fileName}</span>
              <Badge variant="secondary" className="text-xs">
                {getLanguageFromExt(file.fileName)}
              </Badge>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDownload}
              className="text-gray-300 hover:text-white"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
          {showFullPreview && (
            <div className="p-3 overflow-auto" style={{ maxHeight: '400px' }}>
              {loadingCode ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : codeContent ? (
                <pre className="text-sm">
                  <code className="code-preview-content language-{getLanguageFromExt(file.fileName)}">
                    {codeContent}
                  </code>
                </pre>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Click download to view the full file
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default file preview (for other file types)
  return (
    <div 
      className={cn(
        "flex items-center gap-3 p-3 border rounded-md bg-muted/30 hover:bg-muted/50 transition-colors",
        className
      )}
      data-testid="file-preview-default"
    >
      <Icon className="h-10 w-10 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{file.fileName}</p>
        <p className="text-sm text-muted-foreground">
          {formatFileSize(file.fileSize)}
          {file.uploadedAt && ` • ${new Date(file.uploadedAt).toLocaleDateString()}`}
        </p>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={handleDownload}
      >
        <Download className="h-4 w-4 mr-2" />
        Download
      </Button>
    </div>
  );
}