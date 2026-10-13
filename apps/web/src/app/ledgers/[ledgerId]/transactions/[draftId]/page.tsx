import { RequireSession } from "@/components/RequireSession";
import { TransactionReviewView } from "@/components/transactions/TransactionReviewView";

export default async function TransactionReviewPage({
  params,
}: {
  params: Promise<{ ledgerId: string; draftId: string }>;
}) {
  const { ledgerId, draftId } = await params;
  return (
    <RequireSession>
      <TransactionReviewView ledgerId={ledgerId} draftId={draftId} />
    </RequireSession>
  );
}