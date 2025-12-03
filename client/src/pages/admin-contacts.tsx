// client/src/pages/admin-contacts.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
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
  Database,
  XCircle,
  Calendar,
  Check
} from "lucide-react";
import type { Contact } from "@shared/schema";
import { motion } from "framer-motion";
import ContactGraph from "@/components/ui/ContactGraph";
import ContactGraph2D from "@/components/ui/Contact2Graph";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from "xlsx";

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

  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");

  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});

  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());

    const handleDeleteContact = async (contactId: string) => {
    if (!contactId) return;

    try {
      const res = await fetch(`/api/admin/contacts/${contactId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to delete contact");
      }

      toast({
        title: "Contact deleted",
        description: "The contact has been permanently removed.",
      });

      setSelectedContact(null);

      // Refresh admin contacts list
      queryClient.invalidateQueries({ queryKey: ['/api/admin/contacts'] });
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Delete failed",
        description: error.message || "Unable to delete contact.",
        variant: "destructive",
      });
    }
  };

  const { data: contacts = [], isLoading } = useQuery<ContactWithUser[]>({
    queryKey: ['/api/admin/contacts'],
  });

  const handleAdminUpdate = async (contactId: string) => {
    try {
      const res = await fetch(`/api/admin/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editData),
      });

      if (!res.ok) throw new Error("Failed to update contact");

      toast({
        title: "Contact Updated",
        description: "Admin changes saved successfully.",
      });

      setIsEditing(false);
      setSelectedContact(null);

      queryClient.invalidateQueries({ queryKey: ['/api/admin/contacts'] });

    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message || "Unable to update contact",
        variant: "destructive",
      });
    }
  };

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

  type ExportFormat = "json" | "csv" | "excel";

  const handleExportSelected = (format: ExportFormat) => {
    const selected = uniqueContacts.filter((c) =>
      selectedContacts.has(c.id)
    );

    if (selected.length === 0) {
      toast({
        title: "No contacts selected",
        description: "Select contacts first.",
        variant: "destructive",
      });
      return;
    }

    // Common fields for all formats
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Company",
      "Title",
      "Location",
      "Bio",
      "Skills",
      "LinkedIn URL",
      "GitHub URL",
      "ORCID URL",
      "Website URL",
      "Confidence Score",
      "Created At",
    ];

    const rows = selected.map((c) => [
      c.name || "",
      c.email || "",
      c.phone || "",
      c.company || "",
      c.title || "",
      c.location || "",
      c.bio || "",
      (c.skills || []).join(", "),
      c.linkedinUrl || "",
      c.githubUrl || "",
      (c as any).orcidUrl || "",
      c.websiteUrl || "",
      c.confidenceScore ? `${(c.confidenceScore * 100).toFixed(0)}%` : "",
      c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "",
    ]);

    let blob: Blob;
    let filename: string;

    if (format === "json") {
      blob = new Blob([JSON.stringify(selected, null, 2)], {
        type: "application/json",
      });
      filename =
        selected.length === 1
          ? `${(selected[0].name || "contact").replace(/\s+/g, "_")}.json`
          : `selected_contacts_${selected.length}.json`;
    } else if (format === "csv") {
      const csv = [headers, ...rows]
        .map((row) =>
          row
            .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
            .join(",")
        )
        .join("\n");

      blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      filename = `selected_contacts_${selected.length}.csv`;
    } else {
      // Excel
      const worksheetData = [headers, ...rows];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");

      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      blob = new Blob(
        [excelBuffer],
        {
          type:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
      );
      filename = `selected_contacts_${selected.length}.xlsx`;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: `Downloaded ${selected.length} contact(s) as ${format.toUpperCase()}.`,
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

            <Button
              variant="outline"
              onClick={() => (window.location.href = "/dashboard")}
              className="gap-2"
            >
              <Users className="w-4 h-4" />
              Back to Dashboard
            </Button>
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

            {/* Export Selected Button (only when something is selected) */}
            {selectedContacts.size > 0 && (
              <div className="flex justify-end gap-2">
                <Button
                  variant="default"
                  className="gap-2"
                  onClick={() => handleExportSelected("json")}
                >
                  <Download className="w-4 h-4" />
                  JSON ({selectedContacts.size})
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => handleExportSelected("csv")}
                >
                  <Download className="w-4 h-4" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => handleExportSelected("excel")}
                >
                  <Download className="w-4 h-4" />
                  Excel
                </Button>
              </div>
            )}

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
                {uniqueContacts.map((contact, index) => {
                  const isSelected = selectedContacts.has(contact.id);

                  return (
                    <motion.div
                      key={contact.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <Card className="relative p-6 hover-elevate active-elevate-2 transition-all border-2 h-full cursor-pointer">
                        {/* Clickable content opens the detail modal */}
                        <div onClick={() => setSelectedContact(contact)}>
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

                            {/* Right side: confidence + select toggle */}
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="shrink-0">
                                <span className={getConfidenceColor(contact.confidenceScore || 0)}>
                                  {Math.round((contact.confidenceScore || 0) * 100)}%
                                </span>
                              </Badge>

                              <button
                                type="button"
                                className={`h-6 w-6 rounded-full border flex items-center justify-center text-[10px] transition
                                  ${isSelected
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                    : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                                  }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedContacts((prev) => {
                                    const copy = new Set(prev);
                                    if (copy.has(contact.id)) copy.delete(contact.id);
                                    else copy.add(contact.id);
                                    return copy;
                                  });
                                }}
                              >
                                {isSelected && <Check className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>

                          {/* ↓ everything below here stays the same as you already have ↓ */}
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
                                  <Badge
                                    key={i}
                                    variant="secondary"
                                    className="text-xs max-w-[120px] truncate"
                                  >
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
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Graph View */}
          <TabsContent value="graph" className="space-y-6">
            <Card className="p-6">

              {/* Toggle 2D / 3D */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  View: <span className="font-medium uppercase">{viewMode}</span>
                </div>

                <div className="inline-flex rounded-md border bg-muted p-1">
                  <Button
                    size="sm"
                    variant={viewMode === "2d" ? "default" : "ghost"}
                    className="rounded-md"
                    onClick={() => setViewMode("2d")}
                  >
                    2D Graph
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "3d" ? "default" : "ghost"}
                    className="rounded-md"
                    onClick={() => setViewMode("3d")}
                  >
                    3D Graph
                  </Button>
                </div>
              </div>

              {/* Render graph based on toggle */}
              {viewMode === "2d" ? (
                <ContactGraph2D compact={false} />
              ) : (
                <ContactGraph compact={false} />
              )}

            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Contact Detail Modal */}
      <Dialog
        open={selectedContact !== null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setSelectedContact(null);
            setIsEditing(false);
            setEditData({});
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedContact && (
            isEditing ? (
              <div className="space-y-4 mt-2">
                <h3 className="text-lg font-semibold">Edit Contact</h3>

                {/* Name */}
                <Input
                  placeholder="Name"
                  defaultValue={selectedContact.name}
                  onChange={(e) =>
                    setEditData((prev: any) => ({ ...prev, name: e.target.value }))
                  }
                />

                {/* Email */}
                <Input
                  placeholder="Email"
                  defaultValue={selectedContact.email || ""}
                  onChange={(e) =>
                    setEditData((prev: any) => ({ ...prev, email: e.target.value }))
                  }
                />

                {/* Phone */}
                <Input
                  placeholder="Phone"
                  defaultValue={selectedContact.phone || ""}
                  onChange={(e) =>
                    setEditData((prev: any) => ({ ...prev, phone: e.target.value }))
                  }
                />

                {/* Company */}
                <Input
                  placeholder="Company"
                  defaultValue={selectedContact.company || ""}
                  onChange={(e) =>
                    setEditData((prev: any) => ({ ...prev, company: e.target.value }))
                  }
                />

                {/* Title */}
                <Input
                  placeholder="Title"
                  defaultValue={selectedContact.title || ""}
                  onChange={(e) =>
                    setEditData((prev: any) => ({ ...prev, title: e.target.value }))
                  }
                />

                {/* LinkedIn URL */}
                <Input
                  placeholder="LinkedIn URL"
                  defaultValue={selectedContact.linkedinUrl || ""}
                  onChange={(e) =>
                    setEditData((prev: any) => ({ ...prev, linkedinUrl: e.target.value }))
                  }
                />

                {/* GitHub URL */}
                <Input
                  placeholder="GitHub URL"
                  defaultValue={selectedContact.githubUrl || ""}
                  onChange={(e) =>
                    setEditData((prev: any) => ({ ...prev, githubUrl: e.target.value }))
                  }
                />

                {/* Personal Website URL */}
                <Input
                  placeholder="Website URL"
                  defaultValue={selectedContact.websiteUrl || ""}
                  onChange={(e) =>
                    setEditData((prev: any) => ({ ...prev, websiteUrl: e.target.value }))
                  }
                />

                {/* Skills */}
                <Input
                  placeholder="Skills (comma separated)"
                  defaultValue={selectedContact.skills?.join(", ") || ""}
                  onChange={(e) =>
                    setEditData((prev: any) => ({
                      ...prev,
                      skills: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }))
                  }
                />

                {/* Data sources verified toggle */}
                {Array.isArray(selectedContact.sources) &&
                  selectedContact.sources.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <h4 className="text-sm font-semibold">
                        Data Sources Verification
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Toggle which sources are marked as verified.
                      </p>

                      {selectedContact.sources.map((source: any, index: number) => {
                        const currentSources =
                          (editData.sources as any[]) || selectedContact.sources || [];
                        const current = currentSources[index] || source;
                        const isVerified = !!current.verified;

                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-muted/40 p-2 rounded-md"
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium capitalize">
                                {source.source}
                              </span>
                              {source.url &&
                                source.url !== "uploaded_document" && (
                                  <span className="text-xs text-muted-foreground truncate max-w-xs">
                                    {source.url}
                                  </span>
                                )}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant={isVerified ? "default" : "outline"}
                              onClick={() => {
                                const base =
                                  (editData.sources as any[]) ||
                                  selectedContact.sources ||
                                  [];
                                const updated = base.map((s: any, idx: number) =>
                                  idx === index ? { ...s, verified: !isVerified } : s
                                );
                                setEditData((prev: any) => ({
                                  ...prev,
                                  sources: updated,
                                }));
                              }}
                            >
                              {isVerified ? "Verified" : "Mark Verified"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    className="flex-1"
                    variant="default"
                    onClick={() => handleAdminUpdate(selectedContact.id)}
                  >
                    Save
                  </Button>

                  <Button
                    className="flex-1"
                    variant="ghost"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
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

                {/* Social Profiles */}
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
                  </div>
                </div>

                {/* Data Sources (read-only in view mode) */}
                {selectedContact.sources && selectedContact.sources.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      DATA SOURCES ({selectedContact.sources.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedContact.sources.map((source: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-center justify-between bg-muted/30 p-3 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {source.verified ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-yellow-500" />
                            )}
                            <div>
                              <p className="text-sm font-medium capitalize">
                                {source.source}
                              </p>
                              {source.url && source.url !== "uploaded_document" && (
                                <p className="text-xs text-muted-foreground truncate max-w-md">
                                  {source.url}
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant={source.verified ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {source.verified ? "Verified" : "Unverified"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 pt-4 border-t">
                  <Button 
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit
                  </Button>

                  <Button 
                    variant="default"
                    onClick={() => handleExportContact(selectedContact)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={() => selectedContact && handleDeleteContact(selectedContact.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </>
          )
        )}
        </DialogContent>
      </Dialog>
    </div>
  );
}