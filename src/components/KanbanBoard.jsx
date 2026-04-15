// =============================================================================
// KanbanBoard.jsx — v3
// NEW FILE — does not modify FilteredTable.jsx, BreakdownsContext.jsx,
// Providers.jsx, MainForm.jsx, or the Apps Script endpoint.
//
// STAGE PLACEMENT (data-driven, no manual advance except Stage 2 override):
//   STAGE_1 – Roadside Requested & Diagnostics
//             Status blank AND Service Provider blank
//   STAGE_2 – In Progress
//             Status = "In progress" AND Service Provider filled
//             AND On-Location != "Arrived" AND Repairs Finished blank
//   STAGE_3 – Repairs Complete, Waiting on Cost
//             Status = "In progress" AND (On-Location = "Arrived" OR
//             Repairs Finished has value)
//   HIDDEN  – Status = "Complete" | "n/a" | "test"
//
// ADVANCE VALIDATION:
//   Stage 1 → 2 : requires A-H, K, L, N, O (Breakdown Date, Driver Name,
//                 Truck#, Trailer#, State, City, Repair Type, Assigned To,
//                 Repair Needed, Assigned To Dashboard, Service Provider)
//   Stage 2 → 3 : auto when On-Location="Arrived" OR Repairs Finished filled
//                 Manual override button shown only when BOTH are blank,
//                 requires Phone Number (Col P) to be filled
//   Stage 3 → ✓ : requires Total (Col T)
//
// Col M (Repair Category) — hidden from UI, auto-mirrors Col H (Repair Type)
// State normalization — full names → abbreviations (voice agent fix)
// =============================================================================

import React, { useState, useEffect } from "react";
import useAxios from "axios-hooks";
import dayjs from "dayjs";
import Spinner from "./Spinner";
import { Select, MenuItem } from "@mui/material";
import { useFilteredData } from "./BreakdownsContext";

const END_POINT =
  "https://script.google.com/macros/s/AKfycbzX6QjhoOsurYDexFE99aCOl1NPJ-MTmjw2U8i7mhNuMaLlJUH7I6Gda0dAOAORnCbB/exec";

const STAGES = [
  { key: "STAGE_1", label: "Roadside Requested & Diagnostics", accent: "#60a5fa" },
  { key: "STAGE_2", label: "In Progress",                       accent: "#a78bfa" },
  { key: "STAGE_3", label: "Repairs Complete, Waiting on Cost", accent: "#34d399" },
];

const HIDDEN_STATUSES = ["complete", "n/a", "test"];

// ── State normalization (voice agent sends full names) ────────────────────────
const STATE_MAP = {
  "alabama":"AL","alaska":"AK","arizona":"AZ","arkansas":"AR","california":"CA",
  "colorado":"CO","connecticut":"CT","delaware":"DE","florida":"FL","georgia":"GA",
  "hawaii":"HI","idaho":"ID","illinois":"IL","indiana":"IN","iowa":"IA",
  "kansas":"KS","kentucky":"KY","louisiana":"LA","maine":"ME","maryland":"MD",
  "massachusetts":"MA","michigan":"MI","minnesota":"MN","mississippi":"MS",
  "missouri":"MO","montana":"MT","nebraska":"NE","nevada":"NV","new hampshire":"NH",
  "new jersey":"NJ","new mexico":"NM","new york":"NY","north carolina":"NC",
  "north dakota":"ND","ohio":"OH","oklahoma":"OK","oregon":"OR","pennsylvania":"PA",
  "rhode island":"RI","south carolina":"SC","south dakota":"SD","tennessee":"TN",
  "texas":"TX","utah":"UT","vermont":"VT","virginia":"VA","washington":"WA",
  "west virginia":"WV","wisconsin":"WI","wyoming":"WY",
};
function normalizeState(val) {
  if (!val) return "";
  const lower = val.trim().toLowerCase();
  return STATE_MAP[lower] || val;
}

// ── Stage placement logic ─────────────────────────────────────────────────────
function getCardStage(row) {
  const status     = (row.Status || "").toLowerCase().trim();
  const onLocation = (row["On-Location"] || "").trim();
  const rolling    = (row["Repairs Finished"] || "").trim();

  if (HIDDEN_STATUSES.includes(status)) return null;

  // Stage 3: repairs complete (arrived or rolling stamped)
  if (
    status === "in progress" &&
    row["Service Provider"] &&
    (onLocation === "Arrived" || rolling !== "")
  ) return "STAGE_3";

  // Stage 2: in progress, vendor assigned, not yet arrived/rolling
  if (status === "in progress" && row["Service Provider"]) return "STAGE_2";

  // Stage 1: everything else that isn't hidden
  return "STAGE_1";
}

// ── Stage 1 → 2 validation ────────────────────────────────────────────────────
// Required: BreakDown Date, Driver Name, Truck#, Trailer#, State, City,
//           Repair Type, Assigned To (Col K), Repair Needed, Assigned To Dashboard, Service Provider
function validateStage1(row, editState) {
  const merged = { ...row, ...(editState || {}) };
  const missing = [];
  if (!merged["BreakDown Date"])       missing.push("Breakdown Date");
  if (!merged["Driver Name"])          missing.push("Driver Name");
  if (!merged["Truck #"])              missing.push("Truck #");
  if (!merged["Trailer #"])            missing.push("Trailer #");
  if (!merged["State"])                missing.push("State");
  if (!merged["City"])                 missing.push("City");
  if (!merged["Repair Type"])          missing.push("Repair Type");
  if (!merged["Repair Needed"])        missing.push("Repair Needed");
  if (!merged["Assigned To Dashboard"]) missing.push("Assigned To");
  if (!merged["Service Provider"])     missing.push("Service Provider");
  return missing;
}

// ── Stage 2 → 3 manual override validation ────────────────────────────────────
// Required: Phone Number
function validateStage2(row, editState) {
  const merged = { ...row, ...(editState || {}) };
  const missing = [];
  if (!merged["Phone Number"]) missing.push("Phone Number");
  return missing;
}

// ── Stage 3 → Complete validation ─────────────────────────────────────────────
function validateStage3(row, editState) {
  const merged = { ...row, ...(editState || {}) };
  const missing = [];
  if (!merged["Total"]) missing.push("Total Cost");
  return missing;
}

// ── Priority (hours since breakdown) ─────────────────────────────────────────
function getPriority(breakdownDate) {
  const hours = dayjs().diff(dayjs(breakdownDate), "hour");
  if (hours >= 6) return "HIGH";
  if (hours >= 2) return "MED";
  return "LOW";
}

const PRI = {
  HIGH: { label: "URGENT", border: "#f87171", bg: "#3b1111", color: "#f87171", bdBorder: "#7f1d1d" },
  MED:  { label: "MEDIUM", border: "#fbbf24", bg: "#3b2800", color: "#fbbf24", bdBorder: "#7c4a00" },
  LOW:  { label: "LOW",    border: "#4ade80", bg: "#052e16", color: "#4ade80", bdBorder: "#14532d" },
};

const ETA_OPTIONS = [
  "< 30 min", "30 min", "45 min", "1 hour", "1.5 hours", "> 1.5 Hours",
  "Route to nearest service provider ETA 30 min",
  "Route to nearest service provider ETA 1 hour",
];

// =============================================================================
// Main component
// =============================================================================
export default function KanbanBoard() {
  const [{ data, loading, error }] = useAxios(END_POINT + "?route=getBreakdowns");
  const [, executePost] = useAxios(
    { url: END_POINT + "?route=editBreakdowns", method: "POST" },
    { manual: true }
  );

  const { filteredData, setFilteredData, categoriesAndSubcategories, setCategoriesAndSubcategories } =
    useFilteredData();

  const [expandedId, setExpandedId] = useState(null);
  const [editState, setEditState]   = useState({});
  const [saving, setSaving]         = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [searchTerms, setSearchTerms] = useState({ STAGE_1: "", STAGE_2: "", STAGE_3: "" });

  useEffect(() => {
    if (filteredData && filteredData.length > 0) return;
    if (!data) return;
    const rows = data.breakDowns.map((item, index) => ({
      ...item,
      State: normalizeState(item.State),
      rowIndex: index,
    }));
    setFilteredData(rows.filter((r) => getCardStage(r) !== null));
    if (data.categories) setCategoriesAndSubcategories(data.categories);
  }, [data]);

  if (loading) return <Spinner />;
  if (error)   return <div style={s.errorMsg}>Failed to load breakdown data.</div>;
  if (!data)   return null;

  const setField = (rowIndex, field, value) =>
    setEditState((prev) => ({ ...prev, [rowIndex]: { ...prev[rowIndex], [field]: value } }));

  const getField = (row, field) =>
    editState[row.rowIndex]?.[field] !== undefined
      ? editState[row.rowIndex][field]
      : row[field] ?? "";

  const saveRow = async (row, overrides = {}) => {
    const merged = { ...row, ...(editState[row.rowIndex] || {}), ...overrides };
    const total  = merged.Total ? String(merged.Total).replace(/^\$/, "") : "";
    const body = {
      breakdownDate:   merged["BreakDown Date"],
      city:            merged.City,
      repairType:      merged["Repair Type"],
      description:     merged["Description"],
      driverName:      merged["Driver Name"],
      repairCategory:  merged["Repair Type"], // Col M mirrors Col H silently
      repairNeeded:    merged["Repair Needed"],
      serviceProvider: merged["Service Provider"],
      phoneNumber:     merged["Phone Number"],
      state:           merged.State,
      status:          merged.Status,
      sumbittedBy:     merged["Assigned To Dashboard"],
      total,
      trailer:         merged["Trailer #"],
      truck:           merged["Truck #"],
      rowIndex:        merged.rowIndex,
      ETA:             merged["ETA"],
      onLocation:      merged["On-Location"],
    };
    setSaving(true);
    try {
      await executePost({ data: JSON.stringify(body) });
      setFilteredData((prev) =>
        prev.map((r) => (r.rowIndex === row.rowIndex ? { ...r, ...merged } : r))
      );
      setEditState((prev) => { const n = { ...prev }; delete n[row.rowIndex]; return n; });
      setValidationErrors((prev) => { const n = { ...prev }; delete n[row.rowIndex]; return n; });
    } catch (err) {
      console.error("KanbanBoard save error:", err);
    }
    setSaving(false);
  };

  // Stage 1 save — validates required fields before allowing save that moves card to Stage 2
  const handleStage1Save = (row) => {
    const missing = validateStage1(row, editState[row.rowIndex]);
    if (missing.length > 0) {
      setValidationErrors((prev) => ({ ...prev, [row.rowIndex]: missing }));
      return;
    }
    setValidationErrors((prev) => { const n = { ...prev }; delete n[row.rowIndex]; return n; });
    // Status set to "In progress" so card moves to Stage 2 automatically
    saveRow(row, { Status: "In progress" });
    setExpandedId(null);
  };

  // Stage 2 manual override — only available when On-Location and Repairs Finished are both blank
  const handleStage2ManualAdvance = (row) => {
    const missing = validateStage2(row, editState[row.rowIndex]);
    if (missing.length > 0) {
      setValidationErrors((prev) => ({ ...prev, [row.rowIndex]: missing }));
      return;
    }
    setValidationErrors((prev) => { const n = { ...prev }; delete n[row.rowIndex]; return n; });
    // Write On-Location = "Arrived" to move card to Stage 3
    saveRow(row, { "On-Location": "Arrived" });
    setExpandedId(null);
  };

  // Stage 3 mark complete — validates Total before removing card
  const handleMarkComplete = (row) => {
    const missing = validateStage3(row, editState[row.rowIndex]);
    if (missing.length > 0) {
      setValidationErrors((prev) => ({ ...prev, [row.rowIndex]: missing }));
      return;
    }
    saveRow(row, { Status: "Complete" });
    setFilteredData((prev) => prev.filter((r) => r.rowIndex !== row.rowIndex));
    setExpandedId(null);
  };

  const highCount = filteredData.filter((r) => getPriority(r["BreakDown Date"]) === "HIGH").length;
  const medCount  = filteredData.filter((r) => getPriority(r["BreakDown Date"]) === "MED").length;
  const lowCount  = filteredData.filter((r) => getPriority(r["BreakDown Date"]) === "LOW").length;

  return (
    <div style={s.wrap}>
      <div style={s.toolbar}>
        <span style={s.toolbarTitle}>Breakdown Queue</span>
        <StatPill value={filteredData.length} label="total"  color="#e2e8f0" />
        <StatPill value={highCount}           label="urgent" color="#f87171" dot />
        <StatPill value={medCount}            label="medium" color="#fbbf24" dot />
        <StatPill value={lowCount}            label="low"    color="#4ade80" dot />
      </div>

      <div style={s.board}>
        {STAGES.map((stage) => {
          const cards = filteredData.filter((r) => getCardStage(r) === stage.key);
          const term = (searchTerms[stage.key] || "").toLowerCase().trim();
          const visibleCards = term
            ? cards.filter((r) =>
                (r["Truck #"]       && String(r["Truck #"]).toLowerCase().includes(term))  ||
                (r["Driver Name"]   && r["Driver Name"].toLowerCase().includes(term))      ||
                (r["City"]          && r["City"].toLowerCase().includes(term))             ||
                (r["State"]         && r["State"].toLowerCase().includes(term))            ||
                (r["Repair Type"]   && r["Repair Type"].toLowerCase().includes(term))
              )
            : cards;
          return (
            <div key={stage.key} style={s.col}>
              <div style={s.colHdr}>
                <div style={{ ...s.colDot, background: stage.accent }} />
                <span style={s.colName}>{stage.label}</span>
                <span style={{ ...s.colCount, color: stage.accent }}>{visibleCards.length}</span>
              </div>
              <div style={{ padding: "8px 10px 0" }}>
                <input
                  style={s.searchInput}
                  placeholder="Search truck, driver, location, repair..."
                  value={searchTerms[stage.key]}
                  onChange={(e) => setSearchTerms((prev) => ({ ...prev, [stage.key]: e.target.value }))}
                />
              </div>
              <div style={s.colBody}>
                {visibleCards.length === 0 && (
                  <div style={s.emptyCol}>
                    {term ? "No matching cases" : "No cases here"}
                  </div>
                )}
                {visibleCards.map((row) => (
                  <BreakdownCard
                    key={row.rowIndex}
                    row={row}
                    stage={stage}
                    expanded={expandedId === row.rowIndex}
                    onToggle={() => setExpandedId(expandedId === row.rowIndex ? null : row.rowIndex)}
                    editState={editState[row.rowIndex] || {}}
                    setField={setField}
                    getField={getField}
                    apiData={data}
                    categoriesAndSubcategories={categoriesAndSubcategories}
                    onSave={() => saveRow(row)}
                    onStage1Save={() => handleStage1Save(row)}
                    onStage2Advance={() => handleStage2ManualAdvance(row)}
                    onComplete={() => handleMarkComplete(row)}
                    saving={saving}
                    errors={validationErrors[row.rowIndex] || []}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {saving && <div style={s.overlay}><Spinner /></div>}
    </div>
  );
}

// =============================================================================
// BreakdownCard
// =============================================================================
function BreakdownCard({
  row, stage, expanded, onToggle,
  editState, setField, getField, apiData,
  categoriesAndSubcategories, onSave, onStage1Save,
  onStage2Advance, onComplete, saving, errors,
}) {
  const pri      = getPriority(row["BreakDown Date"]);
  const priStyle = PRI[pri];
  const hoursAgo = dayjs().diff(dayjs(row["BreakDown Date"]), "hour");
  const timeLabel =
    hoursAgo < 1    ? "< 1h ago"
    : hoursAgo < 24 ? `${hoursAgo}h ago`
    : dayjs(row["BreakDown Date"]).format("MM/DD");

  const initials = row["Assigned To Dashboard"]
    ? row["Assigned To Dashboard"].split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "—";

  // Stage 2 manual override only shows when both On-Location and Repairs Finished are blank
  const showManualAdvance =
    stage.key === "STAGE_2" &&
    !row["On-Location"] &&
    !row["Repairs Finished"];

  return (
    <div style={{ ...s.card, borderLeftColor: priStyle.border }}>
      <div onClick={onToggle} style={{ cursor: "pointer" }}>
        <div style={s.cardTop}>
          <div style={s.cardUnit}>
            Truck #{row["Truck #"] || "—"}
            <span style={s.cardUnitSub}> / Trailer #{row["Trailer #"] || "—"}</span>
          </div>
          <span style={{ ...s.priBadge, background: priStyle.bg, color: priStyle.color, border: `1px solid ${priStyle.bdBorder}` }}>
            {priStyle.label}
          </span>
        </div>
        <div style={s.cardDriver}>{row["Driver Name"] || "No driver"}</div>
        <div style={s.cardLoc}>{row.City ? `${row.City}, ${row.State}` : row.State || "—"}</div>
        <div style={s.cardTags}>
          {row["Repair Type"] && <span style={{ ...s.tag, ...s.tagRepair }}>{row["Repair Type"]}</span>}
          {row["Service Provider"] && <span style={{ ...s.tag, color: "#a78bfa", borderColor: "#2d1f5f", background: "#1a1035" }}>{row["Service Provider"]}</span>}
          {row["ETA"] && <span style={{ ...s.tag, color: "#fbbf24", borderColor: "#7c4a00", background: "#3b2800" }}>ETA: {row["ETA"]}</span>}
          {row["On-Location"] === "Arrived" && <span style={{ ...s.tag, color: "#4ade80", borderColor: "#14532d", background: "#052e16" }}>On-Location ✓</span>}
          {row["Repairs Finished"] && <span style={{ ...s.tag, color: "#34d399", borderColor: "#0f3528", background: "#081f18" }}>Rolling ✓</span>}
        </div>
        <div style={s.cardFooter}>
          <div style={s.assignedBubble}>{initials}</div>
          <span style={{ ...s.cardTime, color: pri === "HIGH" ? "#f87171" : "#475569" }}>{timeLabel}</span>
        </div>
      </div>

      {expanded && (
        <div style={s.cardDetail}>
          {errors.length > 0 && (
            <div style={s.errorBanner}>
              Required to advance: {errors.join(", ")}
            </div>
          )}
          <EditFields
            row={row} stage={stage}
            editState={editState} setField={setField} getField={getField}
            apiData={apiData} categoriesAndSubcategories={categoriesAndSubcategories}
          />
          <div style={s.detActions}>
            {/* Stage 1 — Save advances the card if all required fields are filled */}
            {stage.key === "STAGE_1" && (
              <>
                <button style={{ ...s.detBtn, ...s.btnSave }} onClick={onSave} disabled={saving}>Save</button>
                <button style={{ ...s.detBtn, ...s.btnAdv }} onClick={onStage1Save} disabled={saving}>Save & Advance →</button>
              </>
            )}
            {/* Stage 2 — Save only; manual advance shown only when On-Location and Rolling are both blank */}
            {stage.key === "STAGE_2" && (
              <>
                <button style={{ ...s.detBtn, ...s.btnSave }} onClick={onSave} disabled={saving}>Save</button>
                {showManualAdvance && (
                  <button style={{ ...s.detBtn, ...s.btnAdv }} onClick={onStage2Advance} disabled={saving}>Advance →</button>
                )}
              </>
            )}
            {/* Stage 3 — Save and Mark Complete */}
            {stage.key === "STAGE_3" && (
              <>
                <button style={{ ...s.detBtn, ...s.btnSave }} onClick={onSave} disabled={saving}>Save</button>
                <button style={{ ...s.detBtn, ...s.btnComplete }} onClick={onComplete} disabled={saving}>Mark Complete</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// EditFields — fields shown per stage
// =============================================================================
function EditFields({ row, stage, editState, setField, getField, apiData, categoriesAndSubcategories }) {
  const ri = row.rowIndex;

  // ── Stage 1: Roadside Requested & Diagnostics ─────────────────────────────
  if (stage.key === "STAGE_1") {
    return (
      <div style={s.fieldsGrid}>
        {/* Roadside fields */}
        <FieldWrap label="Breakdown Date">
          <input type="date" style={s.input}
            value={dayjs(getField(row, "BreakDown Date")).format("YYYY-MM-DD")}
            max={dayjs().format("YYYY-MM-DD")}
            onChange={(e) => setField(ri, "BreakDown Date", e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Driver Name">
          <Select size="small" variant="outlined" value={getField(row, "Driver Name")}
            onChange={(e) => setField(ri, "Driver Name", e.target.value)} sx={muiSx}>
            {apiData.drivers.map((n, i) => <MenuItem key={i} value={n}>{n}</MenuItem>)}
          </Select>
        </FieldWrap>
        <FieldWrap label="Truck #">
          <input style={s.input} value={getField(row, "Truck #")}
            onChange={(e) => setField(ri, "Truck #", e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Trailer #">
          <input style={s.input} value={getField(row, "Trailer #")}
            onChange={(e) => setField(ri, "Trailer #", e.target.value)} />
        </FieldWrap>
        <FieldWrap label="State">
          <Select size="small" variant="outlined" value={getField(row, "State")}
            onChange={(e) => setField(ri, "State", e.target.value)} sx={muiSx}>
            {apiData.states.map((n, i) => <MenuItem key={i} value={n}>{n}</MenuItem>)}
          </Select>
        </FieldWrap>
        <FieldWrap label="City">
          <input style={s.input} value={getField(row, "City")}
            onChange={(e) => setField(ri, "City", e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Repair Type">
          <input style={s.input} value={getField(row, "Repair Type")}
            onChange={(e) => setField(ri, "Repair Type", e.target.value)} />
        </FieldWrap>
        <FieldWrap label="Description" fullWidth>
          <textarea style={{ ...s.input, height: 56, resize: "vertical" }}
            value={getField(row, "Description")}
            onChange={(e) => setField(ri, "Description", e.target.value)} />
        </FieldWrap>
        {row["File Attachment"] && (
          <FieldWrap label="Attachment" fullWidth>
            {row["File Attachment"].split("\n").map((url, i) => (
              <a key={i} href={url.trim()} target="_blank" rel="noreferrer"
                style={{ color: "#60a5fa", fontSize: 12, display: "block" }}>File {i + 1}</a>
            ))}
          </FieldWrap>
        )}

        {/* Diagnostics section */}
        <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #1e2d3d", marginTop: 4, paddingTop: 10 }}>
          <div style={{ fontSize: 10, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Diagnostics
          </div>
        </div>
        <FieldWrap label="Repair Needed *" fullWidth>
          <Select size="small" variant="outlined"
            value={getField(row, "Repair Needed")}
            onChange={(e) => setField(ri, "Repair Needed", e.target.value)}
            sx={{ ...muiSx, minWidth: "100%" }}>
            {(categoriesAndSubcategories[getField(row, "Repair Type")] || []).map((sub, i) => (
              <MenuItem key={i} value={sub}>{sub}</MenuItem>
            ))}
          </Select>
        </FieldWrap>
        <FieldWrap label="Assigned To *">
          <Select size="small" variant="outlined" value={getField(row, "Assigned To Dashboard")}
            onChange={(e) => setField(ri, "Assigned To Dashboard", e.target.value)} sx={muiSx}>
            {apiData.users.map((n, i) => <MenuItem key={i} value={n}>{n}</MenuItem>)}
          </Select>
        </FieldWrap>

        {/* Service Provider — required to advance */}
        <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #1e2d3d", marginTop: 4, paddingTop: 10 }}>
          <div style={{ fontSize: 10, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Service Provider *
          </div>
        </div>
        <FieldWrap label="State">
          <Select size="small" variant="outlined" value={getField(row, "State")}
            onChange={(e) => setField(ri, "State", e.target.value)} sx={muiSx}>
            {apiData.states.map((n, i) => <MenuItem key={i} value={n}>{n}</MenuItem>)}
          </Select>
        </FieldWrap>
        <FieldWrap label="Provider">
          <Select size="small" variant="outlined" value={getField(row, "Service Provider")}
            onChange={(e) => {
              const pd = apiData.providers.find((p) => p["Service Provider"] === e.target.value);
              setField(ri, "Service Provider", e.target.value);
              if (pd) setField(ri, "Phone Number", pd["Phone Number"]);
            }} sx={muiSx}>
            {apiData.providers
              .filter((p) => p.State === (editState["State"] ?? row.State))
              .map((p, i) => <MenuItem key={i} value={p["Service Provider"]}>{p["Service Provider"]}</MenuItem>)}
          </Select>
        </FieldWrap>
        <FieldWrap label="Phone #" fullWidth>
          <span style={{ fontSize: 13, color: "#60a5fa" }}>
            {editState["Phone Number"] ??
              apiData.providers.find((p) => p["Service Provider"] === (editState["Service Provider"] ?? row["Service Provider"]))?.["Phone Number"] ??
              row["Phone Number"] ?? "—"}
          </span>
        </FieldWrap>
        <FieldWrap label="ETA">
          <Select size="small" variant="outlined" value={getField(row, "ETA")}
            onChange={(e) => setField(ri, "ETA", e.target.value)} sx={muiSx}>
            {ETA_OPTIONS.map((v, i) => <MenuItem key={i} value={v}>{v}</MenuItem>)}
          </Select>
        </FieldWrap>
      </div>
    );
  }

  // ── Stage 2: In Progress ──────────────────────────────────────────────────
  if (stage.key === "STAGE_2") {
    const selectedState     = editState["State"] ?? row.State;
    const filteredProviders = apiData.providers.filter((p) => p.State === selectedState);
    const currentProvider   = editState["Service Provider"] ?? row["Service Provider"];
    const providerData      = apiData.providers.find((p) => p["Service Provider"] === currentProvider);
    const displayPhone      = editState["Phone Number"] ?? providerData?.["Phone Number"] ?? row["Phone Number"] ?? "";

    return (
      <div style={s.fieldsGrid}>
        {/* Read-only summary */}
        <FieldWrap label="Driver" fullWidth>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>{row["Driver Name"]}</span>
        </FieldWrap>
        <FieldWrap label="Repair Type">
          <span style={{ fontSize: 13, color: "#94a3b8" }}>{row["Repair Type"]}</span>
        </FieldWrap>
        <FieldWrap label="Repair Needed">
          <span style={{ fontSize: 13, color: "#94a3b8" }}>{row["Repair Needed"] || "—"}</span>
        </FieldWrap>

        {/* Service provider fields */}
        <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #1e2d3d", marginTop: 4, paddingTop: 10 }}>
          <div style={{ fontSize: 10, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            In Progress
          </div>
        </div>
        <FieldWrap label="State">
          <Select size="small" variant="outlined" value={getField(row, "State")}
            onChange={(e) => setField(ri, "State", e.target.value)} sx={muiSx}>
            {apiData.states.map((n, i) => <MenuItem key={i} value={n}>{n}</MenuItem>)}
          </Select>
        </FieldWrap>
        <FieldWrap label="Service Provider">
          <Select size="small" variant="outlined" value={getField(row, "Service Provider")}
            onChange={(e) => {
              const pd = apiData.providers.find((p) => p["Service Provider"] === e.target.value);
              setField(ri, "Service Provider", e.target.value);
              if (pd) setField(ri, "Phone Number", pd["Phone Number"]);
            }} sx={muiSx}>
            {filteredProviders.map((p, i) => <MenuItem key={i} value={p["Service Provider"]}>{p["Service Provider"]}</MenuItem>)}
          </Select>
        </FieldWrap>
        <FieldWrap label="Phone # *" fullWidth>
          <input style={s.input} value={displayPhone}
            onChange={(e) => setField(ri, "Phone Number", e.target.value)}
            placeholder="Required to advance" />
        </FieldWrap>
        <FieldWrap label="ETA">
          <Select size="small" variant="outlined" value={getField(row, "ETA")}
            onChange={(e) => setField(ri, "ETA", e.target.value)} sx={muiSx}>
            {ETA_OPTIONS.map((v, i) => <MenuItem key={i} value={v}>{v}</MenuItem>)}
          </Select>
        </FieldWrap>
        <FieldWrap label="On-Location">
          <span style={{ fontSize: 13, color: row["On-Location"] === "Arrived" ? "#4ade80" : "#475569" }}>
            {row["On-Location"] || "Pending"}
          </span>
        </FieldWrap>
        <FieldWrap label="Repairs Finished">
          <span style={{ fontSize: 13, color: row["Repairs Finished"] ? "#4ade80" : "#475569" }}>
            {row["Repairs Finished"] || "Pending"}
          </span>
        </FieldWrap>
      </div>
    );
  }

  // ── Stage 3: Repairs Complete, Waiting on Cost ────────────────────────────
  if (stage.key === "STAGE_3") {
    return (
      <div style={s.fieldsGrid}>
        {/* Read-only summary */}
        <FieldWrap label="Driver" fullWidth>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>{row["Driver Name"]}</span>
        </FieldWrap>
        <FieldWrap label="Repair Type">
          <span style={{ fontSize: 13, color: "#94a3b8" }}>{row["Repair Type"]}</span>
        </FieldWrap>
        <FieldWrap label="Repair Needed">
          <span style={{ fontSize: 13, color: "#94a3b8" }}>{row["Repair Needed"] || "—"}</span>
        </FieldWrap>
        <FieldWrap label="Service Provider">
          <span style={{ fontSize: 13, color: "#94a3b8" }}>{row["Service Provider"] || "—"}</span>
        </FieldWrap>
        <FieldWrap label="Phone #">
          <span style={{ fontSize: 13, color: "#60a5fa" }}>{row["Phone Number"] || "—"}</span>
        </FieldWrap>
        <FieldWrap label="On-Location">
          <span style={{ fontSize: 13, color: "#4ade80" }}>{row["On-Location"] || "—"}</span>
        </FieldWrap>
        <FieldWrap label="Repairs Finished">
          <span style={{ fontSize: 13, color: "#4ade80" }}>{row["Repairs Finished"] || "—"}</span>
        </FieldWrap>

        {/* Cost entry */}
        <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #1e2d3d", marginTop: 4, paddingTop: 10 }}>
          <div style={{ fontSize: 10, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Enter Cost to Close
          </div>
        </div>
        <FieldWrap label="Total Cost * ($)" fullWidth>
          <input style={{ ...s.input, fontSize: 14 }}
            value={getField(row, "Total")}
            onChange={(e) => setField(ri, "Total", e.target.value)}
            placeholder="Enter total repair cost" />
        </FieldWrap>
      </div>
    );
  }

  return null;
}

// =============================================================================
// Helpers
// =============================================================================
function FieldWrap({ label, children, fullWidth }) {
  return (
    <div style={{ ...s.field, gridColumn: fullWidth ? "1 / -1" : undefined }}>
      <div style={s.fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

function StatPill({ value, label, color, dot }) {
  return (
    <div style={s.statPill}>
      {dot && <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />}
      <span style={{ fontSize: 15, fontWeight: 500, color }}>{value}</span>
      <span style={{ fontSize: 11, color: "#64748b" }}>{label}</span>
    </div>
  );
}

const muiSx = {
  minWidth: 130,
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#2a3a4d" },
  "& .MuiSelect-select": { color: "#e2e8f0", fontSize: 12, padding: "5px 8px" },
  "& .MuiSvgIcon-root": { color: "#64748b" },
  backgroundColor: "#1a2533",
};

// =============================================================================
// Styles
// =============================================================================
const s = {
  wrap:           { background: "#0f1923", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", position: "relative" },
  errorMsg:       { color: "#f87171", padding: 20, fontSize: 14 },
  errorBanner:    { background: "#3b1111", border: "1px solid #7f1d1d", borderRadius: 6, color: "#f87171", fontSize: 11, padding: "8px 10px", marginBottom: 10 },
  toolbar:        { background: "#0d1822", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #1e2d3d" },
  toolbarTitle:   { fontSize: 14, fontWeight: 500, color: "#e2e8f0", flex: 1 },
  statPill:       { background: "#1a2533", border: "1px solid #2a3a4d", borderRadius: 6, padding: "5px 12px", display: "flex", alignItems: "center", gap: 6 },
  board:          { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, padding: "14px 16px", alignItems: "start" },
  col:            { background: "#111e2b", border: "1px solid #1e2d3d", borderRadius: 10, overflow: "hidden" },
  colHdr:         { padding: "12px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #1e2d3d" },
  colDot:         { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 },
  colName:        { fontSize: 11, fontWeight: 500, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: "0.05em", flex: 1 },
  colCount:       { fontSize: 11, padding: "2px 7px", borderRadius: 10, border: "1px solid #2a3a4d", background: "#1a2533" },
  colBody:        { padding: 10, display: "flex", flexDirection: "column", gap: 8, minHeight: 80 },
  emptyCol:       { padding: "20px 10px", textAlign: "center", fontSize: 12, color: "#2a3a4d" },
  searchInput:    { width: "100%", background: "#0d1822", border: "1px solid #2a3a4d", borderRadius: 4, color: "#94a3b8", fontSize: 11, padding: "5px 8px", outline: "none", boxSizing: "border-box" },
  card:           { background: "#0d1822", border: "1px solid #1e2d3d", borderLeft: "3px solid", borderRadius: 8, padding: "11px 12px" },
  cardTop:        { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginBottom: 8 },
  cardUnit:       { fontSize: 13, fontWeight: 500, color: "#e2e8f0" },
  cardUnitSub:    { color: "#64748b", fontWeight: 400, fontSize: 11, marginLeft: 4 },
  priBadge:       { fontSize: 10, padding: "2px 7px", borderRadius: 10, fontWeight: 500, flexShrink: 0 },
  cardDriver:     { fontSize: 12, color: "#94a3b8", marginBottom: 6 },
  cardLoc:        { fontSize: 11, color: "#475569", marginBottom: 8 },
  cardTags:       { display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 },
  tag:            { fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "#1a2533", color: "#64748b", border: "1px solid #2a3a4d" },
  tagRepair:      { color: "#7dd3fc", borderColor: "#1e3a5f", background: "#0f2035" },
  cardFooter:     { display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #1a2533", paddingTop: 8, marginTop: 4 },
  assignedBubble: { width: 24, height: 24, borderRadius: "50%", background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", color: "#60a5fa", fontSize: 9, fontWeight: 500 },
  cardTime:       { fontSize: 11 },
  cardDetail:     { borderTop: "1px solid #1a2533", marginTop: 10, paddingTop: 10 },
  fieldsGrid:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 },
  field:          { display: "flex", flexDirection: "column", gap: 4 },
  fieldLabel:     { fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" },
  input:          { background: "#1a2533", border: "1px solid #2a3a4d", borderRadius: 4, color: "#e2e8f0", fontSize: 12, padding: "5px 8px", outline: "none", width: "100%" },
  detActions:     { display: "flex", gap: 6, marginTop: 10 },
  detBtn:         { flex: 1, padding: "7px 0", borderRadius: 5, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none" },
  btnSave:        { background: "#1a2533", color: "#94a3b8" },
  btnAdv:         { background: "#1e3a5f", color: "#60a5fa" },
  btnComplete:    { background: "#1f1110", color: "#f87171" },
  overlay:        { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 },
};
