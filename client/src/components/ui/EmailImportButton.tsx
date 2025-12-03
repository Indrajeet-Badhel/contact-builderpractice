// client/src/components/EmailImportButton.tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import EmailImportModal from "./EmailImportModal";

export default function EmailImportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="default"
        className="bg-black text-white"
        onClick={() => setOpen(true)}
      >
        <Mail className="w-4 h-4 mr-2" />
        Import from Email
      </Button>

      <EmailImportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
