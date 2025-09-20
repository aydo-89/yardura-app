import AnimatedHeader from '@/components/site/AnimatedHeader';
import Footer from '@/components/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Mail, MapPin } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen">
      <AnimatedHeader />
      <main className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Contact Us
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Get in touch with our team for any questions or to schedule service
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="size-5 text-accent" />
                  Call Us
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-2">Available 8AM - 6PM CST</p>
                <a
                  href="tel:1-888-915-9273"
                  className="text-accent hover:text-accent-dark font-medium"
                >
                  1-888-915-YARD
                </a>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="size-5 text-accent" />
                  Email Us
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-2">We respond within 24 hours</p>
                <a
                  href="mailto:hello@yardura.com"
                  className="text-accent hover:text-accent-dark font-medium"
                >
                  hello@yardura.com
                </a>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="size-5 text-accent" />
                  Service Area
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-2">Twin Cities Metro Area</p>
                <p className="text-sm text-gray-500">
                  Minneapolis, Richfield, Edina, Bloomington & surrounding areas
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

