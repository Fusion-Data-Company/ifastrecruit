import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Command } from 'cmdk';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Hash,
  User,
  Calendar,
  Smile,
  Search,
  Image,
  BarChart3,
  Settings,
  MessageSquare,
  Zap,
  Clock,
  Star,
  ChevronRight,
  Info,
  Lock,
  Globe,
  Webhook,
  Code,
  Play
} from 'lucide-react';

interface SlashCommand {
  id?: string;
  name: string;
  description: string;
  usage: string;
  category?: string;
  permissionLevel?: 'all' | 'admin' | 'channel_admin';
  context?: 'channel' | 'dm' | 'both';
  type?: 'builtin' | 'custom' | 'webhook';
  aliases?: string[];
  parameters?: CommandParameter[];
  isFavorite?: boolean;
  useCount?: number;
  lastUsed?: string;
}

interface CommandParameter {
  name: string;
  type: 'string' | 'user' | 'number' | 'time' | 'emoji' | 'quoted';
  required?: boolean;
  description?: string;
  defaultValue?: any;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onExecute: (command: string) => void;
  channelId?: string;
  dmUserId?: string;
  initialInput?: string;
}

const categoryIcons: Record<string, any> = {
  'General': MessageSquare,
  'Communication': User,
  'Channel Management': Hash,
  'Productivity': Clock,
  'Profile': Smile,
  'Fun': Zap,
  'Admin': Lock,
  'Custom': Code,
  'Webhook': Webhook
};

const categoryColors: Record<string, string> = {
  'General': 'bg-blue-500/10 text-blue-500',
  'Communication': 'bg-green-500/10 text-green-500',
  'Channel Management': 'bg-purple-500/10 text-purple-500',
  'Productivity': 'bg-amber-500/10 text-amber-500',
  'Profile': 'bg-pink-500/10 text-pink-500',
  'Fun': 'bg-cyan-500/10 text-cyan-500',
  'Admin': 'bg-red-500/10 text-red-500',
  'Custom': 'bg-indigo-500/10 text-indigo-500',
  'Webhook': 'bg-orange-500/10 text-orange-500'
};

export function CommandPalette({
  open,
  onClose,
  onExecute,
  channelId,
  dmUserId,
  initialInput = ''
}: CommandPaletteProps) {
  const [search, setSearch] = useState(initialInput);
  const [selectedCommand, setSelectedCommand] = useState<SlashCommand | null>(null);
  const [commandArgs, setCommandArgs] = useState('');
  const [currentParam, setCurrentParam] = useState(0);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch available commands
  const { data: commands = [], isLoading } = useQuery<SlashCommand[]>({
    queryKey: ['/api/commands/available', { channelId }],
    enabled: open
  });

  // Fetch command suggestions based on input
  const { data: suggestions = [] } = useQuery<SlashCommand[]>({
    queryKey: ['/api/commands/suggestions', { prefix: search.slice(1), channelId }],
    enabled: open && search.startsWith('/') && search.length > 1
  });

  // Execute command mutation
  const executeMutation = useMutation({
    mutationFn: async (command: string) => {
      const response = await apiRequest('POST', '/api/commands/execute', {
        command,
        channelId,
        dmUserId
      });
      return response.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        // Handle specific actions
        switch (result.action) {
          case 'sendMessage':
            onExecute(result.message || '');
            break;
          case 'openDM':
            // This would be handled by the parent component
            onExecute(`/dm ${result.data.userId}`);
            break;
          case 'showHelp':
            // Show help in a modal or panel
            console.log('Help data:', result.data);
            break;
          case 'createPoll':
            // Refresh polls in the channel
            queryClient.invalidateQueries({ queryKey: [`/api/commands/polls/${channelId}`] });
            break;
          case 'setReminder':
            toast({
              title: 'Reminder set',
              description: result.message
            });
            break;
          case 'updateStatus':
            toast({
              title: 'Status updated',
              description: result.message
            });
            queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
            break;
          default:
            if (result.message) {
              toast({
                title: 'Command executed',
                description: result.message
              });
            }
        }
        onClose();
      } else {
        toast({
          title: 'Command failed',
          description: result.error || 'Unknown error',
          variant: 'destructive'
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error executing command',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, SlashCommand[]> = {};
    const filtered = search.startsWith('/') && search.length > 1
      ? suggestions
      : commands;

    // Sort by favorites and usage
    const sorted = [...filtered].sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return (b.useCount || 0) - (a.useCount || 0);
    });

    sorted.forEach(cmd => {
      const category = cmd.category || 'Uncategorized';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(cmd);
    });

    return groups;
  }, [commands, suggestions, search]);

  // Handle command selection
  const handleCommandSelect = useCallback((command: SlashCommand) => {
    setSelectedCommand(command);
    setSearch(`/${command.name} `);
    setCurrentParam(0);
    inputRef.current?.focus();
  }, []);

  // Handle command execution
  const handleExecute = useCallback(() => {
    if (!search.startsWith('/')) return;
    
    const fullCommand = search + (commandArgs ? ' ' + commandArgs : '');
    executeMutation.mutate(fullCommand.trim());
  }, [search, commandArgs, executeMutation]);

  // Parse current parameter hint
  const paramHint = useMemo(() => {
    if (!selectedCommand || !selectedCommand.parameters) return null;
    
    const params = selectedCommand.parameters;
    if (currentParam >= params.length) return null;
    
    const param = params[currentParam];
    return {
      ...param,
      example: getParamExample(param)
    };
  }, [selectedCommand, currentParam]);

  // Get parameter example based on type
  function getParamExample(param: CommandParameter): string {
    switch (param.type) {
      case 'user':
        return '@username';
      case 'time':
        return 'in 30 minutes';
      case 'emoji':
        return ':smile:';
      case 'quoted':
        return '"your text here"';
      case 'number':
        return '60';
      default:
        return 'text';
    }
  }

  // Handle input change
  const handleInputChange = useCallback((value: string) => {
    setSearch(value);
    
    // Reset command selection if user clears the slash
    if (!value.startsWith('/')) {
      setSelectedCommand(null);
      setCommandArgs('');
      setCurrentParam(0);
    }
    
    // Parse command and args if a command is selected
    if (selectedCommand && value.startsWith(`/${selectedCommand.name} `)) {
      const args = value.slice(`/${selectedCommand.name} `.length);
      setCommandArgs(args);
      
      // Update current parameter index based on args
      if (selectedCommand.parameters) {
        const argParts = args.split(/\s+/).filter(Boolean);
        setCurrentParam(Math.min(argParts.length, selectedCommand.parameters.length - 1));
      }
    }
  }, [selectedCommand]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch(initialInput);
      setSelectedCommand(null);
      setCommandArgs('');
      setCurrentParam(0);
    }
  }, [open, initialInput]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-0 max-w-2xl">
        <Command className="rounded-lg" loop>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              ref={inputRef}
              placeholder="Type a command or search..."
              value={search}
              onValueChange={handleInputChange}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.startsWith('/')) {
                  e.preventDefault();
                  handleExecute();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  onClose();
                }
              }}
            />
            {paramHint && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium">{paramHint.name}:</span>
                <span className="text-primary">{paramHint.example}</span>
                {paramHint.required && (
                  <Badge variant="outline" className="h-4 px-1 text-[10px]">
                    Required
                  </Badge>
                )}
              </div>
            )}
          </div>
          
          <ScrollArea className="h-[400px]">
            <Command.List>
              {isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading commands...
                </div>
              ) : Object.keys(groupedCommands).length === 0 ? (
                <Command.Empty className="p-4 text-center text-sm text-muted-foreground">
                  {search.startsWith('/') 
                    ? 'No commands found. Try typing /help'
                    : 'Type / to see available commands'}
                </Command.Empty>
              ) : (
                Object.entries(groupedCommands).map(([category, categoryCommands]) => (
                  <Command.Group key={category} heading={category}>
                    {categoryCommands.map(command => {
                      const Icon = categoryIcons[category] || MessageSquare;
                      const isSelected = selectedCommand?.name === command.name;
                      
                      return (
                        <Command.Item
                          key={command.name}
                          value={command.name}
                          onSelect={() => handleCommandSelect(command)}
                          className={cn(
                            "flex items-start gap-3 px-3 py-2 cursor-pointer",
                            isSelected && "bg-accent"
                          )}
                        >
                          <div className={cn(
                            "mt-0.5 p-1.5 rounded",
                            categoryColors[category] || categoryColors['General']
                          )}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">/{command.name}</span>
                              {command.aliases && command.aliases.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  ({command.aliases.map(a => `/${a}`).join(', ')})
                                </span>
                              )}
                              {command.isFavorite && (
                                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                              )}
                              {command.type === 'custom' && (
                                <Badge variant="outline" className="h-4 px-1 text-[10px]">
                                  Custom
                                </Badge>
                              )}
                              {command.type === 'webhook' && (
                                <Badge variant="outline" className="h-4 px-1 text-[10px]">
                                  Webhook
                                </Badge>
                              )}
                              {command.permissionLevel === 'admin' && (
                                <Lock className="h-3 w-3 text-red-500" />
                              )}
                            </div>
                            
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {command.description}
                            </p>
                            
                            {command.usage && (
                              <code className="text-xs text-muted-foreground bg-muted px-1 py-0.5 rounded mt-1 inline-block">
                                {command.usage}
                              </code>
                            )}
                            
                            {command.parameters && command.parameters.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {command.parameters.map((param, idx) => (
                                  <Badge 
                                    key={idx} 
                                    variant="secondary" 
                                    className="h-5 text-[10px] font-normal"
                                  >
                                    {param.name}
                                    {param.required && '*'}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            
                            {command.useCount && command.useCount > 0 && (
                              <div className="text-[10px] text-muted-foreground mt-1">
                                Used {command.useCount} time{command.useCount !== 1 ? 's' : ''}
                                {command.lastUsed && (
                                  <span> • Last used {new Date(command.lastUsed).toLocaleDateString()}</span>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                ))
              )}
            </Command.List>
          </ScrollArea>
          
          {selectedCommand && (
            <div className="border-t p-3 bg-muted/50">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-medium">
                    {selectedCommand.name} command
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedCommand.description}
                  </p>
                  {selectedCommand.parameters && selectedCommand.parameters.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-2">
                      <span className="font-medium">Parameters:</span>
                      <ul className="mt-1 space-y-0.5">
                        {selectedCommand.parameters.map((param, idx) => (
                          <li key={idx} className={cn(
                            "flex items-center gap-2",
                            idx === currentParam && "text-primary font-medium"
                          )}>
                            <span className="text-muted-foreground">•</span>
                            <span>{param.name}</span>
                            <span className="text-muted-foreground">
                              ({param.type})
                              {param.required && ' - required'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleExecute}
                  disabled={!search.startsWith('/') || executeMutation.isPending}
                  className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {executeMutation.isPending ? (
                    <>
                      <Play className="h-3 w-3 mr-1 inline animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3 mr-1 inline" />
                      Execute
                    </>
                  )}
                </button>
                <span className="text-xs text-muted-foreground">
                  Press Enter to execute
                </span>
              </div>
            </div>
          )}
        </Command>
      </DialogContent>
    </Dialog>
  );
}