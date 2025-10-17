import { SearchService } from '../../services/search.service';
import { storage } from '../../storage';
import { mockMessages, mockChannels, mockUsers, mockCandidates } from '../utils/mockData';

// Mock storage
jest.mock('../../storage');

describe('SearchService', () => {
  let searchService: SearchService;
  let mockStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();
    searchService = SearchService.getInstance();
    mockStorage = storage as jest.Mocked<typeof storage>;
    
    // Setup default mocks
    mockStorage.searchMessages = jest.fn().mockResolvedValue([]);
    mockStorage.searchFiles = jest.fn().mockResolvedValue([]);
    mockStorage.searchChannels = jest.fn().mockResolvedValue([]);
    mockStorage.searchUsers = jest.fn().mockResolvedValue([]);
    mockStorage.saveSearchHistory = jest.fn();
    mockStorage.getSavedSearches = jest.fn().mockResolvedValue([]);
  });

  describe('Message Search', () => {
    it('should search messages with keyword', async () => {
      const mockSearchResults = [
        {
          ...mockMessages.message1,
          highlights: ['<mark>Hello</mark> everyone!']
        }
      ];
      
      mockStorage.searchMessages = jest.fn().mockResolvedValue(mockSearchResults);

      const results = await searchService.search({
        query: 'hello',
        scope: 'messages',
        userId: 'user-1'
      });

      expect(mockStorage.searchMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'hello'
        })
      );
      expect(results.messages).toHaveLength(1);
      expect(results.messages[0].highlights).toBeDefined();
    });

    it('should filter messages by channel', async () => {
      await searchService.search({
        query: 'test',
        scope: 'messages',
        filters: {
          channelId: 'channel-1'
        },
        userId: 'user-1'
      });

      expect(mockStorage.searchMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'channel-1'
        })
      );
    });

    it('should filter messages by date range', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-01-31');

      await searchService.search({
        query: 'test',
        scope: 'messages',
        filters: {
          dateFrom,
          dateTo
        },
        userId: 'user-1'
      });

      expect(mockStorage.searchMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFrom,
          dateTo
        })
      );
    });

    it('should filter messages by sender', async () => {
      await searchService.search({
        query: 'test',
        scope: 'messages',
        filters: {
          from: 'user-2'
        },
        userId: 'user-1'
      });

      expect(mockStorage.searchMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-2'
        })
      );
    });
  });

  describe('File Search', () => {
    it('should search files by name', async () => {
      const mockFileResults = [
        {
          id: 'file-1',
          filename: 'resume.pdf',
          filepath: '/uploads/resume.pdf',
          fileType: 'resume',
          uploadedBy: 'user-1',
          createdAt: new Date()
        }
      ];
      
      mockStorage.searchFiles = jest.fn().mockResolvedValue(mockFileResults);

      const results = await searchService.search({
        query: 'resume',
        scope: 'files',
        userId: 'user-1'
      });

      expect(mockStorage.searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'resume'
        })
      );
      expect(results.files).toHaveLength(1);
    });

    it('should filter files by type', async () => {
      await searchService.search({
        query: 'document',
        scope: 'files',
        filters: {
          fileType: 'resume'
        },
        userId: 'user-1'
      });

      expect(mockStorage.searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          fileType: 'resume'
        })
      );
    });
  });

  describe('Channel Search', () => {
    it('should search channels by name and description', async () => {
      const mockChannelResults = [mockChannels.general];
      mockStorage.searchChannels = jest.fn().mockResolvedValue(mockChannelResults);

      const results = await searchService.search({
        query: 'general',
        scope: 'channels',
        userId: 'user-1'
      });

      expect(mockStorage.searchChannels).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'general'
        })
      );
      expect(results.channels).toHaveLength(1);
    });

    it('should filter channels by tier', async () => {
      await searchService.search({
        query: 'agents',
        scope: 'channels',
        filters: {
          tier: 'FL_LICENSED'
        },
        userId: 'user-1'
      });

      expect(mockStorage.searchChannels).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'FL_LICENSED'
        })
      );
    });
  });

  describe('User Search', () => {
    it('should search users by name and email', async () => {
      const mockUserResults = [mockUsers.regular];
      mockStorage.searchUsers = jest.fn().mockResolvedValue(mockUserResults);

      const results = await searchService.search({
        query: 'john',
        scope: 'users',
        userId: 'user-1'
      });

      expect(mockStorage.searchUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'john'
        })
      );
      expect(results.users).toHaveLength(1);
    });

    it('should filter users by admin status', async () => {
      await searchService.search({
        query: 'admin',
        scope: 'users',
        filters: {
          isAdmin: true
        },
        userId: 'user-1'
      });

      expect(mockStorage.searchUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          isAdmin: true
        })
      );
    });
  });

  describe('Combined Search', () => {
    it('should search across all scopes', async () => {
      mockStorage.searchMessages = jest.fn().mockResolvedValue([mockMessages.message1]);
      mockStorage.searchFiles = jest.fn().mockResolvedValue([]);
      mockStorage.searchChannels = jest.fn().mockResolvedValue([mockChannels.general]);
      mockStorage.searchUsers = jest.fn().mockResolvedValue([mockUsers.regular]);

      const results = await searchService.search({
        query: 'test',
        scope: 'all',
        userId: 'user-1'
      });

      expect(mockStorage.searchMessages).toHaveBeenCalled();
      expect(mockStorage.searchFiles).toHaveBeenCalled();
      expect(mockStorage.searchChannels).toHaveBeenCalled();
      expect(mockStorage.searchUsers).toHaveBeenCalled();
      
      expect(results.messages).toHaveLength(1);
      expect(results.channels).toHaveLength(1);
      expect(results.users).toHaveLength(1);
      expect(results.totalCount).toBe(3);
    });

    it('should apply pagination', async () => {
      const allMessages = Array(25).fill(null).map((_, i) => ({
        ...mockMessages.message1,
        id: `msg-${i}`
      }));
      
      mockStorage.searchMessages = jest.fn().mockResolvedValue(allMessages);

      const results = await searchService.search({
        query: 'test',
        scope: 'messages',
        limit: 10,
        offset: 10,
        userId: 'user-1'
      });

      expect(results.messages).toHaveLength(10);
    });

    it('should sort results by relevance', async () => {
      const messages = [
        { ...mockMessages.message1, relevance: 0.5 },
        { ...mockMessages.message2, relevance: 0.9 }
      ];
      
      mockStorage.searchMessages = jest.fn().mockResolvedValue(messages);

      const results = await searchService.search({
        query: 'test',
        scope: 'messages',
        sortBy: 'relevance',
        userId: 'user-1'
      });

      expect(results.messages[0].relevance).toBeGreaterThan(results.messages[1].relevance);
    });
  });

  describe('Search History', () => {
    it('should save search history', async () => {
      await searchService.search({
        query: 'test query',
        scope: 'all',
        userId: 'user-1'
      });

      expect(mockStorage.saveSearchHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          query: 'test query',
          scope: 'all'
        })
      );
    });

    it('should get search history', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          userId: 'user-1',
          query: 'previous search',
          scope: 'messages',
          createdAt: new Date()
        }
      ];
      
      mockStorage.getSearchHistory = jest.fn().mockResolvedValue(mockHistory);

      const history = await searchService.getSearchHistory('user-1');

      expect(history).toHaveLength(1);
      expect(history[0].query).toBe('previous search');
    });

    it('should clear search history', async () => {
      mockStorage.clearSearchHistory = jest.fn();

      await searchService.clearSearchHistory('user-1');

      expect(mockStorage.clearSearchHistory).toHaveBeenCalledWith('user-1');
    });
  });

  describe('Saved Searches', () => {
    it('should save a search', async () => {
      mockStorage.saveSearch = jest.fn().mockResolvedValue({
        id: 'saved-1',
        name: 'My Search'
      });

      const saved = await searchService.saveSearch({
        userId: 'user-1',
        name: 'My Search',
        query: 'important',
        scope: 'messages',
        filters: { channelId: 'channel-1' }
      });

      expect(mockStorage.saveSearch).toHaveBeenCalled();
      expect(saved.name).toBe('My Search');
    });

    it('should get saved searches', async () => {
      const mockSaved = [
        {
          id: 'saved-1',
          userId: 'user-1',
          name: 'Important Messages',
          query: 'important',
          scope: 'messages'
        }
      ];
      
      mockStorage.getSavedSearches = jest.fn().mockResolvedValue(mockSaved);

      const saved = await searchService.getSavedSearches('user-1');

      expect(saved).toHaveLength(1);
      expect(saved[0].name).toBe('Important Messages');
    });

    it('should delete saved search', async () => {
      mockStorage.deleteSavedSearch = jest.fn();

      await searchService.deleteSavedSearch('saved-1', 'user-1');

      expect(mockStorage.deleteSavedSearch).toHaveBeenCalledWith('saved-1', 'user-1');
    });
  });

  describe('Advanced Search Features', () => {
    it('should handle quoted phrases', async () => {
      await searchService.search({
        query: '"exact phrase"',
        scope: 'messages',
        userId: 'user-1'
      });

      expect(mockStorage.searchMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          query: '"exact phrase"',
          exactMatch: true
        })
      );
    });

    it('should handle boolean operators', async () => {
      await searchService.search({
        query: 'sales AND (florida OR california)',
        scope: 'messages',
        userId: 'user-1'
      });

      expect(mockStorage.searchMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'sales AND (florida OR california)'
        })
      );
    });

    it('should handle wildcard search', async () => {
      await searchService.search({
        query: 'develop*',
        scope: 'all',
        userId: 'user-1'
      });

      expect(mockStorage.searchMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'develop*',
          wildcard: true
        })
      );
    });

    it('should handle exclusion operators', async () => {
      await searchService.search({
        query: 'sales -rejected',
        scope: 'messages',
        userId: 'user-1'
      });

      expect(mockStorage.searchMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'sales',
          exclude: ['rejected']
        })
      );
    });
  });

  describe('Search Suggestions', () => {
    it('should provide search suggestions', async () => {
      mockStorage.getSearchSuggestions = jest.fn().mockResolvedValue([
        'sales pipeline',
        'sales report',
        'sales team'
      ]);

      const suggestions = await searchService.getSuggestions('sales', 'user-1');

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toContain('sales');
    });

    it('should cache frequent searches', async () => {
      // Simulate multiple searches for the same query
      for (let i = 0; i < 3; i++) {
        await searchService.search({
          query: 'frequently searched',
          scope: 'all',
          userId: 'user-1'
        });
      }

      // The storage should track frequency
      expect(mockStorage.saveSearchHistory).toHaveBeenCalledTimes(3);
    });
  });
});