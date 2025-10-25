import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Image as ImageIcon, CheckCircle, XCircle, Loader2, Sparkles, ArrowRight, RefreshCw, AlertCircle, X } from "lucide-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Document } from "@shared/schema";

interface UploadedFile {
  id: string;
  file: File;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  extractedData?: any;
  error?: string;
}

export default function UploadPage() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all documents from backend
  const { data: documents = [], refetch } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
    refetchInterval: (query) => {
      const data = query.state.data;
      // Auto-refetch every 3 seconds if any documents are processing
      const hasProcessing = data?.some(d => d.status === 'processing');
      return hasProcessing ? 3000 : false;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('document', file);
      return await apiRequest('POST', '/api/documents/upload', formData);
    },
    onSuccess: (data, file) => {
      toast({
        title: "Upload Started",
        description: `Extracting contact data from ${file.name}...`,
      });
      
      // Refetch documents to get the new one
      refetch();
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
    },
    onError: (error: Error, file) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return await apiRequest('DELETE', `/api/documents/${documentId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: "Document Deleted",
        description: "The failed document has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Could not delete the document. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Show toast when extraction completes or fails
  useEffect(() => {
    documents.forEach(doc => {
      const wasProcessing = uploadedFiles.find(f => f.file.name === doc.originalName)?.status === 'processing';
      
      if (doc.status === 'completed' && wasProcessing) {
        toast({
          title: "Extraction Complete",
          description: `Successfully extracted contact data from ${doc.originalName}`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      } else if (doc.status === 'failed' && wasProcessing) {
        toast({
          title: "Extraction Failed",
          description: `Failed to extract data from ${doc.originalName}. The AI service may be overloaded. Please try again.`,
          variant: "destructive",
        });
      }
    });
  }, [documents]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'uploading' as const,
      progress: 0,
    }));
    
    setUploadedFiles(prev => [...prev, ...newFiles]);
    
    newFiles.forEach(({ file }) => {
      uploadMutation.mutate(file);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'text/plain': ['.txt'],
    },
    multiple: true,
  });

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return ImageIcon;
    return FileText;
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return Loader2;
      case 'completed':
        return CheckCircle;
      case 'failed':
        return XCircle;
    }
  };

  const getStatusColor = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return 'default';
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black text-foreground mb-2 font-['Space_Grotesk']">
            Upload Documents
          </h1>
          <p className="text-muted-foreground text-lg">
            Upload resumes, PDFs, images, or business cards for AI-powered contact extraction
          </p>
        </div>

        {/* Drop Zone */}
        <Card className="mb-8 border-2 border-dashed">
          <div
            {...getRootProps()}
            className={`p-12 text-center cursor-pointer transition-all hover-elevate ${
              isDragActive ? 'bg-accent' : ''
            }`}
            data-testid="dropzone-upload"
          >
            <input {...getInputProps()} />
            <motion.div
              animate={isDragActive ? { scale: 1.05 } : { scale: 1 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="p-4 bg-primary/10 rounded-full">
                <Upload className="w-12 h-12 text-primary" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground mb-2">
                  {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
                </p>
                <p className="text-muted-foreground mb-4">
                  or click to browse from your computer
                </p>
                <div className="flex flex-wrap gap-2 justify-center text-sm text-muted-foreground">
                  <Badge variant="secondary">PDF</Badge>
                  <Badge variant="secondary">DOCX</Badge>
                  <Badge variant="secondary">PNG</Badge>
                  <Badge variant="secondary">JPG</Badge>
                  <Badge variant="secondary">TXT</Badge>
                </div>
              </div>
            </motion.div>
          </div>
        </Card>

        {/* Document List */}
        {documents.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Documents ({documents.length})
            </h2>
            <AnimatePresence mode="popLayout">
              {documents.map((document) => {
                const StatusIcon = getStatusIcon(document.status as UploadedFile['status']);
                
                return (
                  <motion.div
                    key={document.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    layout
                  >
                    <Card className="p-4 relative">
                      {document.status === 'failed' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute top-2 right-2 h-7 w-7 hover:bg-destructive/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(document.id);
                          }}
                          data-testid={`button-delete-${document.id}`}
                        >
                          <X className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      )}
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-muted rounded-lg shrink-0">
                          <FileText className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0 pr-8">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground truncate">
                                {document.originalName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {(document.fileSize / 1024).toFixed(1)} KB • {new Date(document.uploadedAt!).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant={getStatusColor(document.status as UploadedFile['status'])}>
                              <StatusIcon className={`w-3 h-3 mr-1 ${
                                document.status === 'pending' || document.status === 'processing' 
                                  ? 'animate-spin' 
                                  : ''
                              }`} />
                              {document.status}
                            </Badge>
                          </div>
                          {(document.status === 'pending' || document.status === 'processing') && (
                            <div className="space-y-1">
                              <Progress value={document.extractionProgress || 0} className="h-2" />
                              <p className="text-xs text-muted-foreground">
                                {document.status === 'pending' && 'Queued for processing...'}
                                {document.status === 'processing' && 'Extracting contact data with AI...'}
                              </p>
                            </div>
                          )}
                          {document.status === 'failed' && (
                            <div className="mt-2 space-y-2">
                              <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
                                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-sm text-destructive font-medium">Extraction Failed</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    The AI service is currently overloaded. This is a temporary issue with Google's Gemini API.
                                  </p>
                                </div>
                              </div>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  toast({
                                    title: "Retry Coming Soon",
                                    description: "The retry feature will be available soon. Please try uploading the document again.",
                                  });
                                }}
                                data-testid={`button-retry-${document.id}`}
                              >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Retry Extraction
                              </Button>
                            </div>
                          )}
                          {document.status === 'completed' && (
                            <div className="mt-3 pt-3 border-t flex gap-2">
                              <Link href="/">
                                <Button size="sm" variant="default" data-testid="button-view-dashboard">
                                  View Contact
                                  <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                              </Link>
                              <Button size="sm" variant="outline">
                                <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                                Success
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {documents.length === 0 && (
          <Card className="p-12 text-center border-dashed">
            <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No files uploaded yet. Start by uploading your first document above.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
