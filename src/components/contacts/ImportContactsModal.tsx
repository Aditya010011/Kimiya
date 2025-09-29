import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Download, FileText, AlertCircle, CheckCircle, X, Users } from 'lucide-react';
import { toast } from 'sonner';

interface ContactGroup {
  id: number;
  name: string;
  color: string;
}

interface ImportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  contactGroups: ContactGroup[];
}

interface ParsedContact {
  row: number;
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  address?: string;
  notes?: string;
  is_favorite?: string;
  isValid: boolean;
  errors: string[];
}

interface ImportResult {
  row: number;
  action: 'created' | 'updated' | 'skipped';
  reason?: string;
  contactId?: number;
  data: any;
}

interface ImportSummary {
  totalRows: number;
  successful: number;
  updated: number;
  skipped: number;
  errors: number;
}

const ImportContactsModal: React.FC<ImportContactsModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  contactGroups
}) => {
  const [activeTab, setActiveTab] = useState('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('none');
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'update' | 'create'>('skip');
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importErrors, setImportErrors] = useState<any[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper function to get auth token
  const getAuthToken = () => {
    return localStorage.getItem('kimiya_access_token');
  };

  // Reset modal state
  const resetState = () => {
    setActiveTab('upload');
    setSelectedFile(null);
    setParsedContacts([]);
    setSelectedGroupId('none');
    setDuplicateAction('skip');
    setIsUploading(false);
    setIsImporting(false);
    setImportProgress(0);
    setImportResults([]);
    setImportSummary(null);
    setImportErrors([]);
  };

  // Handle modal close
  const handleClose = () => {
    resetState();
    onClose();
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('File size must be less than 5MB');
        return;
      }
      setSelectedFile(file);
      parseCSVFile(file);
    }
  };

  // Handle drag and drop
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('File size must be less than 5MB');
        return;
      }
      setSelectedFile(file);
      parseCSVFile(file);
    }
  };

  // Parse CSV file
  const parseCSVFile = async (file: File) => {
    setIsUploading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error('CSV file must contain at least a header row and one data row');
        setIsUploading(false);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const contacts: ParsedContact[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const contact: any = { row: i };
        
        headers.forEach((header, index) => {
          contact[header.toLowerCase().replace(/\s+/g, '_')] = values[index] || '';
        });

        // Validate contact
        const errors: string[] = [];
        if (!contact.first_name || contact.first_name.trim().length === 0) {
          errors.push('First name is required');
        }
        
        if (contact.email && contact.email.trim()) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(contact.email.trim())) {
            errors.push('Invalid email format');
          }
        }

        contacts.push({
          ...contact,
          isValid: errors.length === 0,
          errors
        });
      }

      setParsedContacts(contacts);
      setActiveTab('preview');
      toast.success(`Parsed ${contacts.length} contacts from CSV`);
    } catch (error) {
      console.error('CSV parsing error:', error);
      toast.error('Failed to parse CSV file');
    } finally {
      setIsUploading(false);
    }
  };

  // Download CSV template
  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/contacts/template', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'contacts-import-template.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Template downloaded successfully');
      } else {
        throw new Error('Failed to download template');
      }
    } catch (error) {
      console.error('Template download error:', error);
      toast.error('Failed to download template');
    }
  };

  // Import contacts
  const importContacts = async () => {
    if (!selectedFile || parsedContacts.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);
    setActiveTab('results');

    try {
      const formData = new FormData();
      formData.append('csvFile', selectedFile);
      if (selectedGroupId && selectedGroupId !== 'none') {
        formData.append('groupId', selectedGroupId);
      }
      formData.append('duplicateAction', duplicateAction);

      const response = await fetch('/api/contacts/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setImportSummary(result.summary);
        setImportResults(result.results || []);
        setImportErrors(result.errors || []);
        setImportProgress(100);
        
        toast.success(`Import completed! ${result.summary.successful} contacts imported successfully`);
        onImportComplete();
      } else {
        throw new Error(result.message || 'Import failed');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import failed: ' + (error as Error).message);
    } finally {
      setIsImporting(false);
    }
  };

  const validContacts = parsedContacts.filter(c => c.isValid);
  const invalidContacts = parsedContacts.filter(c => !c.isValid);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Contacts
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">Upload File</TabsTrigger>
            <TabsTrigger value="preview" disabled={!selectedFile}>Preview & Configure</TabsTrigger>
            <TabsTrigger value="results" disabled={!importSummary}>Import Results</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="upload" className="h-full space-y-4">
              <div className="space-y-4">
                {/* File Upload Area */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Select CSV File</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {selectedFile ? (
                        <div className="space-y-2">
                          <FileText className="h-12 w-12 mx-auto text-green-600" />
                          <p className="text-lg font-medium">{selectedFile.name}</p>
                          <p className="text-sm text-gray-500">
                            {(selectedFile.size / 1024).toFixed(1)} KB
                          </p>
                          <Button variant="outline" size="sm" onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                            setParsedContacts([]);
                          }}>
                            Remove File
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="h-12 w-12 mx-auto text-gray-400" />
                          <p className="text-lg font-medium">Drop your CSV file here</p>
                          <p className="text-sm text-gray-500">or click to browse</p>
                          <p className="text-xs text-gray-400">Maximum file size: 5MB</p>
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </CardContent>
                </Card>

                {/* Template Download */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Need a Template?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      Download our CSV template with sample data to get started quickly.
                    </p>
                    <Button variant="outline" onClick={downloadTemplate}>
                      <Download className="h-4 w-4 mr-2" />
                      Download CSV Template
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="h-full space-y-4 overflow-y-auto">
              <div className="space-y-4">
                {/* Import Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Import Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="group-select">Assign to Group (Optional)</Label>
                        <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a group" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Group</SelectItem>
                            {contactGroups.map((group) => (
                              <SelectItem key={group.id} value={group.id.toString()}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: group.color }}
                                  />
                                  {group.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="duplicate-action">Handle Duplicates</Label>
                        <Select value={duplicateAction} onValueChange={(value: 'skip' | 'update' | 'create') => setDuplicateAction(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="skip">Skip Duplicates</SelectItem>
                            <SelectItem value="update">Update Existing</SelectItem>
                            <SelectItem value="create">Create New</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Preview Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      Preview Summary
                      <div className="flex gap-2">
                        <Badge variant="secondary">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {validContacts.length} Valid
                        </Badge>
                        {invalidContacts.length > 0 && (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {invalidContacts.length} Invalid
                          </Badge>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Valid Contacts Preview */}
                      {validContacts.length > 0 && (
                        <div>
                          <h4 className="font-medium text-green-700 mb-2">Valid Contacts (showing first 5)</h4>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {validContacts.slice(0, 5).map((contact, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded">
                                <div>
                                  <span className="font-medium">{contact.first_name} {contact.last_name}</span>
                                  {contact.email && <span className="text-sm text-gray-600 ml-2">{contact.email}</span>}
                                </div>
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </div>
                            ))}
                            {validContacts.length > 5 && (
                              <p className="text-sm text-gray-500">...and {validContacts.length - 5} more</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Invalid Contacts Preview */}
                      {invalidContacts.length > 0 && (
                        <div>
                          <h4 className="font-medium text-red-700 mb-2">Invalid Contacts (will be skipped)</h4>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {invalidContacts.map((contact, index) => (
                              <div key={index} className="p-2 bg-red-50 rounded">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">Row {contact.row}: {contact.first_name || 'Unknown'}</span>
                                  <AlertCircle className="h-4 w-4 text-red-600" />
                                </div>
                                <div className="text-sm text-red-600 mt-1">
                                  {contact.errors.join(', ')}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center mt-6">
                      <Button variant="outline" onClick={() => setActiveTab('upload')}>
                        Back to Upload
                      </Button>
                      <Button
                        onClick={importContacts}
                        disabled={validContacts.length === 0 || isImporting}
                      >
                        {isImporting ? 'Importing...' : `Import ${validContacts.length} Contact${validContacts.length !== 1 ? 's' : ''}`}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="results" className="h-full space-y-4 overflow-y-auto">
              <div className="space-y-4">
                {isImporting && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Importing contacts...</span>
                          <span className="text-sm text-gray-500">{importProgress}%</span>
                        </div>
                        <Progress value={importProgress} className="w-full" />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {importSummary && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        Import Complete
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="text-center p-3 bg-blue-50 rounded">
                          <div className="text-2xl font-bold text-blue-600">{importSummary.totalRows}</div>
                          <div className="text-sm text-blue-600">Total Rows</div>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded">
                          <div className="text-2xl font-bold text-green-600">{importSummary.successful}</div>
                          <div className="text-sm text-green-600">Created</div>
                        </div>
                        <div className="text-center p-3 bg-yellow-50 rounded">
                          <div className="text-2xl font-bold text-yellow-600">{importSummary.updated}</div>
                          <div className="text-sm text-yellow-600">Updated</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded">
                          <div className="text-2xl font-bold text-gray-600">{importSummary.skipped}</div>
                          <div className="text-sm text-gray-600">Skipped</div>
                        </div>
                      </div>

                      {importErrors.length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-medium text-red-700 mb-2">Errors ({importErrors.length})</h4>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {importErrors.map((error, index) => (
                              <div key={index} className="p-2 bg-red-50 rounded text-sm">
                                <span className="font-medium">Row {error.row}:</span> {error.error}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center mt-6">
                        <Button variant="outline" onClick={handleClose}>
                          Close
                        </Button>
                        <Button onClick={() => {
                          resetState();
                          setActiveTab('upload');
                        }}>
                          Import More Contacts
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ImportContactsModal;
