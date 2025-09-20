import { NextRequest } from 'next/server';

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Configuration
const RATE_LIMITS = {
  quoteForm: { max: 5, windowMs: 15 * 60 * 1000 }, // 5 submissions per 15 minutes
  contactForm: { max: 3, windowMs: 10 * 60 * 1000 }, // 3 submissions per 10 minutes
  general: { max: 10, windowMs: 60 * 1000 }, // 10 requests per minute
};

const SUSPICIOUS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /on\w+=/i,
  /data:text/i,
  /vbscript:/i,
  /SELECT.*FROM/i,
  /UNION.*SELECT/i,
  /INSERT.*INTO/i,
  /UPDATE.*SET/i,
  /DELETE.*FROM/i,
  /DROP.*TABLE/i,
  /ALTER.*TABLE/i,
  /EXEC.*XP_/i,
  /EXEC.*SP_/i,
  /script.*alert/i,
  /document\.cookie/i,
  /window\.location/i,
];

const SUSPICIOUS_EMAIL_DOMAINS = [
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'temp-mail.org',
  'throwaway.email',
  'yopmail.com',
  'maildrop.cc',
  'dispostable.com',
];

export interface FormProtectionResult {
  isValid: boolean;
  errors: string[];
  score?: number;
  metadata?: {
    ip: string;
    userAgent: string;
    timestamp: number;
    rateLimited: boolean;
    suspiciousActivity: boolean;
  };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalRequests: number;
}

// Rate limiting function
export function checkRateLimit(
  identifier: string,
  action: keyof typeof RATE_LIMITS,
  request?: NextRequest
): RateLimitResult {
  const now = Date.now();
  const limit = RATE_LIMITS[action];
  const key = `${action}:${identifier}`;

  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    // First request or window expired
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + limit.windowMs,
    });
    return {
      allowed: true,
      remaining: limit.max - 1,
      resetTime: now + limit.windowMs,
      totalRequests: 1,
    };
  }

  if (record.count >= limit.max) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
      totalRequests: record.count,
    };
  }

  // Increment counter
  record.count++;
  rateLimitStore.set(key, record);

  return {
    allowed: true,
    remaining: limit.max - record.count,
    resetTime: record.resetTime,
    totalRequests: record.count,
  };
}

// Input sanitization
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';

  return input
    .trim()
    .replace(/[<>'"&]/g, '') // Remove potentially dangerous characters
    .slice(0, 1000); // Limit length
}

// Suspicious activity detection
export function detectSuspiciousActivity(input: string, email?: string): boolean {
  if (!input) return false;

  // Check for suspicious patterns
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }

  // Check email domain if provided
  if (email) {
    const domain = email.split('@')[1]?.toLowerCase();
    if (domain && SUSPICIOUS_EMAIL_DOMAINS.includes(domain)) {
      return true;
    }
  }

  // Check for excessive special characters
  const specialCharCount = (input.match(/[^a-zA-Z0-9\s]/g) || []).length;
  if (specialCharCount > input.length * 0.3) {
    return true;
  }

  // Check for repetitive characters
  const repetitivePattern = /(.)\1{10,}/;
  if (repetitivePattern.test(input)) {
    return true;
  }

  return false;
}

// Honeypot validation
export function validateHoneypot(honeypotValue?: string): boolean {
  // Honeypot field should be empty
  return !honeypotValue || honeypotValue.trim() === '';
}

// reCAPTCHA validation
export async function validateRecaptcha(
  token: string,
  secretKey: string
): Promise<{ success: boolean; score?: number }> {
  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    const result = await response.json();
    return {
      success: result.success,
      score: result.score,
    };
  } catch (error) {
    console.error('reCAPTCHA validation error:', error);
    return { success: false };
  }
}

// Enhanced email validation
export function validateEmail(email: string): { isValid: boolean; reason?: string } {
  if (!email || typeof email !== 'string') {
    return { isValid: false, reason: 'Email is required' };
  }

  const trimmedEmail = email.trim();

  // Basic format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { isValid: false, reason: 'Invalid email format' };
  }

  // Check domain
  const domain = trimmedEmail.split('@')[1]?.toLowerCase();
  if (!domain) {
    return { isValid: false, reason: 'Invalid email domain' };
  }

  // Check for suspicious domains
  if (SUSPICIOUS_EMAIL_DOMAINS.includes(domain)) {
    return { isValid: false, reason: 'Temporary email addresses not allowed' };
  }

  // Check for common typos
  const commonTypos = ['gmail.co', 'yahoo.co', 'hotmail.co', 'outlook.co'];
  for (const typo of commonTypos) {
    if (domain.includes(typo)) {
      return { isValid: false, reason: 'Please check your email domain' };
    }
  }

  return { isValid: true };
}

// Phone validation
export function validatePhone(phone: string): { isValid: boolean; reason?: string } {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, reason: 'Phone number is required' };
  }

  // Remove all non-digits
  const digitsOnly = phone.replace(/\D/g, '');

  // Check length (should be 10 digits for US numbers)
  if (digitsOnly.length < 10 || digitsOnly.length > 11) {
    return { isValid: false, reason: 'Phone number should be 10 digits' };
  }

  // Check if it starts with 1 (country code)
  if (digitsOnly.length === 11 && !digitsOnly.startsWith('1')) {
    return { isValid: false, reason: 'Invalid phone number format' };
  }

  return { isValid: true };
}

// Name validation
export function validateName(name: string): { isValid: boolean; reason?: string } {
  if (!name || typeof name !== 'string') {
    return { isValid: false, reason: 'Name is required' };
  }

  const trimmedName = name.trim();

  if (trimmedName.length < 2) {
    return { isValid: false, reason: 'Name must be at least 2 characters' };
  }

  if (trimmedName.length > 100) {
    return { isValid: false, reason: 'Name is too long' };
  }

  // Check for only letters, spaces, hyphens, apostrophes
  if (!/^[a-zA-Z\s\-']+$/.test(trimmedName)) {
    return { isValid: false, reason: 'Name contains invalid characters' };
  }

  return { isValid: true };
}

// Address validation
export function validateAddress(address: string): { isValid: boolean; reason?: string } {
  if (!address || typeof address !== 'string') {
    return { isValid: false, reason: 'Address is required' };
  }

  const trimmedAddress = address.trim();

  if (trimmedAddress.length < 5) {
    return { isValid: false, reason: 'Address is too short' };
  }

  if (trimmedAddress.length > 200) {
    return { isValid: false, reason: 'Address is too long' };
  }

  return { isValid: true };
}

// Comprehensive form validation
export async function validateFormSubmission(
  data: Record<string, any>,
  request: NextRequest,
  formType: 'quote' | 'contact' | 'general' = 'general'
): Promise<FormProtectionResult> {
  const errors: string[] = [];
  // Get IP address from headers (Next.js removed request.ip in newer versions)
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-client-ip') ||
    'unknown';
  const userAgent = request.headers.get('user-agent') || '';

  // Rate limiting
  const rateLimitKey =
    formType === 'quote'
      ? ('quoteForm' as const)
      : formType === 'contact'
        ? ('contactForm' as const)
        : ('general' as const);
  const rateLimitResult = checkRateLimit(ip, rateLimitKey, request);
  if (!rateLimitResult.allowed) {
    errors.push('Too many requests. Please try again later.');
  }

  // Honeypot validation
  if (!validateHoneypot(data.honeypot)) {
    errors.push('Form submission rejected.');
  }

  // reCAPTCHA validation (if token provided)
  if (data.recaptchaToken) {
    const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
    if (recaptchaSecret) {
      const recaptchaResult = await validateRecaptcha(data.recaptchaToken, recaptchaSecret);
      if (!recaptchaResult.success) {
        errors.push('reCAPTCHA verification failed.');
      }
    }
  }

  // Input validation based on form type
  if (formType === 'quote') {
    // Validate quote-specific fields
    if (data.email) {
      const emailValidation = validateEmail(data.email);
      if (!emailValidation.isValid) {
        errors.push(`Email: ${emailValidation.reason}`);
      }
    }

    if (data.phone) {
      const phoneValidation = validatePhone(data.phone);
      if (!phoneValidation.isValid) {
        errors.push(`Phone: ${phoneValidation.reason}`);
      }
    }

    if (data.firstName) {
      const nameValidation = validateName(data.firstName);
      if (!nameValidation.isValid) {
        errors.push(`Name: ${nameValidation.reason}`);
      }
    }

    if (data.address) {
      const addressValidation = validateAddress(data.address);
      if (!addressValidation.isValid) {
        errors.push(`Address: ${addressValidation.reason}`);
      }
    }
  }

  // Suspicious activity detection
  const suspiciousActivity = Object.values(data).some((value: any) => {
    if (typeof value === 'string') {
      return detectSuspiciousActivity(value, data.contact?.email);
    }
    return false;
  });

  if (suspiciousActivity) {
    errors.push('Form submission contains suspicious content.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    score: data.recaptchaToken
      ? (await validateRecaptcha(data.recaptchaToken, process.env.RECAPTCHA_SECRET_KEY || '')).score
      : undefined,
    metadata: {
      ip,
      userAgent,
      timestamp: Date.now(),
      rateLimited: !rateLimitResult.allowed,
      suspiciousActivity,
    },
  };
}

// CSRF token generation
export function generateCSRFToken(): string {
  return crypto.randomUUID();
}

// CSRF token validation
export function validateCSRFToken(token: string, storedToken: string): boolean {
  return token === storedToken && token.length > 0;
}

// Input sanitization for database
export function sanitizeForDatabase(input: any): any {
  if (typeof input === 'string') {
    return sanitizeInput(input);
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeForDatabase(item));
  }

  if (typeof input === 'object' && input !== null) {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeForDatabase(value);
    }
    return sanitized;
  }

  return input;
}

// Log suspicious activity
export function logSuspiciousActivity(
  data: any,
  metadata: FormProtectionResult['metadata'],
  formType: string
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    formType,
    suspicious: true,
    data: sanitizeForDatabase(data),
    metadata,
  };

  console.warn('Suspicious form submission detected:', logEntry);

  // In production, you might want to send this to a logging service
  // or store it in a database for review
}
