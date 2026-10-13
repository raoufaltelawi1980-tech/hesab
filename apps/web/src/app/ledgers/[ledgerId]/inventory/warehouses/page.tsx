import { RequireSession } from "@/components/RequireSession";
import { WarehousesView } from "@/components/inventory/WarehousesView";

export default async function WarehousesPage({
  params,
}: {
  params: Promise<{ ledgerId: string }>;
}) {
  const { ledgerId } = await params;
  return (
    <RequireSession>
      <WarehousesView ledgerId={ledgerId} />
    </RequireSession>
  );
}
