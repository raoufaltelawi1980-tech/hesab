import { BrandIdentity } from "./BrandIdentity";

type Variant = "light" | "dark" | "monochrome" | "auto";
type Lang = "ar" | "en" | "both";
type Size = "sm" | "md" | "lg" | "xl";

const SIZES: Record<Size, number> = { sm: 28, md: 40, lg: 56, xl: 72 };

/**
 * The official SVGs ship with `fill="currentColor"`, so they are applied as
 * CSS masks rather than <img>. That keeps the delivered artwork byte-identical
 * while still letting the mark inherit ink colour from its container.
 */
const VARIANT_CLASS: Record<Variant, string> = {
  auto: "",
  light: "text-brand-ivory",
  dark: "text-brand-charcoal",
  monochrome: "text-current",
};

interface Props {
  variant?: Variant;
  language?: Lang;
  size?: Size;
  onlyMark?: boolean;
  className?: string;
  /** Rendered as accessible text for the lockup; the artwork is decorative. */
  title?: string;
}

export function HesabMark({
  size = SIZES.md,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      role="presentation"
      className={`inline-block shrink-0 ${className}`}
      style={{
        width: size,
        height: Math.round(size * 1.1),
        maskImage: 'url("/brand/logo-mark.svg")',
        WebkitMaskImage: 'url("/brand/logo-mark.svg")',
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        backgroundColor: "currentColor",
      }}
    />
  );
}

export function HesabLogo({
  variant = "auto",
  language = "both",
  size = "md",
  onlyMark = false,
  className = "",
  title,
}: Props) {
  const px = SIZES[size];
  const lang: Lang = language === "both" ? "ar" : language;

  if (onlyMark) {
    return <HesabMark size={px} className={`${VARIANT_CLASS[variant]} ${className}`} />;
  }

  return (
    <span
      dir={lang === "en" ? "ltr" : "rtl"}
      className={`inline-flex items-center gap-3 ${VARIANT_CLASS[variant]} ${className}`}
    >
      <HesabMark size={px} />
      <span className="flex flex-col leading-none">
        {lang !== "en" ? (
          <span className="text-xl font-bold tracking-tight sm:text-2xl">
            {BrandIdentity.nameAr}
          </span>
        ) : null}
        <span className="text-[0.62rem] font-semibold uppercase tracking-[0.35em] opacity-80">
          Hesab
        </span>
      </span>
      {title ? <span className="sr-only">{title}</span> : null}
    </span>
  );
}

/**
 * Locale-aware entry point: Arabic uses the Arabic lockup, English the Latin
 * one, and `dir` follows so the flex order flips with the document.
 */
export function HesabLogoLocalized({
  locale,
  size = "md",
  onlyMark = false,
  className = "",
  title,
}: {
  locale: "ar" | "en";
  size?: Size;
  onlyMark?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <HesabLogo
      language={locale === "en" ? "en" : "ar"}
      size={size}
      onlyMark={onlyMark}
      className={className}
      title={title}
    />
  );
}

export type { Props as HesabLogoProps, Size as HesabLogoSize, Variant, Lang };