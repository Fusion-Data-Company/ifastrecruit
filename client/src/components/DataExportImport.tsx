import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Candidate } from '@shared/schema';

interface DataExportImportProps {
  candidates?: Candidate[];
  className?: string;
}

interface ExportOptions {
  format: 'csv' | 'excel' | 'json';
  fields: string[];
  filters: {
    stage?: string;
    source?: string;
    dateRange?: string;
    scoreRange?: { min: number; max: number };
  };
}

interface ImportStatus {
  total: number;
  processed: number;
  success: number;
  errors: string[];
  status: 'idle' | 'processing' | 'completed' | 'error';
}

const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV', icon: 'fas fa-file-csv', description: 'Comma-separated values' },
  { value: 'excel', label: 'Excel', icon: 'fas fa-file-excel', description: 'Microsoft Excel format' },
  { value: 'json', label: 'JSON', icon: 'fas fa-code', description: 'JavaScript Object Notation' },
];

const AVAILABLE_FIELDS = [
  { value: 'name', label: 'Full Name', required: true },
  { value: 'email', label: 'Email Address', required: true },
  { value: 'phone', label: 'Phone Number' },
  { value: 'pipelineStage', label: 'Pipeline Stage' },
  { value: 'score', label: 'Candidate Score' },
  { value: 'tags', label: 'Tags' },
  { value: 'sourceRef', label: 'Source Reference' },
  { value: 'resumeUrl', label: 'Resume URL' },
  { value: 'createdAt', label: 'Date Added' },
  { value: 'campaignId', label: 'Campaign ID' },
];

const PIPELINE_STAGES = [
  'NEW', 'FIRST_INTERVIEW', 'TECHNICAL_SCREEN', 
  'FINAL_INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'
];

export default function DataExportImport({ candidates = [], className }: DataExportImportProps) {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'csv',
    fields: ['name', 'email', 'phone', 'pipelineStage', 'score'],
    filters: {},
  });
  
  const [importStatus, setImportStatus] = useState<ImportStatus>({
    total: 0,
    processed: 0,
    success: 0,
    errors: [],
    status: 'idle',
  });

  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importTemplate, setImportTemplate] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Export data mutation
  const exportMutation = useMutation({
    mutationFn: async (options: ExportOptions) => {
      // Filter candidates based on export options
      let filteredCandidates = candidates;

      if (options.filters.stage) {
        filteredCandidates = filteredCandidates.filter(c => c.pipelineStage === options.filters.stage);
      }

      if (options.filters.scoreRange) {
        filteredCandidates = filteredCandidates.filter(c => {
          const score = c.score || 0;
          return score >= options.filters.scoreRange!.min && score <= options.filters.scoreRange!.max;
        });
      }

      // Extract selected fields
      const exportData = filteredCandidates.map(candidate => {
        const record: any = {};
        options.fields.forEach(field => {
          if (field === 'tags') {
            record[field] = candidate.tags?.join(', ') || '';
          } else if (field === 'createdAt') {
            record[field] = new Date(candidate.createdAt).toLocaleDateString();
          } else {
            record[field] = candidate[field as keyof Candidate] || '';
          }
        });
        return record;
      });

      return { data: exportData, count: filteredCandidates.length };
    },
    onSuccess: (result, options) => {
      downloadFile(result.data, options.format, options.fields);
      setIsExportDialogOpen(false);
      toast({
        title: 'Export Completed',
        description: `Successfully exported ${result.count} candidates as ${options.format.toUpperCase()}.`,
      });
    },
    onError: () => {
      toast({
        title: 'Export Failed',
        description: 'There was an error exporting the data. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Import data mutation
  const importMutation = useMutation({
    mutationFn: async (candidates: Partial<Candidate>[]) => {
      const results = { success: 0, errors: [] as string[] };
      
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        setImportStatus(prev => ({ 
          ...prev, 
          processed: i + 1, 
          status: 'processing' 
        }));

        try {
          // Validate required fields
          if (!candidate.name || !candidate.email) {
            results.errors.push(`Row ${i + 1}: Missing required fields (name or email)`);
            continue;
          }

          // Create candidate via API
          await apiRequest('POST', '/api/candidates', {
            name: candidate.name,
            email: candidate.email,
            phone: candidate.phone || null,
            pipelineStage: candidate.pipelineStage || 'NEW',
            score: candidate.score || null,
            tags: candidate.tags || null,
            sourceRef: candidate.sourceRef || null,
            resumeUrl: candidate.resumeUrl || null,
          });

          results.success++;
        } catch (error) {
          results.errors.push(`Row ${i + 1}: ${String(error)}`);
        }

        // Small delay to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return results;
    },
    onSuccess: (results) => {
      setImportStatus(prev => ({
        ...prev,
        success: results.success,
        errors: results.errors,
        status: 'completed',
      }));
      
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      
      toast({
        title: 'Import Completed',
        description: `Successfully imported ${results.success} candidates. ${results.errors.length} errors occurred.`,
        variant: results.errors.length > 0 ? 'destructive' : 'default',
      });
    },
    onError: () => {
      setImportStatus(prev => ({ ...prev, status: 'error' }));
      toast({
        title: 'Import Failed',
        description: 'There was an error importing the data. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const downloadFile = (data: any[], format: string, fields: string[]) => {
    let content = '';
    let mimeType = '';
    let extension = '';

    switch (format) {
      case 'csv':
        // Create CSV content
        const headers = fields.map(field => 
          AVAILABLE_FIELDS.find(f => f.value === field)?.label || field
        );
        const csvRows = data.map(row => 
          fields.map(field => `"${row[field] || ''}"`).join(',')
        );
        content = [headers.join(','), ...csvRows].join('\n');
        mimeType = 'text/csv';
        extension = 'csv';
        break;

      case 'json':
        content = JSON.stringify(data, null, 2);
        mimeType = 'application/json';
        extension = 'json';
        break;

      case 'excel':
        // For Excel, we'll create a CSV with Excel-friendly formatting
        const excelHeaders = fields.map(field => 
          AVAILABLE_FIELDS.find(f => f.value === field)?.label || field
        );
        const excelRows = data.map(row => 
          fields.map(field => {
            const value = row[field] || '';
            // Excel formatting for dates and numbers
            if (field === 'createdAt' && value) {
              return `"${value}"`;
            }
            return `"${value}"`;
          }).join(',')
        );
        content = [excelHeaders.join(','), ...excelRows].join('\n');
        mimeType = 'application/vnd.ms-excel';
        extension = 'csv'; // Excel can open CSV files
        break;
    }

    // Download file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `candidates_export_${new Date().toISOString().split('T')[0]}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      parseImportFile(content, file.type);
    };
    reader.readAsText(file);
  };

  const parseImportFile = (content: string, fileType: string) => {
    try {
      let candidates: Partial<Candidate>[] = [];

      if (fileType.includes('json') || content.trim().startsWith('{') || content.trim().startsWith('[')) {
        // Parse JSON
        const jsonData = JSON.parse(content);
        candidates = Array.isArray(jsonData) ? jsonData : [jsonData];
      } else {
        // Parse CSV
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          throw new Error('Invalid CSV format: No data found');
        }

        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
        const rows = lines.slice(1);

        candidates = rows.map(row => {
          const values = row.split(',').map(v => v.replace(/"/g, '').trim());
          const candidate: any = {};

          headers.forEach((header, index) => {
            if (values[index]) {
              // Map common header variations to our schema fields
              switch (header) {
                case 'name':
                case 'full name':
                case 'candidate name':
                  candidate.name = values[index];
                  break;
                case 'email':
                case 'email address':
                  candidate.email = values[index];
                  break;
                case 'phone':
                case 'phone number':
                  candidate.phone = values[index];
                  break;
                case 'stage':
                case 'pipeline stage':
                case 'status':
                  candidate.pipelineStage = values[index].toUpperCase().replace(/\s+/g, '_');
                  break;
                case 'score':
                case 'candidate score':
                  candidate.score = parseInt(values[index]) || null;
                  break;
                case 'tags':
                  candidate.tags = values[index].split(';').map(tag => tag.trim()).filter(Boolean);
                  break;
                default:
                  candidate[header] = values[index];
              }
            }
          });

          return candidate;
        });
      }

      setImportStatus({
        total: candidates.length,
        processed: 0,
        success: 0,
        errors: [],
        status: 'idle',
      });

      importMutation.mutate(candidates);
    } catch (error) {
      toast({
        title: 'File Parse Error',
        description: `Failed to parse the uploaded file: ${String(error)}`,
        variant: 'destructive',
      });
    }
  };

  const generateTemplate = () => {
    const template = AVAILABLE_FIELDS.filter(field => field.required || exportOptions.fields.includes(field.value))
      .map(field => field.label)
      .join(',');
    
    const sampleRow = AVAILABLE_FIELDS.filter(field => field.required || exportOptions.fields.includes(field.value))
      .map(field => {
        switch (field.value) {
          case 'name': return 'John Doe';
          case 'email': return 'john.doe@example.com';
          case 'phone': return '+1-555-0123';
          case 'pipelineStage': return 'NEW';
          case 'score': return '85';
          case 'tags': return 'javascript;senior';
          default: return 'sample_value';
        }
      })
      .join(',');

    setImportTemplate(`${template}\n${sampleRow}`);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <Card className="glass-panel p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="enterprise-heading text-lg font-semibold">Data Management</h3>
            <p className="text-muted-foreground text-sm">Export and import candidate data</p>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant="outline" className="text-xs">
              {candidates.length} candidates available
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export Section */}
          <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
            <DialogTrigger asChild>
              <Card className="glass-input p-6 cursor-pointer hover:bg-muted/20 transition-colors">
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <i className="fas fa-download text-primary text-xl"></i>
                  </div>
                  <h4 className="font-semibold">Export Data</h4>
                  <p className="text-sm text-muted-foreground">
                    Export candidate data in various formats with custom field selection
                  </p>
                </div>
              </Card>
            </DialogTrigger>
            <DialogContent className="glass-panel border-border max-w-2xl">
              <DialogHeader>
                <DialogTitle>Export Candidate Data</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Format Selection */}
                <div className="space-y-3">
                  <Label>Export Format</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {EXPORT_FORMATS.map((format) => (
                      <Button
                        key={format.value}
                        variant={exportOptions.format === format.value ? "default" : "outline"}
                        className="h-auto p-4 flex flex-col space-y-2"
                        onClick={() => setExportOptions(prev => ({ ...prev, format: format.value as any }))}
                      >
                        <i className={`${format.icon} text-lg`}></i>
                        <div className="text-center">
                          <div className="font-medium text-sm">{format.label}</div>
                          <div className="text-xs text-muted-foreground">{format.description}</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Field Selection */}
                <div className="space-y-3">
                  <Label>Select Fields to Export</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {AVAILABLE_FIELDS.map((field) => (
                      <label key={field.value} className="flex items-center space-x-2 p-2 rounded hover:bg-muted/20">
                        <input
                          type="checkbox"
                          checked={exportOptions.fields.includes(field.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setExportOptions(prev => ({
                                ...prev,
                                fields: [...prev.fields, field.value]
                              }));
                            } else if (!field.required) {
                              setExportOptions(prev => ({
                                ...prev,
                                fields: prev.fields.filter(f => f !== field.value)
                              }));
                            }
                          }}
                          disabled={field.required}
                          className="rounded"
                        />
                        <span className="text-sm">{field.label}</span>
                        {field.required && (
                          <Badge variant="secondary" className="text-xs">Required</Badge>
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Filters */}
                <div className="space-y-3">
                  <Label>Filters (Optional)</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Pipeline Stage</Label>
                      <Select 
                        value={exportOptions.filters.stage || 'all'} 
                        onValueChange={(value) => setExportOptions(prev => ({
                          ...prev,
                          filters: { ...prev.filters, stage: value === 'all' ? undefined : value }
                        }))}
                      >
                        <SelectTrigger className="glass-input">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Stages</SelectItem>
                          {PIPELINE_STAGES.map(stage => (
                            <SelectItem key={stage} value={stage}>
                              {stage.replace('_', ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setIsExportDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => exportMutation.mutate(exportOptions)}
                    disabled={exportMutation.isPending || exportOptions.fields.length === 0}
                    className="glow-hover"
                  >
                    {exportMutation.isPending ? (
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                    ) : (
                      <i className="fas fa-download mr-2"></i>
                    )}
                    Export {candidates.length} Candidates
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Import Section */}
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Card className="glass-input p-6 cursor-pointer hover:bg-muted/20 transition-colors">
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-secondary/10 flex items-center justify-center">
                    <i className="fas fa-upload text-secondary text-xl"></i>
                  </div>
                  <h4 className="font-semibold">Import Data</h4>
                  <p className="text-sm text-muted-foreground">
                    Import candidate data from CSV, Excel, or JSON files
                  </p>
                </div>
              </Card>
            </DialogTrigger>
            <DialogContent className="glass-panel border-border max-w-2xl">
              <DialogHeader>
                <DialogTitle>Import Candidate Data</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* File Upload */}
                <div className="space-y-3">
                  <Label>Upload File</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.json,.xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <div className="space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-full bg-muted/20 flex items-center justify-center">
                        <i className="fas fa-cloud-upload-alt text-muted-foreground text-xl"></i>
                      </div>
                      <div>
                        <p className="font-medium">Choose a file to upload</p>
                        <p className="text-sm text-muted-foreground">CSV, JSON, or Excel files supported</p>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={() => fileInputRef.current?.click()}
                        className="glass-input"
                      >
                        <i className="fas fa-folder-open mr-2"></i>
                        Browse Files
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Template Download */}
                <div className="space-y-3">
                  <Label>Need a Template?</Label>
                  <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Download Template</p>
                      <p className="text-xs text-muted-foreground">Get a CSV template with proper formatting</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={generateTemplate}
                      className="glass-input"
                    >
                      <i className="fas fa-file-download mr-2"></i>
                      Generate
                    </Button>
                  </div>
                  {importTemplate && (
                    <div className="space-y-2">
                      <Label className="text-xs">Template Preview</Label>
                      <Textarea 
                        value={importTemplate} 
                        readOnly 
                        className="glass-input font-mono text-xs h-20"
                      />
                    </div>
                  )}
                </div>

                {/* Import Progress */}
                <AnimatePresence>
                  {importStatus.status !== 'idle' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3"
                    >
                      <Label>Import Progress</Label>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Processing candidates...</span>
                          <span>{importStatus.processed} / {importStatus.total}</span>
                        </div>
                        <Progress 
                          value={(importStatus.processed / importStatus.total) * 100} 
                          className="h-2"
                        />
                        {importStatus.status === 'completed' && (
                          <div className="text-sm">
                            <p className="text-green-600">✓ {importStatus.success} candidates imported successfully</p>
                            {importStatus.errors.length > 0 && (
                              <details className="mt-2">
                                <summary className="text-red-600 cursor-pointer">
                                  ⚠ {importStatus.errors.length} errors occurred
                                </summary>
                                <div className="mt-2 p-2 bg-red-50 rounded text-xs max-h-32 overflow-y-auto">
                                  {importStatus.errors.map((error, index) => (
                                    <div key={index} className="text-red-700">{error}</div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setIsImportDialogOpen(false)}>
                    {importStatus.status === 'completed' ? 'Close' : 'Cancel'}
                  </Button>
                  {importStatus.status === 'completed' && (
                    <Button 
                      onClick={() => {
                        setImportStatus({ total: 0, processed: 0, success: 0, errors: [], status: 'idle' });
                        setIsImportDialogOpen(false);
                      }}
                      className="glow-hover"
                    >
                      Import More Data
                    </Button>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Card>
    </div>
  );
}