import Image, { type StaticImageData } from "next/image";
import { cn } from "cn";
// Static imports let Next read each file's real pixel size at build time, so replacing the
// PNG with a differently-proportioned one needs no code change.
import tashkheesLogo from "../../../public/brand/tashkhees-logo.png";
import karandaazLogo from "../../../public/brand/karandaaz-logo.png";

/**
 * Renders a static image at a fixed height with its intrinsic aspect ratio. Width and height are
 * both whole pixels and match the rendered box exactly, which keeps next/image's
 * "width or height modified" dev warning from firing.
 */
function BrandImage({
  image,
  alt,
  height,
  className,
  eager,
  priority,
}: {
  image: StaticImageData;
  alt: string;
  height: number;
  className?: string;
  /** Load immediately rather than lazily — for images that are always above the fold. */
  eager?: boolean;
  /** Also raise fetch priority — for the page's hero/LCP image only. */
  priority?: boolean;
}) {
  const width = Math.round((height * image.width) / image.height);
  return (
    <Image
      src={image}
      alt={alt}
      width={width}
      height={height}
      style={{ width, height }}
      className={cn("shrink-0", className)}
      // Next 16 deprecates `priority` in favour of loading="eager" (+ fetchPriority="high" for the
      // LCP image). High priority is kept off persistent chrome like the app top bar, where React's
      // auto-preload would warn "preloaded but not used" after client-side navigations.
      loading={eager || priority ? "eager" : undefined}
      fetchPriority={priority ? "high" : undefined}
    />
  );
}

/**
 * The full Tashkhees logo lockup (mark + wordmark in one image) from public/brand/tashkhees-logo.png.
 * `tone="onDark"` sets it on a white chip so it stays legible on navy sections, per brand guidelines.
 */
export function TashkheesLogo({
  className,
  height = 48,
  tone = "onLight",
  priority = false,
}: {
  className?: string;
  height?: number;
  tone?: "onLight" | "onDark";
  priority?: boolean;
}) {
  const logo = <BrandImage image={tashkheesLogo} alt="Tashkhees" height={height} eager priority={priority} />;

  if (tone === "onDark") {
    return (
      <span className={cn("inline-flex items-center rounded-xl bg-white px-4 py-2.5 ring-1 ring-inset ring-black/5", className)}>
        {logo}
      </span>
    );
  }
  return <span className={cn("inline-flex items-center", className)}>{logo}</span>;
}

/** Karandaaz's horizontal wordmark lockup — never resize disproportionately or recolor. */
export function KarandaazLogo({ className, height = 16 }: { className?: string; height?: number }) {
  return <BrandImage image={karandaazLogo} alt="Karandaaz" height={height} className={className} />;
}

/**
 * Wraps the Karandaaz logo in a white rounded chip so it stays legible on
 * dark (Ink Navy / Matisse) sections, per brand guidelines.
 */
export function KarandaazBadge({
  className,
  label = "An initiative by",
  tone = "onDark",
}: {
  className?: string;
  label?: string;
  tone?: "onDark" | "onLight";
}) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {label && (
        <span className={cn("text-xs", tone === "onDark" ? "text-[#9FB4C2]" : "text-[#4A6274]")}>{label}</span>
      )}
      <span className="inline-flex items-center rounded-lg bg-white px-3.5 py-2 ring-1 ring-inset ring-black/5">
        <KarandaazLogo height={14} />
      </span>
    </div>
  );
}
