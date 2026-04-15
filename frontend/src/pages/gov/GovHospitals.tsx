import TopBar from "@/components/TopBar";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, Trash, Edit } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/api";

type HospitalSummary = { _id: string; name: string };

const GovHospitals = () => {
  const [hospitals, setHospitals] = useState<HospitalSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<null | string>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", addressLine1: "", city: "", state: "", country: "", totalBeds: 0, availableBeds: 0 });
  const { user } = useAuth();
  const [message, setMessage] = useState("");

  const fetchList = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ hospitals: any[] }>(`/hospitals/list`);
      setHospitals((res.data?.hospitals || []).map((h: any) => ({ _id: h._id, name: h.name })));
    } catch (err: any) {
      setMessage(err?.message || (err?.toString && err.toString()) || "Failed to load hospitals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", phone: "", email: "", addressLine1: "", city: "", state: "", country: "", totalBeds: 0, availableBeds: 0 });
    setShowForm(true);
  };

  const openEdit = async (id: string) => {
    try {
      setLoading(true);
      const res = await apiRequest<{ hospital: any }>(`/hospitals/${id}`, { auth: true });
      const h = res.data.hospital;
      setEditing(id);
      setForm({ name: h.name || "", phone: h.contact?.phone || "", email: h.contact?.email || "", addressLine1: h.location?.addressLine1 || "", city: h.location?.city || "", state: h.location?.state || "", country: h.location?.country || "", totalBeds: h.capacity?.totalBeds || 0, availableBeds: h.capacity?.availableBeds || 0 });
      setShowForm(true);
    } catch (err: any) {
      setMessage(err?.message || "Failed to load hospital");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      // client-side validation: availableBeds must not exceed totalBeds
      if (Number(form.availableBeds) > Number(form.totalBeds)) {
        throw new Error('Available beds cannot exceed total beds');
      }

      const payload: any = {
        name: form.name,
        contact: { phone: form.phone, email: form.email },
        location: { addressLine1: form.addressLine1, city: form.city, state: form.state, country: form.country },
        capacity: { totalBeds: Number(form.totalBeds), availableBeds: Number(form.availableBeds) },
      };

      if (editing) {
        await apiRequest(`/hospitals/${editing}`, { method: "PUT", auth: true, body: payload });
        setMessage("Hospital updated");
      } else {
        await apiRequest(`/hospitals`, { method: "POST", auth: true, body: payload });
        setMessage("Hospital created");
      }

      setShowForm(false);
      fetchList();
    } catch (err: any) {
      setMessage(err?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deactivate this hospital?")) return;
    try {
      await apiRequest(`/hospitals/${id}`, { method: "DELETE", auth: true });
      setMessage("Hospital deactivated");
      fetchList();
    } catch (err: any) {
      setMessage(err?.message || "Delete failed");
    }
  };

  return (
    <div>
      <TopBar title="Hospital Registry" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Hospitals</h2>
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">{message}</div>
            <Button onClick={openCreate} className="gap-2"><Plus size={16} /> New</Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {hospitals.map((h) => (
                <tr key={h._id} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{h.name}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(h._id)}><Edit size={14} /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(h._id)}><Trash size={14} /></Button>
                  </td>
                </tr>
              ))}
              {hospitals.length === 0 && !loading && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-sm text-muted-foreground">No hospitals found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {showForm && (
          <div className="rounded-md border border-border p-4 bg-card">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Hospital name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Official hospital name (as registered)" className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2" />
                <p className="text-xs text-muted-foreground mt-1">Full official name used for public listings and notifications.</p>
              </div>

              <div>
                <label className="text-sm font-medium">Contact phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Main contact number (with country code)" className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2" />
                <p className="text-xs text-muted-foreground mt-1">Primary hospital phone for administrative and emergency contacts.</p>
              </div>

              <div>
                <label className="text-sm font-medium">Contact email</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Notifications email (e.g., admin@hospital.org)" className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2" />
                <p className="text-xs text-muted-foreground mt-1">Email used to send activation links, alerts and administrative notices.</p>
              </div>

              <div>
                <label className="text-sm font-medium">Address line 1</label>
                <input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} placeholder="Street address or building name" className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2" />
                <p className="text-xs text-muted-foreground mt-1">Primary address used for mapping and correspondence. Required.</p>
              </div>

              <div>
                <label className="text-sm font-medium">City</label>
                <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City where the hospital is located" className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2" />
                <p className="text-xs text-muted-foreground mt-1">Used for region grouping and nearby searches.</p>
              </div>

              <div>
                <label className="text-sm font-medium">State / Province</label>
                <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State or province" className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2" />
              </div>

              <div>
                <label className="text-sm font-medium">Country</label>
                <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Country" className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2" />
              </div>

              {user?.role === "HOSPITAL_ADMIN" ? (
                <>
                  <div>
                    <label className="text-sm font-medium">Total beds</label>
                    <input type="number" value={form.totalBeds} onChange={(e) => setForm({ ...form, totalBeds: Number(e.target.value) })} placeholder="Total physical beds in hospital" className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2" />
                    <p className="text-xs text-muted-foreground mt-1">Total number of beds physically available at the hospital (including ICU and general).</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Available beds</label>
                    <input type="number" value={form.availableBeds} onChange={(e) => setForm({ ...form, availableBeds: Number(e.target.value) })} placeholder="Currently vacant beds available for patients" className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2" />
                    <p className="text-xs text-muted-foreground mt-1">Number of beds currently free. Must be less than or equal to Total beds; update this frequently to keep status accurate.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="col-span-2 text-sm text-muted-foreground">Bed counts are managed by Hospital Admins. Government officials should not enter bed numbers here.</div>
                </>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : (editing ? 'Update' : 'Create')}</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GovHospitals;
