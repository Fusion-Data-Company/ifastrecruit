import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type ColumnDef,
  flexRender,
  type RowData,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion } from "framer-motion";
import {
  ChevronRight,
  ChevronDown,
  Expand,
  Minimize2,
  Mail,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  User,
  Copy,
  StickyNote,
  ClipboardList,
  FileText,
  Settings,
  BarChart3,
  Database,
  Filter,
  Download,
  ArrowUpDown,
  Eye,
  Edit,
  Calendar,
  FileUp
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import SearchAndFilter, { type FilterOptions } from "@/components/SearchAndFilter";
import BulkOperations from "@/components/BulkOperations";
import DataExportImport from "@/components/DataExportImport";
import { ObjectUploader } from "@/components/ObjectUploader";
import { FileViewer } from "@/components/FileViewer";
import type { Candidate } from "@shared/schema";
import type { UploadResult } from "@uppy/core";

// Extend table meta interface for inline editing
declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
  }
}

// Editable cell component for text fields
function EditableCell({ getValue, row, column, table }: any) {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const prevInitialValueRef = useRef(initialValue);

  // Reset value when data changes - prevent infinite loops by checking if value actually changed
  useEffect(() => {
    if (prevInitialValueRef.current !== initialValue) {
      setValue(initialValue);
      prevInitialValueRef.current = initialValue;
    }
  }, [initialValue]);

  const onBlur = () => {
    setIsEditing(false);
    if (value !== initialValue) {
      table.options.meta?.updateData(row.index, column.id, value);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onBlur();
    } else if (e.key === 'Escape') {
      setValue(initialValue);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <Input
        value={value as string}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className="h-14 text-base bg-transparent border-accent"
        autoFocus
      />
    );
  }

  return (
    <div
      className="cursor-pointer hover:bg-accent/10 px-4 py-5 rounded min-h-20 flex items-center"
      onClick={() => setIsEditing(true)}
      data-testid={`editable-${column.id}-${row.original.id}`}
    >
      <span className="text-base leading-relaxed">{value as string || "—"}</span>
    </div>
  );
}

// Utility function to format call duration from seconds
function formatCallDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '-';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remainingSeconds > 0) parts.push(`${remainingSeconds}s`);
  
  return parts.length > 0 ? parts.join(' ') : '-';
}

// Expanded Row Content Component
function ExpandedRowContent({ candidate }: { candidate: Candidate }) {
  return (
    <div className="bg-muted/20 border-l-4 border-primary/30 p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Interview Notes */}
          {candidate.notes && candidate.notes !== '-' && (
            <div className="bg-background rounded-lg p-4 border">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-semibold text-primary flex items-center">
                  <StickyNote className="h-4 w-4 mr-2" />
                  Interview Notes
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => navigator.clipboard.writeText(candidate.notes || '')}
                  data-testid={`copy-notes-${candidate.id}`}
                >
                  <Copy className="h-3 w-3 mr-1" />Copy
                </Button>
              </div>
              <div className="text-base whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                {candidate.notes}
              </div>
            </div>
          )}

          {/* Interview Summary */}
          {candidate.interviewSummary && candidate.interviewSummary !== '-' && (
            <div className="bg-background rounded-lg p-4 border">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-semibold text-primary flex items-center">
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Interview Summary
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => navigator.clipboard.writeText(candidate.interviewSummary || '')}
                  data-testid={`copy-summary-${candidate.id}`}
                >
                  <Copy className="h-3 w-3 mr-1" />Copy
                </Button>
              </div>
              <div className="text-base whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                {candidate.interviewSummary}
              </div>
            </div>
          )}

          {/* Call Summary Title */}
          {candidate.callSummaryTitle && candidate.callSummaryTitle !== '-' && (
            <div className="bg-background rounded-lg p-4 border">
              <h4 className="text-base font-semibold text-primary mb-2 flex items-center">
                <Phone className="h-4 w-4 mr-2" />
                Call Summary Title
              </h4>
              <div className="text-base whitespace-pre-wrap leading-relaxed">
                {candidate.callSummaryTitle}
              </div>
            </div>
          )}

          {/* Transcript Summary */}
          {candidate.transcriptSummary && candidate.transcriptSummary !== '-' && (
            <div className="bg-background rounded-lg p-4 border">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-semibold text-primary flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Transcript Summary
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => navigator.clipboard.writeText(candidate.transcriptSummary || '')}
                  data-testid={`copy-transcript-summary-${candidate.id}`}
                >
                  <Copy className="h-3 w-3 mr-1" />Copy
                </Button>
              </div>
              <div className="text-base whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                {candidate.transcriptSummary}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Technical Details */}
          <div className="bg-background rounded-lg p-4 border">
            <h4 className="text-base font-semibold text-primary mb-3 flex items-center">
              <Settings className="h-4 w-4 mr-2" />
              Technical Details
            </h4>
            <div className="grid grid-cols-2 gap-3 text-base">
              <div>
                <span className="font-medium text-muted-foreground">Agent:</span>
                <div className="mt-1">{candidate.agentName || '-'}</div>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Agent ID:</span>
                <div className="mt-1 font-mono text-sm">{candidate.agentId || '-'}</div>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Conversation ID:</span>
                <div className="mt-1 font-mono text-sm">{candidate.conversationId || '-'}</div>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Call Status:</span>
                <div className="mt-1">{candidate.callStatus || '-'}</div>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Call Duration:</span>
                <div className="mt-1">{formatCallDuration(candidate.callDuration)}</div>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Messages:</span>
                <div className="mt-1">{candidate.messageCount || 0}</div>
              </div>
            </div>
          </div>

          {/* Evaluation Criteria */}
          {candidate.evaluationCriteria != null && (
            <div className="bg-background rounded-lg p-4 border">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-semibold text-primary flex items-center">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Evaluation Criteria
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(candidate.evaluationCriteria, null, 2))}
                  data-testid={`copy-evaluation-${candidate.id}`}
                >
                  <Copy className="h-3 w-3 mr-1" />Copy JSON
                </Button>
              </div>
              <div className="bg-muted/50 rounded p-3 max-h-32 overflow-y-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {JSON.stringify(candidate.evaluationCriteria, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Data Collection Results */}
          {candidate.dataCollectionResults != null && (
            <div className="bg-background rounded-lg p-4 border">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-semibold text-primary flex items-center">
                  <Database className="h-4 w-4 mr-2" />
                  Data Collection
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(candidate.dataCollectionResults, null, 2))}
                  data-testid={`copy-data-collection-${candidate.id}`}
                >
                  <Copy className="h-3 w-3 mr-1" />Copy JSON
                </Button>
              </div>
              <div className="bg-muted/50 rounded p-3 max-h-32 overflow-y-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {JSON.stringify(candidate.dataCollectionResults, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full Interview Transcript - Full Width */}
      {candidate.interviewTranscript && candidate.interviewTranscript !== '-' && (
        <div className="bg-background rounded-lg p-4 border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-base font-semibold text-primary flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Full Interview Transcript
            </h4>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => navigator.clipboard.writeText(candidate.interviewTranscript || '')}
              data-testid={`copy-transcript-${candidate.id}`}
            >
              <Copy className="h-3 w-3 mr-1" />Copy
            </Button>
          </div>
          <div className="bg-muted/50 rounded p-4 max-h-64 overflow-y-auto">
            <pre className="text-base font-mono whitespace-pre-wrap leading-relaxed">
              {candidate.interviewTranscript}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// Editable score cell with number input
function EditableScoreCell({ getValue, row, column, table }: any) {
  const initialValue = getValue() || 0;
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const prevInitialValueRef = useRef(initialValue);

  useEffect(() => {
    if (prevInitialValueRef.current !== initialValue) {
      setValue(initialValue);
      prevInitialValueRef.current = initialValue;
    }
  }, [initialValue]);

  const onBlur = () => {
    setIsEditing(false);
    const numValue = Math.max(0, Math.min(100, Number(value) || 0));
    setValue(numValue);
    if (numValue !== initialValue) {
      table.options.meta?.updateData(row.index, column.id, numValue);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onBlur();
    } else if (e.key === 'Escape') {
      setValue(initialValue);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <Input
        type="number"
        min="0"
        max="100"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className="h-14 w-24 text-base bg-transparent border-accent"
        autoFocus
      />
    );
  }

  const score = value as number;
  return (
    <div
      className="cursor-pointer hover:bg-accent/10 px-4 py-5 rounded min-h-20 flex items-center space-x-3"
      onClick={() => setIsEditing(true)}
    >
      <div className="w-20 h-4 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-accent rounded-full transition-all duration-300"
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-base w-16">{score}%</span>
    </div>
  );
}

export default function DataGrid() {
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [currentFilters, setCurrentFilters] = useState<FilterOptions | null>(null);
  const [selectedCandidateForFiles, setSelectedCandidateForFiles] = useState<Candidate | null>(null);
  const [data, setData] = useState<Candidate[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [viewingCandidate, setViewingCandidate] = useState<Candidate | null>(null);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [detailsCandidate, setDetailsCandidate] = useState<Candidate | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: allCandidates = [], isLoading } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates"],
  });

  // Sync data state with query data
  useEffect(() => {
    setData(allCandidates);
  }, [allCandidates]);

  const handleFilterChange = useCallback((filtered: Candidate[], filters: FilterOptions) => {
    setFilteredCandidates(filtered);
    setCurrentFilters(filters);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRows([]);
  }, []);

  const updateCandidateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Candidate> }) => {
      const response = await apiRequest("PATCH", `/api/candidates/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({
        title: "Updated",
        description: "Candidate updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update candidate",
        variant: "destructive",
      });
    },
  });

  // Handle inline editing updates
  const updateData = useCallback((rowIndex: number, columnId: string, value: unknown) => {
    const candidate = (currentFilters ? filteredCandidates : data)[rowIndex];
    if (!candidate) return;

    // Optimistic update
    setData(old =>
      old.map(row => 
        row.id === candidate.id 
          ? { ...row, [columnId]: value }
          : row
      )
    );

    // Update in database
    updateCandidateMutation.mutate({
      id: candidate.id,
      updates: { [columnId]: value } as Partial<Candidate>,
    });
  }, [currentFilters, filteredCandidates, updateCandidateMutation]);

  const uploadResumeForCandidateMutation = useMutation({
    mutationFn: async ({ candidateId, resumeURL }: { candidateId: string; resumeURL: string }) => {
      const response = await apiRequest("PUT", `/api/candidates/${candidateId}/resume`, { resumeURL });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({
        title: "Resume uploaded",
        description: "The resume has been successfully uploaded and attached to the candidate.",
      });
    },
    onError: (error) => {
      toast({
        title: "Upload failed", 
        description: "Failed to attach resume to candidate. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGetUploadParameters = async () => {
    const response = await apiRequest("POST", "/api/objects/upload", {});
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleResumeUploadComplete = (candidateId: string) => (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result?.successful?.length && result.successful.length > 0) {
      const uploadURL = result.successful[0]?.uploadURL;
      if (uploadURL) {
        uploadResumeForCandidateMutation.mutate({ candidateId, resumeURL: uploadURL });
      }
    }
  };

  // Toggle row expansion
  const toggleRowExpansion = useCallback((candidateId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(candidateId)) {
        newSet.delete(candidateId);
      } else {
        newSet.add(candidateId);
      }
      return newSet;
    });
  }, []);

  // Expand all rows
  const expandAllRows = useCallback(() => {
    const candidateIds = (currentFilters ? filteredCandidates : data).map(c => c.id);
    setExpandedRows(new Set(candidateIds));
  }, [currentFilters, filteredCandidates, data]);

  // Collapse all rows
  const collapseAllRows = useCallback(() => {
    setExpandedRows(new Set());
  }, []);

  const columns = useMemo<ColumnDef<Candidate>[]>(
    () => [
      {
        id: "expand",
        header: ({ table }) => {
          const allExpanded = expandedRows.size === (currentFilters ? filteredCandidates : data).length;
          const someExpanded = expandedRows.size > 0;
          
          return (
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0 hover:bg-accent/20"
                onClick={() => allExpanded ? collapseAllRows() : expandAllRows()}
                data-testid="expand-all-toggle"
                title={allExpanded ? "Collapse all rows" : "Expand all rows"}
              >
                {allExpanded ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
              </Button>
              {someExpanded && (
                <span className="text-xs text-muted-foreground">
                  {expandedRows.size}
                </span>
              )}
            </div>
          );
        },
        cell: ({ row }) => {
          const isExpanded = expandedRows.has(row.original.id);
          return (
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 p-0 hover:bg-accent/20"
              onClick={() => toggleRowExpansion(row.original.id)}
              data-testid={`expand-toggle-${row.original.id}`}
              title={isExpanded ? "Collapse row" : "Expand row"}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4 transition-transform duration-200" /> : <ChevronRight className="h-4 w-4 transition-transform duration-200" />}
            </Button>
          );
        },
        size: 80,
        enableSorting: false,
      },
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => {
              table.toggleAllPageRowsSelected(!!value);
              if (value) {
                setSelectedRows(table.getRowModel().rows.map(row => row.original.id));
              } else {
                setSelectedRows([]);
              }
            }}
            data-testid="select-all-candidates"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedRows.includes(row.original.id)}
            onCheckedChange={(value) => {
              if (value) {
                setSelectedRows(prev => [...prev, row.original.id]);
              } else {
                setSelectedRows(prev => prev.filter(id => id !== row.original.id));
              }
            }}
            data-testid={`select-candidate-${row.original.id}`}
          />
        ),
        size: 80,
        enableSorting: false,
      },
      // === BASIC INFO COLUMNS ===
      {
        accessorKey: "name",
        header: "Name",
        cell: (props) => <EditableCell {...props} />,
        size: 250,
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ getValue, row, column, table }) => {
          const email = getValue() as string;
          
          return (
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <EditableCell getValue={getValue} row={row} column={column} table={table} />
              </div>
              {email && (
                <a 
                  href={`mailto:${email}`}
                  className="text-blue-500 hover:text-blue-600 flex-shrink-0"
                  data-testid={`email-${row.original.id}`}
                  title="Send email"
                >
                  <Mail className="h-4 w-4" />
                </a>
              )}
            </div>
          );
        },
        size: 250,
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ getValue, row, column, table }) => {
          const phone = getValue() as string;
          return (
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <EditableCell getValue={getValue} row={row} column={column} table={table} />
              </div>
              {phone && (
                <a 
                  href={`tel:${phone}`}
                  className="text-blue-500 hover:text-blue-600 flex-shrink-0"
                  data-testid={`phone-${row.original.id}`}
                  title="Call phone"
                >
                  <Phone className="h-4 w-4" />
                </a>
              )}
            </div>
          );
        },
        size: 200,
      },
      {
        accessorKey: "pipelineStage",
        header: "Pipeline Stage",
        cell: ({ row, table }) => (
          <Select
            value={row.original.pipelineStage}
            onValueChange={(value) => {
              table.options.meta?.updateData(row.index, 'pipelineStage', value);
            }}
          >
            <SelectTrigger className="glass-input text-base bg-transparent border-border h-14 w-full" data-testid={`stage-select-${row.original.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NEW">New</SelectItem>
              <SelectItem value="FIRST_INTERVIEW">First Interview</SelectItem>
              <SelectItem value="TECHNICAL_SCREEN">Technical Screen</SelectItem>
              <SelectItem value="FINAL_INTERVIEW">Final Interview</SelectItem>
              <SelectItem value="OFFER">Offer</SelectItem>
              <SelectItem value="HIRED">Hired</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        ),
        size: 200,
      },
      {
        accessorKey: "score",
        header: "Overall Score",
        cell: EditableScoreCell,
        size: 200,
      },
      {
        accessorKey: "sourceRef",
        header: "Source Reference",
        cell: ({ getValue, row, column, table }) => (
          <EditableCell getValue={getValue} row={row} column={column} table={table} />
        ),
        size: 200,
      },
      {
        accessorKey: "resumeUrl",
        header: "Resume URL",
        cell: ({ getValue, row }) => {
          const url = getValue() as string;
          return (
            <div className="flex items-center space-x-2">
              {url ? (
                <a 
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 text-base truncate"
                  data-testid={`resume-url-${row.original.id}`}
                  title="Open resume"
                >
                  <FileUp className="h-4 w-4 mr-1 inline" />
                  View Resume
                </a>
              ) : (
                <span className="text-base text-muted-foreground">-</span>
              )}
            </div>
          );
        },
        size: 200,
      },
      {
        accessorKey: "tags",
        header: "Tags",
        cell: ({ getValue }) => {
          const tags = (getValue() as string[]) || [];
          return (
            <div className="flex flex-wrap gap-1">
              {tags.length > 0 ? (
                tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))
              ) : (
                <span className="text-base text-muted-foreground">-</span>
              )}
            </div>
          );
        },
        size: 200,
      },
      // === INTERVIEW COLUMNS ===
      {
        accessorKey: "notes",
        header: "Interview Notes",
        cell: ({ getValue, row, column, table }) => {
          const notes = getValue() as string;
          return (
            <div className="max-w-xs">
              <div className="text-base truncate" title={notes || '-'}>
                {notes && notes !== '-' ? notes : '-'}
              </div>
            </div>
          );
        },
        size: 250,
      },
      {
        accessorKey: "interviewScore",
        header: "Interview Score",
        cell: ({ getValue, row, column, table }) => (
          <EditableScoreCell getValue={getValue} row={row} column={column} table={table} />
        ),
        size: 200,
      },
      {
        accessorKey: "interviewDuration",
        header: "Interview Duration",
        cell: ({ getValue, row, column, table }) => (
          <EditableCell getValue={getValue} row={row} column={column} table={table} />
        ),
        size: 200,
      },
      {
        accessorKey: "interviewSummary",
        header: "Interview Summary",
        cell: ({ getValue }) => {
          const summary = getValue() as string;
          return (
            <div className="max-w-xs">
              <div className="text-base truncate" title={summary || '-'}>
                {summary && summary !== '-' ? summary : '-'}
              </div>
            </div>
          );
        },
        size: 250,
      },
      {
        accessorKey: "interviewTranscript",
        header: "Interview Transcript",
        cell: ({ getValue }) => {
          const transcript = getValue() as string;
          return (
            <div className="max-w-xs">
              <div className="text-base truncate" title={transcript || '-'}>
                {transcript && transcript !== '-' ? `${transcript.substring(0, 50)}...` : '-'}
              </div>
            </div>
          );
        },
        size: 250,
      },
      {
        accessorKey: "interviewDate",
        header: "Interview Date",
        cell: ({ getValue }) => {
          const value = getValue() as string;
          const date = value ? new Date(value) : null;
          return (
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-base">
                {date ? date.toLocaleDateString() : '-'}
              </span>
            </div>
          );
        },
        size: 200,
      },
      // === AGENT & CALL COLUMNS ===
      {
        accessorKey: "agentName",
        header: "Agent Name",
        cell: ({ getValue, row, column, table }) => (
          <EditableCell getValue={getValue} row={row} column={column} table={table} />
        ),
        size: 200,
      },
      {
        accessorKey: "agentId",
        header: "Agent ID",
        cell: ({ getValue }) => {
          const agentId = getValue() as string;
          return (
            <div className="max-w-xs">
              <div className="text-base font-mono text-sm truncate" title={agentId || '-'}>
                {agentId || '-'}
              </div>
            </div>
          );
        },
        size: 200,
      },
      {
        accessorKey: "conversationId",
        header: "Conversation ID",
        cell: ({ getValue }) => {
          const conversationId = getValue() as string;
          return (
            <div className="max-w-xs">
              <div className="text-base font-mono text-sm truncate" title={conversationId || '-'}>
                {conversationId || '-'}
              </div>
            </div>
          );
        },
        size: 200,
      },
      {
        accessorKey: "callDuration",
        header: "Call Duration",
        cell: ({ getValue }) => {
          const duration = getValue() as number;
          return (
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-base">{formatCallDuration(duration)}</span>
            </div>
          );
        },
        size: 200,
      },
      {
        accessorKey: "messageCount",
        header: "Message Count",
        cell: ({ getValue, row, column, table }) => (
          <EditableCell getValue={getValue} row={row} column={column} table={table} />
        ),
        size: 200,
      },
      {
        accessorKey: "callStatus",
        header: "Call Status",
        cell: ({ getValue, row, column, table }) => (
          <EditableCell getValue={getValue} row={row} column={column} table={table} />
        ),
        size: 200,
      },
      {
        accessorKey: "callSuccessful",
        header: "Call Successful",
        cell: ({ getValue }) => {
          const isSuccess = getValue() as string;
          const success = isSuccess === 'success' || isSuccess === 'true';
          return (
            <div className="flex items-center space-x-2">
              {success ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-base">{isSuccess || '-'}</span>
            </div>
          );
        },
        size: 200,
      },
      {
        accessorKey: "transcriptSummary",
        header: "Transcript Summary",
        cell: ({ getValue }) => {
          const summary = getValue() as string;
          return (
            <div className="max-w-xs">
              <div className="text-base truncate" title={summary || '-'}>
                {summary && summary !== '-' ? summary : '-'}
              </div>
            </div>
          );
        },
        size: 250,
      },
      {
        accessorKey: "callSummaryTitle",
        header: "Call Summary Title",
        cell: ({ getValue, row, column, table }) => (
          <EditableCell getValue={getValue} row={row} column={column} table={table} />
        ),
        size: 250,
      },
      // === DATA COLUMNS ===
      {
        accessorKey: "evaluationCriteria",
        header: "Evaluation Criteria",
        cell: ({ getValue }) => {
          const criteria = getValue() as any;
          return (
            <div className="max-w-xs">
              <div className="text-base truncate" title={criteria ? JSON.stringify(criteria) : '-'}>
                {criteria ? 'JSON Data Available' : '-'}
              </div>
            </div>
          );
        },
        size: 200,
      },
      {
        accessorKey: "dataCollectionResults",
        header: "Data Collection Results",
        cell: ({ getValue }) => {
          const results = getValue() as any;
          return (
            <div className="max-w-xs">
              <div className="text-base truncate" title={results ? JSON.stringify(results) : '-'}>
                {results ? 'JSON Data Available' : '-'}
              </div>
            </div>
          );
        },
        size: 200,
      },
      {
        accessorKey: "interviewData",
        header: "Interview Data",
        cell: ({ getValue }) => {
          const data = getValue() as any;
          return (
            <div className="max-w-xs">
              <div className="text-base truncate" title={data ? JSON.stringify(data) : '-'}>
                {data ? 'JSON Data Available' : '-'}
              </div>
            </div>
          );
        },
        size: 200,
      },
      // === TIMESTAMPS ===
      {
        accessorKey: "createdAt",
        header: "Created At",
        cell: ({ getValue }) => {
          const value = getValue() as string;
          const date = value ? new Date(value) : null;
          return (
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-base">
                {date ? date.toLocaleDateString() : '-'}
              </span>
            </div>
          );
        },
        size: 200,
      },
    ],
    [selectedRows, expandedRows, currentFilters, filteredCandidates, data]
  );

  // Use filtered candidates for table data, or all candidates if no filters applied
  const tableData = currentFilters ? filteredCandidates : data;

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    meta: {
      updateData,
    },
  });

  const { rows } = table.getRowModel();

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 10,
  });

  if (isLoading) {
    return (
      <Card className="glass-panel rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-48"></div>
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="glass-panel rounded-lg overflow-hidden font-serif">
      {/* Grid Header */}
      <div className="grid-header p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h3 className="enterprise-heading text-lg font-semibold">Candidate Database</h3>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-muted-foreground" data-testid="total-candidates">
              {(allCandidates || []).length.toLocaleString()} candidates
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="glass-input px-3 py-1 rounded-lg text-sm glow-hover"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="filter-button"
            >
              <i className="fas fa-filter mr-2"></i>Filter
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="glass-input px-3 py-1 rounded-lg text-sm glow-hover"
              onClick={() => setShowExportDialog(true)}
              data-testid="export-csv-button"
            >
              <i className="fas fa-download mr-2"></i>Export CSV
            </Button>
          </div>
        </div>

        {/* Advanced Search and Filters - Show/Hide */}
        {showFilters && (
          <SearchAndFilter
            candidates={allCandidates || []}
            onFilterChange={handleFilterChange}
            className="mb-6"
          />
        )}

        {/* Bulk Operations */}
        <BulkOperations
          selectedCandidates={selectedRows}
          allCandidates={allCandidates || []}
          onClearSelection={clearSelection}
          className="mb-6"
        />

      </div>

      {/* Table with unlimited horizontal scrolling */}
      <div className="overflow-x-auto overflow-y-hidden">
        <div className="min-w-fit">
          {/* Table Headers */}
          <div className="bg-gradient-to-r from-accent/10 to-primary/10 border-b-2 border-accent/30">
            <div className="flex">
              {table.getHeaderGroups()[0]?.headers.map((header) => (
                <div
                  key={header.id}
                  className="flex items-center justify-start px-4 py-6 text-base font-bold text-foreground border-r border-accent/20 last:border-r-0 font-serif tracking-wide"
                  style={{ minWidth: header.getSize(), width: header.getSize() }}
                >
                  <div className="flex items-center space-x-2">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-0 h-auto hover:text-accent"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <i className="fas fa-sort text-xs"></i>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Table Rows with Expansion Support */}
          <div 
            ref={parentRef}
            className="max-h-[80vh] overflow-y-auto overflow-x-hidden"
            data-testid="candidates-grid"
          >
            <div className="relative">
              {rows.map((row, index) => {
                const isExpanded = expandedRows.has(row.original.id);
                return (
                  <motion.div
                    key={row.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className={`w-full border-b hover:bg-accent/5 hover:shadow-sm transition-all duration-200 ${
                      isExpanded ? 'border-primary/20 bg-accent/2' : 'border-accent/10'
                    }`}
                    data-testid={`candidate-row-${row.original.id}`}
                  >
                    {/* Main Row */}
                    <div className="flex min-h-24">
                      {row.getVisibleCells().map((cell) => (
                        <div
                          key={cell.id}
                          className="flex items-center px-4 py-4 border-r border-accent/10 last:border-r-0 overflow-hidden font-serif"
                          style={{ minWidth: cell.column.getSize(), width: cell.column.getSize() }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      ))}
                    </div>
                    
                    {/* Expanded Content */}
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                        data-testid={`expanded-content-${row.original.id}`}
                      >
                        <ExpandedRowContent candidate={row.original} />
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Expansion Status */}
            {expandedRows.size > 0 && (
              <div className="p-3 text-center text-muted-foreground text-sm bg-muted/20 border-t">
                <i className="fas fa-expand mr-2"></i>
                {expandedRows.size} {expandedRows.size === 1 ? 'row' : 'rows'} expanded • 
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-1 text-xs ml-2 underline"
                  onClick={collapseAllRows}
                  data-testid="collapse-all-rows"
                >
                  Collapse All
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pagination */}
      <div className="border-t border-border p-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {selectedRows.length > 0 && (
            <span data-testid="selected-count">
              {selectedRows.length} of {(tableData || []).length} selected
            </span>
          )}
          <div className="mt-1 text-xs text-muted-foreground/70">
            Click any cell to edit • Press Enter to save • Press Escape to cancel
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            data-testid="previous-page"
          >
            <i className="fas fa-chevron-left"></i>
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            data-testid="next-page"
          >
            <i className="fas fa-chevron-right"></i>
          </Button>
        </div>
      </div>

      {/* Data Export/Import - Moved below table */}
      <div className="p-4 border-t border-border">
        <DataExportImport
          candidates={allCandidates || []}
          className=""
        />
      </div>

      {/* File Viewer for selected candidate */}
      {selectedCandidateForFiles && (
        <div className="mt-4 p-4 border-t border-border">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Files for {selectedCandidateForFiles.name}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCandidateForFiles(null)}
              data-testid="close-file-viewer"
            >
              <i className="fas fa-times"></i>
            </Button>
          </div>
          <FileViewer 
            files={selectedCandidateForFiles.resumeUrl ? [{
              id: 'resume',
              name: `${selectedCandidateForFiles.name}_Resume.pdf`,
              type: 'application/pdf',
              url: selectedCandidateForFiles.resumeUrl,
              size: 1024000,
              uploadedAt: new Date()
            }] : []}
            candidateName={selectedCandidateForFiles.name || 'Unknown'}
          />
        </div>
      )}

      {/* Details Modal */}
      {detailsCandidate && (
        <Dialog open={!!detailsCandidate} onOpenChange={() => setDetailsCandidate(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] w-[95vw] h-[90vh] overflow-hidden p-0">
            <DialogHeader className="p-6 border-b border-border">
              <DialogTitle className="text-xl font-semibold">
                Interview Details - {detailsCandidate.name}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Complete interview data and evaluation results
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-hidden">
              <Tabs defaultValue="overview" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-5 mx-6 mt-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                  <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
                  <TabsTrigger value="data">Data Results</TabsTrigger>
                  <TabsTrigger value="technical">Technical</TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-hidden px-6 pb-6">
                  {/* Overview Tab */}
                  <TabsContent value="overview" className="h-full mt-4">
                    <ScrollArea className="h-full w-full">
                      <div className="space-y-6">
                        {/* Basic Info */}
                        <div className="bg-muted/30 rounded-lg p-4">
                          <h3 className="text-lg font-semibold mb-3">Basic Information</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Name</label>
                              <p className="text-sm mt-1">{detailsCandidate.name}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Email</label>
                              <p className="text-sm mt-1">{detailsCandidate.email}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Phone</label>
                              <p className="text-sm mt-1">{detailsCandidate.phone || '-'}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Pipeline Stage</label>
                              <p className="text-sm mt-1">{detailsCandidate.pipelineStage}</p>
                            </div>
                          </div>
                        </div>

                        {/* Interview Summary */}
                        {detailsCandidate.interviewSummary && (
                          <div className="bg-muted/30 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-lg font-semibold">Interview Summary</h3>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigator.clipboard.writeText(detailsCandidate.interviewSummary || '')}
                                data-testid="copy-interview-summary"
                              >
                                <i className="fas fa-copy mr-2"></i>Copy
                              </Button>
                            </div>
                            <div className="bg-background rounded-md p-3 border">
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                {detailsCandidate.interviewSummary}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Call Summary Title */}
                        {detailsCandidate.callSummaryTitle && (
                          <div className="bg-muted/30 rounded-lg p-4">
                            <h3 className="text-lg font-semibold mb-3">Call Summary Title</h3>
                            <div className="bg-background rounded-md p-3 border">
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                {detailsCandidate.callSummaryTitle}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {detailsCandidate.notes && (
                          <div className="bg-muted/30 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-lg font-semibold">Interview Notes</h3>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigator.clipboard.writeText(detailsCandidate.notes || '')}
                                data-testid="copy-notes"
                              >
                                <i className="fas fa-copy mr-2"></i>Copy
                              </Button>
                            </div>
                            <div className="bg-background rounded-md p-3 border">
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                {detailsCandidate.notes}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Metrics */}
                        <div className="bg-muted/30 rounded-lg p-4">
                          <h3 className="text-lg font-semibold mb-3">Interview Metrics</h3>
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Score</label>
                              <p className="text-sm mt-1">{detailsCandidate.score || 0}%</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Interview Score</label>
                              <p className="text-sm mt-1">{detailsCandidate.interviewScore || 0}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Duration</label>
                              <p className="text-sm mt-1">{detailsCandidate.interviewDuration || '-'}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Call Duration</label>
                              <p className="text-sm mt-1">{formatCallDuration(detailsCandidate.callDuration)}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Message Count</label>
                              <p className="text-sm mt-1">{detailsCandidate.messageCount || 0}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Call Status</label>
                              <p className="text-sm mt-1">{detailsCandidate.callStatus || '-'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Transcript Tab */}
                  <TabsContent value="transcript" className="h-full mt-4">
                    <ScrollArea className="h-full w-full">
                      <div className="space-y-6">
                        {/* Full Interview Transcript */}
                        {detailsCandidate.interviewTranscript ? (
                          <div className="bg-muted/30 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-lg font-semibold">Full Interview Transcript</h3>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigator.clipboard.writeText(detailsCandidate.interviewTranscript || '')}
                                data-testid="copy-transcript"
                              >
                                <i className="fas fa-copy mr-2"></i>Copy
                              </Button>
                            </div>
                            <div className="bg-background rounded-md p-4 border max-h-[600px] overflow-y-auto">
                              <pre className="text-sm whitespace-pre-wrap leading-relaxed font-mono">
                                {detailsCandidate.interviewTranscript}
                              </pre>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-12 text-muted-foreground">
                            <i className="fas fa-file-text text-3xl mb-4"></i>
                            <p>No interview transcript available</p>
                          </div>
                        )}

                        {/* Transcript Summary */}
                        {detailsCandidate.transcriptSummary && (
                          <div className="bg-muted/30 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-lg font-semibold">Transcript Summary</h3>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigator.clipboard.writeText(detailsCandidate.transcriptSummary || '')}
                                data-testid="copy-transcript-summary"
                              >
                                <i className="fas fa-copy mr-2"></i>Copy
                              </Button>
                            </div>
                            <div className="bg-background rounded-md p-3 border">
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                {detailsCandidate.transcriptSummary}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Evaluation Tab */}
                  <TabsContent value="evaluation" className="h-full mt-4">
                    <ScrollArea className="h-full w-full">
                      <div className="space-y-6">
                        {detailsCandidate.evaluationCriteria ? (
                          <div className="bg-muted/30 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-lg font-semibold">Evaluation Criteria</h3>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigator.clipboard.writeText(JSON.stringify(detailsCandidate.evaluationCriteria as any, null, 2))}
                                data-testid="copy-evaluation-criteria"
                              >
                                <i className="fas fa-copy mr-2"></i>Copy JSON
                              </Button>
                            </div>
                            <div className="bg-background rounded-md p-4 border max-h-[600px] overflow-y-auto">
                              <pre className="text-sm whitespace-pre-wrap leading-relaxed font-mono">
                                {JSON.stringify(detailsCandidate.evaluationCriteria as any, null, 2)}
                              </pre>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-12 text-muted-foreground">
                            <i className="fas fa-chart-bar text-3xl mb-4"></i>
                            <p>No evaluation criteria available</p>
                          </div>
                        )}

                        {/* Interview Data */}
                        {!!detailsCandidate.interviewData && (
                          <div className="bg-muted/30 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-lg font-semibold">Interview Data</h3>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigator.clipboard.writeText(JSON.stringify(detailsCandidate.interviewData, null, 2))}
                                data-testid="copy-interview-data"
                              >
                                <i className="fas fa-copy mr-2"></i>Copy JSON
                              </Button>
                            </div>
                            <div className="bg-background rounded-md p-4 border max-h-[600px] overflow-y-auto">
                              <pre className="text-sm whitespace-pre-wrap leading-relaxed font-mono">
                                {JSON.stringify(detailsCandidate.interviewData as any, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Data Results Tab */}
                  <TabsContent value="data" className="h-full mt-4">
                    <ScrollArea className="h-full w-full">
                      <div className="space-y-6">
                        {detailsCandidate.dataCollectionResults ? (
                          <div className="bg-muted/30 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-lg font-semibold">Data Collection Results</h3>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigator.clipboard.writeText(JSON.stringify(detailsCandidate.dataCollectionResults as any, null, 2))}
                                data-testid="copy-data-collection"
                              >
                                <i className="fas fa-copy mr-2"></i>Copy JSON
                              </Button>
                            </div>
                            <div className="bg-background rounded-md p-4 border max-h-[600px] overflow-y-auto">
                              <pre className="text-sm whitespace-pre-wrap leading-relaxed font-mono">
                                {JSON.stringify(detailsCandidate.dataCollectionResults as any, null, 2)}
                              </pre>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-12 text-muted-foreground">
                            <i className="fas fa-database text-3xl mb-4"></i>
                            <p>No data collection results available</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Technical Tab */}
                  <TabsContent value="technical" className="h-full mt-4">
                    <ScrollArea className="h-full w-full">
                      <div className="space-y-6">
                        {/* Agent Information */}
                        <div className="bg-muted/30 rounded-lg p-4">
                          <h3 className="text-lg font-semibold mb-3">Agent Information</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Agent Name</label>
                              <p className="text-sm mt-1 font-mono">{detailsCandidate.agentName || '-'}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Agent ID</label>
                              <p className="text-sm mt-1 font-mono">{detailsCandidate.agentId || '-'}</p>
                            </div>
                            <div className="col-span-2">
                              <label className="text-sm font-medium text-muted-foreground">Conversation ID</label>
                              <div className="flex items-center space-x-2 mt-1">
                                <p className="text-sm font-mono flex-1">{detailsCandidate.conversationId || '-'}</p>
                                {detailsCandidate.conversationId && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => navigator.clipboard.writeText(detailsCandidate.conversationId || '')}
                                    data-testid="copy-conversation-id"
                                  >
                                    <i className="fas fa-copy"></i>
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Call Information */}
                        <div className="bg-muted/30 rounded-lg p-4">
                          <h3 className="text-lg font-semibold mb-3">Call Information</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Call Status</label>
                              <p className="text-sm mt-1">{detailsCandidate.callStatus || '-'}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Call Successful</label>
                              <p className="text-sm mt-1">{detailsCandidate.callSuccessful || '-'}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Interview Date</label>
                              <p className="text-sm mt-1">
                                {detailsCandidate.interviewDate 
                                  ? new Date(detailsCandidate.interviewDate).toLocaleString()
                                  : '-'
                                }
                              </p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Source Reference</label>
                              <p className="text-sm mt-1">{detailsCandidate.sourceRef || '-'}</p>
                            </div>
                          </div>
                        </div>

                        {/* Tags */}
                        {detailsCandidate.tags && detailsCandidate.tags.length > 0 && (
                          <div className="bg-muted/30 rounded-lg p-4">
                            <h3 className="text-lg font-semibold mb-3">Tags</h3>
                            <div className="flex flex-wrap gap-2">
                              {detailsCandidate.tags.map((tag, index) => (
                                <Badge key={index} variant="secondary">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}