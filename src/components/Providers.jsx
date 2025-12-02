import { useState, useEffect } from "react";
import useAxios from "axios-hooks"; // Asegúrate de que estés importando useAxios desde axios-hooks
import ComboBox from "./ComboBox";
import Spinner from "./Spinner";
import { DataGrid } from '@mui/x-data-grid';
import { GridActionsCellItem, GridRowModes } from "@mui/x-data-grid";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import SaveIcon from "@mui/icons-material/Save";
import EditIcon from "@mui/icons-material/Edit";
import CustomTextFieldEditor from "./customTextFieldEditor";
import { Dialog, DialogTitle, DialogContent, TextField, Button, Select, MenuItem } from '@mui/material';


const endPoint =
    "https://script.google.com/macros/s/AKfycbzX6QjhoOsurYDexFE99aCOl1NPJ-MTmjw2U8i7mhNuMaLlJUH7I6Gda0dAOAORnCbB/exec";

export default function providers() {
    const [{ data, loading, error }] = useAxios(
        endPoint + "?route=getBreakdowns"
    );
    const [
        { data: postData, loading: postLoading, error: postError },
        executePost,
    ] = useAxios(
        {
            url: endPoint + "?route=editProviders",
            method: "POST",
        },
        { manual: true }
    );
    const [
        { data: postDataCreate, loading: postLoadingCreate, error: postErrorCreate },
        executePostCreate,
    ] = useAxios(
        {
            url: endPoint + "?route=createProviders",
            method: "POST",
        },
        { manual: true }
    );

    const [formData, setFormData] = useState({
        // Inicializa los campos del formulario
        provider: '',
        state: '',
        city: '',
        phoneNumber: '',
    });

    const handleFormChange = (event) => {
        // Actualiza los datos del formulario al escribir
        setFormData({
            ...formData,
            [event.target.name]: event.target.value,
        });
    };

    const [providers, setproviders] = useState([]);
    const [warning, setWarning] = useState(false);
    const [rowModesModel, setRowModesModel] = useState({});
    const [editedRow, setEditedRow] = useState({});
    const [editStates, setEditStates] = useState({});
    const [isModalOpen, setModalOpen] = useState(false);
    const [providerError, setProviderError] = useState(false);
    const [stateError, setStateError] = useState(false);
    const [cityError, setCityError] = useState(false);
    const [phoneNumberError, setPhoneNumberError] = useState(false);
    const [selectedState, setSelectedState] = useState("");
    const [filteredProviders, setFilteredProviders] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);


    useEffect(() => {
        if (data && data.providers) {
            setproviders(data.providers);
        }
    }, [data]);

    useEffect(() => {
        if (selectedState && data.providers) {
            const providersForState = data.providers.filter(provider => provider.State === selectedState);
            setFilteredProviders(providersForState);
        }
    }, [selectedState, data]);


    const columns = [
        { field: 'Service Provider', headerName: 'Provider', width: 200 },
        { field: 'State', headerName: 'State', width: 200 },
        { field: 'City', headerName: 'City', width: 200 },
        {
            field: "Phone Number",
            headerName: "Phone Number",
            width: 200,
            editable: true,
            renderEditCell: (params) => {
                const id = params.id;
                const value = editStates[id]?.["Phone Number"] || params.value || "";

                return (
                    <CustomTextFieldEditor
                        id={id}
                        value={value}
                        onChange={(id, newValue) => {
                            const updatedEditStates = { ...editStates };
                            updatedEditStates[id] = {
                                ...updatedEditStates[id],
                                "Phone Number": newValue,
                            };
                            setEditStates(updatedEditStates);
                        }}
                    />
                );
            },
        },
        {
            field: "actions",
            type: "actions",
            headerName: "Actions",
            width: 100,
            getActions: ({ id }) => {
                const isInEditMode = rowModesModel[id]?.mode === GridRowModes.Edit;

                if (isInEditMode) {
                    return [
                        <GridActionsCellItem
                            icon={<SaveIcon />}
                            label="Save"
                            onClick={handleSaveClick(id)}
                        />,
                    ];
                }

                return [
                    <GridActionsCellItem
                        icon={<EditIcon />}
                        label="Edit"
                        onClick={handleEditClick(id)}
                    />,
                ];
            },
        },
    ];


    const handleEditClick = (id) => () => {
        setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });
    };

    const handleCellChange = (params) => {
        const { id, field, props } = params;
        const value = props.value;
        setEditStates((prevEditStates) => ({
            ...prevEditStates,
            [id]: {
                ...prevEditStates[id],
                [field]: value
            }
        }));
    };

    const handleSaveClick = (id) => () => {
        console.log(editStates);

        const baseRow = providers.find((provider) => provider.rowIndex === id);
        const editsForThisRow = editStates[id] || {};
        const updatedRow = { ...baseRow, ...editsForThisRow };

        if (updatedRow) {
            const body = {
                editedData: updatedRow,
            };
            console.log(body);
            executePost({
                data: JSON.stringify(body),
            })
                .then((response) => {
                    if (response.status === 200) {
                        toast.success("Phone edited successfully");

                        // Actualizar el estado local 'providers' con los datos editados
                        const updatedProviders = providers.map(provider =>
                            provider.rowIndex === id ? updatedRow : provider
                        );
                        setproviders(updatedProviders);

                        // Actualiza también 'filteredProviders'
                        const updatedFilteredProviders = filteredProviders.map(provider =>
                            provider.rowIndex === id ? updatedRow : provider
                        );
                        setFilteredProviders(updatedFilteredProviders);

                    } else {
                        toast.error("Error");
                    }
                })
                .catch(() => {
                    toast.error("Error");
                });

            setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } });
        }
    };

    const handleButtonClick = () => {
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
    };

    const providerErrorText = "Provider is required.";
    const stateErrorText = "State is required.";
    const cityErrorText = "City is required.";
    const phoneNumberErrorText = "Phone Number is required.";


    const handleSubmit = () => {
        if (!formData.provider) {
            setProviderError(true);
        } else {
            setProviderError(false);
        }
        if (!formData.state) {
            setStateError(true);
        } else {
            setStateError(false);
        }
        if (!formData.city) {
            setCityError(true);
        } else {
            setCityError(false);
        }
        if (!formData.phoneNumber) {
            setPhoneNumberError(true);
        } else {
            setPhoneNumberError(false);
        }

        if (formData.provider && formData.state && formData.city && formData.phoneNumber) {
            setIsSubmitting(true);
            executePostCreate({
                data: JSON.stringify(formData),
            })
                .then((response) => {
                    if (response.status === 200) {
                        setFormData({
                            provider: '',
                            state: '',
                            city: '',
                            phoneNumber: '',
                        });

                        toast.success("Provider Added");
                        setIsSubmitting(false);
                        setModalOpen(false);
                    } else {
                        toast.error("Error");
                    }
                })
                .catch(() => {
                    toast.error("Error");
                });

        }
    };





    if (loading) return <Spinner />;
    if (error) return <div>Error al obtener los datos: {error.message}</div>;
    console.log(data)
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {warning && (
                <p className="text-sm text-red-600 mt-4 mb-4" id="email-error">
                    Complete the required fields *
                </p>
            )}

            <div className="flex justify-end w-full">
                <button
                    className="inline-flex rounded-md bg-primary p-1.5 text-primary-hover hover:bg-primary-hover outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-primary text-sm font-medium leading-6 text-white font-sans"
                    onClick={() => handleButtonClick()}
                >
                    Add Provider
                </button>
                <Dialog open={isModalOpen} onClose={() => setModalOpen(false)}>
                    <div className="mb-2 flex justify-center">
                        <DialogTitle>Add Provider</DialogTitle>
                    </div>
                    {isSubmitting ? (
                        <div className="spinner-container" style={{ width: '100%', height: '300px' }}>
                            <Spinner />
                        </div>
                    ) : (
                        <DialogContent>
                            <form>
                                <div className="mb-4">
                                    <TextField
                                        required
                                        error={providerError}
                                        helperText={providerError ? providerErrorText : ''}
                                        name="provider"
                                        label="Provider"
                                        value={formData.provider}
                                        onChange={handleFormChange}
                                        color="success"
                                        InputLabelProps={{
                                            shrink: true,
                                        }}
                                    />
                                </div>
                                <div className="mb-4">
                                    <div style={{ width: '100%' }}>
                                        <Select
                                            required
                                            error={stateError}
                                            helperText={stateError ? stateErrorText : ''}
                                            name="state"
                                            value={formData.state}
                                            onChange={handleFormChange}
                                            color="success"
                                            displayEmpty
                                            inputProps={{ 'aria-label': 'Without label' }}
                                            fullWidth  // Esto hará que el Select ocupe todo el ancho disponible
                                        >
                                            <MenuItem value="" disabled>
                                                Select State
                                            </MenuItem>
                                            {data.states.map((state, i) => (
                                                <MenuItem key={i} value={state}>
                                                    {state}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </div>

                                </div>
                                <div className="mb-4">
                                    <TextField
                                        required
                                        error={cityError}
                                        helperText={cityError ? cityErrorText : ''}
                                        name="city"
                                        label="City"
                                        value={formData.city}
                                        onChange={handleFormChange}
                                        color="success"
                                        InputLabelProps={{
                                            shrink: true,
                                        }}
                                    />
                                </div>
                                <div className="mb-4">
                                    <TextField
                                        required
                                        error={phoneNumberError}
                                        helperText={phoneNumberError ? phoneNumberErrorText : ''}
                                        name="phoneNumber"
                                        label="Phone Number"
                                        value={formData.phoneNumber}
                                        onChange={handleFormChange}
                                        color="success"
                                        InputLabelProps={{
                                            shrink: true,
                                        }}

                                    />
                                </div>
                                <div className="text-center"> {/* Centro el botón */}

                                    <Button onClick={handleSubmit} variant="contained" color="success">
                                        Add
                                    </Button>

                                </div>
                            </form>
                        </DialogContent>
                    )}
                </Dialog>

            </div>

            <div className="flex justify-between space-x-4">
                <ComboBox
                    title="* Select State"
                    items={data.states.map((state, i) => ({ id: i, name: state }))}
                    selectedPerson={{ name: selectedState }}
                    setSelectedPerson={(selectedItem) => setSelectedState(selectedItem.name)}
                />
            </div>
            <ToastContainer />
            <div style={{ height: 400, width: '80%', display: 'flex', justifyContent: 'center' }}>
                <DataGrid
                    rows={filteredProviders}
                    columns={columns}
                    pageSize={5}
                    rowsPerPageOptions={[5, 10]}
                    getRowId={(row) => row.rowIndex}
                    rowModesModel={rowModesModel}
                    onRowModesModelChange={(newModel) => setRowModesModel(newModel)}
                    onEditCellChangeCommitted={(params) => handleCellChange(params)}
                />
            </div>
        </div>
    );
}