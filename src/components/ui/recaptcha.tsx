'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './button';
import { Shield, CheckCircle, AlertCircle } from 'lucide-react';

interface RecaptchaProps {
  onVerify: (token: string | null) => void;
  onExpired?: () => void;
  onError?: () => void;
  siteKey: string;
  size?: 'compact' | 'normal';
  theme?: 'light' | 'dark';
  className?: string;
}

declare global {
  interface Window {
    grecaptcha: any;
    onRecaptchaLoad: () => void;
  }
}

export function Recaptcha({
  onVerify,
  onExpired,
  onError,
  siteKey,
  size = 'normal',
  theme = 'light',
  className = '',
}: RecaptchaProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load reCAPTCHA script
    if (!document.querySelector('#recaptcha-script')) {
      const script = document.createElement('script');
      script.id = 'recaptcha-script';
      script.src = `https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    // Define global callback
    window.onRecaptchaLoad = () => {
      setIsLoaded(true);
    };

    return () => {
      // Cleanup
      if (widgetIdRef.current !== null && window.grecaptcha) {
        window.grecaptcha.reset(widgetIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isLoaded && containerRef.current && !widgetIdRef.current) {
      try {
        widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
          sitekey: siteKey,
          size,
          theme,
          callback: (token: string) => {
            setIsVerified(true);
            setError(null);
            onVerify(token);
          },
          'expired-callback': () => {
            setIsVerified(false);
            onExpired?.();
          },
          'error-callback': () => {
            setError('reCAPTCHA error occurred');
            onError?.();
          },
        });
      } catch (err) {
        setError('Failed to load reCAPTCHA');
        onError?.();
      }
    }
  }, [isLoaded, siteKey, size, theme, onVerify, onExpired, onError]);

  const resetRecaptcha = () => {
    if (widgetIdRef.current !== null && window.grecaptcha) {
      window.grecaptcha.reset(widgetIdRef.current);
      setIsVerified(false);
      onVerify(null);
    }
  };

  if (error) {
    return (
      <div
        className={`flex items-center gap-2 p-3 border border-red-200 rounded-lg bg-red-50 ${className}`}
      >
        <AlertCircle className="size-4 text-red-600" />
        <span className="text-sm text-red-700">{error}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setError(null);
            setIsLoaded(false);
            // Reload script
            setTimeout(() => setIsLoaded(true), 1000);
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Shield className="size-4 text-accent" />
        <span className="text-sm font-medium">Security Verification</span>
        {isVerified && (
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle className="size-4" />
            <span className="text-xs">Verified</span>
          </div>
        )}
      </div>

      <div ref={containerRef} className="recaptcha-container" />

      {!isLoaded && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <div className="animate-spin rounded-full h-3 w-3 border border-accent border-t-transparent" />
          Loading security verification...
        </div>
      )}

      {isVerified && (
        <Button variant="ghost" size="sm" onClick={resetRecaptcha} className="text-xs">
          Reset verification
        </Button>
      )}
    </div>
  );
}

// Honeypot field component
interface HoneypotProps {
  name?: string;
  className?: string;
}

export function HoneypotField({ name = 'website', className = '' }: HoneypotProps) {
  return (
    <div className={`hidden ${className}`} aria-hidden="true">
      <label htmlFor={name}>
        Leave this field empty:
        <input
          type="text"
          id={name}
          name={name}
          tabIndex={-1}
          autoComplete="off"
          style={{ display: 'none' }}
        />
      </label>
    </div>
  );
}

// Combined form protection component
interface FormProtectionProps {
  onVerify: (token: string | null) => void;
  recaptchaSiteKey?: string;
  showRecaptcha?: boolean;
  honeypotName?: string;
  className?: string;
}

export function FormProtection({
  onVerify,
  recaptchaSiteKey,
  showRecaptcha = true,
  honeypotName = 'website',
  className = '',
}: FormProtectionProps) {
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);

  const handleRecaptchaVerify = (token: string | null) => {
    setRecaptchaToken(token);
    onVerify(token);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Honeypot field */}
      <HoneypotField name={honeypotName} />

      {/* reCAPTCHA */}
      {showRecaptcha && recaptchaSiteKey && (
        <Recaptcha siteKey={recaptchaSiteKey} onVerify={handleRecaptchaVerify} />
      )}

      {/* Security notice */}
      <div className="text-xs text-muted bg-muted/50 p-3 rounded-lg">
        <div className="flex items-start gap-2">
          <Shield className="size-3 text-accent mt-0.5 flex-shrink-0" />
          <div>
            Your information is protected with enterprise-grade security. We use multiple layers of
            validation to prevent spam and ensure data integrity.
          </div>
        </div>
      </div>
    </div>
  );
}
