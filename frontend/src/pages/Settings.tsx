import { useEffect, useState } from "react";
import { Bell, LogOut, Shield, User } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PROFILE_SETTINGS_KEY, useProfileSettings } from "@/lib/profile-settings-context";
import { formatSessionLastActive, useAuth } from "@/lib/auth";
import { toast } from "sonner";

const LANGUAGE_OPTIONS = [
  { value: "id-ID", label: "Bahasa Indonesia" },
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
] as const;

export function SettingsPage() {
  const [language, setLanguage] = useState<string>("id-ID");
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [draftPoAlerts, setDraftPoAlerts] = useState(true);
  const [weeklyAnalytics, setWeeklyAnalytics] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [logoutAlertOpen, setLogoutAlertOpen] = useState(false);
  const { profile, setProfile } = useProfileSettings();
  const { logout, sessions } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function updateProfile<K extends keyof typeof profile>(key: K, value: (typeof profile)[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function showToast(title: string, description: string) {
    console.info(title, description);
  }

  function readFormProfile() {
    const fullNameInput = document.querySelector<HTMLInputElement>("#full-name");
    const emailInput = document.querySelector<HTMLInputElement>("#email");
    const phoneInput = document.querySelector<HTMLInputElement>("#phone");

    return {
      ...profile,
      fullName: fullNameInput?.value ?? profile.fullName,
      email: emailInput?.value ?? profile.email,
      phone: phoneInput?.value ?? profile.phone,
    };
  }

  function persistProfileBeforeLogout() {
    const latestProfile = readFormProfile();
    setProfile(latestProfile);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(PROFILE_SETTINGS_KEY, JSON.stringify(latestProfile));
    }
  }

  useEffect(() => {
    const syncProfileFromInputs = () => {
      setProfile((current) => {
        const fullNameInput = document.querySelector<HTMLInputElement>("#full-name");
        const emailInput = document.querySelector<HTMLInputElement>("#email");
        const phoneInput = document.querySelector<HTMLInputElement>("#phone");

        return {
          ...current,
          fullName: fullNameInput?.value ?? current.fullName,
          email: emailInput?.value ?? current.email,
          phone: phoneInput?.value ?? current.phone,
        };
      });
    };

    const inputs = [
      document.querySelector<HTMLInputElement>("#full-name"),
      document.querySelector<HTMLInputElement>("#email"),
      document.querySelector<HTMLInputElement>("#phone"),
    ].filter((input): input is HTMLInputElement => Boolean(input));

    inputs.forEach((input) => input.addEventListener("input", syncProfileFromInputs));
    return () => {
      inputs.forEach((input) => input.removeEventListener("input", syncProfileFromInputs));
    };
  }, [setProfile]);

  return (
    <div className="mt-6 space-y-8">
      <Tabs defaultValue="profile" className="w-full space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted p-1 lg:grid-cols-3 lg:gap-0">
          <TabsTrigger value="profile" className="gap-2 text-sm">
            <User className="h-4 w-4 shrink-0" />
            <span className="truncate">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2 text-sm">
            <Bell className="h-4 w-4 shrink-0" />
            <span className="truncate">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 text-sm">
            <Shield className="h-4 w-4 shrink-0" />
            <span className="truncate">Security</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-0 focus-visible:outline-none">
          <Card className="border-border bg-surface shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold tracking-tight">Profile</CardTitle>
              <CardDescription>
                Hospital identity and contact details visible to administrators.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar className="h-20 w-20 border-2 border-border">
                  <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">
                    {profile.fullName
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase() || "DA"}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Profile photo</p>
                  <p className="text-xs text-muted-foreground">
                    PNG or JPG, max 2 MB (mock upload).
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="hover:bg-slate-100"
                    onClick={() =>
                      showToast("Upload started", "Avatar upload action triggered (demo mode).")
                    }
                  >
                    Upload new picture
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="full-name">Full name</Label>
                  <Input
                    id="full-name"
                    value={profile.fullName}
                    onChange={(e) => updateProfile("fullName", e.target.value)}
                    className="bg-background border-border"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => updateProfile("email", e.target.value)}
                    className="bg-background border-border"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={profile.role}
                    disabled
                    className="bg-muted/60 border-border text-muted-foreground"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    value={profile.phone}
                    onChange={(e) => updateProfile("phone", e.target.value)}
                    className="bg-background border-border"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4">
              <AlertDialog open={logoutAlertOpen} onOpenChange={setLogoutAlertOpen}>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive">
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sign out from this account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You will be returned to the login page and need to sign in again to access the
                      manager dashboard.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        persistProfileBeforeLogout();
                        logout();
                        toast.success("Signed out", {
                          description: "You are now back at the login screen.",
                        });
                      }}
                    >
                      Yes, sign out
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                type="button"
                onClick={() => {
                  const nextProfile = readFormProfile();
                  setProfile(nextProfile);
                }}
              >
                Save profile
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-0 focus-visible:outline-none">
          <Card className="border-border bg-surface shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold tracking-tight">Notifications</CardTitle>
              <CardDescription>
                Control which PIMIS alerts reach your inbox and devices.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0">
              <div className="flex flex-col gap-4 py-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 pr-4">
                  <Label htmlFor="toggle-low-stock" className="text-base">
                    Low Stock Alerts
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Email and in-app banners when SKUs fall below safety stock.
                  </p>
                </div>
                <Switch
                  id="toggle-low-stock"
                  checked={lowStockAlerts}
                  onCheckedChange={setLowStockAlerts}
                  className="shrink-0"
                />
              </div>
              <Separator className="my-4" />
              <div className="flex flex-col gap-4 py-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 pr-4">
                  <Label htmlFor="toggle-draft-po" className="text-base">
                    Smart Restocking / Draft PO Alerts
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when AI draft purchase orders need pharmacist review.
                  </p>
                </div>
                <Switch
                  id="toggle-draft-po"
                  checked={draftPoAlerts}
                  onCheckedChange={setDraftPoAlerts}
                  className="shrink-0"
                />
              </div>
              <Separator className="my-4" />
              <div className="flex flex-col gap-4 py-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 pr-4">
                  <Label htmlFor="toggle-weekly" className="text-base">
                    Weekly Analytics
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Summary digest every Monday at 07:00 WIB.
                  </p>
                </div>
                <Switch
                  id="toggle-weekly"
                  checked={weeklyAnalytics}
                  onCheckedChange={setWeeklyAnalytics}
                  className="shrink-0"
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end border-t border-border bg-muted/20 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                className="hover:bg-slate-100"
                onClick={() =>
                  showToast("Preferences reset", "Notification settings reset was triggered.")
                }
              >
                Reset to defaults
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-0 focus-visible:outline-none">
          <Card className="border-border bg-surface shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold tracking-tight">Security & Access</CardTitle>
              <CardDescription>
                Password hygiene and session visibility for this account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Change password</h3>
                <div className="grid max-w-lg gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="current-password">Current password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="bg-background border-border"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-password">New password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="bg-background border-border"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirm-password">Confirm new password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-background border-border"
                    />
                  </div>
                  <div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        showToast("Password update", "Password update request submitted (demo).")
                      }
                    >
                      Update password
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 pr-4">
                  <Label htmlFor="toggle-2fa" className="text-base">
                    Two-Factor Authentication (2FA)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Require OTP from your authenticator app on each new device login.
                  </p>
                </div>
                <Switch
                  id="toggle-2fa"
                  checked={twoFactorEnabled}
                  onCheckedChange={setTwoFactorEnabled}
                  className="shrink-0"
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Active sessions</h3>
                <ul className="space-y-2 rounded-lg border border-border bg-muted/20 p-4">
                  {sessions.length === 0 ? (
                    <li className="text-sm text-muted-foreground">No active sessions found.</li>
                  ) : (
                    sessions.map((session, index) => (
                      <li
                        key={session.id}
                        className="flex flex-col gap-0.5 border-b border-border pb-3 text-sm last:border-0 last:pb-0 pt-3 first:pt-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {session.device} · {session.browser}
                          </span>
                          {session.isCurrent ? (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                              Current
                            </span>
                          ) : null}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {session.location} · Last active{" "}
                          {formatSessionLastActive(session.lastActiveAt)}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
