"use client";

import { RequireSession } from "@/components/RequireSession";
import { NewLedgerView } from "@/components/ledgers/NewLedgerView";

export default function NewLedgerPage() {
  return (
    <RequireSession>
      <NewLedgerView />
    </RequireSession>
  );
}
