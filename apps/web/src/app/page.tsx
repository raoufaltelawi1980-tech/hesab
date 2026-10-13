import Link from "next/link";
import { Button } from "@/components/Button";
import { HesabLogo } from "@/components/brand/HesabLogo";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-base px-4 text-center text-ink-primary">
      <HesabLogo size="xl" variant="light" title="حساب" className="text-brand-ivory" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">حساب — Hesab</h1>
        <p className="text-sm text-ink-muted">دفاتر مالية · الإدخال اليدوي</p>
      </div>
      <Link href="/ledgers">
        <Button>ابدأ</Button>
      </Link>
    </div>
  );
}