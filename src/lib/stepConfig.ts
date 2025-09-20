import {
  MapPin,
  Building,
  Home,
  Clock,
  Settings,
  Star,
  CheckCircle,
  LucideIcon,
} from "lucide-react";

export interface StepConfig {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

export const getSteps = (
  frequency?: string,
  isCommercial?: boolean,
): StepConfig[] => [
  {
    id: "zip-check",
    title: "Service Area",
    description: "Verify your location for service",
    icon: MapPin,
    color: "from-blue-500 to-purple-600",
  },
  {
    id: "service-type",
    title: "Service Type",
    description: "Residential or community service",
    icon: Building,
    color: "from-purple-500 to-pink-600",
  },
  {
    id: "basics",
    title: "Property Details",
    description: "Tell us about your dogs and yard",
    icon: Home,
    color: "from-green-500 to-emerald-600",
  },
  // Skip service frequency step for commercial properties
  ...(isCommercial
    ? []
    : [
        {
          id: "frequency",
          title: "Service Frequency",
          description: "How often do you need service?",
          icon: Clock,
          color: "from-orange-500 to-red-600",
        },
      ]),
  ...(isCommercial
    ? []
    : [
        {
          id: "customization",
          title: "Customize Service",
          description: "Add extras and preferences",
          icon: Settings,
          color: "from-yellow-500 to-orange-600",
        },
      ]),
  // Wellness insights step (only for residential, not commercial)
  ...(isCommercial
    ? []
    : [
        {
          id: "wellness",
          title: "Wellness & Health",
          description: "Basic insights included free - add premium options",
          icon: Star,
          color: "from-teal-500 to-cyan-600",
        },
      ]),
  ...(isCommercial
    ? [
        {
          id: "commercial-contact",
          title: "Commercial Contact",
          description: "Provide your details for custom quote",
          icon: Building,
          color: "from-indigo-500 to-blue-600",
        },
      ]
    : []),
  {
    id: "contact-review",
    title: isCommercial ? "Review & Submit" : "Contact & Confirm",
    description: isCommercial
      ? "Review your request and submit"
      : "Your info and final quote review",
    icon: CheckCircle,
    color: "from-emerald-500 to-teal-600",
  },
];

export const getStepIndex = (stepId: string, steps: StepConfig[]): number => {
  return steps.findIndex((step) => step.id === stepId);
};

export const getStepById = (
  stepId: string,
  steps: StepConfig[],
): StepConfig | undefined => {
  return steps.find((step) => step.id === stepId);
};

export const isStepCompleted = (
  stepId: string,
  currentStepIndex: number,
  steps: StepConfig[],
): boolean => {
  const stepIndex = getStepIndex(stepId, steps);
  return stepIndex < currentStepIndex;
};

export const isStepCurrent = (
  stepId: string,
  currentStepIndex: number,
  steps: StepConfig[],
): boolean => {
  const stepIndex = getStepIndex(stepId, steps);
  return stepIndex === currentStepIndex;
};

export const canAccessStep = (
  stepId: string,
  currentStepIndex: number,
  steps: StepConfig[],
): boolean => {
  const stepIndex = getStepIndex(stepId, steps);
  return stepIndex <= currentStepIndex || stepIndex === currentStepIndex + 1;
};
