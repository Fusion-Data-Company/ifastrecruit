import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ExternalLink, ChevronDown, ChevronUp, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

interface LinkPreviewProps {
  url: string;
  onLoad?: (data: LinkPreviewData) => void;
  defaultExpanded?: boolean;
}

export function LinkPreview({ url, onLoad, defaultExpanded = false }: LinkPreviewProps) {
  const [previewData, setPreviewData] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    fetchLinkPreview();
  }, [url]);

  const fetchLinkPreview = async () => {
    try {
      setLoading(true);
      setError(false);

      const response = await fetch('/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) throw new Error('Failed to fetch preview');

      const data = await response.json();
      setPreviewData(data);
      onLoad?.(data);
    } catch (err) {
      console.error('Error fetching link preview:', err);
      setError(true);
      // Fallback to basic link display
      setPreviewData({ url });
    } finally {
      setLoading(false);
    }
  };

  const getDomain = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch {
      return url;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 mt-2">
        <ExternalLink className="h-4 w-4" />
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="underline"
        >
          {url}
        </a>
      </div>
    );
  }

  if (error || !previewData) {
    return (
      <div className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 mt-2">
        <ExternalLink className="h-4 w-4" />
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="underline"
        >
          {url}
        </a>
      </div>
    );
  }

  const hasRichPreview = previewData.title || previewData.description || previewData.image;

  if (!hasRichPreview) {
    return (
      <div className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 mt-2">
        <ExternalLink className="h-4 w-4" />
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="underline"
        >
          {url}
        </a>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 mb-1">
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" />
          {getDomain(url)}
        </a>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </Button>
      </div>

      {expanded && (
        <Card className="bg-white/5 border-white/10 overflow-hidden">
          <CardContent className="p-3">
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block hover:bg-white/5 transition-colors -m-3 p-3"
            >
              <div className="flex gap-3">
                {previewData.image && (
                  <div className="flex-shrink-0">
                    <div className="w-24 h-24 bg-white/10 rounded-md overflow-hidden">
                      <img
                        src={previewData.image}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {previewData.favicon && (
                    <div className="flex items-center gap-2 mb-1">
                      <img 
                        src={previewData.favicon} 
                        alt="" 
                        className="w-4 h-4"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <span className="text-xs text-gray-400">
                        {previewData.siteName || getDomain(url)}
                      </span>
                    </div>
                  )}
                  {previewData.title && (
                    <h4 className="font-medium text-white text-sm mb-1 line-clamp-2">
                      {previewData.title}
                    </h4>
                  )}
                  {previewData.description && (
                    <p className="text-xs text-gray-400 line-clamp-2">
                      {previewData.description}
                    </p>
                  )}
                </div>
              </div>
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}