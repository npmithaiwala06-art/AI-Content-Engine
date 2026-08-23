import { Building2, Check, ImagePlus, Palette, Save, Share2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient, uploadClientLogo, updateClient } from "../../services/clients";
import { emptyClientInput, type ClientInput, type PlatformKey } from "../../types/client";

interface ClientFormModalProps {
  clientId?: string;
  initialValue?: ClientInput;
  initialLogo?: string;
  onClose: () => void;
  onSaved: (clientId: string) => void;
}

const steps = [
  { id: "business", label: "Business", icon: Building2 },
  { id: "brand", label: "Brand Profile", icon: Palette },
  { id: "platforms", label: "Platforms", icon: Share2 },
] as const;

type Step = (typeof steps)[number]["id"];
type ListKey = "products" | "services" | "marketingGoals" | "competitors" | "brandPersonality" | "brandColours" | "fonts" | "keywords" | "topicsToAvoid";

const splitList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
const joinList = (value: string[]) => value.join(", ");

function Field({ label, required, hint, children, wide = false }: { label: string; required?: boolean; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`form-field ${wide ? "field-wide" : ""}`}><span>{label}{required && <b> *</b>}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function ClientFormModal({ clientId, initialValue, initialLogo, onClose, onSaved }: ClientFormModalProps) {
  const [step, setStep] = useState<Step>("business");
  const [form, setForm] = useState<ClientInput>(() => structuredClone(initialValue ?? emptyClientInput));
  const [listText, setListText] = useState<Record<ListKey, string>>(() => {
    const source = initialValue ?? emptyClientInput;
    return { products: joinList(source.products), services: joinList(source.services), marketingGoals: joinList(source.marketingGoals), competitors: joinList(source.competitors), brandPersonality: joinList(source.brandPersonality), brandColours: joinList(source.brandColours), fonts: joinList(source.fonts), keywords: joinList(source.keywords), topicsToAvoid: joinList(source.topicsToAvoid) };
  });
  const [logo, setLogo] = useState<File>();
  const [logoPreview, setLogoPreview] = useState(initialLogo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!logo) return;
    const url = URL.createObjectURL(logo);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);

  const title = clientId ? "Edit client" : "Add a new client";
  const brandInitials = useMemo(() => (form.brandName || form.clientName || "New Brand").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(), [form.brandName, form.clientName]);
  const update = <K extends keyof ClientInput>(key: K, value: ClientInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const updateListText = (key: ListKey, value: string) => setListText((current) => ({ ...current, [key]: value }));
  const normalisedForm = (): ClientInput => ({ ...form, products: splitList(listText.products), services: splitList(listText.services), marketingGoals: splitList(listText.marketingGoals), competitors: splitList(listText.competitors), brandPersonality: splitList(listText.brandPersonality), brandColours: splitList(listText.brandColours), fonts: splitList(listText.fonts), keywords: splitList(listText.keywords), topicsToAvoid: splitList(listText.topicsToAvoid) });

  const validateStep = (target: Step) => {
    if (target === "business" && !form.clientName.trim()) return "Client name is required.";
    if (target === "business" && !form.brandName.trim()) return "Brand name is required.";
    if (target === "brand" && !form.brandVoice.trim()) return "Add a brand voice so future ChatGPT prompts remain consistent.";
    return "";
  };

  const goTo = (target: Step) => {
    const currentError = validateStep(step);
    if (currentError) { setError(currentError); return; }
    setError("");
    setStep(target);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const businessError = validateStep("business");
    const brandError = validateStep("brand");
    if (businessError || brandError) { setError(businessError || brandError); setStep(businessError ? "business" : "brand"); return; }
    setSaving(true); setError("");
    try {
      const payload = normalisedForm();
      const id = clientId ?? await createClient(payload);
      if (clientId) await updateClient(clientId, payload);
      if (logo) await uploadClientLogo(id, logo);
      onSaved(id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally { setSaving(false); }
  };

  const togglePlatform = (platform: PlatformKey) => update("mainPlatforms", form.mainPlatforms.includes(platform) ? form.mainPlatforms.filter((item) => item !== platform) : [...form.mainPlatforms, platform]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="client-form-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header"><div><span className="eyebrow">PHASE 2 · LOCAL CLIENT MEMORY</span><h2>{title}</h2><p>Business and brand information stays in SQLite on this Mac.</p></div><button type="button" className="icon-button" aria-label="Close client form" onClick={onClose}><X size={17} /></button></header>
        <div className="form-stepper">{steps.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={step === id ? "active" : ""} onClick={() => goTo(id)}><Icon size={15} /><span>{label}</span>{step === id && <i />}</button>)}</div>
        <form onSubmit={submit}>
          <div className="client-form-scroll">
            {step === "business" && <div className="form-grid">
              <div className="section-intro field-wide"><h3>Client identity</h3><p>The operating details used throughout content, calendar and reporting.</p></div>
              <Field label="Client name" required><input autoFocus value={form.clientName} onChange={(event) => update("clientName", event.target.value)} placeholder="ABC Cafe" /></Field>
              <Field label="Brand name" required><input value={form.brandName} onChange={(event) => update("brandName", event.target.value)} placeholder="ABC Cafe" /></Field>
              <Field label="Company name"><input value={form.companyName} onChange={(event) => update("companyName", event.target.value)} placeholder="ABC Foods Pvt. Ltd." /></Field>
              <Field label="Industry"><input value={form.industry} onChange={(event) => update("industry", event.target.value)} placeholder="Cafe & Restaurant" /></Field>
              <Field label="Website"><input type="url" value={form.website} onChange={(event) => update("website", event.target.value)} placeholder="https://example.com" /></Field>
              <Field label="Location"><input value={form.location} onChange={(event) => update("location", event.target.value)} placeholder="Surat, Gujarat" /></Field>
              <Field label="Business description" wide><textarea rows={3} value={form.businessDescription} onChange={(event) => update("businessDescription", event.target.value)} placeholder="What does this business do and what makes it different?" /></Field>
              <Field label="Products" hint="Separate items with commas"><input value={listText.products} onChange={(event) => updateListText("products", event.target.value)} placeholder="Coffee, Cold brews, Breakfast bowls" /></Field>
              <Field label="Services" hint="Separate items with commas"><input value={listText.services} onChange={(event) => updateListText("services", event.target.value)} placeholder="Dine-in, Takeaway, Events" /></Field>
              <Field label="Target audience" wide><textarea rows={2} value={form.targetAudience} onChange={(event) => update("targetAudience", event.target.value)} placeholder="College students and young professionals in Surat" /></Field>
              <Field label="Marketing goals" hint="Separate goals with commas"><input value={listText.marketingGoals} onChange={(event) => updateListText("marketingGoals", event.target.value)} placeholder="Increase visits, Grow awareness" /></Field>
              <Field label="Competitors" hint="Separate names with commas"><input value={listText.competitors} onChange={(event) => updateListText("competitors", event.target.value)} placeholder="Competitor A, Competitor B" /></Field>
              <Field label="Posting frequency"><input value={form.postingFrequency} onChange={(event) => update("postingFrequency", event.target.value)} placeholder="4 posts per week" /></Field>
              <Field label="Client status"><select value={form.status} onChange={(event) => update("status", event.target.value as ClientInput["status"])}><option value="active">Active</option><option value="paused">Paused</option></select></Field>
            </div>}

            {step === "brand" && <div className="form-grid">
              <div className="section-intro field-wide"><h3>Persistent Brand Profile</h3><p>This memory is automatically available to the future ChatGPT prompt builder.</p></div>
              <div className="logo-uploader field-wide">
                <div className="logo-preview">{logoPreview ? <img src={logoPreview} alt="Brand logo preview" /> : <span>{brandInitials}</span>}</div>
                <div><strong>Brand logo</strong><p>PNG, JPG, WebP or GIF · maximum 10 MB · stored locally</p><label className="upload-button"><Upload size={14} /> Choose image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setLogo(event.target.files?.[0])} /></label></div>
              </div>
              <Field label="Brand voice" required wide><textarea rows={2} value={form.brandVoice} onChange={(event) => update("brandVoice", event.target.value)} placeholder="Friendly, energetic and local" /></Field>
              <Field label="Brand personality" hint="Separate traits with commas"><input value={listText.brandPersonality} onChange={(event) => updateListText("brandPersonality", event.target.value)} placeholder="Welcoming, Playful, Optimistic" /></Field>
              <Field label="Preferred CTA"><input value={form.preferredCta} onChange={(event) => update("preferredCta", event.target.value)} placeholder="Visit us this weekend" /></Field>
              <Field label="Content style" wide><textarea rows={2} value={form.contentStyle} onChange={(event) => update("contentStyle", event.target.value)} placeholder="Food photography, short reels and offer-led stories" /></Field>
              <Field label="Brand colours" hint="Hex values separated with commas"><input value={listText.brandColours} onChange={(event) => updateListText("brandColours", event.target.value)} placeholder="#6D4AFF, #F59E0B, #FFF7E8" /></Field>
              <Field label="Fonts" hint="Separate fonts with commas"><input value={listText.fonts} onChange={(event) => updateListText("fonts", event.target.value)} placeholder="DM Sans, Manrope" /></Field>
              <Field label="Brand keywords" hint="Used in content prompts"><input value={listText.keywords} onChange={(event) => updateListText("keywords", event.target.value)} placeholder="coffee, Surat cafe, weekend brunch" /></Field>
              <Field label="Topics and language to avoid"><input value={listText.topicsToAvoid} onChange={(event) => updateListText("topicsToAvoid", event.target.value)} placeholder="Formal language, Medical claims" /></Field>
              {splitList(listText.brandColours).length > 0 && <div className="colour-preview field-wide"><span>Colour preview</span><div>{splitList(listText.brandColours).map((colour) => <i key={colour} title={colour} style={{ background: colour }} />)}</div></div>}
            </div>}

            {step === "platforms" && <div className="form-grid">
              <div className="section-intro field-wide"><h3>Main social platforms</h3><p>Select every platform this client plans to use. Connections and credentials are not required in Phase 2.</p></div>
              <div className="platform-selector field-wide">{(["instagram", "facebook", "twitter", "youtube"] as PlatformKey[]).map((platform) => <button type="button" key={platform} className={form.mainPlatforms.includes(platform) ? "selected" : ""} onClick={() => togglePlatform(platform)}><span className={`platform-dot ${platform}`} /><div><strong>{platform[0].toUpperCase() + platform.slice(1)}</strong><small>{form.mainPlatforms.includes(platform) ? "Included in client workspace" : "Not selected"}</small></div>{form.mainPlatforms.includes(platform) && <Check size={16} />}</button>)}</div>
              <div className="platform-note field-wide"><ImagePlus size={18} /><div><strong>No platform credentials are needed now</strong><p>Phase 2 records the client’s intended platforms. OAuth and official publishing connections remain isolated to the later Social Accounts phase.</p></div></div>
            </div>}
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <footer className="modal-footer"><button type="button" className="ghost-button" onClick={onClose}>Cancel</button>{step !== "platforms" ? <button type="button" className="solid-button" onClick={() => goTo(step === "business" ? "brand" : "platforms")}>Continue</button> : <button type="submit" className="solid-button" disabled={saving}><Save size={15} />{saving ? "Saving locally…" : clientId ? "Save changes" : "Create client"}</button>}</footer>
        </form>
      </section>
    </div>
  );
}
