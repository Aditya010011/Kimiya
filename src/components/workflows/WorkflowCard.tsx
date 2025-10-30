import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Edit,
  Trash2,
  Copy,
  Clock,
  FileText,
  TrendingUp,
  User
} from 'lucide-react';

interface WorkflowCardProps {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  created_by_email: string;
  node_count?: number;
  edge_count?: number;
  is_active?: boolean;
  isTemplate?: boolean;
  isAdmin?: boolean;
  onEdit?: (id: number) => void;
  onDelete?: (id: number, name: string) => void;
  onClone?: (id: number) => void;
}

const WorkflowCard: React.FC<WorkflowCardProps> = ({
  id,
  name,
  description,
  created_at,
  updated_at,
  created_by_email,
  node_count = 0,
  edge_count = 0,
  is_active = true,
  isTemplate = false,
  isAdmin = false,
  onEdit,
  onDelete,
  onClone
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const truncateDescription = (text: string | undefined, maxLength: number = 100) => {
    if (!text) return 'No description';
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 truncate">{name}</h3>
          <Badge className={is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
            {is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-4 line-clamp-2 flex-grow">
        {truncateDescription(description)}
      </p>

      {/* Metadata */}
      <div className="space-y-2 mb-4 text-xs text-gray-500">
        <div className="flex items-center">
          <Clock className="h-3 w-3 mr-2" />
          Modified {formatDate(updated_at)}
        </div>
        <div className="flex items-center">
          <FileText className="h-3 w-3 mr-2" />
          {node_count} nodes
        </div>
        <div className="flex items-center">
          <TrendingUp className="h-3 w-3 mr-2" />
          {edge_count} edges
        </div>
        <div className="flex items-center">
          <User className="h-3 w-3 mr-2" />
          {created_by_email}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t">
        {isTemplate ? (
          <>
            {onClone && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onClone(id)}
                className="flex-1"
              >
                <Copy className="h-4 w-4 mr-1" />
                Clone
              </Button>
            )}
            {isAdmin && (
              <>
                {onEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(id)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(id, name)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(id)}
                className="flex-1"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(id, name)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WorkflowCard;

