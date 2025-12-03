// client/src/pages/admin-contacts.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Users,
  ExternalLink,
  CheckCircle2,
  User,
  Network,
} from "lucide-react";
import type { Contact } from "@shared/schema";
import { motion } from "framer-motion";
import ContactGraph from "@/components/ui/ContactGraph";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ContactWithUser extends Contact {
  userInfo: {
    email: string;
    firstName: string;
    lastName: string;
  };
}

export default function AdminContactsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<ContactWithUser | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [aiSearchResults, setAiSearchResults] = useState<ContactWithUser[] | null>(null);
  const [searchExplanation, setSearchExplanation] = useState("");
  const { toast } = useToast();

  const { data: contacts = [], isLoading } = useQuery<ContactWithUser[]>({
    queryKey: ['/api/admin/contacts'],
  });

  // AI Search Handler
  const handleAiSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);

      const res = await fetch("/api/admin/contacts/search", {
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
          ? "AI found results using natural-language understanding across all users."
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

  const handleExportContact = (contact: ContactWithUser) => {
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
      userInfo: contact.userInfo,
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

  const filteredContacts = aiSearchResults !== null
    ? aiSearchResults
    : contacts.filter(contact => {
        const q = searchQuery.toLowerCase();
        return (
          contact.name?.toLowerCase().includes(q) ||
          contact.email?.toLowerCase().includes(q) ||
          contact.company?.toLowerCase().includes(q) ||
          contact.title?.toLowerCase().includes(q) ||
          contact.userInfo.email?.toLowerCase().includes(q) ||
          contact.skills?.some(skill => skill.toLowerCase().includes(q))
        );
      });

  const uniqueContacts = filteredContacts.reduce((acc: ContactWithUser[], contact) => {
    const isDuplicate = acc.some(existing => {
      if (contact.email && existing.email && contact.email === existing.email) return true;
      if (contact.githubUrl && existing.githubUrl && contact.githubUrl === existing.githubUrl) return true;
      if (contact.linkedinUrl && existing.linkedinUrl && contact.linkedinUrl === existing.linkedinUrl) return true;
      
      const normalizeName = (name?: string) => name?.toLowerCase().trim().replace(/\s+/g, ' ') || '';
      if (normalizeName(contact.name) && normalizeName(existing.name) && 
          normalizeName(contact.name) === normalizeName(existing.name)) return true;
      
      return false;
    });
    
    if (!isDuplicate) {
      acc.push(contact);
    }
    
    return acc;
  }, []);

  const getConfidenceColor = (score: number) => {
    if (score >= 0.9) return "text-green-600 dark:text-green-400";
    if (score >= 0.7) return "text-yellow-600 dark:text-yellow-400";
    return "text-orange-600 dark:text-orange-400";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-foreground mb-2 font-['Space_Grotesk']">
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground text-lg">
                View and manage contacts from all users
              </p>
            </div>
          </div>
        </div>

        {/* Tabs for Grid/Graph View */}
        <Tabs defaultValue="grid" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="grid">
              <Users className="w-4 h-4 mr-2" />
              Contact Grid
            </TabsTrigger>
            <TabsTrigger value="graph">
              <Network className="w-4 h-4 mr-2" />
              Knowledge Graph
            </TabsTrigger>
          </TabsList>

          {/* Grid View */}
          <TabsContent value="grid" className="space-y-6">
            {/* AI Search Bar */}
            <Card className="p-4 border-2">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Sparkles className={`w-5 h-5 shrink-0 ${isSearching ? 'animate-pulse text-primary' : 'text-primary'}`} />
                  <Input
                    placeholder="Ask me anything: 'Find Python developers with ML experience' or 'people from Google'..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
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
                    disabled={isSearching}
                  />
                  <Button 
                    size="icon" 
                    variant={aiSearchResults !== null ? "default" : "ghost"}
                    onClick={handleAiSearch}
                    disabled={isSearching || !searchQuery.trim()}
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
                
                {searchExplanation && (
                  <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg">
                    <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground">{searchExplanation}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                      Unique Contacts
                    </p>
                    <p className="text-3xl font-black font-['Space_Grotesk']">
                      {uniqueContacts.length}
                    </p>
                  </div>
                  <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                    <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
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
                      {uniqueContacts.filter(c => (c.confidenceScore || 0) >= 0.7).length}
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                    <Sparkles className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
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
            ) : uniqueContacts.length === 0 ? (
              <Card className="p-12 text-center border-dashed">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? "No contacts match your search" : "No contacts found."}
                </p>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {uniqueContacts.map((contact, index) => (
                  <motion.div
                    key={contact.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card 
                      className="p-6 hover-elevate active-elevate-2 transition-all border-2 h-full cursor-pointer" 
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

                      <div className="mb-3">
                        <Badge variant="outline" className="text-xs flex items-center gap-1 w-fit">
                          <User className="w-3 h-3" />
                          {contact.userInfo.firstName || contact.userInfo.lastName 
                            ? `${contact.userInfo.firstName} ${contact.userInfo.lastName}`.trim()
                            : contact.userInfo.email}
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
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <Linkedin className="w-4 h-4" />
                          </Button>
                        )}
                        {contact.githubUrl && (
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <Github className="w-4 h-4" />
                          </Button>
                        )}
                        {contact.websiteUrl && (
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <Globe className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Graph View */}
          <TabsContent value="graph" className="space-y-6">
            <Card className="p-6">
              <ContactGraph />
            </Card>
          </TabsContent>
        </Tabs>
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
                <div className="pt-2">
                  <Badge variant="outline" className="text-xs">
                    <User className="w-3 h-3 mr-1" />
                    Uploaded by: {selectedContact.userInfo.firstName || selectedContact.userInfo.lastName 
                      ? `${selectedContact.userInfo.firstName} ${selectedContact.userInfo.lastName}`.trim()
                      : selectedContact.userInfo.email}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-4">
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

                {selectedContact.bio && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">BIO</h3>
                    <p className="text-sm bg-muted/30 p-4 rounded-lg leading-relaxed">
                      {selectedContact.bio}
                    </p>
                  </div>
                )}

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

                <div className="pt-4 border-t">
                  <Button 
                    className="w-full" 
                    variant="default"
                    onClick={() => handleExportContact(selectedContact)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Contact
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