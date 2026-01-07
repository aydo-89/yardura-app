# App Store Submission Checklist (InsightScoop)

## In-App Purchases (Premium Wellness)
- Use Apple IAP for Premium Wellness on iOS (no external purchase flow for the same digital features).
- Display subscription price, billing period, and auto-renew details before purchase.
- Provide a restore purchases option.
- Provide a Manage Subscription path (App Store account settings or Customer Center).
- Ensure the IAP product IDs and subscription group are configured in App Store Connect and RevenueCat.
- Confirm paywall and entitlement names match App Store Connect exactly.

## App Store Metadata
- App name, subtitle, keywords, and descriptions reflect both scooping service and wellness features.
- Include screenshots and preview video for iPhone sizes.
- Provide support URL, privacy policy URL, and terms URL.
- Provide marketing URL (landing page) and a contact email.
- Ensure any medical/wellness claims are framed as informational and non-diagnostic.

## Legal & Compliance
- Privacy Policy includes data collection and in-app purchase handling.
- Terms of Service includes subscription terms (auto-renew, cancellation, refunds).
- Billing policy includes IAP terms and service billing details.
- Scooper Marketplace Terms cover independent contractor status, QA review, payout policies, safety, and liability.

## App Review Notes
- Provide a test account with credentials.
- Explain how to trigger core flows (capture, chat, reminders, food scan, walk tracking).
- If paywall requires sandbox, note how to test in-app purchases.
- If any features require hardware (scooper device), clarify they are optional.

## App Privacy (App Store Connect)
- Declare collected data types: account info, contact info, location, photos/media, purchase data, diagnostics.
- Declare usage purpose: app functionality, analytics, personalization, customer support.
- Mark any data linked to user identity if applicable.
- Describe background location usage (walk detection and on-site verification) if enabled.

## Permissions
- Verify purpose strings for camera, photos, location, microphone match actual usage.
- Ensure the app handles denied permissions gracefully.
- Document any background location or audio usage in the review notes.

## UX / Policy Compliance
- Avoid claims that imply medical diagnosis; keep "not a diagnosis" copy.
- Provide clear opt-in for notifications and marketing.
- Ensure links to external purchase for physical services are not framed as a way around IAP.
- Provide a visible way to delete an account or request deletion (or explain the process in settings).
- Avoid hidden paywalls or misleading "free" claims.

## Build & Testing
- Test IAP flow in sandbox for both purchase and restore.
- Validate webhooks update premium access in the backend.
- Confirm dark/light mode legibility for legal pages and paywall screens.
- Verify no external payment links appear for Premium Wellness on iOS.
