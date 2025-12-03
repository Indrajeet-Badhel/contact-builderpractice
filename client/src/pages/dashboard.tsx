import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import EmailImportButton from "@/components/ui/EmailImportButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Download,
  Mail,
  Phone,
  MapPin,
  Building2,
  Briefcase,
  Github,
  Linkedin,
  Globe,
  Sparkles,
  Filter,
  SortAsc,
  Users,
  ExternalLink,
  Calendar,
  Tag,
  Database,
  CheckCircle2,
  XCircle,
  BookOpen,
  Code,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Contact } from "@shared/schema";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";

const getSourceUrl = (contact: Contact, type: string): string | undefined => {
  const sources = (contact.sources as any) || [];
  const match = sources.find(
    (s: any) => s.source === type && s.url && s.url !== "uploaded_document",
  );
  return match?.url;
};

function useIsAdmin() {
  const { data: adminStatus } = useQuery<{ isAdmin: boolean }>({
    queryKey: ['/api/admin/status'],
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  
  return adminStatus?.isAdmin || false;
}

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [newContactUrl, setNewContactUrl] = useState("");
  const isAdmin = useIsAdmin();   

  // ===== AI SEARCH STATES =====
  const [isSearching, setIsSearching] = useState(false);
  const [aiSearchResults, setAiSearchResults] = useState<Contact[] | null>(null);
  const [searchExplanation, setSearchExplanation] = useState("");

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const queryClient = useQueryClient();                     
  const { toast } = useToast();

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
  });



  const handleExportContact = (contact: Contact) => {
    const exportData = {
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      title: contact.title,
      location: contact.location,
      skills: contact.skills,
      linkedinUrl: contact.linkedinUrl,
      githubUrl: contact.githubUrl,
      websiteUrl: contact.websiteUrl,
      bio: contact.bio,
      confidenceScore: contact.confidenceScore,
      tags: contact.tags,
      notes: contact.notes,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${contact.name.replace(/\s+/g, '_')}_contact.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Contact Exported",
      description: `${contact.name}'s contact information has been downloaded as JSON.`,
    });
  };
// ===== AI CHAT SEARCH HANDLER =====
const handleAiSearch = async () => {
  if (!searchQuery.trim()) return;

  try {
    setIsSearching(true);

    const res = await fetch("/api/contacts/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ query: searchQuery }),
    });

    if (!res.ok) throw new Error("AI search failed");

    const data = await res.json();

    setAiSearchResults(data || []);
    setSearchExplanation(
      Array.isArray(data) && data.length > 0
        ? "AI found results using natural-language understanding."
        : "No contacts matched your query."
    );

  } catch (error) {
    console.error(error);
    toast({
      title: "Search Failed",
      description: "Something went wrong while searching.",
      variant: "destructive",
    });
  } finally {
    setIsSearching(false);
  }
};

    const handleImportFromUrl = async () => {
    if (!newContactUrl.trim()) {
      toast({
        title: "URL required",
        description: "Please paste a profile or portfolio URL first.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch("/api/contacts/from-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ url: newContactUrl.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to create contact from URL");
      }

      const contact = await res.json();

      toast({
        title: "Contact imported",
        description: `Imported / updated contact: ${contact.name || "Unknown"}`,
      });

      setNewContactUrl("");
      // refetch contacts to show the new / updated one
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Import failed",
        description: error.message || "Could not import contact from this URL.",
        variant: "destructive",
      });
    }
  };

  const handleSyncToCRM = (contact: Contact) => {
    toast({
      title: "CRM Sync Coming Soon",
      description: "This feature will sync contacts to your CRM platform. Configure your CRM integration in the Profile settings.",
      variant: "default",
    });
  };

  const handleExportExcel = async () => {
    try {
      const response = await fetch('/api/contacts/export/excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contacts.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Contacts exported to Excel format",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export contacts",
        variant: "destructive",
      });
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await fetch('/api/contacts/export/csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contacts.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Contacts exported to CSV format",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export contacts",
        variant: "destructive",
      });
    }
  };

const filteredContacts =
  aiSearchResults !== null
    ? aiSearchResults
    : contacts.filter(contact => {
        const q = searchQuery.toLowerCase();

        const matchesSearch =
          contact.name?.toLowerCase().includes(q) ||
          contact.company?.toLowerCase().includes(q) ||
          contact.title?.toLowerCase().includes(q) ||
          contact.email?.toLowerCase().includes(q) ||
          contact.skills?.some(skill =>
            skill.toLowerCase().includes(q)
          );

        const matchesTags =
          selectedTags.length === 0 ||
          selectedTags.some(tag => contact.tags?.includes(tag));

        return matchesSearch && matchesTags;
      });



  const getConfidenceColor = (score: number) => {
    if (score >= 0.9) return "text-green-600 dark:text-green-400";
    if (score >= 0.7) return "text-yellow-600 dark:text-yellow-400";
    return "text-orange-600 dark:text-orange-400";
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 0.9) return "High Confidence";
    if (score >= 0.7) return "Medium Confidence";
    return "Low Confidence";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-foreground mb-2 font-['Space_Grotesk']">
                Contact Dashboard
              </h1>
              <p className="text-muted-foreground text-lg">
                Manage and search your extracted contact profiles
              </p>
            </div>
            <div className="flex gap-2">
              {/* Admin Button - Only visible to admins */}
              {isAdmin && (
                <Button 
                  variant="outline"
                  onClick={() => (window.location.href = "/admin/contacts")}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Admin Dashboard
                </Button>
              )}
              
              <Button 
                variant="default" 
                onClick={() => (window.location.href = "/graph")}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Knowledge Graph
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" data-testid="button-export">
                    <Download className="w-4 h-4 mr-2" />
                    Export All
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportExcel} data-testid="menu-export-excel">
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export as Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportCSV} data-testid="menu-export-csv">
                    <FileText className="w-4 h-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* URL Import Bar */}
        <Card className="p-4 mb-4 border-2">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <Input
              placeholder="Paste LinkedIn / GitHub / portfolio URL to create or update a contact..."
              value={newContactUrl}
              onChange={(e) => setNewContactUrl(e.target.value)}
              className="border-0 focus-visible:ring-0 text-base bg-transparent"
            />
            <Button onClick={handleImportFromUrl}>
              <Sparkles className="w-4 h-4 mr-2" />
              Import from URL
            </Button>
            <EmailImportButton />
          </div>
        </Card>
        


<Card className="p-4 mb-6 border-2">
  <div className="flex flex-col gap-3">
    <div className="flex items-center gap-3">
      <Sparkles className={`w-5 h-5 shrink-0 ${isSearching ? 'animate-pulse text-primary' : 'text-primary'}`} />
      <Input
        placeholder="Ask me anything: 'Find Python developers with ML experience' or 'people from Google'..."
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          // Clear AI results when user types
          if (!e.target.value.trim()) {
            setAiSearchResults(null);
            setSearchExplanation("");
          }
        }}
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            handleAiSearch();
          }
        }}
        className="border-0 focus-visible:ring-0 text-base bg-transparent"
        data-testid="input-search"
        disabled={isSearching}
      />
      <Button 
        size="icon" 
        variant={aiSearchResults !== null ? "default" : "ghost"}
        onClick={handleAiSearch}
        disabled={isSearching || !searchQuery.trim()}
        data-testid="button-search"
      >
        {isSearching ? (
          <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
        ) : (
          <Search className="w-5 h-5" />
        )}
      </Button>
      {aiSearchResults !== null && (
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => {
            setSearchQuery("");
            setAiSearchResults(null);
            setSearchExplanation("");
          }}
        >
          Clear
        </Button>
      )}
    </div>
    
    {/* Show AI explanation */}
    {searchExplanation && (
      <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg">
        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">{searchExplanation}</p>
      </div>
    )}
  </div>
</Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">
                  Total Contacts
                </p>
                <p className="text-3xl font-black font-['Space_Grotesk']">
                  {contacts.length}
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">
                  Verified Profiles
                </p>
                <p className="text-3xl font-black font-['Space_Grotesk']">
                  {contacts.filter(c => (c.confidenceScore || 0) >= 0.7).length}
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <Sparkles className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">
                  Average Confidence
                </p>
                <p className="text-3xl font-black font-['Space_Grotesk']">
                  {contacts.length > 0
                    ? Math.round((contacts.reduce((sum, c) => sum + (c.confidenceScore || 0), 0) / contacts.length) * 100)
                    : 0}%
                </p>
              </div>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <Building2 className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </Card>
        </div>

        {/* Contacts Grid */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6 animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
                <div className="h-3 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </Card>
            ))}
          </div>
        ) : filteredContacts.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "No contacts match your search" : "No contacts yet. Upload documents to get started."}
            </p>
            {!searchQuery && (
              <Button onClick={() => window.location.href = "/upload"} data-testid="button-upload">
                <Sparkles className="w-4 h-4 mr-2" />
                Upload Documents
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredContacts.map((contact, index) => (
              <motion.div
                key={contact.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card 
                  className="p-6 hover-elevate active-elevate-2 transition-all border-2 h-full cursor-pointer" 
                  data-testid={`card-contact-${contact.id}`}
                  onClick={() => setSelectedContact(contact)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-foreground mb-1">
                        {contact.name}
                      </h3>
                      {contact.title && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                          <Briefcase className="w-3 h-3" />
                          {contact.title}
                        </p>
                      )}
                      {contact.company && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {contact.company}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      <span className={getConfidenceColor(contact.confidenceScore || 0)}>
                        {Math.round((contact.confidenceScore || 0) * 100)}%
                      </span>
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-4">
                    {contact.email && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate">{contact.email}</span>
                      </p>
                    )}
                    {contact.phone && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Phone className="w-3 h-3 shrink-0" />
                        {contact.phone}
                      </p>
                    )}
                    {contact.location && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {contact.location}
                      </p>
                    )}
                  </div>

                  {contact.skills && contact.skills.length > 0 && (
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-1">
                        {contact.skills.slice(0, 3).map((skill, i) => (
                          <Badge key={i} variant="secondary" className="text-xs max-w-[120px] truncate">
                            {skill}
                          </Badge>
                        ))}
                        {contact.skills.length > 3 && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            +{contact.skills.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4 border-t">
                    {contact.linkedinUrl && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" data-testid="button-linkedin">
                        <Linkedin className="w-4 h-4" />
                      </Button>
                    )}
                    {contact.githubUrl && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" data-testid="button-github">
                        <Github className="w-4 h-4" />
                      </Button>
                    )}
                    {contact.websiteUrl && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" data-testid="button-website">
                        <Globe className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Contact Detail Modal */}
      <Dialog open={selectedContact !== null} onOpenChange={(open) => !open && setSelectedContact(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedContact && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black font-['Space_Grotesk'] flex items-center gap-3">
                  {selectedContact.name}
                  <Badge variant="secondary">
                    <span className={getConfidenceColor(selectedContact.confidenceScore || 0)}>
                      {Math.round((selectedContact.confidenceScore || 0) * 100)}%
                    </span>
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {selectedContact.title && selectedContact.company 
                    ? `${selectedContact.title} at ${selectedContact.company}`
                    : selectedContact.title || selectedContact.company || "Contact Details"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Contact Information Section */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    CONTACT INFORMATION
                  </h3>
                  <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
                    {selectedContact.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{selectedContact.email}</span>
                      </div>
                    )}
                    {selectedContact.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{selectedContact.phone}</span>
                      </div>
                    )}
                    {selectedContact.location && (
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{selectedContact.location}</span>
                      </div>
                    )}
                    {selectedContact.company && (
                      <div className="flex items-center gap-3">
                        <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{selectedContact.company}</span>
                      </div>
                    )}
                    {selectedContact.title && (
                      <div className="flex items-center gap-3">
                        <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{selectedContact.title}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bio Section */}
                {selectedContact.bio && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">BIO</h3>
                    <p className="text-sm bg-muted/30 p-4 rounded-lg leading-relaxed">
                      {selectedContact.bio}
                    </p>
                  </div>
                )}

                {/* Skills Section */}
                {selectedContact.skills && selectedContact.skills.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      SKILLS & EXPERTISE
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedContact.skills.map((skill, i) => (
                        <Badge key={i} variant="secondary">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags Section */}
                {selectedContact.tags && selectedContact.tags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      TAGS
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedContact.tags.map((tag, i) => (
                        <Badge key={i} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Social Links Section */}
                {selectedContact && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      SOCIAL PROFILES
                    </h3>
                    <div className="space-y-2">
                      {/* LinkedIn */}
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() =>
                          selectedContact.linkedinUrl &&
                          window.open(selectedContact.linkedinUrl, "_blank")
                        }
                        disabled={!selectedContact.linkedinUrl}
                      >
                        <Linkedin className="w-4 h-4 mr-2" />
                        LinkedIn Profile
                        {selectedContact.linkedinUrl ? (
                          <ExternalLink className="w-3 h-3 ml-auto" />
                        ) : (
                          <span className="ml-auto text-xs text-muted-foreground">
                            Unavailable
                          </span>
                        )}
                      </Button>

                      {/* GitHub */}
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() =>
                          selectedContact.githubUrl &&
                          window.open(selectedContact.githubUrl, "_blank")
                        }
                        disabled={!selectedContact.githubUrl}
                      >
                        <Github className="w-4 h-4 mr-2" />
                        GitHub Profile
                        {selectedContact.githubUrl ? (
                          <ExternalLink className="w-3 h-3 ml-auto" />
                        ) : (
                          <span className="ml-auto text-xs text-muted-foreground">
                            Unavailable
                          </span>
                        )}
                      </Button>

                      {/* Personal Website */}
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() =>
                          selectedContact.websiteUrl &&
                          window.open(selectedContact.websiteUrl, "_blank")
                        }
                        disabled={!selectedContact.websiteUrl}
                      >
                        <Globe className="w-4 h-4 mr-2" />
                        Personal Website
                        {selectedContact.websiteUrl ? (
                          <ExternalLink className="w-3 h-3 ml-auto" />
                        ) : (
                          <span className="ml-auto text-xs text-muted-foreground">
                            Unavailable
                          </span>
                        )}
                      </Button>

                      {/* Stack Overflow */}
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          const url = getSourceUrl(selectedContact, "stackoverflow");
                          if (url) window.open(url, "_blank");
                        }}
                        disabled={!getSourceUrl(selectedContact, "stackoverflow")}
                      >
                        <Code className="w-4 h-4 mr-2" />
                        Stack Overflow Profile
                        {getSourceUrl(selectedContact, "stackoverflow") ? (
                          <ExternalLink className="w-3 h-3 ml-auto" />
                        ) : (
                          <span className="ml-auto text-xs text-muted-foreground">
                            Unavailable
                          </span>
                        )}
                      </Button>

                      {/* GitLab */}
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          const url = getSourceUrl(selectedContact, "gitlab");
                          if (url) window.open(url, "_blank");
                        }}
                        disabled={!getSourceUrl(selectedContact, "gitlab")}
                      >
                        <Code className="w-4 h-4 mr-2" />
                        GitLab Profile
                        {getSourceUrl(selectedContact, "gitlab") ? (
                          <ExternalLink className="w-3 h-3 ml-auto" />
                        ) : (
                          <span className="ml-auto text-xs text-muted-foreground">
                            Unavailable
                          </span>
                        )}
                      </Button>

                      {/* ORCID */}
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          const orcidUrl =
                            selectedContact.orcidUrl ||
                            getSourceUrl(selectedContact, "orcid") ||
                            ((selectedContact.enrichedData as any)?.orcidId
                              ? `https://orcid.org/${
                                  (selectedContact.enrichedData as any).orcidId
                                }`
                              : undefined);

                          if (orcidUrl) window.open(orcidUrl, "_blank");
                        }}
                        disabled={
                          !(
                            selectedContact.orcidUrl ||
                            getSourceUrl(selectedContact, "orcid") ||
                            (selectedContact.enrichedData as any)?.orcidId
                          )
                        }
                      >
                        <BookOpen className="w-4 h-4 mr-2" />
                        ORCID Profile
                        {selectedContact.orcidUrl ||
                        getSourceUrl(selectedContact, "orcid") ||
                        (selectedContact.enrichedData as any)?.orcidId ? (
                          <ExternalLink className="w-3 h-3 ml-auto" />
                        ) : (
                          <span className="ml-auto text-xs text-muted-foreground">
                            Unavailable
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Notes Section */}
                {selectedContact.notes && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">NOTES</h3>
                    <p className="text-sm bg-muted/30 p-4 rounded-lg">
                      {selectedContact.notes}
                    </p>
                  </div>
                )}

                {/* Data Sources Section */}
                {selectedContact.sources && selectedContact.sources.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      DATA SOURCES ({selectedContact.sources.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedContact.sources.map((source: any, i: number) => (
                        <div key={i} className="flex items-center justify-between bg-muted/30 p-3 rounded-lg">
                          <div className="flex items-center gap-3">
                            {source.verified ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-yellow-500" />
                            )}
                            <div>
                              <p className="text-sm font-medium capitalize">{source.source}</p>
                              {source.url && source.url !== 'uploaded_document' && (
                                <p className="text-xs text-muted-foreground truncate max-w-md">{source.url}</p>
                              )}
                            </div>
                          </div>
                          <Badge variant={source.verified ? "default" : "secondary"} className="text-xs">
                            {source.verified ? "Verified" : "Unverified"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* GitHub Repositories Section */}
                {selectedContact.enrichedData && (selectedContact.enrichedData as any).repositories && (selectedContact.enrichedData as any).repositories.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <Code className="w-4 h-4" />
                      GITHUB REPOSITORIES
                    </h3>
                    <div className="space-y-2">
                      {(selectedContact.enrichedData as any).repositories.slice(0, 5).map((repo: any, i: number) => (
                        <div key={i} className="bg-muted/30 p-3 rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="text-sm font-medium">{repo.name}</h4>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {repo.language && <Badge variant="outline" className="text-xs">{repo.language}</Badge>}
                              {repo.stars > 0 && (
                                <span className="flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  {repo.stars}
                                </span>
                              )}
                            </div>
                          </div>
                          {repo.description && (
                            <p className="text-xs text-muted-foreground mb-2">{repo.description}</p>
                          )}
                          {repo.url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs"
                              onClick={() => window.open(repo.url, '_blank')}
                            >
                              View Repository
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ORCID Information */}
                {selectedContact.enrichedData && (selectedContact.enrichedData as any).orcidId && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      ORCID PROFILE
                    </h3>
                    <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">ORCID iD</span>
                        <code className="text-xs bg-background px-2 py-1 rounded">{(selectedContact.enrichedData as any).orcidId}</code>
                      </div>
                      {(selectedContact.enrichedData as any).educations && (selectedContact.enrichedData as any).educations.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Education</p>
                          <div className="space-y-1">
                            {(selectedContact.enrichedData as any).educations.slice(0, 3).map((edu: any, i: number) => (
                              <p key={i} className="text-xs">
                                {edu.degree} - {edu.institution} {edu.year && `(${edu.year})`}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                      {(selectedContact.enrichedData as any).employments && (selectedContact.enrichedData as any).employments.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Employment History</p>
                          <div className="space-y-1">
                            {(selectedContact.enrichedData as any).employments.slice(0, 3).map((emp: any, i: number) => (
                              <p key={i} className="text-xs">
                                {emp.role} at {emp.organization} 
                                {emp.startDate && ` (${emp.startDate}${emp.endDate ? ` - ${emp.endDate}` : ' - Present'})`}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Metadata Section */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    METADATA
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 p-4 rounded-lg">
                    {selectedContact.createdAt && (
                      <div>
                        <p className="text-muted-foreground mb-1">Created</p>
                        <p className="font-medium">
                          {new Date(selectedContact.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {selectedContact.updatedAt && (
                      <div>
                        <p className="text-muted-foreground mb-1">Last Updated</p>
                        <p className="font-medium">
                          {new Date(selectedContact.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground mb-1">Confidence Score</p>
                      <p className={`font-medium ${getConfidenceColor(selectedContact.confidenceScore || 0)}`}>
                        {getConfidenceBadge(selectedContact.confidenceScore || 0)}
                      </p>
                    </div>
                    {selectedContact.sources && selectedContact.sources.length > 0 && (
                      <div>
                        <p className="text-muted-foreground mb-1">Data Sources</p>
                        <p className="font-medium">{selectedContact.sources.length} source(s)</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button 
                    className="flex-1" 
                    variant="default"
                    onClick={() => handleExportContact(selectedContact)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Contact
                  </Button>
                  <Button 
                    className="flex-1" 
                    variant="outline"
                    onClick={() => handleSyncToCRM(selectedContact)}
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    Sync to CRM
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
