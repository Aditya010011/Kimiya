import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Phone,
  Mail,
  Building,
  Star,
  StarOff,
  Edit,
  Trash2,
  Users,
  Tag,
  User,
  Contact as ContactIcon,
  Upload,
  Download
} from 'lucide-react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import ContactForm from '@/components/contacts/ContactForm';
import ContactDetailsModal from '@/components/contacts/ContactDetailsModal';
import GroupManagement from '@/components/contacts/GroupManagement';
import ImportContactsModal from '@/components/contacts/ImportContactsModal';
import ExportContactsModal from '@/components/contacts/ExportContactsModal';
import { AuthService } from '@/services/authService';
import { toast } from 'sonner';

interface Contact {
  id: number;
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  address?: string;
  notes?: string;
  group_id?: number;
  group_name?: string;
  group_color?: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  last_contacted_at?: string;
  interaction_count: number;
  last_interaction_type?: string;
  created_by?: number;
  created_by_name?: string;
  tags?: ContactTag[];
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

interface ContactTag {
  id: number;
  name: string;
  color?: string;
  usage_count?: number;
  created_by?: number;
  created_by_name?: string;
}

const Contacts: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [tags, setTags] = useState<ContactTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState('first_name');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'contacts' | 'groups'>('contacts');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

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

  // Fetch contacts with filters
  const fetchContacts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        search: searchTerm,
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      if (selectedGroup !== 'all') {
        params.append('group_id', selectedGroup);
      }

      if (showFavoritesOnly) {
        params.append('is_favorite', 'true');
      }

      const response = await fetch(`/api/contacts?${params}`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch contacts');
      }

      const data = await response.json();
      setContacts(data.data);
      setTotalPages(data.pagination.pages);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  // Fetch groups and tags
  const fetchGroupsAndTags = async () => {
    try {
      const [groupsResponse, tagsResponse] = await Promise.all([
        fetch('/api/contact-groups', {
          headers: { 'Authorization': `Bearer ${getAuthToken()}` },
        }),
        fetch('/api/contact-tags', {
          headers: { 'Authorization': `Bearer ${getAuthToken()}` },
        }),
      ]);

      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json();
        setGroups(groupsData.data);
      }

      if (tagsResponse.ok) {
        const tagsData = await tagsResponse.json();
        setTags(tagsData.data);
      }
    } catch (error) {
      console.error('Error fetching groups and tags:', error);
    }
  };

  // Toggle favorite status
  const toggleFavorite = async (contactId: number, currentStatus: boolean) => {
    try {
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) return;

      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          ...contact,
          is_favorite: !currentStatus,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update contact');
      }

      // Update local state
      setContacts(prev => prev.map(c => 
        c.id === contactId ? { ...c, is_favorite: !currentStatus } : c
      ));

      toast.success(currentStatus ? 'Removed from favorites' : 'Added to favorites');
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite status');
    }
  };

  // Create contact
  const handleCreateContact = async (data: any) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create contact');
      }

      const result = await response.json();
      setContacts(prev => [result.data, ...prev]);
      setShowCreateDialog(false);
      toast.success('Contact created successfully');
      fetchContacts(); // Refresh the list
    } catch (error: any) {
      console.error('Error creating contact:', error);
      throw error; // Re-throw to be handled by the form
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit contact
  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setShowEditDialog(true);
  };

  // Update contact
  const handleUpdateContact = async (data: any) => {
    if (!editingContact) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/contacts/${editingContact.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update contact');
      }

      const result = await response.json();
      setContacts(prev => prev.map(c => c.id === editingContact.id ? result.data : c));
      setShowEditDialog(false);
      setEditingContact(null);
      toast.success('Contact updated successfully');
      fetchContacts(); // Refresh the list
    } catch (error: any) {
      console.error('Error updating contact:', error);
      throw error; // Re-throw to be handled by the form
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete contact
  const deleteContact = async (contactId: number) => {
    if (!confirm('Are you sure you want to delete this contact?')) {
      return;
    }

    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete contact');
      }

      // Remove from local state
      setContacts(prev => prev.filter(c => c.id !== contactId));
      toast.success('Contact deleted successfully');
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('Failed to delete contact');
    }
  };

  // View contact details
  const handleViewContact = (contactId: number) => {
    setSelectedContactId(contactId);
    setShowDetailsModal(true);
  };

  // Get contact initials for avatar
  const getContactInitials = (contact: Contact) => {
    const firstInitial = contact.first_name?.[0]?.toUpperCase() || '';
    const lastInitial = contact.last_name?.[0]?.toUpperCase() || '';
    return firstInitial + lastInitial || 'C';
  };

  // Format contact display name
  const getContactDisplayName = (contact: Contact) => {
    return `${contact.first_name} ${contact.last_name || ''}`.trim();
  };

  useEffect(() => {
    fetchContacts();
  }, [currentPage, searchTerm, selectedGroup, showFavoritesOnly, sortBy, sortOrder]);

  useEffect(() => {
    fetchGroupsAndTags();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        title="Contacts"
        subtitle="Manage your contact database"
        showNewWorkflowButton={false}
      />

      <div className="p-6 max-w-7xl mx-auto">
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('contacts')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'contacts'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ContactIcon className="h-4 w-4 inline mr-2" />
            Contacts
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'groups'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="h-4 w-4 inline mr-2" />
            Groups
          </button>
        </div>

        {activeTab === 'contacts' && (
          <>
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id.toString()}>
                    <div className="flex items-center gap-2">
                      {group.color && (
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: group.color }}
                        />
                      )}
                      {group.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={showFavoritesOnly ? "default" : "outline"}
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            >
              <Star className="h-4 w-4 mr-2" />
              Favorites
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowImportModal(true)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowExportModal(true)}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>

            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Contact</DialogTitle>
                  <DialogDescription>
                    Create a new contact in your database.
                  </DialogDescription>
                </DialogHeader>
                <ContactForm
                  onSubmit={handleCreateContact}
                  onCancel={() => setShowCreateDialog(false)}
                  isLoading={isSubmitting}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Contacts Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <ContactIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || selectedGroup !== 'all' || showFavoritesOnly
                  ? 'Try adjusting your filters or search terms.'
                  : 'Get started by adding your first contact.'}
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contacts.map((contact) => (
              <Card key={contact.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-blue-600 text-white">
                          {getContactInitials(contact)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">
                          {getContactDisplayName(contact)}
                        </h3>
                        {contact.job_title && (
                          <p className="text-sm text-gray-500 truncate">
                            {contact.job_title}
                          </p>
                        )}
                        {contact.company && (
                          <p className="text-sm text-gray-500 truncate">
                            {contact.company}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleFavorite(contact.id, contact.is_favorite)}
                      >
                        {contact.is_favorite ? (
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                        ) : (
                          <StarOff className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleViewContact(contact.id)}>
                            <User className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditContact(contact)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => deleteContact(contact.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {contact.email && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="h-4 w-4 mr-2" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="h-4 w-4 mr-2" />
                        <span>{contact.phone}</span>
                      </div>
                    )}
                  </div>

                  {contact.group_name && (
                    <div className="mt-3">
                      <Badge 
                        variant="secondary" 
                        className="text-xs"
                        style={{ 
                          backgroundColor: contact.group_color ? `${contact.group_color}20` : undefined,
                          borderColor: contact.group_color || undefined 
                        }}
                      >
                        <Users className="h-3 w-3 mr-1" />
                        {contact.group_name}
                      </Badge>
                    </div>
                  )}

                  {contact.interaction_count > 0 && (
                    <div className="mt-3 text-xs text-gray-500">
                      {contact.interaction_count} interaction{contact.interaction_count !== 1 ? 's' : ''}
                      {contact.last_interaction_type && (
                        <span> • Last: {contact.last_interaction_type}</span>
                      )}
                    </div>
                  )}

                  {/* Show creator info for admin users */}
                  {isAdmin() && contact.created_by_name && (
                    <div className="mt-2 text-xs text-gray-400">
                      Created by: {contact.created_by_name}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-8">
            <div className="flex space-x-2">
              <Button
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </Button>
              <span className="flex items-center px-4 text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
          </>
        )}

        {/* Groups Tab Content */}
        {activeTab === 'groups' && (
          <GroupManagement />
        )}
      </div>

      {/* Contact-specific dialogs - only show on contacts tab */}
      {activeTab === 'contacts' && (
        <>
          {/* Edit Contact Dialog */}
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>
              Update contact information.
            </DialogDescription>
          </DialogHeader>
          {editingContact && (
            <ContactForm
              contact={editingContact}
              onSubmit={handleUpdateContact}
              onCancel={() => {
                setShowEditDialog(false);
                setEditingContact(null);
              }}
              isLoading={isSubmitting}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Contact Details Modal */}
      <ContactDetailsModal
        contactId={selectedContactId}
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedContactId(null);
        }}
        onEdit={(contact) => {
          setShowDetailsModal(false);
          handleEditContact(contact);
        }}
        onToggleFavorite={(contactId, isFavorite) => {
          setContacts(prev => prev.map(c =>
            c.id === contactId ? { ...c, is_favorite: isFavorite } : c
          ));
        }}
      />

      {/* Import Contacts Modal */}
      <ImportContactsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => {
          fetchContacts();
          fetchGroupsAndTags();
        }}
        contactGroups={groups}
      />

      {/* Export Contacts Modal */}
      <ExportContactsModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        contactGroups={groups}
        totalContacts={contacts.length}
        currentFilters={{
          search: searchTerm || undefined,
          groupId: selectedGroup !== 'all' ? parseInt(selectedGroup) : undefined,
          isFavorite: showFavoritesOnly || undefined
        }}
      />
        </>
      )}
    </div>
  );
};

export default Contacts;
