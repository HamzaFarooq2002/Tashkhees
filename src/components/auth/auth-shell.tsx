import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TashkheesLogo, KarandaazBadge } from "@/components/brand/logo";

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex justify-center">
          <Link href="/" aria-label="Tashkhees home">
            <TashkheesLogo height={88} priority />
          </Link>
        </div>
        <Card className="border-[#E4EBEF] shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
        {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
        <div className="mt-8 flex justify-center">
          <KarandaazBadge label="An initiative by" tone="onLight" />
        </div>
      </div>
    </div>
  );
}
