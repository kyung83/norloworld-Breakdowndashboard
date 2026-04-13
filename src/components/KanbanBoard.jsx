import React, { useEffect, useState } from "react";
import useAxios from "axios-hooks";
import Spinner from "./Spinner";
import { useFilteredData } from "./BreakdownsContext";

const endPoint =
  "https://script.google.com/macros/s/AKfycbzX6QjhoOsurYDexFE99aCOl1NPJ-MTmjw2U8i7mhNuMaLlJUH7I6Gda0dAOAORnCbB/exec";

const stages = [
  { name: "ROADSIDE_SERVICE_REQUESTED", label: "Roadside Service Requested" },
  { name: "DIAGNOSTICS_TROUBLESHOOTING", label: "Diagnostics / Troubleshooting" },
  { name: "ROADSIDE_IN_PROGRESS", label: "Roadside In Progress" },
];

const stageColor = {
  ROADSIDE_SERVICE_REQUESTED: "border-blue-300 bg-blue-50",
  DIAGNOSTICS_TROUBLESHOOTING: "border-yellow-300 bg-yellow-50",
  ROADSIDE_IN_PROGRESS: "border-emerald-300 bg-emerald-50",
};

const priorityClass = (priority) => {
  const value = String(priority || "").toLowerCase();
  if (value.includes("high") || value.includes("urgent")) {
    return "bg-red-100 text-red-800 border-red-300";
  }
  if (value.includes("medium") || value.includes("normal") || value.includes("moderate")) {
    return "bg-orange-100 text-orange-800 border-orange-300";
  }
  if (value.includes("low") || value.includes("minor")) {
    return "bg-emerald-100 text-emerald-800 border-emerald-300";
  }
  return "bg-slate-100 text-slate-800 border-slate-300";
};

const buildUpdatePayload = (row) => ({
  breakdownDate: row["BreakDown Date"],
  city: row.City,
  repairType: row["Repair Type"],
  description: row.Description,
  driverName: row["Driver Name"],
  repairCategory: row["Repair Category"],
  repairNeeded: row["Repair Needed"],
  serviceProvider: row["Service Provider"],
  phoneNumber: row["Phone Number"],
  state: row.State,
  status: row.Status,
  sumbittedBy: row["Assigned To Dashboard"],
  total: row.Total,
  trailer: row["Trailer #"],
  truck: row["Truck #"],
  rowIndex: row.rowIndex,
  ETA: row.ETA,
  onLocation: row["On-Location"],
});

export default function KanbanBoard() {
  const [{ data, loading, error }] = useAxios(
    endPoint + "?route=getBreakdowns"
  );
  const [
    { data: postData, loading: postLoading, error: postError },
    executePost,
  ] = useAxios(
    {
      url: endPoint + "?route=editBreakdowns",
      method: "POST",
    },
    { manual: true }
  );

  const { filteredData, setFilteredData, setCategoriesAndSubcategories } =
    useFilteredData();
  const [cardUpdating, setCardUpdating] = useState(null);
  const [activeStage, setActiveStage] = useState("ROADSIDE_SERVICE_REQUESTED");

  useEffect(() => {
    if (filteredData && filteredData.length > 0) {
      return;
    }

    if (data) {
      const dataWithRowIndices = data.breakDowns.map((item, index) => ({
        ...item,
        rowIndex: index,
      }));

      const filteredRows = dataWithRowIndices.filter(
        (row) => row.Status !== "Complete"
      );

      setFilteredData(filteredRows);

      if (data.categories) {
        setCategoriesAndSubcategories(data.categories);
      }
    }
  }, [data, filteredData, setFilteredData, setCategoriesAndSubcategories]);

  const cardsByStage = stages.reduce((acc, stage) => {
    acc[stage.name] = filteredData
      ? filteredData.filter((row) => row.Status === stage.name)
      : [];
    return acc;
  }, {});

  const handleStageChange = async (row, newStatus) => {
    if (!row || row.Status === newStatus) return;

    setCardUpdating(row.rowIndex);
    const updatedRow = { ...row, Status: newStatus };

    try {
      await executePost({ data: JSON.stringify(buildUpdatePayload(updatedRow)) });
      setFilteredData((current) =>
        current.map((item) =>
          item.rowIndex === row.rowIndex ? { ...item, Status: newStatus } : item
        )
      );
    } catch (updateError) {
      console.error("Error updating card status:", updateError);
    } finally {
      setCardUpdating(null);
    }
  };

  if (loading || !filteredData) return <Spinner />;

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
        Error cargando los breakdowns. Revisa la consola para más detalles.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        {stages.map((stage) => (
          <div
            key={stage.name}
            className={`rounded-2xl border p-4 shadow-sm ${stageColor[stage.name]}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {stage.label}
                </h2>
                <p className="text-xs text-slate-600">
                  {cardsByStage[stage.name]?.length ?? 0} cases
                </p>
              </div>
              <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                {cardsByStage[stage.name]?.length ?? 0}
              </span>
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {stages.map((stage) => (
          <div
            key={stage.name}
            className="flex min-h-[24rem] flex-col rounded-3xl border bg-slate-50 p-4 shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {stage.label}
                </p>
                <p className="text-xs text-slate-500">
                  {cardsByStage[stage.name]?.length ?? 0} open cases
                </p>
              </div>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1 pb-2">
              {cardsByStage[stage.name]?.map((row) => {
                const priority =
                  row.Priority || row.priority || row.Urgency || row["Priority"] ||
                  row["Priority Level"] || row.Severity;
                const isFirstStage = stage.name === stages[0].name;
                const isLastStage = stage.name === stages[stages.length - 1].name;
                return (
                  <article
                    key={row.rowIndex}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {row.Description || row["Repair Type"] || "No description"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {row.City || row.State ? `${row.City ?? ""}${row.City && row.State ? ", " : ""}${row.State ?? ""}` : "No location"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${priorityClass(
                            priority
                          )}`}
                        >
                          {priority ? String(priority) : "Priority unknown"}
                        </span>
                      </div>

                      <div className="grid gap-2 text-xs text-slate-600">
                        {row["Driver Name"] && (
                          <div>{`Driver: ${row["Driver Name"]}`}</div>
                        )}
                        {row["Truck #"] && <div>{`Truck: ${row["Truck #"]}`}</div>}
                        {row["Trailer #"] && <div>{`Trailer: ${row["Trailer #"]}`}</div>}
                        {row.ETA && <div>{`ETA: ${row.ETA}`}</div>}
                      </div>

                      <div className="space-y-2">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleStageChange(
                                row,
                                stages[Math.max(0, stages.findIndex((s) => s.name === stage.name) - 1)].name
                              )
                            }
                            disabled={isFirstStage || cardUpdating === row.rowIndex}
                            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Back
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleStageChange(
                                row,
                                stages[Math.min(stages.length - 1, stages.findIndex((s) => s.name === stage.name) + 1)].name
                              )
                            }
                            disabled={isLastStage || cardUpdating === row.rowIndex}
                            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Forward
                          </button>
                        </div>
                        <select
                          value={row.Status}
                          onChange={(event) => handleStageChange(row, event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        >
                          {stages.map((stageOption) => (
                            <option key={stageOption.name} value={stageOption.name}>
                              {stageOption.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {cardUpdating === row.rowIndex && (
                        <div className="text-xs text-slate-500">Saving...</div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
