// client/src/pages/graph.tsx
import React, {useState} from "react";
import ContactGraph3D from "@/components/ui/ContactGraph";
import ContactGraph2D from "@/components/ui/Contact2Graph";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";

export default function GraphPage() {
  const [_, navigate] = useLocation();
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d"); // default 2D

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black">Contact Knowledge Graph</h1>
            <p className="text-muted-foreground">
              Explore relationships between people, skills, companies and projects.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/dashboard")} variant="outline">
              Back to Dashboard
            </Button>
          </div>
        </div>

        <Card className="p-4">
          {/* View mode toggle */}
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

          {/* Render correct graph */}
          {viewMode === "2d" ? (
            <ContactGraph2D />
          ) : (
            <ContactGraph3D />
          )}
        </Card>
      </div>
    </div>
  );
}