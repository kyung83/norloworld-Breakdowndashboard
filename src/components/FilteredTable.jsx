import React, { useState, useEffect, useCallback } from "react";
import useAxios from "axios-hooks";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import Spinner from "./Spinner";
import { DataGrid } from "@mui/x-data-grid";
import { Select, MenuItem, TextField } from "@mui/material";
import CustomTextFieldEditor from "./customTextFieldEditor";
import { useFilteredData } from "./BreakdownsContext";

dayjs.extend(isBetween);

const endPoint =
  "https://script.google.com/macros/s/AKfycbzX6QjhoOsurYDexFE99aCOl1NPJ-MTmjw2U8i7mhNuMaLlJUH7I6Gda0dAOAORnCbB/exec";

export default function FilteredTable() {
  const [{ data: dataTypes, loading: typeLoading, error: TypeError }] =
    useAxios(endPoint);
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
  const {
    filteredData,
    setFilteredData,
    categoriesAndSubcategories,
    setCategoriesAndSubcategories,
  } = useFilteredData();
  const [rowModesModel, setRowModesModel] = useState({});
  const [updatingRow, setUpdatingRow] = useState(false);

  const [selectedETA, setSelectedETA] = useState("");

  const [editStates, setEditStates] = useState({});

  const [isEditingRow, setIsEditingRow] = useState(false);

  const [currentStage, setCurrentStage] = useState(
    "ROADSIDE_SERVICE_REQUESTED"
  );

  const [updateKey, setUpdateKey] = useState(0);

  useEffect(() => {
    if (filteredData && filteredData.length > 0) {
      console.log("Usando datos del contexto global");
    } else if (data) {
      const dataWithRowIndices = data.breakDowns.map((item, index) => ({
        ...item,
        rowIndex: index,
      }));

      const filteredRows = dataWithRowIndices.filter(
        (row) => row.Status !== "Complete"
      );

      setFilteredData(filteredRows);

      if (data.categories) {
        const categoryData = data.categories;
        setCategoriesAndSubcategories(categoryData);
      }

      console.log("Cargando datos desde la API");
    }
  }, [data, filteredData, setFilteredData, setCategoriesAndSubcategories]);

  if (loading || typeLoading) return <Spinner />;

  const processRowUpdate = async (newRow, oldRow) => {
    if (newRow.Total && toString(newRow.Total).startsWith("$")) {
      newRow.Total = newRow.Total.substring(1);
    }

    if (updatingRow) {
      console.log("Una actualización está en curso. Por favor, espera.");
      return;
    }

    setUpdatingRow(true);

    const updatedRow = {
      ...newRow,
      ...(editStates[newRow.rowIndex] || {}),
    };

    console.log(editStates);

    const body = {
      breakdownDate: updatedRow["BreakDown Date"],
      city: updatedRow.City,
      repairType: updatedRow["Repair Type"],
      description: updatedRow["Description"],
      driverName: updatedRow["Driver Name"],
      repairCategory: updatedRow["Repair Category"],
      repairNeeded: updatedRow["Repair Needed"],
      serviceProvider: updatedRow["Service Provider"],
      phoneNumber: updatedRow["Phone Number"],
      state: updatedRow.State,
      status: updatedRow.Status,
      sumbittedBy: updatedRow["Assigned To Dashboard"],
      total: updatedRow.Total,
      trailer: updatedRow["Trailer #"],
      truck: updatedRow["Truck #"],
      rowIndex: updatedRow.rowIndex,
      ETA: updatedRow["ETA"],
      onLocation: updatedRow["On-Location"],
    };

    try {
      console.log("por hacer post", body);
      await executePost({
        data: JSON.stringify(body),
      });
      console.log("post hecho");

      setFilteredData((currentFilteredData) => {
        const newData = currentFilteredData.map((row) =>
          row.rowIndex === newRow.rowIndex ? { ...row, ...updatedRow } : row
        );

        console.log("newData after update", newData);
        return newData;
      });

      setUpdateKey((prevKey) => prevKey + 1);
      console.log(prevKey);
      setUpdatingRow(false);
    } catch (error) {
      console.error("Error actualizando la fila:", error);
      setUpdatingRow(false);
      return oldRow;
    }

    return updatedRow;
  };

  const columnsByStage = {
    ROADSIDE_SERVICE_REQUESTED: [
      {
        field: "BreakDown Date",
        headerName: "Breakdown Date",
        width: 120,
        editable: true,
        renderCell: (params) => {
          return <div>{dayjs(params.value).format("YYYY-MM-DD")}</div>;
        },
        renderEditCell: (params) => {
          const id = params.id;
          const value = dayjs(
            editStates[id]?.["BreakDown Date"] || params.value
          ).format("YYYY-MM-DD");
          const isValidDate = (dateString) => {
            return !!dayjs(dateString, "YYYY-MM-DD", true).isValid();
          };
          const handleDateChange = (e) => {
            const newValue = e.target.value;

            if (isValidDate(newValue)) {
              const updatedEditStates = { ...editStates };
              updatedEditStates[id] = {
                ...updatedEditStates[id],
                "BreakDown Date": newValue,
              };
              setEditStates(updatedEditStates);
            }
          };

          return (
            <TextField
              type="date"
              value={value}
              onChange={handleDateChange}
              InputProps={{
                inputProps: {
                  max: dayjs().format("YYYY-MM-DD"), // Optional: set max date if needed
                },
              }}
            />
          );
        },
      },
      {
        field: "Driver Name",
        headerName: "Driver Name",
        width: 200,
        editable: true,
        renderHeader: (params) => <strong>{params.colDef.headerName}</strong>,
        renderCell: (params) => {
          return <div style={{ fontWeight: "bold" }}>{params.value}</div>;
        },
        renderEditCell: (params) => {
          const id = params.id;
          return (
            <Select
              value={editStates[id]?.["Driver Name"] || params.value || ""}
              onChange={(e) => {
                const updatedEditStates = { ...editStates };
                updatedEditStates[id] = {
                  ...updatedEditStates[id],
                  "Driver Name": e.target.value,
                };
                setEditStates(updatedEditStates);
              }}
            >
              {data.drivers.map((name, index) => (
                <MenuItem key={index} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          );
        },
      },
      {
        field: "Truck #",
        headerName: "Truck #",
        width: 100,
        editable: true,
        renderEditCell: (params) => {
          const id = params.id;
          const value = editStates[id]?.["Truck #"] || params.value || "";

          return (
            <CustomTextFieldEditor
              id={id}
              value={value}
              onChange={(id, newValue) => {
                const updatedEditStates = { ...editStates };
                updatedEditStates[id] = {
                  ...updatedEditStates[id],
                  "Truck #": newValue,
                };
                setEditStates(updatedEditStates);
              }}
            />
          );
        },
      },
      {
        field: "Trailer #",
        headerName: "Trailer #",
        width: 100,
        editable: true,
        renderEditCell: (params) => {
          const id = params.id;
          const value = editStates[id]?.["Trailer #"] || params.value || "";

          return (
            <CustomTextFieldEditor
              id={id}
              value={value}
              onChange={(id, newValue) => {
                const updatedEditStates = { ...editStates };
                updatedEditStates[id] = {
                  ...updatedEditStates[id],
                  "Trailer #": newValue,
                };
                setEditStates(updatedEditStates);
              }}
            />
          );
        },
      },
      {
        field: "State",
        headerName: "State",
        width: 100,
        editable: true,
        renderCell: (params) => {
          return <div>{params.value}</div>;
        },
        renderEditCell: (params) => {
          const id = params.id;
          return (
            <Select
              value={editStates[id]?.["State"] || params.value || ""}
              onChange={(e) => {
                const updatedEditStates = { ...editStates };
                updatedEditStates[id] = {
                  ...updatedEditStates[id],
                  State: e.target.value,
                };
                setEditStates(updatedEditStates);
              }}
            >
              {data.states.map((name, index) => (
                <MenuItem key={index} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          );
        },
      },
      {
        field: "City",
        headerName: "City",
        width: 150,
        editable: true,
        renderEditCell: (params) => {
          const id = params.id;
          const value = editStates[id]?.["City"] || params.value || "";

          return (
            <CustomTextFieldEditor
              id={id}
              value={value}
              onChange={(id, newValue) => {
                const updatedEditStates = { ...editStates };
                updatedEditStates[id] = {
                  ...updatedEditStates[id],
                  City: newValue,
                };
                setEditStates(updatedEditStates);
              }}
            />
          );
        },
      },
      {
        field: "Repair Type",
        headerName: "Repair Type",
        width: 180,
        editable: true,
        renderEditCell: (params) => {
          const id = params.id;
          const value = editStates[id]?.["Repair Type"] || params.value || "";

          return (
            <CustomTextFieldEditor
              id={id}
              value={value}
              onChange={(id, newValue) => {
                const updatedEditStates = { ...editStates };
                updatedEditStates[id] = {
                  ...updatedEditStates[id],
                  "Repair Type": newValue,
                };
                setEditStates(updatedEditStates);
              }}
            />
          );
        },
      },
      {
        field: "File Attachment",
        headerName: "File Attachment",
        width: 120,
        editable: false,
        renderCell: (params) => {
          const attachments = params.value ? params.value.split("\n") : [];
          return (
            <>
              {attachments.map((attachment, index, array) => (
                <span key={index}>
                  <a
                    href={attachment.trim()}
                    target="_blank"
                    rel="noreferrer"
                  >
                    File {index + 1}
                  </a>
                  {index < array.length - 1 && <span style={{ margin: '0 5px' }}>,</span>}
                </span>
              ))}
            </>
          );
        },
        renderEditCell: (params) => {
          const id = params.id;
          const value = editStates[id]?.["File Attachment"] || params.value || "";
          return <CustomTextFieldEditor id={id} value={value} />;
        },
      },      
      {
        field: "Description",
        headerName: "Description",
        width: 150,
        editable: true,
        renderEditCell: (params) => {
          const id = params.id;
          const value = editStates[id]?.["Description"] || params.value || "";

          return (
            <CustomTextFieldEditor
              id={id}
              value={value}
              onChange={(id, newValue) => {
                const updatedEditStates = { ...editStates };
                updatedEditStates[id] = {
                  ...updatedEditStates[id],
                  Description: newValue,
                };
                setEditStates(updatedEditStates);
              }}
            />
          );
        },
      },
    ],
    DIAGNOSTICS_TROUBLESHOOTING: [
      {
        field: "Driver Name",
        headerName: "Driver Name",
        width: 200,
        editable: true,
        renderHeader: (params) => <strong>{params.colDef.headerName}</strong>,
        renderCell: (params) => {
          return <div style={{ fontWeight: "bold" }}>{params.value}</div>;
        },
        renderEditCell: (params) => {
          const id = params.id;
          return (
            <Select
              value={editStates[id]?.["Driver Name"] || params.value || ""}
              onChange={(e) => {
                const updatedEditStates = { ...editStates };
                updatedEditStates[id] = {
                  ...updatedEditStates[id],
                  "Driver Name": e.target.value,
                };
                setEditStates(updatedEditStates);
              }}
            >
              {data.drivers.map((name, index) => (
                <MenuItem key={index} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          );
        },
      },
      {
        field: "Repair Needed",
        headerName: "Repair Needed",
        width: 200,
        editable: true,
        renderEditCell: (params) => {
          const id = params.id;
          const value = editStates[id]?.["Repair Needed"] || params.value || "";

          return (
            <CustomTextFieldEditor
              id={id}
              value={value}
              onChange={(id, newValue) => {
                const updatedEditStates = { ...editStates };
                updatedEditStates[id] = {
                  ...updatedEditStates[id],
                  "Repair Needed": newValue,
                };
                setEditStates(updatedEditStates);
              }}
            />
          );
        },
      },
      {
        field: "Repair Category",
        headerName: "Repair Category",
        width: 200,
        editable: true,
        renderEditCell: (params) => {
          const id = params.id;
          return (
            <Select
              value={editStates[id]?.["Repair Category"] || params.value}
              onChange={(e) => {
                const updatedEditStates = { ...editStates };
                updatedEditStates[id] = {
                  ...updatedEditStates[id],
                  "Repair Category": e.target.value,
                };
                setEditStates(updatedEditStates);

              }}
            >
              {Object.keys(categoriesAndSubcategories).map(
                (category, index) => (
                  <MenuItem key={index} value={category}>
                    {category}
                  </MenuItem>
                )
              )}
            </Select>
          );
        },
      },
      {
        field: "Assigned To Dashboard",
        headerName: "Assigned To",
        width: 200,
        editable: true,
        renderCell: (params) => {
          return <div>{params.value}</div>;
        },
        renderEditCell: (params) => {
          const id = params.id;
          return (
            <Select
              value={
                editStates[id]?.["Assigned To Dashboard"] || params.value || ""
              }
              onChange={(e) => {
                const updatedEditStates = { ...editStates };
                updatedEditStates[id] = {
                  ...updatedEditStates[id],
                  "Assigned To Dashboard": e.target.value,
                };
                setEditStates(updatedEditStates);
              }}
            >
              {data.users.map((name, index) => (
                <MenuItem key={index} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          );
        },
      },
    ],
    ROADSIDE_IN_PROGRESS: [
      {
        field: "Driver Name",
        headerName: "Driver Name",
        width: 200,
        editable: true,
        renderHeader: (params) => <strong>{params.colDef.headerName}</strong>,
        renderCell: (params) => {
          return <div style={{ fontWeight: "bold" }}>{params.value}</div>;
        },
        renderEditCell: (params) => {
          const id = params.id;
          return (
            <Select
              value={editStates[id]?.["Driver Name"] || params.value || ""}
              onChange={(e) => {
                const updatedEditStates = { ...editStates };
                updatedEditStates[id] = {
                  ...updatedEditStates[id],
                  "Driver Name": e.target.value,
                };
                setEditStates(updatedEditStates);
              }}
            >
              {data.drivers.map((name, index) => (
                <MenuItem key={index} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          );
        },
      },
      {
        field: "State",
        headerName: "State",
        width: 100,
        editable: true,
        renderCell: (params) => {
          return <div>{params.value}</div>;
        },
        renderEditCell: (params) => {
          const id = params.id;
          return (
            <Select
              value={editStates[id]?.["State"] || params.value || ""}
              onChange={(e) => {
                const updatedEditStates = { ...editStates };
                updatedEditStates[id] = {
                  ...updatedEditStates[id],
                  State: e.target.value,
                };
                setEditStates(updatedEditStates);
              }}
            >
              {data.states.map((name, index) => (
                <MenuItem key={index} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          );
        },
      },
      {
        field: "Service Provider",
        headerName: "Service Provider",
        width: 200,
        editable: true,
        renderCell: (params) => {
          return <div>{params.value}</div>;
        },
        renderEditCell: (params) => {
          const id = params.id;
          const selectedState = editStates[id]?.["State"] || params.row.State;

          // Filtra los proveedores según el estado seleccionado
          const filteredProviders = data.providers.filter(
            (provider) => provider.State === selectedState
          );

          return (
            <Select
              value={editStates[id]?.["Service Provider"] || params.value || ""}
              onChange={(e) => {
                const selectedProvider = e.target.value;
                const providerData = data.providers.find(
                  (provider) =>
                    provider["Service Provider"] === selectedProvider
                );
                const phoneNumber = providerData
                  ? providerData["Phone Number"]
                  : "";

                const updatedEditStates = { ...editStates };
                updatedEditStates[id] = {
                  ...updatedEditStates[id],
                  "Service Provider": selectedProvider,
                  "Phone Number": phoneNumber, // Actualizar el número de teléfono aquí
                };
                setEditStates(updatedEditStates);
              }}
            >
              {filteredProviders.map((provider, index) => (
                <MenuItem key={index} value={provider["Service Provider"]}>
                  {provider["Service Provider"]} {/* Aquí está la corrección */}
                </MenuItem>
              ))}
            </Select>
          );
        },
      },
      {
        field: "Phone Number",
        headerName: "Phone Number",
        width: 200,
        editable: false, // Esto asegura que la columna no sea editable
        valueGetter: (params) => {
          // Suponiendo que el array data.providers tiene una propiedad phoneNumber para cada proveedor
          const selectedProvider = params.row["Service Provider"];
          const providerData = data.providers.find(
            (provider) => provider["Service Provider"] === selectedProvider
          );
          return providerData ? providerData["Phone Number"] : ""; // Devuelve el número de teléfono o una cadena vacía si no se encuentra
        },
        renderCell: (params) => {
          return <div>{params.value}</div>;
        },
      },
      {
        field: "ETA",
        headerName: "ETA",
        width: 100,
        editable: true,
        renderEditCell: (params) => {
          const id = params.id;
          const value = editStates[id]?.["ETA"] || params.value || "";

          return (
            <Select
              value={editStates[id]?.["ETA"] || selectedETA} // Use selectedETA as the value
              onChange={(e) => {
                const newValue = e.target.value;
                const updatedEditStates = { ...editStates };
                updatedEditStates[id] = {
                  ...updatedEditStates[id],
                  ETA: newValue,
                };
                setEditStates(updatedEditStates);

                // Update the selectedETA state
                setSelectedETA(newValue);
              }}
            >
              <MenuItem value="< 30 min">{"<"} 30 min</MenuItem>
              <MenuItem value="30 min">30 min</MenuItem>
              <MenuItem value="45 min">45 min</MenuItem>
              <MenuItem value="1 hour">1 hour</MenuItem>
              <MenuItem value="1.5 hours">1.5 hours</MenuItem>
              <MenuItem value="> 1.5 Hours">{">"} 1.5 Hours</MenuItem>
              <MenuItem value="Route to nearest service provider ETA 30 min">Route to nearest service provider ETA 30 min</MenuItem>
              <MenuItem value="Route to nearest service provider ETA 1 hour">Route to nearest service provider ETA 1 hour</MenuItem>
            </Select>
          );
        },
      },
      {
        field: "On-Location",
        headerName: "On-Location",
        width: 100,
        editable: true,
        renderEditCell: (params) => {
          const id = params.id;
          const value = editStates[id]?.["On-Location"] || params.value || "";

          return (
            <Select
              value={value}
              onChange={(e) => {
                const updatedEditStates = { ...editStates };
                updatedEditStates[id] = {
                  ...updatedEditStates[id],
                  "On-Location": e.target.value,
                };
                setEditStates(updatedEditStates);
              }}
            >
              <MenuItem value="Arrived">Arrived</MenuItem>
            </Select>
          );
        },
      },
      {
        field: "Total",
        headerName: "Total",
        width: 120,
        editable: true,
        renderCell: (params) => {
          return <div>{"$" + params.value}</div>;
        },
        renderEditCell: (params) => {
          const id = params.id;
          const value = editStates[id]?.["Total"] || params.value || "";

          return (
            <CustomTextFieldEditor
              id={id}
              value={value}
              onChange={(id, newValue) => {
                const updatedEditStates = { ...editStates };
                updatedEditStates[id] = {
                  ...updatedEditStates[id],
                  Total: newValue,
                };
                setEditStates(updatedEditStates);
              }}
            />
          );
        },
      },
      {
        field: "Status",
        headerName: "Status",
        width: 120,
        editable: false,
        renderEditCell: (params) => {
          const id = params.id;
          const value = editStates[id]?.["Status"] || params.value || "";

          return (
            <Select
              value={value}
              onChange={(e) => {
                const updatedEditStates = { ...editStates };
                updatedEditStates[id] = {
                  ...updatedEditStates[id],
                  Status: e.target.value,
                };
                setEditStates(updatedEditStates);
              }}
            ></Select>
          );
        },
      },
    ],
  };

  const stages = [
    { name: "ROADSIDE_SERVICE_REQUESTED", label: "Roadside Service Requested" },
    {
      name: "DIAGNOSTICS_TROUBLESHOOTING",
      label: "Diagnostics & Troubleshooting",
    },
    { name: "ROADSIDE_IN_PROGRESS", label: "Roadside In-Progress" },
  ];

  const columnsToShow = columnsByStage[currentStage];

  const handleStageChange = async (newStage) => {
    const editingRowId = Object.keys(rowModesModel).find(
      (id) => rowModesModel[id].mode === "edit"
    );

    if (editingRowId) {
      const editingRow = filteredData.find(
        (row) => row.rowIndex === Number(editingRowId)
      );

      if (editingRow) {
        setIsEditingRow(true);

        await processRowUpdate(editingRow, editingRow);
      }

      const newModel = { ...rowModesModel };
      newModel[editingRowId] = { mode: "view" };
      setRowModesModel(newModel);
      setIsEditingRow(true);
    }

    setCurrentStage(newStage);
    setIsEditingRow(false);
  };

  const handleProcessRowUpdate = async (newRow) => {
    const oldRow = filteredData.find((row) => row.rowIndex === newRow.rowIndex);

    try {
      const updatedRow = await processRowUpdate(newRow, oldRow);
      return updatedRow;
    } catch (error) {
      console.error("Error actualizando la fila:", error);
      return oldRow;
    }
  };

  const handleGridKeyDown = async (event) => {
    console.log(event);
    if (event.key === "Enter") {
      const editingRowId = Object.keys(rowModesModel).find(
        (id) => rowModesModel[id].mode === "edit"
      );

      console.log("editingRowId" + editingRowId);
      if (editingRowId) {
        const editingRow = filteredData.find(
          (row) => row.rowIndex === Number(editingRowId)
        );
        console.log("editingRow" + editingRow);

        if (editingRow) {
          await processRowUpdate(editingRow, editingRow);
        }
      }
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 ">
      <div className="my-4 flex flex-col sm:flex-row justify-between px-2">
        <div className="flex flex-wrap gap-2 sm:gap-4 sm:space-x-0  border-teal-500 pb-2 sm:pb-0 lg:space-x-16">
          {stages.map((stage) => (
            <button
              key={stage.name}
              onClick={() => handleStageChange(stage.name)}
              className={`py-2 px-4 text-teal-500 hover:text-teal-800 font-semibold ${
                currentStage === stage.name
                  ? "border-b-2 -mb-px border-teal-500"
                  : ""
              }`}
            >
              {stage.label}
            </button>
          ))}
        </div>
        <div className="mt-2 sm:mt-0">Total: {filteredData.length}</div>
      </div>

      <div className="mt-8">
        <div className="overflow-x-auto shadow-md sm:rounded-lg">
          <div className="inline-block min-w-full align-middle">
            <DataGrid
              rows={filteredData}
              getRowId={(row) => row.rowIndex}
              columns={columnsToShow}
              pageSize={5}
              rowsPerPageOptions={[5]}
              key={updateKey}
              disableSelectionOnClick
              editMode="row"
              rowModesModel={rowModesModel}
              onKeyDown={handleGridKeyDown}
              processRowUpdate={handleProcessRowUpdate}
              onProcessRowUpdateError={(error) => {
                console.error(
                  "Se produjo un error al procesar la actualización de la fila",
                  error
                );
              }}
              onRowModesModelChange={(newModel) => setRowModesModel(newModel)}
              className="bg-white p-4 rounded-lg"
              sx={{
                boxShadow: 2,
                ".MuiDataGrid-columnHeaders": {
                  backgroundColor: "rgba(255, 255, 255, 0.8)",
                  color: "#333",
                },
                ".MuiDataGrid-cell": {
                  borderBottom: "1px solid #e5e7eb",
                },
              }}
            />
          </div>
        </div>
      </div>
      <div className="px-4 sm:px-6 lg:px-8 ">
    {isEditingRow && (
      <div className="fixed top-0 left-0 z-50 w-full h-full bg-gray-900 bg-opacity-50 flex items-center justify-center">
        <Spinner className="text-green-500" />
      </div>
    )}
      </div>

    </div>
    
  );
}
