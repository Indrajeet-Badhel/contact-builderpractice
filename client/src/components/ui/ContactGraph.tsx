// client/src/components/ui/ContactGraph.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Contact } from "@shared/schema";
import ForceGraph3D, { ForceGraphMethods } from "react-force-graph-3d";
import SpriteText from "three-spritetext";

// ------------------------
// Utility
// ------------------------
function jaccard(a: string[] | undefined, b: string[] | undefined): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  const A = new Set(a.map((x) => x.toLowerCase()));
  const B = new Set(b.map((x) => x.toLowerCase()));
  const arrA = Array.from(A);
  const arrB = Array.from(B);
  const inter = arrA.filter((x) => B.has(x)).length;
  const union = new Set(arrA.concat(arrB)).size;
  return union === 0 ? 0 : inter / union;
}

type NodeType = "person" | "company" | "skill" | "project";

type GraphNode = {
  id: string;
  label: string;
  type: NodeType;
  raw?: Contact | null;
  x?: number;
  y?: number;
  z?: number;
};

type GraphLink = {
  source: string;
  target: string;
  label: string;
  weight: number;
};

type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

export default function ContactGraph({ compact = false }: { compact?: boolean }) {
  const fgRef = useRef<ForceGraphMethods | undefined>();
  const graphContainerRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [dimensions, setDimensions] = useState({
    width: 800,
    height: compact ? 500 : 780,
  });

  // ------------------------
  // Measure graph width so 3D doesn't cover side panel
  // ------------------------
  useEffect(() => {
    const updateSize = () => {
      if (!graphContainerRef.current) return;
      const rect = graphContainerRef.current.getBoundingClientRect();
      setDimensions({
        width: rect.width,
        height: compact ? 500 : 780,
      });
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [compact]);

  // ------------------------
  // Fetch contacts
  // ------------------------
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const isAdminPage = window.location.pathname.includes("/admin");
        const endpoint = isAdminPage ? "/api/admin/contacts" : "/api/contacts";
        const res = await fetch(endpoint, { credentials: "include" });
        const data: Contact[] = await res.json();
        setContacts(data);
      } catch (e) {
        console.error("ContactGraph load error:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ------------------------
  // Build graph data (with "common-only" properties)
  // ------------------------
  const graphData: GraphData = useMemo(() => {
    const nodesMap = new Map<string, GraphNode>();
    const links: GraphLink[] = [];
    const edgeSet = new Set<string>();

    // propertyId -> set of personIds connected to it
    const propertyPersonMap = new Map<string, Set<string>>();

    contacts.forEach((c) => {
      const personId = `person:${c.id}`;
      nodesMap.set(personId, {
        id: personId,
        label: c.name || c.email || "Unknown",
        type: "person",
        raw: c,
      });

      // helper to track property nodes + edges
      const connectProperty = (
        propId: string,
        label: string,
        type: NodeType,
        rel: string
      ) => {
        if (!nodesMap.has(propId)) {
          nodesMap.set(propId, { id: propId, label, type });
        }
        const key = `${personId}---${rel}---${propId}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          links.push({
            source: personId,
            target: propId,
            label: rel,
            weight: 1,
          });
        }
        if (!propertyPersonMap.has(propId)) {
          propertyPersonMap.set(propId, new Set());
        }
        propertyPersonMap.get(propId)!.add(personId);
      };

      // company
      if (c.company) {
        const compId = `company:${c.company}`;
        connectProperty(compId, c.company, "company", "worked_at");
      }

      // skills
      (c.skills || []).forEach((skill) => {
        const skillId = `skill:${skill.toLowerCase()}`;
        connectProperty(skillId, skill, "skill", "skilled_in");
      });

      // projects / repos
      try {
        const repos = (c.enrichedData as any)?.repositories || [];
        repos.slice(0, 5).forEach((r: any) => {
          const projId = `project:${r.url || r.name}`;
          connectProperty(projId, r.name || "Repo", "project", "contributed_to");
        });
      } catch {}
    });

    // show all people, properties only if:
    // - common (>=2 people), or
    // - unique but belongs to selected person
    const visibleNodeIds = new Set<string>();

    // all person nodes visible
    for (const [id, node] of nodesMap.entries()) {
      if (node.type === "person") visibleNodeIds.add(id);
    }

    for (const [id, node] of nodesMap.entries()) {
      if (node.type === "person") continue;

      const set = propertyPersonMap.get(id);
      const count = set ? set.size : 0;
      const isCommon = count >= 2;
      const belongsToSelected =
        selectedPersonId && set ? set.has(selectedPersonId) : false;

      if (isCommon || belongsToSelected) visibleNodeIds.add(id);
    }

    const filteredNodes: GraphNode[] = [];
    for (const [id, node] of nodesMap.entries()) {
      if (visibleNodeIds.has(id)) filteredNodes.push(node);
    }

    const filteredLinks = links.filter(
      (l) =>
        visibleNodeIds.has(l.source as string) &&
        visibleNodeIds.has(l.target as string)
    );

    return { nodes: filteredNodes, links: filteredLinks };
  }, [contacts, selectedPersonId]);

  // ------------------------
  // Search -> move camera to first match
  // ------------------------
  useEffect(() => {
    if (!search || !graphData.nodes.length || !fgRef.current) return;
    const q = search.toLowerCase();
    const match = graphData.nodes.find((n) =>
      n.label.toLowerCase().includes(q)
    );
    if (!match) return;

    requestAnimationFrame(() => {
      if (!fgRef.current) return;
      const { x = 0, y = 0, z = 0 } = match;
      const distance = 160;
      fgRef.current!.cameraPosition(
        { x, y, z: z + distance },
        { x, y, z },
        800
      );
    });
  }, [search, graphData]);

  // ------------------------
  // Colors / sizes
  // ------------------------
  const getNodeColor = (node: GraphNode) => {
    switch (node.type) {
      case "person":
        return "#2563eb"; // blue-600
      case "company":
        return "#059669"; // green-600
      case "skill":
        return "#d97706"; // amber-600
      case "project":
        return "#7c3aed"; // violet-600
      default:
        return "#64748b";
    }
  };

  const getNodeVal = (node: GraphNode) => {
    const base = node.type === "person" ? 10 : 6;
    if (search && node.label.toLowerCase().includes(search.toLowerCase())) {
      return base * 1.8;
    }
    if (selectedPersonId && node.id === selectedPersonId) {
      return base * 2;
    }
    return base;
  };

  // ------------------------
  // Zoom controls
  // ------------------------
  const handleZoomIn = () => {
    const fg = fgRef.current;
    if (!fg) return;
    const cam = fg.camera();
    const { x, y, z } = cam.position;
    fg.cameraPosition({ x, y, z: z * 0.8 }, undefined, 400);
  };

  const handleZoomOut = () => {
    const fg = fgRef.current;
    if (!fg) return;
    const cam = fg.camera();
    const { x, y, z } = cam.position;
    fg.cameraPosition({ x, y, z: z * 1.25 }, undefined, 400);
  };

  const handleReset = () => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.zoomToFit(800, 40);
  };

  // ------------------------
  // Render
  // ------------------------
  return (
    <div className="w-full h-full relative">
      {/* Top toolbar: search + zoom */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people, skills, companies..."
            className="px-3 py-2 border rounded-md w-64"
          />
          <button
            className="px-3 py-2 bg-slate-100 rounded-md"
            onClick={handleZoomIn}
          >
            Zoom +
          </button>
          <button
            className="px-3 py-2 bg-slate-100 rounded-md"
            onClick={handleZoomOut}
          >
            Zoom -
          </button>
          <button
            className="px-3 py-2 bg-slate-100 rounded-md"
            onClick={handleReset}
          >
            Reset
          </button>
        </div>
        <div className="text-sm text-slate-500">Nodes: {contacts.length}</div>
      </div>

      {/* Main layout: 3D graph + side panel */}
      <div className="flex gap-4">
        {/* 3D graph column */}
        <div
          ref={graphContainerRef}
          style={{ flex: 1, minHeight: compact ? 500 : 780 }}
        >
          {loading ? (
            <div className="p-6 text-center">Loading graph…</div>
          ) : (
            <ForceGraph3D
              ref={fgRef as any}
              graphData={graphData}
              width={dimensions.width}
              height={dimensions.height}
              backgroundColor="rgba(15,23,42,0)" // keep page bg visible
              nodeId="id"
              linkSource="source"
              linkTarget="target"
              // --- LABELS ON NODES (always visible) ---
              nodeThreeObject={(nodeObj: any) => {
                const node = nodeObj as GraphNode;
                const sprite = new SpriteText(node.label);
                sprite.textHeight = node.type === "person" ? 6 : 4;
                sprite.color = "#000000";
                return sprite;
              }}
              nodeThreeObjectExtend={true} // keep default sphere under label
              nodeColor={(node: any) => getNodeColor(node as GraphNode)}
              nodeVal={(node: any) => getNodeVal(node as GraphNode)}
              // edge styling
              linkWidth={(link: any) => 0.5 + (link.weight || 1) * 0.3}
              linkOpacity={0.6}
              linkDirectionalArrowLength={3.5}
              linkDirectionalArrowRelPos={0.5}
              linkThreeObject={(linkObj: any) => {
                const link = linkObj as GraphLink;
                const sprite = new SpriteText(link.label || "");
                sprite.textHeight = 1.5;
                sprite.color = "#1f2937";
                return sprite;
              }}
              linkThreeObjectExtend
              cooldownTicks={200}
              d3VelocityDecay={0.3}
              onNodeClick={(nodeObj: any) => {
                const node = nodeObj as GraphNode;
                if (node.type === "person" && node.raw) {
                  setSelected(node.raw);
                  setSelectedPersonId(node.id);
                } else {
                  setSelected(null);
                  setSelectedPersonId(null);
                }
              }}
            />
          )}
        </div>

        {/* Right-hand side panel: Details + Legend */}
        <div style={{ width: 320 }}>
          <div className="p-3 border rounded-md bg-white shadow-sm">
            <h3 className="font-semibold">Details</h3>
            {selected ? (
              <div className="mt-2 text-sm">
                <div className="font-medium">{selected.name}</div>
                <div className="text-muted-foreground">{selected.title}</div>
                <div className="mt-2">{selected.company}</div>
                <div className="mt-2 text-xs text-slate-600">
                  Skills: {(selected.skills || []).slice(0, 6).join(", ")}
                </div>
                <div className="mt-2">
                  {selected.websiteUrl ? (
                    <a
                      className="text-blue-600"
                      href={selected.websiteUrl ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Website
                    </a>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-600">
                Click a person node to view details here.
              </div>
            )}
          </div>

          <div className="mt-3 p-3 border rounded-md bg-white shadow-sm">
            <h4 className="font-semibold">Legend</h4>
            <div className="mt-2 text-sm">
              <div>
                <span className="inline-block w-3 h-3 bg-blue-600 mr-2 align-middle" />
                Person
              </div>
              <div>
                <span className="inline-block w-3 h-3 bg-green-600 mr-2 align-middle" />
                Company
              </div>
              <div>
                <span className="inline-block w-3 h-3 bg-amber-600 mr-2 align-middle" />
                Skill
              </div>
              <div>
                <span className="inline-block w-3 h-3 bg-violet-600 mr-2 align-middle" />
                Project
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}