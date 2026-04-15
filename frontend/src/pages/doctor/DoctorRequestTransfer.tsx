import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { useSocketContext } from "@/contexts/SocketContext";
import axiosInstance from "@/api/axiosInstance";

type HospitalOption = {
  _id: string;
  name: string;
  region?: string;
  capacity?: {
    availableBeds?: number;
    totalBeds?: number;
  };
  resources?: {
    generalBeds?: number;
    icuBeds?: number;
    ventilatorBeds?: number;
  };
};

type TransferResponse = {
  transfer?: {
    _id?: string;
    patientName?: string;
    requiredBedType?: string;
    status?: string;
    requestedBy?: { name?: string };
    route?: { durationMin?: number };
    toHospital?: { _id?: string; name?: string } | string;
  };
};

const BED_TYPE_OPTIONS = [
  { value: "icuBeds", label: "ICU" },
  { value: "generalBeds", label: "General" },
  { value: "ventilatorBeds", label: "Ventilator" },
];

const BED_TYPE_LABELS: Record<string, string> = {
  icuBeds: "ICU",
  generalBeds: "General",
  ventilatorBeds: "Ventilator",
};

const DoctorRequestTransfer = () => {
  const { user } = useAuth();
  const { socket } = useSocketContext();

  const [step, setStep] = useState(1);
  const [patientName, setPatientName] = useState("");
  const [patientId, setPatientId] = useState("");
  const [requiredBedType, setRequiredBedType] = useState("icuBeds");
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
  const [isLoadingHospitals, setIsLoadingHospitals] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedHospital = useMemo(
    () => hospitals.find((hospital) => hospital._id === selectedHospitalId) || null,
    [hospitals, selectedHospitalId]
  );

  useEffect(() => {
    const loadHospitals = async () => {
      try {
        setIsLoadingHospitals(true);
        const res = await axiosInstance.get("/hospitals");
        const list: HospitalOption[] =
          res.data?.data?.hospitals ||
          res.data?.hospitals ||
          [];

        const filtered = list.filter((hospital) => hospital?._id && hospital._id !== user?.hospital);
        setHospitals(filtered);
      } catch (err: any) {
        const message = err?.response?.data?.message || err?.message || "Failed to load hospitals";
        toast.error(message);
      } finally {
        setIsLoadingHospitals(false);
      }
    };

    loadHospitals();
  }, [user?.hospital]);

  const handleRequestTransfer = async (targetHospitalId?: string | null) => {
    if (!patientName.trim()) {
      toast.error("Patient name is required");
      return;
    }

    if (!user?.hospital) {
      toast.error("Your account is not linked to a hospital");
      return;
    }

    const finalTargetHospitalId = targetHospitalId ?? selectedHospital?._id ?? null;

    try {
      setIsSubmitting(true);

      const res = await axiosInstance.post<TransferResponse>("/logistics/transfer", {
        patientName: patientName.trim(),
        patientId: patientId.trim(),
        requiredBedType,
        fromHospitalId: user.hospital,
        toHospitalId: finalTargetHospitalId,
        targetHospitalId: finalTargetHospitalId,
        requestedBy: {
          role: "doctor",
          id: user.id,
          name: user.name,
        },
      });

      const transfer = res.data?.transfer || res.data?.data?.transfer;
      const targetHospitalId =
        (typeof transfer?.toHospital === "object" && transfer?.toHospital?._id) ||
        finalTargetHospitalId;

      if (socket && targetHospitalId) {
        socket.emit("transfer-requested", {
          targetHospitalId,
          transfer,
        });
      }

      toast.success("Transfer request submitted");
      setStep(1);
      setPatientName("");
      setPatientId("");
      setRequiredBedType("icuBeds");
      setSelectedHospitalId(null);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Failed to submit transfer request";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <TopBar title="Request Patient Transfer" />
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {step > s ? <Check size={14} /> : s}
              </div>
              {s < 3 && <div className={`h-0.5 w-12 ${step > s ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="font-semibold text-foreground">Step 1 — Patient Details</h3>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Patient Name</Label>
                <Input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Patient ID (optional)</Label>
                <Input
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Bed Required</Label>
                <select
                  value={requiredBedType}
                  onChange={(e) => setRequiredBedType(e.target.value)}
                  className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
                >
                  {BED_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end"><Button onClick={() => setStep(2)} disabled={!patientName.trim()}>Next →</Button></div>
          </div>
        )}

        {step === 2 && (
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="font-semibold text-foreground">Step 2 — Select Destination Hospital</h3>
            <Button variant="outline" className="w-full" onClick={() => setSelectedHospitalId(null)}>Find Nearest Available Hospital Automatically</Button>
            <div className="text-center text-xs text-muted-foreground">— or —</div>
            <div className="space-y-2">
              {isLoadingHospitals ? (
                <p className="text-xs text-muted-foreground">Loading hospitals...</p>
              ) : hospitals.length === 0 ? (
                <p className="text-xs text-muted-foreground">No destination hospitals available. You can still auto-assign nearest hospital.</p>
              ) : (
                hospitals.map((hospital) => (
                  <button
                    key={hospital._id}
                    onClick={() => setSelectedHospitalId(hospital._id)}
                    className={`w-full flex items-center justify-between rounded-md border p-3 text-left transition-colors ${selectedHospitalId === hospital._id ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-accent"}`}
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{hospital.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ICU: {hospital.resources?.icuBeds ?? 0} | General: {hospital.resources?.generalBeds ?? 0} | Ventilator: {hospital.resources?.ventilatorBeds ?? 0}
                      </p>
                    </div>
                    {selectedHospitalId === hospital._id && <Check size={16} className="text-primary" />}
                  </button>
                ))
              )}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={() => setStep(3)}>Next →</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="font-semibold text-foreground">Step 3 — Review & Submit</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Patient:</span><span className="text-foreground">{patientName || "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Bed Type:</span><span className="text-foreground">{BED_TYPE_LABELS[requiredBedType] || requiredBedType}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">From Hospital ID:</span><span className="text-foreground">{user?.hospital || "Not assigned"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">To:</span><span className="text-foreground">{selectedHospital?.name || "Auto-assign nearest"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Est. Route:</span><span className="text-foreground">Calculated by backend</span></div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>← Edit</Button>
              <Button onClick={() => handleRequestTransfer(selectedHospital?._id)} disabled={isSubmitting}>{isSubmitting ? "Submitting..." : "Request Admit"}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorRequestTransfer;
