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
  FileUp,
  Info
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
import { AudioPlayer } from "@/components/AudioPlayer";
import { EnhancedTranscript } from "@/components/EnhancedTranscript";
import type { Candidate } from "@shared/schema";
import type { UploadResult } from "@uppy/core";

// Type interfaces for JSONB structured data
interface EvaluationCriteriaData {
  communicationScore?: number;
  salesAptitudeScore?: number;
  motivationScore?: number;
  coachabilityScore?: number;
  professionalPresenceScore?: number;
  overallScore?: number;
  [key: string]: any;
}

interface DataCollectionResultsData {
  whyInsurance?: string;
  whyNow?: string;
  salesExperience?: string;
  difficultCustomerStory?: string;
  consultativeSelling?: string;
  preferredMarkets?: string[] | string;
  timeline?: string;
  recommendedNextSteps?: string;
  demoCallPerformed?: boolean;
  kevinPersonaUsed?: boolean;
  coachingGiven?: boolean;
  pitchDelivered?: boolean;
  strengths?: string[];
  developmentAreas?: string[];
  [key: string]: any;
}

interface InterviewData {
  agentId?: string;
  agentName?: string;
  conversationId?: string;
  transcript?: string;
  duration?: string;
  callDurationSecs?: number;
  summary?: string;
  status?: string;
  callSuccessful?: boolean;
  messageCount?: number;
  transcriptSummary?: string;
  callSummaryTitle?: string;
  audioRecordingUrl?: string;
  interviewDate?: string;
  startTimeUnixSecs?: number;
  [key: string]: any;
}

// Type guards for JSONB data
function isEvaluationCriteriaData(data: unknown): data is EvaluationCriteriaData {
  return data != null && typeof data === 'object';
}

function isDataCollectionResultsData(data: unknown): data is DataCollectionResultsData {
  return data != null && typeof data === 'object';
}

function isInterviewData(data: unknown): data is InterviewData {
  return data != null && typeof data === 'object';
}

// Helper function to safely access properties with both snake_case and camelCase variants
function getNestedProperty(obj: any, camelKey: string, snakeKey: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  return obj[camelKey] ?? obj[snakeKey];
}

// Helper function to safely render JSON values as React nodes
function renderJsonValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

// Extend table meta interface for inline editing
declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
  }
}

// Enhanced Tooltip Components for different data types
function EnhancedTooltip({ 
  children, 
  content, 
  title, 
  maxWidth = "max-w-lg",
  side = "top" as const,
  showCondition = true
}: {
  children: React.ReactNode;
  content: string;
  title?: string;
  maxWidth?: string;
  side?: "top" | "bottom" | "left" | "right";
  showCondition?: boolean;
}) {
  if (!showCondition || !content || content === "—" || content === "-") {
    return <>{children}</>;
  }

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={`${maxWidth} max-h-60 overflow-y-auto border-2 border-primary/20 bg-background backdrop-blur-sm shadow-xl z-50`}>
        <div className="space-y-2">
          {title && <div className="text-sm font-semibold text-primary border-b border-primary/20 pb-1">{title}</div>}
          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {content}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Specialized Tooltips for ElevenLabs structured data - NO MORE JSON DUMPS
function EvaluationCriteriaTooltip({ 
  children, 
  data, 
  title = "Evaluation Criteria" 
}: {
  children: React.ReactNode;
  data: unknown;
  title?: string;
}) {
  if (!isEvaluationCriteriaData(data) || Object.keys(data).length === 0) {
    return <>{children}</>;
  }

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-lg max-h-80 overflow-y-auto border-2 border-primary/20 bg-background backdrop-blur-sm shadow-xl z-50">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-primary border-b border-primary/20 pb-1">{title}</div>
          <div className="space-y-2 text-sm">
            {data.communicationScore && <div><strong>Communication:</strong> {data.communicationScore}/100</div>}
            {data.salesAptitudeScore && <div><strong>Sales Aptitude:</strong> {data.salesAptitudeScore}/100</div>}
            {data.motivationScore && <div><strong>Motivation:</strong> {data.motivationScore}/100</div>}
            {data.coachabilityScore && <div><strong>Coachability:</strong> {data.coachabilityScore}/100</div>}
            {data.professionalPresenceScore && <div><strong>Professional Presence:</strong> {data.professionalPresenceScore}/100</div>}
            {data.overallScore && <div><strong>Overall Score:</strong> {data.overallScore}/100</div>}
            {Object.entries(data).filter(([key]) => !key.includes('Score') && !key.includes('score')).map(([key, value]) => (
              <div key={key}><strong>{key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}:</strong> {String(value || '-')}</div>
            ))}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function DataCollectionResultsTooltip({ 
  children, 
  data, 
  title = "Data Collection Results" 
}: {
  children: React.ReactNode;
  data: unknown;
  title?: string;
}) {
  if (!isDataCollectionResultsData(data) || Object.keys(data).length === 0) {
    return <>{children}</>;
  }

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-lg max-h-80 overflow-y-auto border-2 border-primary/20 bg-background backdrop-blur-sm shadow-xl z-50">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-primary border-b border-primary/20 pb-1">{title}</div>
          <div className="space-y-2 text-sm">
            {data.whyInsurance && <div><strong>Why Insurance:</strong> {data.whyInsurance}</div>}
            {data.whyNow && <div><strong>Why Now:</strong> {data.whyNow}</div>}
            {data.salesExperience && <div><strong>Sales Experience:</strong> {data.salesExperience}</div>}
            {data.difficultCustomerStory && <div><strong>Difficult Customer Story:</strong> {data.difficultCustomerStory}</div>}
            {data.consultativeSelling && <div><strong>Consultative Selling:</strong> {data.consultativeSelling}</div>}
            {data.preferredMarkets && <div><strong>Preferred Markets:</strong> {Array.isArray(data.preferredMarkets) ? data.preferredMarkets.join(', ') : data.preferredMarkets}</div>}
            {data.timeline && <div><strong>Timeline:</strong> {data.timeline}</div>}
            {data.recommendedNextSteps && <div><strong>Recommended Next Steps:</strong> {data.recommendedNextSteps}</div>}
            {data.demoCallPerformed !== undefined && <div><strong>Demo Call Performed:</strong> {data.demoCallPerformed ? 'Yes' : 'No'}</div>}
            {data.kevinPersonaUsed !== undefined && <div><strong>Kevin Persona Used:</strong> {data.kevinPersonaUsed ? 'Yes' : 'No'}</div>}
            {data.coachingGiven !== undefined && <div><strong>Coaching Given:</strong> {data.coachingGiven ? 'Yes' : 'No'}</div>}
            {data.pitchDelivered !== undefined && <div><strong>Pitch Delivered:</strong> {data.pitchDelivered ? 'Yes' : 'No'}</div>}
            {data.strengths && Array.isArray(data.strengths) && <div><strong>Strengths:</strong> {data.strengths.join(', ')}</div>}
            {data.developmentAreas && Array.isArray(data.developmentAreas) && <div><strong>Development Areas:</strong> {data.developmentAreas.join(', ')}</div>}
            {Object.entries(data).filter(([key]) => ![
              'whyInsurance', 'whyNow', 'salesExperience', 'difficultCustomerStory', 'consultativeSelling',
              'preferredMarkets', 'timeline', 'recommendedNextSteps', 'demoCallPerformed', 'kevinPersonaUsed',
              'coachingGiven', 'pitchDelivered', 'strengths', 'developmentAreas'
            ].includes(key)).map(([key, value]) => (
              <div key={key}><strong>{key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}:</strong> {String(value || '-')}</div>
            ))}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function InterviewDataTooltip({ 
  children, 
  data, 
  title = "Interview Data" 
}: {
  children: React.ReactNode;
  data: unknown;
  title?: string;
}) {
  if (!isInterviewData(data) || Object.keys(data).length === 0) {
    return <>{children}</>;
  }

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-lg max-h-80 overflow-y-auto border-2 border-primary/20 bg-background backdrop-blur-sm shadow-xl z-50">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-primary border-b border-primary/20 pb-1">{title}</div>
          <div className="space-y-2 text-sm">
            {data.agentId && <div><strong>Agent ID:</strong> {data.agentId}</div>}
            {data.agentName && <div><strong>Agent Name:</strong> {data.agentName}</div>}
            {data.conversationId && <div><strong>Conversation ID:</strong> {data.conversationId}</div>}
            {data.transcript && <div><strong>Transcript Preview:</strong> {data.transcript.substring(0, 200)}...</div>}
            {data.duration && <div><strong>Duration:</strong> {data.duration}</div>}
            {data.callDurationSecs && <div><strong>Call Duration:</strong> {formatCallDuration(data.callDurationSecs)}</div>}
            {data.summary && <div><strong>Summary:</strong> {data.summary}</div>}
            {data.status && <div><strong>Status:</strong> {data.status}</div>}
            {data.call_successful !== undefined && <div><strong>Call Successful:</strong> {data.call_successful ? 'Yes' : 'No'}</div>}
            {data.message_count && <div><strong>Message Count:</strong> {data.message_count}</div>}
            {data.transcript_summary && <div><strong>Transcript Summary:</strong> {data.transcript_summary}</div>}
            {data.call_summary_title && <div><strong>Call Summary Title:</strong> {data.call_summary_title}</div>}
            {data.audio_recording_url && <div><strong>Audio Recording:</strong> Available</div>}
            {data.interview_date && <div><strong>Interview Date:</strong> {new Date(data.interview_date).toLocaleString()}</div>}
            {data.start_time_unix_secs && <div><strong>Start Time:</strong> {new Date(data.start_time_unix_secs * 1000).toLocaleString()}</div>}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Date Tooltip with full date/time information
function DateTooltip({ 
  children, 
  date, 
  title 
}: {
  children: React.ReactNode;
  date: string | Date | null | undefined;
  title?: string;
}) {
  if (!date) {
    return <>{children}</>;
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const fullDateTime = dateObj.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });
  const relativeTime = formatRelativeTime(dateObj);

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm border-2 border-primary/20 bg-background backdrop-blur-sm shadow-xl z-50">
        <div className="space-y-2">
          {title && <div className="text-sm font-semibold text-primary border-b border-primary/20 pb-1">{title}</div>}
          <div className="text-sm space-y-1">
            <div><strong>Full Date:</strong> {fullDateTime}</div>
            <div><strong>Relative:</strong> {relativeTime}</div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Helper function to format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  return `${Math.floor(diffInSeconds / 31536000)} years ago`;
}

// Editable cell component for text fields with enhanced tooltips
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
        className="h-10 text-base bg-transparent border-accent"
        autoFocus
      />
    );
  }

  const displayValue = String(value || "—");
  const shouldShowTooltip = Boolean(displayValue && displayValue !== "—" && displayValue !== "-");
  const columnTitle = typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id;

  return (
    <EnhancedTooltip
      content={displayValue}
      title={`${columnTitle}`}
      showCondition={shouldShowTooltip && (displayValue.length > 20 || (typeof displayValue === 'string' && displayValue.includes('\n')))}
      maxWidth="max-w-lg"
    >
      <div
        className="cursor-pointer hover:bg-accent/10 px-3 py-2 rounded min-h-12 flex items-center w-full min-w-0 group"
        onClick={() => setIsEditing(true)}
        data-testid={`editable-${column.id}-${row.original.id}`}
      >
        <span className="text-base leading-relaxed truncate min-w-0 flex-1 group-hover:text-primary transition-colors">
          {displayValue}
        </span>
        {shouldShowTooltip && displayValue.length > 30 && (
          <Eye className="h-3 w-3 text-muted-foreground/50 ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    </EnhancedTooltip>
  );
}

// Utility function to create score category badge
function getScoreCategoryBadge(score: number | null | undefined): { variant: 'default' | 'secondary' | 'destructive', label: string } {
  if (!score && score !== 0) return { variant: 'secondary', label: 'Not Scored' };
  if (score >= 80) return { variant: 'default', label: 'Excellent' };
  if (score >= 60) return { variant: 'secondary', label: 'Good' };
  if (score >= 40) return { variant: 'secondary', label: 'Fair' };
  return { variant: 'destructive', label: 'Needs Improvement' };
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

// Utility function to extract meaningful preview from JSON data
function getJsonDataPreview(data: any, maxLength: number = 80): string {
  if (!data || typeof data !== 'object') {
    return String(data) || '-';
  }
  
  try {
    // Handle arrays
    if (Array.isArray(data)) {
      if (data.length === 0) return '[]';
      const preview = data.slice(0, 2).map(item => {
        if (typeof item === 'string') return `"${item}"`;
        if (typeof item === 'object') return '{...}';
        return String(item);
      }).join(', ');
      const suffix = data.length > 2 ? ', ...' : '';
      return `[${preview}${suffix}]`;
    }
    
    // Handle objects
    const keys = Object.keys(data);
    if (keys.length === 0) return '{}';
    
    // Try to find meaningful key-value pairs
    const importantKeys = ['name', 'title', 'type', 'status', 'result', 'score', 'value', 'description'];
    const foundImportantKey = keys.find(key => importantKeys.includes(key.toLowerCase()));
    
    let preview = '';
    if (foundImportantKey && data[foundImportantKey]) {
      const value = typeof data[foundImportantKey] === 'string' 
        ? `"${data[foundImportantKey]}"`
        : String(data[foundImportantKey]);
      preview = `${foundImportantKey}: ${value}`;
    } else {
      // Show first few key-value pairs
      const pairs = keys.slice(0, 2).map(key => {
        const value = data[key];
        if (typeof value === 'string') return `${key}: "${value}"`;
        if (typeof value === 'object') return `${key}: {...}`;
        return `${key}: ${String(value)}`;
      });
      preview = pairs.join(', ');
    }
    
    if (keys.length > (foundImportantKey ? 1 : 2)) {
      preview += ', ...';
    }
    
    // Truncate if too long
    const result = `{${preview}}`;
    return result.length > maxLength ? result.substring(0, maxLength - 3) + '...' : result;
  } catch (error) {
    return 'Invalid JSON';
  }
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
                  onClick={() => navigator.clipboard.writeText(`Evaluation Criteria:\n${candidate.evaluationCriteria ? Object.entries(candidate.evaluationCriteria).map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`).join('\n') : 'No data available'}`)}
                  data-testid={`copy-evaluation-${candidate.id}`}
                >
                  <Copy className="h-3 w-3 mr-1" />Copy Data
                </Button>
              </div>
              <div className="bg-muted/50 rounded p-3 max-h-32 overflow-y-auto">
                {candidate.evaluationCriteria && Object.keys(candidate.evaluationCriteria).length > 0 ? (
                  <div className="space-y-2">
                    {getNestedProperty(candidate.evaluationCriteria, 'communicationScore', 'communication_score') && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium">Communication:</span>
                        <span className="text-xs bg-primary/10 px-2 py-1 rounded">{getNestedProperty(candidate.evaluationCriteria, 'communicationScore', 'communication_score')}/100</span>
                      </div>
                    )}
                    {getNestedProperty(candidate.evaluationCriteria, 'salesAptitudeScore', 'sales_aptitude_score') && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium">Sales Aptitude:</span>
                        <span className="text-xs bg-primary/10 px-2 py-1 rounded">{getNestedProperty(candidate.evaluationCriteria, 'salesAptitudeScore', 'sales_aptitude_score')}/100</span>
                      </div>
                    )}
                    {getNestedProperty(candidate.evaluationCriteria, 'motivationScore', 'motivation_score') && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium">Motivation:</span>
                        <span className="text-xs bg-primary/10 px-2 py-1 rounded">{getNestedProperty(candidate.evaluationCriteria, 'motivationScore', 'motivation_score')}/100</span>
                      </div>
                    )}
                    {getNestedProperty(candidate.evaluationCriteria, 'coachabilityScore', 'coachability_score') && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium">Coachability:</span>
                        <span className="text-xs bg-primary/10 px-2 py-1 rounded">{getNestedProperty(candidate.evaluationCriteria, 'coachabilityScore', 'coachability_score')}/100</span>
                      </div>
                    )}
                    {getNestedProperty(candidate.evaluationCriteria, 'professionalPresenceScore', 'professional_presence_score') && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium">Professional Presence:</span>
                        <span className="text-xs bg-primary/10 px-2 py-1 rounded">{getNestedProperty(candidate.evaluationCriteria, 'professionalPresenceScore', 'professional_presence_score')}/100</span>
                      </div>
                    )}
                    {getNestedProperty(candidate.evaluationCriteria, 'overallScore', 'overall_score') && (
                      <div className="flex justify-between items-center font-semibold">
                        <span className="text-xs">Overall Score:</span>
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">{getNestedProperty(candidate.evaluationCriteria, 'overallScore', 'overall_score')}/100</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-2">
                    No evaluation criteria available
                  </div>
                )}
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
                  onClick={() => navigator.clipboard.writeText(`Data Collection Results:\n${candidate.dataCollectionResults ? Object.entries(candidate.dataCollectionResults).map(([key, value]) => `${key.replace(/_/g, ' ')}: ${Array.isArray(value) ? value.join(', ') : value}`).join('\n') : 'No data available'}`)}
                  data-testid={`copy-data-collection-${candidate.id}`}
                >
                  <Copy className="h-3 w-3 mr-1" />Copy Data
                </Button>
              </div>
              <div className="bg-muted/50 rounded p-3 max-h-32 overflow-y-auto">
                {candidate.dataCollectionResults && Object.keys(candidate.dataCollectionResults).length > 0 ? (
                  <div className="space-y-2">
                    {getNestedProperty(candidate.dataCollectionResults, 'whyInsurance', 'why_insurance') && (
                      <div>
                        <div className="text-xs font-medium text-primary">Why Insurance:</div>
                        <div className="text-xs mt-1 pl-2 border-l-2 border-primary/20">{String(getNestedProperty(candidate.dataCollectionResults, 'whyInsurance', 'why_insurance')).substring(0, 100)}...</div>
                      </div>
                    )}
                    {getNestedProperty(candidate.dataCollectionResults, 'salesExperience', 'sales_experience') && (
                      <div>
                        <div className="text-xs font-medium text-primary">Sales Experience:</div>
                        <div className="text-xs mt-1 pl-2 border-l-2 border-primary/20">{String(getNestedProperty(candidate.dataCollectionResults, 'salesExperience', 'sales_experience')).substring(0, 100)}...</div>
                      </div>
                    )}
                    {getNestedProperty(candidate.dataCollectionResults, 'preferredMarkets', 'preferred_markets') && (
                      <div>
                        <div className="text-xs font-medium text-primary">Preferred Markets:</div>
                        <div className="text-xs mt-1 pl-2 border-l-2 border-primary/20">
                          {(() => {
                            const markets = getNestedProperty(candidate.dataCollectionResults, 'preferredMarkets', 'preferred_markets');
                            return Array.isArray(markets) ? markets.join(', ') : String(markets || '-');
                          })()}
                        </div>
                      </div>
                    )}
                    {getNestedProperty(candidate.dataCollectionResults, 'timeline', 'timeline') && (
                      <div>
                        <div className="text-xs font-medium text-primary">Timeline:</div>
                        <div className="text-xs mt-1 pl-2 border-l-2 border-primary/20">{String(getNestedProperty(candidate.dataCollectionResults, 'timeline', 'timeline'))}</div>
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap mt-2">
                      {getNestedProperty(candidate.dataCollectionResults, 'demoCallPerformed', 'demo_call_performed') && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Demo Call Done</span>
                      )}
                      {getNestedProperty(candidate.dataCollectionResults, 'coachingGiven', 'coaching_given') && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Coaching Given</span>
                      )}
                      {getNestedProperty(candidate.dataCollectionResults, 'pitchDelivered', 'pitch_delivered') && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Pitch Delivered</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-2">
                    No data collection results available
                  </div>
                )}
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

// Editable name cell with info button for details modal
function EditableNameCellWithInfo({ getValue, row, column, table, onShowDetails }: any) {
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

  const handleInfoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onShowDetails(row.original);
  };

  if (isEditing) {
    return (
      <Input
        value={value as string}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className="h-10 text-base bg-transparent border-accent"
        autoFocus
      />
    );
  }

  const displayValue = String(value || "—");
  const shouldShowTooltip = Boolean(displayValue && displayValue !== "—" && displayValue !== "-");
  const columnTitle = typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id;

  return (
    <div className="flex items-center space-x-2 min-w-0 group">
      <EnhancedTooltip
        content={displayValue}
        title={`${columnTitle}`}
        showCondition={shouldShowTooltip && (displayValue.length > 20 || (typeof displayValue === 'string' && displayValue.includes('\n')))}
        maxWidth="max-w-lg"
      >
        <div
          className="cursor-pointer hover:bg-accent/10 px-3 py-2 rounded min-h-12 flex items-center w-full min-w-0 flex-1"
          onClick={() => setIsEditing(true)}
          data-testid={`editable-name-${row.original.id}`}
        >
          <span className="text-base leading-relaxed truncate min-w-0 flex-1 group-hover:text-primary transition-colors">
            {displayValue}
          </span>
          {shouldShowTooltip && displayValue.length > 30 && (
            <Eye className="h-3 w-3 text-muted-foreground/50 ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </EnhancedTooltip>
      
      <EnhancedTooltip
        content="View comprehensive candidate details including interview transcripts, notes, and ElevenLabs data"
        title="Candidate Details"
        maxWidth="max-w-sm"
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 opacity-60 hover:opacity-100 hover:bg-primary/10 transition-all duration-200 flex-shrink-0"
          onClick={handleInfoClick}
          data-testid={`info-button-${row.original.id}`}
          aria-label={`View details for ${displayValue}`}
        >
          <Info className="h-4 w-4 text-primary" />
        </Button>
      </EnhancedTooltip>
    </div>
  );
}

// Editable score cell with number input and enhanced tooltips
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
        className="h-10 w-24 text-base bg-transparent border-accent"
        autoFocus
      />
    );
  }

  const score = value as number;
  const columnTitle = typeof column.columnDef.header === 'string' ? column.columnDef.header : 'Score';
  const scoreCategory = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : score >= 20 ? 'Poor' : 'Very Poor';
  
  const tooltipContent = `Score: ${score}%\nCategory: ${scoreCategory}\nClick to edit (0-100 range)`;

  return (
    <EnhancedTooltip
      content={tooltipContent}
      title={columnTitle}
      maxWidth="max-w-sm"
    >
      <div
        className="cursor-pointer hover:bg-accent/10 px-3 py-2 rounded min-h-12 flex items-center space-x-3 min-w-0 group"
        onClick={() => setIsEditing(true)}
        data-testid={`score-${column.id}-${row.original.id}`}
      >
        <div className="w-20 h-4 bg-muted rounded-full overflow-hidden flex-shrink-0 group-hover:bg-muted/80 transition-colors">
          <div 
            className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full transition-all duration-300"
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-base w-16 text-right flex-shrink-0 group-hover:text-primary transition-colors font-medium">{score}%</span>
        <Edit className="h-3 w-3 text-muted-foreground/50 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </EnhancedTooltip>
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

  // Use refs for stable access to current values without causing re-renders
  const dataRef = useRef<Candidate[]>([]);
  const filteredCandidatesRef = useRef<Candidate[]>([]);
  const currentFiltersRef = useRef<FilterOptions | null>(null);

  const { data: allCandidates = [], isLoading } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates"],
  });

  // Sync data state with query data
  useEffect(() => {
    setData(allCandidates);
    dataRef.current = allCandidates;
  }, [allCandidates]);

  // Update refs when state changes
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    filteredCandidatesRef.current = filteredCandidates;
  }, [filteredCandidates]);

  useEffect(() => {
    currentFiltersRef.current = currentFilters;
  }, [currentFilters]);

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
    const currentData = currentFiltersRef.current ? filteredCandidatesRef.current : dataRef.current;
    const candidate = currentData[rowIndex];
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
  }, []);

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
    const currentData = currentFiltersRef.current ? filteredCandidatesRef.current : dataRef.current;
    const candidateIds = currentData.map(c => c.id);
    setExpandedRows(new Set(candidateIds));
  }, []);

  // Collapse all rows
  const collapseAllRows = useCallback(() => {
    setExpandedRows(new Set());
  }, []);

  const columns = useMemo<ColumnDef<Candidate>[]>(
    () => [
      {
        id: "expand",
        header: () => (
          <div className="flex items-center space-x-2">
            <EnhancedTooltip 
              content="Expand all rows to show detailed information" 
              title="Expand/Collapse Toggle" 
              maxWidth="max-w-sm"
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0 hover:bg-accent/20"
                onClick={expandAllRows}
                data-testid="expand-all-toggle"
              >
                <Expand className="h-4 w-4" />
              </Button>
            </EnhancedTooltip>
          </div>
        ),
        cell: ({ row }) => (
          <EnhancedTooltip 
            content="Click to expand/collapse row details including notes, summaries, and technical information"
            title="Row Details Toggle" 
            maxWidth="max-w-sm"
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 p-0 hover:bg-accent/20"
              onClick={() => toggleRowExpansion(row.original.id)}
              data-testid={`expand-toggle-${row.original.id}`}
            >
              <ChevronRight className="h-4 w-4 transition-transform duration-200" />
            </Button>
          </EnhancedTooltip>
        ),
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
        cell: (props) => <EditableNameCellWithInfo {...props} onShowDetails={setDetailsCandidate} />,
        size: 320,
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ getValue, row, column, table }) => {
          const email = getValue() as string;
          
          return (
            <div className="flex items-center space-x-2 min-w-0">
              <div className="flex-1 min-w-0">
                <EditableCell getValue={getValue} row={row} column={column} table={table} />
              </div>
              {email && (
                <EnhancedTooltip content={`Send email to: ${email}`} title="Email Action" maxWidth="max-w-sm">
                  <a 
                    href={`mailto:${email}`}
                    className="text-blue-500 hover:text-blue-600 flex-shrink-0 p-1 rounded hover:bg-blue-50 transition-colors"
                    data-testid={`email-${row.original.id}`}
                  >
                    <Mail className="h-4 w-4" />
                  </a>
                </EnhancedTooltip>
              )}
            </div>
          );
        },
        size: 450,
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ getValue, row, column, table }) => {
          const phone = getValue() as string;
          return (
            <div className="flex items-center space-x-2 min-w-0">
              <div className="flex-1 min-w-0">
                <EditableCell getValue={getValue} row={row} column={column} table={table} />
              </div>
              {phone && (
                <EnhancedTooltip content={`Call: ${phone}`} title="Phone Action" maxWidth="max-w-sm">
                  <a 
                    href={`tel:${phone}`}
                    className="text-blue-500 hover:text-blue-600 flex-shrink-0 p-1 rounded hover:bg-blue-50 transition-colors"
                    data-testid={`phone-${row.original.id}`}
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                </EnhancedTooltip>
              )}
            </div>
          );
        },
        size: 280,
      },
      {
        accessorKey: "pipelineStage",
        header: "Pipeline Stage",
        cell: ({ row, table }) => {
          const stage = row.original.pipelineStage;
          const stageDescriptions = {
            'NEW': 'New candidate - recently added to the system',
            'FIRST_INTERVIEW': 'First Interview - initial screening completed',
            'TECHNICAL_SCREEN': 'In Slack - candidate moved to Slack channel',
            'FINAL_INTERVIEW': 'Final Interview - final evaluation stage',
            'OFFER': 'Offer - job offer has been extended',
            'HIRED': 'Hired - candidate has accepted and joined',
            'REJECTED': 'Rejected - candidate did not proceed'
          };
          const description = stageDescriptions[stage as keyof typeof stageDescriptions] || 'Unknown stage';
          
          return (
            <EnhancedTooltip
              content={`Stage: ${stage}\n${description}\n\nClick to change pipeline stage`}
              title="Pipeline Stage"
              maxWidth="max-w-sm"
            >
              <Select
                value={row.original.pipelineStage}
                onValueChange={(value) => {
                  table.options.meta?.updateData(row.index, 'pipelineStage', value);
                }}
              >
                <SelectTrigger className="glass-input text-base bg-transparent border-border h-10 w-full min-w-0 hover:bg-accent/10 transition-colors group" data-testid={`stage-select-${row.original.id}`}>
                  <SelectValue />
                  <ArrowUpDown className="h-3 w-3 text-muted-foreground/50 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="FIRST_INTERVIEW">First Interview</SelectItem>
                  <SelectItem value="TECHNICAL_SCREEN">In Slack</SelectItem>
                  <SelectItem value="FINAL_INTERVIEW">Final Interview</SelectItem>
                  <SelectItem value="OFFER">Offer</SelectItem>
                  <SelectItem value="HIRED">Hired</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </EnhancedTooltip>
          );
        },
        size: 300,
      },
      {
        accessorKey: "score",
        header: "Overall Score",
        cell: EditableScoreCell,
        size: 280,
      },
      {
        accessorKey: "sourceRef",
        header: "Source Reference",
        cell: ({ getValue, row, column, table }) => (
          <EditableCell getValue={getValue} row={row} column={column} table={table} />
        ),
        size: 250,
      },
      {
        accessorKey: "resumeUrl",
        header: "Resume URL",
        cell: ({ getValue, row }) => {
          const url = getValue() as string;
          return (
            <div className="flex items-center min-w-0">
              {url ? (
                <a 
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 text-base flex items-center min-w-0 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                  data-testid={`resume-url-${row.original.id}`}
                  title="Open resume"
                >
                  <FileUp className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate min-w-0">View Resume</span>
                </a>
              ) : (
                <span className="text-base text-muted-foreground px-2 py-1">-</span>
              )}
            </div>
          );
        },
        size: 250,
      },
      {
        accessorKey: "tags",
        header: "Tags",
        cell: ({ getValue }) => {
          const tags = (getValue() as string[]) || [];
          return (
            <div className="flex flex-wrap gap-1 min-w-0 py-1">
              {tags.length > 0 ? (
                tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs flex-shrink-0">
                    {tag}
                  </Badge>
                ))
              ) : (
                <span className="text-base text-muted-foreground px-2">-</span>
              )}
            </div>
          );
        },
        size: 250,
      },
      // === INTERVIEW COLUMNS ===
      {
        accessorKey: "notes",
        header: "Interview Notes",
        cell: ({ getValue, row, column, table }) => {
          const notes = getValue() as string;
          const displayText = notes && notes !== '-' ? notes : '-';
          const shouldShowTooltip = Boolean(displayText && displayText !== "—" && displayText !== "-");
          const columnTitle = typeof column.columnDef.header === 'string' ? column.columnDef.header : 'Interview Notes';
          
          return (
            <EnhancedTooltip
              content={displayText}
              title={columnTitle}
              showCondition={shouldShowTooltip && (displayText.length > 30 || displayText.includes('\n'))}
              maxWidth="max-w-lg"
            >
              <div className="max-w-xs cursor-help min-w-0 px-2 py-1 hover:bg-accent/10 rounded transition-colors group">
                <div className="text-base truncate min-w-0 group-hover:text-primary transition-colors">
                  {displayText}
                </div>
                {shouldShowTooltip && displayText.length > 30 && (
                  <Eye className="h-3 w-3 text-muted-foreground/50 ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </EnhancedTooltip>
          );
        },
        size: 350,
      },
      {
        accessorKey: "interviewSummary",
        header: "Interview Summary",
        cell: ({ getValue, row, column, table }) => {
          const summary = getValue() as string;
          const displayText = summary && summary !== '-' ? summary : '-';
          const shouldShowTooltip = Boolean(displayText && displayText !== "—" && displayText !== "-");
          const columnTitle = typeof column.columnDef.header === 'string' ? column.columnDef.header : 'Interview Summary';
          
          return (
            <EnhancedTooltip
              content={displayText}
              title={columnTitle}
              showCondition={shouldShowTooltip && (displayText.length > 30 || displayText.includes('\n'))}
              maxWidth="max-w-lg"
            >
              <div className="max-w-xs cursor-help min-w-0 px-2 py-1 hover:bg-accent/10 rounded transition-colors group">
                <div className="text-base truncate min-w-0 group-hover:text-primary transition-colors">
                  {displayText}
                </div>
                {shouldShowTooltip && displayText.length > 30 && (
                  <Eye className="h-3 w-3 text-muted-foreground/50 ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </EnhancedTooltip>
          );
        },
        size: 350,
      },
      {
        accessorKey: "interviewTranscript",
        header: "Interview Transcript",
        cell: ({ getValue, row, column, table }) => {
          const transcript = getValue() as string;
          const displayText = transcript && transcript !== '-' ? `${transcript.substring(0, 50)}...` : '-';
          const fullText = transcript || '-';
          const shouldShowTooltip = Boolean(fullText && fullText !== "—" && fullText !== "-");
          const columnTitle = typeof column.columnDef.header === 'string' ? column.columnDef.header : 'Interview Transcript';
          
          return (
            <EnhancedTooltip
              content={fullText}
              title={columnTitle}
              showCondition={shouldShowTooltip && fullText.length > 50}
              maxWidth="max-w-2xl"
            >
              <div className="max-w-xs cursor-help min-w-0 px-2 py-1 hover:bg-accent/10 rounded transition-colors group">
                <div className="text-base truncate min-w-0 group-hover:text-primary transition-colors">
                  {displayText}
                </div>
                {shouldShowTooltip && fullText.length > 50 && (
                  <Eye className="h-3 w-3 text-muted-foreground/50 ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </EnhancedTooltip>
          );
        },
        size: 400,
      },
      {
        accessorKey: "interviewDate",
        header: "Interview Date",
        cell: ({ getValue }) => {
          const value = getValue() as string;
          const date = value ? new Date(value) : null;
          return (
            <DateTooltip date={date} title="Interview Date">
              <div className="flex items-center space-x-2 min-w-0 px-2 py-1 hover:bg-accent/10 rounded transition-colors group cursor-help">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
                <span className="text-base min-w-0 truncate group-hover:text-primary transition-colors">
                  {date ? date.toLocaleDateString() : '-'}
                </span>
              </div>
            </DateTooltip>
          );
        },
        size: 180,
      },
      // === CALL COLUMNS ===
      {
        accessorKey: "callDuration",
        header: "Call Duration",
        cell: ({ getValue }) => {
          const duration = getValue() as number;
          return (
            <div className="flex items-center space-x-2 min-w-0 px-2 py-1">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-base min-w-0 truncate">{formatCallDuration(duration)}</span>
            </div>
          );
        },
        size: 180,
      },
      {
        accessorKey: "messageCount",
        header: "Message Count",
        cell: ({ getValue, row, column, table }) => (
          <EditableCell getValue={getValue} row={row} column={column} table={table} />
        ),
        size: 150,
      },
      {
        accessorKey: "callStatus",
        header: "Call Status",
        cell: ({ getValue, row, column, table }) => (
          <EditableCell getValue={getValue} row={row} column={column} table={table} />
        ),
        size: 180,
      },
      {
        accessorKey: "callSummaryTitle",
        header: "Call Summary Title",
        cell: ({ getValue, row, column, table }) => (
          <EditableCell getValue={getValue} row={row} column={column} table={table} />
        ),
        size: 350,
      },
      // === DATA COLUMNS ===
      {
        accessorKey: "evaluationCriteria",
        header: "Evaluation Criteria",
        cell: ({ getValue }) => {
          const criteria = getValue() as any;
          if (!criteria || (typeof criteria === 'object' && Object.keys(criteria).length === 0)) {
            return (
              <div className="max-w-xs min-w-0 px-2 py-1 rounded">
                <div className="text-base text-sm truncate min-w-0 flex items-center text-muted-foreground">
                  <Database className="h-3 w-3 mr-2 flex-shrink-0" />
                  <span>No Criteria</span>
                </div>
              </div>
            );
          }
          
          // Extract key metrics for display
          const scores = [
            criteria.communication_score && `Communication: ${criteria.communication_score}`,
            criteria.sales_aptitude_score && `Sales: ${criteria.sales_aptitude_score}`,
            criteria.overall_score && `Overall: ${criteria.overall_score}`
          ].filter(Boolean);
          
          const displayText = scores.length > 0 ? scores.join(' • ') : 'Multiple Criteria';
          
          return (
            <EvaluationCriteriaTooltip data={criteria} title="Evaluation Criteria">
              <div className="max-w-xs cursor-help min-w-0 px-2 py-1 hover:bg-accent/10 rounded transition-colors group">
                <div className="text-base text-sm truncate min-w-0 flex items-center">
                  <Database className="h-3 w-3 text-muted-foreground/50 mr-2 flex-shrink-0" />
                  <span className="group-hover:text-primary transition-colors">{displayText}</span>
                </div>
              </div>
            </EvaluationCriteriaTooltip>
          );
        },
        size: 320,
      },
      {
        accessorKey: "dataCollectionResults",
        header: "Data Collection Results",
        cell: ({ getValue }) => {
          const results = getValue() as any;
          if (!results || (typeof results === 'object' && Object.keys(results).length === 0)) {
            return (
              <div className="max-w-xs min-w-0 px-2 py-1 rounded">
                <div className="text-base text-sm truncate min-w-0 flex items-center text-muted-foreground">
                  <BarChart3 className="h-3 w-3 mr-2 flex-shrink-0" />
                  <span>No Results</span>
                </div>
              </div>
            );
          }
          
          // Extract key data points for display
          const keyData = [
            results.why_insurance && 'Insurance Interest',
            results.sales_experience && 'Sales Experience',
            results.preferred_markets && 'Market Preferences',
            results.timeline && 'Timeline'
          ].filter(Boolean);
          
          const displayText = keyData.length > 0 ? keyData.join(' • ') : 'Interview Results';
          
          return (
            <DataCollectionResultsTooltip data={results} title="Data Collection Results">
              <div className="max-w-xs cursor-help min-w-0 px-2 py-1 hover:bg-accent/10 rounded transition-colors group">
                <div className="text-base text-sm truncate min-w-0 flex items-center">
                  <BarChart3 className="h-3 w-3 text-muted-foreground/50 mr-2 flex-shrink-0" />
                  <span className="group-hover:text-primary transition-colors">{displayText}</span>
                </div>
              </div>
            </DataCollectionResultsTooltip>
          );
        },
        size: 320,
      },
      {
        accessorKey: "interviewData",
        header: "Interview Data",
        cell: ({ getValue }) => {
          const data = getValue() as any;
          if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
            return (
              <div className="max-w-xs min-w-0 px-2 py-1 rounded">
                <div className="text-base text-sm truncate min-w-0 flex items-center text-muted-foreground">
                  <ClipboardList className="h-3 w-3 mr-2 flex-shrink-0" />
                  <span>No Interview Data</span>
                </div>
              </div>
            );
          }
          
          // Extract key interview info for display
          const keyInfo = [
            data.agent_name && `Agent: ${data.agent_name}`,
            data.duration && `Duration: ${data.duration}`,
            data.call_successful !== undefined && (data.call_successful ? 'Successful' : 'Failed'),
            data.message_count && `${data.message_count} msgs`
          ].filter(Boolean);
          
          const displayText = keyInfo.length > 0 ? keyInfo.join(' • ') : 'Interview Available';
          
          return (
            <InterviewDataTooltip data={data} title="Interview Data">
              <div className="max-w-xs cursor-help min-w-0 px-2 py-1 hover:bg-accent/10 rounded transition-colors group">
                <div className="text-base text-sm truncate min-w-0 flex items-center">
                  <ClipboardList className="h-3 w-3 text-muted-foreground/50 mr-2 flex-shrink-0" />
                  <span className="group-hover:text-primary transition-colors">{displayText}</span>
                </div>
              </div>
            </InterviewDataTooltip>
          );
        },
        size: 320,
      },
      // === TIMESTAMPS ===
      {
        accessorKey: "createdAt",
        header: "Created At",
        cell: ({ getValue }) => {
          const value = getValue() as string;
          const date = value ? new Date(value) : null;
          return (
            <DateTooltip date={date} title="Created At">
              <div className="flex items-center space-x-2 min-w-0 px-2 py-1 hover:bg-accent/10 rounded transition-colors group cursor-help">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
                <span className="text-base min-w-0 truncate group-hover:text-primary transition-colors">
                  {date ? date.toLocaleDateString() : '-'}
                </span>
              </div>
            </DateTooltip>
          );
        },
        size: 180,
      },
    ],
    []
  );

  // Use filtered candidates for table data, or all candidates if no filters applied
  const tableData = currentFilters ? filteredCandidates : data;

  // Memoize table meta to prevent recreation on every render
  const tableMeta = useMemo(() => ({
    updateData,
  }), [updateData]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    meta: tableMeta,
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
    <TooltipProvider>
      <Card className="glass-panel rounded-lg overflow-hidden font-serif">
      {/* Grid Header */}
      <div className="grid-header p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h3 className="enterprise-heading text-lg font-semibold">Candidate Database</h3>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-muted-foreground" data-testid="total-candidates">
              {(allCandidates || []).length.toLocaleString()} candidates
            </span>
            <EnhancedTooltip content="Show/hide advanced search and filtering options" title="Filter Toggle" maxWidth="max-w-sm">
              <Button
                variant="ghost"
                size="sm"
                className="glass-input px-3 py-1 rounded-lg text-sm glow-hover"
                onClick={() => setShowFilters(!showFilters)}
                data-testid="filter-button"
              >
                <i className="fas fa-filter mr-2"></i>Filter
              </Button>
            </EnhancedTooltip>
            <EnhancedTooltip content="Export candidate data to CSV file for external analysis" title="Export Data" maxWidth="max-w-sm">
              <Button
                variant="ghost"
                size="sm"
                className="glass-input px-3 py-1 rounded-lg text-sm glow-hover"
                onClick={() => setShowExportDialog(true)}
                data-testid="export-csv-button"
              >
                <i className="fas fa-download mr-2"></i>Export CSV
              </Button>
            </EnhancedTooltip>
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
                  className="flex items-center justify-start px-4 py-3 text-base font-bold text-foreground border-r border-accent/20 last:border-r-0 font-serif tracking-wide"
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
                    <div className="flex min-h-16">
                      {row.getVisibleCells().map((cell) => (
                        <div
                          key={cell.id}
                          className="flex items-center px-4 py-2 border-r border-accent/10 last:border-r-0 overflow-hidden font-serif"
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

      {/* Comprehensive ElevenLabs Details Modal */}
      {detailsCandidate && (
        <Dialog open={!!detailsCandidate} onOpenChange={() => setDetailsCandidate(null)}>
          <DialogContent className="max-w-7xl max-h-[95vh] w-[98vw] h-[95vh] overflow-hidden p-0">
            <DialogHeader className="p-6 border-b border-border bg-gradient-to-r from-primary/5 to-secondary/5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    Comprehensive Candidate Analysis - {detailsCandidate.name}
                  </DialogTitle>
                  <DialogDescription className="text-base text-muted-foreground flex items-center space-x-4">
                    <span>Complete ElevenLabs interview evaluation and metrics dashboard</span>
                    <Badge variant="outline" className="ml-2">
                      {detailsCandidate.pipelineStage}
                    </Badge>
                    {detailsCandidate.overallScore !== null && detailsCandidate.overallScore !== undefined && (
                      <Badge variant={((detailsCandidate.overallScore ?? 0) >= 80) ? "default" : ((detailsCandidate.overallScore ?? 0) >= 60) ? "secondary" : "destructive"} className="ml-2">
                        {detailsCandidate.overallScore}% Overall
                      </Badge>
                    )}
                  </DialogDescription>
                </div>
                <div className="flex items-center space-x-2">
                  {detailsCandidate.audioRecordingUrl && (
                    <Badge variant="secondary" className="flex items-center space-x-1">
                      <span>🎵</span>
                      <span>Audio Available</span>
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(`${detailsCandidate.name} - ${detailsCandidate.email} - Overall Score: ${detailsCandidate.overallScore || 'N/A'}%`)}
                    data-testid="copy-candidate-summary"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Summary
                  </Button>
                </div>
              </div>
            </DialogHeader>
            
            <div className="flex-1 overflow-hidden">
              <Tabs defaultValue="interview-analysis" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-8 mx-6 mt-4 bg-muted/50">
                  <TabsTrigger value="interview-analysis" className="text-xs" data-testid="tab-interview-analysis">
                    <ClipboardList className="h-3 w-3 mr-1" />
                    Interview
                  </TabsTrigger>
                  <TabsTrigger value="performance-scores" className="text-xs" data-testid="tab-performance-scores">
                    <BarChart3 className="h-3 w-3 mr-1" />
                    Scores
                  </TabsTrigger>
                  <TabsTrigger value="market-preferences" className="text-xs" data-testid="tab-market-preferences">
                    <Settings className="h-3 w-3 mr-1" />
                    Markets
                  </TabsTrigger>
                  <TabsTrigger value="demo-coaching" className="text-xs" data-testid="tab-demo-coaching">
                    <User className="h-3 w-3 mr-1" />
                    Demo/Coach
                  </TabsTrigger>
                  <TabsTrigger value="development" className="text-xs" data-testid="tab-development">
                    <Calendar className="h-3 w-3 mr-1" />
                    Development
                  </TabsTrigger>
                  <TabsTrigger value="transcript" className="text-xs" data-testid="tab-transcript">
                    <FileText className="h-3 w-3 mr-1" />
                    Transcript
                  </TabsTrigger>
                  <TabsTrigger value="structured-data" className="text-xs" data-testid="tab-structured-data">
                    <Database className="h-3 w-3 mr-1" />
                    Data
                  </TabsTrigger>
                  <TabsTrigger value="technical" className="text-xs" data-testid="tab-technical">
                    <Settings className="h-3 w-3 mr-1" />
                    Technical
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-hidden px-6 pb-6">
                  {/* Interview Analysis Tab */}
                  <TabsContent value="interview-analysis" className="h-full mt-4" data-testid="content-interview-analysis">
                    <ScrollArea className="h-full w-full">
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Why Insurance */}
                          <Card className="p-6 border-2 border-primary/10 hover:border-primary/20 transition-colors">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-primary flex items-center">
                                <StickyNote className="h-5 w-5 mr-2" />
                                Why Insurance?
                              </h3>
                              {detailsCandidate.whyInsurance && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigator.clipboard.writeText(detailsCandidate.whyInsurance || '')}
                                  data-testid="copy-why-insurance"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <div className="bg-muted/30 rounded-lg p-4 min-h-[120px] flex items-center">
                              {detailsCandidate.whyInsurance ? (
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                  {detailsCandidate.whyInsurance}
                                </p>
                              ) : (
                                <div className="text-center w-full text-muted-foreground">
                                  <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">Not Available</p>
                                </div>
                              )}
                            </div>
                          </Card>

                          {/* Why Now */}
                          <Card className="p-6 border-2 border-secondary/10 hover:border-secondary/20 transition-colors">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-secondary flex items-center">
                                <Clock className="h-5 w-5 mr-2" />
                                Why Now?
                              </h3>
                              {detailsCandidate.whyNow && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigator.clipboard.writeText(detailsCandidate.whyNow || '')}
                                  data-testid="copy-why-now"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <div className="bg-muted/30 rounded-lg p-4 min-h-[120px] flex items-center">
                              {detailsCandidate.whyNow ? (
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                  {detailsCandidate.whyNow}
                                </p>
                              ) : (
                                <div className="text-center w-full text-muted-foreground">
                                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">Not Available</p>
                                </div>
                              )}
                            </div>
                          </Card>

                          {/* Sales Experience */}
                          <Card className="p-6 border-2 border-accent/10 hover:border-accent/20 transition-colors lg:col-span-2">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-accent-foreground flex items-center">
                                <User className="h-5 w-5 mr-2" />
                                Sales Experience
                              </h3>
                              {detailsCandidate.salesExperience && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigator.clipboard.writeText(detailsCandidate.salesExperience || '')}
                                  data-testid="copy-sales-experience"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <div className="bg-muted/30 rounded-lg p-4 min-h-[120px] flex items-center">
                              {detailsCandidate.salesExperience ? (
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                  {detailsCandidate.salesExperience}
                                </p>
                              ) : (
                                <div className="text-center w-full text-muted-foreground">
                                  <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">Not Available</p>
                                </div>
                              )}
                            </div>
                          </Card>

                          {/* Difficult Customer Story */}
                          <Card className="p-6 border-2 border-destructive/10 hover:border-destructive/20 transition-colors lg:col-span-2">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-destructive flex items-center">
                                <XCircle className="h-5 w-5 mr-2" />
                                Difficult Customer Story
                              </h3>
                              {detailsCandidate.difficultCustomerStory && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigator.clipboard.writeText(detailsCandidate.difficultCustomerStory || '')}
                                  data-testid="copy-difficult-customer"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <div className="bg-muted/30 rounded-lg p-4 min-h-[120px] flex items-center">
                              {detailsCandidate.difficultCustomerStory ? (
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                  {detailsCandidate.difficultCustomerStory}
                                </p>
                              ) : (
                                <div className="text-center w-full text-muted-foreground">
                                  <XCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">Not Available</p>
                                </div>
                              )}
                            </div>
                          </Card>

                          {/* Consultative Selling */}
                          <Card className="p-6 border-2 border-green-200 hover:border-green-300 transition-colors lg:col-span-2">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-green-700 flex items-center">
                                <CheckCircle className="h-5 w-5 mr-2" />
                                Consultative Selling Approach
                              </h3>
                              {detailsCandidate.consultativeSelling && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigator.clipboard.writeText(detailsCandidate.consultativeSelling || '')}
                                  data-testid="copy-consultative-selling"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <div className="bg-muted/30 rounded-lg p-4 min-h-[120px] flex items-center">
                              {detailsCandidate.consultativeSelling ? (
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                  {detailsCandidate.consultativeSelling}
                                </p>
                              ) : (
                                <div className="text-center w-full text-muted-foreground">
                                  <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">Not Available</p>
                                </div>
                              )}
                            </div>
                          </Card>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                          <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200">
                            <div className="text-center">
                              <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Interview Summary</h4>
                              <p className="text-sm text-blue-600 dark:text-blue-300">
                                {detailsCandidate.interviewSummary ? 'Available' : 'Not Available'}
                              </p>
                            </div>
                          </Card>
                          <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
                            <div className="text-center">
                              <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">Call Summary</h4>
                              <p className="text-sm text-green-600 dark:text-green-300">
                                {detailsCandidate.callSummaryTitle ? 'Available' : 'Not Available'}
                              </p>
                            </div>
                          </Card>
                          <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200">
                            <div className="text-center">
                              <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">Interview Notes</h4>
                              <p className="text-sm text-purple-600 dark:text-purple-300">
                                {detailsCandidate.notes ? 'Available' : 'Not Available'}
                              </p>
                            </div>
                          </Card>
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Performance Scores Tab */}
                  <TabsContent value="performance-scores" className="h-full mt-4" data-testid="content-performance-scores">
                    <ScrollArea className="h-full w-full">
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Overall Score */}
                          <Card className="p-6 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                            <div className="text-center space-y-4">
                              <h3 className="text-2xl font-bold text-primary">Overall Score</h3>
                              <div className="relative w-32 h-32 mx-auto">
                                <div className="absolute inset-0 rounded-full border-8 border-muted"></div>
                                <div 
                                  className="absolute inset-0 rounded-full border-8 border-primary transform -rotate-90 origin-center"
                                  style={{
                                    clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.cos(2 * Math.PI * ((detailsCandidate.overallScore ?? 0) as number) / 100 - Math.PI/2)}% ${50 + 50 * Math.sin(2 * Math.PI * ((detailsCandidate.overallScore ?? 0) as number) / 100 - Math.PI/2)}%, 50% 0%)`
                                  }}
                                ></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-3xl font-bold text-primary">{detailsCandidate.overallScore ?? 0}%</span>
                                </div>
                              </div>
                              <Badge variant={((detailsCandidate.overallScore ?? 0) >= 80) ? "default" : ((detailsCandidate.overallScore ?? 0) >= 60) ? "secondary" : "destructive"} className="text-base px-4 py-1">
                                {((detailsCandidate.overallScore ?? 0) >= 80) ? 'Excellent' : ((detailsCandidate.overallScore ?? 0) >= 60) ? 'Good' : ((detailsCandidate.overallScore ?? 0) >= 40) ? 'Fair' : 'Needs Improvement'}
                              </Badge>
                            </div>
                          </Card>

                          {/* Score Breakdown */}
                          <div className="space-y-4">
                            {/* Communication Score */}
                            <Card className="p-4 border border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-blue-800 dark:text-blue-200 flex items-center">
                                  <Mail className="h-4 w-4 mr-2" />
                                  Communication
                                </h4>
                                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{detailsCandidate.communicationScore || 0}%</span>
                              </div>
                              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-3 overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
                                  style={{ width: `${detailsCandidate.communicationScore || 0}%` }}
                                ></div>
                              </div>
                            </Card>

                            {/* Sales Aptitude Score */}
                            <Card className="p-4 border border-green-200 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-green-800 dark:text-green-200 flex items-center">
                                  <BarChart3 className="h-4 w-4 mr-2" />
                                  Sales Aptitude
                                </h4>
                                <span className="text-lg font-bold text-green-600 dark:text-green-400">{detailsCandidate.salesAptitudeScore || 0}%</span>
                              </div>
                              <div className="w-full bg-green-200 dark:bg-green-800 rounded-full h-3 overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-500"
                                  style={{ width: `${detailsCandidate.salesAptitudeScore || 0}%` }}
                                ></div>
                              </div>
                            </Card>

                            {/* Motivation Score */}
                            <Card className="p-4 border border-yellow-200 bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 flex items-center">
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Motivation
                                </h4>
                                <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{detailsCandidate.motivationScore || 0}%</span>
                              </div>
                              <div className="w-full bg-yellow-200 dark:bg-yellow-800 rounded-full h-3 overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full transition-all duration-500"
                                  style={{ width: `${detailsCandidate.motivationScore || 0}%` }}
                                ></div>
                              </div>
                            </Card>

                            {/* Coachability Score */}
                            <Card className="p-4 border border-purple-200 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-purple-800 dark:text-purple-200 flex items-center">
                                  <User className="h-4 w-4 mr-2" />
                                  Coachability
                                </h4>
                                <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{detailsCandidate.coachabilityScore || 0}%</span>
                              </div>
                              <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-3 overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full transition-all duration-500"
                                  style={{ width: `${detailsCandidate.coachabilityScore || 0}%` }}
                                ></div>
                              </div>
                            </Card>

                            {/* Professional Presence Score */}
                            <Card className="p-4 border border-indigo-200 bg-gradient-to-r from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-indigo-800 dark:text-indigo-200 flex items-center">
                                  <Settings className="h-4 w-4 mr-2" />
                                  Professional Presence
                                </h4>
                                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{detailsCandidate.professionalPresenceScore || 0}%</span>
                              </div>
                              <div className="w-full bg-indigo-200 dark:bg-indigo-800 rounded-full h-3 overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full transition-all duration-500"
                                  style={{ width: `${detailsCandidate.professionalPresenceScore || 0}%` }}
                                ></div>
                              </div>
                            </Card>
                          </div>
                        </div>

                        {/* Score Summary */}
                        <Card className="p-6 border-2 border-muted bg-gradient-to-r from-muted/20 to-muted/30">
                          <h3 className="text-lg font-semibold mb-4 text-center">Performance Analysis Summary</h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="text-center p-3 rounded-lg bg-background/50">
                              <p className="text-sm text-muted-foreground">Highest Score</p>
                              <p className="text-lg font-bold text-primary">
                                {Math.max(
                                  detailsCandidate.communicationScore || 0,
                                  detailsCandidate.salesAptitudeScore || 0,
                                  detailsCandidate.motivationScore || 0,
                                  detailsCandidate.coachabilityScore || 0,
                                  detailsCandidate.professionalPresenceScore || 0
                                )}%
                              </p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-background/50">
                              <p className="text-sm text-muted-foreground">Average Score</p>
                              <p className="text-lg font-bold text-secondary">
                                {Math.round([
                                  detailsCandidate.communicationScore || 0,
                                  detailsCandidate.salesAptitudeScore || 0,
                                  detailsCandidate.motivationScore || 0,
                                  detailsCandidate.coachabilityScore || 0,
                                  detailsCandidate.professionalPresenceScore || 0
                                ].reduce((a, b) => a + b, 0) / 5)}%
                              </p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-background/50">
                              <p className="text-sm text-muted-foreground">Score Count</p>
                              <p className="text-lg font-bold text-accent-foreground">
                                {[
                                  detailsCandidate.communicationScore,
                                  detailsCandidate.salesAptitudeScore,
                                  detailsCandidate.motivationScore,
                                  detailsCandidate.coachabilityScore,
                                  detailsCandidate.professionalPresenceScore
                                ].filter(score => score !== null && score !== undefined).length}/5
                              </p>
                            </div>
                          </div>
                        </Card>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Market Preferences Tab */}
                  <TabsContent value="market-preferences" className="h-full mt-4" data-testid="content-market-preferences">
                    <ScrollArea className="h-full w-full">
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Preferred Markets */}
                          <Card className="p-6 border-2 border-green-200 hover:border-green-300 transition-colors">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-green-700 flex items-center">
                                <Settings className="h-5 w-5 mr-2" />
                                Preferred Markets
                              </h3>
                              {detailsCandidate.preferredMarkets && detailsCandidate.preferredMarkets.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigator.clipboard.writeText((detailsCandidate.preferredMarkets || []).join(', '))}
                                  data-testid="copy-preferred-markets"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <div className="min-h-[120px] flex items-center">
                              {detailsCandidate.preferredMarkets && detailsCandidate.preferredMarkets.length > 0 ? (
                                <div className="flex flex-wrap gap-2 w-full">
                                  {detailsCandidate.preferredMarkets.map((market, index) => (
                                    <Badge key={index} variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200 transition-colors text-sm px-3 py-1">
                                      {market}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center w-full text-muted-foreground">
                                  <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">No preferred markets specified</p>
                                </div>
                              )}
                            </div>
                          </Card>

                          {/* Timeline */}
                          <Card className="p-6 border-2 border-blue-200 hover:border-blue-300 transition-colors">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-blue-700 flex items-center">
                                <Calendar className="h-5 w-5 mr-2" />
                                Timeline
                              </h3>
                              {detailsCandidate.timeline && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigator.clipboard.writeText(detailsCandidate.timeline || '')}
                                  data-testid="copy-timeline"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 min-h-[120px] flex items-center">
                              {detailsCandidate.timeline ? (
                                <p className="text-sm leading-relaxed whitespace-pre-wrap text-blue-800 dark:text-blue-200">
                                  {detailsCandidate.timeline}
                                </p>
                              ) : (
                                <div className="text-center w-full text-muted-foreground">
                                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">No timeline specified</p>
                                </div>
                              )}
                            </div>
                          </Card>
                        </div>

                        {/* Recommended Next Steps */}
                        <Card className="p-6 border-2 border-purple-200 hover:border-purple-300 transition-colors">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-purple-700 flex items-center">
                              <ClipboardList className="h-5 w-5 mr-2" />
                              Recommended Next Steps
                            </h3>
                            {detailsCandidate.recommendedNextSteps && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigator.clipboard.writeText(detailsCandidate.recommendedNextSteps || '')}
                                data-testid="copy-next-steps"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-4 min-h-[120px] flex items-center">
                            {detailsCandidate.recommendedNextSteps ? (
                              <p className="text-sm leading-relaxed whitespace-pre-wrap text-purple-800 dark:text-purple-200">
                                {detailsCandidate.recommendedNextSteps}
                              </p>
                            ) : (
                              <div className="text-center w-full text-muted-foreground">
                                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No next steps recommended</p>
                              </div>
                            )}
                          </div>
                        </Card>

                        {/* Market Analysis Summary */}
                        <Card className="p-6 border-2 border-muted bg-gradient-to-r from-muted/20 to-muted/30">
                          <h3 className="text-lg font-semibold mb-4 text-center">Market Preferences Summary</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="text-center p-3 rounded-lg bg-background/50">
                              <p className="text-sm text-muted-foreground">Preferred Markets</p>
                              <p className="text-lg font-bold text-primary">
                                {detailsCandidate.preferredMarkets?.length || 0}
                              </p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-background/50">
                              <p className="text-sm text-muted-foreground">Timeline Status</p>
                              <p className="text-lg font-bold text-secondary">
                                {detailsCandidate.timeline ? 'Defined' : 'Not Set'}
                              </p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-background/50">
                              <p className="text-sm text-muted-foreground">Next Steps</p>
                              <p className="text-lg font-bold text-accent-foreground">
                                {detailsCandidate.recommendedNextSteps ? 'Planned' : 'Pending'}
                              </p>
                            </div>
                          </div>
                        </Card>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Demo & Coaching Tab */}
                  <TabsContent value="demo-coaching" className="h-full mt-4" data-testid="content-demo-coaching">
                    <ScrollArea className="h-full w-full">
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Demo Call Performed */}
                          <Card className="p-6 border-2 hover:shadow-lg transition-all">
                            <div className="text-center space-y-4">
                              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${
                                detailsCandidate.demoCallPerformed 
                                  ? 'bg-green-100 text-green-600 border-2 border-green-300' 
                                  : 'bg-red-100 text-red-600 border-2 border-red-300'
                              }`}>
                                {detailsCandidate.demoCallPerformed ? (
                                  <CheckCircle className="h-8 w-8" />
                                ) : (
                                  <XCircle className="h-8 w-8" />
                                )}
                              </div>
                              <h3 className="text-lg font-semibold">Demo Call</h3>
                              <Badge variant={detailsCandidate.demoCallPerformed ? "default" : "destructive"} className="text-base px-4 py-1">
                                {detailsCandidate.demoCallPerformed ? 'Performed' : 'Not Performed'}
                              </Badge>
                            </div>
                          </Card>

                          {/* Kevin Persona Used */}
                          <Card className="p-6 border-2 hover:shadow-lg transition-all">
                            <div className="text-center space-y-4">
                              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${
                                detailsCandidate.kevinPersonaUsed 
                                  ? 'bg-blue-100 text-blue-600 border-2 border-blue-300' 
                                  : 'bg-gray-100 text-gray-600 border-2 border-gray-300'
                              }`}>
                                <User className="h-8 w-8" />
                              </div>
                              <h3 className="text-lg font-semibold">Kevin Persona</h3>
                              <Badge variant={detailsCandidate.kevinPersonaUsed ? "default" : "secondary"} className="text-base px-4 py-1">
                                {detailsCandidate.kevinPersonaUsed ? 'Used' : 'Not Used'}
                              </Badge>
                            </div>
                          </Card>

                          {/* Coaching Given */}
                          <Card className="p-6 border-2 hover:shadow-lg transition-all">
                            <div className="text-center space-y-4">
                              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${
                                detailsCandidate.coachingGiven 
                                  ? 'bg-purple-100 text-purple-600 border-2 border-purple-300' 
                                  : 'bg-gray-100 text-gray-600 border-2 border-gray-300'
                              }`}>
                                <ClipboardList className="h-8 w-8" />
                              </div>
                              <h3 className="text-lg font-semibold">Coaching</h3>
                              <Badge variant={detailsCandidate.coachingGiven ? "default" : "secondary"} className="text-base px-4 py-1">
                                {detailsCandidate.coachingGiven ? 'Provided' : 'Not Provided'}
                              </Badge>
                            </div>
                          </Card>

                          {/* Pitch Delivered */}
                          <Card className="p-6 border-2 hover:shadow-lg transition-all">
                            <div className="text-center space-y-4">
                              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${
                                detailsCandidate.pitchDelivered 
                                  ? 'bg-orange-100 text-orange-600 border-2 border-orange-300' 
                                  : 'bg-gray-100 text-gray-600 border-2 border-gray-300'
                              }`}>
                                <StickyNote className="h-8 w-8" />
                              </div>
                              <h3 className="text-lg font-semibold">Pitch</h3>
                              <Badge variant={detailsCandidate.pitchDelivered ? "default" : "secondary"} className="text-base px-4 py-1">
                                {detailsCandidate.pitchDelivered ? 'Delivered' : 'Not Delivered'}
                              </Badge>
                            </div>
                          </Card>
                        </div>

                        {/* Performance Indicators Summary */}
                        <Card className="p-6 border-2 border-muted bg-gradient-to-r from-muted/20 to-muted/30">
                          <h3 className="text-lg font-semibold mb-4 text-center">Performance Indicators Summary</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-3 rounded-lg bg-background/50">
                              <p className="text-sm text-muted-foreground">Demo Call</p>
                              <p className={`text-lg font-bold ${
                                detailsCandidate.demoCallPerformed ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {detailsCandidate.demoCallPerformed ? '✓' : '✗'}
                              </p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-background/50">
                              <p className="text-sm text-muted-foreground">Kevin Persona</p>
                              <p className={`text-lg font-bold ${
                                detailsCandidate.kevinPersonaUsed ? 'text-blue-600' : 'text-gray-600'
                              }`}>
                                {detailsCandidate.kevinPersonaUsed ? '✓' : '✗'}
                              </p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-background/50">
                              <p className="text-sm text-muted-foreground">Coaching</p>
                              <p className={`text-lg font-bold ${
                                detailsCandidate.coachingGiven ? 'text-purple-600' : 'text-gray-600'
                              }`}>
                                {detailsCandidate.coachingGiven ? '✓' : '✗'}
                              </p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-background/50">
                              <p className="text-sm text-muted-foreground">Pitch</p>
                              <p className={`text-lg font-bold ${
                                detailsCandidate.pitchDelivered ? 'text-orange-600' : 'text-gray-600'
                              }`}>
                                {detailsCandidate.pitchDelivered ? '✓' : '✗'}
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 text-center">
                            <p className="text-sm text-muted-foreground">Completion Rate</p>
                            <p className="text-2xl font-bold text-primary">
                              {Math.round([
                                detailsCandidate.demoCallPerformed,
                                detailsCandidate.kevinPersonaUsed,
                                detailsCandidate.coachingGiven,
                                detailsCandidate.pitchDelivered
                              ].filter(Boolean).length / 4 * 100)}%
                            </p>
                          </div>
                        </Card>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Development Tab */}
                  <TabsContent value="development" className="h-full mt-4" data-testid="content-development">
                    <ScrollArea className="h-full w-full">
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Strengths */}
                          <Card className="p-6 border-2 border-green-200 hover:border-green-300 transition-colors">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-green-700 flex items-center">
                                <CheckCircle className="h-5 w-5 mr-2" />
                                Strengths
                              </h3>
                              {detailsCandidate.strengths && detailsCandidate.strengths.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigator.clipboard.writeText((detailsCandidate.strengths || []).join('\n• '))}
                                  data-testid="copy-strengths"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <div className="min-h-[200px] flex items-start">
                              {detailsCandidate.strengths && detailsCandidate.strengths.length > 0 ? (
                                <ul className="space-y-3 w-full">
                                  {detailsCandidate.strengths.map((strength, index) => (
                                    <li key={index} className="flex items-start space-x-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                                      <span className="text-sm text-green-800 dark:text-green-200 leading-relaxed">{strength}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-center w-full text-muted-foreground">
                                  <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">No strengths identified</p>
                                </div>
                              )}
                            </div>
                          </Card>

                          {/* Development Areas */}
                          <Card className="p-6 border-2 border-orange-200 hover:border-orange-300 transition-colors">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-orange-700 flex items-center">
                                <ClipboardList className="h-5 w-5 mr-2" />
                                Development Areas
                              </h3>
                              {detailsCandidate.developmentAreas && detailsCandidate.developmentAreas.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigator.clipboard.writeText((detailsCandidate.developmentAreas || []).join('\n• '))}
                                  data-testid="copy-development-areas"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <div className="min-h-[200px] flex items-start">
                              {detailsCandidate.developmentAreas && detailsCandidate.developmentAreas.length > 0 ? (
                                <ul className="space-y-3 w-full">
                                  {detailsCandidate.developmentAreas.map((area, index) => (
                                    <li key={index} className="flex items-start space-x-3 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                                      <ClipboardList className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                                      <span className="text-sm text-orange-800 dark:text-orange-200 leading-relaxed">{area}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-center w-full text-muted-foreground">
                                  <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">No development areas identified</p>
                                </div>
                              )}
                            </div>
                          </Card>
                        </div>

                        {/* Development Plan Summary */}
                        <Card className="p-6 border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                          <h3 className="text-lg font-semibold mb-4 text-blue-800 dark:text-blue-200 text-center">Development Plan Overview</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="text-center p-4 rounded-lg bg-white/50 dark:bg-blue-900/50">
                              <div className="text-2xl font-bold text-green-600 mb-1">
                                {detailsCandidate.strengths?.length || 0}
                              </div>
                              <p className="text-sm text-muted-foreground">Identified Strengths</p>
                            </div>
                            <div className="text-center p-4 rounded-lg bg-white/50 dark:bg-blue-900/50">
                              <div className="text-2xl font-bold text-orange-600 mb-1">
                                {detailsCandidate.developmentAreas?.length || 0}
                              </div>
                              <p className="text-sm text-muted-foreground">Development Areas</p>
                            </div>
                            <div className="text-center p-4 rounded-lg bg-white/50 dark:bg-blue-900/50">
                              <div className="text-2xl font-bold text-blue-600 mb-1">
                                {(detailsCandidate.strengths?.length || 0) + (detailsCandidate.developmentAreas?.length || 0)}
                              </div>
                              <p className="text-sm text-muted-foreground">Total Items</p>
                            </div>
                          </div>
                        </Card>

                        {/* Action Items */}
                        <Card className="p-6 border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
                          <h3 className="text-lg font-semibold mb-4 text-purple-800 dark:text-purple-200 flex items-center">
                            <Calendar className="h-5 w-5 mr-2" />
                            Recommended Action Items
                          </h3>
                          <div className="space-y-3">
                            <div className="flex items-center space-x-3 p-3 bg-white/50 dark:bg-purple-900/50 rounded-lg">
                              <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">1</div>
                              <span className="text-sm">Leverage identified strengths in role assignment and training</span>
                            </div>
                            <div className="flex items-center space-x-3 p-3 bg-white/50 dark:bg-purple-900/50 rounded-lg">
                              <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">2</div>
                              <span className="text-sm">Create targeted development plan for identified areas</span>
                            </div>
                            <div className="flex items-center space-x-3 p-3 bg-white/50 dark:bg-purple-900/50 rounded-lg">
                              <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">3</div>
                              <span className="text-sm">Schedule regular check-ins to monitor progress</span>
                            </div>
                          </div>
                        </Card>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Transcript Tab */}
                  <TabsContent value="transcript" className="h-full mt-4" data-testid="content-transcript">
                    <div className="space-y-6 h-full">
                      {/* Audio Player */}
                      {detailsCandidate.audioRecordingUrl && (
                        <AudioPlayer
                          audioUrl={detailsCandidate.audioRecordingUrl}
                          candidateName={detailsCandidate.name}
                          title="Interview Recording"
                          className="mb-6"
                        />
                      )}

                      {/* Enhanced Transcript Display */}
                      <EnhancedTranscript
                        transcript={detailsCandidate.interviewTranscript || ''}
                        candidateName={detailsCandidate.name}
                        agentName={detailsCandidate.agentName || 'AI Agent'}
                        interviewDate={detailsCandidate.interviewDate || undefined}
                        duration={detailsCandidate.interviewDuration || (detailsCandidate.callDuration ? formatCallDuration(detailsCandidate.callDuration) : undefined)}
                        messageCount={detailsCandidate.messageCount || undefined}
                        className="flex-1"
                      />

                      {/* Transcript Summary */}
                      {detailsCandidate.transcriptSummary && detailsCandidate.transcriptSummary !== '-' && (
                        <Card className="p-6 border-2 border-blue-200">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-blue-700 flex items-center">
                              <StickyNote className="h-5 w-5 mr-2" />
                              Transcript Summary
                            </h3>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigator.clipboard.writeText(detailsCandidate.transcriptSummary || '')}
                              data-testid="copy-transcript-summary"
                            >
                              <Copy className="h-4 w-4 mr-2" />Copy
                            </Button>
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 border">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap text-blue-800 dark:text-blue-200">
                              {detailsCandidate.transcriptSummary}
                            </p>
                          </div>
                        </Card>
                      )}
                    </div>
                  </TabsContent>

                  {/* Structured Data Tab */}
                  <TabsContent value="structured-data" className="h-full mt-4" data-testid="content-structured-data">
                    <ScrollArea className="h-full w-full">
                      <div className="space-y-6">
                        {/* Evaluation Details */}
                        {detailsCandidate.evaluationDetails ? (
                          <Card className="p-6 border-2 border-blue-200">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-blue-700 flex items-center">
                                <BarChart3 className="h-5 w-5 mr-2" />
                                Evaluation Details
                              </h3>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigator.clipboard.writeText(`Evaluation Details:\n${Object.entries(detailsCandidate.evaluationDetails as Record<string, any>).map(([key, value]) => `${key.replace(/_/g, ' ')}: ${typeof value === 'object' ? (Array.isArray(value) ? value.join(', ') : 'Complex data') : value}`).join('\n')}`)}
                                data-testid="copy-evaluation-details"
                              >
                                <Copy className="h-4 w-4 mr-2" />Copy Data
                              </Button>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 max-h-[400px] overflow-y-auto border">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(detailsCandidate.evaluationDetails as Record<string, any>).map(([key, value]) => (
                                  <div key={key} className="space-y-2">
                                    <label className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                                      {key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}
                                    </label>
                                    <div className="bg-white dark:bg-blue-900 rounded p-3 border">
                                      <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap break-words">
                                        {typeof value === 'object' ? (
                                          Array.isArray(value) ? value.join(', ') : 
                                          (value && typeof value === 'object' ? 
                                            Object.entries(value).map(([k, v]) => `${k}: ${v}`).slice(0, 3).join(' | ') + (Object.keys(value).length > 3 ? '...' : '') : 
                                            String(value || '-')
                                          )
                                        ) : String(value || '-')}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </Card>
                        ) : (
                          <Card className="p-6 border-2 border-muted">
                            <div className="text-center py-8 text-muted-foreground">
                              <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No evaluation details available</p>
                            </div>
                          </Card>
                        )}

                        {/* Interview Metrics */}
                        {detailsCandidate.interviewMetrics ? (
                          <Card className="p-6 border-2 border-green-200">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-green-700 flex items-center">
                                <Database className="h-5 w-5 mr-2" />
                                Interview Metrics
                              </h3>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigator.clipboard.writeText(`Interview Metrics:\n${Object.entries(detailsCandidate.interviewMetrics as Record<string, any>).map(([key, value]) => `${key.replace(/_/g, ' ')}: ${typeof value === 'object' ? (Array.isArray(value) ? value.join(', ') : 'Complex data') : value}`).join('\n')}`)}
                                data-testid="copy-interview-metrics"
                              >
                                <Copy className="h-4 w-4 mr-2" />Copy Data
                              </Button>
                            </div>
                            <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4 max-h-[400px] overflow-y-auto border">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(detailsCandidate.interviewMetrics as Record<string, any>).map(([key, value]) => (
                                  <div key={key} className="space-y-2">
                                    <label className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                                      {key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}
                                    </label>
                                    <div className="bg-white dark:bg-green-900 rounded p-3 border">
                                      <p className="text-sm text-green-800 dark:text-green-200 whitespace-pre-wrap break-words">
                                        {typeof value === 'object' ? (
                                          Array.isArray(value) ? value.join(', ') : 
                                          (value && typeof value === 'object' ? 
                                            Object.entries(value).map(([k, v]) => `${k}: ${v}`).slice(0, 3).join(' | ') + (Object.keys(value).length > 3 ? '...' : '') : 
                                            String(value || '-')
                                          )
                                        ) : String(value || '-')}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </Card>
                        ) : (
                          <Card className="p-6 border-2 border-muted">
                            <div className="text-center py-8 text-muted-foreground">
                              <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No interview metrics available</p>
                            </div>
                          </Card>
                        )}

                        {/* Agent Data */}
                        {detailsCandidate.agentData ? (
                          <Card className="p-6 border-2 border-purple-200">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-purple-700 flex items-center">
                                <User className="h-5 w-5 mr-2" />
                                Agent Data
                              </h3>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigator.clipboard.writeText(`Agent Data:\n${Object.entries(detailsCandidate.agentData as Record<string, any>).map(([key, value]) => `${key.replace(/_/g, ' ')}: ${typeof value === 'object' ? (Array.isArray(value) ? value.join(', ') : 'Complex data') : value}`).join('\n')}`)}
                                data-testid="copy-agent-data"
                              >
                                <Copy className="h-4 w-4 mr-2" />Copy Data
                              </Button>
                            </div>
                            <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-4 max-h-[400px] overflow-y-auto border">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(detailsCandidate.agentData as Record<string, any>).map(([key, value]) => (
                                  <div key={key} className="space-y-2">
                                    <label className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                                      {key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}
                                    </label>
                                    <div className="bg-white dark:bg-purple-900 rounded p-3 border">
                                      <p className="text-sm text-purple-800 dark:text-purple-200 whitespace-pre-wrap break-words">
                                        {typeof value === 'object' ? (
                                          Array.isArray(value) ? value.join(', ') : 
                                          (value && typeof value === 'object' ? 
                                            Object.entries(value).map(([k, v]) => `${k}: ${v}`).slice(0, 3).join(' | ') + (Object.keys(value).length > 3 ? '...' : '') : 
                                            String(value || '-')
                                          )
                                        ) : String(value || '-')}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </Card>
                        ) : (
                          <Card className="p-6 border-2 border-muted">
                            <div className="text-center py-8 text-muted-foreground">
                              <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No agent data available</p>
                            </div>
                          </Card>
                        )}

                        {/* Conversation Metadata */}
                        {detailsCandidate.conversationMetadata ? (
                          <Card className="p-6 border-2 border-orange-200">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-orange-700 flex items-center">
                                <Settings className="h-5 w-5 mr-2" />
                                Conversation Metadata
                              </h3>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigator.clipboard.writeText(`Conversation Metadata:\n${Object.entries(detailsCandidate.conversationMetadata as Record<string, any>).map(([key, value]) => `${key.replace(/_/g, ' ')}: ${typeof value === 'object' ? (Array.isArray(value) ? value.join(', ') : 'Complex data') : value}`).join('\n')}`)}
                                data-testid="copy-conversation-metadata"
                              >
                                <Copy className="h-4 w-4 mr-2" />Copy Data
                              </Button>
                            </div>
                            <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-4 max-h-[400px] overflow-y-auto border">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(detailsCandidate.conversationMetadata as Record<string, any>).map(([key, value]) => (
                                  <div key={key} className="space-y-2">
                                    <label className="text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide">
                                      {key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}
                                    </label>
                                    <div className="bg-white dark:bg-orange-900 rounded p-3 border">
                                      <p className="text-sm text-orange-800 dark:text-orange-200 whitespace-pre-wrap break-words">
                                        {typeof value === 'object' ? (
                                          Array.isArray(value) ? value.join(', ') : 
                                          (value && typeof value === 'object' ? 
                                            Object.entries(value).map(([k, v]) => `${k}: ${v}`).slice(0, 3).join(' | ') + (Object.keys(value).length > 3 ? '...' : '') : 
                                            String(value || '-')
                                          )
                                        ) : String(value || '-')}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </Card>
                        ) : (
                          <Card className="p-6 border-2 border-muted">
                            <div className="text-center py-8 text-muted-foreground">
                              <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No conversation metadata available</p>
                            </div>
                          </Card>
                        )}

                        {/* All ElevenLabs Fields Coverage - Complete Data */}
                        <Card className="p-6 border-2 border-muted bg-gradient-to-r from-muted/10 to-muted/20">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-muted-foreground flex items-center">
                              <Database className="h-5 w-5 mr-2" />
                              Complete ElevenLabs Data Coverage
                            </h3>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const allData = [
                                  `Agent ID: ${detailsCandidate.agentId || '-'}`,
                                  `Agent Name: ${detailsCandidate.agentName || '-'}`,
                                  `Conversation ID: ${detailsCandidate.conversationId || '-'}`,
                                  `Call Status: ${detailsCandidate.callStatus || '-'}`,
                                  `Call Successful: ${detailsCandidate.callSuccessful !== undefined ? (detailsCandidate.callSuccessful ? 'Yes' : 'No') : '-'}`,
                                  `Message Count: ${detailsCandidate.messageCount || '-'}`,
                                  `Demo Call Performed: ${detailsCandidate.demoCallPerformed !== undefined ? (detailsCandidate.demoCallPerformed ? 'Yes' : 'No') : '-'}`,
                                  `Kevin Persona Used: ${detailsCandidate.kevinPersonaUsed !== undefined ? (detailsCandidate.kevinPersonaUsed ? 'Yes' : 'No') : '-'}`,
                                  `Coaching Given: ${detailsCandidate.coachingGiven !== undefined ? (detailsCandidate.coachingGiven ? 'Yes' : 'No') : '-'}`,
                                  `Pitch Delivered: ${detailsCandidate.pitchDelivered !== undefined ? (detailsCandidate.pitchDelivered ? 'Yes' : 'No') : '-'}`,
                                  `Preferred Markets: ${Array.isArray(detailsCandidate.preferredMarkets) ? detailsCandidate.preferredMarkets.join(', ') : (detailsCandidate.preferredMarkets || '-')}`,
                                  `Timeline: ${detailsCandidate.timeline || '-'}`,
                                  `Recommended Next Steps: ${detailsCandidate.recommendedNextSteps || '-'}`,
                                  `Audio Recording URL: ${detailsCandidate.audioRecordingUrl ? 'Available' : 'Not Available'}`,
                                  `Interview Date: ${detailsCandidate.interviewDate ? new Date(detailsCandidate.interviewDate).toLocaleString() : '-'}`,
                                  `Transcript Summary: ${detailsCandidate.transcriptSummary || '-'}`
                                ].join('\n');
                                navigator.clipboard.writeText(`Complete ElevenLabs Data:\n\n${allData}`);
                              }}
                              data-testid="copy-complete-data"
                            >
                              <Copy className="h-4 w-4 mr-2" />Copy All Data
                            </Button>
                          </div>
                          <div className="space-y-6">
                            {/* Core Interview Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {/* Agent Information */}
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Agent ID</label>
                                <div className="bg-background rounded p-3 border">
                                  <p className="text-sm">{detailsCandidate.agentId || '-'}</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Agent Name</label>
                                <div className="bg-background rounded p-3 border">
                                  <p className="text-sm">{detailsCandidate.agentName || '-'}</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Conversation ID</label>
                                <div className="bg-background rounded p-3 border">
                                  <p className="text-sm">{detailsCandidate.conversationId || '-'}</p>
                                </div>
                              </div>
                              
                              {/* Call Metrics */}
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-green-600 uppercase tracking-wide">Call Status</label>
                                <div className="bg-background rounded p-3 border">
                                  <p className="text-sm">{detailsCandidate.callStatus || '-'}</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-green-600 uppercase tracking-wide">Call Successful</label>
                                <div className="bg-background rounded p-3 border">
                                  <p className="text-sm">{detailsCandidate.callSuccessful !== undefined ? (detailsCandidate.callSuccessful ? 'Yes' : 'No') : '-'}</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-green-600 uppercase tracking-wide">Message Count</label>
                                <div className="bg-background rounded p-3 border">
                                  <p className="text-sm">{detailsCandidate.messageCount || '-'}</p>
                                </div>
                              </div>
                              
                              {/* Performance Indicators */}
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Demo Call Performed</label>
                                <div className="bg-background rounded p-3 border">
                                  <p className="text-sm">{detailsCandidate.demoCallPerformed !== undefined ? (detailsCandidate.demoCallPerformed ? 'Yes' : 'No') : '-'}</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Kevin Persona Used</label>
                                <div className="bg-background rounded p-3 border">
                                  <p className="text-sm">{detailsCandidate.kevinPersonaUsed !== undefined ? (detailsCandidate.kevinPersonaUsed ? 'Yes' : 'No') : '-'}</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Coaching Given</label>
                                <div className="bg-background rounded p-3 border">
                                  <p className="text-sm">{detailsCandidate.coachingGiven !== undefined ? (detailsCandidate.coachingGiven ? 'Yes' : 'No') : '-'}</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Pitch Delivered</label>
                                <div className="bg-background rounded p-3 border">
                                  <p className="text-sm">{detailsCandidate.pitchDelivered !== undefined ? (detailsCandidate.pitchDelivered ? 'Yes' : 'No') : '-'}</p>
                                </div>
                              </div>
                              
                              {/* Market Information */}
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Preferred Markets</label>
                                <div className="bg-background rounded p-3 border">
                                  <p className="text-sm">{Array.isArray(detailsCandidate.preferredMarkets) ? detailsCandidate.preferredMarkets.join(', ') : (detailsCandidate.preferredMarkets || '-')}</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Timeline</label>
                                <div className="bg-background rounded p-3 border">
                                  <p className="text-sm">{detailsCandidate.timeline || '-'}</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Recommended Next Steps</label>
                                <div className="bg-background rounded p-3 border">
                                  <p className="text-sm whitespace-pre-wrap">{detailsCandidate.recommendedNextSteps || '-'}</p>
                                </div>
                              </div>
                              
                              {/* Additional Data */}
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-red-600 uppercase tracking-wide">Audio Recording URL</label>
                                <div className="bg-background rounded p-3 border">
                                  {detailsCandidate.audioRecordingUrl ? (
                                    <a href={detailsCandidate.audioRecordingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                                      View Recording
                                    </a>
                                  ) : (
                                    <p className="text-sm">-</p>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-red-600 uppercase tracking-wide">Interview Date</label>
                                <div className="bg-background rounded p-3 border">
                                  <p className="text-sm">{detailsCandidate.interviewDate ? new Date(detailsCandidate.interviewDate).toLocaleString() : '-'}</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-red-600 uppercase tracking-wide">Transcript Summary</label>
                                <div className="bg-background rounded p-3 border">
                                  <p className="text-sm whitespace-pre-wrap">{detailsCandidate.transcriptSummary || '-'}</p>
                                </div>
                              </div>
                            </div>
                            
                            {/* Legacy Structured Data with Formatted Display */}
                            {(detailsCandidate.evaluationCriteria || detailsCandidate.dataCollectionResults || detailsCandidate.interviewData) && (
                              <div className="border-t pt-4">
                                <h4 className="font-medium text-sm mb-4 text-muted-foreground">Legacy Structured Data</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {/* Evaluation Criteria */}
                                  {detailsCandidate.evaluationCriteria && (
                                    <div className="bg-muted/30 rounded-lg p-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <h5 className="font-medium text-sm">Evaluation Criteria</h5>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => navigator.clipboard.writeText(JSON.stringify(detailsCandidate.evaluationCriteria as any, null, 2))}
                                          data-testid="copy-evaluation-criteria"
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      </div>
                                      <div className="space-y-2">
                                        {Object.entries(detailsCandidate.evaluationCriteria as Record<string, any>).map(([key, value]) => (
                                          <div key={key} className="bg-background rounded p-2">
                                            <div className="text-xs font-medium text-muted-foreground">{key.replace(/_/g, ' ')}</div>
                                            <div className="text-sm">{renderJsonValue(value)}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Data Collection Results */}
                                  {detailsCandidate.dataCollectionResults && (
                                    <div className="bg-muted/30 rounded-lg p-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <h5 className="font-medium text-sm">Data Collection Results</h5>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => navigator.clipboard.writeText(JSON.stringify(detailsCandidate.dataCollectionResults as any, null, 2))}
                                          data-testid="copy-data-collection-results"
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      </div>
                                      <div className="space-y-2">
                                        {Object.entries(detailsCandidate.dataCollectionResults as Record<string, any>).map(([key, value]) => (
                                          <div key={key} className="bg-background rounded p-2">
                                            <div className="text-xs font-medium text-muted-foreground">{key.replace(/_/g, ' ')}</div>
                                            <div className="text-sm">{renderJsonValue(value)}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Interview Data */}
                                  {detailsCandidate.interviewData && (
                                    <div className="bg-muted/30 rounded-lg p-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <h5 className="font-medium text-sm">Raw Interview Data</h5>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => navigator.clipboard.writeText(JSON.stringify(detailsCandidate.interviewData, null, 2))}
                                          data-testid="copy-interview-data"
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      </div>
                                      <div className="bg-background rounded p-2 max-h-32 overflow-y-auto">
                                        <pre className="text-xs font-mono whitespace-pre-wrap">
                                          {String(JSON.stringify(detailsCandidate.interviewData || {}, null, 2))}
                                        </pre>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </Card>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Technical Tab */}
                  <TabsContent value="technical" className="h-full mt-4" data-testid="content-technical">
                    <ScrollArea className="h-full w-full">
                      <div className="space-y-6">
                        {/* Basic Information */}
                        <Card className="p-6 border-2 border-muted">
                          <h3 className="text-lg font-semibold mb-4 flex items-center">
                            <User className="h-5 w-5 mr-2" />
                            Basic Information
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Name</label>
                                <p className="text-sm mt-1 font-medium">{detailsCandidate.name}</p>
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
                                <Badge variant="outline" className="mt-1">{detailsCandidate.pipelineStage}</Badge>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Source Reference</label>
                                <p className="text-sm mt-1">{detailsCandidate.sourceRef || '-'}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Resume URL</label>
                                {detailsCandidate.resumeUrl ? (
                                  <a 
                                    href={detailsCandidate.resumeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:text-blue-800 underline block mt-1"
                                  >
                                    View Resume
                                  </a>
                                ) : (
                                  <p className="text-sm mt-1 text-muted-foreground">-</p>
                                )}
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Audio Recording</label>
                                {detailsCandidate.audioRecordingUrl ? (
                                  <a 
                                    href={detailsCandidate.audioRecordingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:text-blue-800 underline block mt-1"
                                  >
                                    Listen to Recording
                                  </a>
                                ) : (
                                  <p className="text-sm mt-1 text-muted-foreground">-</p>
                                )}
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Tags</label>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {detailsCandidate.tags && detailsCandidate.tags.length > 0 ? (
                                    detailsCandidate.tags.map((tag, index) => (
                                      <Badge key={index} variant="secondary" className="text-xs">
                                        {tag}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-sm text-muted-foreground">-</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>

                        {/* Agent Information */}
                        <Card className="p-6 border-2 border-blue-200">
                          <h3 className="text-lg font-semibold mb-4 text-blue-700 flex items-center">
                            <Settings className="h-5 w-5 mr-2" />
                            Agent Information
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Agent Name</label>
                              <p className="text-sm mt-1 font-mono">{detailsCandidate.agentName || '-'}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Agent ID</label>
                              <div className="flex items-center space-x-2 mt-1">
                                <p className="text-sm font-mono flex-1">{detailsCandidate.agentId || '-'}</p>
                                {detailsCandidate.agentId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigator.clipboard.writeText(detailsCandidate.agentId || '')}
                                    data-testid="copy-agent-id"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <label className="text-sm font-medium text-muted-foreground">Conversation ID</label>
                              <div className="flex items-center space-x-2 mt-1">
                                <p className="text-sm font-mono flex-1">{detailsCandidate.conversationId || '-'}</p>
                                {detailsCandidate.conversationId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigator.clipboard.writeText(detailsCandidate.conversationId || '')}
                                    data-testid="copy-conversation-id"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </Card>

                        {/* Call Information */}
                        <Card className="p-6 border-2 border-green-200">
                          <h3 className="text-lg font-semibold mb-4 text-green-700 flex items-center">
                            <Phone className="h-5 w-5 mr-2" />
                            Call Information
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Call Status</label>
                              <Badge variant={detailsCandidate.callStatus === 'completed' ? 'default' : 'secondary'} className="mt-1">
                                {detailsCandidate.callStatus || 'Unknown'}
                              </Badge>
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
                              <label className="text-sm font-medium text-muted-foreground">Call Duration</label>
                              <p className="text-sm mt-1">{formatCallDuration(detailsCandidate.callDuration)}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Message Count</label>
                              <p className="text-sm mt-1">{detailsCandidate.messageCount || 0}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Interview Duration</label>
                              <p className="text-sm mt-1">{detailsCandidate.interviewDuration || '-'}</p>
                            </div>
                          </div>
                        </Card>

                        {/* Score Information */}
                        <Card className="p-6 border-2 border-purple-200">
                          <h3 className="text-lg font-semibold mb-4 text-purple-700 flex items-center">
                            <BarChart3 className="h-5 w-5 mr-2" />
                            Score Information
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Overall Score</label>
                              <p className="text-lg font-bold mt-1 text-primary">{detailsCandidate.score || 0}%</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Interview Score</label>
                              <p className="text-lg font-bold mt-1 text-secondary">{detailsCandidate.interviewScore || 0}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">ElevenLabs Overall</label>
                              <p className="text-lg font-bold mt-1 text-purple-600">{detailsCandidate.overallScore || 0}%</p>
                            </div>
                          </div>
                        </Card>
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
    </TooltipProvider>
  );
}