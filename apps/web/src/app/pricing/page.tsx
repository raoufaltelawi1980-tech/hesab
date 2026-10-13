"use client";

import { RequireSession } from "@/components/RequireSession";
import { PricingView } from "@/components/pricing/PricingView";

export default function PricingPage() {
  return (
    <RequireSession>
      <PricingView />
    </RequireSession>
  );
}
