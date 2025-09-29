import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Users, 
  Search, 
  Plus, 
  X, 
  Mail, 
  Phone, 
  Building, 
  UserMinus,
  MoreVertical,
  Check,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface Contact {
  id: number;
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  is_favorite: boolean;
  created_by?: number;
  created_by_name?: string;
}

interface ContactGroup {
  id: number;
  name: string;
  description?: string;
  color?: string;
  contact_count: number;
  created_at: string;
  updated_at: string;
  created_by?: number;
  created_by_name?: string;
}

interface GroupDetailModalProps {
  group: ContactGroup | null;
  isOpen: boolean;
  onClose: () => void;
  onGroupUpdate: () => void;
}

const GroupDetailModal: React.FC<GroupDetailModalProps> = ({
  group,
  isOpen,
  onClose,
  onGroupUpdate
}) => {
  const [groupContacts, setGroupContacts] = useState<Contact[]>([]);
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingContacts, setAddingContacts] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(new Set());
  const [showAddContacts, setShowAddContacts] = useState(false);

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

  // Fetch contacts in this group
  const fetchGroupContacts = async () => {
    if (!group) return;

    setLoading(true);
    try {
      console.log(`Fetching contacts for group ${group.id}...`);
      const response = await fetch(`/api/contacts?group_id=${group.id}&limit=1000`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const contacts = data.data || [];
        console.log(`Found ${contacts.length} contacts in group ${group.id}:`, contacts);
        setGroupContacts(contacts);
      } else {
        console.error('Failed to fetch group contacts - Response not OK:', response.status, response.statusText);
        throw new Error('Failed to fetch group contacts');
      }
    } catch (error) {
      console.error('Error fetching group contacts:', error);
      toast.error('Failed to load group contacts');
    } finally {
      setLoading(false);
    }
  };

  // Fetch all available contacts (not in this group)
  const fetchAvailableContacts = async () => {
    if (!group) return;

    try {
      console.log('Fetching all contacts to determine available ones...');
      const response = await fetch('/api/contacts?limit=1000', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const allContacts = data.data || [];
        console.log(`Total contacts in system: ${allContacts.length}`);

        // Filter out contacts already in this group
        const groupContactIds = new Set(groupContacts.map(c => c.id));
        console.log(`Contacts already in group ${group.id}:`, Array.from(groupContactIds));

        const available = allContacts.filter((contact: Contact) =>
          !groupContactIds.has(contact.id)
        );

        console.log(`Available contacts to add to group ${group.id}: ${available.length}`);
        setAvailableContacts(available);
      } else {
        console.error('Failed to fetch available contacts - Response not OK:', response.status, response.statusText);
        throw new Error('Failed to fetch available contacts');
      }
    } catch (error) {
      console.error('Error fetching available contacts:', error);
      toast.error('Failed to load available contacts');
    }
  };

  // Add selected contacts to group
  const addContactsToGroup = async () => {
    if (!group || selectedContactIds.size === 0) return;

    setAddingContacts(true);
    try {
      const promises = Array.from(selectedContactIds).map(async (contactId) => {
        try {
          console.log(`Processing contact ${contactId} for group ${group.id}...`);

          // First fetch the current contact data
          const getResponse = await fetch(`/api/contacts/${contactId}`, {
            headers: {
              'Authorization': `Bearer ${getAuthToken()}`,
            },
          });

          if (!getResponse.ok) {
            console.error(`Failed to fetch contact ${contactId}: ${getResponse.status} ${getResponse.statusText}`);
            const errorText = await getResponse.text();
            console.error('GET Error details:', errorText);
            throw new Error(`Failed to fetch contact ${contactId}: ${getResponse.status}`);
          }

          const contactData = await getResponse.json();
          const contact = contactData.data;
          console.log(`Fetched contact ${contactId}:`, contact);

          // Then update with the new group_id
          const updatePayload = {
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email,
            phone: contact.phone,
            company: contact.company,
            job_title: contact.job_title,
            address: contact.address,
            notes: contact.notes,
            group_id: group.id,
            is_favorite: contact.is_favorite,
            tags: contact.tags || []
          };

          console.log(`Updating contact ${contactId} with payload:`, updatePayload);

          const updateResponse = await fetch(`/api/contacts/${contactId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${getAuthToken()}`,
            },
            body: JSON.stringify(updatePayload),
          });

          if (!updateResponse.ok) {
            console.error(`Failed to update contact ${contactId}: ${updateResponse.status} ${updateResponse.statusText}`);
            const errorText = await updateResponse.text();
            console.error('PUT Error details:', errorText);
          }

          return updateResponse;
        } catch (error) {
          console.error(`Error processing contact ${contactId}:`, error);
          // Return a fake failed response to maintain promise structure
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            statusText: 'Internal Error'
          });
        }
      });

      const results = await Promise.all(promises);
      const failedResults = results.filter(r => !r.ok);
      const failedCount = failedResults.length;

      if (failedCount === 0) {
        toast.success(`Added ${selectedContactIds.size} contact(s) to group`);
        setSelectedContactIds(new Set());
        setShowAddContacts(false);
        await fetchGroupContacts();
        await fetchAvailableContacts();
        onGroupUpdate();
      } else {
        // Log detailed error information
        console.error('Failed API calls:', failedResults);
        for (const failedResult of failedResults) {
          const errorText = await failedResult.text();
          console.error(`API Error ${failedResult.status}:`, errorText);
        }
        toast.error(`Failed to add ${failedCount} contact(s). Check console for details.`);
      }
    } catch (error) {
      console.error('Error adding contacts to group:', error);
      toast.error('Failed to add contacts to group');
    } finally {
      setAddingContacts(false);
    }
  };

  // Remove contact from group
  const removeContactFromGroup = async (contactId: number) => {
    if (!group) return;

    try {
      // First fetch the current contact data
      const getResponse = await fetch(`/api/contacts/${contactId}`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });

      if (!getResponse.ok) {
        throw new Error('Failed to fetch contact data');
      }

      const contactData = await getResponse.json();
      const contact = contactData.data;

      // Then update with group_id set to null
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
          job_title: contact.job_title,
          address: contact.address,
          notes: contact.notes,
          group_id: null,
          is_favorite: contact.is_favorite,
          tags: contact.tags || []
        }),
      });

      if (response.ok) {
        toast.success('Contact removed from group');
        await fetchGroupContacts();
        await fetchAvailableContacts();
        onGroupUpdate();
      } else {
        throw new Error('Failed to remove contact from group');
      }
    } catch (error) {
      console.error('Error removing contact from group:', error);
      toast.error('Failed to remove contact from group');
    }
  };

  // Filter available contacts based on search
  const filteredAvailableContacts = availableContacts.filter(contact => {
    const searchLower = searchTerm.toLowerCase();
    return (
      contact.first_name.toLowerCase().includes(searchLower) ||
      (contact.last_name && contact.last_name.toLowerCase().includes(searchLower)) ||
      (contact.email && contact.email.toLowerCase().includes(searchLower)) ||
      (contact.phone && contact.phone.includes(searchTerm)) ||
      (contact.company && contact.company.toLowerCase().includes(searchLower))
    );
  });

  // Toggle contact selection
  const toggleContactSelection = (contactId: number) => {
    const newSelection = new Set(selectedContactIds);
    if (newSelection.has(contactId)) {
      newSelection.delete(contactId);
    } else {
      newSelection.add(contactId);
    }
    setSelectedContactIds(newSelection);
  };

  // Select all filtered contacts
  const selectAllFiltered = () => {
    const newSelection = new Set(selectedContactIds);
    filteredAvailableContacts.forEach(contact => {
      newSelection.add(contact.id);
    });
    setSelectedContactIds(newSelection);
  };

  // Clear all selections
  const clearAllSelections = () => {
    setSelectedContactIds(new Set());
  };

  useEffect(() => {
    if (isOpen && group) {
      fetchGroupContacts();
    }
  }, [isOpen, group]);

  useEffect(() => {
    if (showAddContacts) {
      // Always fetch available contacts when showing the add contacts view
      // This should work regardless of whether the group is empty or has contacts
      fetchAvailableContacts();
    }
  }, [showAddContacts, groupContacts]); // Keep groupContacts dependency to re-filter when group membership changes

  if (!group) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded-full" 
              style={{ backgroundColor: group.color || '#3B82F6' }}
            />
            {group.name}
            <Badge variant="secondary" className="ml-2">
              {groupContacts.length} contact{groupContacts.length !== 1 ? 's' : ''}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {group.description || 'Manage contacts in this group'}
            {isAdmin() && group.created_by_name && (
              <span className="block text-xs text-gray-400 mt-1">
                Created by: {group.created_by_name}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {!showAddContacts ? (
            <>
              {/* Group Contacts View */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Contacts in Group</h3>
                <Button 
                  onClick={() => setShowAddContacts(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Contacts
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Loading contacts...</span>
                  </div>
                ) : groupContacts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No contacts in this group yet</p>
                    <p className="text-sm">Click "Add Contacts" to get started</p>
                    {process.env.NODE_ENV === 'development' && (
                      <p className="text-xs text-gray-400 mt-2">
                        Debug: Group ID {group?.id}, Contacts loaded: {groupContacts.length}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {groupContacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex-1 min-w-0">
                          {/* First line: Name and favorite indicator */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900 truncate">
                              {contact.first_name} {contact.last_name || ''}
                            </span>
                            {contact.is_favorite && (
                              <Badge variant="secondary" className="text-xs px-1.5 py-0.5">★</Badge>
                            )}
                          </div>

                          {/* Second line: Contact details */}
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            {contact.email && (
                              <div className="flex items-center gap-1 truncate">
                                <Mail className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{contact.email}</span>
                              </div>
                            )}
                            {contact.phone && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Phone className="h-3 w-3" />
                                <span>{contact.phone}</span>
                              </div>
                            )}
                            {contact.company && (
                              <div className="flex items-center gap-1 truncate">
                                <Building className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">
                                  {contact.company}
                                  {contact.job_title && ` • ${contact.job_title}`}
                                </span>
                              </div>
                            )}
                            {isAdmin() && contact.created_by_name && (
                              <div className="text-xs text-gray-400 flex-shrink-0">
                                by {contact.created_by_name}
                              </div>
                            )}
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeContactFromGroup(contact.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-2 flex-shrink-0"
                          title="Remove from group"
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Add Contacts View */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Add Contacts to Group</h3>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setShowAddContacts(false);
                    setSelectedContactIds(new Set());
                    setSearchTerm('');
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>

              {/* Search and Selection Controls */}
              <div className="space-y-4 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search contacts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllFiltered}
                      disabled={filteredAvailableContacts.length === 0}
                    >
                      Select All ({filteredAvailableContacts.length})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearAllSelections}
                      disabled={selectedContactIds.size === 0}
                    >
                      Clear Selection
                    </Button>
                  </div>
                  
                  {selectedContactIds.size > 0 && (
                    <Badge variant="secondary">
                      {selectedContactIds.size} selected
                    </Badge>
                  )}
                </div>
              </div>

              {/* Available Contacts List */}
              <div className="flex-1 overflow-y-auto">
                {filteredAvailableContacts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {searchTerm ? (
                      <>
                        <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>No contacts found matching "{searchTerm}"</p>
                      </>
                    ) : (
                      <>
                        <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>All contacts are already in this group</p>
                        {process.env.NODE_ENV === 'development' && (
                          <p className="text-xs text-gray-400 mt-2">
                            Debug: Available contacts: {availableContacts.length}, Group contacts: {groupContacts.length}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredAvailableContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedContactIds.has(contact.id)
                            ? 'bg-blue-50 border border-blue-200'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => toggleContactSelection(contact.id)}
                      >
                        <Checkbox
                          checked={selectedContactIds.has(contact.id)}
                          onChange={() => toggleContactSelection(contact.id)}
                          className="flex-shrink-0"
                        />

                        <div className="flex-1 min-w-0">
                          {/* First line: Name and favorite indicator */}
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-gray-900 truncate">
                              {contact.first_name} {contact.last_name || ''}
                            </span>
                            {contact.is_favorite && (
                              <Badge variant="secondary" className="text-xs px-1.5 py-0.5">★</Badge>
                            )}
                          </div>

                          {/* Second line: Contact details */}
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            {contact.email && (
                              <div className="flex items-center gap-1 truncate">
                                <Mail className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{contact.email}</span>
                              </div>
                            )}
                            {contact.phone && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Phone className="h-3 w-3" />
                                <span>{contact.phone}</span>
                              </div>
                            )}
                            {contact.company && (
                              <div className="flex items-center gap-1 truncate">
                                <Building className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">
                                  {contact.company}
                                  {contact.job_title && ` • ${contact.job_title}`}
                                </span>
                              </div>
                            )}
                            {isAdmin() && contact.created_by_name && (
                              <div className="text-xs text-gray-400 flex-shrink-0">
                                by {contact.created_by_name}
                              </div>
                            )}
                          </div>
                        </div>

                        {selectedContactIds.has(contact.id) && (
                          <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Contacts Action */}
              {selectedContactIds.size > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <Button
                    onClick={addContactsToGroup}
                    disabled={addingContacts}
                    className="w-full"
                  >
                    {addingContacts ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding Contacts...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Add {selectedContactIds.size} Contact{selectedContactIds.size !== 1 ? 's' : ''} to Group
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GroupDetailModal;
