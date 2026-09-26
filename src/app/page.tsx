import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TashkheesLogo, KarandaazBadge } from "@/components/brand/logo";
import { DotGrid } from "@/components/brand/dot-grid";
import { TechnologyIcon, OperationalIcon, InclusionIcon } from "@/components/brand/icons";

const CATEGORIES = [
  {
    icon: TechnologyIcon,
    name: "Technology Parameters",
    weight: "40%",
    color: "#08628B",
    description:
      "Messaging standards, authentication, APIs, network connectivity, overlay services, and access channels — the technical foundation an instant payment system runs on.",
  },
  {
    icon: OperationalIcon,
    name: "Operational Parameters",
    weight: "35%",
    color: "#11698E",
    description:
      "Clearing and settlement, interoperability, enabled use cases, legal and regulatory readiness, risk management, dispute resolution, and governance.",
  },
  {
    icon: InclusionIcon,
    name: "Financial Inclusion Parameters",
    weight: "25%",
    color: "#0089C4",
    description:
      "Banking and wallet reach, financial and gender inclusion, internet and mobile penetration, national ID coverage, cash dominance, and consumer behavior.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-5 py-3 sm:px-10">
          <Link href="/" aria-label="Tashkhees home">
            <TashkheesLogo height={80} priority />
          </Link>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button className="rounded-lg px-4 font-semibold" asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-[#08628B]">
          <DotGrid className="right-0 top-0 h-56 w-56 -translate-y-8 translate-x-8" />
          <DotGrid className="bottom-0 left-0 h-56 w-56 translate-y-8 -translate-x-8" />
          <div className="relative mx-auto w-full max-w-[1200px] px-5 py-20 sm:px-10 sm:py-28">
            <div className="max-w-2xl">
              <p className="eyebrow text-[#8FD0EE]">Inclusive Instant Payment System readiness toolkit</p>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Assess a country&apos;s readiness for Instant Payment Systems
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">
                Tashkhees is a structured evaluation tool for analysts assessing how ready and mature
                a country&apos;s payment ecosystem is for instant payments — scored consistently across
                technology, operational, and financial inclusion dimensions.
              </p>
              <div className="mt-9 flex flex-wrap gap-4">
                <Button
                  size="lg"
                  className="h-auto rounded-lg bg-white px-[26px] py-[14px] font-semibold text-[#08628B] hover:bg-white/90"
                  asChild
                >
                  <Link href="/signup">Get started</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-auto rounded-lg border-[1.5px] border-white/50 bg-transparent px-[26px] py-[14px] font-semibold text-white hover:bg-white/10 hover:text-white"
                  asChild
                >
                  <Link href="/login">Log in</Link>
                </Button>
              </div>
              <div className="mt-12">
                <KarandaazBadge label="A Karandaaz Digital Financial Services Initiative" />
              </div>
            </div>
          </div>
        </section>

        {/* Pillars */}
        <section className="bg-background">
          <div className="mx-auto w-full max-w-[1200px] px-5 py-20 sm:px-10">
            <p className="eyebrow text-[#0089C4]">Scoring framework</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0B2E42]">
              Three assessment categories
            </h2>
            <p className="mt-3 max-w-2xl text-[#4A6274]">
              Every assessment is built from the same versioned scoring key, applied consistently
              across 59+ Parameters.
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {CATEGORIES.map((category) => (
                <div
                  key={category.name}
                  className="relative overflow-hidden rounded-[14px] border border-[#E4EBEF] bg-white"
                >
                  <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: category.color }} />
                  <div className="p-6 pt-7">
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${category.color}1A`, color: category.color }}
                    >
                      <category.icon className="h-7 w-7" />
                    </div>
                    <div className="mt-5 flex items-baseline justify-between gap-2">
                      <h3 className="font-heading text-lg font-bold text-[#0B2E42]">{category.name}</h3>
                    </div>
                    <span
                      className="mt-1 inline-block text-sm font-semibold"
                      style={{ color: category.color }}
                    >
                      {category.weight} of score
                    </span>
                    <p className="mt-3 text-sm leading-relaxed text-[#4A6274]">{category.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section className="relative overflow-hidden bg-[#11698E]">
          <DotGrid className="right-0 top-0 h-48 w-48 -translate-y-6 translate-x-6" />
          <div className="relative mx-auto flex w-full max-w-[1200px] flex-col items-start justify-between gap-6 px-5 py-16 sm:flex-row sm:items-center sm:px-10">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Ready to score your first market?
              </h2>
              <p className="mt-2 max-w-lg text-white/80">
                Create an account and start a structured, defensible readiness assessment in minutes.
              </p>
            </div>
            <Button
              size="lg"
              className="h-auto shrink-0 rounded-lg bg-white px-[26px] py-[14px] font-semibold text-[#11698E] hover:bg-white/90"
              asChild
            >
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="bg-[#0B2E42]">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-5 py-12 sm:px-10">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <TashkheesLogo height={64} tone="onDark" />
            <KarandaazBadge />
          </div>
          <div className="border-t border-white/10 pt-6 text-sm text-[#9FB4C2]">
            Tashkhees — Instant Payment System readiness assessment.
          </div>
        </div>
      </footer>
    </div>
  );
}
