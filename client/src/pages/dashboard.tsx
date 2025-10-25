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
  Filter,
  SortAsc,
  Users,
  ExternalLink,
  Calendar,
  Tag,
} from "lucide-react";
import type { Contact } from "@shared/schema";
import { motion } from "framer-motion";

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
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

  const handleSyncToCRM = (contact: Contact) => {
    toast({
      title: "CRM Sync Coming Soon",
      description: "This feature will sync contacts to your CRM platform. Configure your CRM integration in the Profile settings.",
      variant: "default",
    });
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = 
      contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.skills?.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesTags = selectedTags.length === 0 || 
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
              <Button variant="outline" data-testid="button-export">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <Card className="p-4 mb-6 border-2">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary shrink-0" />
            <Input
              placeholder="Ask AI: 'Find Python developers with ML experience'..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 focus-visible:ring-0 text-base bg-transparent"
              data-testid="input-search"
            />
            <Button size="icon" variant="ghost" data-testid="button-search">
              <Search className="w-5 h-5" />
            </Button>
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
                {(selectedContact.linkedinUrl || selectedContact.githubUrl || selectedContact.websiteUrl) && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      SOCIAL PROFILES
                    </h3>
                    <div className="space-y-2">
                      {selectedContact.linkedinUrl && (
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => window.open(selectedContact.linkedinUrl!, '_blank')}
                        >
                          <Linkedin className="w-4 h-4 mr-2" />
                          LinkedIn Profile
                          <ExternalLink className="w-3 h-3 ml-auto" />
                        </Button>
                      )}
                      {selectedContact.githubUrl && (
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => window.open(selectedContact.githubUrl!, '_blank')}
                        >
                          <Github className="w-4 h-4 mr-2" />
                          GitHub Profile
                          <ExternalLink className="w-3 h-3 ml-auto" />
                        </Button>
                      )}
                      {selectedContact.websiteUrl && (
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => window.open(selectedContact.websiteUrl!, '_blank')}
                        >
                          <Globe className="w-4 h-4 mr-2" />
                          Personal Website
                          <ExternalLink className="w-3 h-3 ml-auto" />
                        </Button>
                      )}
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
