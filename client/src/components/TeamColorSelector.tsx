import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TEAM_PALETTES, useTeamTheme } from "@/contexts/TeamThemeContext";
import { Palette, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function TeamColorSelector() {
  const { schoolName, primaryColor, secondaryColor, saveTheme, saving } = useTeamTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ schoolName, primaryColor, secondaryColor });

  useEffect(() => {
    setDraft({ schoolName, primaryColor, secondaryColor });
  }, [schoolName, primaryColor, secondaryColor]);

  const applyPalette = (primary: string, secondary: string) => {
    setDraft((current) => ({ ...current, primaryColor: primary, secondaryColor: secondary }));
  };

  const save = async () => {
    try {
      await saveTheme(draft);
      toast.success("Team colors are live across TacticalEdge.");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save team colors");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-sidebar-foreground/75 hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:px-2" title="Customize team colors">
          <Palette className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">Theme</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[330px] border-blue-100 p-4 shadow-2xl">
        <div className="mb-4">
          <p className="font-display font-bold text-base">Make TacticalEdge yours</p>
          <p className="text-xs text-muted-foreground mt-1">Your school colors power the coaching workspace.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="school-name">School / Program name</Label>
          <Input id="school-name" value={draft.schoolName} onChange={(event) => setDraft((current) => ({ ...current, schoolName: event.target.value }))} placeholder="e.g. Riverside Eagles" />
        </div>
        <div className="mt-4">
          <Label>Quick football palettes</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {TEAM_PALETTES.map((palette) => (
              <button key={palette.name} onClick={() => applyPalette(palette.primary, palette.secondary)} className="rounded-lg border border-border bg-card p-2 text-left transition-transform hover:-translate-y-0.5 hover:border-primary/50">
                <span className="flex h-5 overflow-hidden rounded-md border border-black/10">
                  <span className="w-1/2" style={{ backgroundColor: palette.primary }} />
                  <span className="w-1/2" style={{ backgroundColor: palette.secondary }} />
                </span>
                <span className="block truncate text-[10px] font-semibold mt-1.5">{palette.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="space-y-2">
            <Label htmlFor="primary-color">Primary</Label>
            <div className="flex gap-2">
              <input id="primary-color" type="color" value={draft.primaryColor} onChange={(event) => setDraft((current) => ({ ...current, primaryColor: event.target.value.toUpperCase() }))} className="h-9 w-10 rounded border border-border bg-transparent p-0.5" />
              <Input value={draft.primaryColor} maxLength={7} onChange={(event) => setDraft((current) => ({ ...current, primaryColor: event.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondary-color">Secondary</Label>
            <div className="flex gap-2">
              <input id="secondary-color" type="color" value={draft.secondaryColor} onChange={(event) => setDraft((current) => ({ ...current, secondaryColor: event.target.value.toUpperCase() }))} className="h-9 w-10 rounded border border-border bg-transparent p-0.5" />
              <Input value={draft.secondaryColor} maxLength={7} onChange={(event) => setDraft((current) => ({ ...current, secondaryColor: event.target.value }))} />
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-lg p-3 text-center font-display font-bold text-sm" style={{ background: `linear-gradient(120deg, ${draft.primaryColor}, ${draft.secondaryColor})`, color: "#FFFFFF" }}>
          {draft.schoolName || "Your Program"} Game Day Theme
        </div>
        <Button className="mt-4 w-full gap-2" onClick={save} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? "Saving colors…" : "Save Team Colors"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
