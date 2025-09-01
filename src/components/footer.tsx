export default function Footer() {
  const cities = [
    { name: 'Minneapolis', slug: 'minneapolis' },
    { name: 'St. Paul', slug: 'st-paul' },
    { name: 'Bloomington', slug: 'bloomington' },
    { name: 'Eden Prairie', slug: 'eden-prairie' },
    { name: 'Plymouth', slug: 'plymouth' },
    { name: 'Woodbury', slug: 'woodbury' },
    { name: 'Edina', slug: 'edina' },
    { name: 'Richfield', slug: 'richfield' },
  ];

  return (
    <footer className="border-t mt-16">
      <div className="container py-8 text-sm text-slate-600">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="font-extrabold text-ink">Yardura</div>
            <p className="mt-2">Professional dog waste removal services across the Twin Cities.</p>
            <p className="mt-2">Mon–Fri 8am–6pm • Sat 10am–4pm</p>
          </div>

          <div>
            <div className="font-semibold mb-3">Service Areas</div>
            <div className="space-y-1">
              {cities.map((city) => (
                <p key={city.slug}>
                  <a
                    href={`/city/${city.slug}`}
                    className="hover:text-accent transition-colors"
                  >
                    {city.name}
                  </a>
                </p>
              ))}
            </div>
          </div>

          <div>
            <div className="font-semibold mb-3">Services</div>
            <div className="space-y-1">
              <p><a href="#services" className="hover:text-accent transition-colors">Dog Waste Removal</a></p>
              <p><a href="#pricing" className="hover:text-accent transition-colors">Pricing</a></p>
              <p><a href="#insights" className="hover:text-accent transition-colors">Health Insights</a></p>
              <p><a href="/city" className="hover:text-accent transition-colors">All Cities</a></p>
            </div>
          </div>

          <div>
            <div className="font-semibold mb-3">Contact & Legal</div>
            <p><a href="tel:+18889159273" className="hover:text-accent transition-colors">(888) 915-YARD</a></p>
            <p><a href="mailto:hello@yardura.com" className="hover:text-accent transition-colors">hello@yardura.com</a></p>
            <p className="mt-3 text-xs">Insights are informational only and not veterinary advice.</p>
            <p className="text-xs">© {new Date().getFullYear()} Yardura, LLC. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

