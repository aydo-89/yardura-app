import AnimatedHeader from "@/components/site/AnimatedHeader";
import Footer from "@/components/footer";
import Insights from "@/components/insights";

export default function InsightsPage() {
  return (
    <div className="min-h-screen">
      <AnimatedHeader />
      <main className="pt-16">
        <Insights />
      </main>
      <Footer />
    </div>
  );
}
