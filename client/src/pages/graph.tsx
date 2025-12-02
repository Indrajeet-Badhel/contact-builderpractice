// client/src/pages/graph.tsx
import React from "react";
import ContactGraph from "@/components/ui/ContactGraph";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";

export default function GraphPage() {
  const [_, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black">Contact Knowledge Graph</h1>
            <p className="text-muted-foreground">Explore relationships between people, skills, companies and projects.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/dashboard")} variant="outline">Back to Dashboard</Button>
          </div>
        </div>

        <Card className="p-4">
          <ContactGraph />
        </Card>
      </div>
    </div>
  );
}
