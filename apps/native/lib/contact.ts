export type ContactChannel = 'sms' | 'email' | 'sms_or_email' | 'unknown';

type ContactInput = {
  preferredContactMethod?: string | null;
  phone?: string | null;
  email?: string | null;
};

const hasValue = (value?: string | null) => Boolean(value && value.trim());

export const resolveContactChannel = (input?: ContactInput | null): ContactChannel => {
  if (!input) return 'unknown';
  const hasPhone = hasValue(input.phone);
  const hasEmail = hasValue(input.email);
  const preferred = input.preferredContactMethod?.toLowerCase();

  if (preferred === 'email') {
    if (hasEmail) return 'email';
    if (hasPhone) return 'sms';
  }

  if (preferred === 'phone') {
    if (hasPhone) return 'sms';
    if (hasEmail) return 'email';
  }

  if (hasPhone && hasEmail) return 'sms_or_email';
  if (hasPhone) return 'sms';
  if (hasEmail) return 'email';
  return 'unknown';
};

export const getContactCopy = (input?: ContactInput | null) => {
  const channel = resolveContactChannel(input);

  switch (channel) {
    case 'sms':
      return {
        etaLabel: 'We will text your ETA',
        confirmLabel: 'We will confirm by text.',
      };
    case 'email':
      return {
        etaLabel: 'We will email your ETA',
        confirmLabel: 'We will confirm by email.',
      };
    case 'sms_or_email':
      return {
        etaLabel: 'We will text or email your ETA',
        confirmLabel: 'We will confirm by text or email.',
      };
    default:
      return {
        etaLabel: 'We will send your ETA',
        confirmLabel: 'We will confirm soon.',
      };
  }
};
