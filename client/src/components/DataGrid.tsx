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
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  // Reset value when data changes
  useEffect(() => {
    setValue(initialValue);
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
        className="h-8 text-xs bg-transparent border-accent"
        autoFocus
      />
    );
  }

  return (
    <div
      className="cursor-pointer hover:bg-accent/10 px-2 py-1 rounded min-h-8 flex items-center"
      onClick={() => setIsEditing(true)}
      data-testid={`editable-${column.id}-${row.original.id}`}
    >
      <span className="text-xs">{value as string || "—"}</span>
    </div>
  );
}

// Editable score cell with number input
function EditableScoreCell({ getValue, row, column, table }: any) {
  const initialValue = getValue() || 0;
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setValue(initialValue);
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
        className="h-8 w-16 text-xs bg-transparent border-accent"
        autoFocus
      />
    );
  }

  const score = value as number;
  return (
    <div
      className="cursor-pointer hover:bg-accent/10 px-2 py-1 rounded min-h-8 flex items-center space-x-2"
      onClick={() => setIsEditing(true)}
    >
      <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-accent rounded-full transition-all duration-300"
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs w-8">{score}%</span>
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
  }, [currentFilters, filteredCandidates, data, updateCandidateMutation]);

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

  const columns = useMemo<ColumnDef<Candidate>[]>(
    () => [
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
        size: 60,
        enableSorting: false,
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: (props) => (
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-7 h-7 bg-primary/20 rounded-full flex items-center justify-center text-xs flex-shrink-0">
              {props.row.original.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <EditableCell {...props} />
            </div>
          </div>
        ),
        size: 300,
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ getValue, row, column, table }) => {
          const email = getValue() as string;
          
          return (
            <div className="flex items-center space-x-2">
              <EditableCell getValue={getValue} row={row} column={column} table={table} />
              {email && (
                <a 
                  href={`mailto:${email}`}
                  className="text-blue-500 hover:text-blue-600 ml-2"
                  data-testid={`email-${row.original.id}`}
                  title="Send email"
                >
                  <i className="fas fa-envelope text-xs"></i>
                </a>
              )}
            </div>
          );
        },
        size: 350,
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ getValue, row, column, table }) => {
          const phoneNumber = getValue() as string;
          const formattedPhone = phoneNumber?.replace(/[^\d+]/g, '') || '';
          
          return (
            <div className="flex items-center space-x-2">
              <EditableCell getValue={getValue} row={row} column={column} table={table} />
              {formattedPhone && (
                <a 
                  href={`tel:${formattedPhone}`}
                  className="text-blue-500 hover:text-blue-600 ml-2"
                  data-testid={`call-${row.original.id}`}
                  title="Call this number"
                >
                  <i className="fas fa-phone text-xs"></i>
                </a>
              )}
            </div>
          );
        },
        size: 220,
      },
      {
        accessorKey: "sourceRef",
        header: "Source",
        cell: ({ row }) => {
          const source = row.original.campaignId ? "Indeed" : "Manual";
          const colorClass = source === "Indeed" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground";
          return (
            <Badge className={`${colorClass} rounded-full text-xs`} data-testid={`candidate-source-${row.original.id}`}>
              {source}
            </Badge>
          );
        },
        size: 150,
        enableSorting: false,
      },
      {
        accessorKey: "pipelineStage",
        header: "Stage",
        cell: ({ row, table }) => (
          <Select
            value={row.original.pipelineStage}
            onValueChange={(value) => {
              table.options.meta?.updateData(row.index, 'pipelineStage', value);
            }}
          >
            <SelectTrigger className="glass-input text-xs bg-transparent border-border h-8 w-full" data-testid={`stage-select-${row.original.id}`}>
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
        size: 250,
      },
      {
        accessorKey: "score",
        header: "Score",
        cell: EditableScoreCell,
        size: 200,
      },
      {
        id: "interview",
        header: "Interview",
        cell: ({ row }) => (
          <div className="flex justify-center">
            <i className={`fas fa-check text-sm ${
              row.original.pipelineStage !== "NEW" ? "text-accent" : "text-muted-foreground"
            }`} data-testid={`interview-status-${row.original.id}`}></i>
          </div>
        ),
        size: 120,
        enableSorting: false,
      },
      {
        id: "booking",
        header: "Booking",
        cell: ({ row }) => (
          <div className="flex justify-center">
            <i className={`fas fa-calendar-check text-sm ${
              ["OFFER", "HIRED"].includes(row.original.pipelineStage) ? "text-primary" : "text-muted-foreground"
            }`} data-testid={`booking-status-${row.original.id}`}></i>
          </div>
        ),
        size: 120,
        enableSorting: false,
      },
      {
        id: "resume",
        header: "Resume",
        cell: ({ row }) => {
          const candidate = row.original;
          const hasResume = candidate.resumeUrl;
          
          return (
            <div className="flex items-center justify-center space-x-2">
              {hasResume ? (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-8 h-8 p-0 hover:bg-muted"
                    onClick={() => setSelectedCandidateForFiles(candidate)}
                    data-testid={`view-resume-${candidate.id}`}
                  >
                    <i className="fas fa-file-alt text-sm text-green-500"></i>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-8 h-8 p-0 hover:bg-muted"
                    asChild
                    data-testid={`download-resume-${candidate.id}`}
                  >
                    <a href={candidate.resumeUrl || '#'} target="_blank" rel="noopener noreferrer">
                      <i className="fas fa-download text-sm text-blue-500"></i>
                    </a>
                  </Button>
                </div>
              ) : (
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={10485760}
                  onGetUploadParameters={handleGetUploadParameters}
                  onComplete={handleResumeUploadComplete(candidate.id)}
                  buttonClassName="w-8 h-8 p-0 hover:bg-muted glass-input"
                  data-testid={`upload-resume-${candidate.id}`}
                >
                  <i className="fas fa-upload text-sm"></i>
                </ObjectUploader>
              )}
            </div>
          );
        },
        size: 180,
        enableSorting: false,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center justify-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0 hover:bg-muted"
              onClick={() => setViewingCandidate(row.original)}
              data-testid={`view-candidate-${row.original.id}`}
              title="View candidate details"
            >
              <i className="fas fa-eye text-sm"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0 hover:bg-muted"
              onClick={() => setEditingCandidate(row.original)}
              data-testid={`edit-candidate-${row.original.id}`}
              title="Edit candidate"
            >
              <i className="fas fa-edit text-sm"></i>
            </Button>
          </div>
        ),
        size: 160,
        enableSorting: false,
      },
    ],
    [selectedRows, setSelectedCandidateForFiles]
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
    estimateSize: () => 60,
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

      {/* Table with proper column widths */}
      <div className="overflow-x-auto">
        <div className="min-w-[1200px]">
          {/* Table Headers */}
          <div className="bg-gradient-to-r from-accent/10 to-primary/10 border-b-2 border-accent/30">
            <div className="flex">
              {table.getHeaderGroups()[0]?.headers.map((header) => (
                <div
                  key={header.id}
                  className="flex items-center justify-start px-4 py-4 text-sm font-bold text-foreground border-r border-accent/20 last:border-r-0 font-serif tracking-wide"
                  style={{ width: header.getSize() }}
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

          {/* Virtualized Rows */}
          <div 
            ref={parentRef}
            className="max-h-96 overflow-auto"
            data-testid="candidates-grid"
          >
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <motion.div
                    key={row.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className="absolute w-full border-b border-accent/10 hover:bg-accent/5 hover:shadow-sm transition-all duration-200"
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    data-testid={`candidate-row-${row.original.id}`}
                  >
                    <div className="flex h-full">
                      {row.getVisibleCells().map((cell) => (
                        <div
                          key={cell.id}
                          className="flex items-center px-4 py-3 border-r border-accent/10 last:border-r-0 overflow-hidden font-serif"
                          style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Loading indicator for additional data */}
            {(tableData || []).length > 100 && (
              <div className="p-4 text-center text-muted-foreground text-sm">
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Virtual scrolling active - {(tableData || []).length.toLocaleString()} candidates loaded
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
    </Card>
  );
}