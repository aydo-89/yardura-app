"use client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  calcOneTimeEstimate,
  calcPerVisitEstimate,
  type Frequency,
  type YardSize,
} from "@/lib/pricing";
import { useEffect, useState } from "react";
import { AlertCircle, Info } from "lucide-react";

// Allowed service areas and ZIP codes
const SERVICE_ZIPS: Record<string, string[]> = {
  Minneapolis: ["55406", "55407", "55408", "55409", "55417", "55419"], // South Minneapolis
  "South Minneapolis": ["55406", "55407", "55408", "55409", "55417", "55419"],
  Richfield: ["55423"],
  Bloomington: ["55420", "55425", "55431", "55435", "55437", "55438"],
  Edina: ["55410", "55416", "55424", "55435", "55436", "55439"],
};

const schema = z
  .object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(7),
    address: z.string().min(3),
    city: z.string().min(2).default("Minneapolis"),
    zip: z.string().regex(/^\d{5}$/, { message: "Enter 5‑digit ZIP" }),
    dogs: z.number().min(1).max(8),
    yardSize: z.enum(["small", "medium", "large", "xlarge"]).default("medium"),
    frequency: z.enum(["weekly", "twice-weekly", "bi-weekly", "one-time"]),
    deodorize: z.boolean().default(false),
    litter: z.boolean().default(false),
    dataOptIn: z.boolean().default(false),
    message: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const cityKey = Object.keys(SERVICE_ZIPS).find(
      (k) => k.toLowerCase() === data.city.trim().toLowerCase(),
    );
    const allowedZips = cityKey ? SERVICE_ZIPS[cityKey] : [];
    const isZipAllowed = allowedZips.includes(data.zip);
    if (!cityKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "We currently serve South Minneapolis, Richfield, Bloomington, or Edina",
        path: ["city"],
      });
    } else if (!isZipAllowed) {
      const hint =
        cityKey === "Minneapolis" || cityKey === "South Minneapolis"
          ? "(South Minneapolis ZIPs: 55406, 55407, 55408, 55409, 55417, 55419)"
          : `(${cityKey} ZIPs: ${SERVICE_ZIPS[cityKey].join(", ")})`;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `ZIP not in our service area ${hint}`,
        path: ["zip"],
      });
    }
  });

type FormData = z.input<typeof schema>;

export default function QuoteForm() {
  const [estimate, setEstimate] = useState<number | null>(null);
  // Function to scroll to community research section
  const scrollToCommunity = () => {
    const communitySection = document.getElementById("community");
    if (communitySection) {
      communitySection.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      city: "Minneapolis",
      dogs: 1,
      yardSize: "medium",
      frequency: "weekly",
      deodorize: false,
      litter: false,
      dataOptIn: true,
    },
  });

  const dogs = watch("dogs");
  const yardSize = watch("yardSize");
  const frequency = watch("frequency");
  const deodorize = watch("deodorize") ?? false;
  const litter = watch("litter") ?? false;

  useEffect(() => {
    if (frequency === "one-time")
      setEstimate(
        calcOneTimeEstimate(dogs, yardSize as YardSize, { deodorize }),
      );
    else
      setEstimate(
        calcPerVisitEstimate(
          dogs,
          frequency as Frequency,
          yardSize as YardSize,
          {
            deodorize,
            litter,
          },
        ),
      );
  }, [dogs, yardSize, frequency, deodorize, litter]);

  const onSubmit = async (data: FormData) => {
    // Store quote data in localStorage to pass to signup
    localStorage.setItem("quoteFormData", JSON.stringify(data));
    localStorage.setItem("quoteEstimate", estimate?.toString() || "0");

    // Redirect to signup with quote data
    window.location.href = "/signup?from=quote";
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6">
      {/* Contact Information Section */}
      <div className="bg-white rounded-xl border border-brand-200 p-6 shadow-soft">
        <h3 className="text-lg font-semibold text-ink mb-4 flex items-center gap-2">
          <span className="size-2 bg-brand-600 rounded-full"></span>
          Contact Information
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="relative">
            <input
              placeholder="Full name"
              {...register("name")}
              className={`w-full border rounded-xl p-3 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors ${
                errors.name ? "border-red-500 bg-red-50" : "border-brand-300"
              }`}
            />
            {errors.name && (
              <div className="absolute -bottom-6 left-0 text-red-500 text-sm flex items-center gap-1">
                <AlertCircle className="size-3" />
                Required field
              </div>
            )}
          </div>
          <div className="relative">
            <input
              placeholder="Email address"
              type="email"
              {...register("email")}
              className={`w-full border rounded-xl p-3 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors ${
                errors.email ? "border-red-500 bg-red-50" : "border-brand-300"
              }`}
            />
            {errors.email && (
              <div className="mt-1 text-red-500 text-sm flex items-center gap-1">
                <AlertCircle className="size-3" />
                Valid email required
              </div>
            )}
          </div>
          <div className="relative">
            <input
              placeholder="Phone number"
              {...register("phone")}
              className={`w-full border rounded-xl p-3 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors ${
                errors.phone ? "border-red-500 bg-red-50" : "border-brand-300"
              }`}
            />
            {errors.phone && (
              <div className="mt-1 text-red-500 text-sm flex items-center gap-1">
                <AlertCircle className="size-3" />
                Phone number required
              </div>
            )}
          </div>
          <div className="relative">
            <input
              placeholder="City (South Minneapolis, Richfield, Bloomington, or Edina)"
              {...register("city")}
              className={`w-full border rounded-xl p-3 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors ${
                errors.city ? "border-red-500 bg-red-50" : "border-brand-300"
              }`}
            />
            {errors.city && (
              <div className="mt-1 text-red-500 text-sm flex items-center gap-1">
                <AlertCircle className="size-3" />
                {errors.city.message?.toString()}
              </div>
            )}
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div className="relative">
            <input
              placeholder="Street address"
              {...register("address")}
              className={`w-full border rounded-xl p-3 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors ${
                errors.address ? "border-red-500 bg-red-50" : "border-brand-300"
              }`}
            />
            {errors.address && (
              <div className="mt-1 text-red-500 text-sm flex items-center gap-1">
                <AlertCircle className="size-3" />
                Address required
              </div>
            )}
          </div>
          <div className="relative">
            <input
              placeholder="ZIP code"
              {...register("zip")}
              className={`w-full border rounded-xl p-3 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors ${
                errors.zip ? "border-red-500 bg-red-50" : "border-brand-300"
              }`}
            />
            {errors.zip && (
              <div className="mt-1 text-red-500 text-sm flex items-center gap-1">
                <AlertCircle className="size-3" />
                {errors.zip.message?.toString() || "Valid ZIP required"}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1"># of dogs</label>
          <input
            type="number"
            min={1}
            max={8}
            {...register("dogs", { valueAsNumber: true })}
            className="border rounded-xl p-3 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Yard size</label>
          <select
            {...register("yardSize")}
            className="border rounded-xl p-3 w-full"
          >
            <option value="small">Small (&lt; 1/4 acre)</option>
            <option value="medium">Medium (1/4 - 1/2 acre)</option>
            <option value="large">Large (1/2 - 1 acre)</option>
            <option value="xlarge">Extra Large (&gt; 1 acre)</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Frequency</label>
          <select
            {...register("frequency")}
            className="border rounded-xl p-3 w-full"
          >
            <option value="weekly">Weekly (most popular)</option>
            <option value="twice-weekly">Twice weekly</option>
            <option value="bi-weekly">Every other week</option>
            <option value="one-time">One-time / seasonal</option>
          </select>
        </div>
        <div className="md:col-span-5 flex flex-wrap items-center gap-3 mt-1">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" {...register("deodorize")} />
            <span className="text-sm">Deodorize add-on</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" {...register("litter")} />
            <span className="text-sm">Litter box (+$5/wk)</span>
          </label>
        </div>
      </div>

      <textarea
        rows={4}
        placeholder="Anything we should know? Gate code, dog names, etc."
        {...register("message")}
        className="border rounded-xl p-3"
      />

      <label className="inline-flex items-start gap-2 text-sm">
        <input type="checkbox" {...register("dataOptIn")} />
        <div className="flex-1">
          <span>
            I consent to Yardura collecting anonymized stool images during
            service to improve non‑diagnostic GI trend insights. I understand
            this is not medical advice and I may request deletion at any time.
          </span>
          <button
            type="button"
            onClick={scrollToCommunity}
            className="inline-flex items-center justify-center w-4 h-4 ml-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
            title="Learn more about our community research"
          >
            <Info className="w-3 h-3 text-slate-500" />
          </button>
        </div>
      </label>

      <div className="flex items-center justify-between bg-brand-50 border rounded-xl p-4">
        <div>
          <div className="text-sm text-slate-600">
            Estimated {frequency === "one-time" ? "one-time" : "per visit"}{" "}
            price
          </div>
          <div className="text-3xl font-extrabold text-ink">
            ${""}
            {estimate ?? 0}
          </div>
          <div className="text-xs text-slate-500">
            Final price confirmed after first visit / initial clean as needed.
          </div>
        </div>
        <div className="hidden md:block text-right">
          <div className="text-xs text-slate-500 mb-2">What affects price?</div>
          <ul className="text-xs text-slate-600 mb-3 space-y-1">
            <li>• Yard size and number of dogs</li>
            <li>• Frequency (weekly vs. bi‑weekly)</li>
            <li>• Add‑ons (deodorize, litter box)</li>
          </ul>
          <button
            disabled={isSubmitting}
            className="px-5 py-3 rounded-xl bg-ink text-white shadow-soft hover:bg-brand-700"
          >
            {isSubmitting ? "Processing..." : "Continue to Payment"}
          </button>
        </div>
        <button
          disabled={isSubmitting}
          className="md:hidden px-5 py-3 rounded-xl bg-ink text-white shadow-soft hover:bg-brand-700"
        >
          {isSubmitting ? "Processing..." : "Continue to Payment"}
        </button>
      </div>
    </form>
  );
}
