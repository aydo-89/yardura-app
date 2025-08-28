export default function Footer() {
  return (
    <footer className="border-t mt-16">
      <div className="container py-8 text-sm text-slate-600 grid md:grid-cols-3 gap-6">
        <div>
          <div className="font-extrabold text-ink">Yardura</div>
          <p className="mt-2">Serving South Minneapolis, Richfield, Edina, Bloomington.</p>
          <p className="mt-2">Mon–Fri 8am–6pm • Sat 10am–4pm</p>
        </div>
        <div>
          <div className="font-semibold">Contact</div>
          <p className="mt-2"><a href="tel:+16125819812">(612) 581-9812</a></p>
          <p><a href="mailto:hello@yardura.com">hello@yardura.com</a></p>
        </div>
        <div>
          <div className="font-semibold">Legal</div>
          <p className="mt-2">Insights are informational only and not veterinary advice. Data collection is opt-in.</p>
          <p className="mt-2">© {new Date().getFullYear()} Yardura, LLC. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

