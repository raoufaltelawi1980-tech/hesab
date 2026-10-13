import { RequireSession } from "@/components/RequireSession";
import { InventoryView } from "@/components/inventory/InventoryView";

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ ledgerId: string }>;
}) {
  const { ledgerId } = await params;
  return (
    <RequireSession>
      <InventoryView ledgerId={ledgerId} />
    </RequireSession>
  );
}
