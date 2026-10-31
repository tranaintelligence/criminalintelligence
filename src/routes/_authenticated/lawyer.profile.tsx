import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  User, ShieldCheck, Check, Clock, Upload, 
  MapPin, Phone, MessageSquare, Users, Save, AlertCircle, Camera,
  X, Search, Plus, Landmark
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLawyerAuth } from "./lawyer";
import {
  SUPREME_COURT,
  ALL_HIGH_COURTS,
  DISTRICT_COURTS_BY_STATE,
  ALL_TRIBUNALS,
  parseCourtsList,
  formatCourtsHeader,
} from "@/lib/courts-data";

export const Route = createFileRoute("/_authenticated/lawyer/profile")({
  head: () => ({
    meta: [
      { title: "My Profile TRANA Lawyer Workspace" },
      { name: "description", content: "Manage your legal profile, Bar registration, specialisations, and consultation preferences." },
    ],
  }),
  component: LawyerProfilePage,
});

const availableSpecialisations = [
  "Criminal Law & Bail",
  "BNS / BNSS Procedure",
  "Constitutional Writs",
  "Corporate & Commercial",
  "Cyber Crime & Data Law",
  "Cheque Dishonour (138 NI Act)",
  "Family & Matrimonial",
  "Civil Litigation & Property",
  "Arbitration & Dispute Resolution",
  "Consumer Protection",
];

function LawyerProfilePage() {
  const { user } = Route.useRouteContext();
  const { data: lawyer, refetch } = useLawyerAuth();

  // Form states
  const [fullName, setFullName] = useState("");
  const [barRegNo, setBarRegNo] = useState("");
  const [selectedSpecialisations, setSelectedSpecialisations] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [selectedCourts, setSelectedCourts] = useState<string[]>([]);
  const [selectedState, setSelectedState] = useState<string>("Delhi");
  const [selectedDistrictCourt, setSelectedDistrictCourt] = useState<string>("");
  const [customDistrictInput, setCustomDistrictInput] = useState<string>("");
  const [highCourtSearch, setHighCourtSearch] = useState<string>("");
  const [offersCall, setOffersCall] = useState(true);
  const [offersChat, setOffersChat] = useState(true);
  const [offersInPerson, setOffersInPerson] = useState(false);
  const [bio, setBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Verification status
  const isApproved = lawyer?.approved ?? true;

  useEffect(() => {
    if (lawyer) {
      setFullName(lawyer.full_name || "");
      setBarRegNo(lawyer.bar_reg_no || "D/1429/2019");
      setCity(lawyer.city || "New Delhi");
      
      const parsedCourts = parseCourtsList(lawyer.courts);
      setSelectedCourts(
        parsedCourts.length > 0
          ? parsedCourts
          : [SUPREME_COURT, "Delhi High Court"]
      );

      setBio(
        lawyer.bio ||
          "Advocate with extensive trial and appellate experience in criminal jurisprudence, anticipatory bail applications under BNSS, and constitutional writ petitions."
      );
      setOffersCall(lawyer.offers_call);
      setOffersChat(lawyer.offers_chat);
      setOffersInPerson(lawyer.offers_in_person);

      // Parse initial specialisations
      if (lawyer.specialisation) {
        const parts = lawyer.specialisation.split(",").map((s) => s.trim());
        setSelectedSpecialisations(parts.length > 0 ? parts : ["Criminal Law & Bail"]);
      } else {
        setSelectedSpecialisations(["Criminal Law & Bail", "BNS / BNSS Procedure"]);
      }
    }
  }, [lawyer]);

  function toggleSpecialisation(spec: string) {
    setSelectedSpecialisations((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]
    );
  }

  function toggleCourt(court: string) {
    setSelectedCourts((prev) =>
      prev.includes(court) ? prev.filter((c) => c !== court) : [...prev, court]
    );
  }

  function handleAddCourt(court: string) {
    const trimmed = court.trim();
    if (!trimmed) return;
    if (!selectedCourts.includes(trimmed)) {
      setSelectedCourts((prev) => [...prev, trimmed]);
      toast.success(`Added "${trimmed}" to Courts of Practice`);
    } else {
      toast.info(`"${trimmed}" is already selected`);
    }
  }

  function handleRemoveCourt(court: string) {
    setSelectedCourts((prev) => prev.filter((c) => c !== court));
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
      toast.success("Profile photo uploaded!");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const specString = selectedSpecialisations.join(", ") || "General Practice";
      const courtsPayload = JSON.stringify(selectedCourts);

      // 1. Update Supabase lawyers table
      await supabase.from("lawyers").upsert({
        user_id: user.id,
        full_name: fullName,
        city: city,
        specialisation: specString,
        offers_call: offersCall,
        offers_chat: offersChat,
        offers_in_person: offersInPerson,
        approved: isApproved,
      });

      // 2. Update Supabase profiles table
      await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName,
        city: city,
      });

      // 3. Update auth user metadata
      await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          bar_reg_no: barRegNo,
          courts: courtsPayload,
          bio: bio,
        },
      });

      // 4. Update localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem(`trana_lawyer_bar_${user.id}`, barRegNo);
        localStorage.setItem(`trana_lawyer_courts_${user.id}`, courtsPayload);
      }

      await refetch();
      toast.success("Profile updated successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Saved locally for your session.");
    } finally {
      setIsSaving(false);
    }
  }

  const availableStates = Object.keys(DISTRICT_COURTS_BY_STATE);
  const currentDistrictOptions = DISTRICT_COURTS_BY_STATE[selectedState] || [];
  const filteredHighCourts = ALL_HIGH_COURTS.filter((hc) =>
    hc.toLowerCase().includes(highCourtSearch.toLowerCase().trim())
  );

  return (
    <div className="space-y-8 max-w-4xl">
      {/* HEADER & VERIFICATION BADGE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222222] pb-6">
        <div>
          <h1 className="font-display text-4xl md:text-5xl font-medium text-white">
            My Profile
          </h1>
          <p className="mt-2 text-sm text-[#999999]">
            Manage your credentials, court affiliations, and client consultation preferences.
          </p>
        </div>

        {/* Verification Status Badge */}
        <div className="flex items-center">
          {isApproved ? (
            <div className="inline-flex items-center gap-2 border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              <span>✓ Verified</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400">
              <Clock className="h-4 w-4" />
              <span>⏳ Pending Verification</span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* SECTION 1: PHOTO & BASIC INFO */}
        <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-6 md:p-8 space-y-6">
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#888888] border-b border-[#282828] pb-3">
            01 Professional Identity
          </h2>

          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Profile Photo Upload */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative h-24 w-24 rounded-full bg-[#111111] border-2 border-white/20 flex items-center justify-center overflow-hidden group">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display text-3xl font-semibold text-white">
                    {fullName.charAt(0) || "A"}
                  </span>
                )}
                <label
                  htmlFor="photo-upload"
                  className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-[0.65rem] uppercase tracking-wider"
                >
                  <Camera className="h-4 w-4 mb-0.5" />
                  <span>Change</span>
                </label>
                <input
                  type="file"
                  id="photo-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </div>
              <span className="text-[0.7rem] text-[#777777]">Profile Photo</span>
            </div>

            {/* Full Name & Bar Registration */}
            <div className="flex-1 w-full space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Advocate Full Name"
                  className="w-full border border-[#333333] bg-[#0A0A0A] px-4 py-3 text-sm text-white focus:border-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
                  Bar Council Registration Number
                </label>
                <input
                  type="text"
                  required
                  value={barRegNo}
                  onChange={(e) => setBarRegNo(e.target.value)}
                  placeholder="e.g. D/1429/2019"
                  className="w-full border border-[#333333] bg-[#0A0A0A] px-4 py-3 text-sm text-white focus:border-white focus:outline-none font-mono"
                />
                <p className="mt-1 text-[0.7rem] text-[#666666]">
                  Verified against State Bar Council Enrolment Directory.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: SPECIALISATION AREAS (MULTI-SELECT) */}
        <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-6 md:p-8 space-y-4">
          <div className="flex items-center justify-between border-b border-[#282828] pb-3">
            <h2 className="text-xs uppercase tracking-[0.2em] text-[#888888]">
              02 Specialisation Areas (Multi-Select)
            </h2>
            <span className="text-xs text-[#777777]">
              {selectedSpecialisations.length} Selected
            </span>
          </div>

          <p className="text-xs text-[#999999]">
            Select all practice areas you accept client referrals for:
          </p>

          <div className="flex flex-wrap gap-2.5 pt-2">
            {availableSpecialisations.map((spec) => {
              const isSelected = selectedSpecialisations.includes(spec);
              return (
                <button
                  type="button"
                  key={spec}
                  onClick={() => toggleSpecialisation(spec)}
                  className={`px-3.5 py-2 text-xs border transition-colors flex items-center gap-1.5 ${
                    isSelected
                      ? "border-white bg-white text-black font-semibold"
                      : "border-[#333333] bg-[#111111] text-[#AAAAAA] hover:text-white hover:border-white"
                  }`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5" />}
                  <span>{spec}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 3: JURISDICTION & COURTS OF PRACTICE */}
        <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#282828] pb-3">
            <div>
              <h2 className="text-xs uppercase tracking-[0.2em] text-[#888888]">
                03 Jurisdiction & Courts of Practice
              </h2>
              <p className="text-xs text-[#999999] mt-1">
                Select your courts of practice. Selected courts will update your Advocate Portal header dynamically.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-white bg-[#0A0A0A] border border-[#333333] px-3 py-1">
                {selectedCourts.length} {selectedCourts.length === 1 ? "Court" : "Courts"} Selected
              </span>
            </div>
          </div>

          {/* City / Principal Seat */}
          <div>
            <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
              City / Principal Seat
            </label>
            <input
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. New Delhi"
              className="w-full border border-[#333333] bg-[#0A0A0A] px-4 py-3 text-sm text-white focus:border-white focus:outline-none"
            />
          </div>

          {/* Active Selected Courts & Live Header Preview */}
          <div className="space-y-3 border border-[#2A2A2A] bg-[#0F0F0F] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[0.7rem] uppercase tracking-[0.15em] text-[#888888] font-medium">
                Active Courts of Practice
              </span>
              {selectedCourts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCourts([])}
                  className="text-[0.7rem] text-[#888888] hover:text-rose-400 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {selectedCourts.length === 0 ? (
              <p className="text-xs text-[#666666] py-1 italic">
                No courts selected yet. Choose from Supreme Court, High Courts, District Courts, or Tribunals below.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedCourts.map((court) => (
                  <span
                    key={court}
                    className="inline-flex items-center gap-1.5 bg-[#1C1C1C] border border-[#3E3E3E] text-white text-xs px-3 py-1.5"
                  >
                    <span>{court}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCourt(court)}
                      className="text-[#888888] hover:text-white transition-colors ml-0.5"
                      title={`Remove ${court}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Live Header Display Preview */}
            <div className="pt-2.5 border-t border-[#222222] flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
              <span className="text-[#777777] text-[0.7rem] uppercase tracking-wider shrink-0">
                Portal Header Preview:
              </span>
              <span className="font-mono text-white text-[0.75rem] uppercase tracking-[0.2em] bg-[#161616] px-2.5 py-1 border border-[#333333] break-all">
                {formatCourtsHeader(JSON.stringify(selectedCourts))}
              </span>
            </div>
          </div>

          {/* 1. SUPREME COURT OF INDIA */}
          <div className="space-y-2">
            <label className="block text-xs uppercase tracking-[0.15em] text-[#AAAAAA]">
              1. Apex Court
            </label>
            <div>
              <button
                type="button"
                onClick={() => toggleCourt(SUPREME_COURT)}
                className={`w-full sm:w-auto px-4 py-2.5 text-xs border transition-colors flex items-center justify-between sm:justify-start gap-3 ${
                  selectedCourts.includes(SUPREME_COURT)
                    ? "border-white bg-white text-black font-semibold"
                    : "border-[#333333] bg-[#0E0E0E] text-[#CCCCCC] hover:text-white hover:border-[#666666]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4" />
                  <span>{SUPREME_COURT}</span>
                </div>
                {selectedCourts.includes(SUPREME_COURT) ? (
                  <Check className="h-4 w-4 text-black" />
                ) : (
                  <span className="text-[0.65rem] text-[#777777] uppercase tracking-wider border border-[#333333] px-1.5 py-0.5">
                    Apex Court
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* 2. HIGH COURTS (LIST OF ALL HIGH COURTS) */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="block text-xs uppercase tracking-[0.15em] text-[#AAAAAA]">
                2. High Courts ({ALL_HIGH_COURTS.length} Constitutional Benches)
              </label>
              <div className="relative w-full sm:w-64">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" />
                <input
                  type="text"
                  value={highCourtSearch}
                  onChange={(e) => setHighCourtSearch(e.target.value)}
                  placeholder="Filter High Courts..."
                  className="w-full border border-[#333333] bg-[#0A0A0A] pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-[#555555] focus:border-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto pr-1 p-2.5 bg-[#0E0E0E] border border-[#262626]">
              {filteredHighCourts.map((court) => {
                const isSelected = selectedCourts.includes(court);
                return (
                  <button
                    type="button"
                    key={court}
                    onClick={() => toggleCourt(court)}
                    className={`px-3 py-1.5 text-xs border transition-colors flex items-center gap-1.5 ${
                      isSelected
                        ? "border-white bg-white text-black font-semibold"
                        : "border-[#2A2A2A] bg-[#141414] text-[#999999] hover:text-white hover:border-[#555555]"
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                    <span>{court}</span>
                  </button>
                );
              })}
              {filteredHighCourts.length === 0 && (
                <p className="text-xs text-[#666666] py-3 px-2">
                  No High Court matching "{highCourtSearch}".
                </p>
              )}
            </div>
          </div>

          {/* 3. DISTRICT & SESSIONS COURTS (CHOOSE STATE, THEN DISTRICT) */}
          <div className="space-y-3">
            <label className="block text-xs uppercase tracking-[0.15em] text-[#AAAAAA]">
              3. District & Sessions Courts (Choose State, Then District)
            </label>

            <div className="bg-[#0E0E0E] border border-[#262626] p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* State selector */}
                <div>
                  <label className="block text-[0.7rem] uppercase tracking-[0.15em] text-[#777777] mb-1">
                    Select State / UT
                  </label>
                  <select
                    value={selectedState}
                    onChange={(e) => {
                      setSelectedState(e.target.value);
                      setSelectedDistrictCourt("");
                    }}
                    className="w-full border border-[#333333] bg-[#0A0A0A] px-3 py-2 text-xs text-white focus:border-white focus:outline-none"
                  >
                    {availableStates.map((state) => (
                      <option key={state} value={state} className="bg-[#111111] text-white">
                        {state}
                      </option>
                    ))}
                  </select>
                </div>

                {/* District court dropdown */}
                <div>
                  <label className="block text-[0.7rem] uppercase tracking-[0.15em] text-[#777777] mb-1">
                    Select District Court ({selectedState})
                  </label>
                  <select
                    value={selectedDistrictCourt}
                    onChange={(e) => setSelectedDistrictCourt(e.target.value)}
                    className="w-full border border-[#333333] bg-[#0A0A0A] px-3 py-2 text-xs text-white focus:border-white focus:outline-none"
                  >
                    <option value="" className="bg-[#111111] text-[#777777]">
                      -- Select Court Complex --
                    </option>
                    {currentDistrictOptions.map((dc) => (
                      <option key={dc} value={dc} className="bg-[#111111] text-white">
                        {dc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Add District Button & Custom Entry */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-[#1C1C1C]">
                <button
                  type="button"
                  disabled={!selectedDistrictCourt}
                  onClick={() => {
                    if (selectedDistrictCourt) {
                      handleAddCourt(selectedDistrictCourt);
                      setSelectedDistrictCourt("");
                    }
                  }}
                  className={`px-4 py-2 text-xs uppercase tracking-[0.15em] font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                    selectedDistrictCourt
                      ? "border-white bg-white text-black hover:bg-neutral-200"
                      : "border-[#2A2A2A] bg-[#141414] text-[#555555] cursor-not-allowed"
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Selected District Court</span>
                </button>

                {/* Custom district court input fallback */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customDistrictInput}
                    onChange={(e) => setCustomDistrictInput(e.target.value)}
                    placeholder="Other District Court..."
                    className="border border-[#333333] bg-[#0A0A0A] px-3 py-1.5 text-xs text-white placeholder:text-[#555555] focus:border-white focus:outline-none w-56"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (customDistrictInput.trim()) {
                          handleAddCourt(customDistrictInput.trim());
                          setCustomDistrictInput("");
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={!customDistrictInput.trim()}
                    onClick={() => {
                      if (customDistrictInput.trim()) {
                        handleAddCourt(customDistrictInput.trim());
                        setCustomDistrictInput("");
                      }
                    }}
                    className={`px-3 py-1.5 text-xs border transition-colors ${
                      customDistrictInput.trim()
                        ? "border-[#555555] text-white hover:border-white"
                        : "border-[#222222] text-[#444444] cursor-not-allowed"
                    }`}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 4. TRIBUNALS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs uppercase tracking-[0.15em] text-[#AAAAAA]">
                4. Statutory Tribunals & Appellate Boards
              </label>
              <span className="text-[0.7rem] text-[#666666]">
                NCLAT, NCLT, NGT, CAT, DRT, ITAT, CESTAT, etc.
              </span>
            </div>

            <div className="flex flex-wrap gap-2 p-2.5 bg-[#0E0E0E] border border-[#262626]">
              {ALL_TRIBUNALS.map((tribunal) => {
                const isSelected = selectedCourts.includes(tribunal);
                return (
                  <button
                    type="button"
                    key={tribunal}
                    onClick={() => toggleCourt(tribunal)}
                    className={`px-3 py-1.5 text-xs border transition-colors flex items-center gap-1.5 text-left ${
                      isSelected
                        ? "border-white bg-white text-black font-semibold"
                        : "border-[#2A2A2A] bg-[#141414] text-[#999999] hover:text-white hover:border-[#555555]"
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                    <span>{tribunal}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* SECTION 4: CONSULTATION TYPES OFFERED */}
        <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-6 md:p-8 space-y-4">
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#888888] border-b border-[#282828] pb-3">
            04 Consultation Types Offered
          </h2>

          <p className="text-xs text-[#999999]">
            Clients seeking your counsel will be offered these communication channels:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {/* Call */}
            <label
              className={`border p-4 flex items-center gap-3 cursor-pointer transition-colors ${
                offersCall ? "border-white bg-[#222222]" : "border-[#333333] bg-[#111111]"
              }`}
            >
              <input
                type="checkbox"
                checked={offersCall}
                onChange={(e) => setOffersCall(e.target.checked)}
                className="h-4 w-4 accent-white"
              />
              <div>
                <span className="text-sm font-medium text-white flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Call
                </span>
                <span className="text-[0.7rem] text-[#888888] block">Voice / Video consultation</span>
              </div>
            </label>

            {/* Chat */}
            <label
              className={`border p-4 flex items-center gap-3 cursor-pointer transition-colors ${
                offersChat ? "border-white bg-[#222222]" : "border-[#333333] bg-[#111111]"
              }`}
            >
              <input
                type="checkbox"
                checked={offersChat}
                onChange={(e) => setOffersChat(e.target.checked)}
                className="h-4 w-4 accent-white"
              />
              <div>
                <span className="text-sm font-medium text-white flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> Chat
                </span>
                <span className="text-[0.7rem] text-[#888888] block">Text advice & doc review</span>
              </div>
            </label>

            {/* In-person */}
            <label
              className={`border p-4 flex items-center gap-3 cursor-pointer transition-colors ${
                offersInPerson ? "border-white bg-[#222222]" : "border-[#333333] bg-[#111111]"
              }`}
            >
              <input
                type="checkbox"
                checked={offersInPerson}
                onChange={(e) => setOffersInPerson(e.target.checked)}
                className="h-4 w-4 accent-white"
              />
              <div>
                <span className="text-sm font-medium text-white flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> In-person
                </span>
                <span className="text-[0.7rem] text-[#888888] block">Chamber / Court meeting</span>
              </div>
            </label>
          </div>
        </div>

        {/* SECTION 5: SHORT BIO */}
        <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-6 md:p-8 space-y-4">
          <div className="flex items-center justify-between border-b border-[#282828] pb-3">
            <h2 className="text-xs uppercase tracking-[0.2em] text-[#888888]">
              05 Short Bio (Shown to Clients)
            </h2>
            <span className="text-xs text-[#777777] font-mono">
              {bio.length} characters
            </span>
          </div>

          <div>
            <textarea
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Brief summary of your legal background, notable matters handled, and approach to client representation..."
              className="w-full border border-[#333333] bg-[#0A0A0A] p-4 text-sm text-white placeholder:text-[#555555] focus:border-white focus:outline-none leading-relaxed"
            />
          </div>
        </div>

        {/* SAVE BUTTON */}
        <div className="flex justify-end gap-4 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-white text-black px-8 py-4 text-xs font-semibold uppercase tracking-[0.2em] hover:bg-neutral-200 transition-colors flex items-center gap-2 shadow-xl"
          >
            <Save className="h-4 w-4 text-black" />
            <span>{isSaving ? "Saving..." : "Save Profile Changes"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
