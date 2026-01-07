import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";

const PORTFOLIO = [
  { name: "InsightScoop", url: "https://www.getinsightscoop.com" },
  { name: "Pupplmnt", url: "https://www.pupplmnt.com" },
  { name: "Supp Dog", url: "https://www.suppdog.com" },
  { name: "Once Upon a Lawn", url: "https://www.onceuponalawn.com" },
];

export default function YarduraFooter() {
  return (
    <footer id="contact" className="bg-slate-950 text-white">
      <div className="container mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1.3fr,1fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Image
                src="/yardura-logo.png"
                alt="Yardura"
                width={48}
                height={48}
                className="h-12 w-12 rounded-full border border-white/30 bg-white/90 object-contain"
              />
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-white/60">Yardura</p>
                <p className="font-semibold text-lg">Pet-first Brand Collective</p>
              </div>
            </div>
            <p className="text-sm text-white/70">
              We incubate and scale premium yard and pet experiences by sharing operations, AI insights, and sustainability playbooks across every label.
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-white/80">
              <span className="inline-flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-300" /> 1-877-417-9273
              </span>
              <span className="inline-flex items-center gap-2">
                <Mail className="h-4 w-4 text-emerald-300" /> hello@yardura.com
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-300" /> Minneapolis, MN
              </span>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-200/80">Portfolio</p>
              <ul className="mt-3 space-y-2 text-sm font-semibold text-white/80">
                {PORTFOLIO.map((item) => (
                  <li key={item.name}>
                    <Link href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-200/80">Connect</p>
              <ul className="mt-3 space-y-2 text-sm text-white/80">
                <li>
                  <a href="mailto:hello@yardura.com" className="hover:text-white">
                    Partner inquiries
                  </a>
                </li>
                <li>
                  <Link href="https://cal.com/yardura/partnership" className="hover:text-white">
                    Book a strategy call
                  </Link>
                </li>
                <li>
                  <Link href="https://www.linkedin.com/company/yardura" className="hover:text-white">
                    LinkedIn
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-white/60">
          <p>© {new Date().getFullYear()} Yardura. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
