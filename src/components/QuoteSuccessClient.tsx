'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  Mail,
  Phone,
  Calendar,
  Home,
  ArrowRight,
  Heart,
  Shield,
  Building,
} from 'lucide-react';
import Reveal from '@/components/Reveal';
import { useReducedMotionSafe } from '@/hooks/useReducedMotionSafe';
import Link from 'next/link';

export default function QuoteSuccessClient() {
  const router = useRouter();
  const [isCommercial, setIsCommercial] = useState(false);
  const { prefersReducedMotion } = useReducedMotionSafe();

  useEffect(() => {
    // Handle search params on client side
    const searchParams = new URLSearchParams(window.location.search);
    setIsCommercial(searchParams.get('commercial') === 'true');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent-soft/30 via-white to-accent-soft/20">
      <div className="container py-16">
        {/* Success Header */}
        <Reveal>
          <div className="text-center mb-12">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-6"
            >
              <CheckCircle className="size-12 text-green-600" />
            </motion.div>

            <h1 className="text-4xl md:text-5xl font-extrabold text-ink mb-4">
              {isCommercial ? 'Commercial Quote Submitted!' : 'Welcome to Yardura!'}
            </h1>

            <p className="text-xl text-muted max-w-2xl mx-auto mb-8">
              {isCommercial
                ? 'Thank you for your commercial property inquiry. Our team will review your details and contact you within 24 hours with a personalized quote.'
                : "Your quote has been confirmed and your account is ready. Let's get your Minneapolis yard sparkling clean!"}
            </p>

            {isCommercial ? (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/">
                  <Button className="btn-gradient">
                    Return to Homepage
                    <ArrowRight className="size-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button variant="outline">Contact Us Directly</Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/dashboard">
                  <Button className="btn-gradient">
                    Access Your Dashboard
                    <ArrowRight className="size-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/schedule">
                  <Button variant="outline">Schedule Your First Visit</Button>
                </Link>
              </div>
            )}
          </div>
        </Reveal>

        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
          {/* What's Next */}
          <Reveal delay={0.1}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="size-5 text-accent" />
                  What's Next?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isCommercial ? (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="size-6 bg-accent rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">
                        1
                      </div>
                      <div>
                        <h4 className="font-semibold text-ink">Review in Progress</h4>
                        <p className="text-sm text-muted">
                          Our commercial team reviews your property details
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="size-6 bg-accent rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">
                        2
                      </div>
                      <div>
                        <h4 className="font-semibold text-ink">Custom Quote Sent</h4>
                        <p className="text-sm text-muted">
                          Receive personalized pricing within 24 hours
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="size-6 bg-accent rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">
                        3
                      </div>
                      <div>
                        <h4 className="font-semibold text-ink">Professional Service</h4>
                        <p className="text-sm text-muted">
                          Dedicated commercial account management
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="size-6 bg-accent rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">
                        1
                      </div>
                      <div>
                        <h4 className="font-semibold text-ink">Check Your Email</h4>
                        <p className="text-sm text-muted">
                          Secure login details sent to your email
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="size-6 bg-accent rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">
                        2
                      </div>
                      <div>
                        <h4 className="font-semibold text-ink">Schedule Your Service</h4>
                        <p className="text-sm text-muted">Choose your preferred day and time</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="size-6 bg-accent rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">
                        3
                      </div>
                      <div>
                        <h4 className="font-semibold text-ink">Enjoy Clean Yards!</h4>
                        <p className="text-sm text-muted">Weekly eco-friendly service starts</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </Reveal>

          {/* Account Benefits */}
          <Reveal delay={0.2}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="size-5 text-accent" />
                  Your Account Benefits
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isCommercial ? (
                  <>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="size-5 text-green-600" />
                      <span className="text-sm">Dedicated commercial account manager</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <CheckCircle className="size-5 text-green-600" />
                      <span className="text-sm">Custom service scheduling</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <CheckCircle className="size-5 text-green-600" />
                      <span className="text-sm">Priority response times</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <CheckCircle className="size-5 text-green-600" />
                      <span className="text-sm">Bulk service discounts</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <CheckCircle className="size-5 text-green-600" />
                      <span className="text-sm">Property-specific solutions</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="size-5 text-green-600" />
                      <span className="text-sm">Real-time service updates</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <CheckCircle className="size-5 text-green-600" />
                      <span className="text-sm">Health insights dashboard</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <CheckCircle className="size-5 text-green-600" />
                      <span className="text-sm">Flexible scheduling</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <CheckCircle className="size-5 text-green-600" />
                      <span className="text-sm">Priority customer support</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <CheckCircle className="size-5 text-green-600" />
                      <span className="text-sm">Eco impact tracking</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </Reveal>

          {/* Contact Info */}
          <Reveal delay={0.3}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="size-5 text-accent" />
                  Need Help?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="size-5 text-accent" />
                  <div>
                    <p className="text-sm font-medium">Email Support</p>
                    <p className="text-xs text-muted">hello@yardura.com</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Phone className="size-5 text-accent" />
                  <div>
                    <p className="text-sm font-medium">Call Us</p>
                    <p className="text-xs text-muted">(888) 915-YARD</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="size-5 text-accent" />
                  <div>
                    <p className="text-sm font-medium">Business Hours</p>
                    <p className="text-xs text-muted">Mon-Fri 8AM-6PM</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Reveal>

          {/* Security & Privacy */}
          <Reveal delay={0.4}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-accent" />
                  Secure & Private
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="size-5 text-green-600" />
                  <span className="text-sm">Encrypted data storage</span>
                </div>

                <div className="flex items-center gap-3">
                  <CheckCircle className="size-5 text-green-600" />
                  <span className="text-sm">Privacy-first approach</span>
                </div>

                <div className="flex items-center gap-3">
                  <CheckCircle className="size-5 text-green-600" />
                  <span className="text-sm">Delete data on request</span>
                </div>

                <div className="flex items-center gap-3">
                  <CheckCircle className="size-5 text-green-600" />
                  <span className="text-sm">No data sharing</span>
                </div>
              </CardContent>
            </Card>
          </Reveal>
        </div>

        {/* Final CTA */}
        <Reveal delay={0.5}>
          <div className="text-center mt-12">
            <Card className="bg-gradient-to-r from-accent-soft/30 via-white to-accent-soft/30 border-accent/20 max-w-2xl mx-auto">
              <CardContent className="p-8">
                <h3 className="text-xl font-bold text-ink mb-3">
                  {isCommercial ? 'Questions About Your Quote?' : 'Ready to Get Started?'}
                </h3>
                <p className="text-muted mb-6">
                  {isCommercial
                    ? 'Our commercial team is standing by to discuss your specific needs and provide a customized solution for your property.'
                    : 'Your first eco-friendly dog waste removal service is just a few clicks away. Minneapolis homeowners love our reliable, professional service.'}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {isCommercial ? (
                    <>
                      <Link href="/contact">
                        <Button className="btn-gradient">Contact Commercial Team</Button>
                      </Link>
                      <Link href="tel:+18889159273">
                        <Button variant="outline">Call (888) 915-YARD</Button>
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link href="/dashboard">
                        <Button className="btn-gradient">Go to Dashboard</Button>
                      </Link>
                      <Link href="/schedule">
                        <Button variant="outline">Schedule Now</Button>
                      </Link>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
