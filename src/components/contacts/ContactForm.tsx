import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, X, Plus } from 'lucide-react';
import { toast } from 'sonner';

const contactSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100, 'First name too long'),
  last_name: z.string().max(100, 'Last name too long').optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().max(20, 'Phone number too long').optional(),
  company: z.string().max(255, 'Company name too long').optional(),
  job_title: z.string().max(255, 'Job title too long').optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  group_id: z.string().optional(),
  is_favorite: z.boolean().default(false),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactGroup {
  id: number;
  name: string;
  description?: string;
  color?: string;
}

interface ContactTag {
  id: number;
  name: string;
  color?: string;
}

interface Contact {
  id?: number;
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  address?: string;
  notes?: string;
  group_id?: number;
  is_favorite: boolean;
  tags?: ContactTag[];
}

interface ContactFormProps {
  contact?: Contact;
  onSubmit: (data: ContactFormData & { tags: number[] }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const ContactForm: React.FC<ContactFormProps> = ({
  contact,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [tags, setTags] = useState<ContactTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      first_name: contact?.first_name || '',
      last_name: contact?.last_name || '',
      email: contact?.email || '',
      phone: contact?.phone || '',
      company: contact?.company || '',
      job_title: contact?.job_title || '',
      address: contact?.address || '',
      notes: contact?.notes || '',
      group_id: contact?.group_id?.toString() || 'none',
      is_favorite: contact?.is_favorite || false,
    },
  });

  // Fetch groups and tags
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [groupsResponse, tagsResponse] = await Promise.all([
          fetch('/api/contact-groups', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('kimiya_access_token')}` },
          }),
          fetch('/api/contact-tags', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('kimiya_access_token')}` },
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

    fetchData();

    // Set selected tags if editing
    if (contact?.tags) {
      setSelectedTags(contact.tags.map(tag => tag.id));
    }
  }, [contact]);

  // Handle form submission
  const handleFormSubmit = async (data: ContactFormData) => {
    try {
      setError(null);

      // Convert "none" back to empty string for group_id
      const processedData = {
        ...data,
        group_id: data.group_id === 'none' ? '' : data.group_id,
        tags: selectedTags,
      };

      await onSubmit(processedData);
    } catch (error: any) {
      setError(error.message || 'Failed to save contact');
    }
  };

  // Toggle tag selection
  const toggleTag = (tagId: number) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  // Create new tag
  const createTag = async () => {
    if (!newTagName.trim()) return;

    setIsCreatingTag(true);
    try {
      const response = await fetch('/api/contact-tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('kimiya_access_token')}`,
        },
        body: JSON.stringify({
          name: newTagName.trim(),
          color: `#${Math.floor(Math.random()*16777215).toString(16)}`, // Random color
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create tag');
      }

      const result = await response.json();
      const newTag = result.data;
      
      setTags(prev => [...prev, newTag]);
      setSelectedTags(prev => [...prev, newTag.id]);
      setNewTagName('');
      toast.success('Tag created successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create tag');
    } finally {
      setIsCreatingTag(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="font-medium">Basic Information</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="first_name">First Name *</Label>
            <Input
              id="first_name"
              {...register('first_name')}
              className={errors.first_name ? 'border-red-500' : ''}
            />
            {errors.first_name && (
              <p className="text-sm text-red-500">{errors.first_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="last_name">Last Name</Label>
            <Input
              id="last_name"
              {...register('last_name')}
              className={errors.last_name ? 'border-red-500' : ''}
            />
            {errors.last_name && (
              <p className="text-sm text-red-500">{errors.last_name.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              {...register('phone')}
              className={errors.phone ? 'border-red-500' : ''}
            />
            {errors.phone && (
              <p className="text-sm text-red-500">{errors.phone.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Professional Information */}
      <div className="space-y-4">
        <h3 className="font-medium">Professional Information</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              {...register('company')}
              className={errors.company ? 'border-red-500' : ''}
            />
            {errors.company && (
              <p className="text-sm text-red-500">{errors.company.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="job_title">Job Title</Label>
            <Input
              id="job_title"
              {...register('job_title')}
              className={errors.job_title ? 'border-red-500' : ''}
            />
            {errors.job_title && (
              <p className="text-sm text-red-500">{errors.job_title.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Additional Information */}
      <div className="space-y-4">
        <h3 className="font-medium">Additional Information</h3>
        
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            {...register('address')}
            rows={2}
            className={errors.address ? 'border-red-500' : ''}
          />
          {errors.address && (
            <p className="text-sm text-red-500">{errors.address.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            {...register('notes')}
            rows={3}
            className={errors.notes ? 'border-red-500' : ''}
          />
          {errors.notes && (
            <p className="text-sm text-red-500">{errors.notes.message}</p>
          )}
        </div>
      </div>

      {/* Organization */}
      <div className="space-y-4">
        <h3 className="font-medium">Organization</h3>
        
        <div className="space-y-2">
          <Label htmlFor="group_id">Group</Label>
          <Select
            value={watch('group_id')}
            onValueChange={(value) => setValue('group_id', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Group</SelectItem>
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
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleTag(tag.id)}
                style={{
                  backgroundColor: selectedTags.includes(tag.id) && tag.color ? tag.color : undefined,
                }}
              >
                {tag.name}
                {selectedTags.includes(tag.id) && (
                  <X className="h-3 w-3 ml-1" />
                )}
              </Badge>
            ))}
          </div>
          
          {/* Create new tag */}
          <div className="flex gap-2">
            <Input
              placeholder="Create new tag..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createTag()}
            />
            <Button
              type="button"
              variant="outline"
              onClick={createTag}
              disabled={!newTagName.trim() || isCreatingTag}
            >
              {isCreatingTag ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Favorite */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_favorite"
            checked={watch('is_favorite')}
            onCheckedChange={(checked) => setValue('is_favorite', !!checked)}
          />
          <Label htmlFor="is_favorite">Mark as favorite</Label>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {contact ? 'Update Contact' : 'Create Contact'}
        </Button>
      </div>
    </form>
  );
};

export default ContactForm;
