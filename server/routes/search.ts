import { Router } from "express";
import { searchService } from "../services/search.service";
import { storage } from "../storage";
import { isAuthenticated } from "../replitAuth";

const router = Router();

// Main search endpoint
router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user's accessible channels
    const userChannels = await storage.getUserChannelMemberships(userId);
    const userChannelIds = userChannels.map(m => m.channelId);

    const {
      q: query = "",
      scope = "all",
      limit = "20",
      offset = "0",
      sortBy = "relevance",
      sortOrder = "desc",
      channels,
      users,
      fileTypes,
      hasAttachments,
      messageTypes,
      dateFrom,
      dateTo
    } = req.query;

    // Build filters from query params
    const filters: any = {};
    
    if (channels) {
      filters.channels = Array.isArray(channels) ? channels : [channels];
    }
    
    if (users) {
      filters.users = Array.isArray(users) ? users : [users];
    }
    
    if (fileTypes) {
      filters.fileTypes = Array.isArray(fileTypes) ? fileTypes : [fileTypes];
    }
    
    if (hasAttachments !== undefined) {
      filters.hasAttachments = hasAttachments === 'true';
    }
    
    if (messageTypes) {
      filters.messageTypes = Array.isArray(messageTypes) ? messageTypes : [messageTypes];
    }
    
    if (dateFrom || dateTo) {
      filters.dateRange = {};
      if (dateFrom) filters.dateRange.start = new Date(dateFrom as string);
      if (dateTo) filters.dateRange.end = new Date(dateTo as string);
    }

    const results = await searchService.search({
      query: query as string,
      filters,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      scope: scope as any,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
      userId,
      userChannelIds
    });

    res.json(results);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

// Get search suggestions
router.get("/suggestions", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { q: query = "" } = req.query;

    const suggestions = await searchService.getSearchSuggestions(
      userId,
      query as string
    );

    res.json({ suggestions });
  } catch (error) {
    console.error("Suggestions error:", error);
    res.status(500).json({ error: "Failed to get suggestions" });
  }
});

// Get saved searches
router.get("/saved", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const savedSearches = await storage.getSavedSearches(userId);
    res.json(savedSearches);
  } catch (error) {
    console.error("Get saved searches error:", error);
    res.status(500).json({ error: "Failed to get saved searches" });
  }
});

// Save a search
router.post("/saved", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { name, query, filters, scope } = req.body;

    if (!name || !query) {
      return res.status(400).json({ error: "Name and query are required" });
    }

    const savedSearch = await storage.createSavedSearch({
      userId,
      name,
      query,
      filters,
      scope: scope || 'all'
    });

    res.json(savedSearch);
  } catch (error) {
    console.error("Save search error:", error);
    res.status(500).json({ error: "Failed to save search" });
  }
});

// Update saved search
router.patch("/saved/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { id } = req.params;
    const updates = req.body;

    // Verify ownership
    const savedSearch = await storage.getSavedSearch(id);
    if (!savedSearch) {
      return res.status(404).json({ error: "Saved search not found" });
    }

    if (savedSearch.userId !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const updated = await storage.updateSavedSearch(id, updates);
    res.json(updated);
  } catch (error) {
    console.error("Update saved search error:", error);
    res.status(500).json({ error: "Failed to update saved search" });
  }
});

// Delete saved search
router.delete("/saved/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { id } = req.params;

    // Verify ownership
    const savedSearch = await storage.getSavedSearch(id);
    if (!savedSearch) {
      return res.status(404).json({ error: "Saved search not found" });
    }

    if (savedSearch.userId !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await storage.deleteSavedSearch(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete saved search error:", error);
    res.status(500).json({ error: "Failed to delete saved search" });
  }
});

// Get search history
router.get("/history", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { limit = "20" } = req.query;

    const history = await storage.getSearchHistory(
      userId,
      parseInt(limit as string)
    );

    res.json(history);
  } catch (error) {
    console.error("Get search history error:", error);
    res.status(500).json({ error: "Failed to get search history" });
  }
});

// Clear search history
router.delete("/history", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    await storage.clearSearchHistory(userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Clear search history error:", error);
    res.status(500).json({ error: "Failed to clear search history" });
  }
});

// Use a saved search (increment usage count)
router.post("/saved/:id/use", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { id } = req.params;

    // Verify ownership
    const savedSearch = await storage.getSavedSearch(id);
    if (!savedSearch) {
      return res.status(404).json({ error: "Saved search not found" });
    }

    if (savedSearch.userId !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await searchService.useSavedSearch(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Use saved search error:", error);
    res.status(500).json({ error: "Failed to use saved search" });
  }
});

export default router;