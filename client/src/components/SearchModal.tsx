import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  X, 
  Hash, 
  User, 
  FileText, 
  Calendar,
  MessageSquare,
  Clock,
  Filter,
  ChevronRight,
  Info,
  Link,
  Image,
  File,
  Star,
  Shield,
  Globe,
  Loader2,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToMessage?: (channelId?: string, messageId?: string, userId?: string) => void;
}

interface SearchResult {
  messages: MessageResult[];
  files: FileResult[];
  users: UserResult[];
  total: {
    messages: number;
    files: number;
    users: number;
  };
}

interface MessageResult {
  id: string;
  content: string;
  formattedContent?: string;
  channelId?: string;
  senderId?: string;
  receiverId?: string;
  createdAt: string;
  fileUrl?: string;
  fileName?: string;
  type: 'channel' | 'dm';
  sender?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    profileImageUrl?: string;
  };
  channel?: {
    id: string;
    name: string;
    tier: string;
  };
}

interface FileResult {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  fileSize: number;
  uploadedAt: string;
  thumbnailUrl?: string;
  userId: string;
  user?: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

interface UserResult {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  isAdmin: boolean;
  onlineStatus?: string;
  profileImageUrl?: string;
  hasFloridaLicense?: boolean;
  isMultiStateLicensed?: boolean;
}

const SEARCH_OPERATORS = [
  { operator: 'from:@username', description: 'Messages from specific user' },
  { operator: 'in:#channel', description: 'Messages in specific channel' },
  { operator: 'has:file', description: 'Messages with files' },
  { operator: 'has:link', description: 'Messages with links' },
  { operator: 'before:YYYY-MM-DD', description: 'Messages before date' },
  { operator: 'after:YYYY-MM-DD', description: 'Messages after date' }
];

const tierConfig = {
  NON_LICENSED: {
    icon: Shield,
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    label: 'Non-Licensed'
  },
  FL_LICENSED: {
    icon: Star,
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    label: 'FL Licensed'
  },
  MULTI_STATE: {
    icon: Globe,
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    label: 'Multi-State'
  }
};

export function SearchModal({ isOpen, onClose, onNavigateToMessage }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'messages' | 'files' | 'people'>('all');
  const [showOperators, setShowOperators] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Debounce search query
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
      
      // Save to recent searches if query is not empty
      if (query.trim() && !recentSearches.includes(query.trim())) {
        const updated = [query.trim(), ...recentSearches.slice(0, 9)];
        setRecentSearches(updated);
        localStorage.setItem('recentSearches', JSON.stringify(updated));
      }
    }, 300);
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  // Search query
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['/api/dev/messenger/search', debouncedQuery, activeTab],
    enabled: debouncedQuery.length > 0,
    queryFn: async () => {
      const response = await apiRequest('/api/dev/messenger/search', {
        method: 'GET',
        params: {
          q: debouncedQuery,
          type: activeTab,
          limit: 50
        }
      });
      return response as SearchResult;
    }
  });

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };

  const handleSelectRecentSearch = (search: string) => {
    setQuery(search);
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() ? 
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800">{part}</mark> : 
        part
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return Image;
    if (fileType.includes('pdf')) return FileText;
    return File;
  };

  const handleMessageClick = (message: MessageResult) => {
    if (onNavigateToMessage) {
      if (message.type === 'channel') {
        onNavigateToMessage(message.channelId, message.id);
      } else {
        onNavigateToMessage(undefined, undefined, message.senderId);
      }
    }
    onClose();
  };

  const handleUserClick = (user: UserResult) => {
    if (onNavigateToMessage) {
      onNavigateToMessage(undefined, undefined, user.id);
    }
    onClose();
  };

  const renderMessages = (messages: MessageResult[]) => (
    <div className="space-y-2">
      {messages.map((message) => (
        <div
          key={message.id}
          className="p-3 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
          onClick={() => handleMessageClick(message)}
          data-testid={`search-message-${message.id}`}
        >
          <div className="flex items-start gap-3">
            <Avatar className="w-8 h-8 mt-0.5">
              <AvatarImage src={message.sender?.profileImageUrl} />
              <AvatarFallback className="text-xs">
                {message.sender?.firstName?.[0]}{message.sender?.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">
                  {message.sender?.firstName} {message.sender?.lastName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(message.createdAt), 'MMM d, h:mm a')}
                </span>
                {message.type === 'channel' && message.channel && (
                  <Badge variant="secondary" className="text-xs">
                    <Hash className="w-3 h-3 mr-1" />
                    {message.channel.name}
                  </Badge>
                )}
                {message.type === 'dm' && (
                  <Badge variant="secondary" className="text-xs">
                    <User className="w-3 h-3 mr-1" />
                    Direct Message
                  </Badge>
                )}
              </div>
              <p className="text-sm text-foreground/90 line-clamp-2">
                {highlightMatch(message.content, debouncedQuery)}
              </p>
              {message.fileUrl && (
                <div className="flex items-center gap-1 mt-1">
                  <FileText className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {message.fileName || 'Attached file'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderFiles = (files: FileResult[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {files.map((file) => {
        const FileIcon = getFileIcon(file.fileType);
        return (
          <div
            key={file.id}
            className="p-3 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors border"
            onClick={() => window.open(file.fileUrl, '_blank')}
            data-testid={`search-file-${file.id}`}
          >
            <div className="flex items-start gap-3">
              {file.thumbnailUrl ? (
                <img 
                  src={file.thumbnailUrl} 
                  alt={file.fileName}
                  className="w-12 h-12 rounded object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-secondary flex items-center justify-center">
                  <FileIcon className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {highlightMatch(file.fileName, debouncedQuery)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.fileSize)} • {format(new Date(file.uploadedAt), 'MMM d, yyyy')}
                </p>
                {file.user && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Uploaded by {file.user.firstName} {file.user.lastName}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderUsers = (users: UserResult[]) => (
    <div className="space-y-2">
      {users.map((user) => {
        const TierIcon = user.isMultiStateLicensed 
          ? tierConfig.MULTI_STATE.icon
          : user.hasFloridaLicense
          ? tierConfig.FL_LICENSED.icon
          : tierConfig.NON_LICENSED.icon;
        
        const tierColor = user.isMultiStateLicensed 
          ? tierConfig.MULTI_STATE.color
          : user.hasFloridaLicense
          ? tierConfig.FL_LICENSED.color
          : tierConfig.NON_LICENSED.color;

        return (
          <div
            key={user.id}
            className="p-3 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
            onClick={() => handleUserClick(user)}
            data-testid={`search-user-${user.id}`}
          >
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={user.profileImageUrl} />
                <AvatarFallback>
                  {user.firstName?.[0]}{user.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {highlightMatch(`${user.firstName} ${user.lastName}`, debouncedQuery)}
                  </span>
                  {user.isAdmin && (
                    <Badge variant="secondary" className="text-xs">
                      Admin
                    </Badge>
                  )}
                  <Badge variant="outline" className={cn("text-xs", tierColor)}>
                    <TierIcon className="w-3 h-3 mr-1" />
                    {user.isMultiStateLicensed ? 'Multi-State' : user.hasFloridaLicense ? 'FL Licensed' : 'Non-Licensed'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {highlightMatch(user.email, debouncedQuery)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  user.onlineStatus === 'online' ? 'bg-green-500' : 'bg-gray-400'
                )} />
                <span className="text-xs text-muted-foreground">
                  {user.onlineStatus === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Search className="w-12 h-12 text-muted-foreground mb-4" />
      <h3 className="font-semibold text-lg mb-2">Start searching</h3>
      <p className="text-muted-foreground text-sm mb-6 max-w-sm">
        Search for messages, files, and people across all channels and direct messages
      </p>
      
      {recentSearches.length > 0 && (
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Recent searches</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearRecentSearches}
              className="text-xs"
            >
              Clear all
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((search, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="cursor-pointer hover:bg-secondary/80"
                onClick={() => handleSelectRecentSearch(search)}
              >
                <Clock className="w-3 h-3 mr-1" />
                {search}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      <Button
        variant="outline"
        size="sm"
        className="mt-6"
        onClick={() => setShowOperators(!showOperators)}
      >
        <HelpCircle className="w-4 h-4 mr-2" />
        Search operators
      </Button>
    </div>
  );

  const renderResults = () => {
    if (!searchResults) return renderEmptyState();
    
    const { messages, files, users, total } = searchResults;
    const hasResults = total.messages > 0 || total.files > 0 || total.users > 0;
    
    if (!hasResults) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <Search className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">No results found</h3>
          <p className="text-muted-foreground text-sm">
            Try adjusting your search terms or filters
          </p>
        </div>
      );
    }
    
    switch (activeTab) {
      case 'messages':
        return renderMessages(messages);
      case 'files':
        return renderFiles(files);
      case 'people':
        return renderUsers(users);
      case 'all':
      default:
        return (
          <div className="space-y-6">
            {messages.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Messages
                    <Badge variant="secondary">{total.messages}</Badge>
                  </h3>
                  {total.messages > 3 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab('messages')}
                      className="text-xs"
                    >
                      View all
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
                {renderMessages(messages.slice(0, 3))}
              </div>
            )}
            
            {files.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Files
                    <Badge variant="secondary">{total.files}</Badge>
                  </h3>
                  {total.files > 4 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab('files')}
                      className="text-xs"
                    >
                      View all
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
                {renderFiles(files.slice(0, 4))}
              </div>
            )}
            
            {users.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <User className="w-4 h-4" />
                    People
                    <Badge variant="secondary">{total.users}</Badge>
                  </h3>
                  {total.users > 3 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab('people')}
                      className="text-xs"
                    >
                      View all
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
                {renderUsers(users.slice(0, 3))}
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0">
        <div className="p-6 pb-0">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Search Everything
            </DialogTitle>
          </DialogHeader>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages, files, people... (try: has:file, from:@john)"
              className="pl-10 pr-10"
              data-testid="search-input"
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => setQuery('')}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          
          {showOperators && (
            <div className="mb-4 p-3 rounded-lg bg-secondary/50 text-sm">
              <div className="font-medium mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Search Operators
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SEARCH_OPERATORS.map((op) => (
                  <div key={op.operator} className="flex items-start gap-2">
                    <code className="text-xs bg-background px-1 py-0.5 rounded">
                      {op.operator}
                    </code>
                    <span className="text-xs text-muted-foreground">
                      {op.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">
                All
                {searchResults && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {searchResults.total.messages + searchResults.total.files + searchResults.total.users}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="messages">
                Messages
                {searchResults && searchResults.total.messages > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {searchResults.total.messages}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="files">
                Files
                {searchResults && searchResults.total.files > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {searchResults.total.files}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="people">
                People
                {searchResults && searchResults.total.users > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {searchResults.total.users}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        <ScrollArea className="flex-1 px-6 pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            renderResults()
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}