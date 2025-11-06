import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  File,
  FileType,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { knowledgeBaseService } from '@/services/knowledgeBaseService';

interface DocumentUploadAreaProps {
  knowledgeBaseId: string;
  onUploadComplete: () => void;
}

interface UploadFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

const DocumentUploadArea: React.FC<DocumentUploadAreaProps> = ({
  knowledgeBaseId,
  onUploadComplete
}) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedFileTypes = ['.pdf', '.docx', '.txt'];
  const maxFileSize = 50 * 1024 * 1024; // 50MB

  const validateFile = (file: File): string | null => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!acceptedFileTypes.includes(extension)) {
      return `Invalid file type. Accepted: ${acceptedFileTypes.join(', ')}`;
    }
    
    if (file.size > maxFileSize) {
      return `File too large. Maximum size: 50MB`;
    }
    
    return null;
  };

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const validFiles: UploadFile[] = [];

    fileArray.forEach(file => {
      const error = validateFile(file);
      
      if (error) {
        toast.error(`${file.name}: ${error}`);
        return;
      }

      validFiles.push({
        file,
        id: Math.random().toString(36).substring(7),
        status: 'pending',
        progress: 0
      });
    });

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      // Start uploading immediately
      validFiles.forEach(uploadFile => {
        uploadDocument(uploadFile);
      });
    }
  }, []);

  const uploadDocument = async (uploadFile: UploadFile) => {
    try {
      // Update status to uploading
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id ? { ...f, status: 'uploading', progress: 0 } : f
      ));

      // Create FormData
      const formData = new FormData();
      formData.append('file', uploadFile.file);

      // Upload with progress tracking
      await knowledgeBaseService.uploadDocument(
        knowledgeBaseId,
        formData,
        (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          );
          setFiles(prev => prev.map(f =>
            f.id === uploadFile.id ? { ...f, progress: percentCompleted } : f
          ));
        }
      );

      // Update status to success
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id ? { ...f, status: 'success', progress: 100 } : f
      ));

      toast.success(`${uploadFile.file.name} uploaded successfully`);
      onUploadComplete();
    } catch (error: any) {
      console.error('Upload error:', error);
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? { ...f, status: 'error', error: error.message || 'Upload failed' }
          : f
      ));
      toast.error(`Failed to upload ${uploadFile.file.name}`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFiles(droppedFiles);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    // Reset input
    e.target.value = '';
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'success'));
  };

  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (extension === 'pdf') return <FileType className="h-5 w-5 text-red-500" />;
    if (extension === 'docx' || extension === 'doc') return <FileText className="h-5 w-5 text-blue-500" />;
    if (extension === 'txt') return <File className="h-5 w-5 text-gray-500" />;
    return <FileText className="h-5 w-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const completedCount = files.filter(f => f.status === 'success').length;
  const uploadingCount = files.filter(f => f.status === 'uploading').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`
              border-2 border-dashed rounded-lg p-12 text-center transition-all
              ${isDragging
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-300 hover:border-gray-400 bg-gray-50'
              }
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={acceptedFileTypes.join(',')}
              onChange={handleFileInputChange}
              className="hidden"
            />

            <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragging ? 'text-indigo-600' : 'text-gray-400'}`} />
            
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {isDragging ? 'Drop files here' : 'Upload documents'}
            </h3>
            
            <p className="text-sm text-gray-600 mb-4">
              Drag and drop files here, or click to browse
            </p>

            <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <FileType className="h-4 w-4" />
                PDF
              </div>
              <div className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                DOCX
              </div>
              <div className="flex items-center gap-1">
                <File className="h-4 w-4" />
                TXT
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-2">
              Maximum file size: 50MB
            </p>
          </div>

          {/* Info */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
            <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900">
              <p className="font-medium mb-1">Processing Time</p>
              <p>
                Documents are processed asynchronously. Large files may take a few minutes to be fully indexed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Queue */}
      {files.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Upload Queue</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                {completedCount} completed • {uploadingCount} uploading • {errorCount} failed
              </p>
            </div>
            {completedCount > 0 && (
              <Button variant="outline" size="sm" onClick={clearCompleted}>
                Clear Completed
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {files.map((uploadFile) => (
                <div
                  key={uploadFile.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  {/* File Icon */}
                  <div className="flex-shrink-0">
                    {getFileIcon(uploadFile.file.name)}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {uploadFile.file.name}
                      </p>
                      <span className="text-xs text-gray-500 ml-2">
                        {formatFileSize(uploadFile.file.size)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    {uploadFile.status === 'uploading' && (
                      <div className="space-y-1">
                        <Progress value={uploadFile.progress} className="h-1" />
                        <p className="text-xs text-gray-600">{uploadFile.progress}%</p>
                      </div>
                    )}

                    {/* Error Message */}
                    {uploadFile.status === 'error' && uploadFile.error && (
                      <p className="text-xs text-red-600">{uploadFile.error}</p>
                    )}
                  </div>

                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {uploadFile.status === 'uploading' && (
                      <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                    )}
                    {uploadFile.status === 'success' && (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                    {uploadFile.status === 'error' && (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    {uploadFile.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(uploadFile.id)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DocumentUploadArea;

