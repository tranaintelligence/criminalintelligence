import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  User, ShieldCheck, Check, Clock, Upload, 
  MapPin, Phone, MessageSquare, Save, AlertCircle, Camera,
  X, Search, Plus, Landmark, Award, Building2, Mail
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLawyerAuth } from "./lawyer";
import {
  SUPREME_COURT,
  ALL_HIGH_COURTS,
  DISTRICT_COURTS_BY_STATE,
  ALL_TRIBUNALS,
  ALL_STATE_BAR_COUNCILS,
  PROMINENT_BAR_ASSOCIATIONS,
  LEGAL_SPECIALISATIONS,
  parseCourtsList,
  formatCourtsHeader,
  isValidBarRegNo,
} from "@/lib/courts-data";
import { updateCurrentLawyer } from "@/lib/trana-admin-api";
import { useTranaCredential } from "@/lib/trana-auth";

export const Route = createFileRoute("/_authenticated/lawyer/profile")({
  head: () => ({
    meta: [
      { title: "Legal Professional Workspace — TRANA" },
      { name: "description", content: "Manage your legal profile, Bar registration, specialisations, and consultation preferences." },
      { property: "og:title", content: "Legal Professional Workspace — TRANA" },
    ],
  }),
  component: LawyerProfilePage,
});

function LawyerProfilePage() {
  const { user } = Route.useRouteContext();
  const { credential } = useTranaCredential();
  const { data: lawyer, refetch } = useLawyerAuth();

  // Form states
  const [fullName, setFullName] = useState("");
  const [barRegNo, setBarRegNo] = useState("");
  const [stateBarCouncil, setStateBarCouncil] = useState<string>("Bar Council of Delhi (BCD)");
  const [yearOfEnrollment, setYearOfEnrollment] = useState<number>(2021);
  const [aibeCopNumber, setAibeCopNumber] = useState<string>("");
  const [barAssociation, setBarAssociation] = useState<string>("Delhi High Court Bar Association (DHCBA)");
  const [experienceYears, setExperienceYears] = useState<number>(5);
  const [phone, setPhone] = useState("+91 ");
  const [email, setEmail] = useState("");
  const [chamberAddress, setChamberAddress] = useState("");
  const [selectedSpecialisations, setSelectedSpecialisations] = useState<string[]>([]);
  const [city, setCity] = useState("New Delhi");
  const [selectedCourts, setSelectedCourts] = useState<string[]>([]);
  const [selectedState, setSelectedState] = useState<string>("Delhi");
  const [selectedDistrictCourt, setSelectedDistrictCourt] = useState<string>("");
  const [customDistrictInput, setCustomDistrictInput] = useState<string>("");
  const [highCourtSearch, setHighCourtSearch] = useState<string>("");
  const [offersCall, setOffersCall] = useState(true);
  const [offersChat, setOffersChat] = useState(true);
  const [bio, setBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoadedProfile, setHasLoadedProfile] = useState(false);

  // Verification status
  const isApproved = lawyer?.approved || lawyer?.verification_status === "VERIFIED";

  useEffect(() => {
    if (lawyer) {
      setFullName(lawyer.full_name || "");
      setBarRegNo(lawyer.bar_reg_no || "D/2104/2021");
      setStateBarCouncil(lawyer.state_bar_council || "Bar Council of Delhi (BCD)");
      setYearOfEnrollment(lawyer.year_of_enrollment || 2021);
      setAibeCopNumber(lawyer.aibe_cop_number || "");
      setBarAssociation(lawyer.bar_association || "Delhi High Court Bar Association (DHCBA)");
      setExperienceYears(lawyer.experience_years || 5);
      setPhone(lawyer.phone || "+91 ");
      setEmail(lawyer.email || user.email || "");
      setChamberAddress(lawyer.chamber_address || "");
      setCity(lawyer.city || "New Delhi");
      setSelectedState(lawyer.state || "Delhi");
      
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

      // Parse initial specialisations
      if (lawyer.specialisation) {
        const parts = lawyer.specialisation.split(",").map((s) => s.trim());
        setSelectedSpecialisations(parts.length > 0 ? parts : ["Criminal Defence & Anticipatory Bail"]);
      } else {
        setSelectedSpecialisations(["Criminal Defence & Anticipatory Bail", "BNS & BNSS Criminal Procedure"]);
      }

      if (typeof window !== "undefined" && user?.id) {
        const cachedPhoto =
          localStorage.getItem(`trana_lawyer_avatar_${user.id}`) ||
          localStorage.getItem("trana_lawyer_avatar") ||
          (lawyer as any)?.avatar_url ||
          (lawyer as any)?.photo_url;
        if (cachedPhoto) {
          setAvatarPreview(cachedPhoto);
        }
      }

      setHasLoadedProfile(true);
    }
  }, [lawyer, user.id, user.email]);

  // Persist courts to local session whenever user updates selection
  useEffect(() => {
    if (!hasLoadedProfile || !user?.id) return;
    const payload = JSON.stringify(selectedCourts);
    if (typeof window !== "undefined") {
      localStorage.setItem(`trana_lawyer_courts_${user.id}`, payload);
      localStorage.setItem("trana_lawyer_courts", payload);
    }
  }, [selectedCourts, hasLoadedProfile, user?.id]);

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
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Please select a photo under 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64 = uploadEvent.target?.result as string;
        if (base64) {
          setAvatarPreview(base64);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(`trana_lawyer_avatar_${user?.id}`, base64);
              localStorage.setItem("trana_lawyer_avatar", base64);
              const cleanBar = barRegNo.trim().toUpperCase();
              if (cleanBar) {
                localStorage.setItem(`trana_lawyer_avatar_${cleanBar}`, base64);
              }
            } catch {}
          }
          toast.success("Profile photo uploaded!");
        }
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const specString = selectedSpecialisations.join(", ") || "Criminal Defence & Bail";
      const cleanBar = barRegNo.trim().toUpperCase();

      // 1. Immediately persist to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem(`trana_lawyer_bar_${user.id}`, cleanBar);
        localStorage.setItem(`trana_lawyer_courts_${user.id}`, JSON.stringify(selectedCourts));
        localStorage.setItem("trana_lawyer_courts", JSON.stringify(selectedCourts));

        if (avatarPreview) {
          localStorage.setItem(`trana_lawyer_avatar_${user.id}`, avatarPreview);
          localStorage.setItem(`trana_lawyer_avatar_${cleanBar}`, avatarPreview);
          localStorage.setItem(`trana_lawyer_avatar_${fullName.toLowerCase().trim()}`, avatarPreview);
          localStorage.setItem("trana_lawyer_avatar", avatarPreview);

          const photoMap = JSON.parse(localStorage.getItem("trana_all_lawyer_photos") || "{}");
          photoMap[user.id] = avatarPreview;
          photoMap[cleanBar] = avatarPreview;
          photoMap[fullName.toLowerCase().trim()] = avatarPreview;
          if (lawyer?.id) photoMap[lawyer.id] = avatarPreview;
          localStorage.setItem("trana_all_lawyer_photos", JSON.stringify(photoMap));
        }
      }

      // 2. Call Backend API
      if (credential) {
        try {
          await updateCurrentLawyer(credential, {
            full_name: fullName,
            bar_reg_no: cleanBar,
            state_bar_council: stateBarCouncil,
            year_of_enrollment: Number(yearOfEnrollment) || 2021,
            aibe_cop_number: aibeCopNumber.trim() || undefined,
            bar_association: barAssociation,
            specialisation: specString,
            experience_years: Number(experienceYears) || 1,
            city,
            state: selectedState,
            chamber_address: chamberAddress.trim() || undefined,
            courts: selectedCourts,
            bio,
            offers_call: offersCall,
            offers_chat: offersChat,
          });
        } catch (beErr) {
          console.warn("Backend lawyer update notice:", beErr);
        }
      }

      // 3. Update Supabase lawyers table
      await supabase.from("lawyers").upsert({
        user_id: user.id,
        full_name: fullName,
        email: email || user.email,
        phone: phone,
        bar_reg_no: cleanBar,
        state_bar_council: stateBarCouncil,
        year_of_enrollment: Number(yearOfEnrollment) || 2021,
        aibe_cop_number: aibeCopNumber.trim() || null,
        bar_association: barAssociation,
        experience_years: Number(experienceYears) || 1,
        city: city,
        state: selectedState,
        chamber_address: chamberAddress.trim() || null,
        courts: JSON.stringify(selectedCourts),
        bio: bio,
        avatar_url: avatarPreview || null,
        specialisation: specString,
        offers_call: offersCall,
        offers_chat: offersChat,
        offers_in_person: false,
        approved: isApproved,
      }).catch((err) => console.warn("lawyers upsert:", err));

      // 4. Update auth user metadata
      await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          bar_reg_no: cleanBar,
          state_bar_council: stateBarCouncil,
          courts: JSON.stringify(selectedCourts),
          bio: bio,
        },
      }).catch((err) => console.warn("auth updateUser:", err));

      await supabase.auth.refreshSession().catch(() => {});
      await refetch();
      toast.success("Advocate profile & Bar credentials updated successfully!");
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
            My Advocate Profile
          </h1>
          <p className="mt-2 text-sm text-[#999999]">
            Manage your State Bar Council credentials, court admissions, and client consultation channels.
          </p>
        </div>

        {/* Verification Status Badge */}
        <div className="flex items-center">
          {isApproved ? (
            <div className="inline-flex items-center gap-2 border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              <span>✓ Bar Sanad Verified</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-400">
              <Clock className="h-4 w-4" />
              <span>⏳ Sanad Verification Pending</span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* SECTION 1: PHOTO & BASIC INFO */}
        <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-6 md:p-8 space-y-6">
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#888888] border-b border-[#282828] pb-3">
            Professional Identity & Bar Council Credentials
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
              <span className="text-[0.7rem] text-[#777777]">Sanad Photo</span>
            </div>

            {/* Inputs Grid */}
            <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
                  Full Legal Name (as on Bar Council Sanad) *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Advocate Full Name"
                  className="w-full border border-[#333333] bg-[#0A0A0A] px-4 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
                  State Bar Council *
                </label>
                <select
                  value={stateBarCouncil}
                  onChange={(e) => setStateBarCouncil(e.target.value)}
                  className="w-full border border-[#333333] bg-[#0A0A0A] px-3.5 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                >
                  {ALL_STATE_BAR_COUNCILS.map((sbc) => (
                    <option key={sbc} value={sbc} className="bg-[#141414] text-white">
                      {sbc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
                  Bar Enrollment / Sanad No. *
                </label>
                <input
                  type="text"
                  required
                  value={barRegNo}
                  onChange={(e) => setBarRegNo(e.target.value)}
                  placeholder="e.g. D/1429/2019"
                  className="w-full border border-[#333333] bg-[#0A0A0A] px-4 py-2.5 text-sm text-white focus:border-white focus:outline-none font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
                  Year of Enrollment
                </label>
                <input
                  type="number"
                  value={yearOfEnrollment}
                  onChange={(e) => setYearOfEnrollment(parseInt(e.target.value) || 2021)}
                  className="w-full border border-[#333333] bg-[#0A0A0A] px-4 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
                  AIBE COP Number
                </label>
                <input
                  type="text"
                  value={aibeCopNumber}
                  onChange={(e) => setAibeCopNumber(e.target.value)}
                  placeholder="e.g. COP/BCD/2021/8831"
                  className="w-full border border-[#333333] bg-[#0A0A0A] px-4 py-2.5 text-sm text-white font-mono focus:border-white focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
                  Primary Bar Association Membership
                </label>
                <select
                  value={barAssociation}
                  onChange={(e) => setBarAssociation(e.target.value)}
                  className="w-full border border-[#333333] bg-[#0A0A0A] px-3.5 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                >
                  {PROMINENT_BAR_ASSOCIATIONS.map((ba) => (
                    <option key={ba} value={ba} className="bg-[#141414] text-white">
                      {ba}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
                  Active Practice Experience (Years)
                </label>
                <input
                  type="number"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(parseInt(e.target.value) || 1)}
                  className="w-full border border-[#333333] bg-[#0A0A0A] px-4 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
                  Chamber Mobile (SMS Alerts)
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-[#333333] bg-[#0A0A0A] px-4 py-2.5 text-sm text-white font-mono focus:border-white focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
                  Chamber / Office Address
                </label>
                <input
                  type="text"
                  value={chamberAddress}
                  onChange={(e) => setChamberAddress(e.target.value)}
                  placeholder="e.g. Chamber No. 418, Lawyers Block, High Court of Delhi"
                  className="w-full border border-[#333333] bg-[#0A0A0A] px-4 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: SPECIALISATION AREAS (MULTI-SELECT) */}
        <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-6 md:p-8 space-y-4">
          <div className="flex items-center justify-between border-b border-[#282828] pb-3">
            <h2 className="text-xs uppercase tracking-[0.2em] text-[#888888]">
              Specialisation Areas (Multi-Select)
            </h2>
            <span className="text-xs text-[#777777]">
              {selectedSpecialisations.length} Selected
            </span>
          </div>

          <p className="text-xs text-[#999999]">
            Select all practice areas you accept client referrals and court appearances for:
          </p>

          <div className="flex flex-wrap gap-2.5 pt-2">
            {LEGAL_SPECIALISATIONS.map((spec) => {
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
                Jurisdiction & Courts of Practice
              </h2>
              <p className="text-xs text-[#777777] mt-0.5">
                Courts where you are regularly admitted and have vakalatnama appearances.
              </p>
            </div>
            <span className="text-xs text-neutral-300 font-medium">
              {formatCourtsHeader(selectedCourts)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
                Primary City of Practice
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. New Delhi"
                className="w-full border border-[#333333] bg-[#0A0A0A] px-4 py-2.5 text-sm text-white focus:border-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
                State / Jurisdiction
              </label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full border border-[#333333] bg-[#0A0A0A] px-3.5 py-2.5 text-sm text-white focus:border-white focus:outline-none"
              >
                {availableStates.map((st) => (
                  <option key={st} value={st} className="bg-[#141414] text-white">
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Currently Selected Courts Chips */}
          <div className="border border-[#282828] bg-[#111111] p-4 space-y-2">
            <span className="text-xs uppercase tracking-wider text-[#888888] block">
              Admitted Practice Courts ({selectedCourts.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {selectedCourts.map((court) => (
                <span
                  key={court}
                  className="inline-flex items-center gap-1.5 bg-[#1F1F1F] border border-white/20 px-3 py-1 text-xs text-white"
                >
                  <Landmark className="h-3 w-3 text-neutral-400" />
                  <span>{court}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCourt(court)}
                    className="ml-1 text-[#888888] hover:text-red-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 4: PROFESSIONAL BIO & CONSULTATION PREFERENCES */}
        <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-6 md:p-8 space-y-6">
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#888888] border-b border-[#282828] pb-3">
            Professional Summary & Client Consultation Preferences
          </h2>

          <div>
            <label className="block text-xs uppercase tracking-[0.15em] text-[#888888] mb-1.5">
              Professional Biography
            </label>
            <textarea
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full border border-[#333333] bg-[#0A0A0A] px-4 py-3 text-sm text-white focus:border-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <label className="flex items-center gap-3 p-4 border border-[#333333] bg-[#111111] cursor-pointer hover:border-white transition-colors">
              <input
                type="checkbox"
                checked={offersCall}
                onChange={(e) => setOffersCall(e.target.checked)}
                className="h-4 w-4 accent-white"
              />
              <div>
                <p className="text-sm font-medium text-white flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" /> Accept Telephone Consultations
                </p>
                <p className="text-[11px] text-[#777777]">Allow verified clients to schedule phone briefings</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-4 border border-[#333333] bg-[#111111] cursor-pointer hover:border-white transition-colors">
              <input
                type="checkbox"
                checked={offersChat}
                onChange={(e) => setOffersChat(e.target.checked)}
                className="h-4 w-4 accent-white"
              />
              <div>
                <p className="text-sm font-medium text-white flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5" /> Accept Masked Chat Inquiries
                </p>
                <p className="text-[11px] text-[#777777]">Receive privileged client queries via encrypted channel</p>
              </div>
            </label>
          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-white px-8 py-3.5 text-xs font-semibold uppercase tracking-[0.15em] text-black hover:bg-neutral-200 transition-colors flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving Updates..." : "Save Profile & Bar Credentials"}
          </button>
        </div>
      </form>
    </div>
  );
}
