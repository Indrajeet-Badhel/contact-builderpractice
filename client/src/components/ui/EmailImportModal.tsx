// client/src/components/EmailImportModal.tsx
import React, { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function EmailImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [authUrl, setAuthUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/gmail/messages", {
          credentials: "include",
        });

        if (res.status === 401) {
          const ru = await fetch("/api/gmail/auth-url", {
            credentials: "include",
          }).then(r => r.json());
          setAuthUrl(ru.url);
          setMessages([]);
        } else {
          const data = await res.json();
          setMessages(data || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  function toggleSelect(id: string) {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleImport() {
    const ids = Object.keys(selected).filter(id => selected[id]);
    if (!ids.length) return alert("Select messages to import");

    setLoading(true);
    try {
      const resp = await fetch("/api/gmail/import", {
        method: "POST",
        credentials: "include", // required
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIds: ids }),
      });

      const result = await resp.json();
      if (resp.ok) {
        alert(`Imported ${result.count} contacts`);
        onClose();
        window.location.reload();
      } else {
        alert("Error: " + (result.error || "Unknown"));
      }
    } catch (e) {
      console.error(e);
      alert("Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <div className="p-4">
          <h3 className="text-lg font-bold mb-2">Import Contacts from Gmail</h3>

          {authUrl && (
            <div className="mb-3">
              <p className="text-sm text-muted-foreground mb-2">
                You need to authorize access to your Gmail account first.
              </p>
              <a href={authUrl} target="_blank" rel="noreferrer">
                <Button>Authorize Gmail</Button>
              </a>
              <p className="text-xs text-muted-foreground mt-2">
                After authorizing, close this window and reopen the modal.
              </p>
            </div>
          )}

          {loading && <div>Loading messages...</div>}

          {!loading && messages.length === 0 && !authUrl && (
            <div>No messages found</div>
          )}

          {!loading && messages.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-auto">
              {messages.map(m => (
                <div key={m.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium">{m.subject || "(no subject)"}</div>
                    <div className="text-xs text-muted-foreground">{m.from} • {m.date}</div>
                    <div className="text-xs">{m.snippet}</div>
                  </div>
                  <div>
                    <input
                      type="checkbox"
                      checked={!!selected[m.id]}
                      onChange={() => toggleSelect(m.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button
              onClick={handleImport}
              disabled={loading || Object.values(selected).filter(Boolean).length === 0}
            >
              Import Selected
            </Button>
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
