import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dog Health Blog | InsightScoop",
  description: "Expert guides on dog health, stool analysis, and pet wellness from InsightScoop - Minneapolis-St. Paul dog waste removal with health monitoring.",
};

const posts = [
  {
    slug: "spring-dog-poop-cleanup",
    title: "Spring Dog Waste Cleanup: How to Handle the Winter Poop Pile-Up",
    description: "The spring thaw reveals months of frozen dog waste. Learn why professional cleanup matters and what your dog's winter stool reveals about their health.",
    date: "February 8, 2026",
    readTime: "10 min read",
  },
  {
    slug: "dog-poop-color-guide",
    title: "What Your Dog's Poop Color Means: A Complete Health Guide",
    description: "Learn what your dog's poop color reveals about their health. Our veterinary-informed guide covers brown, black, red, yellow, green, and white dog stool.",
    date: "February 5, 2026",
    readTime: "8 min read",
  },
  {
    slug: "twin-cities-dog-waste-removal",
    title: "Dog Waste Removal Services in Minneapolis-St. Paul",
    description: "Professional pooper scooper service for the Twin Cities with health monitoring. Serving Minneapolis, St. Paul, and all metro suburbs.",
    date: "February 5, 2026",
    readTime: "6 min read",
  },
  {
    slug: "3c-framework-dog-health",
    title: "The 3C Framework: How We Monitor Your Dog's Health",
    description: "Most dog waste removal services just see poop. We see data. Learn how Color, Consistency, and Contents reveal early warning signs.",
    date: "February 5, 2026",
    readTime: "9 min read",
  },
];

export default function BlogIndex() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Dog Health Blog</h1>
        <p className="text-xl text-gray-600 mb-12">
          Expert guides on keeping your dog healthy - from the team at InsightScoop.
        </p>
        
        <div className="space-y-8">
          {posts.map((post) => (
            <article key={post.slug} className="border-b border-gray-200 pb-8">
              <Link href={`/blog/${post.slug}`} className="group">
                <h2 className="text-2xl font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors mb-2">
                  {post.title}
                </h2>
                <p className="text-gray-600 mb-3">{post.description}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{post.date}</span>
                  <span>·</span>
                  <span>{post.readTime}</span>
                </div>
              </Link>
            </article>
          ))}
        </div>
        
        <div className="mt-16 p-8 bg-emerald-50 rounded-lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Ready for a cleaner yard and healthier dog?
          </h2>
          <p className="text-gray-600 mb-4">
            InsightScoop provides dog waste removal with health monitoring in the Twin Cities.
          </p>
          <Link 
            href="/quote" 
            className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
          >
            Get a Free Quote
          </Link>
        </div>
      </div>
    </main>
  );
}
