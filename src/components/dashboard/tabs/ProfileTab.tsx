// Refactor: extracted from legacy DashboardClientNew; removed mock wellness code and duplicates.
import React, { useState } from "react";
import {
  User,
  Heart,
  Edit,
  Plus,
  Trash2,
  Save,
  CheckCircle,
  AlertCircle,
  Clock,
  MapPin,
  Settings,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { User as UserType, Dog } from "../types";

interface ProfileTabProps {
  user: UserType;
  dogs: Dog[];
}

export default function ProfileTab({ user, dogs }: ProfileTabProps) {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingDog, setIsEditingDog] = useState<string | null>(null);
  const [isAddingDog, setIsAddingDog] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingDog, setSavingDog] = useState(false);

  // Form states
  const [profileData, setProfileData] = useState({
    name: user.name || "",
    phone: user.phone || "",
    address: user.address || "",
    city: user.city || "",
    zipCode: user.zipCode || "",
    preferredDay: user.preferredDay || "",
    preferredTime: user.preferredTime || "",
    serviceAreas: user.serviceAreas || ["Front Yard", "Back Yard"],
    specialInstructions: user.specialInstructions || "",
  });

  const [dogFormData, setDogFormData] = useState({
    name: "",
    breed: "",
    age: "",
    weight: "",
  });

  // Success/error states
  const [profileMessage, setProfileMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [dogMessage, setDogMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleProfileUpdate = async () => {
    setSavingProfile(true);
    setProfileMessage(null);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update would happen here
      setProfileMessage({
        type: "success",
        text: "Profile updated successfully!",
      });
      setIsEditingProfile(false);

      // Clear message after 3 seconds
      setTimeout(() => setProfileMessage(null), 3000);
    } catch (error) {
      setProfileMessage({
        type: "error",
        text: "Failed to update profile. Please try again.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDogSubmit = async (isNew: boolean = false) => {
    setSavingDog(true);
    setDogMessage(null);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const message = isNew
        ? "Dog added successfully!"
        : "Dog updated successfully!";
      setDogMessage({ type: "success", text: message });

      // Reset form
      setDogFormData({ name: "", breed: "", age: "", weight: "" });
      setIsEditingDog(null);
      setIsAddingDog(false);

      // Clear message after 3 seconds
      setTimeout(() => setDogMessage(null), 3000);
    } catch (error) {
      setDogMessage({
        type: "error",
        text: "Failed to save dog information. Please try again.",
      });
    } finally {
      setSavingDog(false);
    }
  };

  const handleDeleteDog = async (dogId: string) => {
    if (!confirm("Are you sure you want to remove this dog from your profile?"))
      return;

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      setDogMessage({ type: "success", text: "Dog removed successfully!" });
      setTimeout(() => setDogMessage(null), 3000);
    } catch (error) {
      setDogMessage({
        type: "error",
        text: "Failed to remove dog. Please try again.",
      });
    }
  };

  const startEditDog = (dog: Dog) => {
    setDogFormData({
      name: dog.name,
      breed: dog.breed || "",
      age: dog.age?.toString() || "",
      weight: dog.weight?.toString() || "",
    });
    setIsEditingDog(dog.id);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-2xl mb-4">
          <User className="size-8 text-purple-600" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          Account Profile
        </h2>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Manage your personal information, contact details, and dog profiles
        </p>
      </div>

      {/* Success/Error Messages */}
      {profileMessage && (
        <div
          className={`p-4 rounded-lg border ${
            profileMessage.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {profileMessage.type === "success" ? (
              <CheckCircle className="size-4" />
            ) : (
              <AlertCircle className="size-4" />
            )}
            <span className="text-sm font-medium">{profileMessage.text}</span>
          </div>
        </div>
      )}

      {dogMessage && (
        <div
          className={`p-4 rounded-lg border ${
            dogMessage.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {dogMessage.type === "success" ? (
              <CheckCircle className="size-4" />
            ) : (
              <AlertCircle className="size-4" />
            )}
            <span className="text-sm font-medium">{dogMessage.text}</span>
          </div>
        </div>
      )}

      {/* Personal Information Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Personal Information
              </h3>
              <p className="text-slate-600 text-sm">
                Update your contact details and address
              </p>
            </div>
            <button
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <Edit className="size-4" />
              {isEditingProfile ? "Cancel" : "Edit Profile"}
            </button>
          </div>
        </div>

        <div className="p-6">
          {isEditingProfile ? (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) =>
                      setProfileData({ ...profileData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) =>
                      setProfileData({ ...profileData, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-900 mb-1">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={profileData.address}
                    onChange={(e) =>
                      setProfileData({
                        ...profileData,
                        address: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="123 Main Street"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={profileData.city}
                    onChange={(e) =>
                      setProfileData({ ...profileData, city: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    value={profileData.zipCode}
                    onChange={(e) =>
                      setProfileData({
                        ...profileData,
                        zipCode: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="12345"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setIsEditingProfile(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800"
                  disabled={savingProfile}
                >
                  Cancel
                </button>
                <button
                  onClick={handleProfileUpdate}
                  disabled={savingProfile}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {savingProfile ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-slate-600">Full Name</div>
                  <div className="font-medium text-slate-900">
                    {profileData.name || "Not set"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-600">Email Address</div>
                  <div className="font-medium text-slate-900">{user.email}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Email cannot be changed
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-600">Phone Number</div>
                  <div className="font-medium text-slate-900">
                    {profileData.phone || "Not set"}
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-slate-600">Street Address</div>
                  <div className="font-medium text-slate-900">
                    {profileData.address || "Not set"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-600">City</div>
                  <div className="font-medium text-slate-900">
                    {profileData.city || "Not set"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-600">ZIP Code</div>
                  <div className="font-medium text-slate-900">
                    {profileData.zipCode || "Not set"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dog Profiles Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Dog Profiles
              </h3>
              <p className="text-slate-600 text-sm">
                Manage information for your furry family members
              </p>
            </div>
            <button
              onClick={() => {
                setDogFormData({ name: "", breed: "", age: "", weight: "" });
                setIsAddingDog(true);
              }}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <Plus className="size-4" />
              Add Dog
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Add/Edit Dog Form */}
          {(isAddingDog || isEditingDog) && (
            <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h4 className="text-sm font-semibold text-purple-900 mb-4">
                {isAddingDog ? "Add New Dog" : "Edit Dog Information"}
              </h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-purple-900 mb-1">
                    Dog's Name
                  </label>
                  <input
                    type="text"
                    value={dogFormData.name}
                    onChange={(e) =>
                      setDogFormData({ ...dogFormData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter dog's name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-purple-900 mb-1">
                    Breed
                  </label>
                  <input
                    type="text"
                    value={dogFormData.breed}
                    onChange={(e) =>
                      setDogFormData({ ...dogFormData, breed: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Golden Retriever"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-purple-900 mb-1">
                    Age (years)
                  </label>
                  <input
                    type="number"
                    value={dogFormData.age}
                    onChange={(e) =>
                      setDogFormData({ ...dogFormData, age: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="2"
                    min="0"
                    max="25"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-purple-900 mb-1">
                    Weight (lbs)
                  </label>
                  <input
                    type="text"
                    value={dogFormData.weight}
                    onChange={(e) =>
                      setDogFormData({ ...dogFormData, weight: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="45"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setIsAddingDog(false);
                    setIsEditingDog(null);
                    setDogFormData({
                      name: "",
                      breed: "",
                      age: "",
                      weight: "",
                    });
                  }}
                  className="px-4 py-2 text-purple-600 hover:text-purple-800"
                  disabled={savingDog}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDogSubmit(isAddingDog)}
                  disabled={savingDog || !dogFormData.name.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {savingDog ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      {isAddingDog ? "Add Dog" : "Update Dog"}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Dog List */}
          <div className="grid md:grid-cols-2 gap-4">
            {dogs.map((dog) => (
              <div
                key={dog.id}
                className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Heart className="size-5 text-amber-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">
                        {dog.name}
                      </div>
                      <div className="text-sm text-slate-600">
                        {dog.breed || "Breed not specified"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEditDog(dog)}
                      className="p-1 text-slate-600 hover:text-slate-800"
                      disabled={isAddingDog || isEditingDog !== null}
                    >
                      <Edit className="size-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteDog(dog.id)}
                      className="p-1 text-red-600 hover:text-red-800"
                      disabled={isAddingDog || isEditingDog !== null}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-slate-600">Age</div>
                    <div className="font-medium text-slate-900">
                      {dog.age
                        ? `${dog.age} year${dog.age !== 1 ? "s" : ""}`
                        : "Not set"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-600">Weight</div>
                    <div className="font-medium text-slate-900">
                      {dog.weight ? `${dog.weight} lbs` : "Not set"}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {dogs.length === 0 && !isAddingDog && (
              <div className="col-span-2 text-center py-8 text-slate-500">
                <Heart className="size-8 mx-auto mb-2 opacity-50" />
                <p>No dog profiles yet</p>
                <p className="text-sm">Add your first dog to get started!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Account Summary */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">
            Account Summary
          </h3>
        </div>

        <div className="p-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900 mb-1">
                {dogs.length}
              </div>
              <div className="text-sm text-slate-600">Registered Dogs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900 mb-1">
                {new Date().toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })}
              </div>
              <div className="text-sm text-slate-600">Member Since</div>
            </div>
            <div className="text-center">
              <div
                className={`text-2xl font-bold mb-1 ${
                  user.stripeCustomerId ? "text-green-600" : "text-yellow-600"
                }`}
              >
                {user.stripeCustomerId ? "Active" : "Inactive"}
              </div>
              <div className="text-sm text-slate-600">Account Status</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
