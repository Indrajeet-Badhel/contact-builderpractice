import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import type { Contact } from "@shared/schema";
import { motion } from "framer-motion";

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
  });

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
                <Card className="p-6 hover-elevate active-elevate-2 transition-all border-2 h-full" data-testid={`card-contact-${contact.id}`}>
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
                        {contact.skills.slice(0, 4).map((skill, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                        {contact.skills.length > 4 && (
                          <Badge variant="secondary" className="text-xs">
                            +{contact.skills.length - 4}
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
    </div>
  );
}
