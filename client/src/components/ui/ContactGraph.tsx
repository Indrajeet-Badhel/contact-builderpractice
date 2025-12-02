// client/src/components/ui/ContactGraph.tsx

import React, { useEffect, useRef, useState } from "react";
import cytoscape, { Core, ElementDefinition } from "cytoscape";
import * as coseBilkent from "cytoscape-cose-bilkent";
import type { Contact } from "@shared/schema";

// Register layout plugin defensively (avoid crash if plugin missing)
try {
  // some bundlers export plugin as default, others as module namespace
  // using both forms covers common cases
  // @ts-ignore
  cytoscape.use((coseBilkent && (coseBilkent.default || coseBilkent)) as any);
} catch (e) {
  // plugin not available — fallback to default layouts
}

// ------------------------
// Utility
// ------------------------
function jaccard(a: string[] | undefined, b: string[] | undefined): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  const A = new Set(a.map(x => x.toLowerCase()));
  const B = new Set(b.map(x => x.toLowerCase()));
  const arrA = Array.from(A);
  const arrB = Array.from(B);
  const inter = arrA.filter(x => B.has(x)).length;
  const union = new Set(arrA.concat(arrB)).size;
  return union === 0 ? 0 : inter / union;
}

// ========================
// MAIN COMPONENT
// ========================
export default function ContactGraph({ compact = false }: { compact?: boolean }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [search, setSearch] = useState("");
  const [tooltip, setTooltip] = useState<{ x: number; y: number; html: string } | null>(null);

  // ------------------------
  // Fetch contacts
  // ------------------------
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/contacts", { credentials: "include" });
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
  // Build graph
  // ------------------------
  useEffect(() => {
    if (!mountRef.current) return;

    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    const elements: ElementDefinition[] = [];
    const nodeMap = new Map<string, any>();
    const edgeSet = new Set<string>();

    // Build nodes + edges
    contacts.forEach((c) => {
      const personId = `person:${c.id}`;
      nodeMap.set(personId, {
        id: personId,
        label: c.name || c.email || "Unknown",
        type: "person",
        data: c,
      });

      if (c.company) {
        const compId = `company:${c.company}`;
        if (!nodeMap.has(compId))
          nodeMap.set(compId, { id: compId, label: c.company, type: "company" });
        edgeSet.add(`${personId}---worked_at---${compId}`);
      }

      (c.skills || []).forEach((skill) => {
        const skillId = `skill:${skill.toLowerCase()}`;
        if (!nodeMap.has(skillId))
          nodeMap.set(skillId, { id: skillId, label: skill, type: "skill" });
        edgeSet.add(`${personId}---skilled_in---${skillId}`);
      });

      try {
        const repos = (c.enrichedData as any)?.repositories || [];
        repos.slice(0, 5).forEach((r: any) => {
          const projId = `project:${r.url || r.name}`;
          if (!nodeMap.has(projId))
            nodeMap.set(projId, { id: projId, label: r.name || "Repo", type: "project" });
          edgeSet.add(`${personId}---contributed_to---${projId}`);
        });
      } catch {}
    });

    // Add similarity edges
    const people = contacts.map(c => ({
      id: `person:${c.id}`,
      skills: (c.skills || []).map(s => s.toLowerCase()),
    }));

    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        const sim = jaccard(people[i].skills, people[j].skills);
        if (sim >= 0.4) {
          edgeSet.add(`${people[i].id}---similar_to---${people[j].id}---${sim.toFixed(2)}`);
        }
      }
    }

    // Convert to Cytoscape format
    nodeMap.forEach((n) =>
      elements.push({
        data: { id: n.id, label: n.label, type: n.type, raw: n.data || null },
      })
    );

    edgeSet.forEach((raw) => {
      const parts = raw.split("---");
      const src = parts[0];
      const rel = parts[1];
      const tgt = parts[2];
      const weight = parts[3] ? parseFloat(parts[3]) : 1;

      elements.push({
        data: {
          id: `edge:${src}->${tgt}->${rel}`,
          source: src,
          target: tgt,
          label: rel,
          weight,
        },
      });
    });

    // ------------------------
    // Init Cytoscape
    // ------------------------
    const cy = cytoscape({
      container: mountRef.current,
      elements,
      layout: ({
        name: "cose-bilkent",
        animate: false,
        nodeRepulsion: 12000,
        idealEdgeLength: 180,
        gravity: 0.25,
        numIter: 3000,
        tile: true,
        padding: 40,
      } as any),

      style: [
        // Default node
        {
          selector: "node",
          style: {
            label: "data(label)",
            "text-valign": "center",
            "text-halign": "center",
            color: "#fff",
            width: 28,
            height: 28,
            "font-size": "8px",
            "text-wrap": "wrap",
            "text-max-width": "60px",
          },
        },
        {
          selector: "node[type='person']",
          style: {
            "background-color": "#2563eb",
            width: 38,
            height: 38,
            "font-size": "11px",
            "font-weight": "bold",
          },
        },
        {
          selector: "node[type='company']",
          style: { "background-color": "#059669" },
        },
        {
          selector: "node[type='skill']",
          style: { "background-color": "#d97706" },
        },
        {
          selector: "node[type='project']",
          style: { "background-color": "#7c3aed" },
        },

        // Edge styling
        {
          selector: "edge",
          style: {
            "curve-style": "bezier",
            "target-arrow-shape": "triangle",
            "line-color": "#94a3b8",
            "target-arrow-color": "#94a3b8",
            width: 1.2,
            label: "data(label)",
            color: "#1f2937",
            "font-size": "7px",
            "text-background-color": "#fff",
            "text-background-opacity": 0.85,
            "text-background-padding": "2px",
            "text-rotation": "autorotate",
            "text-margin-y": -8,
          },
        },

        // Hover clarity
        {
          selector: ".faded",
          style: { opacity: 0.08 },
        },
        // Highlighted via search
        {
          selector: ".highlight",
          style: {
            "border-color": "#f59e0b",
            "border-width": 4,
            "background-color": "#fffbeb",
            "text-outline-color": "#b45309",
            "text-outline-width": 2,
          },
        },
      ],
    });

    // ------------------------
    // Interactions
    // ------------------------
    const onTap = (evt: any) => {
      const d = evt.target.data();
      if (d.type === "person") {
        const c = d.raw as Contact;
        setSelected(c || null);
      } else {
        setSelected(null);
      }
    };

    const onMouseOver = (evt: any) => {
      const node = evt.target;
      const d = node.data();
      cy.elements().addClass("faded");
      node.connectedEdges().connectedNodes().removeClass("faded");
      node.connectedEdges().removeClass("faded");

      // show small tooltip near cursor
      if (d.type === "person") {
        const c = d.raw as Contact;
        const pos = evt.renderedPosition || evt.position || { x: 0, y: 0 };
        setTooltip({
          x: pos.x + 10,
          y: pos.y + 10,
          html: `<strong>${(c.name || "Unknown").replace(/</g, "&lt;")}</strong><br/>${(c.title || "").replace(/</g, "&lt;")}`,
        });
      }
    };

    const onMouseOut = () => {
      cy.elements().removeClass("faded");
      setTooltip(null);
    };

    cy.on("tap", "node", onTap);
    cy.on("mouseover", "node", onMouseOver);
    cy.on("mouseout", "node", onMouseOut);

    // store ref
    cyRef.current = cy;

    // apply search highlight if search exists
      if (search && search.trim().length > 0) {
      const q = search.toLowerCase();
      cy.nodes().forEach((n) => {
        const label = (n.data("label") || "").toString().toLowerCase();
        if (label.includes(q)) n.addClass("highlight"); else n.removeClass("highlight");
      });
      // focus to first match
      const match = cy.nodes(`node[label *= "${search.replace(/"/g, '\\"')}"]`);
      if (match && match.length > 0) {
        try {
          // prefer fit which is well-typed
          cy.fit(match[0], 80);
        } catch {
          // fallback to animate if available at runtime
          try { (cy as any).animate({ center: { eles: match[0] }, duration: 400 }); } catch {}
        }
      }
    }

    // cleanup listeners and cytoscape instance
    return () => {
      try {
        cy.off("tap", "node", onTap);
        cy.off("mouseover", "node", onMouseOver);
        cy.off("mouseout", "node", onMouseOut);
      } catch {}
      try {
        cy.destroy();
      } catch {}
      cyRef.current = null;
    };
  }, [contacts, search]);

  // toolbar and side panel UI
  return (
    <div className="w-full h-full relative">
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
            onClick={() => {
              const cy = cyRef.current;
              if (!cy) return;
              const newLevel = Math.min(cy.zoom() + 0.2, 2);
              cy.zoom(newLevel);
            }}
          >
            Zoom +
          </button>
          <button
            className="px-3 py-2 bg-slate-100 rounded-md"
            onClick={() => {
              const cy = cyRef.current;
              if (!cy) return;
              const newLevel = Math.max(cy.zoom() - 0.2, 0.2);
              cy.zoom(newLevel);
            }}
          >
            Zoom -
          </button>
          <button
            className="px-3 py-2 bg-slate-100 rounded-md"
            onClick={() => {
              const cy = cyRef.current;
              if (!cy) return;
              cy.reset();
            }}
          >
            Reset
          </button>
        </div>
        <div className="text-sm text-slate-500">Nodes: {contacts.length}</div>
      </div>

      <div className="flex gap-4">
        <div style={{ flex: 1, minHeight: compact ? 500 : 780 }}>
          {loading ? (
            <div className="p-6 text-center">Loading graph…</div>
          ) : (
            <div
              ref={mountRef}
              style={{
                width: "100%",
                height: compact ? 500 : 780,
                borderRadius: 8,
                border: "1px solid rgba(148,163,184,0.12)",
                background: "var(--background)",
              }}
            />
          )}
        </div>

        <div style={{ width: 320 }}>
          <div className="p-3 border rounded-md bg-white shadow-sm">
            <h3 className="font-semibold">Details</h3>
            {selected ? (
              <div className="mt-2 text-sm">
                <div className="font-medium">{selected.name}</div>
                <div className="text-muted-foreground">{selected.title}</div>
                <div className="mt-2">{selected.company}</div>
                <div className="mt-2 text-xs text-slate-600">Skills: {(selected.skills || []).slice(0,6).join(', ')}</div>
                <div className="mt-2">
                  {selected.websiteUrl ? (
                    <a className="text-blue-600" href={selected.websiteUrl ?? undefined} target="_blank" rel="noreferrer">Website</a>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-600">Click a person node to view details here.</div>
            )}
          </div>
          <div className="mt-3 p-3 border rounded-md bg-white shadow-sm">
            <h4 className="font-semibold">Legend</h4>
            <div className="mt-2 text-sm">
              <div><span className="inline-block w-3 h-3 bg-blue-600 mr-2 align-middle" /> Person</div>
              <div><span className="inline-block w-3 h-3 bg-green-600 mr-2 align-middle" /> Company</div>
              <div><span className="inline-block w-3 h-3 bg-amber-600 mr-2 align-middle" /> Skill</div>
              <div><span className="inline-block w-3 h-3 bg-violet-600 mr-2 align-middle" /> Project</div>
            </div>
          </div>
        </div>
      </div>

      {tooltip ? (
        <div
          style={{ position: 'absolute', left: tooltip.x, top: tooltip.y, pointerEvents: 'none', background: 'white', padding: 6, borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
          dangerouslySetInnerHTML={{ __html: tooltip.html }}
        />
      ) : null}
    </div>
  );
}
