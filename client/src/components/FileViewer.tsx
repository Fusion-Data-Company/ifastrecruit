import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface FileAttachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size?: number;
  uploadedAt?: Date;
}

interface FileViewerProps {
  files: FileAttachment[];
  candidateName: string;
}

export function FileViewer({ files, candidateName }: FileViewerProps) {
  const [selectedFile, setSelectedFile] = useState<FileAttachment | null>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return 'fas fa-file-pdf';
    if (type.includes('word')) return 'fas fa-file-word';
    if (type.includes('image')) return 'fas fa-file-image';
    if (type.includes('text')) return 'fas fa-file-alt';
    return 'fas fa-file';
  };

  const getFileColor = (type: string) => {
    if (type.includes('pdf')) return 'text-red-500';
    if (type.includes('word')) return 'text-blue-500';
    if (type.includes('image')) return 'text-green-500';
    if (type.includes('text')) return 'text-gray-500';
    return 'text-purple-500';
  };

  if (!files || files.length === 0) {
    return (
      <Card className="glass-panel">
        <CardContent className="p-6 text-center">
          <div className="text-muted-foreground">
            <i className="fas fa-folder-open text-4xl mb-4"></i>
            <p>No files attached</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          <i className="fas fa-paperclip mr-2"></i>
          Attached Files ({files.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {files.map((file) => (
          <div key={file.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
            <div className="flex items-center space-x-3 flex-1">
              <div className={`text-2xl ${getFileColor(file.type)}`}>
                <i className={getFileIcon(file.type)}></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{file.name}</p>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Badge variant="secondary" className="text-xs">
                    {file.type.split('/')[1]?.toUpperCase() || 'FILE'}
                  </Badge>
                  {file.size && (
                    <span>{formatFileSize(file.size)}</span>
                  )}
                  {file.uploadedAt && (
                    <span>• {new Date(file.uploadedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedFile(file)}
                    data-testid={`preview-file-${file.id}`}
                  >
                    <i className="fas fa-eye mr-2"></i>
                    Preview
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                      <i className={`${getFileIcon(file.type)} ${getFileColor(file.type)}`}></i>
                      <span>{file.name}</span>
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <Badge variant="outline">{file.type}</Badge>
                      {file.size && <span>{formatFileSize(file.size)}</span>}
                      {file.uploadedAt && (
                        <span>Uploaded: {new Date(file.uploadedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                    <Separator />
                    <div className="min-h-[400px] bg-muted/10 rounded-lg flex items-center justify-center">
                      {file.type.includes('image') ? (
                        <img 
                          src={file.url} 
                          alt={file.name}
                          className="max-w-full max-h-[400px] object-contain rounded"
                        />
                      ) : file.type.includes('pdf') ? (
                        <iframe
                          src={file.url}
                          className="w-full h-[400px] rounded"
                          title={file.name}
                        />
                      ) : (
                        <div className="text-center text-muted-foreground">
                          <i className={`${getFileIcon(file.type)} text-6xl mb-4`}></i>
                          <p className="text-lg mb-2">{file.name}</p>
                          <p className="text-sm mb-4">Preview not available for this file type</p>
                          <Button asChild variant="outline">
                            <a href={file.url} target="_blank" rel="noopener noreferrer">
                              <i className="fas fa-external-link-alt mr-2"></i>
                              Open in New Tab
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button 
                variant="ghost" 
                size="sm" 
                asChild
                data-testid={`download-file-${file.id}`}
              >
                <a href={file.url} download={file.name}>
                  <i className="fas fa-download"></i>
                </a>
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}