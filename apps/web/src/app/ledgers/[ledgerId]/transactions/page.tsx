import { RequireSession } from "@/components/RequireSession";
import { TransactionsListView } from "@/components/transactions/TransactionsListView";

export default async function TransactionsPage({
  params,
}: {
  params: Promise<{ ledgerId: string }>;
}) {
  const { ledgerId } = await params;
  return (
    <RequireSession>
      <TransactionsListView ledgerId={ledgerId} />
    </RequireSession>
  );
}