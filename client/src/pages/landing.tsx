import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Sparkles, Database, Search, Upload, Users, CheckCircle, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function Landing() {
  const features = [
    {
      icon: Upload,
      title: "Smart Document Upload",
      description: "Drag and drop resumes, PDFs, images, or business cards for instant AI-powered extraction"
    },
    {
      icon: Sparkles,
      title: "AI-Powered Extraction",
      description: "Gemini AI analyzes documents to extract names, emails, skills, companies, and job titles with high accuracy"
    },
    {
      icon: Database,
      title: "CRM-Ready Exports",
      description: "Export contacts to vCard, CSV, JSON, or sync directly to HubSpot CRM with one click"
    },
    {
      icon: Search,
      title: "Semantic AI Search",
      description: "Ask in plain English: 'Find Python developers with ML experience' and get instant results"
    },
  ];

  const stats = [
    { value: "90%+", label: "Extraction Accuracy" },
    { value: "10sec", label: "Average Processing" },
    { value: "Multiple", label: "Export Formats" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(0,0,0,0.03),transparent_50%)]" />
        
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex flex-col items-center text-center py-16 sm:py-24 lg:py-32 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge variant="secondary" className="mb-4 text-sm font-medium px-4 py-1.5">
                AI-Powered Contact Intelligence
              </Badge>
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight text-foreground max-w-4xl mx-auto font-['Space_Grotesk']">
                Build Verified Contact Profiles
                <span className="block mt-2">with AI Precision</span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-lg sm:text-xl lg:text-2xl text-muted-foreground max-w-3xl font-medium"
            >
              Extract contact data from resumes, documents, and emails using advanced AI.
              Enrich with public sources. Export to CRM-ready formats.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 pt-4"
            >
              <Button
                size="lg"
                className="text-base px-8 py-6 h-auto font-semibold"
                onClick={() => window.location.href = "/api/login"}
                data-testid="button-get-started"
              >
                <Zap className="w-5 h-5 mr-2" />
                Get Started Free
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 py-6 h-auto font-semibold"
                data-testid="button-learn-more"
              >
                <FileText className="w-5 h-5 mr-2" />
                See How It Works
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="grid grid-cols-3 gap-8 pt-12 max-w-2xl mx-auto"
            >
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl sm:text-4xl font-black text-foreground font-['Space_Grotesk']">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground font-medium mt-1">
                    {stat.label}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 sm:py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-foreground mb-4 font-['Space_Grotesk']">
              Everything You Need
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful features that transform unstructured data into actionable contact intelligence
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className="p-6 sm:p-8 hover-elevate active-elevate-2 transition-all border-2 h-full">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-primary text-primary-foreground rounded-lg shrink-0">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-foreground">
                          {feature.title}
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-foreground mb-4 font-['Space_Grotesk']">
              Simple 3-Step Process
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From document to CRM-ready contact in minutes
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { step: "01", title: "Upload Documents", description: "Drop your resumes, PDFs, or business card images", icon: Upload },
              { step: "02", title: "AI Extraction", description: "Gemini AI automatically extracts and structures contact data", icon: Sparkles },
              { step: "03", title: "Export & Sync", description: "Download as vCard/CSV or push directly to your CRM", icon: Database }
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="relative text-center"
                >
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground text-2xl font-black mb-4 font-['Space_Grotesk']">
                    {item.step}
                  </div>
                  <div className="mb-3">
                    <Icon className="w-8 h-8 mx-auto text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {item.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-foreground text-background py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-6 font-['Space_Grotesk']">
            Ready to Build Your Contact Database?
          </h2>
          <p className="text-lg sm:text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Start extracting professional contact profiles with AI today. No credit card required.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="text-base px-8 py-6 h-auto font-semibold text-foreground bg-background hover:bg-background/90"
            onClick={() => window.location.href = "/api/login"}
            data-testid="button-cta-signup"
          >
            <Users className="w-5 h-5 mr-2" />
            Start Building for Free
          </Button>
        </div>
      </section>
    </div>
  );
}
