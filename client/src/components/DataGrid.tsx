import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type ColumnDef,
  flexRender,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import SearchAndFilter, { type FilterOptions } from "@/components/SearchAndFilter";
import BulkOperations from "@/components/BulkOperations";
import DataExportImport from "@/components/DataExportImport";
import { ObjectUploader } from "@/components/ObjectUploader";
import { FileViewer } from "@/components/FileViewer";
import type { Candidate } from "@shared/schema";
import type { UploadResult } from "@uppy/core";

export default function DataGrid() {
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [currentFilters, setCurrentFilters] = useState<FilterOptions | null>(null);
  const [selectedCandidateForFiles, setSelectedCandidateForFiles] = useState<Candidate | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: allCandidates = [], isLoading } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates"],
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
  });

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
    },
  });

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
    if (result.successful.length > 0) {
      const uploadURL = result.successful[0].uploadURL;
      uploadResumeForCandidateMutation.mutate({ candidateId, resumeURL: uploadURL });
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
        size: 50,
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-xs">
              {row.original.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <span className="font-medium" data-testid={`candidate-name-${row.original.id}`}>
              {row.original.name}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground" data-testid={`candidate-email-${getValue()}`}>
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {getValue() as string || "—"}
          </span>
        ),
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
      },
      {
        accessorKey: "pipelineStage",
        header: "Stage",
        cell: ({ row }) => (
          <Select
            value={row.original.pipelineStage}
            onValueChange={(value) => {
              updateCandidateMutation.mutate({
                id: row.original.id,
                updates: { pipelineStage: value as any },
              });
            }}
            disabled={updateCandidateMutation.isPending}
          >
            <SelectTrigger className="glass-input text-xs bg-transparent border-border h-8" data-testid={`stage-select-${row.original.id}`}>
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
      },
      {
        accessorKey: "score",
        header: "Score",
        cell: ({ getValue }) => {
          const score = getValue() as number || 0;
          return (
            <div className="flex items-center space-x-1">
              <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${score}%` }}
                />
              </div>
              <span className="text-xs" data-testid={`candidate-score-${score}`}>
                {score}%
              </span>
            </div>
          );
        },
      },
      {
        id: "interview",
        header: "Interview",
        cell: ({ row }) => (
          <i className={`fas fa-check text-sm ${
            row.original.pipelineStage !== "NEW" ? "text-accent" : "text-muted-foreground"
          }`} data-testid={`interview-status-${row.original.id}`}></i>
        ),
      },
      {
        id: "booking",
        header: "Booking",
        cell: ({ row }) => (
          <i className={`fas fa-calendar-check text-sm ${
            ["OFFER", "HIRED"].includes(row.original.pipelineStage) ? "text-primary" : "text-muted-foreground"
          }`} data-testid={`booking-status-${row.original.id}`}></i>
        ),
      },
      {
        id: "resume",
        header: "Resume",
        cell: ({ row }) => {
          const candidate = row.original;
          const hasResume = candidate.resumeUrl;
          
          return (
            <div className="flex items-center space-x-2">
              {hasResume ? (
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-6 h-6 p-0 hover:bg-muted micro-animation"
                    onClick={() => setSelectedCandidateForFiles(candidate)}
                    data-testid={`view-resume-${candidate.id}`}
                  >
                    <i className="fas fa-file-alt text-xs text-green-500"></i>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-6 h-6 p-0 hover:bg-muted micro-animation"
                    asChild
                    data-testid={`download-resume-${candidate.id}`}
                  >
                    <a href={candidate.resumeUrl} target="_blank" rel="noopener noreferrer">
                      <i className="fas fa-download text-xs text-blue-500"></i>
                    </a>
                  </Button>
                </div>
              ) : (
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={10485760} // 10MB
                  onGetUploadParameters={handleGetUploadParameters}
                  onComplete={handleResumeUploadComplete(candidate.id)}
                  buttonClassName="w-6 h-6 p-0 hover:bg-muted micro-animation glass-input"
                  data-testid={`upload-resume-${candidate.id}`}
                >
                  <i className="fas fa-upload text-xs"></i>
                </ObjectUploader>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-6 h-6 p-0 hover:bg-muted micro-animation"
              data-testid={`view-candidate-${row.original.id}`}
            >
              <i className="fas fa-eye text-xs"></i>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-6 h-6 p-0 hover:bg-muted micro-animation"
              data-testid={`edit-candidate-${row.original.id}`}
            >
              <i className="fas fa-edit text-xs"></i>
            </Button>
          </div>
        ),
      },
    ],
    [selectedRows, updateCandidateMutation]
  );

  // Use filtered candidates for table data
  const tableData = filteredCandidates.length > 0 || currentFilters ? filteredCandidates : allCandidates;

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const { rows } = table.getRowModel();

  const parentRef = useState<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef[0],
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
    <Card className="glass-panel rounded-lg overflow-hidden">
      {/* Grid Header */}
      <div className="grid-header p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h3 className="enterprise-heading text-lg font-semibold">Candidate Database</h3>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-muted-foreground" data-testid="total-candidates">
              {allCandidates.length.toLocaleString()} candidates
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="glass-input px-3 py-1 rounded-lg text-sm glow-hover"
              data-testid="filter-button"
            >
              <i className="fas fa-filter mr-2"></i>Filter
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="glass-input px-3 py-1 rounded-lg text-sm glow-hover"
              data-testid="export-csv-button"
            >
              <i className="fas fa-download mr-2"></i>Export CSV
            </Button>
          </div>
        </div>

        {/* Advanced Search and Filters */}
        <SearchAndFilter
          candidates={allCandidates}
          onFilterChange={handleFilterChange}
          className="mb-6"
        />

        {/* Bulk Operations */}
        <BulkOperations
          selectedCandidates={selectedRows}
          allCandidates={allCandidates}
          onClearSelection={clearSelection}
          className="mb-6"
        />

        {/* Data Export/Import */}
        <DataExportImport
          candidates={allCandidates}
          className="mb-6"
        />

        {/* Column Headers */}
        <div className="grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground">
          {table.getHeaderGroups()[0]?.headers.map((header) => (
            <div
              key={header.id}
              className={`${
                header.id === "select" ? "col-span-1" :
                header.id === "name" ? "col-span-2" :
                header.id === "email" ? "col-span-2" :
                header.id === "pipelineStage" ? "col-span-2" :
                "col-span-1"
              } flex items-center space-x-2`}
            >
              {flexRender(header.column.columnDef.header, header.getContext())}
              {header.column.getCanSort() && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-0 h-auto"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <i className="fas fa-sort text-xs"></i>
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Virtualized Rows */}
      <div 
        ref={(el) => parentRef[1](el)}
        className="max-h-96 overflow-auto scroll-area"
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
                className="data-row grid grid-cols-12 gap-4 p-4 border-b border-border text-sm absolute w-full"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                data-testid={`candidate-row-${row.original.id}`}
              >
                {row.getVisibleCells().map((cell) => (
                  <div
                    key={cell.id}
                    className={`${
                      cell.column.id === "select" ? "col-span-1" :
                      cell.column.id === "name" ? "col-span-2" :
                      cell.column.id === "email" ? "col-span-2" :
                      cell.column.id === "pipelineStage" ? "col-span-2" :
                      "col-span-1"
                    } flex items-center`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </motion.div>
            );
          })}
        </div>

        {/* Loading indicator for additional data */}
        {tableData.length > 100 && (
          <div className="p-4 text-center text-muted-foreground text-sm">
            <i className="fas fa-spinner fa-spin mr-2"></i>
            Virtual scrolling active - {tableData.length.toLocaleString()} candidates loaded
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="border-t border-border p-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {selectedRows.length > 0 && (
            <span data-testid="selected-count">
              {selectedRows.length} of {tableData.length} selected
            </span>
          )}
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
              size: 1024000, // placeholder size
              uploadedAt: new Date()
            }] : []}
            candidateName={selectedCandidateForFiles.name || 'Unknown'}
          />
        </div>
      )}
    </Card>
  );
}
