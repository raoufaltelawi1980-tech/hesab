import { RequireSession } from "@/components/RequireSession";
import { BudgetsView } from "@/components/budgets/BudgetsView";

export default async function BudgetsPage({
  params,
}: {
  params: Promise<{ ledgerId: string }>;
}) {
  const { ledgerId } = await params;
  return (
    <RequireSession>
      <BudgetsView ledgerId={ledgerId} />
    </RequireSession>
  );
}