import { 
  messages, 
  directMessages, 
  channels, 
  users, 
  fileUploads,
  savedSearches,
  searchHistory,
  type Message,
  type DirectMessage,
  type Channel,
  type User,
  type FileUpload,
  type SavedSearch,
  type SearchHistory
} from "@shared/schema";
import { db } from "../db";
import { storage } from "../storage";
import { sql, eq, and, or, desc, asc, gte, lte, like, ilike, inArray } from "drizzle-orm";

export interface SearchFilters {
  channels?: string[];
  users?: string[];
  dateRange?: { start?: Date; end?: Date };
  fileTypes?: string[];
  hasAttachments?: boolean;
  messageTypes?: ('regular' | 'thread' | 'dm')[];
  isArchived?: boolean;
}

export interface SearchOperators {
  from?: string[];        // from:@user
  in?: string[];          // in:#channel
  has?: string[];         // has:link, has:file, has:reaction
  before?: Date;          // before:date
  after?: Date;           // after:date
  exact?: boolean;        // quotation marks
  exclude?: string[];     // NOT operator
}

export interface SearchResult {
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
  timestamp: Date;
  highlights?: string[];
  score?: number;
  metadata?: any;
}

export interface SearchOptions {
  query: string;
  filters?: SearchFilters;
  operators?: SearchOperators;
  limit?: number;
  offset?: number;
  scope?: 'all' | 'messages' | 'files' | 'channels' | 'users';
  sortBy?: 'relevance' | 'date' | 'author';
  sortOrder?: 'asc' | 'desc';
  userId: string;
  userChannelIds?: string[];
}

export class SearchService {
  // Parse search query with operators
  parseSearchQuery(query: string): { baseQuery: string; operators: SearchOperators } {
    const operators: SearchOperators = {};
    let baseQuery = query;

    // Extract quoted exact matches
    const exactMatches = query.match(/"([^"]+)"/g);
    if (exactMatches) {
      operators.exact = true;
      baseQuery = baseQuery.replace(/"([^"]+)"/g, '$1');
    }

    // Extract from: operators
    const fromMatches = query.match(/from:@?(\S+)/gi);
    if (fromMatches) {
      operators.from = fromMatches.map(m => m.replace(/from:@?/i, ''));
      baseQuery = baseQuery.replace(/from:@?\S+/gi, '');
    }

    // Extract in: operators
    const inMatches = query.match(/in:#?(\S+)/gi);
    if (inMatches) {
      operators.in = inMatches.map(m => m.replace(/in:#?/i, ''));
      baseQuery = baseQuery.replace(/in:#?\S+/gi, '');
    }

    // Extract has: operators
    const hasMatches = query.match(/has:(\S+)/gi);
    if (hasMatches) {
      operators.has = hasMatches.map(m => m.replace(/has:/i, ''));
      baseQuery = baseQuery.replace(/has:\S+/gi, '');
    }

    // Extract before: operator
    const beforeMatch = query.match(/before:(\S+)/i);
    if (beforeMatch) {
      operators.before = new Date(beforeMatch[1]);
      baseQuery = baseQuery.replace(/before:\S+/i, '');
    }

    // Extract after: operator
    const afterMatch = query.match(/after:(\S+)/i);
    if (afterMatch) {
      operators.after = new Date(afterMatch[1]);
      baseQuery = baseQuery.replace(/after:\S+/i, '');
    }

    // Extract NOT operators
    const notMatches = query.match(/NOT\s+(\S+)/gi);
    if (notMatches) {
      operators.exclude = notMatches.map(m => m.replace(/NOT\s+/i, ''));
      baseQuery = baseQuery.replace(/NOT\s+\S+/gi, '');
    }

    return {
      baseQuery: baseQuery.trim(),
      operators
    };
  }

  // Main search method
  async search(options: SearchOptions): Promise<{ results: SearchResult[]; total: number }> {
    const { baseQuery, operators } = this.parseSearchQuery(options.query);
    
    // Track search history
    await this.trackSearch(options.userId, options.query, options.filters);

    const results: SearchResult[] = [];
    let total = 0;

    // Determine what to search based on scope
    const scopes = options.scope === 'all' 
      ? ['messages', 'files', 'channels', 'users'] 
      : [options.scope];

    for (const scope of scopes) {
      if (scope === 'messages') {
        const messageResults = await this.searchMessages(baseQuery, operators, options);
        results.push(...messageResults);
      } else if (scope === 'files') {
        const fileResults = await this.searchFiles(baseQuery, operators, options);
        results.push(...fileResults);
      } else if (scope === 'channels') {
        const channelResults = await this.searchChannels(baseQuery, options);
        results.push(...channelResults);
      } else if (scope === 'users') {
        const userResults = await this.searchUsers(baseQuery, options);
        results.push(...userResults);
      }
    }

    // Sort results
    if (options.sortBy === 'relevance') {
      results.sort((a, b) => (b.score || 0) - (a.score || 0));
    } else if (options.sortBy === 'date') {
      results.sort((a, b) => {
        const order = options.sortOrder === 'asc' ? 1 : -1;
        return order * (a.timestamp.getTime() - b.timestamp.getTime());
      });
    }

    // Apply pagination
    const start = options.offset || 0;
    const limit = options.limit || 20;
    const paginatedResults = results.slice(start, start + limit);

    return {
      results: paginatedResults,
      total: results.length
    };
  }

  // Search messages
  private async searchMessages(
    query: string, 
    operators: SearchOperators,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const conditions = [];
    
    // Base text search
    if (query) {
      const searchPattern = operators.exact ? query : `%${query}%`;
      conditions.push(sql`LOWER(${messages.content}) LIKE LOWER(${searchPattern})`);
    }

    // Apply operators
    if (operators.from && operators.from.length > 0) {
      // Get user IDs for usernames
      const userConditions = operators.from.map(username => 
        sql`LOWER(${users.firstName}) = LOWER(${username}) OR 
            LOWER(${users.lastName}) = LOWER(${username}) OR
            LOWER(${users.email}) LIKE LOWER(${username + '%'})`
      );
      
      const matchedUsers = await db.select({ id: users.id })
        .from(users)
        .where(or(...userConditions));
      
      if (matchedUsers.length > 0) {
        conditions.push(inArray(messages.senderId, matchedUsers.map(u => u.id)));
      }
    }

    if (operators.in && operators.in.length > 0) {
      // Get channel IDs for channel names
      const channelConditions = operators.in.map(channelName =>
        sql`LOWER(${channels.name}) = LOWER(${channelName})`
      );
      
      const matchedChannels = await db.select({ id: channels.id })
        .from(channels)
        .where(or(...channelConditions));
      
      if (matchedChannels.length > 0) {
        conditions.push(inArray(messages.channelId, matchedChannels.map(c => c.id)));
      }
    }

    if (operators.before) {
      conditions.push(lte(messages.createdAt, operators.before));
    }

    if (operators.after) {
      conditions.push(gte(messages.createdAt, operators.after));
    }

    if (operators.has) {
      for (const hasOp of operators.has) {
        if (hasOp === 'file' || hasOp === 'attachment') {
          conditions.push(sql`${messages.fileIds} IS NOT NULL AND array_length(${messages.fileIds}, 1) > 0`);
        } else if (hasOp === 'link') {
          conditions.push(sql`${messages.content} ~ 'https?://'`);
        }
      }
    }

    // Apply filters
    if (options.filters?.channels && options.filters.channels.length > 0) {
      conditions.push(inArray(messages.channelId, options.filters.channels));
    }

    // Restrict to user's accessible channels
    if (options.userChannelIds && options.userChannelIds.length > 0) {
      conditions.push(inArray(messages.channelId, options.userChannelIds));
    }

    // Execute query
    const results = await db.select({
      message: messages,
      user: users,
      channel: channels
    })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .leftJoin(channels, eq(messages.channelId, channels.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(messages.createdAt))
      .limit(options.limit || 20)
      .offset(options.offset || 0);

    return results.map(r => ({
      id: r.message.id,
      type: 'message' as const,
      content: r.message.content,
      context: this.getMessageContext(r.message.content, query),
      author: r.user ? {
        id: r.user.id,
        name: `${r.user.firstName} ${r.user.lastName}`.trim() || r.user.email
      } : undefined,
      channel: r.channel ? {
        id: r.channel.id,
        name: r.channel.name
      } : undefined,
      timestamp: r.message.createdAt,
      highlights: this.getHighlights(r.message.content, query),
      score: this.calculateScore(r.message.content, query)
    }));
  }

  // Search direct messages
  private async searchDirectMessages(
    query: string,
    operators: SearchOperators,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const conditions = [];
    
    // Base text search
    if (query) {
      const searchPattern = operators.exact ? query : `%${query}%`;
      conditions.push(sql`LOWER(${directMessages.content}) LIKE LOWER(${searchPattern})`);
    }

    // Restrict to user's DMs
    conditions.push(
      or(
        eq(directMessages.senderId, options.userId),
        eq(directMessages.receiverId, options.userId)
      )
    );

    // Apply date operators
    if (operators.before) {
      conditions.push(lte(directMessages.createdAt, operators.before));
    }

    if (operators.after) {
      conditions.push(gte(directMessages.createdAt, operators.after));
    }

    // Execute query
    const results = await db.select({
      dm: directMessages,
      sender: users,
    })
      .from(directMessages)
      .leftJoin(users, eq(directMessages.senderId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(directMessages.createdAt))
      .limit(options.limit || 20)
      .offset(options.offset || 0);

    return results.map(r => ({
      id: r.dm.id,
      type: 'dm' as const,
      content: r.dm.content,
      context: this.getMessageContext(r.dm.content, query),
      author: r.sender ? {
        id: r.sender.id,
        name: `${r.sender.firstName} ${r.sender.lastName}`.trim() || r.sender.email
      } : undefined,
      timestamp: r.dm.createdAt,
      highlights: this.getHighlights(r.dm.content, query),
      score: this.calculateScore(r.dm.content, query)
    }));
  }

  // Search files
  private async searchFiles(
    query: string,
    operators: SearchOperators,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const conditions = [];
    
    // Base text search on filename
    if (query) {
      const searchPattern = `%${query}%`;
      conditions.push(sql`LOWER(${fileUploads.fileName}) LIKE LOWER(${searchPattern})`);
    }

    // Filter by file type
    if (options.filters?.fileTypes && options.filters.fileTypes.length > 0) {
      conditions.push(inArray(fileUploads.fileType, options.filters.fileTypes));
    }

    // Execute query
    const results = await db.select({
      file: fileUploads,
      user: users
    })
      .from(fileUploads)
      .leftJoin(users, eq(fileUploads.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(fileUploads.uploadedAt))
      .limit(options.limit || 20)
      .offset(options.offset || 0);

    return results.map(r => ({
      id: r.file.id,
      type: 'file' as const,
      title: r.file.fileName,
      content: r.file.fileName,
      url: r.file.fileUrl,
      author: r.user ? {
        id: r.user.id,
        name: `${r.user.firstName} ${r.user.lastName}`.trim() || r.user.email
      } : undefined,
      timestamp: r.file.uploadedAt,
      metadata: {
        fileType: r.file.fileType,
        fileSize: r.file.fileSize,
        mimeType: r.file.mimeType
      },
      score: this.calculateScore(r.file.fileName, query)
    }));
  }

  // Search channels
  private async searchChannels(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const conditions = [];
    
    // Base text search
    if (query) {
      const searchPattern = `%${query}%`;
      conditions.push(
        or(
          sql`LOWER(${channels.name}) LIKE LOWER(${searchPattern})`,
          sql`LOWER(${channels.description}) LIKE LOWER(${searchPattern})`,
          sql`LOWER(${channels.purpose}) LIKE LOWER(${searchPattern})`
        )
      );
    }

    // Execute query
    const results = await db.select()
      .from(channels)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(options.limit || 20)
      .offset(options.offset || 0);

    return results.map(ch => ({
      id: ch.id,
      type: 'channel' as const,
      title: ch.name,
      content: ch.description || ch.purpose || '',
      timestamp: ch.createdAt,
      metadata: {
        tier: ch.tier,
        isPrivate: ch.isPrivate,
        isArchived: ch.isArchived
      },
      score: this.calculateScore(`${ch.name} ${ch.description} ${ch.purpose}`, query)
    }));
  }

  // Search users
  private async searchUsers(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const conditions = [];
    
    // Base text search
    if (query) {
      const searchPattern = `%${query}%`;
      conditions.push(
        or(
          sql`LOWER(${users.firstName}) LIKE LOWER(${searchPattern})`,
          sql`LOWER(${users.lastName}) LIKE LOWER(${searchPattern})`,
          sql`LOWER(${users.email}) LIKE LOWER(${searchPattern})`,
          sql`LOWER(CONCAT(${users.firstName}, ' ', ${users.lastName})) LIKE LOWER(${searchPattern})`
        )
      );
    }

    // Execute query
    const results = await db.select()
      .from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(options.limit || 20)
      .offset(options.offset || 0);

    return results.map(u => ({
      id: u.id,
      type: 'user' as const,
      title: `${u.firstName} ${u.lastName}`.trim() || u.email,
      content: u.email,
      timestamp: u.createdAt || new Date(),
      metadata: {
        isAdmin: u.isAdmin,
        phone: u.phone
      },
      score: this.calculateScore(`${u.firstName} ${u.lastName} ${u.email}`, query)
    }));
  }

  // Track search in history
  private async trackSearch(
    userId: string, 
    query: string,
    filters?: SearchFilters
  ): Promise<void> {
    try {
      await storage.createSearchHistory({
        userId,
        query,
        filters,
        scope: 'all'
      });
    } catch (error) {
      console.error('Failed to track search:', error);
    }
  }

  // Get message context around match
  private getMessageContext(content: string, query: string): string {
    const index = content.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return content.substring(0, 150);
    
    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + query.length + 50);
    
    let context = content.substring(start, end);
    if (start > 0) context = '...' + context;
    if (end < content.length) context = context + '...';
    
    return context;
  }

  // Get highlighted matches
  private getHighlights(content: string, query: string): string[] {
    const highlights: string[] = [];
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const words = lowerQuery.split(/\s+/);
    
    for (const word of words) {
      if (word.length < 2) continue;
      let index = lowerContent.indexOf(word);
      while (index !== -1) {
        highlights.push(content.substring(index, index + word.length));
        index = lowerContent.indexOf(word, index + 1);
      }
    }
    
    return highlights;
  }

  // Calculate relevance score
  private calculateScore(content: string, query: string): number {
    if (!content || !query) return 0;
    
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let score = 0;
    
    // Exact match
    if (lowerContent === lowerQuery) {
      score += 100;
    }
    
    // Contains full query
    if (lowerContent.includes(lowerQuery)) {
      score += 50;
    }
    
    // Word matches
    const words = lowerQuery.split(/\s+/);
    for (const word of words) {
      if (word.length < 2) continue;
      if (lowerContent.includes(word)) {
        score += 10;
      }
    }
    
    // Position bonus (earlier matches score higher)
    const index = lowerContent.indexOf(lowerQuery);
    if (index !== -1) {
      score += Math.max(0, 20 - (index / 10));
    }
    
    return score;
  }

  // Get search suggestions
  async getSearchSuggestions(userId: string, query: string): Promise<string[]> {
    if (!query || query.length < 2) return [];
    
    // Get suggestions from search history
    const historySuggestions = await storage.getSearchSuggestions(userId, query, 5);
    
    // Get channel name suggestions
    const channelPattern = `${query}%`;
    const channelResults = await db.selectDistinct({ name: channels.name })
      .from(channels)
      .where(sql`LOWER(${channels.name}) LIKE LOWER(${channelPattern})`)
      .limit(3);
    
    // Get user name suggestions  
    const userPattern = `%${query}%`;
    const userResults = await db.selectDistinct({ 
      name: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`
    })
      .from(users)
      .where(
        or(
          sql`LOWER(${users.firstName}) LIKE LOWER(${userPattern})`,
          sql`LOWER(${users.lastName}) LIKE LOWER(${userPattern})`
        )
      )
      .limit(3);
    
    // Combine and deduplicate suggestions
    const allSuggestions = [
      ...historySuggestions,
      ...channelResults.map(c => `in:#${c.name}`),
      ...userResults.map(u => `from:@${u.name}`)
    ];
    
    return [...new Set(allSuggestions)];
  }

  // Save a search
  async saveSearch(
    userId: string,
    name: string,
    query: string,
    filters?: SearchFilters
  ): Promise<SavedSearch> {
    return storage.createSavedSearch({
      userId,
      name,
      query,
      filters,
      scope: 'all'
    });
  }

  // Get saved searches
  async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    return storage.getSavedSearches(userId);
  }

  // Update saved search usage
  async useSavedSearch(searchId: string): Promise<void> {
    const search = await storage.getSavedSearch(searchId);
    if (search) {
      await storage.updateSavedSearch(searchId, {
        usageCount: (search.usageCount || 0) + 1,
        lastUsedAt: new Date()
      });
    }
  }
}

export const searchService = new SearchService();