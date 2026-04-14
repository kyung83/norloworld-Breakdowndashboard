// =============================================================================
// KanbanBoard.jsx — v2
// NEW FILE — does not modify FilteredTable.jsx, BreakdownsContext.jsx,
// Providers.jsx, MainForm.jsx, or the Apps Script endpoint.
//
// STAGE PLACEMENT based on actual Google Sheet column values:
//   Column 1 – Roadside Requested : Status is blank/empty
//   Column 2 – Diagnostics        : has Repair Category OR Assigned To Dashboard
//                                   but no Service Provider yet
//   Column 3 – In Progress        : Status = "In progress" OR has Service Provider
//   Hidden                        : Status = "Complete" | "n/a" | "test"
//
// ADVANCE logic:
//   Stage 1 → 2 : saves diagnostic fields (card moves automatically)
//   Stage 2 → 3 : sets Status = "In progress"
//   Stage 3 → ✓ : sets Status = "Complete", card disappears
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
  { key: "STAGE_1", label: "Roadside Requested", accent: "#60a5fa" },
  { key: "STAGE_2", label: "Diagnostics",         accent: "#a78bfa" },
  { key: "STAGE_3", label: "In Progress",         accent: "#34d399" },
];

const HIDDEN_STATUSES = ["complete", "n/a", "test"];

// Normalize full state names to abbreviations — dashboard side only
// Voice agent submits "Michigan", sheet/dropdown expects "MI"
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

function getCardStage(row) {
  const status = (row.Status || "").toLowerCase().trim();
  if (HIDDEN_STATUSES.includes(status)) return null;
  if (status === "in progress" || row["Service Provider"] || row["ETA"]) return "STAGE_3";
  if (row["Assigned To Dashboard"] || row["Repair Category"] || row["Repair Needed"]) return "STAGE_2";
  return "STAGE_1";
}

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
      repairCategory:  merged["Repair Category"],
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
    } catch (err) {
      console.error("KanbanBoard save error:", err);
    }
    setSaving(false);
  };

  const advanceCard = (row, stageKey) => {
    if (stageKey === "STAGE_1") saveRow(row);
    if (stageKey === "STAGE_2") saveRow(row, { Status: "In progress" });
    setExpandedId(null);
  };

  const markComplete = (row) => {
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
        {STAGES.map((stage, stageIdx) => {
          const cards = filteredData.filter((r) => getCardStage(r) === stage.key);
          return (
            <div key={stage.key} style={s.col}>
              <div style={s.colHdr}>
                <div style={{ ...s.colDot, background: stage.accent }} />
                <span style={s.colName}>{stage.label}</span>
                <span style={{ ...s.colCount, color: stage.accent }}>{cards.length}</span>
              </div>
              <div style={s.colBody}>
                {cards.length === 0 && <div style={s.emptyCol}>No cases here</div>}
                {cards.map((row) => (
                  <BreakdownCard
                    key={row.rowIndex}
                    row={row}
                    stage={stage}
                    isLastStage={stageIdx === STAGES.length - 1}
                    expanded={expandedId === row.rowIndex}
                    onToggle={() => setExpandedId(expandedId === row.rowIndex ? null : row.rowIndex)}
                    editState={editState[row.rowIndex] || {}}
                    setField={setField}
                    getField={getField}
                    apiData={data}
                    categoriesAndSubcategories={categoriesAndSubcategories}
                    onSave={() => saveRow(row)}
                    onAdvance={() => advanceCard(row, stage.key)}
                    onComplete={() => markComplete(row)}
                    saving={saving}
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

function BreakdownCard({
  row, stage, isLastStage, expanded, onToggle,
  editState, setField, getField, apiData,
  categoriesAndSubcategories, onSave, onAdvance, onComplete, saving,
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
          {row["ETA"] && <span style={{ ...s.tag, color: "#fbbf24", borderColor: "#7c4a00", background: "#3b2800" }}>ETA: {row["ETA"]}</span>}
          {row["On-Location"] === "Arrived" && <span style={{ ...s.tag, color: "#4ade80", borderColor: "#14532d", background: "#052e16" }}>On-Location ✓</span>}
        </div>
        <div style={s.cardFooter}>
          <div style={s.assignedBubble}>{initials}</div>
          <span style={{ ...s.cardTime, color: pri === "HIGH" ? "#f87171" : "#475569" }}>{timeLabel}</span>
        </div>
      </div>

      {expanded && (
        <div style={s.cardDetail}>
          <EditFields
            row={row} stage={stage}
            editState={editState} setField={setField} getField={getField}
            apiData={apiData} categoriesAndSubcategories={categoriesAndSubcategories}
          />
          <div style={s.detActions}>
            <button style={{ ...s.detBtn, ...s.btnSave }} onClick={onSave} disabled={saving}>Save</button>
            {!isLastStage && (
              <button style={{ ...s.detBtn, ...s.btnAdv }} onClick={onAdvance} disabled={saving}>Advance →</button>
            )}
            {isLastStage && (
              <button style={{ ...s.detBtn, ...s.btnComplete }} onClick={onComplete} disabled={saving}>Mark Complete</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EditFields({ row, stage, editState, setField, getField, apiData, categoriesAndSubcategories }) {
  const ri = row.rowIndex;

  if (stage.key === "STAGE_1") return (
    <div style={s.fieldsGrid}>
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
        <input style={s.input} value={getField(row, "Truck #")} onChange={(e) => setField(ri, "Truck #", e.target.value)} />
      </FieldWrap>
      <FieldWrap label="Trailer #">
        <input style={s.input} value={getField(row, "Trailer #")} onChange={(e) => setField(ri, "Trailer #", e.target.value)} />
      </FieldWrap>
      <FieldWrap label="State">
        <Select size="small" variant="outlined" value={getField(row, "State")}
          onChange={(e) => setField(ri, "State", e.target.value)} sx={muiSx}>
          {apiData.states.map((n, i) => <MenuItem key={i} value={n}>{n}</MenuItem>)}
        </Select>
      </FieldWrap>
      <FieldWrap label="City">
        <input style={s.input} value={getField(row, "City")} onChange={(e) => setField(ri, "City", e.target.value)} />
      </FieldWrap>
      <FieldWrap label="Repair Type">
        <input style={s.input} value={getField(row, "Repair Type")} onChange={(e) => setField(ri, "Repair Type", e.target.value)} />
      </FieldWrap>
      <FieldWrap label="Description" fullWidth>
        <textarea style={{ ...s.input, height: 56, resize: "vertical" }}
          value={getField(row, "Description")} onChange={(e) => setField(ri, "Description", e.target.value)} />
      </FieldWrap>
      {row["File Attachment"] && (
        <FieldWrap label="Attachment" fullWidth>
          {row["File Attachment"].split("\n").map((url, i) => (
            <a key={i} href={url.trim()} target="_blank" rel="noreferrer"
              style={{ color: "#60a5fa", fontSize: 12, display: "block" }}>File {i + 1}</a>
          ))}
        </FieldWrap>
      )}

      {/* ── Diagnostics fields (Stage 2) consolidated into Stage 1 card ── */}
      <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #1e2d3d", margin: "4px 0 8px", paddingTop: 10 }}>
        <div style={{ fontSize: 10, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          Diagnostics
        </div>
      </div>
      <FieldWrap label="Repair Category">
        <Select size="small" variant="outlined" value={getField(row, "Repair Category")}
          onChange={(e) => setField(ri, "Repair Category", e.target.value)} sx={muiSx}>
          {Object.keys(categoriesAndSubcategories).map((c, i) => <MenuItem key={i} value={c}>{c}</MenuItem>)}
        </Select>
      </FieldWrap>
      <FieldWrap label="Assigned To">
        <Select size="small" variant="outlined" value={getField(row, "Assigned To Dashboard")}
          onChange={(e) => setField(ri, "Assigned To Dashboard", e.target.value)} sx={muiSx}>
          {apiData.users.map((n, i) => <MenuItem key={i} value={n}>{n}</MenuItem>)}
        </Select>
      </FieldWrap>
      <FieldWrap label="Repair Needed" fullWidth>
        <input style={s.input} value={getField(row, "Repair Needed")}
          onChange={(e) => setField(ri, "Repair Needed", e.target.value)} />
      </FieldWrap>
    </div>
  );

  if (stage.key === "STAGE_2") return (
    <div style={s.fieldsGrid}>
      <FieldWrap label="Driver Name">
        <Select size="small" variant="outlined" value={getField(row, "Driver Name")}
          onChange={(e) => setField(ri, "Driver Name", e.target.value)} sx={muiSx}>
          {apiData.drivers.map((n, i) => <MenuItem key={i} value={n}>{n}</MenuItem>)}
        </Select>
      </FieldWrap>
      <FieldWrap label="Repair Category">
        <Select size="small" variant="outlined" value={getField(row, "Repair Category")}
          onChange={(e) => setField(ri, "Repair Category", e.target.value)} sx={muiSx}>
          {Object.keys(categoriesAndSubcategories).map((c, i) => <MenuItem key={i} value={c}>{c}</MenuItem>)}
        </Select>
      </FieldWrap>
      <FieldWrap label="Repair Needed" fullWidth>
        <input style={s.input} value={getField(row, "Repair Needed")} onChange={(e) => setField(ri, "Repair Needed", e.target.value)} />
      </FieldWrap>
      <FieldWrap label="Assigned To">
        <Select size="small" variant="outlined" value={getField(row, "Assigned To Dashboard")}
          onChange={(e) => setField(ri, "Assigned To Dashboard", e.target.value)} sx={muiSx}>
          {apiData.users.map((n, i) => <MenuItem key={i} value={n}>{n}</MenuItem>)}
        </Select>
      </FieldWrap>
    </div>
  );

  if (stage.key === "STAGE_3") {
    const selectedState     = editState["State"] ?? row.State;
    const filteredProviders = apiData.providers.filter((p) => p.State === selectedState);
    const currentProvider   = editState["Service Provider"] ?? row["Service Provider"];
    const providerData      = apiData.providers.find((p) => p["Service Provider"] === currentProvider);
    const displayPhone      = editState["Phone Number"] ?? providerData?.["Phone Number"] ?? row["Phone Number"] ?? "";
    const handleProviderChange = (val) => {
      const pd = apiData.providers.find((p) => p["Service Provider"] === val);
      setField(ri, "Service Provider", val);
      if (pd) setField(ri, "Phone Number", pd["Phone Number"]);
    };
    return (
      <div style={s.fieldsGrid}>
        <FieldWrap label="State">
          <Select size="small" variant="outlined" value={getField(row, "State")}
            onChange={(e) => setField(ri, "State", e.target.value)} sx={muiSx}>
            {apiData.states.map((n, i) => <MenuItem key={i} value={n}>{n}</MenuItem>)}
          </Select>
        </FieldWrap>
        <FieldWrap label="Service Provider">
          <Select size="small" variant="outlined" value={getField(row, "Service Provider")}
            onChange={(e) => handleProviderChange(e.target.value)} sx={muiSx}>
            {filteredProviders.map((p, i) => <MenuItem key={i} value={p["Service Provider"]}>{p["Service Provider"]}</MenuItem>)}
          </Select>
        </FieldWrap>
        <FieldWrap label="Phone #" fullWidth>
          <span style={{ fontSize: 13, color: "#60a5fa" }}>{displayPhone || "—"}</span>
        </FieldWrap>
        <FieldWrap label="ETA">
          <Select size="small" variant="outlined" value={getField(row, "ETA")}
            onChange={(e) => setField(ri, "ETA", e.target.value)} sx={muiSx}>
            {ETA_OPTIONS.map((v, i) => <MenuItem key={i} value={v}>{v}</MenuItem>)}
          </Select>
        </FieldWrap>
        <FieldWrap label="On-Location">
          <Select size="small" variant="outlined" value={getField(row, "On-Location")}
            onChange={(e) => setField(ri, "On-Location", e.target.value)} sx={muiSx}>
            <MenuItem value="Arrived">Arrived</MenuItem>
          </Select>
        </FieldWrap>
        <FieldWrap label="Total ($)">
          <input style={s.input} value={getField(row, "Total")}
            onChange={(e) => setField(ri, "Total", e.target.value)} placeholder="0.00" />
        </FieldWrap>
      </div>
    );
  }
  return null;
}

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

const s = {
  wrap:           { background: "#0f1923", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", position: "relative" },
  errorMsg:       { color: "#f87171", padding: 20, fontSize: 14 },
  toolbar:        { background: "#0d1822", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #1e2d3d" },
  toolbarTitle:   { fontSize: 14, fontWeight: 500, color: "#e2e8f0", flex: 1 },
  statPill:       { background: "#1a2533", border: "1px solid #2a3a4d", borderRadius: 6, padding: "5px 12px", display: "flex", alignItems: "center", gap: 6 },
  board:          { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, padding: "14px 16px", alignItems: "start" },
  col:            { background: "#111e2b", border: "1px solid #1e2d3d", borderRadius: 10, overflow: "hidden" },
  colHdr:         { padding: "12px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #1e2d3d" },
  colDot:         { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 },
  colName:        { fontSize: 12, fontWeight: 500, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: "0.06em", flex: 1 },
  colCount:       { fontSize: 11, padding: "2px 7px", borderRadius: 10, border: "1px solid #2a3a4d", background: "#1a2533" },
  colBody:        { padding: 10, display: "flex", flexDirection: "column", gap: 8, minHeight: 80 },
  emptyCol:       { padding: "20px 10px", textAlign: "center", fontSize: 12, color: "#2a3a4d" },
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
