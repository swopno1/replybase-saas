import Link from "next/link";
import Image from "next/image";

interface LogoProps {
  /**
   * Whether to open homepage in new tab
   * - false: Auth pages (same window)
   * - true: Dashboard (new window)
   */
  openInNewTab?: boolean;
  className?: string;
}

export function Logo({ openInNewTab = false, className = "" }: LogoProps) {
  const linkProps = openInNewTab
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <Link href="https://replybase.co.uk" {...linkProps} className={className}>
      <div className="flex items-center gap-2">
        {/* TODO: Replace with actual logo image path */}
        <div className="bg-white text-primary-foreground flex size-12 items-center justify-center rounded-md">
          <Image
            src="/image/logo.png"
            alt="ReplyBase"
            width={64}
            height={64}
            className="h-12 w-12"
          />
        </div>

        <span className="text-xl font-bold">ReplyBase</span>
      </div>
    </Link>
  );
}
