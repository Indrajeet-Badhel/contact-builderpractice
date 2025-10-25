import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Image as ImageIcon, CheckCircle, XCircle, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('document', file);
      return await apiRequest('POST', '/api/documents/upload', formData);
    },
    onSuccess: (data, file) => {
      const fileId = uploadedFiles.find(f => f.file === file)?.id;
      if (fileId) {
        setUploadedFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, status: 'processing' as const, progress: 50 } : f
        ));
        
        // Simulate extraction progress
        setTimeout(() => {
          setUploadedFiles(prev => prev.map(f => 
            f.id === fileId ? { ...f, status: 'completed' as const, progress: 100, extractedData: data } : f
          ));
          
          toast({
            title: "Extraction Complete",
            description: `Successfully extracted contact data from ${file.name}`,
          });
          
          queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
        }, 2000);
      }
    },
    onError: (error: Error, file) => {
      const fileId = uploadedFiles.find(f => f.file === file)?.id;
      if (fileId) {
        setUploadedFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, status: 'failed' as const, error: error.message } : f
        ));
      }
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Processing Files
            </h2>
            <AnimatePresence mode="popLayout">
              {uploadedFiles.map((uploadedFile) => {
                const FileIcon = getFileIcon(uploadedFile.file);
                const StatusIcon = getStatusIcon(uploadedFile.status);
                
                return (
                  <motion.div
                    key={uploadedFile.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    layout
                  >
                    <Card className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-muted rounded-lg shrink-0">
                          <FileIcon className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground truncate">
                                {uploadedFile.file.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {(uploadedFile.file.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                            <Badge variant={getStatusColor(uploadedFile.status)}>
                              <StatusIcon className={`w-3 h-3 mr-1 ${
                                uploadedFile.status === 'uploading' || uploadedFile.status === 'processing' 
                                  ? 'animate-spin' 
                                  : ''
                              }`} />
                              {uploadedFile.status}
                            </Badge>
                          </div>
                          {uploadedFile.status !== 'failed' && (
                            <div className="space-y-1">
                              <Progress value={uploadedFile.progress} className="h-2" />
                              <p className="text-xs text-muted-foreground">
                                {uploadedFile.status === 'uploading' && 'Uploading...'}
                                {uploadedFile.status === 'processing' && 'Extracting contact data with AI...'}
                                {uploadedFile.status === 'completed' && 'Extraction complete!'}
                              </p>
                            </div>
                          )}
                          {uploadedFile.error && (
                            <p className="text-sm text-destructive mt-2">
                              {uploadedFile.error}
                            </p>
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

        {uploadedFiles.length === 0 && (
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
