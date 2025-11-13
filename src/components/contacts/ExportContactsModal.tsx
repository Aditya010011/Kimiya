import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Users, Star, Building } from 'lucide-react';
import { toast } from 'sonner';

interface ContactGroup {
  id: number;
  name: string;
  color: string;
  contact_count?: number;
}

interface ExportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactGroups: ContactGroup[];
  totalContacts: number;
  currentFilters?: {
    search?: string;
    groupId?: number;
    tagId?: number;
    isFavorite?: boolean;
  };
}

interface ExportField {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

const ExportContactsModal: React.FC<ExportContactsModalProps> = ({
  isOpen,
  onClose,
  contactGroups,
  totalContacts,
  currentFilters = {}
}) => {
  const [exportFormat, setExportFormat] = useState<'csv'>('csv');
  const [filterType, setFilterType] = useState<'all' | 'current' | 'group' | 'favorites'>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  
  const [exportFields, setExportFields] = useState<ExportField[]>([
    { id: 'first_name', label: 'First Name', description: 'Contact\'s first name', enabled: true },
    { id: 'last_name', label: 'Last Name', description: 'Contact\'s last name', enabled: true },
    { id: 'email', label: 'Email', description: 'Email address', enabled: true },
    { id: 'phone', label: 'Phone', description: 'Phone number', enabled: true },
    { id: 'company', label: 'Company', description: 'Company name', enabled: true },
    { id: 'job_title', label: 'Job Title', description: 'Job title or position', enabled: true },
    { id: 'address', label: 'Address', description: 'Physical address', enabled: false },
    { id: 'notes', label: 'Notes', description: 'Additional notes', enabled: false },
    { id: 'group_name', label: 'Group Name', description: 'Assigned group', enabled: true },
    { id: 'is_favorite', label: 'Is Favorite', description: 'Favorite status', enabled: false },
    { id: 'created_at', label: 'Created Date', description: 'When contact was created', enabled: false },
    { id: 'updated_at', label: 'Updated Date', description: 'Last update date', enabled: false },
    { id: 'created_by_name', label: 'Created By', description: 'Who created the contact', enabled: false }
  ]);

  // Helper function to get auth token
  const getAuthToken = () => {
    return localStorage.getItem('kimiya_access_token');
  };

  // Check if current user is admin
  const isAdmin = () => {
    const userStr = localStorage.getItem('kimiya_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.role === 'admin';
    }
    return false;
  };

  // Toggle field selection
  const toggleField = (fieldId: string) => {
    setExportFields(fields => 
      fields.map(field => 
        field.id === fieldId 
          ? { ...field, enabled: !field.enabled }
          : field
      )
    );
  };

  // Select all fields
  const selectAllFields = () => {
    setExportFields(fields => fields.map(field => ({ ...field, enabled: true })));
  };

  // Deselect all fields
  const deselectAllFields = () => {
    setExportFields(fields => fields.map(field => ({ ...field, enabled: false })));
  };

  // Get export parameters
  const getExportParams = () => {
    const params = new URLSearchParams();
    
    // Format
    params.append('format', exportFormat);
    
    // Fields
    const selectedFields = exportFields.filter(f => f.enabled).map(f => f.id);
    if (selectedFields.length > 0) {
      params.append('fields', selectedFields.join(','));
    }
    
    // Filters
    switch (filterType) {
      case 'current':
        if (currentFilters.search) {
          params.append('search', currentFilters.search);
        }
        if (currentFilters.groupId) {
          params.append('groupId', currentFilters.groupId.toString());
        }
        if (currentFilters.tagId) {
          params.append('tagId', currentFilters.tagId.toString());
        }
        if (currentFilters.isFavorite !== undefined) {
          params.append('isFavorite', currentFilters.isFavorite.toString());
        }
        break;
      case 'group':
        if (selectedGroupId) {
          params.append('groupId', selectedGroupId);
        }
        break;
      case 'favorites':
        params.append('isFavorite', 'true');
        break;
      // 'all' case doesn't need additional parameters
    }
    
    return params;
  };

  // Estimate export count
  const getEstimatedCount = () => {
    switch (filterType) {
      case 'current':
        // This would ideally come from the parent component
        return totalContacts;
      case 'group':
        const selectedGroup = contactGroups.find(g => g.id.toString() === selectedGroupId);
        return selectedGroup?.contact_count || 0;
      case 'favorites':
        // This would ideally be passed from parent
        return '?';
      case 'all':
      default:
        return totalContacts;
    }
  };

  // Export contacts
  const exportContacts = async () => {
    const selectedFields = exportFields.filter(f => f.enabled);
    if (selectedFields.length === 0) {
      toast.error('Please select at least one field to export');
      return;
    }

    setIsExporting(true);
    
    try {
      const params = getExportParams();
      const response = await fetch(`/api/contacts/export?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });

      if (response.ok) {
        // Get filename from response headers or create default
        const contentDisposition = response.headers.get('content-disposition');
        let filename = 'contacts-export.csv';
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="(.+)"/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success('Contacts exported successfully');
        onClose();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Export failed');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed: ' + (error as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const enabledFieldsCount = exportFields.filter(f => f.enabled).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Contacts
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Export Format */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Export Format</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={exportFormat} onValueChange={(value: 'csv') => setExportFormat(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      CSV (Comma Separated Values)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Filter Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What to Export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="all"
                    name="filterType"
                    value="all"
                    checked={filterType === 'all'}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="all" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    All Contacts ({totalContacts})
                  </Label>
                </div>

                {(currentFilters.search || currentFilters.groupId || currentFilters.tagId || currentFilters.isFavorite !== undefined) && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="current"
                      name="filterType"
                      value="current"
                      checked={filterType === 'current'}
                      onChange={(e) => setFilterType(e.target.value as any)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="current" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Current Filtered Results
                    </Label>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="group"
                    name="filterType"
                    value="group"
                    checked={filterType === 'group'}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="group" className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Specific Group
                  </Label>
                </div>

                {filterType === 'group' && (
                  <div className="ml-6">
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a group" />
                      </SelectTrigger>
                      <SelectContent>
                        {contactGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id.toString()}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: group.color }}
                              />
                              {group.name}
                              {group.contact_count !== undefined && (
                                <Badge variant="secondary" className="ml-2">
                                  {group.contact_count}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="favorites"
                    name="filterType"
                    value="favorites"
                    checked={filterType === 'favorites'}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="favorites" className="flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Favorite Contacts Only
                  </Label>
                </div>
              </div>

              <div className="pt-2 border-t">
                <p className="text-sm text-gray-600">
                  Estimated contacts to export: <strong>{getEstimatedCount()}</strong>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Field Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                Select Fields to Export
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllFields}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAllFields}>
                    Deselect All
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {exportFields.map((field) => (
                  <div key={field.id} className="flex items-start space-x-2">
                    <Checkbox
                      id={field.id}
                      checked={field.enabled}
                      onCheckedChange={() => toggleField(field.id)}
                    />
                    <div className="flex-1">
                      <Label htmlFor={field.id} className="font-medium cursor-pointer">
                        {field.label}
                      </Label>
                      <p className="text-xs text-gray-500">{field.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-600">
                  Selected fields: <strong>{enabledFieldsCount}</strong> of {exportFields.length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={exportContacts}
            disabled={isExporting || enabledFieldsCount === 0}
          >
            {isExporting ? 'Exporting...' : `Export ${getEstimatedCount()} Contact${getEstimatedCount() !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportContactsModal;
