import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Contact, 
  Search, 
  Phone, 
  Mail, 
  User,
  Settings,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { ComponentDefinition } from '../../../../types/componentTypes';
import BaseNode from '../BaseNode';

interface ContactLookupNodeData {
  searchField: 'phone' | 'email' | 'name' | 'dynamic';
  searchValue: string;
  outputFields: string[];
  fallbackAction: 'continue' | 'end' | 'transfer';
  fallbackMessage: string;
  selectedContact?: {
    id: number;
    name: string;
    phone?: string;
    email?: string;
  };
}

interface ContactLookupNodeProps {
  id: string;
  data: ContactLookupNodeData;
  selected: boolean;
}

const ContactLookupNode: React.FC<ContactLookupNodeProps> = ({ id, data, selected }) => {
  const [nodeData, setNodeData] = useState<ContactLookupNodeData>(data);
  const [showConfig, setShowConfig] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Available output fields that can be extracted from contacts
  const availableOutputFields = [
    { value: 'first_name', label: 'First Name' },
    { value: 'last_name', label: 'Last Name' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'company', label: 'Company' },
    { value: 'job_title', label: 'Job Title' },
    { value: 'group_name', label: 'Group' },
    { value: 'is_favorite', label: 'Is Favorite' },
    { value: 'last_contacted_at', label: 'Last Contact Date' },
    { value: 'interaction_count', label: 'Interaction Count' }
  ];

  // Search contacts based on current configuration
  const searchContacts = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        search: query,
        limit: '10'
      });

      const response = await fetch(`/api/contacts?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kimiya_access_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.data);
      }
    } catch (error) {
      console.error('Error searching contacts:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle contact selection
  const selectContact = (contact: any) => {
    const selectedContact = {
      id: contact.id,
      name: `${contact.first_name} ${contact.last_name || ''}`.trim(),
      phone: contact.phone,
      email: contact.email
    };

    setNodeData(prev => ({
      ...prev,
      selectedContact
    }));

    setSearchResults([]);
  };

  // Update node data
  const updateNodeData = (updates: Partial<ContactLookupNodeData>) => {
    const newData = { ...nodeData, ...updates };
    setNodeData(newData);
    // Here you would typically update the flow store
    // updateNodeData(id, newData);
  };

  // Get node status based on configuration
  const getNodeStatus = () => {
    if (!nodeData.searchField || !nodeData.searchValue) {
      return { status: 'incomplete', message: 'Configuration required' };
    }
    if (nodeData.selectedContact) {
      return { status: 'configured', message: 'Contact selected' };
    }
    return { status: 'ready', message: 'Ready to search' };
  };

  const status = getNodeStatus();

  return (
    <>
      <BaseNode id={id} selected={selected} definition={contactLookupDefinition}>
        <div className="w-64">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Contact className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-sm">Contact Lookup</span>
            </div>
            <div className="flex items-center space-x-1">
              {status.status === 'configured' && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              {status.status === 'incomplete' && (
                <AlertCircle className="h-4 w-4 text-orange-500" />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfig(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2 text-xs text-gray-600">
            <div>
              <strong>Search by:</strong> {nodeData.searchField || 'Not set'}
            </div>
            <div>
              <strong>Value:</strong> {nodeData.searchValue || 'Not set'}
            </div>
            {nodeData.selectedContact && (
              <div className="bg-green-50 p-2 rounded border">
                <strong>Selected:</strong> {nodeData.selectedContact.name}
                {nodeData.selectedContact.phone && (
                  <div className="flex items-center mt-1">
                    <Phone className="h-3 w-3 mr-1" />
                    {nodeData.selectedContact.phone}
                  </div>
                )}
              </div>
            )}
            {nodeData.outputFields.length > 0 && (
              <div>
                <strong>Output:</strong> {nodeData.outputFields.length} field(s)
              </div>
            )}
          </div>

          <div className="mt-3 text-xs">
            <Badge 
              variant={status.status === 'configured' ? 'default' : 'secondary'}
              className="text-xs"
            >
              {status.message}
            </Badge>
          </div>
        </div>

        {/* Input Handle */}
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 bg-blue-500"
        />

        {/* Output Handles */}
        <Handle
          type="source"
          position={Position.Right}
          id="found"
          className="w-3 h-3 bg-green-500"
          style={{ top: '40%' }}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="not-found"
          className="w-3 h-3 bg-red-500"
          style={{ top: '60%' }}
        />
      </BaseNode>

      {/* Configuration Dialog */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configure Contact Lookup</DialogTitle>
            <DialogDescription>
              Set up how this node will search for and retrieve contact information.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Search Configuration */}
            <div className="space-y-4">
              <h3 className="font-medium">Search Configuration</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="searchField">Search Field</Label>
                  <Select
                    value={nodeData.searchField}
                    onValueChange={(value: any) => updateNodeData({ searchField: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">Phone Number</SelectItem>
                      <SelectItem value="email">Email Address</SelectItem>
                      <SelectItem value="name">Full Name</SelectItem>
                      <SelectItem value="dynamic">Dynamic (from variable)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="searchValue">Search Value</Label>
                  <Input
                    id="searchValue"
                    value={nodeData.searchValue}
                    onChange={(e) => updateNodeData({ searchValue: e.target.value })}
                    placeholder={
                      nodeData.searchField === 'dynamic' 
                        ? '{{caller_phone}}' 
                        : 'Enter search value'
                    }
                  />
                </div>
              </div>
            </div>

            {/* Contact Search & Selection */}
            {nodeData.searchField && nodeData.searchValue && nodeData.searchField !== 'dynamic' && (
              <div className="space-y-4">
                <h3 className="font-medium">Test Search & Select Contact</h3>
                
                <div className="flex space-x-2">
                  <Input
                    placeholder="Search contacts..."
                    onChange={(e) => searchContacts(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    onClick={() => searchContacts(nodeData.searchValue)}
                    disabled={isSearching}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-2">
                    {searchResults.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer"
                        onClick={() => selectContact(contact)}
                      >
                        <div>
                          <div className="font-medium">
                            {contact.first_name} {contact.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {contact.email} • {contact.phone}
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          Select
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Output Fields Configuration */}
            <div className="space-y-4">
              <h3 className="font-medium">Output Fields</h3>
              <div className="grid grid-cols-2 gap-2">
                {availableOutputFields.map((field) => (
                  <label key={field.value} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={nodeData.outputFields.includes(field.value)}
                      onChange={(e) => {
                        const newFields = e.target.checked
                          ? [...nodeData.outputFields, field.value]
                          : nodeData.outputFields.filter(f => f !== field.value);
                        updateNodeData({ outputFields: newFields });
                      }}
                    />
                    <span className="text-sm">{field.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Fallback Configuration */}
            <div className="space-y-4">
              <h3 className="font-medium">Fallback Action (Contact Not Found)</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fallbackAction">Action</Label>
                  <Select
                    value={nodeData.fallbackAction}
                    onValueChange={(value: any) => updateNodeData({ fallbackAction: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="continue">Continue Flow</SelectItem>
                      <SelectItem value="end">End Call</SelectItem>
                      <SelectItem value="transfer">Transfer to Agent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="fallbackMessage">Message</Label>
                  <Input
                    id="fallbackMessage"
                    value={nodeData.fallbackMessage}
                    onChange={(e) => updateNodeData({ fallbackMessage: e.target.value })}
                    placeholder="Contact not found message"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowConfig(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowConfig(false)}>
                Save Configuration
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Component definition for the flow builder
export const contactLookupDefinition: ComponentDefinition = {
  type: 'contact_lookup',
  name: 'Contact Lookup',
  description: 'Search and retrieve contact information from the database',
  category: 'contacts',
  icon: Contact,
  color: '#3B82F6',
  inputs: [
    {
      id: 'input',
      name: 'Input',
      type: 'flow',
      position: Position.Left
    }
  ],
  outputs: [
    {
      id: 'found',
      name: 'Contact Found',
      type: 'flow',
      position: Position.Right
    },
    {
      id: 'not-found',
      name: 'Not Found',
      type: 'flow',
      position: Position.Right
    }
  ],
  defaultData: {
    searchField: 'phone',
    searchValue: '{{caller_phone}}',
    outputFields: ['first_name', 'last_name', 'phone', 'email'],
    fallbackAction: 'continue',
    fallbackMessage: 'Contact not found in our database.'
  },
  component: ContactLookupNode,
  validation: (data: ContactLookupNodeData) => {
    const errors: string[] = [];
    
    if (!data.searchField) {
      errors.push('Search field is required');
    }
    
    if (!data.searchValue) {
      errors.push('Search value is required');
    }
    
    if (data.outputFields.length === 0) {
      errors.push('At least one output field must be selected');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

export default ContactLookupNode;
