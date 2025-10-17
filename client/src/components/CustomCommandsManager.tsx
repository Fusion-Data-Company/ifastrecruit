import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Edit2,
  Trash2,
  Code,
  Webhook,
  Shield,
  Command as CommandIcon
} from 'lucide-react';

interface CustomCommand {
  id: string;
  name: string;
  description: string;
  usage: string;
  category: string;
  permissionLevel: string;
  context: string[];
  webhookUrl?: string;
  customLogic?: string;
  parameters?: Record<string, any>;
  aliases?: string[];
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export function CustomCommandsManager() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingCommand, setEditingCommand] = useState<CustomCommand | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    usage: '',
    category: 'custom',
    permissionLevel: 'user',
    context: ['channel', 'dm'],
    webhookUrl: '',
    customLogic: '',
    aliases: '',
  });

  // Fetch custom commands
  const { data: commands, isLoading } = useQuery<CustomCommand[]>({
    queryKey: ['/api/commands/custom'],
  });

  // Create command mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/commands/custom', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/commands/custom'] });
      toast({
        title: 'Command created',
        description: 'Custom command has been created successfully',
      });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create command',
        variant: 'destructive',
      });
    },
  });

  // Update command mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest(`/api/commands/custom/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/commands/custom'] });
      toast({
        title: 'Command updated',
        description: 'Custom command has been updated successfully',
      });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update command',
        variant: 'destructive',
      });
    },
  });

  // Delete command mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/commands/custom/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/commands/custom'] });
      toast({
        title: 'Command deleted',
        description: 'Custom command has been deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete command',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      usage: '',
      category: 'custom',
      permissionLevel: 'user',
      context: ['channel', 'dm'],
      webhookUrl: '',
      customLogic: '',
      aliases: '',
    });
    setEditingCommand(null);
  };

  const handleSubmit = () => {
    const data = {
      ...formData,
      aliases: formData.aliases ? formData.aliases.split(',').map(a => a.trim()) : [],
    };

    if (editingCommand) {
      updateMutation.mutate({ id: editingCommand.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (command: CustomCommand) => {
    setEditingCommand(command);
    setFormData({
      name: command.name,
      description: command.description,
      usage: command.usage,
      category: command.category,
      permissionLevel: command.permissionLevel,
      context: command.context,
      webhookUrl: command.webhookUrl || '',
      customLogic: command.customLogic || '',
      aliases: command.aliases?.join(', ') || '',
    });
    setShowDialog(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this command?')) {
      deleteMutation.mutate(id);
    }
  };

  const getCategoryBadge = (category: string) => {
    const categoryConfig: Record<string, { color: string; icon: any }> = {
      custom: { color: 'bg-purple-500', icon: Code },
      webhook: { color: 'bg-blue-500', icon: Webhook },
      admin: { color: 'bg-red-500', icon: Shield },
    };

    const config = categoryConfig[category] || categoryConfig.custom;
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} text-white`}>
        <Icon className="h-3 w-3 mr-1" />
        {category}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Custom Commands</h2>
          <p className="text-gray-400 mt-1">
            Create and manage custom slash commands for your workspace
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
          data-testid="create-command"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Command
        </Button>
      </div>

      {/* Commands Table */}
      <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10">
              <TableHead className="text-gray-400">Command</TableHead>
              <TableHead className="text-gray-400">Description</TableHead>
              <TableHead className="text-gray-400">Category</TableHead>
              <TableHead className="text-gray-400">Permission</TableHead>
              <TableHead className="text-gray-400">Context</TableHead>
              <TableHead className="text-gray-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-400">
                  Loading commands...
                </TableCell>
              </TableRow>
            ) : commands?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-400">
                  No custom commands yet
                </TableCell>
              </TableRow>
            ) : (
              commands?.map((command) => (
                <TableRow key={command.id} className="border-white/10">
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CommandIcon className="h-4 w-4 text-primary" />
                        <span className="text-white font-mono">/{command.name}</span>
                      </div>
                      {command.aliases && command.aliases.length > 0 && (
                        <div className="text-xs text-gray-500">
                          Aliases: {command.aliases.map(a => `/${a}`).join(', ')}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-300">{command.description}</TableCell>
                  <TableCell>{getCategoryBadge(command.category)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-gray-300">
                      {command.permissionLevel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {command.context.map((ctx) => (
                        <Badge key={ctx} variant="secondary" className="text-xs">
                          {ctx}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(command)}
                        data-testid={`edit-${command.id}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(command.id)}
                        className="text-red-400 hover:text-red-300"
                        data-testid={`delete-${command.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCommand ? 'Edit Command' : 'Create Custom Command'}
            </DialogTitle>
            <DialogDescription>
              Define a custom slash command for your workspace
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Command Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="remind"
                  disabled={!!editingCommand}
                  data-testid="command-name"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lowercase letters, numbers, and underscores only
                </p>
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger id="category" data-testid="command-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Set a reminder for a user"
                data-testid="command-description"
              />
            </div>

            <div>
              <Label htmlFor="usage">Usage Example</Label>
              <Input
                id="usage"
                value={formData.usage}
                onChange={(e) => setFormData({ ...formData, usage: e.target.value })}
                placeholder="/remind @user [message] at [time]"
                data-testid="command-usage"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="permission">Permission Level</Label>
                <Select
                  value={formData.permissionLevel}
                  onValueChange={(value) => setFormData({ ...formData, permissionLevel: value })}
                >
                  <SelectTrigger id="permission" data-testid="command-permission">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="aliases">Aliases (comma-separated)</Label>
                <Input
                  id="aliases"
                  value={formData.aliases}
                  onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
                  placeholder="r, rem"
                  data-testid="command-aliases"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="webhook">Webhook URL (optional)</Label>
              <Input
                id="webhook"
                value={formData.webhookUrl}
                onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                placeholder="https://api.example.com/webhook"
                data-testid="command-webhook"
              />
              <p className="text-xs text-gray-500 mt-1">
                For webhook-based commands
              </p>
            </div>

            <div>
              <Label htmlFor="logic">Custom Logic (optional)</Label>
              <Textarea
                id="logic"
                value={formData.customLogic}
                onChange={(e) => setFormData({ ...formData, customLogic: e.target.value })}
                placeholder="// JavaScript code for command logic"
                className="font-mono h-32"
                data-testid="command-logic"
              />
              <p className="text-xs text-gray-500 mt-1">
                JavaScript code for advanced command logic
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="save-command"
            >
              {editingCommand ? 'Update' : 'Create'} Command
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}