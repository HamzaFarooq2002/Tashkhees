import type { SVGProps } from "react";
import { ArrowLeftRight, HandCoins, ServerCog } from "lucide-react";

/**
 * Category icons for the three scoring pillars. Kept behind these names so call sites stay
 * agnostic of the icon library. 1.6px stroke to match the brand's line weight.
 */

type IconProps = SVGProps<SVGSVGElement>;

/** Technology — payment infrastructure: messaging standards, APIs, networks, access channels. */
export function TechnologyIcon(props: IconProps) {
  return <ServerCog strokeWidth={1.6} aria-hidden="true" {...props} />;
}

/** Operational — clearing & settlement, interoperability, and the flow of funds between participants. */
export function OperationalIcon(props: IconProps) {
  return <ArrowLeftRight strokeWidth={1.6} aria-hidden="true" {...props} />;
}

/** Financial inclusion — access to and use of financial services by the whole population. */
export function InclusionIcon(props: IconProps) {
  return <HandCoins strokeWidth={1.6} aria-hidden="true" {...props} />;
}
