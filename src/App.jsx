import { useEffect, useMemo, useRef, useState } from "react";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const METHODS_WITHOUT_BODY = new Set(["GET", "HEAD"]);
const REQUEST_TABS = ["params", "auth", "headers", "body"];
const RESPONSE_TABS = ["pretty", "raw", "headers"];
const HISTORY_LIMIT = 25;
const DEFAULT_URL = "https://pokeapi.co/api/v2/pokemon/squirtle";

const METHOD_COLORS = {
  GET: "bg-emerald-100 text-emerald-700 border-emerald-200",
  POST: "bg-blue-100 text-blue-700 border-blue-200",
  PUT: "bg-amber-100 text-amber-700 border-amber-200",
  PATCH: "bg-purple-100 text-purple-700 border-purple-200",
  DELETE: "bg-red-100 text-red-700 border-red-200",
};

const THEME_COLORS = [
  { id: "orange", label: "Orange", swatch: "#FF4F00" },
  { id: "purple", label: "Purple", swatch: "#7C3AED" },
  { id: "teal", label: "Teal", swatch: "#0D9488" },
  { id: "red", label: "Red", swatch: "#DC2626" },
  { id: "gray", label: "Gray", swatch: "#6B7280" },
];

const makeId = () => {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const makeRow = (key = "", value = "", enabled = true) => ({
  id: makeId(),
  key,
  value,
  enabled
});

const makeTab = (label = "Request 1") => ({
  id: makeId(),
  label,
  method: "GET",
  url: DEFAULT_URL,
  queryParams: [makeRow("", "", true)],
  bearerToken: "",
  headers: [makeRow("Accept", "application/json")],
  bodyMode: "none",
  bodyText: "",
  formFields: [makeRow("", "")],
  timeoutMs: 15000,
  response: null,
  requestError: "",
  responseSearch: "",
  saveFilename: "response.json",
});

function loadInitialTabs() {
  try {
    const raw = localStorage.getItem("post-corith-tabs");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((tab) => ({
          ...tab,
          response: null,
          requestError: "",
          responseSearch: "",
          saveFilename: tab.saveFilename || "response.json",
        }));
      }
    }
  } catch { /* ignore */ }
  return [makeTab("Request 1")];
}

function App() {
  const [tabs, setTabs] = useState(loadInitialTabs);
  const [activeTabId, setActiveTabId] = useState(() => {
    const t = loadInitialTabs();
    const saved = localStorage.getItem("post-corith-active-tab");
    if (saved && t.some((tab) => tab.id === saved)) return saved;
    return t[0].id;
  });

  const [requestTab, setRequestTab] = useState("auth");
  const [responseTab, setResponseTab] = useState("pretty");
  const [isSending, setIsSending] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFilename, setExportFilename] = useState("post-corith-export.json");
  const importInputRef = useRef(null);

  const [theme, setTheme] = useState(() => localStorage.getItem("post-corith-theme") || "orange");
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("post-corith-dark") === "true");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const colorPickerRef = useRef(null);
  const executeRequestRef = useRef(null);

  const [history, setHistory] = useState(() => {
    try {
      const raw = localStorage.getItem("post-corith-history");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  /* ───── Derived ───── */
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const prettyResponse = useMemo(() => {
    if (!activeTab.response) return "";
    if (activeTab.response.isJson && activeTab.response.json !== null) {
      return JSON.stringify(activeTab.response.json, null, 2);
    }
    return activeTab.response.body || "";
  }, [activeTab.response]);

  const canSendBody = !METHODS_WITHOUT_BODY.has(activeTab.method);

  /* ───── Effects ───── */
  useEffect(() => {
    if (!tabs.some((t) => t.id === activeTabId)) {
      setActiveTabId(tabs[0].id);
    }
  }, [tabs, activeTabId]);

  useEffect(() => {
    const toSave = tabs.map(({ response, requestError, responseSearch, ...rest }) => rest);
    localStorage.setItem("post-corith-tabs", JSON.stringify(toSave));
  }, [tabs]);

  useEffect(() => {
    localStorage.setItem("post-corith-active-tab", activeTabId);
  }, [activeTabId]);

  useEffect(() => {
    localStorage.setItem("post-corith-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("post-corith-dark", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setColorPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        executeRequestRef.current?.();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ───── Tab helpers ───── */
  const updateActiveTab = (field, value) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === activeTabId ? { ...tab, [field]: value } : tab))
    );
  };

  const updateRow = (field, rowId, prop, value) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId
          ? { ...tab, [field]: tab[field].map((row) => (row.id === rowId ? { ...row, [prop]: value } : row)) }
          : tab
      )
    );
  };

  const removeRow = (field, rowId) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        const next = tab[field].filter((row) => row.id !== rowId);
        return { ...tab, [field]: next.length > 0 ? next : [makeRow()] };
      })
    );
  };

  const addRow = (field, ...args) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, [field]: [...tab[field], makeRow(...args)] } : tab
      )
    );
  };

  const addTab = () => {
    const nums = tabs.map((t) => {
      const match = t.label.match(/^Request (\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const nextNum = Math.max(0, ...nums) + 1;
    const newTab = makeTab(`Request ${nextNum}`);
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (tabId) => {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === tabId);
    if (activeTabId === tabId) {
      const adjacent = tabs[idx - 1] || tabs[idx + 1];
      setActiveTabId(adjacent.id);
    }
    setTabs((prev) => prev.filter((t) => t.id !== tabId));
  };

  /* ───── Request helpers ───── */
  const normalizeUrl = (nextUrl) => {
    const trimmed = nextUrl.trim();
    if (!trimmed) throw new Error("URL is required.");
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `http://${trimmed}`;
  };

  const createPayload = (tab) => {
    const normalizedUrl = normalizeUrl(tab.url);
    const parsedUrl = new URL(normalizedUrl);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("Only HTTP(S) protocols are supported.");
    }

    for (const row of tab.queryParams) {
      const key = row.key.trim();
      if (!row.enabled || !key) continue;
      parsedUrl.searchParams.set(key, row.value);
    }

    const nextHeaders = {};
    for (const row of tab.headers) {
      const key = row.key.trim();
      if (!row.enabled || !key) continue;
      nextHeaders[key] = row.value;
    }

    if (tab.bearerToken.trim()) {
      nextHeaders.Authorization = `Bearer ${tab.bearerToken.trim()}`;
    }

    const canSend = !METHODS_WITHOUT_BODY.has(tab.method);
    let body = null;

    if (canSend && tab.bodyMode !== "none") {
      if (tab.bodyMode === "json") {
        const candidate = tab.bodyText.trim();
        if (candidate) {
          try {
            JSON.parse(candidate);
          } catch {
            throw new Error("Body is not valid JSON.");
          }
          body = candidate;
        } else {
          body = "";
        }
        if (!Object.keys(nextHeaders).some((k) => k.toLowerCase() === "content-type")) {
          nextHeaders["Content-Type"] = "application/json";
        }
      }

      if (tab.bodyMode === "raw") {
        body = tab.bodyText;
      }

      if (tab.bodyMode === "form") {
        const params = new URLSearchParams();
        for (const row of tab.formFields) {
          if (row.key.trim()) params.set(row.key, row.value);
        }
        body = params.toString();
        if (!Object.keys(nextHeaders).some((k) => k.toLowerCase() === "content-type")) {
          nextHeaders["Content-Type"] = "application/x-www-form-urlencoded";
        }
      }
    }

    return {
      method: tab.method,
      url: parsedUrl.toString(),
      headers: nextHeaders,
      body,
      timeoutMs: tab.timeoutMs
    };
  };

  const pushHistory = (snapshot) => {
    setHistory((prev) => {
      const next = [snapshot, ...prev].slice(0, HISTORY_LIMIT);
      localStorage.setItem("post-corith-history", JSON.stringify(next));
      return next;
    });
  };

  const executeRequest = async () => {
    const tabId = activeTabId;
    const tab = tabs.find((t) => t.id === tabId) || tabs[0];

    const setTabField = (field, value) => {
      setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, [field]: value } : t)));
    };

    setTabField("requestError", "");
    setIsSending(true);

    let payload;
    try {
      payload = createPayload(tab);
    } catch (error) {
      setIsSending(false);
      setTabField("response", null);
      setTabField("requestError", error.message || "Unable to prepare request.");
      return;
    }

    try {
      const res = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Request failed.");
      }

      setTabField("response", data);
      setResponseTab(data.isJson ? "pretty" : "raw");

      pushHistory({
        id: makeId(),
        timestamp: new Date().toISOString(),
        method: tab.method,
        url: payload.url,
        status: data.status,
        elapsedMs: data.elapsedMs,
        request: {
          method: tab.method,
          url: tab.url,
          queryParams: tab.queryParams,
          bearerToken: tab.bearerToken,
          headers: tab.headers,
          bodyMode: tab.bodyMode,
          bodyText: tab.bodyText,
          formFields: tab.formFields,
          timeoutMs: tab.timeoutMs
        }
      });
    } catch (error) {
      setTabField("response", null);
      setTabField("requestError", error.message || "Unable to send request.");
    } finally {
      setIsSending(false);
    }
  };
  executeRequestRef.current = executeRequest;

  const loadFromHistory = (item) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        return {
          ...tab,
          method: item.request.method,
          url: item.request.url,
          queryParams: (item.request.queryParams || [makeRow()]).map((row) => ({ ...row, id: makeId() })),
          bearerToken: item.request.bearerToken,
          headers: item.request.headers.map((row) => ({ ...row, id: makeId() })),
          bodyMode: item.request.bodyMode,
          bodyText: item.request.bodyText,
          formFields: item.request.formFields.map((row) => ({ ...row, id: makeId() })),
          timeoutMs: item.request.timeoutMs ?? 15000,
        };
      })
    );
    setRequestTab("auth");
  };

  const clearAll = () => {
    const fresh = makeTab(activeTab.label);
    fresh.id = activeTab.id;
    setTabs((prev) => prev.map((t) => (t.id === activeTabId ? fresh : t)));
  };

  const handleExport = () => {
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tabs: tabs.map(({ response, requestError, responseSearch, ...rest }) => rest),
      activeTabId,
      history,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFilename || "post-corith-export.json";
    a.click();
    URL.revokeObjectURL(url);
    setExportModalOpen(false);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (data.tabs && Array.isArray(data.tabs) && data.tabs.length > 0) {
          const imported = data.tabs.map((tab) => ({
            ...tab,
            response: null,
            requestError: "",
            responseSearch: "",
            saveFilename: tab.saveFilename || "response.json",
          }));
          setTabs(imported);
          const nextActive = data.activeTabId && imported.some((t) => t.id === data.activeTabId)
            ? data.activeTabId
            : imported[0].id;
          setActiveTabId(nextActive);
        }
        if (data.history && Array.isArray(data.history)) {
          setHistory(data.history);
          localStorage.setItem("post-corith-history", JSON.stringify(data.history));
        }
      } catch {
        /* ignore malformed files */
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className={`min-h-screen bg-surface-100 text-ink transition-colors duration-200${darkMode ? " dark" : ""}`} data-theme={theme}>
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-8">

        {/* Header */}
        <header className="mb-4 rounded-2xl bg-card px-6 py-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-dark shadow-btn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg font-bold tracking-tight text-ink">Post Corith</h1>
                  <p className="text-xs font-medium text-ink-muted">Ya Dig?</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-9 rounded-lg border border-surface-300 bg-card px-4 text-sm font-medium text-ink-light shadow-btn hover:shadow-btn-hover hover:border-surface-400 active:shadow-btn-active"
                onClick={clearAll}
              >
                Reset
              </button>
              <button
                type="button"
                className="h-9 rounded-lg border border-surface-300 bg-card px-4 text-sm font-medium text-ink-light shadow-btn hover:shadow-btn-hover hover:border-surface-400 active:shadow-btn-active"
                onClick={() => {
                  setHistory([]);
                  localStorage.removeItem("post-corith-history");
                }}
              >
                Clear History
              </button>

              <button
                type="button"
                className="h-9 rounded-lg border border-surface-300 bg-card px-4 text-sm font-medium text-ink-light shadow-btn hover:shadow-btn-hover hover:border-surface-400 active:shadow-btn-active"
                onClick={() => setExportModalOpen(true)}
              >
                Export
              </button>
              <button
                type="button"
                className="h-9 rounded-lg border border-surface-300 bg-card px-4 text-sm font-medium text-ink-light shadow-btn hover:shadow-btn-hover hover:border-surface-400 active:shadow-btn-active"
                onClick={() => importInputRef.current?.click()}
              >
                Import
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />

              {/* Color Theme Picker */}
              <div className="relative" ref={colorPickerRef}>
                <button
                  type="button"
                  onClick={() => setColorPickerOpen((prev) => !prev)}
                  className="flex h-9 items-center gap-2 rounded-lg border border-surface-300 bg-card px-3 text-sm font-medium text-ink-light shadow-btn hover:shadow-btn-hover hover:border-surface-400 active:shadow-btn-active"
                >
                  <span
                    className="inline-block h-4 w-4 rounded-full shadow-inset"
                    style={{ backgroundColor: THEME_COLORS.find((c) => c.id === theme)?.swatch }}
                  />
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 4.5L6 7.5L9 4.5" />
                  </svg>
                </button>
                {colorPickerOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-44 rounded-xl border border-surface-200 bg-card p-2 shadow-card">
                    {THEME_COLORS.map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => { setTheme(color.id); setColorPickerOpen(false); }}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                          theme === color.id
                            ? "bg-surface-100 font-semibold text-ink"
                            : "text-ink-light hover:bg-surface-50"
                        }`}
                      >
                        <span
                          className="inline-block h-4 w-4 rounded-full shadow-btn"
                          style={{ backgroundColor: color.swatch }}
                        />
                        {color.label}
                        {theme === color.id && (
                          <svg className="ml-auto" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20,6 9,17 4,12" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dark Mode Toggle */}
              <button
                type="button"
                onClick={() => setDarkMode((prev) => !prev)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-300 bg-card text-ink-light shadow-btn hover:shadow-btn-hover hover:border-surface-400 active:shadow-btn-active"
                title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {darkMode ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* ───── Request Tabs Bar ───── */}
        <div className="mb-6 rounded-2xl bg-card px-4 py-3 shadow-card">
          {/* Desktop: horizontal pills */}
          <div className="hidden xl:flex items-center gap-2 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTabId(tab.id)}
                className={`group flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  tab.id === activeTabId
                    ? "border-2 border-accent bg-accent-glow text-accent-dark shadow-btn"
                    : "border border-surface-300 bg-surface-50 text-ink-light hover:border-surface-400 hover:bg-surface-100"
                }`}
              >
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold leading-none ${METHOD_COLORS[tab.method] || "bg-surface-100 text-ink-light border-surface-200"}`}>
                  {tab.method}
                </span>
                <span className="max-w-[160px] truncate text-xs">
                  {tab.url ? tab.url.replace(/^https?:\/\//, "") : tab.label}
                </span>
                {tabs.length > 1 && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); closeTab(tab.id); } }}
                    className="ml-0.5 rounded p-0.5 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger hover:bg-danger-bg"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </span>
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={addTab}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-dashed border-surface-300 text-ink-muted hover:border-accent hover:text-accent hover:bg-accent-glow transition-colors"
              title="New request tab"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {/* Mobile: dropdown */}
          <div className="flex xl:hidden items-center gap-2">
            <select
              value={activeTabId}
              onChange={(e) => setActiveTabId(e.target.value)}
              className="flex-1 rounded-lg border border-surface-300 bg-surface-50 px-3 py-2 text-sm font-medium shadow-inset"
            >
              {tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.method} {tab.url ? tab.url.replace(/^https?:\/\//, "").slice(0, 40) : tab.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addTab}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-surface-300 text-ink-muted hover:border-accent hover:text-accent hover:bg-accent-glow transition-colors"
              title="New request tab"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            {tabs.length > 1 && (
              <button
                type="button"
                onClick={() => closeTab(activeTabId)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-surface-300 text-ink-muted hover:border-danger hover:text-danger hover:bg-danger-bg transition-colors"
                title="Close current tab"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="space-y-6">

            {/* Request Builder */}
            <div className="rounded-2xl bg-card shadow-card overflow-hidden">
              {/* URL Bar */}
              <div className="flex flex-wrap gap-2 p-4">
                <select
                  value={activeTab.method}
                  onChange={(e) => updateActiveTab("method", e.target.value)}
                  className="min-w-[110px] rounded-lg border border-surface-300 bg-surface-50 px-3 py-2.5 text-sm font-bold shadow-inset"
                >
                  {HTTP_METHODS.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={activeTab.url}
                  onChange={(e) => updateActiveTab("url", e.target.value)}
                  placeholder="https://api.example.com/users"
                  className="min-w-[240px] flex-1 rounded-lg border border-surface-300 bg-surface-50 px-4 py-2.5 text-sm shadow-inset placeholder:text-ink-muted"
                />
                <button
                  type="button"
                  className="rounded-lg bg-gradient-to-b from-accent-light to-accent px-6 py-2.5 text-sm font-bold text-white shadow-btn hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60 active:shadow-btn-active"
                  disabled={isSending}
                  onClick={executeRequest}
                >
                  {isSending ? "Sending..." : "Send"}
                </button>
              </div>

              {/* Timeout */}
              <div className="flex flex-wrap items-center gap-3 border-t border-surface-200 px-4 py-2.5 text-sm">
                <label htmlFor="timeout" className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Timeout
                </label>
                <input
                  id="timeout"
                  type="number"
                  min={500}
                  max={120000}
                  value={activeTab.timeoutMs}
                  onChange={(e) => updateActiveTab("timeoutMs", Number(e.target.value) || 500)}
                  className="w-28 rounded-lg border border-surface-300 bg-surface-50 px-3 py-1.5 text-sm shadow-inset"
                />
                <span className="text-xs text-ink-muted">ms &middot; via local proxy</span>
              </div>

              {/* Request Section Tabs */}
              <div className="border-t border-surface-200 px-4 pt-3">
                <div className="flex gap-1">
                  {REQUEST_TABS.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setRequestTab(tab)}
                      className={`rounded-t-lg px-4 py-2 text-sm font-medium capitalize transition-all ${
                        requestTab === tab
                          ? "bg-surface-100 text-accent-dark shadow-raised border border-b-0 border-surface-200"
                          : "text-ink-muted hover:text-ink-light hover:bg-surface-50"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="border-t border-surface-200 bg-surface-50 p-4">
                {requestTab === "params" && (
                  <KeyValueEditor
                    rows={activeTab.queryParams}
                    onAdd={() => addRow("queryParams", "", "", true)}
                    onChange={(id, field, value) => updateRow("queryParams", id, field, value)}
                    onRemove={(id) => removeRow("queryParams", id)}
                    title="Query Parameters"
                    enableToggle
                    keyLabel="Param"
                  />
                )}

                {requestTab === "auth" && (
                  <div className="space-y-3">
                    <p className="text-sm text-ink-light">
                      Auth mode: <span className="font-semibold text-ink">Bearer Token</span>
                    </p>
                    <input
                      type="text"
                      value={activeTab.bearerToken}
                      onChange={(e) => updateActiveTab("bearerToken", e.target.value)}
                      placeholder="Paste bearer token"
                      className="w-full rounded-lg border border-surface-300 bg-card px-4 py-2.5 text-sm shadow-inset placeholder:text-ink-muted"
                    />
                    <p className="text-xs text-ink-muted">
                      Adds `Authorization: Bearer &lt;token&gt;` header automatically.
                    </p>
                  </div>
                )}

                {requestTab === "headers" && (
                  <KeyValueEditor
                    rows={activeTab.headers}
                    onAdd={() => addRow("headers")}
                    onChange={(id, field, value) => updateRow("headers", id, field, value)}
                    onRemove={(id) => removeRow("headers", id)}
                    title="Request Headers"
                    enableToggle
                  />
                )}

                {requestTab === "body" && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: "none", label: "None" },
                        { id: "json", label: "JSON" },
                        { id: "raw", label: "Raw" },
                        { id: "form", label: "Form URL Encoded" }
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          disabled={!canSendBody}
                          onClick={() => updateActiveTab("bodyMode", mode.id)}
                          className={`rounded-lg border px-4 py-2 text-sm font-medium shadow-btn ${
                            activeTab.bodyMode === mode.id
                              ? "border-accent bg-accent-glow text-accent-dark"
                              : "border-surface-300 bg-card text-ink-light hover:border-surface-400"
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>

                    {!canSendBody && (
                      <div className="rounded-lg border border-warning-light bg-warning-bg px-4 py-3 text-sm text-amber-800">
                        `{activeTab.method}` requests do not include a body.
                      </div>
                    )}

                    {canSendBody && (activeTab.bodyMode === "json" || activeTab.bodyMode === "raw") && (
                      <textarea
                        value={activeTab.bodyText}
                        onChange={(e) => updateActiveTab("bodyText", e.target.value)}
                        className="h-52 w-full rounded-lg border border-surface-300 bg-card p-4 font-mono text-sm shadow-inset placeholder:text-ink-muted"
                        spellCheck={false}
                        placeholder={activeTab.bodyMode === "json" ? '{\n  "name": "Ada"\n}' : "Raw text payload"}
                      />
                    )}

                    {canSendBody && activeTab.bodyMode === "form" && (
                      <KeyValueEditor
                        rows={activeTab.formFields}
                        onAdd={() => addRow("formFields")}
                        onChange={(id, field, value) => updateRow("formFields", id, field, value)}
                        onRemove={(id) => removeRow("formFields", id)}
                        title="Form Fields"
                        keyLabel="Field"
                        valueLabel="Value"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Response Panel */}
            <div className="rounded-2xl bg-card shadow-card overflow-hidden">
              <div className="px-5 py-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-ink">Response</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={activeTab.response?.status} />
                    <MetaPill label="Time" value={activeTab.response ? `${activeTab.response.elapsedMs} ms` : "--"} />
                    <MetaPill label="Size" value={activeTab.response ? `${activeTab.response.sizeBytes} B` : "--"} />
                  </div>
                </div>
                {activeTab.response && (
                  <div className="flex items-center gap-2 max-w-[50%]">
                    <input
                      type="text"
                      value={activeTab.saveFilename}
                      onChange={(e) => updateActiveTab("saveFilename", e.target.value)}
                      className="flex-1 rounded-lg border border-surface-300 bg-surface-50 px-3 py-1.5 text-sm shadow-inset"
                    />
                    <button
                      type="button"
                      onClick={() => downloadResponse(responseTab === "pretty" ? prettyResponse : activeTab.response.body || "", activeTab.saveFilename)}
                      className="shrink-0 rounded-lg border border-surface-300 bg-card px-4 py-1.5 text-sm font-medium text-ink-light shadow-btn hover:shadow-btn-hover hover:border-surface-400 active:shadow-btn-active"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>

              {/* Response Tabs */}
              <div className="border-t border-surface-200 px-4 pt-3">
                <div className="flex gap-1">
                  {RESPONSE_TABS.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setResponseTab(tab)}
                      className={`rounded-t-lg px-4 py-2 text-sm font-medium capitalize transition-all ${
                        responseTab === tab
                          ? "bg-surface-100 text-accent-dark shadow-raised border border-b-0 border-surface-200"
                          : "text-ink-muted hover:text-ink-light hover:bg-surface-50"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-surface-200 bg-surface-50 p-4">
                {activeTab.requestError && (
                  <div className="mb-3 rounded-lg border border-danger-light bg-danger-bg p-4 text-sm text-red-700">
                    {activeTab.requestError}
                  </div>
                )}

                {!activeTab.requestError && !activeTab.response && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-glow">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
                        <path d="M22 2L11 13" strokeLinecap="round" strokeLinejoin="round" /><path d="M22 2L15 22L11 13L2 9L22 2Z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="text-sm text-ink-muted">Send a request to see the response here</p>
                  </div>
                )}

                {activeTab.response && responseTab === "headers" && (
                  <div className="grid gap-2 text-sm">
                    {Object.entries(activeTab.response.headers).map(([key, value]) => (
                      <div key={key} className="grid grid-cols-[200px_1fr] gap-3 rounded-lg border border-surface-200 bg-card p-3 shadow-raised">
                        <span className="font-mono text-xs font-semibold text-accent-dark">{key}</span>
                        <span className="break-all text-ink-light">{String(value)}</span>
                      </div>
                    ))}
                    {Object.keys(activeTab.response.headers).length === 0 && (
                      <p className="text-sm text-ink-muted">No headers available.</p>
                    )}
                  </div>
                )}

                {activeTab.response && responseTab !== "headers" && (
                  <ResponseBody
                    text={responseTab === "pretty" ? prettyResponse : activeTab.response.body || ""}
                    search={activeTab.responseSearch}
                    onSearchChange={(v) => updateActiveTab("responseSearch", v)}
                  />
                )}
              </div>
            </div>
          </section>

          {/* History Sidebar */}
          <aside className="rounded-2xl bg-card shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-200">
              <h2 className="text-base font-bold text-ink">Recent Requests</h2>
            </div>

            <div className="max-h-[calc(100vh-220px)] overflow-auto p-3">
              {history.length === 0 && (
                <div className="flex flex-col items-center py-8 text-center">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-100">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-muted">
                      <circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" />
                    </svg>
                  </div>
                  <p className="text-sm text-ink-muted">No history yet</p>
                </div>
              )}

              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => loadFromHistory(item)}
                  className="mb-2 w-full rounded-xl border border-surface-200 bg-card p-3.5 text-left shadow-raised transition-all hover:shadow-card-hover hover:border-surface-300"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className={`rounded-md border px-2 py-0.5 text-xs font-bold ${METHOD_COLORS[item.method] || "bg-surface-100 text-ink-light border-surface-200"}`}>
                      {item.method}
                    </span>
                    <span className="text-xs text-ink-muted">{new Date(item.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="line-clamp-2 text-sm text-ink-light">{item.url}</p>
                  <div className="mt-2.5 flex items-center justify-between text-xs text-ink-muted">
                    <StatusDot status={item.status} />
                    <span>{item.elapsedMs} ms</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        </div>

        {/* Export Modal */}
        {exportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setExportModalOpen(false)}>
            <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-4 text-base font-bold text-ink">Export Workspace</h3>
              <p className="mb-3 text-sm text-ink-light">This will export your current tabs and recent request history.</p>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Filename</label>
              <input
                type="text"
                value={exportFilename}
                onChange={(e) => setExportFilename(e.target.value)}
                className="mb-4 w-full rounded-lg border border-surface-300 bg-surface-50 px-4 py-2.5 text-sm shadow-inset placeholder:text-ink-muted"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExportModalOpen(false)}
                  className="h-9 rounded-lg border border-surface-300 bg-card px-4 text-sm font-medium text-ink-light shadow-btn hover:shadow-btn-hover active:shadow-btn-active"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  className="h-9 rounded-lg bg-gradient-to-b from-accent-light to-accent px-5 text-sm font-bold text-white shadow-btn hover:shadow-glow active:shadow-btn-active"
                >
                  Export
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KeyValueEditor({
  rows,
  onAdd,
  onChange,
  onRemove,
  title,
  enableToggle = false,
  keyLabel = "Key",
  valueLabel = "Value"
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg border border-surface-300 bg-card px-3 py-1.5 text-xs font-medium text-ink-light shadow-btn hover:shadow-btn-hover hover:border-surface-400 active:shadow-btn-active"
        >
          + Add Row
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-200 bg-card shadow-raised">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50">
              {enableToggle && <th className="w-14 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">On</th>}
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">{keyLabel}</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">{valueLabel}</th>
              <th className="w-14 px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-surface-100">
                {enableToggle && (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(event) => onChange(row.id, "enabled", event.target.checked)}
                      className="h-4 w-4 rounded"
                    />
                  </td>
                )}
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={row.key}
                    onChange={(event) => onChange(row.id, "key", event.target.value)}
                    placeholder="Content-Type"
                    className="w-full rounded-lg border border-surface-300 bg-surface-50 px-3 py-1.5 text-sm shadow-inset placeholder:text-ink-muted"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={row.value}
                    onChange={(event) => onChange(row.id, "value", event.target.value)}
                    placeholder="application/json"
                    className="w-full rounded-lg border border-surface-300 bg-surface-50 px-3 py-1.5 text-sm shadow-inset placeholder:text-ink-muted"
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onRemove(row.id)}
                    className="rounded-lg border border-surface-300 px-2.5 py-1 text-xs font-medium text-ink-muted hover:border-danger hover:text-danger active:shadow-btn-active"
                  >
                    Del
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (!status) {
    return <MetaPill label="Status" value="--" />;
  }

  const style = status >= 200 && status < 300
    ? "bg-success-bg text-emerald-700 border-emerald-200 shadow-raised"
    : status >= 400
      ? "bg-danger-bg text-red-700 border-red-200 shadow-raised"
      : "bg-warning-bg text-amber-700 border-amber-200 shadow-raised";

  return <span className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${style}`}>{status}</span>;
}

function StatusDot({ status }) {
  if (!status) return <span>--</span>;

  const color = status >= 200 && status < 300
    ? "bg-emerald-400"
    : status >= 400
      ? "bg-red-400"
      : "bg-amber-400";

  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      {status}
    </span>
  );
}

function ResponseBody({ text, search, onSearchChange }) {
  const [activeMatch, setActiveMatch] = useState(0);
  const preRef = useRef(null);
  const isLarge = text.split("\n").length > 5000;
  const hasSpecialChar = /[.*+?^${}()|[\]\\]/.test(search);
  const shouldSearch = search && (!isLarge || hasSpecialChar || search.length >= 3);

  const matchCount = useMemo(() => {
    if (!shouldSearch || !text) return 0;
    try {
      const regex = new RegExp(escapeRegex(search), "gi");
      return (text.match(regex) || []).length;
    } catch {
      return 0;
    }
  }, [text, search, shouldSearch]);

  const highlighted = useMemo(() => {
    if (!shouldSearch || !text) return null;
    try {
      const regex = new RegExp(`(${escapeRegex(search)})`, "gi");
      return text.split(regex);
    } catch {
      return null;
    }
  }, [text, search, shouldSearch]);

  useEffect(() => {
    setActiveMatch(0);
  }, [search]);

  const jumpToMatch = (index) => {
    if (!preRef.current) return;
    const marks = preRef.current.querySelectorAll("mark");
    if (marks.length === 0) return;
    const clamped = ((index % marks.length) + marks.length) % marks.length;
    setActiveMatch(clamped);
    marks.forEach((m, i) => {
      m.className = i === clamped
        ? "rounded-sm bg-accent px-0.5 text-white"
        : "rounded-sm bg-amber-200 px-0.5 text-amber-900";
    });
    marks[clamped].scrollIntoView({ block: "center", behavior: "smooth" });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={isLarge ? "Search (3+ chars)..." : "Search response..."}
            className="w-full rounded-lg border border-surface-300 bg-card py-1.5 pl-8 pr-3 text-sm shadow-inset placeholder:text-ink-muted"
          />
        </div>
        {shouldSearch && matchCount > 0 && (
          <>
            <span className="whitespace-nowrap text-xs text-ink-muted">
              {activeMatch + 1}/{matchCount}
            </span>
            <div className="flex gap-0.5">
              <button
                type="button"
                onClick={() => jumpToMatch(activeMatch - 1)}
                className="rounded-md border border-surface-300 bg-card p-1 text-ink-muted shadow-btn hover:text-ink-light active:shadow-btn-active"
                title="Previous match"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15,18 9,12 15,6" /></svg>
              </button>
              <button
                type="button"
                onClick={() => jumpToMatch(activeMatch + 1)}
                className="rounded-md border border-surface-300 bg-card p-1 text-ink-muted shadow-btn hover:text-ink-light active:shadow-btn-active"
                title="Next match"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9,18 15,12 9,6" /></svg>
              </button>
            </div>
          </>
        )}
        {shouldSearch && matchCount === 0 && search && (
          <span className="whitespace-nowrap text-xs text-ink-muted">No matches</span>
        )}
        {search && !shouldSearch && (
          <span className="whitespace-nowrap text-xs text-ink-muted">Type {3 - search.length} more...</span>
        )}
      </div>
      <pre ref={preRef} className="max-h-[520px] overflow-auto rounded-lg border border-surface-200 bg-card p-4 font-mono text-sm leading-relaxed text-ink shadow-inset">
        {highlighted
          ? highlighted.map((part, i) =>
              i % 2 === 1 ? (
                <mark key={i} className="rounded-sm bg-amber-200 px-0.5 text-amber-900">{part}</mark>
              ) : (
                part
              )
            )
          : text}
      </pre>
    </div>
  );
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function downloadResponse(text, filename) {
  const blob = new Blob([text], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "response.json";
  a.click();
  URL.revokeObjectURL(url);
}

function MetaPill({ label, value }) {
  return (
    <span className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs font-medium text-ink-muted shadow-raised">
      <span className="text-ink-faint">{label}:</span> {value}
    </span>
  );
}

export default App;
