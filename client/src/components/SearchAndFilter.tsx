import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import type { Candidate } from '@shared/schema';

export interface FilterOptions {
  searchQuery: string;
  pipelineStages: string[];
  scoreRange: [number, number];
  dateRange: { from: Date | null; to: Date | null };
  sources: string[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface SearchAndFilterProps {
  candidates: Candidate[];
  onFilterChange: (filteredCandidates: Candidate[], filters: FilterOptions) => void;
  className?: string;
}

const PIPELINE_STAGES = [
  { value: 'NEW', label: 'New Applications', color: 'bg-muted' },
  { value: 'FIRST_INTERVIEW', label: 'First Interview', color: 'bg-primary/20' },
  { value: 'TECHNICAL_SCREEN', label: 'Technical Screen', color: 'bg-accent/20' },
  { value: 'FINAL_INTERVIEW', label: 'Final Interview', color: 'bg-primary/30' },
  { value: 'OFFER', label: 'Offer Extended', color: 'bg-secondary/30' },
  { value: 'HIRED', label: 'Hired', color: 'bg-accent/30' },
  { value: 'REJECTED', label: 'Rejected', color: 'bg-destructive/20' },
];

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'score', label: 'Score' },
  { value: 'createdAt', label: 'Date Added' },
  { value: 'pipelineStage', label: 'Pipeline Stage' },
];

export default function SearchAndFilter({ candidates, onFilterChange, className }: SearchAndFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    searchQuery: '',
    pipelineStages: [],
    scoreRange: [0, 100],
    dateRange: { from: null, to: null },
    sources: [],
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // Get unique sources from candidates
  const availableSources = useMemo(() => {
    const sources = new Set(candidates.map(c => c.campaignId ? 'Indeed' : 'Manual'));
    return Array.from(sources);
  }, [candidates]);

  // Apply filters and sorting
  const filteredCandidates = useMemo(() => {
    let filtered = [...candidates];

    // Text search across multiple fields
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(candidate => 
        candidate.name?.toLowerCase().includes(query) ||
        candidate.email?.toLowerCase().includes(query) ||
        candidate.phone?.toLowerCase().includes(query) ||
        candidate.tags?.some((tag: string) => tag.toLowerCase().includes(query))
      );
    }

    // Pipeline stage filter
    if (filters.pipelineStages.length > 0) {
      filtered = filtered.filter(candidate => 
        filters.pipelineStages.includes(candidate.pipelineStage)
      );
    }

    // Score range filter
    filtered = filtered.filter(candidate => {
      const score = candidate.score || 0;
      return score >= filters.scoreRange[0] && score <= filters.scoreRange[1];
    });

    // Date range filter
    if (filters.dateRange.from || filters.dateRange.to) {
      filtered = filtered.filter(candidate => {
        const candidateDate = new Date(candidate.createdAt);
        if (filters.dateRange.from && candidateDate < filters.dateRange.from) return false;
        if (filters.dateRange.to && candidateDate > filters.dateRange.to) return false;
        return true;
      });
    }

    // Source filter
    if (filters.sources.length > 0) {
      filtered = filtered.filter(candidate => {
        const source = candidate.campaignId ? 'Indeed' : 'Manual';
        return filters.sources.includes(source);
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      let aValue: any = a[filters.sortBy as keyof Candidate];
      let bValue: any = b[filters.sortBy as keyof Candidate];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      // Convert to strings for comparison if needed
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      if (aValue > bValue) comparison = 1;

      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [candidates, filters]);

  // Notify parent component when filters change
  useEffect(() => {
    onFilterChange(filteredCandidates, filters);
  }, [filteredCandidates, filters, onFilterChange]);

  const updateFilter = (key: keyof FilterOptions, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearAllFilters = () => {
    setFilters({
      searchQuery: '',
      pipelineStages: [],
      scoreRange: [0, 100],
      dateRange: { from: null, to: null },
      sources: [],
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  };

  const togglePipelineStage = (stage: string) => {
    const newStages = filters.pipelineStages.includes(stage)
      ? filters.pipelineStages.filter(s => s !== stage)
      : [...filters.pipelineStages, stage];
    updateFilter('pipelineStages', newStages);
  };

  const toggleSource = (source: string) => {
    const newSources = filters.sources.includes(source)
      ? filters.sources.filter(s => s !== source)
      : [...filters.sources, source];
    updateFilter('sources', newSources);
  };

  const activeFiltersCount = 
    (filters.searchQuery ? 1 : 0) +
    filters.pipelineStages.length +
    (filters.scoreRange[0] > 0 || filters.scoreRange[1] < 100 ? 1 : 0) +
    (filters.dateRange.from || filters.dateRange.to ? 1 : 0) +
    filters.sources.length;

  return (
    <Card className={`glass-panel p-4 mb-6 ${className}`}>
      <div className="space-y-4">
        {/* Search Bar and Quick Actions */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm"></i>
            <Input
              placeholder="Search candidates by name, email, phone, or skills..."
              value={filters.searchQuery}
              onChange={(e) => updateFilter('searchQuery', e.target.value)}
              className="glass-input pl-10"
              data-testid="search-input"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Select
              value={filters.sortBy}
              onValueChange={(value) => updateFilter('sortBy', value)}
            >
              <SelectTrigger className="w-40 glass-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
              className="glass-input"
              data-testid="sort-order-btn"
            >
              <i className={`fas fa-sort-${filters.sortOrder === 'asc' ? 'up' : 'down'}`}></i>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="glass-input"
              data-testid="advanced-filters-btn"
            >
              <i className="fas fa-filter mr-2"></i>
              Filters
              {activeFiltersCount > 0 && (
                <Badge className="ml-2 px-1 py-0 text-xs">{activeFiltersCount}</Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Advanced Filters */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-border pt-4 space-y-4">
                {/* Pipeline Stages */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Pipeline Stages</Label>
                  <div className="flex flex-wrap gap-2">
                    {PIPELINE_STAGES.map((stage) => (
                      <Button
                        key={stage.value}
                        variant={filters.pipelineStages.includes(stage.value) ? "default" : "outline"}
                        size="sm"
                        onClick={() => togglePipelineStage(stage.value)}
                        className={`micro-animation ${
                          filters.pipelineStages.includes(stage.value) 
                            ? 'bg-primary text-primary-foreground' 
                            : 'glass-input border-border'
                        }`}
                        data-testid={`filter-stage-${stage.value}`}
                      >
                        <div className={`w-2 h-2 rounded-full mr-2 ${stage.color}`}></div>
                        {stage.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Score Range */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Score Range: {filters.scoreRange[0]}% - {filters.scoreRange[1]}%
                  </Label>
                  <Slider
                    value={filters.scoreRange}
                    onValueChange={(value) => updateFilter('scoreRange', value as [number, number])}
                    max={100}
                    min={0}
                    step={5}
                    className="w-full"
                    data-testid="score-range-slider"
                  />
                </div>

                {/* Date Range and Sources */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Date Range */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Date Range</Label>
                    <div className="flex space-x-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="glass-input flex-1 justify-start text-left">
                            <i className="fas fa-calendar-alt mr-2"></i>
                            {filters.dateRange.from 
                              ? format(filters.dateRange.from, 'MMM dd, yyyy')
                              : 'From date'
                            }
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 glass-panel border-border">
                          <Calendar
                            mode="single"
                            selected={filters.dateRange.from || undefined}
                            onSelect={(date) => updateFilter('dateRange', { 
                              ...filters.dateRange, 
                              from: date || null 
                            })}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="glass-input flex-1 justify-start text-left">
                            <i className="fas fa-calendar-alt mr-2"></i>
                            {filters.dateRange.to 
                              ? format(filters.dateRange.to, 'MMM dd, yyyy')
                              : 'To date'
                            }
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 glass-panel border-border">
                          <Calendar
                            mode="single"
                            selected={filters.dateRange.to || undefined}
                            onSelect={(date) => updateFilter('dateRange', { 
                              ...filters.dateRange, 
                              to: date || null 
                            })}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Sources */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Sources</Label>
                    <div className="space-y-2">
                      {availableSources.map((source) => (
                        <div key={source} className="flex items-center space-x-2">
                          <Checkbox
                            id={`source-${source}`}
                            checked={filters.sources.includes(source)}
                            onCheckedChange={() => toggleSource(source)}
                            data-testid={`filter-source-${source}`}
                          />
                          <Label htmlFor={`source-${source}`} className="text-sm">
                            {source}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Clear Filters */}
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    Showing {filteredCandidates.length} of {candidates.length} candidates
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    disabled={activeFiltersCount === 0}
                    className="glass-input"
                    data-testid="clear-filters-btn"
                  >
                    <i className="fas fa-times mr-2"></i>
                    Clear All Filters
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}