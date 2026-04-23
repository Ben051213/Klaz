// Per-class flavor tint helper.
//
// Each class gets one of six macaron tints (mint/rose/lavender/apricot/
// pistachio/vanilla) stored on `classes.flavor`. Cards, chips, and dots
// use the same palette so a glance at the enrolled grid is enough to
// know which class you're looking at — colour becomes identity.
//
// IMPORTANT: Tailwind v4's content scanner only picks up class names
// that appear as *literal strings* in source. Never construct these
// with template literals like `bg-klaz-${flavor}` — they won't be
// generated. The full class names below ensure each variant ships.

export type Flavor =
  | "mint"
  | "rose"
  | "lavender"
  | "apricot"
  | "pistachio"
  | "vanilla"

export type FlavorClasses = {
  /** Resting border (subtle, tinted) */
  border: string
  /** Stronger border on hover — pulls the card forward */
  hoverBorder: string
  /** Solid fill, used for status dots + Live ping core */
  dot: string
  /** Tint background for pills/chips (e.g. the "Live" pill) */
  chipBg: string
  /** Dark-enough tint text readable on chipBg */
  chipText: string
  /** Animated ping halo (same hue as dot, lighter) */
  ping: string
  /** Soft wash — e.g. the left edge of a card on hover */
  wash: string
  /** Raw hex for when inline styles are unavoidable (SVGs etc.) */
  hex: string
}

const MAP: Record<Flavor, FlavorClasses> = {
  mint: {
    border: "border-klaz-mint/30",
    hoverBorder: "hover:border-klaz-mint/60",
    dot: "bg-klaz-mint",
    chipBg: "bg-klaz-mint-bg",
    chipText: "text-klaz-accent2",
    ping: "bg-klaz-mint/70",
    wash: "bg-klaz-mint-bg",
    hex: "#8ecbb2",
  },
  rose: {
    border: "border-klaz-rose/30",
    hoverBorder: "hover:border-klaz-rose/60",
    dot: "bg-klaz-rose",
    chipBg: "bg-klaz-rose-bg",
    chipText: "text-klaz-bad",
    ping: "bg-klaz-rose/70",
    wash: "bg-klaz-rose-bg",
    hex: "#e4a3ae",
  },
  lavender: {
    border: "border-klaz-lavender/30",
    hoverBorder: "hover:border-klaz-lavender/60",
    dot: "bg-klaz-lavender",
    chipBg: "bg-klaz-lavender-bg",
    chipText: "text-klaz-lavender",
    ping: "bg-klaz-lavender/70",
    wash: "bg-klaz-lavender-bg",
    hex: "#b3a6d9",
  },
  apricot: {
    border: "border-klaz-apricot/30",
    hoverBorder: "hover:border-klaz-apricot/60",
    dot: "bg-klaz-apricot",
    chipBg: "bg-klaz-apricot-bg",
    chipText: "text-klaz-warn",
    ping: "bg-klaz-apricot/70",
    wash: "bg-klaz-apricot-bg",
    hex: "#e9b787",
  },
  pistachio: {
    border: "border-klaz-pistachio/30",
    hoverBorder: "hover:border-klaz-pistachio/60",
    dot: "bg-klaz-pistachio",
    chipBg: "bg-klaz-pistachio-bg",
    chipText: "text-klaz-ok",
    ping: "bg-klaz-pistachio/70",
    wash: "bg-klaz-pistachio-bg",
    hex: "#c2d28a",
  },
  vanilla: {
    border: "border-klaz-vanilla/30",
    hoverBorder: "hover:border-klaz-vanilla/60",
    dot: "bg-klaz-vanilla",
    chipBg: "bg-klaz-vanilla-bg",
    chipText: "text-klaz-warn",
    ping: "bg-klaz-vanilla/70",
    wash: "bg-klaz-vanilla-bg",
    hex: "#e6d49a",
  },
}

function isFlavor(x: string | undefined | null): x is Flavor {
  return (
    x === "mint" ||
    x === "rose" ||
    x === "lavender" ||
    x === "apricot" ||
    x === "pistachio" ||
    x === "vanilla"
  )
}

/**
 * Resolve a flavor string (from `classes.flavor`) to the full set of
 * Tailwind classes + the raw hex. Unknown/missing → mint (default).
 */
export function flavorClasses(flavor?: string | null): FlavorClasses {
  return MAP[isFlavor(flavor) ? flavor : "mint"]
}

/** List of all six flavors, useful for pickers. */
export const FLAVORS: readonly Flavor[] = [
  "mint",
  "rose",
  "lavender",
  "apricot",
  "pistachio",
  "vanilla",
] as const
