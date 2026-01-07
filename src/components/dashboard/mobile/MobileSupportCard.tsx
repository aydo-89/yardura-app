import { PhoneCall, MessageCircle } from "lucide-react";

export default function MobileSupportCard() {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">
        Need help?
      </p>
      <h3 className="text-lg font-semibold text-white mt-1">
        Reach the Yardura team
      </h3>
      <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
        <a
          href="tel:1-877-417-9273"
          className="flex items-center gap-2 justify-center py-2 rounded-xl bg-brand-mint/10 text-brand-mint border border-brand-mint/60"
        >
          <PhoneCall className="h-4 w-4" aria-hidden />
          Call us
        </a>
        <a
          href="mailto:hello@yardura.com"
          className="flex items-center gap-2 justify-center py-2 rounded-xl bg-slate-800 text-slate-100 border border-slate-700"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          Email support
        </a>
      </div>
    </section>
  );
}
