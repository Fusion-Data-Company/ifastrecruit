import { db } from '../db';
import { slashCommands, commandHistory, commandPermissions, reminders, polls, pollVotes } from '@shared/schema';
import type { SlashCommand, InsertSlashCommand, InsertCommandHistory, User, Channel } from '@shared/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import { parseISO, addMinutes, addHours, addDays } from 'date-fns';

export interface CommandContext {
  user: User;
  channel?: Channel;
  dmUserId?: string;
  messageId?: string;
  rawMessage: string;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  action?: 'sendMessage' | 'openDM' | 'updateStatus' | 'createPoll' | 'setReminder' | 'showHelp';
}

export interface CommandParameter {
  name: string;
  type: 'string' | 'user' | 'number' | 'time' | 'emoji' | 'quoted';
  required?: boolean;
  description?: string;
  defaultValue?: any;
}

export interface CommandDefinition {
  name: string;
  description: string;
  usage: string;
  aliases?: string[];
  category?: string;
  parameters?: CommandParameter[];
  permissionLevel?: 'all' | 'admin' | 'channel_admin';
  context?: 'channel' | 'dm' | 'both';
  execute: (args: string[], context: CommandContext) => Promise<CommandResult>;
}

class CommandRegistry {
  private commands: Map<string, CommandDefinition> = new Map();
  private aliases: Map<string, string> = new Map();
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    
    // Register all built-in commands
    this.registerBuiltinCommands();
    
    // Load custom commands from database
    await this.loadCustomCommands();
    
    this.initialized = true;
  }

  private registerBuiltinCommands() {
    // /help - Show all available commands
    this.register({
      name: 'help',
      description: 'Show all available commands or get help for a specific command',
      usage: '/help [command]',
      category: 'General',
      permissionLevel: 'all',
      context: 'both',
      execute: async (args, context) => {
        if (args.length > 0) {
          const commandName = args[0].toLowerCase();
          const command = this.commands.get(commandName) || this.commands.get(this.aliases.get(commandName) || '');
          
          if (command) {
            return {
              success: true,
              action: 'showHelp',
              data: {
                command: command.name,
                description: command.description,
                usage: command.usage,
                aliases: command.aliases,
                parameters: command.parameters
              }
            };
          } else {
            return {
              success: false,
              error: `Command "${commandName}" not found`
            };
          }
        }
        
        // Show all commands grouped by category
        const commandsByCategory: Record<string, CommandDefinition[]> = {};
        for (const command of this.commands.values()) {
          const category = command.category || 'Uncategorized';
          if (!commandsByCategory[category]) {
            commandsByCategory[category] = [];
          }
          commandsByCategory[category].push(command);
        }
        
        return {
          success: true,
          action: 'showHelp',
          data: commandsByCategory
        };
      }
    });

    // /me - Send action message
    this.register({
      name: 'me',
      description: 'Send an action message',
      usage: '/me [action]',
      category: 'General',
      permissionLevel: 'all',
      context: 'both',
      execute: async (args, context) => {
        const action = args.join(' ');
        if (!action) {
          return { success: false, error: 'Please provide an action' };
        }
        
        return {
          success: true,
          action: 'sendMessage',
          message: `_${context.user.firstName || context.user.email} ${action}_`,
          data: { isAction: true }
        };
      }
    });

    // /dm - Open direct message
    this.register({
      name: 'dm',
      description: 'Open a direct message with a user',
      usage: '/dm @user',
      category: 'Communication',
      parameters: [{ name: 'user', type: 'user', required: true, description: 'User to message' }],
      permissionLevel: 'all',
      context: 'both',
      execute: async (args, context) => {
        const userMention = args[0];
        if (!userMention || !userMention.startsWith('@')) {
          return { success: false, error: 'Please mention a user (@username)' };
        }
        
        const username = userMention.substring(1);
        // Find user in database
        const targetUser = await db.query.users.findFirst({
          where: or(
            eq(sql`LOWER(CONCAT(first_name, last_name))`, username.toLowerCase()),
            eq(sql`LOWER(email)`, username.toLowerCase())
          )
        });
        
        if (!targetUser) {
          return { success: false, error: `User "${username}" not found` };
        }
        
        return {
          success: true,
          action: 'openDM',
          data: { userId: targetUser.id }
        };
      }
    });

    // /invite - Invite user to channel
    this.register({
      name: 'invite',
      description: 'Invite a user to the current channel',
      usage: '/invite @user',
      category: 'Channel Management',
      parameters: [{ name: 'user', type: 'user', required: true, description: 'User to invite' }],
      permissionLevel: 'channel_admin',
      context: 'channel',
      execute: async (args, context) => {
        if (!context.channel) {
          return { success: false, error: 'This command can only be used in a channel' };
        }
        
        const userMention = args[0];
        if (!userMention || !userMention.startsWith('@')) {
          return { success: false, error: 'Please mention a user (@username)' };
        }
        
        const username = userMention.substring(1);
        const targetUser = await db.query.users.findFirst({
          where: or(
            eq(sql`LOWER(CONCAT(first_name, last_name))`, username.toLowerCase()),
            eq(sql`LOWER(email)`, username.toLowerCase())
          )
        });
        
        if (!targetUser) {
          return { success: false, error: `User "${username}" not found` };
        }
        
        // Add user to channel
        await db.insert(channelMembers).values({
          channelId: context.channel.id,
          userId: targetUser.id,
          role: 'member'
        }).onConflictDoNothing();
        
        return {
          success: true,
          message: `${targetUser.firstName || targetUser.email} has been invited to #${context.channel.name}`
        };
      }
    });

    // /kick - Remove user from channel
    this.register({
      name: 'kick',
      description: 'Remove a user from the current channel',
      usage: '/kick @user',
      category: 'Channel Management',
      parameters: [{ name: 'user', type: 'user', required: true, description: 'User to remove' }],
      permissionLevel: 'channel_admin',
      context: 'channel',
      execute: async (args, context) => {
        if (!context.channel) {
          return { success: false, error: 'This command can only be used in a channel' };
        }
        
        const userMention = args[0];
        if (!userMention || !userMention.startsWith('@')) {
          return { success: false, error: 'Please mention a user (@username)' };
        }
        
        const username = userMention.substring(1);
        const targetUser = await db.query.users.findFirst({
          where: or(
            eq(sql`LOWER(CONCAT(first_name, last_name))`, username.toLowerCase()),
            eq(sql`LOWER(email)`, username.toLowerCase())
          )
        });
        
        if (!targetUser) {
          return { success: false, error: `User "${username}" not found` };
        }
        
        // Remove user from channel
        await db.delete(channelMembers)
          .where(and(
            eq(channelMembers.channelId, context.channel.id),
            eq(channelMembers.userId, targetUser.id)
          ));
        
        return {
          success: true,
          message: `${targetUser.firstName || targetUser.email} has been removed from #${context.channel.name}`
        };
      }
    });

    // /topic - Set channel topic
    this.register({
      name: 'topic',
      description: 'Set or view the channel topic',
      usage: '/topic [new topic]',
      category: 'Channel Management',
      permissionLevel: 'channel_admin',
      context: 'channel',
      execute: async (args, context) => {
        if (!context.channel) {
          return { success: false, error: 'This command can only be used in a channel' };
        }
        
        if (args.length === 0) {
          return {
            success: true,
            message: context.channel.topic || 'No topic set for this channel'
          };
        }
        
        const newTopic = args.join(' ');
        await db.update(channels)
          .set({ topic: newTopic })
          .where(eq(channels.id, context.channel.id));
        
        return {
          success: true,
          message: `Channel topic updated to: ${newTopic}`
        };
      }
    });

    // /remind - Set a reminder
    this.register({
      name: 'remind',
      description: 'Set a reminder for yourself or another user',
      usage: '/remind @user [message] at [time]',
      category: 'Productivity',
      parameters: [
        { name: 'user', type: 'user', required: true, description: 'User to remind (use @me for yourself)' },
        { name: 'message', type: 'string', required: true, description: 'Reminder message' },
        { name: 'time', type: 'time', required: true, description: 'When to remind (e.g., "in 30 minutes", "tomorrow at 3pm")' }
      ],
      permissionLevel: 'all',
      context: 'both',
      execute: async (args, context) => {
        // Parse the command
        const parts = args.join(' ').match(/^(@\S+)\s+(.*)\s+at\s+(.*)$/);
        if (!parts) {
          return { success: false, error: 'Invalid format. Use: /remind @user [message] at [time]' };
        }
        
        const [, userMention, message, timeStr] = parts;
        
        // Parse user
        let targetUserId = context.user.id;
        if (userMention !== '@me') {
          const username = userMention.substring(1);
          const targetUser = await db.query.users.findFirst({
            where: or(
              eq(sql`LOWER(CONCAT(first_name, last_name))`, username.toLowerCase()),
              eq(sql`LOWER(email)`, username.toLowerCase())
            )
          });
          
          if (!targetUser) {
            return { success: false, error: `User "${username}" not found` };
          }
          targetUserId = targetUser.id;
        }
        
        // Parse time
        const remindAt = this.parseTime(timeStr);
        if (!remindAt) {
          return { success: false, error: 'Invalid time format' };
        }
        
        // Create reminder
        await db.insert(reminders).values({
          userId: context.user.id,
          targetUserId,
          channelId: context.channel?.id,
          message,
          remindAt
        });
        
        return {
          success: true,
          action: 'setReminder',
          message: `Reminder set for ${remindAt.toLocaleString()}`,
          data: { targetUserId, message, remindAt }
        };
      }
    });

    // /status - Set user status
    this.register({
      name: 'status',
      description: 'Set your status',
      usage: '/status [emoji] [text]',
      category: 'Profile',
      parameters: [
        { name: 'emoji', type: 'emoji', required: false, description: 'Status emoji' },
        { name: 'text', type: 'string', required: false, description: 'Status text' }
      ],
      permissionLevel: 'all',
      context: 'both',
      execute: async (args, context) => {
        if (args.length === 0) {
          // Clear status
          await db.update(users)
            .set({ statusEmoji: null, statusText: null })
            .where(eq(users.id, context.user.id));
          
          return {
            success: true,
            action: 'updateStatus',
            message: 'Status cleared'
          };
        }
        
        let emoji = '';
        let text = '';
        
        // Check if first arg is emoji
        if (args[0].match(/^:[a-z0-9_]+:$/) || args[0].match(/[\u{1F300}-\u{1F9FF}]/u)) {
          emoji = args[0];
          text = args.slice(1).join(' ');
        } else {
          text = args.join(' ');
        }
        
        await db.update(users)
          .set({ statusEmoji: emoji || null, statusText: text || null })
          .where(eq(users.id, context.user.id));
        
        return {
          success: true,
          action: 'updateStatus',
          message: `Status set to: ${emoji} ${text}`.trim()
        };
      }
    });

    // /away - Set away status
    this.register({
      name: 'away',
      description: 'Set your status to away',
      usage: '/away [message]',
      category: 'Profile',
      aliases: ['afk'],
      permissionLevel: 'all',
      context: 'both',
      execute: async (args, context) => {
        const message = args.join(' ') || 'Away';
        
        await db.update(users)
          .set({ 
            statusEmoji: '🚫',
            statusText: message,
            onlineStatus: 'away'
          })
          .where(eq(users.id, context.user.id));
        
        return {
          success: true,
          action: 'updateStatus',
          message: `You are now away: ${message}`
        };
      }
    });

    // /dnd - Do not disturb mode
    this.register({
      name: 'dnd',
      description: 'Enable do not disturb mode',
      usage: '/dnd [duration in minutes]',
      category: 'Profile',
      parameters: [
        { name: 'duration', type: 'number', required: false, description: 'Duration in minutes' }
      ],
      permissionLevel: 'all',
      context: 'both',
      execute: async (args, context) => {
        const duration = args[0] ? parseInt(args[0]) : 60; // Default 1 hour
        
        if (isNaN(duration)) {
          return { success: false, error: 'Invalid duration. Please provide a number in minutes' };
        }
        
        const until = addMinutes(new Date(), duration);
        
        await db.update(users)
          .set({ 
            statusEmoji: '🔴',
            statusText: `Do not disturb until ${until.toLocaleTimeString()}`,
            onlineStatus: 'dnd'
          })
          .where(eq(users.id, context.user.id));
        
        return {
          success: true,
          action: 'updateStatus',
          message: `Do not disturb mode enabled for ${duration} minutes`
        };
      }
    });

    // /search - Quick search
    this.register({
      name: 'search',
      description: 'Search for messages, files, or users',
      usage: '/search [query]',
      category: 'Productivity',
      aliases: ['find'],
      permissionLevel: 'all',
      context: 'both',
      execute: async (args, context) => {
        const query = args.join(' ');
        if (!query) {
          return { success: false, error: 'Please provide a search query' };
        }
        
        // This would typically trigger a search modal or redirect
        return {
          success: true,
          action: 'search',
          data: { query }
        };
      }
    });

    // /giphy - Send a GIF
    this.register({
      name: 'giphy',
      description: 'Search and send a GIF',
      usage: '/giphy [keyword]',
      category: 'Fun',
      aliases: ['gif'],
      permissionLevel: 'all',
      context: 'both',
      execute: async (args, context) => {
        const keyword = args.join(' ');
        if (!keyword) {
          return { success: false, error: 'Please provide a keyword for GIF search' };
        }
        
        // This would integrate with Giphy API
        // For now, return a placeholder
        return {
          success: true,
          action: 'sendMessage',
          message: `/giphy ${keyword}`,
          data: { isGiphy: true, keyword }
        };
      }
    });

    // /poll - Create a poll
    this.register({
      name: 'poll',
      description: 'Create a poll',
      usage: '/poll "question" "option1" "option2" ...',
      category: 'Productivity',
      parameters: [
        { name: 'question', type: 'quoted', required: true, description: 'Poll question' },
        { name: 'options', type: 'quoted', required: true, description: 'Poll options (at least 2)' }
      ],
      permissionLevel: 'all',
      context: 'channel',
      execute: async (args, context) => {
        if (!context.channel) {
          return { success: false, error: 'Polls can only be created in channels' };
        }
        
        // Parse quoted strings
        const quotedStrings = args.join(' ').match(/"([^"]*)"/g);
        if (!quotedStrings || quotedStrings.length < 3) {
          return { success: false, error: 'Please provide a question and at least 2 options in quotes' };
        }
        
        const question = quotedStrings[0].replace(/"/g, '');
        const options = quotedStrings.slice(1).map((opt, index) => ({
          id: String(index + 1),
          text: opt.replace(/"/g, ''),
          votes: []
        }));
        
        // Create poll
        const [poll] = await db.insert(polls).values({
          channelId: context.channel.id,
          createdBy: context.user.id,
          question,
          options
        }).returning();
        
        return {
          success: true,
          action: 'createPoll',
          data: poll
        };
      }
    });

    // /shrug - Add shrug emoticon
    this.register({
      name: 'shrug',
      description: 'Add a shrug to your message',
      usage: '/shrug [message]',
      category: 'Fun',
      permissionLevel: 'all',
      context: 'both',
      execute: async (args, context) => {
        const message = args.join(' ');
        const shrug = '¯\\_(ツ)_/¯';
        
        return {
          success: true,
          action: 'sendMessage',
          message: message ? `${message} ${shrug}` : shrug
        };
      }
    });

    // /tableflip - Flip a table
    this.register({
      name: 'tableflip',
      description: 'Flip a table in frustration',
      usage: '/tableflip [message]',
      category: 'Fun',
      aliases: ['flip'],
      permissionLevel: 'all',
      context: 'both',
      execute: async (args, context) => {
        const message = args.join(' ');
        const flip = '(╯°□°）╯︵ ┻━┻';
        
        return {
          success: true,
          action: 'sendMessage',
          message: message ? `${message} ${flip}` : flip
        };
      }
    });
  }

  private parseTime(timeStr: string): Date | null {
    const now = new Date();
    
    // Parse relative times
    if (timeStr.startsWith('in ')) {
      const relativeMatch = timeStr.match(/in (\d+) (minute|hour|day)s?/);
      if (relativeMatch) {
        const [, amount, unit] = relativeMatch;
        const num = parseInt(amount);
        
        switch (unit) {
          case 'minute':
            return addMinutes(now, num);
          case 'hour':
            return addHours(now, num);
          case 'day':
            return addDays(now, num);
        }
      }
    }
    
    // Parse "tomorrow at X"
    if (timeStr.startsWith('tomorrow at ')) {
      const timeMatch = timeStr.match(/tomorrow at (\d{1,2}):?(\d{2})?\s?(am|pm)?/i);
      if (timeMatch) {
        const [, hour, minute = '0', period] = timeMatch;
        const tomorrow = addDays(now, 1);
        tomorrow.setHours(
          period?.toLowerCase() === 'pm' && parseInt(hour) !== 12 ? parseInt(hour) + 12 : parseInt(hour),
          parseInt(minute),
          0,
          0
        );
        return tomorrow;
      }
    }
    
    // Try parsing as ISO date
    try {
      return parseISO(timeStr);
    } catch {
      return null;
    }
  }

  async loadCustomCommands() {
    const customCommands = await db.query.slashCommands.findMany({
      where: eq(slashCommands.type, 'custom')
    });
    
    for (const cmd of customCommands) {
      if (!cmd.isEnabled || cmd.isDeprecated) continue;
      
      // Create a command definition for custom commands
      this.register({
        name: cmd.name,
        description: cmd.description,
        usage: cmd.usage,
        aliases: cmd.aliases || [],
        category: cmd.category || 'Custom',
        permissionLevel: cmd.permissionLevel as any,
        context: cmd.context as any,
        parameters: cmd.parameters as CommandParameter[] || [],
        execute: async (args, context) => {
          // Handle custom command logic
          if (cmd.webhookUrl) {
            // Execute webhook
            try {
              const response = await fetch(cmd.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  command: cmd.name,
                  args,
                  user: context.user,
                  channel: context.channel
                })
              });
              
              const result = await response.json();
              return result;
            } catch (error) {
              return {
                success: false,
                error: `Failed to execute webhook: ${error.message}`
              };
            }
          } else if (cmd.customLogic) {
            // Handle template-based custom logic
            let message = cmd.customLogic.template || '';
            
            // Replace variables
            message = message.replace('{{user}}', context.user.firstName || context.user.email);
            message = message.replace('{{args}}', args.join(' '));
            
            return {
              success: true,
              action: 'sendMessage',
              message
            };
          }
          
          return {
            success: false,
            error: 'Custom command has no execution logic'
          };
        }
      });
    }
  }

  register(command: CommandDefinition) {
    this.commands.set(command.name.toLowerCase(), command);
    
    // Register aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
      }
    }
  }

  async execute(commandLine: string, context: CommandContext): Promise<CommandResult> {
    // Parse command and arguments
    const parts = commandLine.slice(1).split(/\s+/);
    const commandName = parts[0]?.toLowerCase();
    const args = parts.slice(1);
    
    if (!commandName) {
      return { success: false, error: 'No command provided' };
    }
    
    // Find command (check aliases too)
    const command = this.commands.get(commandName) || this.commands.get(this.aliases.get(commandName) || '');
    
    if (!command) {
      return { success: false, error: `Unknown command: /${commandName}` };
    }
    
    // Check permissions
    if (command.permissionLevel === 'admin' && !context.user.isAdmin) {
      return { success: false, error: 'This command requires admin privileges' };
    }
    
    if (command.permissionLevel === 'channel_admin' && context.channel) {
      // Check if user is channel admin
      const membership = await db.query.channelMembers.findFirst({
        where: and(
          eq(channelMembers.channelId, context.channel.id),
          eq(channelMembers.userId, context.user.id)
        )
      });
      
      if (membership?.role !== 'admin' && !context.user.isAdmin) {
        return { success: false, error: 'This command requires channel admin privileges' };
      }
    }
    
    // Check context
    if (command.context === 'channel' && !context.channel) {
      return { success: false, error: 'This command can only be used in channels' };
    }
    
    if (command.context === 'dm' && !context.dmUserId) {
      return { success: false, error: 'This command can only be used in direct messages' };
    }
    
    // Execute command
    const startTime = Date.now();
    let result: CommandResult;
    
    try {
      result = await command.execute(args, context);
    } catch (error) {
      result = {
        success: false,
        error: `Command failed: ${error.message}`
      };
    }
    
    const executionTime = Date.now() - startTime;
    
    // Log command execution
    await db.insert(commandHistory).values({
      commandName: command.name,
      commandId: await this.getCommandId(command.name),
      userId: context.user.id,
      channelId: context.channel?.id,
      dmUserId: context.dmUserId,
      args: args.join(' '),
      parsedArgs: { args },
      context: {
        user: { id: context.user.id, email: context.user.email },
        channel: context.channel ? { id: context.channel.id, name: context.channel.name } : undefined
      },
      result,
      success: result.success,
      error: result.error,
      executionTime
    });
    
    return result;
  }

  async getCommandId(name: string): Promise<string | null> {
    const cmd = await db.query.slashCommands.findFirst({
      where: eq(slashCommands.name, name)
    });
    return cmd?.id || null;
  }

  async getAvailableCommands(userId: string, channelId?: string): Promise<SlashCommand[]> {
    // Get user permissions
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });
    
    if (!user) return [];
    
    // Get all enabled commands
    const allCommands = await db.query.slashCommands.findMany({
      where: and(
        eq(slashCommands.isEnabled, true),
        eq(slashCommands.isDeprecated, false)
      )
    });
    
    // Filter based on permissions
    const availableCommands = [];
    for (const cmd of allCommands) {
      // Check permission level
      if (cmd.permissionLevel === 'admin' && !user.isAdmin) continue;
      
      // Check custom permissions
      const customPermission = await db.query.commandPermissions.findFirst({
        where: and(
          eq(commandPermissions.commandId, cmd.id),
          eq(commandPermissions.userId, userId)
        )
      });
      
      if (customPermission?.permission === 'deny') continue;
      
      // Check context
      if (channelId && cmd.context === 'dm') continue;
      if (!channelId && cmd.context === 'channel') continue;
      
      availableCommands.push(cmd);
    }
    
    return availableCommands;
  }

  getCommandSuggestions(prefix: string): CommandDefinition[] {
    const suggestions: CommandDefinition[] = [];
    const lowerPrefix = prefix.toLowerCase();
    
    for (const command of this.commands.values()) {
      if (command.name.startsWith(lowerPrefix)) {
        suggestions.push(command);
      }
    }
    
    // Also check aliases
    for (const [alias, commandName] of this.aliases.entries()) {
      if (alias.startsWith(lowerPrefix) && !suggestions.find(c => c.name === commandName)) {
        const command = this.commands.get(commandName);
        if (command) {
          suggestions.push(command);
        }
      }
    }
    
    return suggestions;
  }
}

// Import missing tables
import { users, channels, channelMembers } from '@shared/schema';

export const commandRegistry = new CommandRegistry();