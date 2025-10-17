import { Router } from 'express';
import { commandRegistry } from '../services/command-registry';
import { db } from '../db';
import { 
  slashCommands, 
  commandHistory, 
  commandPermissions, 
  commandFavorites, 
  reminders,
  polls,
  pollVotes 
} from '@shared/schema';
import { eq, and, desc, sql, or, gte } from 'drizzle-orm';
import type { Request, Response } from 'express';

const router = Router();

// Initialize command registry on startup
commandRegistry.initialize().catch(console.error);

// Execute a slash command
router.post('/api/commands/execute', async (req: Request, res: Response) => {
  try {
    const { command, channelId, dmUserId } = req.body;
    
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.session.userId)
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    let channel;
    if (channelId) {
      channel = await db.query.channels.findFirst({
        where: eq(channels.id, channelId)
      });
    }
    
    const result = await commandRegistry.execute(command, {
      user,
      channel,
      dmUserId,
      rawMessage: command
    });
    
    // Update command favorites
    if (result.success) {
      const commandName = command.slice(1).split(/\s+/)[0];
      const commandRecord = await db.query.slashCommands.findFirst({
        where: eq(slashCommands.name, commandName)
      });
      
      if (commandRecord) {
        const favorite = await db.query.commandFavorites.findFirst({
          where: and(
            eq(commandFavorites.userId, user.id),
            eq(commandFavorites.commandId, commandRecord.id)
          )
        });
        
        if (favorite) {
          await db.update(commandFavorites)
            .set({ 
              lastUsed: new Date(),
              useCount: favorite.useCount + 1
            })
            .where(eq(commandFavorites.id, favorite.id));
        } else {
          await db.insert(commandFavorites).values({
            userId: user.id,
            commandId: commandRecord.id
          });
        }
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error executing command:', error);
    res.status(500).json({ error: 'Failed to execute command' });
  }
});

// Get available commands for the current user
router.get('/api/commands/available', async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { channelId } = req.query;
    const commands = await commandRegistry.getAvailableCommands(
      req.session.userId,
      channelId as string
    );
    
    // Add favorite and usage data
    const favorites = await db.query.commandFavorites.findMany({
      where: eq(commandFavorites.userId, req.session.userId)
    });
    
    const enrichedCommands = commands.map(cmd => {
      const favorite = favorites.find(f => f.commandId === cmd.id);
      return {
        ...cmd,
        isFavorite: !!favorite,
        useCount: favorite?.useCount || 0,
        lastUsed: favorite?.lastUsed
      };
    });
    
    // Sort by favorites and usage
    enrichedCommands.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return b.useCount - a.useCount;
    });
    
    res.json(enrichedCommands);
  } catch (error) {
    console.error('Error getting available commands:', error);
    res.status(500).json({ error: 'Failed to get commands' });
  }
});

// Get command history for the current user
router.get('/api/commands/history', async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { limit = 50, offset = 0 } = req.query;
    
    const history = await db.query.commandHistory.findMany({
      where: eq(commandHistory.userId, req.session.userId),
      orderBy: [desc(commandHistory.executedAt)],
      limit: Number(limit),
      offset: Number(offset)
    });
    
    res.json(history);
  } catch (error) {
    console.error('Error getting command history:', error);
    res.status(500).json({ error: 'Failed to get command history' });
  }
});

// Create a custom command (admin only)
router.post('/api/commands/custom', async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.session.userId)
    });
    
    if (!user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const {
      name,
      description,
      usage,
      category,
      permissionLevel,
      context,
      webhookUrl,
      customLogic,
      parameters,
      aliases
    } = req.body;
    
    // Validate command name
    if (!name || !/^[a-z0-9_]+$/.test(name)) {
      return res.status(400).json({ error: 'Invalid command name' });
    }
    
    // Check if command already exists
    const existing = await db.query.slashCommands.findFirst({
      where: eq(slashCommands.name, name)
    });
    
    if (existing) {
      return res.status(409).json({ error: 'Command already exists' });
    }
    
    const [command] = await db.insert(slashCommands).values({
      name,
      description,
      usage,
      type: 'custom',
      category,
      permissionLevel,
      context,
      webhookUrl,
      customLogic,
      parameters,
      aliases,
      createdBy: user.id
    }).returning();
    
    // Reload custom commands in registry
    await commandRegistry.loadCustomCommands();
    
    res.json(command);
  } catch (error) {
    console.error('Error creating custom command:', error);
    res.status(500).json({ error: 'Failed to create command' });
  }
});

// Update a custom command (admin only)
router.patch('/api/commands/custom/:id', async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.session.userId)
    });
    
    if (!user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { id } = req.params;
    const updates = req.body;
    
    const [command] = await db.update(slashCommands)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(and(
        eq(slashCommands.id, id),
        eq(slashCommands.type, 'custom')
      ))
      .returning();
    
    if (!command) {
      return res.status(404).json({ error: 'Command not found' });
    }
    
    // Reload custom commands in registry
    await commandRegistry.loadCustomCommands();
    
    res.json(command);
  } catch (error) {
    console.error('Error updating custom command:', error);
    res.status(500).json({ error: 'Failed to update command' });
  }
});

// Get all custom commands (admin only)
router.get('/api/commands/custom', async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.session.userId)
    });
    
    if (!user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const commands = await db.query.slashCommands.findMany({
      where: eq(slashCommands.type, 'custom'),
      orderBy: [desc(slashCommands.createdAt)]
    });
    
    res.json(commands);
  } catch (error) {
    console.error('Error getting custom commands:', error);
    res.status(500).json({ error: 'Failed to get custom commands' });
  }
});

// Delete a custom command (admin only)
router.delete('/api/commands/custom/:id', async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.session.userId)
    });
    
    if (!user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { id } = req.params;
    
    await db.delete(slashCommands)
      .where(and(
        eq(slashCommands.id, id),
        eq(slashCommands.type, 'custom')
      ));
    
    // Reload custom commands in registry
    await commandRegistry.loadCustomCommands();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting custom command:', error);
    res.status(500).json({ error: 'Failed to delete command' });
  }
});

// Get command suggestions for autocomplete
router.get('/api/commands/suggestions', async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { prefix = '', channelId } = req.query;
    
    if (!prefix || typeof prefix !== 'string') {
      return res.json([]);
    }
    
    const suggestions = commandRegistry.getCommandSuggestions(prefix);
    const availableCommands = await commandRegistry.getAvailableCommands(
      req.session.userId,
      channelId as string
    );
    
    // Filter suggestions to only available commands
    const availableNames = new Set(availableCommands.map(c => c.name));
    const filtered = suggestions.filter(s => availableNames.has(s.name));
    
    res.json(filtered);
  } catch (error) {
    console.error('Error getting command suggestions:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// Get active reminders
router.get('/api/commands/reminders', async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const activeReminders = await db.query.reminders.findMany({
      where: and(
        or(
          eq(reminders.userId, req.session.userId),
          eq(reminders.targetUserId, req.session.userId)
        ),
        eq(reminders.isCompleted, false),
        gte(reminders.remindAt, new Date())
      ),
      orderBy: [reminders.remindAt]
    });
    
    res.json(activeReminders);
  } catch (error) {
    console.error('Error getting reminders:', error);
    res.status(500).json({ error: 'Failed to get reminders' });
  }
});

// Get active polls for a channel
router.get('/api/commands/polls/:channelId', async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { channelId } = req.params;
    
    const activePolls = await db.query.polls.findMany({
      where: and(
        eq(polls.channelId, channelId),
        eq(polls.isClosed, false)
      ),
      orderBy: [desc(polls.createdAt)]
    });
    
    // Get votes for current user
    const pollIds = activePolls.map(p => p.id);
    const userVotes = await db.query.pollVotes.findMany({
      where: and(
        sql`${pollVotes.pollId} = ANY(${pollIds})`,
        eq(pollVotes.userId, req.session.userId)
      )
    });
    
    const pollsWithVotes = activePolls.map(poll => ({
      ...poll,
      userVotes: userVotes.filter(v => v.pollId === poll.id).map(v => v.optionId)
    }));
    
    res.json(pollsWithVotes);
  } catch (error) {
    console.error('Error getting polls:', error);
    res.status(500).json({ error: 'Failed to get polls' });
  }
});

// Vote on a poll
router.post('/api/commands/polls/:pollId/vote', async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { pollId } = req.params;
    const { optionId } = req.body;
    
    const poll = await db.query.polls.findFirst({
      where: eq(polls.id, pollId)
    });
    
    if (!poll || poll.isClosed) {
      return res.status(404).json({ error: 'Poll not found or closed' });
    }
    
    // Check if option exists
    const options = poll.options as any[];
    if (!options.find(o => o.id === optionId)) {
      return res.status(400).json({ error: 'Invalid option' });
    }
    
    // Check if already voted (for single choice polls)
    if (!poll.allowMultiple) {
      const existingVote = await db.query.pollVotes.findFirst({
        where: and(
          eq(pollVotes.pollId, pollId),
          eq(pollVotes.userId, req.session.userId)
        )
      });
      
      if (existingVote) {
        // Update vote
        await db.delete(pollVotes)
          .where(eq(pollVotes.id, existingVote.id));
      }
    }
    
    // Add vote
    await db.insert(pollVotes).values({
      pollId,
      userId: req.session.userId,
      optionId
    }).onConflictDoNothing();
    
    // Update poll options with vote count
    const allVotes = await db.query.pollVotes.findMany({
      where: eq(pollVotes.pollId, pollId)
    });
    
    const updatedOptions = options.map(option => ({
      ...option,
      votes: allVotes.filter(v => v.optionId === option.id).map(v => v.userId)
    }));
    
    await db.update(polls)
      .set({ options: updatedOptions })
      .where(eq(polls.id, pollId));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error voting on poll:', error);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// Import missing table
import { users, channels, channelMembers } from '@shared/schema';

export default router;