"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlowButton } from "@/components/animations";
import {
  X, Key, Globe, Database, Search, Settings, Check,
  Eye, EyeOff, Zap, Brain, Sparkles, Server, Wand2, ChevronDown
} from "lucide-react";

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) ||
  "http://localhost:8001/api";

type SettingsData = {
  ollama_base_url: string;
  searxng_base_url: string;
  comfyui_base_url: string;
  brave_api_key_set: boolean;
  perplexity_api_key_set: boolean;
  default_model: string;
  search_provider_order: string[];
};

type ProviderStatus = {
  name: string;
  label: string;
  icon: React.ReactNode;
  available: boolean | null;
  color: string;
};

type SectionId = "general" | "api" | "services" | "search";

type SettingsPanelProps = {
  open: boolean;
  onClose: () => void;
};

// Animated toggle switch
function ToggleSwitch({ enabled, onChange, label, description }: { enabled: boolean; onChange: () => void; label?: string; description?: string }) {
  return (
    <div className="flex items-start gap-4">
      <button
        onClick={onChange}
        className="relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 focus:outline-none"
        style={{ backgroundColor: enabled ? "rgba(6, 182, 212, 0.3)" : "rgba(255,255,255,0.1)" }}
        aria-label={label}
      >
        <motion.div
          className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-md"
          animate={{ x: enabled ? 26 : 4 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="text-sm font-medium text-slate-200">{label}</span>}
          {description && <span className="text-xs text-slate-500 mt-0.5">{description}</span>}
        </div>
      )}
    </div>
  );
}

// Redesigned input with integrated focus state
function StyledInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  isSet = false,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  isSet?: boolean;
  icon?: React.ReactNode;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [showValue, setShowValue] = useState(false);
  const [hasContent, setHasContent] = useState(value.length > 0);

  const isPassword = type === "password";

  useEffect(() => {
    setHasContent(value.length > 0);
  }, [value]);

  return (
    <div className="relative group">
      <div className="flex items-center justify-between mb-2">
        <label className={`text-xs font-medium transition-colors duration-200 ${isFocused ? "text-cyan-400" : "text-slate-400"}`}>
          {label}
        </label>
        {isSet && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            <Check className="h-3 w-3" />
            Set
          </span>
        )}
      </div>

      <div
        className={`relative flex items-center rounded-xl border bg-white/[0.03] transition-all duration-200 ${
          isFocused
            ? "border-cyan-500/40 bg-white/[0.05]"
            : "border-white/[0.08] hover:border-white/[0.12] hover:bg-white/[0.04]"
        }`}
      >
        {icon && (
          <div className={`pl-3 transition-colors duration-200 ${isFocused ? "text-cyan-400/70" : "text-slate-500"}`}>
            {icon}
          </div>
        )}

        <input
          type={isPassword && !showValue ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="w-full bg-transparent px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
        />

        {isPassword && hasContent && (
          <button
            type="button"
            onClick={() => setShowValue(!showValue)}
            className="mr-2 rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}

        <motion.div
          className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500/60 via-violet-500/60 to-cyan-500/60"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: isFocused ? 1 : 0, opacity: isFocused ? 1 : 0 }}
          transition={{ duration: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
          style={{ originX: 0.5 }}
        />
      </div>
    </div>
  );
}

// Accordion Section Component
function AccordionSection({
  id,
  title,
  icon,
  description,
  isOpen,
  onToggle,
  children,
}: {
  id: SectionId;
  title: string;
  icon: React.ReactNode;
  description: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border transition-colors duration-200 ${
      isOpen ? "border-cyan-500/30 bg-white/[0.04]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]"
    }`}>
      {/* Header - Always visible, clickable to toggle */}
      <motion.button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left"
        whileTap={{ scale: 0.99 }}
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
            isOpen 
              ? "bg-gradient-to-br from-cyan-500/30 to-violet-500/30 text-cyan-400" 
              : "bg-white/[0.05] text-slate-400"
          }`}>
            {icon}
          </div>
          <div>
            <h3 className={`font-semibold transition-colors ${isOpen ? "text-cyan-300" : "text-slate-200"}`}>
              {title}
            </h3>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        </div>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            isOpen ? "bg-cyan-500/20 text-cyan-400" : "bg-white/[0.05] text-slate-500"
          }`}
        >
          <ChevronDown className="h-5 w-5" />
        </motion.div>
      </motion.button>

      {/* Content - Expandable */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
          >
            <div className="border-t border-white/[0.06] p-4 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const [openSections, setOpenSections] = useState<Set<SectionId>>(new Set(["general"]));
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [braveKey, setBraveKey] = useState("");
  const [perplexityKey, setPerplexityKey] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [searxngUrl, setSearxngUrl] = useState("");
  const [comfyuiUrl, setComfyuiUrl] = useState("");
  const [defaultModel, setDefaultModel] = useState("auto");
  const [smartRouting, setSmartRouting] = useState(true);

  const [providers, setProviders] = useState<ProviderStatus[]>([]);

  const toggleSection = (id: SectionId) => {
    setOpenSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/settings`);
      if (res.ok) {
        const data: SettingsData = await res.json();
        setSettings(data);
        setOllamaUrl(data.ollama_base_url);
        setSearxngUrl(data.searxng_base_url);
        setComfyuiUrl(data.comfyui_base_url);
        setDefaultModel(data.default_model);
        setBraveKey("");
        setPerplexityKey("");

        setProviders([
          { name: "brave", label: "Brave Search", icon: <Zap className="h-4 w-4" />, available: data.brave_api_key_set ? true : false, color: "text-orange-400" },
          { name: "perplexity", label: "Perplexity", icon: <Brain className="h-4 w-4" />, available: data.perplexity_api_key_set ? true : false, color: "text-cyan-400" },
          { name: "duckduckgo", label: "DuckDuckGo", icon: <Search className="h-4 w-4" />, available: true, color: "text-emerald-400" },
          { name: "searxng", label: "SearXNG", icon: <Globe className="h-4 w-4" />, available: null, color: "text-purple-400" },
        ]);
      }
    } catch {
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchSettings();
      setError(null);
      setSuccess(false);
    }
  }, [open, fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    const updates: Record<string, any> = {};
    if (ollamaUrl !== settings?.ollama_base_url) updates.ollama_base_url = ollamaUrl;
    if (searxngUrl !== settings?.searxng_base_url) updates.searxng_base_url = searxngUrl;
    if (comfyuiUrl !== settings?.comfyui_base_url) updates.comfyui_base_url = comfyuiUrl;
    if (defaultModel !== settings?.default_model) updates.default_model = defaultModel;
    if (braveKey) updates.brave_api_key = braveKey;
    if (perplexityKey) updates.perplexity_api_key = perplexityKey;

    if (Object.keys(updates).length === 0) {
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data: SettingsData = await res.json();
        setSettings(data);
        setBraveKey("");
        setPerplexityKey("");
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError("Failed to save settings");
      }
    } catch {
      setError("Failed to connect to backend");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Panel - Single Column Accordion */}
      <motion.div
        className="relative z-10 ml-auto h-full w-full max-w-md flex-col border-l border-white/[0.08] bg-[#0a0a0f] shadow-2xl flex"
        initial={{ x: "100%", opacity: 0.9 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0.9 }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20">
              <Settings className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Settings</h2>
              <p className="text-[11px] text-slate-500">Configure BeastAI</p>
            </div>
          </div>
          <motion.button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <X className="h-5 w-5" />
          </motion.button>
        </div>

        {/* Accordion Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl bg-white/[0.05] animate-pulse"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          ) : (
            <>
              {/* General Section */}
              <AccordionSection
                id="general"
                title="General"
                icon={<Settings className="h-5 w-5" />}
                description="Model & routing"
                isOpen={openSections.has("general")}
                onToggle={() => toggleSection("general")}
              >
                <StyledInput
                  label="Default Model"
                  value={defaultModel}
                  onChange={setDefaultModel}
                  placeholder="auto"
                  icon={<Sparkles className="h-4 w-4" />}
                />
                <p className="text-[11px] text-slate-500 -mt-2">
                  Use &quot;auto&quot; for intelligent routing or specify a model
                </p>

                <div className="pt-3 border-t border-white/[0.04]">
                  <ToggleSwitch
                    enabled={smartRouting}
                    onChange={() => setSmartRouting(!smartRouting)}
                    label="Smart Routing"
                    description="Auto-select the best model"
                  />
                </div>
              </AccordionSection>

              {/* API Keys Section */}
              <AccordionSection
                id="api"
                title="API Keys"
                icon={<Key className="h-5 w-5" />}
                description="Brave, Perplexity"
                isOpen={openSections.has("api")}
                onToggle={() => toggleSection("api")}
              >
                <StyledInput
                  label="Brave Search API Key"
                  value={braveKey}
                  onChange={setBraveKey}
                  type="password"
                  isSet={settings?.brave_api_key_set}
                  placeholder={settings?.brave_api_key_set ? "••••••••" : "Enter API key"}
                  icon={<Zap className="h-4 w-4" />}
                />

                <StyledInput
                  label="Perplexity API Key"
                  value={perplexityKey}
                  onChange={setPerplexityKey}
                  type="password"
                  isSet={settings?.perplexity_api_key_set}
                  placeholder={settings?.perplexity_api_key_set ? "••••••••" : "Enter API key"}
                  icon={<Brain className="h-4 w-4" />}
                />
              </AccordionSection>

              {/* Services Section */}
              <AccordionSection
                id="services"
                title="Services"
                icon={<Server className="h-5 w-5" />}
                description="Ollama, SearXNG, ComfyUI"
                isOpen={openSections.has("services")}
                onToggle={() => toggleSection("services")}
              >
                <StyledInput
                  label="Ollama URL"
                  value={ollamaUrl}
                  onChange={setOllamaUrl}
                  placeholder="http://localhost:11434"
                  icon={<Server className="h-4 w-4" />}
                />

                <StyledInput
                  label="SearXNG URL"
                  value={searxngUrl}
                  onChange={setSearxngUrl}
                  placeholder="http://localhost:8080"
                  icon={<Globe className="h-4 w-4" />}
                />

                <StyledInput
                  label="ComfyUI URL"
                  value={comfyuiUrl}
                  onChange={setComfyuiUrl}
                  placeholder="http://localhost:8188"
                  icon={<Wand2 className="h-4 w-4" />}
                />
              </AccordionSection>

              {/* Search Section */}
              <AccordionSection
                id="search"
                title="Search"
                icon={<Search className="h-5 w-5" />}
                description="Search providers"
                isOpen={openSections.has("search")}
                onToggle={() => toggleSection("search")}
              >
                <div className="space-y-2">
                  {providers.map((p) => (
                    <motion.div
                      key={p.name}
                      className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3"
                      whileHover={{ borderColor: "rgba(255,255,255,0.1)" }}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`${p.color}`}>{p.icon}</div>
                        <span className="text-sm text-slate-200">{p.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${
                          p.available === null ? "text-slate-500" :
                          p.available ? "text-emerald-400" : "text-red-400"
                        }`}>
                          {p.available === null ? "Unknown" : p.available ? "Active" : "Inactive"}
                        </span>
                        <div
                          className={`h-2 w-2 rounded-full ${
                            p.available === null ? "bg-slate-500" :
                            p.available ? "bg-emerald-400" : "bg-red-400"
                          }`}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </AccordionSection>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <AnimatePresence>
            {error && (
              <motion.div
                className="mb-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <X className="h-3.5 w-3.5" />
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Check className="h-3.5 w-3.5" />
                Settings saved successfully
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3">
            <motion.button
              onClick={onClose}
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/[0.05]"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              Cancel
            </motion.button>
            <GlowButton
              onClick={handleSave}
              disabled={saving || loading}
              className="flex-1"
              variant="primary"
            >
              {saving ? "Saving..." : "Save Settings"}
            </GlowButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
