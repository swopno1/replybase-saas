import Script from "next/script";

const plausibleDomain =
  process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || "app.replybase.co.uk";
const plausibleScriptSrc =
  process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC ||
  "https://analytics.replybase.co.uk/js/script.js";
const clarityProjectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID || "";
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";

export function AnalyticsScripts() {
  return (
    <>
      <Script
        id="plausible"
        strategy="afterInteractive"
        defer
        data-domain={plausibleDomain}
        src={plausibleScriptSrc}
      />

      {clarityProjectId ? (
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityProjectId}");`}
        </Script>
      ) : null}

      {posthogKey ? (
        <Script id="posthog" strategy="lazyOnload">
          {`!function(t,e){var o,n,p,r;e.__SV=1,t.posthog=t.posthog||[],t.posthog._i=[],t.posthog.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.posthog).people=p.people||[],p.toString=function(t){var e="posthog";return"posthog"!==t&&(e+="."+t),e},p.people.toString=function(){return p.toString(1)+".people"},o="capture identify alias people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user group.set group.set_once group.unset group.remove group.union group.track_charge group.clear_charges group.delete_user".split(" ");for(r=0;r<o.length;r++)g(p,o[r]);t.posthog._i.push([i,s,a])},t.posthog.init("${posthogKey}",{api_host:"${posthogHost}",capture_pageview:false,capture_pageleave:true})}(window,document);`}
        </Script>
      ) : null}
    </>
  );
}
