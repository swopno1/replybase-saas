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
        <div className="bg-white text-primary-foreground flex size-12 items-center justify-center rounded-md overflow-hidden">
          <Image
            src="/image/replybase-logo.jpg"
            alt="ReplyBase"
            width={64}
            height={64}
            className="h-12 w-12 object-contain"
            priority
          />
        </div>

        <span className="text-xl font-bold">ReplyBase</span>
      </div>
    </Link>
  );
}
