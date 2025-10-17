import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { format } from 'date-fns';
import {
  Search,
  X,
  Filter,
  Star,
  Clock,
  Hash,
  User,
  FileText,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  Save,
  Trash2,
  Calendar as CalendarIcon,
  Link,
  Paperclip,
  AtSign,
  Loader2
} from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'message' | 'file' | 'channel' | 'user' | 'dm';
  title?: string;
  content: string;
  context?: string;
  url?: string;
  author?: {
    id: string;
    name: string;
    avatar?: string;
  };
  channel?: {
    id: string;
    name: string;
  };
  timestamp: string;
  highlights?: string[];
  score?: number;
  metadata?: any;
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters?: any;
  isPinned?: boolean;
  usageCount?: number;
  lastUsedAt?: string;
}

interface SearchHistory {
  id: string;
  query: string;
  filters?: any;
  resultsCount?: number;
  createdAt: string;
}

interface AdvancedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  onResultClick?: (result: SearchResult) => void;
}

export function AdvancedSearchModal({ 
  isOpen, 
  onClose, 
  initialQuery = '',
  onResultClick 
}: AdvancedSearchModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<'all' | 'messages' | 'files' | 'channels' | 'users'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Filters state
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [fileTypes, setFileTypes] = useState<string[]>([]);
  const [hasAttachments, setHasAttachments] = useState(false);
  const [messageTypes, setMessageTypes] = useState<string[]>([]);
  
  // Operators state
  const [fromUser, setFromUser] = useState('');
  const [inChannel, setInChannel] = useState('');
  const [hasOperators, setHasOperators] = useState<string[]>([]);

  // Build query with operators
  const buildQueryWithOperators = useCallback(() => {
    let fullQuery = query;
    
    if (fromUser) {
      fullQuery += ` from:@${fromUser}`;
    }
    
    if (inChannel) {
      fullQuery += ` in:#${inChannel}`;
    }
    
    hasOperators.forEach(op => {
      fullQuery += ` has:${op}`;
    });
    
    if (dateFrom) {
      fullQuery += ` after:${format(dateFrom, 'yyyy-MM-dd')}`;
    }
    
    if (dateTo) {
      fullQuery += ` before:${format(dateTo, 'yyyy-MM-dd')}`;
    }
    
    return fullQuery.trim();
  }, [query, fromUser, inChannel, hasOperators, dateFrom, dateTo]);

  // Search query
  const { data: searchResults, isLoading: isSearching, refetch: executeSearch } = useQuery<{
    results: SearchResult[];
    total: number;
  }>({
    queryKey: ['/api/search', {
      q: buildQueryWithOperators(),
      scope: activeTab,
      channels: selectedChannels,
      users: selectedUsers,
      fileTypes,
      hasAttachments,
      messageTypes,
      dateFrom: dateFrom?.toISOString(),
      dateTo: dateTo?.toISOString()
    }],
    enabled: false
  });

  // Suggestions query
  const { data: suggestions } = useQuery<{ suggestions: string[] }>({
    queryKey: ['/api/search/suggestions', { q: query }],
    enabled: query.length >= 2
  });

  // Saved searches query
  const { data: savedSearches = [] } = useQuery<SavedSearch[]>({
    queryKey: ['/api/search/saved'],
    enabled: isOpen
  });

  // Search history query
  const { data: searchHistory = [] } = useQuery<SearchHistory[]>({
    queryKey: ['/api/search/history'],
    enabled: isOpen
  });

  // Save search mutation
  const saveSearchMutation = useMutation({
    mutationFn: (data: { name: string; query: string; filters?: any }) =>
      apiRequest('/api/search/saved', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/search/saved'] });
      toast({
        title: "Search saved",
        description: "Your search has been saved successfully"
      });
      setSaveSearchName('');
    }
  });

  // Delete saved search mutation
  const deleteSavedSearchMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/search/saved/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/search/saved'] });
      toast({
        title: "Search deleted",
        description: "Saved search has been deleted"
      });
    }
  });

  // Use saved search mutation
  const useSavedSearchMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/search/saved/${id}/use`, 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/search/saved'] });
    }
  });

  // Execute search on Enter or when query changes significantly
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        executeSearch();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeTab, selectedChannels, selectedUsers, fileTypes, hasAttachments, messageTypes, dateFrom, dateTo]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Apply saved search
  const applySavedSearch = (savedSearch: SavedSearch) => {
    setQuery(savedSearch.query);
    if (savedSearch.filters) {
      setSelectedChannels(savedSearch.filters.channels || []);
      setSelectedUsers(savedSearch.filters.users || []);
      setFileTypes(savedSearch.filters.fileTypes || []);
      setHasAttachments(savedSearch.filters.hasAttachments || false);
      setMessageTypes(savedSearch.filters.messageTypes || []);
      if (savedSearch.filters.dateRange) {
        setDateFrom(savedSearch.filters.dateRange.start ? new Date(savedSearch.filters.dateRange.start) : undefined);
        setDateTo(savedSearch.filters.dateRange.end ? new Date(savedSearch.filters.dateRange.end) : undefined);
      }
    }
    useSavedSearchMutation.mutate(savedSearch.id);
    executeSearch();
  };

  // Apply search history
  const applyHistorySearch = (history: SearchHistory) => {
    setQuery(history.query);
    if (history.filters) {
      setSelectedChannels(history.filters.channels || []);
      setSelectedUsers(history.filters.users || []);
      setFileTypes(history.filters.fileTypes || []);
      setHasAttachments(history.filters.hasAttachments || false);
      setMessageTypes(history.filters.messageTypes || []);
      if (history.filters.dateRange) {
        setDateFrom(history.filters.dateRange.start ? new Date(history.filters.dateRange.start) : undefined);
        setDateTo(history.filters.dateRange.end ? new Date(history.filters.dateRange.end) : undefined);
      }
    }
    executeSearch();
  };

  // Render search result
  const renderSearchResult = (result: SearchResult) => {
    const Icon = result.type === 'message' ? MessageSquare :
                 result.type === 'file' ? FileText :
                 result.type === 'channel' ? Hash :
                 result.type === 'user' ? User :
                 MessageSquare;

    return (
      <div
        key={result.id}
        className="p-3 hover:bg-muted rounded-lg cursor-pointer group"
        onClick={() => {
          if (onResultClick) {
            onResultClick(result);
            onClose();
          }
        }}
        data-testid={`search-result-${result.id}`}
      >
        <div className="flex items-start gap-3">
          <Icon className="w-4 h-4 mt-1 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            {result.title && (
              <div className="font-medium text-sm mb-1">{result.title}</div>
            )}
            <div className="text-sm text-muted-foreground line-clamp-2">
              {result.context || result.content}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {result.author && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {result.author.name}
                </span>
              )}
              {result.channel && (
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  {result.channel.name}
                </span>
              )}
              <span>{new Date(result.timestamp).toLocaleDateString()}</span>
              {result.score && (
                <Badge variant="outline" className="ml-auto">
                  Score: {result.score}
                </Badge>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden p-0">
        <div className="flex h-full">
          {/* Main search area */}
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search messages, files, channels, users..."
                  className="flex-1 border-0 focus-visible:ring-0 px-0"
                  data-testid="search-input"
                />
                {isSearching && <Loader2 className="w-4 h-4 animate-spin" />}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  data-testid="button-toggle-filters"
                >
                  <Filter className="w-4 h-4 mr-1" />
                  Filters
                  {showFilters ? <ChevronDown className="w-3 h-3 ml-1" /> : <ChevronRight className="w-3 h-3 ml-1" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSavedSearches(!showSavedSearches)}
                  data-testid="button-toggle-saved"
                >
                  <Star className="w-4 h-4" />
                </Button>
              </div>

              {/* Search operators help */}
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <span>Try:</span>
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setQuery(query + ' from:@')}>
                  from:@user
                </Badge>
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setQuery(query + ' in:#')}>
                  in:#channel
                </Badge>
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setQuery(query + ' has:file')}>
                  has:file
                </Badge>
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setQuery(query + ' after:')}>
                  after:date
                </Badge>
              </div>

              {/* Filters panel */}
              {showFilters && (
                <div className="mt-4 p-4 bg-muted rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Date from</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateFrom ? format(dateFrom, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={dateFrom}
                            onSelect={setDateFrom}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label className="text-xs">Date to</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateTo ? format(dateTo, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={dateTo}
                            onSelect={setDateTo}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="has-attachments"
                        checked={hasAttachments}
                        onCheckedChange={(checked) => setHasAttachments(checked as boolean)}
                      />
                      <Label htmlFor="has-attachments" className="text-xs">
                        Has attachments
                      </Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Has:</Label>
                      <div className="flex gap-1">
                        <Badge
                          variant={hasOperators.includes('file') ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            setHasOperators(prev =>
                              prev.includes('file')
                                ? prev.filter(op => op !== 'file')
                                : [...prev, 'file']
                            );
                          }}
                        >
                          <Paperclip className="w-3 h-3 mr-1" />
                          file
                        </Badge>
                        <Badge
                          variant={hasOperators.includes('link') ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            setHasOperators(prev =>
                              prev.includes('link')
                                ? prev.filter(op => op !== 'link')
                                : [...prev, 'link']
                            );
                          }}
                        >
                          <Link className="w-3 h-3 mr-1" />
                          link
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedChannels([]);
                        setSelectedUsers([]);
                        setDateFrom(undefined);
                        setDateTo(undefined);
                        setFileTypes([]);
                        setHasAttachments(false);
                        setMessageTypes([]);
                        setFromUser('');
                        setInChannel('');
                        setHasOperators([]);
                      }}
                    >
                      Clear filters
                    </Button>
                    {query && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (saveSearchName) {
                            saveSearchMutation.mutate({
                              name: saveSearchName,
                              query: buildQueryWithOperators(),
                              filters: {
                                channels: selectedChannels,
                                users: selectedUsers,
                                dateRange: {
                                  start: dateFrom,
                                  end: dateTo
                                },
                                fileTypes,
                                hasAttachments,
                                messageTypes
                              }
                            });
                          }
                        }}
                      >
                        <Save className="w-3 h-3 mr-1" />
                        Save search
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Search results */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
              <TabsList className="mx-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="messages">Messages</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="channels">Channels</TabsTrigger>
                <TabsTrigger value="users">People</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 px-4 py-2">
                {isSearching ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                  </div>
                ) : searchResults?.results && searchResults.results.length > 0 ? (
                  <div className="space-y-1">
                    {searchResults.results.map(renderSearchResult)}
                  </div>
                ) : query ? (
                  <div className="text-center text-muted-foreground py-8">
                    No results found for "{query}"
                  </div>
                ) : (
                  <div className="py-8">
                    {/* Recent searches */}
                    {searchHistory.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-sm font-medium mb-2 flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          Recent searches
                        </h3>
                        <div className="space-y-1">
                          {searchHistory.slice(0, 5).map(history => (
                            <div
                              key={history.id}
                              className="flex items-center justify-between p-2 hover:bg-muted rounded-lg cursor-pointer"
                              onClick={() => applyHistorySearch(history)}
                              data-testid={`search-history-${history.id}`}
                            >
                              <span className="text-sm">{history.query}</span>
                              {history.resultsCount !== undefined && (
                                <Badge variant="secondary">{history.resultsCount}</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Search suggestions */}
                    {suggestions?.suggestions && suggestions.suggestions.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium mb-2">Suggestions</h3>
                        <div className="space-y-1">
                          {suggestions.suggestions.map((suggestion, idx) => (
                            <div
                              key={idx}
                              className="p-2 hover:bg-muted rounded-lg cursor-pointer text-sm"
                              onClick={() => setQuery(suggestion)}
                            >
                              {suggestion}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </Tabs>
          </div>

          {/* Saved searches sidebar */}
          {showSavedSearches && (
            <div className="w-64 border-l bg-muted/20 p-4">
              <h3 className="font-medium mb-3 flex items-center">
                <Star className="w-4 h-4 mr-1" />
                Saved searches
              </h3>
              <ScrollArea className="h-[calc(100%-2rem)]">
                {savedSearches.length > 0 ? (
                  <div className="space-y-2">
                    {savedSearches.map(saved => (
                      <div
                        key={saved.id}
                        className="p-2 hover:bg-background rounded-lg cursor-pointer group"
                        data-testid={`saved-search-${saved.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div
                            className="flex-1"
                            onClick={() => applySavedSearch(saved)}
                          >
                            <div className="font-medium text-sm">{saved.name}</div>
                            <div className="text-xs text-muted-foreground">{saved.query}</div>
                            {saved.usageCount && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Used {saved.usageCount} times
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSavedSearchMutation.mutate(saved.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No saved searches yet
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}