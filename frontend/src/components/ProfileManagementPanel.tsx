import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { ApiClientError } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  HOSPITAL_ADMIN: "Hospital Admin",
  DOCTOR: "Doctor",
  BED_MANAGER: "Bed Manager",
  DATA_ENTRY: "Data Entry",
  AMBULANCE_DRIVER: "Ambulance Driver",
  GOVERNMENT_OFFICIAL: "Government Official",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

const ProfileManagementPanel = () => {
  const { user, updateProfile, changePassword } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
    setEmail(user?.email || "");
  }, [user?.name, user?.email]);

  const roleLabel = useMemo(() => {
    if (!user?.role) return "-";
    return ROLE_LABELS[user.role] || user.role;
  }, [user?.role]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (trimmedName.length < 2 || trimmedName.length > 80) {
      setProfileError("Name must be between 2 and 80 characters.");
      return;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setProfileError("Please enter a valid email address.");
      return;
    }

    setIsProfileSaving(true);
    try {
      await updateProfile({ name: trimmedName, email: normalizedEmail });
      toast.success("Profile updated successfully.");
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Failed to update profile.";
      setProfileError(message);
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All password fields are required.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError("New password must be different from current password.");
      return;
    }

    if (!PASSWORD_COMPLEXITY_REGEX.test(newPassword)) {
      setPasswordError("Password must include uppercase, lowercase, number, and special character.");
      return;
    }

    setIsPasswordSaving(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed successfully.");
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Failed to change password.";
      setPasswordError(message);
    } finally {
      setIsPasswordSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleProfileSave} className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Profile Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-secondary border-border"
              placeholder="Enter your full name"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-secondary border-border"
              placeholder="Enter your email"
              type="email"
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Input value={roleLabel} disabled className="bg-secondary border-border opacity-60" />
          </div>
          <div className="space-y-2">
            <Label>Hospital ID</Label>
            <Input value={user?.hospital || "-"} disabled className="bg-secondary border-border opacity-60" />
          </div>
        </div>

        {profileError && <p className="text-sm text-destructive">{profileError}</p>}

        <Button type="submit" disabled={isProfileSaving}>
          {isProfileSaving ? "Saving..." : "Save Profile"}
        </Button>
      </form>

      <form onSubmit={handlePasswordChange} className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Change Password</h3>

        <div className="space-y-2">
          <Label>Current Password</Label>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="bg-secondary border-border"
            placeholder="Enter current password"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-secondary border-border"
              placeholder="Enter new password"
            />
          </div>
          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-secondary border-border"
              placeholder="Confirm new password"
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Password must be at least 8 characters and include uppercase, lowercase, number, and special character.
        </p>

        {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}

        <Button type="submit" disabled={isPasswordSaving}>
          {isPasswordSaving ? "Updating..." : "Update Password"}
        </Button>
      </form>
    </div>
  );
};

export default ProfileManagementPanel;
