import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Phone,
  Mail,
  Building,
  MapPin,
  Calendar,
  Star,
  StarOff,
  Edit,
  MessageSquare,
  Clock,
  User,
  Tag,
  Users,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';

interface ContactTag {
  id: number;
  name: string;
  color?: string;
}

interface ContactInteraction {
  id: number;
  interaction_type: string;
  direction?: string;
  subject?: string;
  content?: string;
  duration?: number;
  outcome?: string;
  created_at: string;
  created_by_name?: string;
}

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
  tags?: ContactTag[];
  recent_interactions?: ContactInteraction[];
}

interface ContactDetailsModalProps {
  contactId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (contact: Contact) => void;
  onToggleFavorite?: (contactId: number, isFavorite: boolean) => void;
}

const ContactDetailsModal: React.FC<ContactDetailsModalProps> = ({
  contactId,
  isOpen,
  onClose,
  onEdit,
  onToggleFavorite,
}) => {
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch contact details
  useEffect(() => {
    if (contactId && isOpen) {
      fetchContactDetails();
    }
  }, [contactId, isOpen]);

  const fetchContactDetails = async () => {
    if (!contactId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kimiya_access_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch contact details');
      }

      const data = await response.json();
      setContact(data.data);
    } catch (error) {
      console.error('Error fetching contact details:', error);
      toast.error('Failed to load contact details');
    } finally {
      setLoading(false);
    }
  };

  // Toggle favorite status
  const handleToggleFavorite = async () => {
    if (!contact) return;

    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('kimiya_access_token')}`,
        },
        body: JSON.stringify({
          ...contact,
          is_favorite: !contact.is_favorite,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update favorite status');
      }

      const updatedContact = { ...contact, is_favorite: !contact.is_favorite };
      setContact(updatedContact);
      
      if (onToggleFavorite) {
        onToggleFavorite(contact.id, updatedContact.is_favorite);
      }

      toast.success(updatedContact.is_favorite ? 'Added to favorites' : 'Removed from favorites');
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite status');
    }
  };

  // Get contact initials
  const getContactInitials = (contact: Contact) => {
    const firstInitial = contact.first_name?.[0]?.toUpperCase() || '';
    const lastInitial = contact.last_name?.[0]?.toUpperCase() || '';
    return firstInitial + lastInitial || 'C';
  };

  // Format contact display name
  const getContactDisplayName = (contact: Contact) => {
    return `${contact.first_name} ${contact.last_name || ''}`.trim();
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format interaction type
  const formatInteractionType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Get interaction icon
  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'meeting':
        return <Users className="h-4 w-4" />;
      case 'note':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {contact && (
              <>
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-blue-600 text-white text-lg">
                    {getContactInitials(contact)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    {getContactDisplayName(contact)}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleToggleFavorite}
                    >
                      {contact.is_favorite ? (
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      ) : (
                        <StarOff className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                  {contact.job_title && (
                    <p className="text-sm text-gray-500">{contact.job_title}</p>
                  )}
                </div>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            Complete contact information and interaction history
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : contact ? (
          <div className="space-y-6">
            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button onClick={() => onEdit?.(contact)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Contact
              </Button>
              {contact.phone && (
                <Button variant="outline">
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
              )}
              {contact.email && (
                <Button variant="outline">
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {contact.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span>{contact.email}</span>
                    </div>
                  )}
                  
                  {contact.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span>{contact.phone}</span>
                    </div>
                  )}
                  
                  {contact.company && (
                    <div className="flex items-center gap-3">
                      <Building className="h-4 w-4 text-gray-500" />
                      <span>{contact.company}</span>
                    </div>
                  )}
                  
                  {contact.address && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                      <span className="text-sm">{contact.address}</span>
                    </div>
                  )}

                  {contact.group_name && (
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-gray-500" />
                      <Badge 
                        variant="secondary"
                        style={{ 
                          backgroundColor: contact.group_color ? `${contact.group_color}20` : undefined,
                          borderColor: contact.group_color || undefined 
                        }}
                      >
                        {contact.group_name}
                      </Badge>
                    </div>
                  )}

                  {contact.tags && contact.tags.length > 0 && (
                    <div className="flex items-start gap-3">
                      <Tag className="h-4 w-4 text-gray-500 mt-0.5" />
                      <div className="flex flex-wrap gap-1">
                        {contact.tags.map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="outline"
                            className="text-xs"
                            style={{
                              backgroundColor: tag.color ? `${tag.color}20` : undefined,
                              borderColor: tag.color || undefined,
                            }}
                          >
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-2 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Created: {formatDate(contact.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>Updated: {formatDate(contact.updated_at)}</span>
                    </div>
                    {contact.last_contacted_at && (
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        <span>Last Contact: {formatDate(contact.last_contacted_at)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Notes and Interactions */}
              <div className="space-y-6">
                {/* Notes */}
                {contact.notes && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Notes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Interactions */}
                {contact.recent_interactions && contact.recent_interactions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Recent Interactions
                      </CardTitle>
                      <CardDescription>
                        Last {contact.recent_interactions.length} interactions
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {contact.recent_interactions.map((interaction) => (
                          <div key={interaction.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="flex-shrink-0">
                              {getInteractionIcon(interaction.interaction_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">
                                  {formatInteractionType(interaction.interaction_type)}
                                </span>
                                {interaction.direction && (
                                  <Badge variant="outline" className="text-xs">
                                    {interaction.direction}
                                  </Badge>
                                )}
                                {interaction.outcome && (
                                  <Badge variant="secondary" className="text-xs">
                                    {interaction.outcome}
                                  </Badge>
                                )}
                              </div>
                              
                              {interaction.subject && (
                                <p className="text-sm font-medium mb-1">{interaction.subject}</p>
                              )}
                              
                              {interaction.content && (
                                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                  {interaction.content}
                                </p>
                              )}
                              
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span>{formatDate(interaction.created_at)}</span>
                                {interaction.duration && (
                                  <span>{Math.floor(interaction.duration / 60)}m {interaction.duration % 60}s</span>
                                )}
                                {interaction.created_by_name && (
                                  <span>by {interaction.created_by_name}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Contact not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ContactDetailsModal;
