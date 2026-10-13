import { RequireSession } from "@/components/RequireSession";
import { VoiceTransactionView } from "@/components/transactions/VoiceTransactionView";

export default async function VoiceTransactionPage({
  params,
}: {
  params: Promise<{ ledgerId: string }>;
}) {
  const { ledgerId } = await params;
  return (
    <RequireSession>
      <VoiceTransactionView ledgerId={ledgerId} />
    </RequireSession>
  );
}
