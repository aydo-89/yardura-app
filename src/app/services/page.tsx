import AnimatedHeader from '@/components/site/AnimatedHeader';
import Footer from '@/components/footer';
import Services from '@/components/services';

export default function ServicesPage() {
  return (
    <div className="min-h-screen">
      <AnimatedHeader />
      <main className="pt-16">
        <Services />
      </main>
      <Footer />
    </div>
  );
}

