import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useMemo, useState } from "react";
import { Switch } from "@/components/ui/switch";
import ProfileManagementPanel from "@/components/ProfileManagementPanel";
import { apiRequest, ApiClientError } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

type HospitalDetails = {
  name: string;
  region: string;
  locationGps: string;
  contactPhone: string;
  emergencyPhone: string;
};

type HospitalApiModel = {
  name?: string;
  region?: string;
  contact?: {
    phone?: string;
    emergencyPhone?: string;
  };
  location?: {
    coordinates?: {
      coordinates?: number[];
    };
  };
};

const parseGpsInput = (input: string): { latitude: number; longitude: number } | null => {
  const match = input
    .trim()
    .match(/^\s*([+-]?\d+(?:\.\d+)?)\s*°?\s*([NS])?\s*,\s*([+-]?\d+(?:\.\d+)?)\s*°?\s*([EW])?\s*$/i);

  if (!match) return null;

  let latitude = Number(match[1]);
  let longitude = Number(match[3]);

  const latHemisphere = (match[2] || "").toUpperCase();
  const lngHemisphere = (match[4] || "").toUpperCase();

  if (latHemisphere === "S") latitude = -Math.abs(latitude);
  if (latHemisphere === "N") latitude = Math.abs(latitude);
  if (lngHemisphere === "W") longitude = -Math.abs(longitude);
  if (lngHemisphere === "E") longitude = Math.abs(longitude);

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
};

const toGpsLabel = (coordinates?: number[]) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return "";
  const [longitude, latitude] = coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "";

  const latHemisphere = latitude >= 0 ? "N" : "S";
  const lngHemisphere = longitude >= 0 ? "E" : "W";
  return `${Math.abs(latitude).toFixed(4)}° ${latHemisphere}, ${Math.abs(longitude).toFixed(4)}° ${lngHemisphere}`;
};

const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState("Profile");
  const tabs = ["Profile", "Hospital Details", "Notification Preferences"];
  const [hospitalDetails, setHospitalDetails] = useState<HospitalDetails>({
    name: "",
    region: "",
    locationGps: "",
    contactPhone: "",
    emergencyPhone: "",
  });
  const [hospitalError, setHospitalError] = useState("");
  const [isHospitalLoading, setIsHospitalLoading] = useState(false);
  const [isHospitalSaving, setIsHospitalSaving] = useState(false);

  const hospitalDetailsEnabled = useMemo(() => activeTab === "Hospital Details", [activeTab]);

  useEffect(() => {
    if (!hospitalDetailsEnabled) return;

    let cancelled = false;
    const loadHospitalDetails = async () => {
      setHospitalError("");
      setIsHospitalLoading(true);

      try {
        const response = await apiRequest<{ hospital: HospitalApiModel }>("/hospitals/me", { auth: true });
        if (cancelled) return;

        const hospital = response.data.hospital || {};
        setHospitalDetails({
          name: hospital.name || "",
          region: hospital.region || "",
          locationGps: toGpsLabel(hospital.location?.coordinates?.coordinates) || "",
          contactPhone: hospital.contact?.phone || "",
          emergencyPhone: hospital.contact?.emergencyPhone || "",
        });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof ApiClientError ? error.message : "Failed to load hospital details.";
        setHospitalError(message);
      } finally {
        if (!cancelled) setIsHospitalLoading(false);
      }
    };

    loadHospitalDetails();

    return () => {
      cancelled = true;
    };
  }, [hospitalDetailsEnabled]);

  const handleHospitalFieldChange = (field: keyof HospitalDetails, value: string) => {
    setHospitalDetails((prev) => ({ ...prev, [field]: value }));
  };

  const handleHospitalSave = async () => {
    setHospitalError("");

    if (hospitalDetails.name.trim().length < 2) {
      setHospitalError("Hospital name must be at least 2 characters.");
      return;
    }

    if (!hospitalDetails.contactPhone.trim()) {
      setHospitalError("Contact phone is required.");
      return;
    }

    const parsedGps = hospitalDetails.locationGps.trim() ? parseGpsInput(hospitalDetails.locationGps) : null;
    if (hospitalDetails.locationGps.trim() && !parsedGps) {
      setHospitalError("Location must be in 'lat, lng' format (example: 13.0827, 80.2707).");
      return;
    }

    setIsHospitalSaving(true);
    try {
      await apiRequest<{ hospital: HospitalApiModel }>("/hospitals/me", {
        method: "PATCH",
        auth: true,
        body: {
          name: hospitalDetails.name.trim(),
          region: hospitalDetails.region.trim(),
          contactPhone: hospitalDetails.contactPhone.trim(),
          emergencyPhone: hospitalDetails.emergencyPhone.trim(),
          ...(parsedGps ? { latitude: parsedGps.latitude, longitude: parsedGps.longitude } : {}),
        },
      });

      toast.success("Hospital details updated successfully.");
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : "Failed to save hospital details.";
      setHospitalError(message);
      toast.error(message);
    } finally {
      setIsHospitalSaving(false);
    }
  };

  return (
    <div>
      <TopBar title="Settings" />
      <div className="p-6 space-y-6 max-w-2xl">
        <div className="flex gap-2 border-b border-border pb-px">
          {tabs.map((tab) => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-medium transition-all relative ${activeTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              {tab}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          ))}
        </div>

        {activeTab === "Profile" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <ProfileManagementPanel />
          </div>
        )}

        {activeTab === "Hospital Details" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground italic border-l-2 border-primary pl-2 uppercase tracking-tight">Institutional Information</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase text-muted-foreground">Hospital Name</Label>
                  <Input
                    value={hospitalDetails.name}
                    onChange={(e) => handleHospitalFieldChange("name", e.target.value)}
                    className="bg-secondary/50 border-border h-9 text-sm"
                    disabled={isHospitalLoading || isHospitalSaving}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground">Region</Label>
                    <Input
                      value={hospitalDetails.region}
                      onChange={(e) => handleHospitalFieldChange("region", e.target.value)}
                      className="bg-secondary/50 border-border h-9 text-sm"
                      disabled={isHospitalLoading || isHospitalSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground">Location (GPS)</Label>
                    <Input
                      value={hospitalDetails.locationGps}
                      onChange={(e) => handleHospitalFieldChange("locationGps", e.target.value)}
                      className="bg-secondary/50 border-border h-9 text-sm"
                      placeholder="13.0827, 80.2707"
                      disabled={isHospitalLoading || isHospitalSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground">Contact Phone</Label>
                    <Input
                      value={hospitalDetails.contactPhone}
                      onChange={(e) => handleHospitalFieldChange("contactPhone", e.target.value)}
                      className="bg-secondary/50 border-border h-9 text-sm"
                      disabled={isHospitalLoading || isHospitalSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground">Emergency Hotline</Label>
                    <Input
                      value={hospitalDetails.emergencyPhone}
                      onChange={(e) => handleHospitalFieldChange("emergencyPhone", e.target.value)}
                      className="bg-secondary/50 border-border h-9 text-sm text-status-critical font-medium"
                      disabled={isHospitalLoading || isHospitalSaving}
                    />
                  </div>
                </div>
                {hospitalError && <p className="text-sm text-destructive">{hospitalError}</p>}
                <Button size="sm" onClick={handleHospitalSave} disabled={isHospitalLoading || isHospitalSaving}>
                  {isHospitalSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Notification Preferences" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="rounded-lg border border-border border-l-2 border-l-primary bg-card p-5 space-y-4 text-sm font-semibold text-foreground italic pl-2 uppercase tracking-tight">
              Thresholds & Alerts
            </div>
            <div className="rounded-lg border border-border bg-card p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">Alert threshold (critical beds)</p>
                <p className="text-[10px] text-muted-foreground">Get notified when ICU beds fall below this number</p>
              </div>
              <select className="bg-secondary border border-border rounded-md px-2 py-1 text-sm focus:outline-none">
                <option>2</option>
                <option selected>3</option>
                <option>5</option>
              </select>
            </div>
            {[
              { title: "Email on transfer created", desc: "Receive automated email when a new transfer starts" },
              { title: "Email on critical alert", desc: "Get priority push for all critical capacity warnings" },
              { title: "In-app alerts", desc: "Show status toast for every resource update" }
            ].map((pref, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">{pref.title}</p>
                  <p className="text-[10px] text-muted-foreground">{pref.desc}</p>
                </div>
                <Switch defaultChecked={i < 2} />
              </div>
            ))}
            <Button size="sm">Apply Preferences</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;
