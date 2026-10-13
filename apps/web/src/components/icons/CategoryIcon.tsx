"use client";

import {
  categoryIconMap,
  type CategoryIconKey,
} from "@/components/icons/icon-map";

const FALLBACK = ReceiptFallback;

function ReceiptFallback({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 2v20l2-1.5L8 22l2-1.5L12 22l2-1.5L16 22l2-1.5L20 22V2l-2 1.5L16 2l-2 1.5L12 2l-2 1.5L8 2 6 3.5 4 2Z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

/**
 * Renders the brand icon for a category's `iconKey`. Unknown or missing keys
 * fall back to a neutral receipt glyph so a new category never renders blank.
 */
export function CategoryIcon({
  iconKey,
  className = "size-4",
}: {
  iconKey?: string | null;
  className?: string;
}) {
  const Icon =
    iconKey && iconKey in categoryIconMap
      ? categoryIconMap[iconKey as CategoryIconKey]
      : FALLBACK;
  return <Icon aria-hidden="true" className={className} strokeWidth={1.6} />;
}