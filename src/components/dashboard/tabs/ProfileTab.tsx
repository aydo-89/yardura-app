"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Mail,
  Phone,
  MapPin,
  PawPrint,
  Calendar,
  ShieldCheck,
  NotebookPen,
  User,
  Home,
  DollarSign,
  Plus,
  Trash2,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import type { User as UserType, Dog, ServiceSummary } from "../types";
import { splitInstructions } from "@/lib/instructions";

const BREEDS = [
  // Sporting Group
  "Golden Retriever",
  "Labrador Retriever",
  "Cocker Spaniel",
  "English Springer Spaniel",
  "German Shorthaired Pointer",
  "Brittany",
  "Vizsla",
  "Weimaraner",
  "Irish Setter",
  "English Setter",
  "Chesapeake Bay Retriever",
  "Nova Scotia Duck Tolling Retriever",
  
  // Herding Group
  "German Shepherd",
  "Australian Shepherd",
  "Border Collie",
  "Australian Cattle Dog",
  "Shetland Sheepdog",
  "Pembroke Welsh Corgi",
  "Cardigan Welsh Corgi",
  "Belgian Malinois",
  "Collie",
  "Old English Sheepdog",
  "Bernese Mountain Dog",
  
  // Working Group
  "Siberian Husky",
  "Alaskan Malamute",
  "Rottweiler",
  "Boxer",
  "Great Dane",
  "Doberman Pinscher",
  "Mastiff",
  "Bullmastiff",
  "Saint Bernard",
  "Newfoundland",
  "Samoyed",
  "Akita",
  "Great Pyrenees",
  "Cane Corso",
  "Portuguese Water Dog",
  
  // Terrier Group
  "Yorkshire Terrier",
  "Jack Russell Terrier",
  "West Highland White Terrier",
  "Scottish Terrier",
  "Airedale Terrier",
  "Bull Terrier",
  "Staffordshire Bull Terrier",
  "American Staffordshire Terrier",
  "Boston Terrier",
  "Cairn Terrier",
  "Miniature Schnauzer",
  "Wire Fox Terrier",
  "Soft Coated Wheaten Terrier",
  
  // Toy Group
  "Chihuahua",
  "Pomeranian",
  "Maltese",
  "Shih Tzu",
  "Cavalier King Charles Spaniel",
  "Pug",
  "Papillon",
  "Toy Poodle",
  "Havanese",
  "Italian Greyhound",
  "Chinese Crested",
  "Brussels Griffon",
  "Pekingese",
  
  // Non-Sporting Group
  "French Bulldog",
  "Bulldog",
  "Poodle",
  "Miniature Poodle",
  "Standard Poodle",
  "Bichon Frise",
  "Dalmatian",
  "Lhasa Apso",
  "Shiba Inu",
  "Chow Chow",
  "Keeshond",
  "Tibetan Terrier",
  
  // Hound Group
  "Beagle",
  "Dachshund",
  "Basset Hound",
  "Bloodhound",
  "Greyhound",
  "Whippet",
  "Rhodesian Ridgeback",
  "Afghan Hound",
  "Borzoi",
  "Irish Wolfhound",
  "Scottish Deerhound",
  "Basenji",
  "Coonhound",
  "Bluetick Coonhound",
  
  // Popular Mixes & Designer Breeds
  "Goldendoodle",
  "Labradoodle",
  "Cockapoo",
  "Maltipoo",
  "Bernedoodle",
  "Aussiedoodle",
  "Cavapoo",
  "Sheepadoodle",
  "Puggle",
  "Morkie",
  "Pomsky",
  "Shorkie",
  
  // General Categories
  "Mixed Breed",
  "Other",
];

interface ProfileTabProps {
  user: UserType;
  dogs: Dog[];
  serviceSummary: ServiceSummary | null;
  profileFields?: Array<[string, boolean]>;
}

function titleCase(value?: string | null) {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split(/[_-]|\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(iso?: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProfileTab({
  user,
  dogs,
  serviceSummary,
  profileFields = [],
}: ProfileTabProps) {
  const [showAddDogModal, setShowAddDogModal] = useState(false);
  const [dogName, setDogName] = useState("");
  const [dogBreed, setDogBreed] = useState("");
  const [customBreed, setCustomBreed] = useState("");
  const [dogAge, setDogAge] = useState("");
  const [dogWeight, setDogWeight] = useState("");
  const [savingDog, setSavingDog] = useState(false);
  const [dogError, setDogError] = useState<string | null>(null);
  const [deletingDogId, setDeletingDogId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState(user.name ?? "");
  const [profilePhone, setProfilePhone] = useState(user.phone ?? "");
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(
    user.image ?? null,
  );
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState(
    user.specialInstructions ?? serviceSummary?.specialInstructions ?? "",
  );
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [editingDog, setEditingDog] = useState<Dog | null>(null);
  const [editDogName, setEditDogName] = useState("");
  const [editDogBreed, setEditDogBreed] = useState("");
  const [editCustomBreed, setEditCustomBreed] = useState("");
  const [editDogAge, setEditDogAge] = useState("");
  const [editDogWeight, setEditDogWeight] = useState("");
  const [editDogPhotoFile, setEditDogPhotoFile] = useState<File | null>(null);
  const [editDogPhotoPreview, setEditDogPhotoPreview] = useState<string | null>(
    null,
  );
  const [editDogSaving, setEditDogSaving] = useState(false);
  const [editDogError, setEditDogError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setProfileName(user.name ?? "");
    setProfilePhone(user.phone ?? "");
    setProfileImagePreview(user.image ?? null);
  }, [user.name, user.phone, user.image]);

  useEffect(() => {
    setNotesDraft(
      user.specialInstructions ?? serviceSummary?.specialInstructions ?? "",
    );
  }, [user.specialInstructions, serviceSummary?.specialInstructions]);

  const addressLine = [user.address, user.city, user.zipCode]
    .filter(Boolean)
    .join(", ");

  const dogsCount = dogs.length || user.dogsCount || serviceSummary?.dogsCount || 0;
  const missingFields = profileFields
    .filter(([, ok]) => !ok)
    .map(([label]) => label);
  const missingChecklist = missingFields.map((field) => {
    if (field === "At least 1 dog profile") {
      return { label: "Add a pup profile", type: "dog" as const };
    }
    const normalized = field.toLowerCase();
    if (normalized.includes("name")) return { label: field, type: "identity" as const };
    if (normalized.includes("phone")) return { label: field, type: "phone" as const };
    if (normalized.includes("zip") || normalized.includes("address") || normalized.includes("city")) {
      return { label: field, type: "address" as const };
    }
    return { label: field, type: "profile" as const };
  });
  const needsDogProfile = missingFields.includes("At least 1 dog profile");
  const showChecklist = missingChecklist.length > 0;

  async function handleAddDog() {
    if (!dogName.trim()) {
      setDogError("Please enter your dog's name");
      return;
    }
    
    // Determine the breed to save
    let breedToSave = dogBreed || null;
    if (dogBreed === "Other" && customBreed.trim()) {
      breedToSave = customBreed.trim();
    } else if (dogBreed === "Other" && !customBreed.trim()) {
      setDogError("Please enter your dog's breed");
      return;
    }
    
    setSavingDog(true);
    setDogError(null);
    try {
      const res = await fetch("/api/dogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: dogName.trim(),
          breed: breedToSave,
          age: dogAge ? parseInt(dogAge) : null,
          weight: dogWeight || null,
        }),
      });
      if (res.ok) {
        setDogName("");
        setDogBreed("");
        setCustomBreed("");
        setDogAge("");
        setDogWeight("");
        setShowAddDogModal(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setDogError(data?.error || "Failed to add dog. Please try again.");
      }
    } catch (err) {
      setDogError("Something went wrong. Please try again.");
    } finally {
      setSavingDog(false);
    }
  }
  
  async function handleDeleteDog(dogId: string) {
    setDeletingDogId(dogId);
    try {
      const res = await fetch(`/api/dogs?id=${dogId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setShowDeleteConfirm(null);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || "Failed to remove dog. Please try again.");
      }
    } catch (err) {
      alert("Something went wrong. Please try again.");
    } finally {
      setDeletingDogId(null);
    }
  }

  async function handleProfileSave() {
    setProfileSaving(true);
    setProfileError(null);
    try {
      if (profileImageFile) {
        const formData = new FormData();
        formData.append("file", profileImageFile);
        const res = await fetch("/api/users/avatar", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Failed to upload profile photo.");
        }
      }

      const payload: Record<string, unknown> = {};
      const nameValue = profileName.trim();
      const phoneValue = profilePhone.trim();
      if (nameValue) payload.name = nameValue;
      if (phoneValue) payload.phone = phoneValue;

      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to update profile.");
      }

      setShowProfileModal(false);
      setProfileImageFile(null);
      router.refresh();
    } catch (error: any) {
      setProfileError(error?.message ?? "Unable to update profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleNotesSave() {
    setNotesSaving(true);
    setNotesError(null);
    try {
      const res = await fetch("/api/customer/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesDraft }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to update notes.");
      }
      setNotesModalOpen(false);
      router.refresh();
    } catch (error: any) {
      setNotesError(error?.message ?? "Unable to update notes.");
    } finally {
      setNotesSaving(false);
    }
  }

  const openEditDog = (dog: Dog) => {
    setEditingDog(dog);
    setEditDogName(dog.name ?? "");
    const breedValue = dog.breed ?? "";
    if (breedValue && BREEDS.includes(breedValue)) {
      setEditDogBreed(breedValue);
      setEditCustomBreed("");
    } else if (breedValue) {
      setEditDogBreed("Other");
      setEditCustomBreed(breedValue);
    } else {
      setEditDogBreed("");
      setEditCustomBreed("");
    }
    setEditDogAge(dog.age != null ? String(dog.age) : "");
    setEditDogWeight(dog.weight != null ? String(dog.weight) : "");
    setEditDogPhotoFile(null);
    setEditDogPhotoPreview(dog.photoUrl ?? null);
    setEditDogError(null);
  };

  async function handleEditDogSave() {
    if (!editingDog) return;
    if (!editDogName.trim()) {
      setEditDogError("Please enter your dog's name.");
      return;
    }

    let breedToSave = editDogBreed || null;
    if (editDogBreed === "Other" && editCustomBreed.trim()) {
      breedToSave = editCustomBreed.trim();
    } else if (editDogBreed === "Other" && !editCustomBreed.trim()) {
      setEditDogError("Please enter your dog's breed.");
      return;
    }

    setEditDogSaving(true);
    setEditDogError(null);
    try {
      const res = await fetch("/api/dogs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingDog.id,
          name: editDogName.trim(),
          breed: breedToSave,
          age: editDogAge ? parseInt(editDogAge, 10) : null,
          weight: editDogWeight || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to update dog profile.");
      }

      if (editDogPhotoFile) {
        const formData = new FormData();
        formData.append("dogId", editingDog.id);
        formData.append("file", editDogPhotoFile);
        const uploadRes = await fetch("/api/dogs/avatar", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          const data = await uploadRes.json().catch(() => ({}));
          throw new Error(data?.error || "Failed to upload dog photo.");
        }
      }

      setEditingDog(null);
      router.refresh();
    } catch (error: any) {
      setEditDogError(error?.message ?? "Unable to update dog.");
    } finally {
      setEditDogSaving(false);
    }
  }
  const frequencyLabel = titleCase(serviceSummary?.frequency ?? user.serviceFrequency);
  const yardLabel = titleCase(serviceSummary?.yardSize ?? user.yardSize);
  const billingPreference = (() => {
    const preference = serviceSummary?.billingPreference;
    if (preference === "monthly") {
      return "Monthly membership";
    }
    if (preference === "one-time") {
      return "One-time service";
    }
    return "Pay per visit";
  })();
  const nextBillingLabel = formatDate(serviceSummary?.nextBillingDate);
  const trialEndLabel = formatDate(serviceSummary?.trialEndsAt);
  const profileInstructions = splitInstructions(
    user.specialInstructions ?? serviceSummary?.specialInstructions,
  );

  const firstName = user.name?.split(" ")[0] || "there";

  return (
    <div id="profile" className="space-y-8">
      {/* ====== HERO: Profile Header ====== */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-graphite via-graphite-soft to-graphite dark:from-graphite-soft dark:via-graphite dark:to-graphite-soft p-1">
        <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-graphite via-graphite-soft to-graphite dark:from-[#25292f] dark:via-[#1e2227] dark:to-[#25292f] p-8 md:p-10">
          {/* Decorative */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-coral/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-mint-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              {/* Avatar */}
              <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-white/20 to-white/10 text-white text-3xl font-heading font-bold shadow-lg border border-white/20">
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name ? `${user.name} profile` : "Profile"}
                    className="size-full object-cover"
                  />
                ) : (
                  <span>{firstName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-heading font-bold text-white">
                  {user.name || "Your Profile"}
                </h1>
                <p className="text-white/60 mt-1">{user.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1.5 bg-mint/20 text-mint text-xs font-semibold px-3 py-1 rounded-full">
                    <PawPrint className="size-3" />
                    {dogsCount} {dogsCount === 1 ? "pup" : "pups"}
                  </span>
                  <span className="text-xs text-white/40">·</span>
                  <span className="text-xs text-white/60">{frequencyLabel || "Weekly"} service</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                variant="outline"
                className="border-white/20 bg-white/10 hover:bg-white/20 rounded-xl h-11 text-white"
              >
                <a href="mailto:support@yardura.com">
                  <Mail className="size-4 mr-2" />
                  Email Support
                </a>
              </Button>
              <Button
                asChild
                className="bg-white hover:bg-white/90 text-graphite rounded-xl h-11"
              >
                <a href="tel:+18774179273">
                  <Phone className="size-4 mr-2" />
                  Call Support
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {showChecklist && (
        <section className="rounded-2xl border border-coral/15 dark:border-coral/30 bg-white/80 dark:bg-white/5 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-graphite/50 dark:text-white/50 font-semibold">
                Profile checklist
            </p>
              <h2 className="text-lg font-heading font-bold text-graphite dark:text-white">
                Finish these details so we can personalize every visit
            </h2>
              <p className="text-sm text-graphite/60 dark:text-white/60">
                The items below are still missing from your profile.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
              {needsDogProfile && (
                <Button
                  onClick={() => {
                    setDogError(null);
                    setShowAddDogModal(true);
                  }}
                  className="bg-coral hover:bg-coral-ink text-white rounded-xl h-10"
                >
                  <Plus className="size-4 mr-2" />
                  Add a Pup
                </Button>
              )}
              <Button
                asChild
                variant="outline"
                className="border-graphite/10 dark:border-white/20 hover:bg-graphite/5 dark:hover:bg-white/10 rounded-xl h-10 dark:text-white"
              >
                <a href="mailto:support@yardura.com" className="flex items-center gap-2">
                  <Mail className="size-4" />
                  Contact Support
                </a>
            </Button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {missingChecklist.map((item) => {
              const isDog = item.type === "dog";
              const isIdentity = item.type === "identity";
              const icon = isDog
                ? PawPrint
                : item.type === "phone"
                  ? Phone
                  : item.type === "address"
                    ? MapPin
                    : User;
              const Icon = icon;
              return (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-2 rounded-full border border-graphite/10 dark:border-white/15 bg-slate-50 dark:bg-white/5 px-3 py-1 text-xs font-semibold text-graphite/80 dark:text-white/80"
                >
                  <Icon className="size-3 text-coral" />
                  {item.label}
                  <span className="text-[10px] text-graphite/50 dark:text-white/50">
                    {isDog ? "add in app" : isIdentity ? "login provider" : "update in account"}
                  </span>
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* ====== Contact & Address ====== */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Contact Info */}
        <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-heading font-bold text-graphite dark:text-white">Contact Information</h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-coral hover:text-coral-ink hover:bg-coral/10"
            onClick={() => {
              setProfileError(null);
              setShowProfileModal(true);
            }}
          >
              Edit Profile
          </Button>
        </div>
          <div className="rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-mint/10 text-mint">
                <Mail className="size-5" />
                </div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-widest text-graphite/45 dark:text-white/50 font-semibold">Email</p>
                <p className="font-medium text-graphite dark:text-white">{user.email}</p>
              </div>
                </div>
            <div className="h-px bg-graphite/5 dark:bg-white/10" />
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-coral/10 text-coral">
                <Phone className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-widest text-graphite/45 dark:text-white/50 font-semibold">Phone</p>
                <p className="font-medium text-graphite dark:text-white">{user.phone || "Not provided"}</p>
              </div>
                </div>
              </div>
            </div>

        {/* Service Address */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-heading font-bold text-graphite dark:text-white">Service Address</h2>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-coral hover:text-coral-ink hover:bg-coral/10"
            >
              <Link href="/account">Edit in Account</Link>
            </Button>
          </div>
          <div className="rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 p-6">
            <div className="flex items-start gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-evergreen/10 dark:bg-mint/10 text-evergreen-500 dark:text-mint">
                <Home className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-widest text-graphite/45 dark:text-white/50 font-semibold mb-2">Where we service</p>
                <p className="font-medium text-graphite dark:text-white leading-relaxed">
                  {addressLine || "No address on file"}
                </p>
                {!addressLine && (
                  <p className="text-sm text-graphite/50 dark:text-white/50 mt-2">
                    Add your service address in Account settings.
                </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNotesError(null);
                    setNotesModalOpen(true);
                  }}
                  className="mt-4 border-graphite/10 dark:border-white/20 hover:bg-graphite/5 dark:hover:bg-white/10 rounded-full text-graphite/70 dark:text-white/70"
                >
                  Edit crew notes
                </Button>
              </div>
            </div>

            {profileInstructions.length > 0 && (
              <div className="mt-5 pt-5 border-t border-graphite/5 dark:border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="size-4 text-coral" />
                  <p className="text-xs uppercase tracking-widest text-graphite/45 dark:text-white/50 font-semibold">Access Notes</p>
                </div>
                <ul className="space-y-2">
                  {profileInstructions.map((line) => (
                    <li key={line} className="text-sm text-graphite/70 dark:text-white/70 flex items-start gap-2">
                      <span className="text-coral mt-0.5">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ====== Service Preferences ====== */}
      <section className="space-y-4">
        <h2 className="text-lg font-heading font-bold text-graphite dark:text-white">Service Preferences</h2>
        
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Frequency */}
          <div className="rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-coral/10 text-coral">
                <Calendar className="size-5" />
              </div>
              <p className="text-xs uppercase tracking-widest text-graphite/45 dark:text-white/50 font-semibold">Frequency</p>
            </div>
            <p className="text-lg font-bold text-graphite dark:text-white">{frequencyLabel || "Weekly"}</p>
          </div>

          {/* Yard Size */}
          <div className="rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-mint/10 text-mint">
                <Home className="size-5" />
              </div>
              <p className="text-xs uppercase tracking-widest text-graphite/45 dark:text-white/50 font-semibold">Yard Size</p>
            </div>
            <p className="text-lg font-bold text-graphite dark:text-white">{yardLabel || "Standard"}</p>
              </div>

          {/* Billing */}
          <div className="rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-evergreen/10 dark:bg-mint/10 text-evergreen-500 dark:text-mint">
                <DollarSign className="size-5" />
              </div>
              <p className="text-xs uppercase tracking-widest text-graphite/45 dark:text-white/50 font-semibold">Billing</p>
            </div>
            <p className="text-lg font-bold text-graphite dark:text-white">{billingPreference}</p>
            {nextBillingLabel && (
              <p className="text-xs text-graphite/50 dark:text-white/50 mt-1">Next: {nextBillingLabel}</p>
            )}
              </div>

          {/* Status */}
          <div className="rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-mint/10 text-mint">
                <ShieldCheck className="size-5" />
              </div>
              <p className="text-xs uppercase tracking-widest text-graphite/45 dark:text-white/50 font-semibold">Status</p>
            </div>
            <p className="text-lg font-bold text-graphite dark:text-white">
              {serviceSummary?.subscriptionStatus ? titleCase(serviceSummary.subscriptionStatus) : "Active"}
            </p>
            {trialEndLabel && (
              <p className="text-xs text-graphite/50 dark:text-white/50 mt-1">Trial ends: {trialEndLabel}</p>
            )}
          </div>
        </div>
      </section>

      {/* ====== Household Pups ====== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-heading font-bold text-graphite dark:text-white">Your Pups</h2>
          <Button
            onClick={() => {
              setDogError(null);
              setShowAddDogModal(true);
            }}
            variant="ghost"
            size="sm"
            className="text-coral hover:text-coral-ink hover:bg-coral/10"
          >
            <Plus className="size-4 mr-1" />
            Add Dog
          </Button>
      </div>

          {dogs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-graphite/10 dark:border-white/20 bg-slate-50 dark:bg-white/5 p-12 text-center">
            <div className="mx-auto size-16 rounded-2xl bg-white dark:bg-white/10 flex items-center justify-center mb-4 shadow-sm">
              <PawPrint className="size-7 text-graphite/30 dark:text-white/30" />
            </div>
            <h3 className="font-semibold text-graphite dark:text-white mb-2">No pups on file yet</h3>
            <p className="text-sm text-graphite/50 dark:text-white/50 max-w-sm mx-auto mb-4">
              Add your dog's details so our crew knows who they're greeting at the gate.
            </p>
            <Button
              onClick={() => {
                setDogError(null);
                setShowAddDogModal(true);
              }}
              className="bg-coral hover:bg-coral-ink text-white rounded-xl"
            >
              <Plus className="size-4 mr-2" />
              Add Your First Pup
            </Button>
            </div>
          ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {dogs.map((dog) => (
                <div
                  key={dog.id}
                className="group relative rounded-2xl border border-graphite/5 dark:border-white/10 bg-white dark:bg-white/5 p-5 hover:shadow-md transition-all"
                >
                {/* Delete confirmation overlay */}
                {showDeleteConfirm === dog.id && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-4">
                    <AlertTriangle className="size-8 text-red-500 mb-2" />
                    <p className="text-sm font-semibold text-graphite dark:text-white mb-1">Remove {dog.name}?</p>
                    <p className="text-xs text-graphite/60 dark:text-white/60 mb-4 text-center">This can't be undone.</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowDeleteConfirm(null)}
                        disabled={deletingDogId === dog.id}
                        className="rounded-lg text-xs dark:border-slate-700 dark:text-white"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleDeleteDog(dog.id)}
                        disabled={deletingDogId === dog.id}
                        className="rounded-lg text-xs bg-red-500 hover:bg-red-600 text-white"
                      >
                        {deletingDogId === dog.id ? "Removing..." : "Remove"}
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="flex items-start justify-between mb-4">
                  {/* Dog Avatar */}
                  <div className="flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-coral to-coral-ink text-white text-xl font-heading font-bold shadow-md">
                    {dog.photoUrl ? (
                      <img
                        src={dog.photoUrl}
                        alt={`${dog.name} profile`}
                        className="size-full object-cover"
                      />
                    ) : (
                      <span>{dog.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-mint bg-mint/10 px-2.5 py-1 rounded-full">
                      {dog.breed || "Mixed Breed"}
                    </span>
                    <button
                      onClick={() => openEditDog(dog)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-graphite/40 hover:text-graphite hover:bg-slate-100 dark:text-white/40 dark:hover:text-white dark:hover:bg-slate-800 transition-all"
                      aria-label={`Edit ${dog.name}`}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(dog.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-graphite/40 hover:text-red-500 hover:bg-red-50 dark:text-white/40 dark:hover:text-red-400 dark:hover:bg-red-900/30 transition-all"
                      aria-label={`Remove ${dog.name}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                    </div>
                <h3 className="text-xl font-heading font-bold text-graphite dark:text-white mb-3">{dog.name}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                    <p className="text-graphite/40 dark:text-white/40 text-xs uppercase tracking-wider">Age</p>
                    <p className="text-graphite dark:text-white font-medium">
                      {dog.age != null ? `${dog.age} years` : "—"}
                    </p>
                    </div>
                    <div>
                    <p className="text-graphite/40 dark:text-white/40 text-xs uppercase tracking-wider">Weight</p>
                    <p className="text-graphite dark:text-white font-medium">
                      {dog.weight != null ? `${dog.weight} lbs` : "—"}
                    </p>
                    </div>
                </div>
                </div>
              ))}
            </div>
          )}
      </section>

      {/* ====== Support CTA ====== */}
      <section className="rounded-2xl border border-graphite/5 dark:border-white/10 bg-gradient-to-r from-slate-50 to-white dark:from-white/5 dark:to-white/[0.02] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-coral/10 text-coral">
              <NotebookPen className="size-5" />
            </div>
            <div>
              <h3 className="font-semibold text-graphite dark:text-white">Need help with changes?</h3>
              <p className="text-sm text-graphite/50 dark:text-white/50">
                Use Account settings for contact updates, or reach support for special requests.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              asChild
              variant="outline"
              className="border-graphite/10 dark:border-white/20 hover:bg-graphite/5 dark:hover:bg-white/10 rounded-xl h-11 dark:text-white"
            >
              <Link href="/account" className="flex items-center gap-2">
                <User className="size-4" />
                Account settings
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-graphite/10 dark:border-white/20 hover:bg-graphite/5 dark:hover:bg-white/10 rounded-xl h-11 dark:text-white"
            >
              <a href="mailto:support@yardura.com" className="flex items-center gap-2">
                <Mail className="size-4" />
                support@yardura.com
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* ====== Edit Profile Modal ====== */}
      <Dialog
        open={showProfileModal}
        onOpenChange={(value) => {
          if (!profileSaving) {
            setProfileError(null);
            setShowProfileModal(value);
          }
        }}
      >
        <DialogContent className="max-w-lg rounded-2xl bg-white text-graphite dark:bg-slate-900 dark:text-slate-50">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading font-bold text-graphite dark:text-white flex items-center gap-2">
              <User className="size-5 text-coral" />
              Edit Profile
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-4">
              <div className="flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800 text-graphite font-heading font-bold">
                {profileImagePreview ? (
                  <img
                    src={profileImagePreview}
                    alt="Profile preview"
                    className="size-full object-cover"
                  />
                ) : (
                  <span>{firstName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-graphite dark:text-white mb-2">
                  Profile photo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (file) {
                      setProfileImageFile(file);
                      setProfileImagePreview(URL.createObjectURL(file));
                    }
                  }}
                  className="text-sm text-graphite/70 dark:text-white/70"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-graphite dark:text-white mb-2">
                Full name
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-graphite/10 dark:border-white/20 bg-white dark:bg-slate-800 text-graphite dark:text-white placeholder:text-graphite/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-graphite dark:text-white mb-2">
                Phone
              </label>
              <input
                type="tel"
                value={profilePhone}
                onChange={(event) => setProfilePhone(event.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-graphite/10 dark:border-white/20 bg-white dark:bg-slate-800 text-graphite dark:text-white placeholder:text-graphite/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-all"
              />
            </div>
          </div>
          {profileError && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-lg px-4 py-2">
              {profileError}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowProfileModal(false)}
              disabled={profileSaving}
              className="rounded-xl dark:border-slate-700 dark:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleProfileSave}
              disabled={profileSaving}
              className="bg-coral hover:bg-coral-ink text-white rounded-xl"
            >
              {profileSaving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== Crew Notes Modal ====== */}
      <Dialog
        open={notesModalOpen}
        onOpenChange={(value) => {
          if (!notesSaving) {
            setNotesError(null);
            setNotesModalOpen(value);
          }
        }}
      >
        <DialogContent className="max-w-lg rounded-2xl bg-white text-graphite dark:bg-slate-900 dark:text-slate-50">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading font-bold text-graphite dark:text-white flex items-center gap-2">
              <NotebookPen className="size-5 text-coral" />
              Crew Notes
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-graphite/60 dark:text-white/60">
            Share any access tips or special instructions for your scooper.
          </p>
          <textarea
            value={notesDraft}
            onChange={(event) => setNotesDraft(event.target.value)}
            rows={5}
            className="mt-3 w-full rounded-xl border border-graphite/10 dark:border-white/20 bg-white dark:bg-slate-800 p-4 text-sm text-graphite dark:text-white placeholder:text-graphite/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-all"
            placeholder="Gate code, where to leave bags, preferred gate, etc."
          />
          {notesError && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-lg px-4 py-2">
              {notesError}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setNotesModalOpen(false)}
              disabled={notesSaving}
              className="rounded-xl dark:border-slate-700 dark:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleNotesSave}
              disabled={notesSaving}
              className="bg-coral hover:bg-coral-ink text-white rounded-xl"
            >
              {notesSaving ? "Saving..." : "Save notes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== Edit Dog Modal ====== */}
      <Dialog
        open={Boolean(editingDog)}
        onOpenChange={(value) => {
          if (!editDogSaving) {
            setEditDogError(null);
            if (!value) setEditingDog(null);
          }
        }}
      >
        <DialogContent className="max-w-md rounded-2xl bg-white text-graphite dark:bg-slate-900 dark:text-slate-50">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading font-bold text-graphite dark:text-white flex items-center gap-2">
              <PawPrint className="size-5 text-coral" />
              Edit Pup Profile
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800 text-graphite font-heading font-bold">
                {editDogPhotoPreview ? (
                  <img
                    src={editDogPhotoPreview}
                    alt="Dog preview"
                    className="size-full object-cover"
                  />
                ) : (
                  <span>{editDogName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-graphite dark:text-white mb-2">
                  Pup photo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (file) {
                      setEditDogPhotoFile(file);
                      setEditDogPhotoPreview(URL.createObjectURL(file));
                    }
                  }}
                  className="text-sm text-graphite/70 dark:text-white/70"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-graphite dark:text-white mb-2">
                Dog&apos;s Name <span className="text-coral">*</span>
              </label>
              <input
                type="text"
                value={editDogName}
                onChange={(event) => setEditDogName(event.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-graphite/10 dark:border-white/20 bg-white dark:bg-slate-800 text-graphite dark:text-white placeholder:text-graphite/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-graphite dark:text-white mb-2">
                Breed
              </label>
              <select
                value={editDogBreed}
                onChange={(event) => setEditDogBreed(event.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-graphite/10 dark:border-white/20 bg-white dark:bg-slate-800 text-graphite dark:text-white focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-all"
              >
                <option value="">Select breed</option>
                {BREEDS.map((breed) => (
                  <option key={breed} value={breed}>
                    {breed}
                  </option>
                ))}
              </select>
              {editDogBreed === "Other" && (
                <input
                  type="text"
                  value={editCustomBreed}
                  onChange={(event) => setEditCustomBreed(event.target.value)}
                  placeholder="Enter breed"
                  className="mt-2 w-full px-4 py-3 rounded-xl border border-graphite/10 dark:border-white/20 bg-white dark:bg-slate-800 text-graphite dark:text-white placeholder:text-graphite/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-all"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-graphite dark:text-white mb-2">
                  Age
                </label>
                <input
                  type="number"
                  value={editDogAge}
                  onChange={(event) => setEditDogAge(event.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-graphite/10 dark:border-white/20 bg-white dark:bg-slate-800 text-graphite dark:text-white placeholder:text-graphite/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-graphite dark:text-white mb-2">
                  Weight (lbs)
                </label>
                <input
                  type="number"
                  value={editDogWeight}
                  onChange={(event) => setEditDogWeight(event.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-graphite/10 dark:border-white/20 bg-white dark:bg-slate-800 text-graphite dark:text-white placeholder:text-graphite/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-all"
                />
              </div>
            </div>
          </div>
          {editDogError && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-lg px-4 py-2">
              {editDogError}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setEditingDog(null)}
              disabled={editDogSaving}
              className="rounded-xl dark:border-slate-700 dark:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditDogSave}
              disabled={editDogSaving}
              className="bg-coral hover:bg-coral-ink text-white rounded-xl"
            >
              {editDogSaving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== Add Dog Modal ====== */}
      <Dialog
        open={showAddDogModal}
        onOpenChange={(value) => {
          if (!savingDog) {
            setDogError(null);
            setShowAddDogModal(value);
          }
        }}
      >
        <DialogContent className="max-w-md rounded-2xl bg-white text-graphite dark:bg-slate-900 dark:text-slate-50">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading font-bold text-graphite dark:text-white flex items-center gap-2">
              <PawPrint className="size-5 text-coral" />
              Add a New Pup
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Dog Name */}
            <div>
              <label className="block text-sm font-medium text-graphite dark:text-white mb-2">
                Dog's Name <span className="text-coral">*</span>
              </label>
              <input
                type="text"
                value={dogName}
                onChange={(e) => setDogName(e.target.value)}
                placeholder="e.g., Max, Bella, Cooper"
                className="w-full px-4 py-3 rounded-xl border border-graphite/10 dark:border-white/20 bg-white dark:bg-slate-800 text-graphite dark:text-white placeholder:text-graphite/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-all"
              />
            </div>

            {/* Breed */}
            <div>
              <label className="block text-sm font-medium text-graphite dark:text-white mb-2">
                Breed
              </label>
              <select
                value={dogBreed}
                onChange={(e) => {
                  setDogBreed(e.target.value);
                  if (e.target.value !== "Other") {
                    setCustomBreed("");
                  }
                }}
                className="w-full px-4 py-3 rounded-xl border border-graphite/10 dark:border-white/20 bg-white dark:bg-slate-800 text-graphite dark:text-white focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-all"
              >
                <option value="">Select breed (optional)</option>
                {BREEDS.map((breed) => (
                  <option key={breed} value={breed}>{breed}</option>
                ))}
              </select>
            </div>
            
            {/* Custom Breed Input (when "Other" is selected) */}
            {dogBreed === "Other" && (
              <div>
                <label className="block text-sm font-medium text-graphite dark:text-white mb-2">
                  Enter Breed <span className="text-coral">*</span>
                </label>
                <input
                  type="text"
                  value={customBreed}
                  onChange={(e) => setCustomBreed(e.target.value)}
                  placeholder="e.g., Pomchi, Schnoodle, etc."
                  className="w-full px-4 py-3 rounded-xl border border-graphite/10 dark:border-white/20 bg-white dark:bg-slate-800 text-graphite dark:text-white placeholder:text-graphite/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-all"
                />
              </div>
            )}

            {/* Age and Weight Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-graphite dark:text-white mb-2">
                  Age (years)
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={dogAge}
                  onChange={(e) => setDogAge(e.target.value)}
                  placeholder="e.g., 3"
                  className="w-full px-4 py-3 rounded-xl border border-graphite/10 dark:border-white/20 bg-white dark:bg-slate-800 text-graphite dark:text-white placeholder:text-graphite/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-graphite dark:text-white mb-2">
                  Weight (lbs)
                </label>
                <input
                  type="number"
                  min="0"
                  max="300"
                  value={dogWeight}
                  onChange={(e) => setDogWeight(e.target.value)}
                  placeholder="e.g., 50"
                  className="w-full px-4 py-3 rounded-xl border border-graphite/10 dark:border-white/20 bg-white dark:bg-slate-800 text-graphite dark:text-white placeholder:text-graphite/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-all"
                />
              </div>
            </div>

            {dogError && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-lg px-4 py-2">
                {dogError}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-graphite/5 dark:border-white/10">
            <Button
              variant="outline"
              onClick={() => setShowAddDogModal(false)}
              disabled={savingDog}
              className="rounded-xl dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddDog}
              disabled={savingDog}
              className="bg-coral hover:bg-coral-ink text-white rounded-xl"
            >
              {savingDog ? "Adding..." : "Add Pup"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
