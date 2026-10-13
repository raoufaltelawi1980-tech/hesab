import { RequireSession } from "@/components/RequireSession";
import { NewTransactionView } from "@/components/transactions/NewTransactionView";

export default async function NewTransactionPage({
  params,
}: {
  params: Promise<{ ledgerId: string }>;
}) {
  const { ledgerId } = await params;
  return (
    <RequireSession>
      <NewTransactionView ledgerId={ledgerId} />
    </RequireSession>
  );
}