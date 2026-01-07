"use client";

import { useEffect } from "react";
import Script from "next/script";

import { useTrackingConsent } from "@/components/tracking/TrackingConsentProvider";

const GA_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ?? "";
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "";
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID ?? "";

const primaryGtagId = GA_ID || ADS_ID;

export default function TrackingScriptLoader() {
  const { consent, isReady } = useTrackingConsent();
  const { analytics, marketing } = consent;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.gtag !== "function") return;
    (window.gtag as any)("consent", "update", {
      analytics_storage: analytics ? "granted" : "denied",
      ad_storage: marketing ? "granted" : "denied",
    });
  }, [analytics, marketing]);

  if (!isReady) {
    return null;
  }

  const shouldLoadGtag = Boolean(primaryGtagId && (analytics || marketing));
  const shouldLoadMeta = Boolean(META_PIXEL_ID && marketing);
  const shouldLoadClarity = Boolean(CLARITY_ID && analytics);

  return (
    <>
      {shouldLoadGtag ? (
        <>
          <Script
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${primaryGtagId}`}
          />
          <Script id="ga-gtag-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('consent', 'default', {
                analytics_storage: '${analytics ? "granted" : "denied"}',
                ad_storage: '${marketing ? "granted" : "denied"}'
              });
            `}
          </Script>
          {GA_ID ? (
            <Script id="ga4-config" strategy="afterInteractive">
              {`window.gtag('config','${GA_ID}', { send_page_view: false });`}
            </Script>
          ) : null}
          {marketing && ADS_ID ? (
            <Script id="google-ads-config" strategy="afterInteractive">
              {`window.gtag('config','${ADS_ID}');`}
            </Script>
          ) : null}
        </>
      ) : null}

      {shouldLoadMeta ? (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');
          `}
        </Script>
      ) : null}

      {shouldLoadClarity ? (
        <Script id="clarity-script" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, 'clarity', 'script', '${CLARITY_ID}');
          `}
        </Script>
      ) : null}
    </>
  );
}
