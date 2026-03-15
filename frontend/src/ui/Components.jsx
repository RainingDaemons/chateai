import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { Dialog } from "@kobalte/core/dialog";
import { Switch } from "@kobalte/core/switch";
import { Progress } from "@kobalte/core/progress";
import { Toast, toaster } from "@kobalte/core";
import { createSignal, createMemo, createEffect, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { ApplyNewUserSettings } from "../../wailsjs/go/main/App";

import pkg from "../../package.json";
import { useProv } from "../helpers/Provider";

import ChatIcon from "../icons/chat.svg";
import DotsIcon from "../icons/dots.svg";
import SettingsIcon from "../icons/settings.svg";

const OptionsMenu = (props) => {
    return (
        <DropdownMenu>
            <DropdownMenu.Trigger
                class="cursor-pointer"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Más opciones"
                title="Más opciones"
            >
                <DotsIcon class="w-6 h-6" />
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    placement="bottom-end"
                    gutter={8}
                    class="z-[1000px] w-[200px] max-w-[240px] rounded-lg border shadow-xl whitespace-nowrap"
                    id="options"
                >
                    <DropdownMenu.Item
                        class="cursor-pointer px-3 py-2 text-sm rounded-t-lg border border-transparent truncate option-item"
                        onSelect={props.onEdit}
                    >
                        Editar
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator
                        class="h-px my-1 bg-stone-700"
                    />
                    <DropdownMenu.Item
                        class="cursor-pointer px-3 py-2 text-sm rounded-b-lg border border-transparent truncate option-item delete"
                        onSelect={props.onDelete}
                    >
                        Eliminar
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu>
    );
}

const SettingsMenu = (props) => {
    return (
        <DropdownMenu>
            <DropdownMenu.Trigger
                class="cursor-pointer"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Ajustes"
                title="Ajustes"
            >
                <SettingsIcon class="w-8 h-8" />
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    placement="bottom-start"
                    gutter={8}
                    class="z-[2000] w-[220px] rounded-lg border shadow-xl"
                    id="settings"
                >
                    <div class="px-4 py-3 text-sm">
                        <p class="font-semibold mb-2">Configuración</p>

                        {/* Toggles */}
                        <div class="flex flex-col" id="toggles">
                            <div class="tgl-item">
                                <span>Subida de archivos</span>
                                <Switch
                                    checked={props.ragEnabled()}
                                    onChange={props.setRagEnabled}
                                    onClick={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    class="group inline-flex items-center outline-none"
                                >
                                    <Switch.Control
                                        class={`
                                            relative w-11 h-6 rounded-full transition-colors
                                            bg-gray-600
                                            data-[checked]:bg-blue-600
                                            focus-visible:ring-2 focus-visible:ring-blue-500/50
                                        `}
                                    >
                                        <Switch.Thumb
                                            class={`
                                                absolute top-[2px] left-[2px]
                                                w-5 h-5 rounded-full bg-white shadow
                                                transition-transform
                                                group-data-[checked]:translate-x-5
                                            `}
                                        />
                                    </Switch.Control>
                                </Switch>
                            </div>

                            <div class="tgl-item">
                                <span>Búsqueda web</span>
                                <Switch
                                    checked={props.netEnabled()}
                                    onChange={props.setNetEnabled}
                                    onClick={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    class="group inline-flex items-center outline-none"
                                >
                                    <Switch.Control
                                        class={`
                                            relative w-11 h-6 rounded-full transition-colors
                                            bg-gray-600
                                            data-[checked]:bg-blue-600
                                            focus-visible:ring-2 focus-visible:ring-blue-500/50
                                        `}
                                    >
                                        <Switch.Thumb
                                            class={`
                                                absolute top-[2px] left-[2px]
                                                w-5 h-5 rounded-full bg-white shadow
                                                transition-transform
                                                group-data-[checked]:translate-x-5
                                            `}
                                        />
                                    </Switch.Control>
                                </Switch>
                            </div>
                        </div>
                    </div>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu>
    );
}

const ApiConsumptionBar = (props) => {
    let minVal = 0;
    let maxVal = 1000;

    return (
        <Progress
            value={props.actualVal()}
            minValue={minVal}
            maxValue={maxVal}
            getValueLabel={({ value, max }) => `${max - value} Peticiones diarias disponibles`}
            class="w-60 mr-auto mb-2"
            id="api-progress-bar"
        >
            <div class="flex items-center justify-between text-sm">
                <Progress.ValueLabel class="progress__value-label" />
            </div>
            <Progress.Track
                class="
                    relative h-2 w-full overflow-hidden
                    rounded-md
                    ring-1 ring-black/10
                "
                id="progress-track"
            >
                <Progress.Fill
                    class="
                        h-full bg-blue-500
                        transition-[width] duration-300 ease-out
                    "
                    style={{ width: "var(--kb-progress-fill-width)" }}
                />
            </Progress.Track>
        </Progress>
    );
}

const SearchModal = (props) => {
    const [query, setQuery] = createSignal("");
    const { setConvID } = useProv();

    // Normaliza la prop
    const getMessages = () => {
        const v = typeof props.messages === "function" ? props.messages() : props.messages;
        return Array.isArray(v) ? v : [];
    };

    // Transformar fechas a formato ISO
    const formatDate = (str) => {
        if (!str || typeof str !== "string") return new Date(0).toISOString();
        const [d, t = "00:00:00"] = str.split(" ");
        const [dd, mm, yyyy] = d.split("-");
        return `${yyyy}-${mm}-${dd}T${t}`;
    }

    // Agrupar mensajes por conversación
    const conversations = createMemo(() => {
        const map = new Map();

        getMessages().forEach(msg => {
            if (!map.has(msg.conversation_id)) map.set(msg.conversation_id, []);
            map.get(msg.conversation_id).push(msg);
        });

        const convs = [...map.entries()].map(([id, msgs]) => {
            // Ordenar por fecha ascendente
            msgs.sort((a, b) => new Date(formatDate(a.created_at)) - new Date(formatDate(b.created_at)));

            // Primer mensaje del usuario, en caso contrario el primero disponible
            const firstUser = msgs.find(m => m.role === "user");
            const title = (firstUser?.content || msgs[0]?.content || "(sin título)").split("\n")[0].slice(0, 80);

            const last = msgs[msgs.length - 1];
            const lastDate = last ? new Date(formatDate(last.created_at)) : new Date(0);

            // Snippet = parte del último mensaje
            const snippet = (last?.content || "").slice(0, 140);

            return { id, title, snippet, lastDate, messages: msgs };
        });

        // Mostrar chats más recientes primero
        convs.sort((a, b) => b.lastDate - a.lastDate);
        return convs;
    });

    // Filtrar por búsqueda
    const results = createMemo(() => {
        const q = query().trim().toLowerCase();
        if (!q) return conversations();

        return conversations().filter(conv =>
            conv.messages.some(m => (m.content || "").toLowerCase().includes(q))
        );
    });

    // Seleccionar conversación
    const convSelected = (id) => {
        setConvID(id);
        props.onOpenChange(false);
    }

    return (
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110]" />
                <div class="fixed inset-0 flex items-start justify-center mt-20 z-[110]">
                    <Dialog.Content
                        class="z-300 w-full max-w-2xl rounded-xl shadow-xl border text-white"
                        id="search"
                    >
                        <div
                            class="px-4 py-2 flex border-b rounded-t-xl"
                            id="search-body"
                        >
                            <input
                                autofocus
                                type="text"
                                placeholder="Buscar chats..."
                                class="w-full px-4 py-3 focus:outline-none"
                                value={query()}
                                onInput={e => setQuery(e.currentTarget.value)}
                            />
                            <Dialog.CloseButton
                                onClick={() => setQuery("")}
                                class="ml-2 close-btn"
                            >
                                ✕
                            </Dialog.CloseButton>
                        </div>
                        <div class="p-4 max-h-80 overflow-y-auto">
                            {results().length > 0 && query() != "" ? (
                                <div id="results">
                                    {results().map((conv, index) => (
                                        <div
                                            class="flex items-center px-4 py-3 rounded-lg cursor-pointer res-item"
                                            onClick={() => convSelected(conv.id)}
                                        >
                                            <ChatIcon class="w-5 h-5 mr-3" />
                                            <div class="flex-1">
                                                <div class="font-semibold">
                                                    {conv.title}
                                                </div>

                                                <div class="text-neutral-400 text-sm mt-1 line-clamp-2">
                                                    {conv.snippet}
                                                </div>
                                            </div>
                                            <div class="text-xs text-white/40 ml-2">
                                                {conv.lastDate.toLocaleDateString("es-ES", {
                                                    day: "numeric",
                                                    month: "short"
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p class="text-neutral-400 px-4 py-6 text-center">
                                    Sin resultados
                                </p>
                            )}
                        </div>
                    </Dialog.Content>
                </div>
            </Dialog.Portal>
        </Dialog>
    );
}

const CreditsModal = (props) => {
    return (
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110]" />

                <div class="fixed inset-0 flex items-start justify-center mt-20 z-[110]">
                    <Dialog.Content
                        class="w-full max-w-lg rounded-xl shadow-xl border"
                        id="credits"
                    >
                        <div
                            class="flex justify-between px-6 py-4"
                            id="credits-title"
                        >
                            <h2 class="text-xl font-semibold">Créditos</h2>
                            <Dialog.CloseButton
                                class="close-btn"
                            >
                                ✕
                            </Dialog.CloseButton>
                        </div>

                        <div
                            class="p-6 space-y-3"
                            id="credits-body"
                        >
                            <div class="flex gap-1">
                                <span>Aplicación desarrollada por</span>
                                <a
                                    href="https://github.com/RainingDaemons"
                                    target="_blank"
                                    class="font-bold"
                                >
                                    RainingDaemons
                                </a>
                            </div>
                            <div>
                                <span>Agradecimientos especiales:</span>
                                <ul>
                                    <li>
                                        <a
                                            href="https://github.com/Coragg"
                                            target="_blank"
                                            class="font-bold"
                                        >
                                            Coragg
                                        </a>
                                    </li>
                                </ul>
                            </div>
                            <div class="flex justify-center">
                                <p>Versión: {pkg.version}</p>
                            </div>
                        </div>
                    </Dialog.Content>
                </div>
            </Dialog.Portal>
        </Dialog>
    );
};

const UserSettingsModal = (props) => {
    const { userSettings, setUserSettings } = useProv();
    const [newSettings, setNewSettings] = createSignal([]);
    const [originalSettings, setOriginalSettings] = createSignal([]);
    const [currentMenu, setCurrentMenu] = createSignal("general");
    const [unsavedChanges, setUnsavedChanges] = createSignal(false);

    /*
    * Extensiones
    */
    function normalizeExt(input) {
        let s = String(input || "").trim().toLowerCase();
        if (!s) return "";
        if (s.startsWith(".")) return s;
        return "." + s;
    }

    function isValidExt(ext) {
        return /^\.[a-z0-9]{1,10}$/.test(ext);
    }

    function getExts() {
        return Array.isArray(newSettings().server.allowed_exts)
            ? newSettings().server.allowed_exts
            : [];
    }

    function setExts(next) {
        setNewSettings(prev => ({
            ...prev,
            server: {
                ...prev.server,
                allowed_exts: next
            }
        }));
    }

    function addExt(raw) {
        const current = getExts();
        if (current.length >= 10) return; // límite máximo

        const ext = normalizeExt(raw);
        if (!ext || !isValidExt(ext)) return; // invalido

        // Evita duplicados
        const exists = current.some(e => e.toLowerCase() === ext.toLowerCase());
        if (exists) return;

        setExts([...current, ext]);
    }

    function removeExt(index) {
        const current = getExts();
        const next = current.filter((_, i) => i !== index);
        setExts(next);
    }

    // Maneja agregar una nueva extensión
    function handleChipAdd() {
        if (getExts().length >= 10) {
            alert("Error: se pueden agregar 10 extensiones como máximo");
            return;
        }
        const input = prompt('Introduce nueva extensión (sin punto): ');
        if (input == null) return;
        addExt(input);
    }

    /*
    * Acciones
    */
    function checkValuesEquality(a, b) {
        // Check if one is null
        if (typeof a !== typeof b) return false;
        if (a === null || b === null) return a === b;

        // Compare numbers or bool
        if ((typeof a === typeof b) && (typeof a === "number") && isNaN(a) && isNaN(b)) return true;
        if ((typeof a === typeof b) && (typeof a === "bool") && isNaN(a) && isNaN(b)) return true;
        
        // Compare strings
        if ((typeof a === typeof b) && (typeof a === "string") && (a.localeCompare(b) === 0)) return true;

        // Compare array
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) {
                if (!checkValuesEquality(a[i], b[i])) return false;
            }
            return true;
        }
        if (Array.isArray(a) || Array.isArray(b)) return false;

        // Compare objects
        if (typeof a === "object" && typeof b === "object") {
            const aKeys = Object.keys(a);
            const bKeys = Object.keys(b);
            if (aKeys.length !== bKeys.length) return false;
            for (const k of aKeys) {
                if (!b.hasOwnProperty(k)) return false;
                if (!checkValuesEquality(a[k], b[k])) return false;
            }
            return true;
        }

        return a === b;
    }

    function comparePath(original, edited, path) {
        let o = original;
        let e = edited;

        for (const k of path) {
            o = o?.[k];
            e = e?.[k];
            if (o === undefined && e === undefined) break;
        }

        return !checkValuesEquality(o, e);
    }

    const handleChange = (e, key) => {
        const input = e.currentTarget;
        const menu = currentMenu();
        
        // Procesar valores dependiendo del input
        let value;
        if (input.type === "checkbox") {
            value = input.checked;
        } else if (input.type === "number") {
            value = input.value === "" ? "" : Number(input.value);
        } else {
            value = input.value;
        }

        setNewSettings((prev) => {
            const next = {
                ...prev,
                [menu]: {
                    ...prev?.[menu],
                    [key]: value,
                },
            };

            // Compara solo la rama afectada
            const changedInPath = comparePath(originalSettings(), next, [menu, key]);

            if (changedInPath) {
                setUnsavedChanges(true);
            } else {
                setUnsavedChanges(!checkValuesEquality(originalSettings(), next));
            }

            return next;
        });
    }

    const handleSaveChanges = async () => {
        // Guardar cambios
        try {
            await ApplyNewUserSettings(newSettings());
        } catch (e) {
            alert("Error: No se ha podido actualizar la nueva configuración del usuario");
            console.log(e);
        }
    }

    createEffect(() => {
        if (userSettings().length != 0) {
            setNewSettings(userSettings());
            setOriginalSettings(userSettings());
            console.log(userSettings());
        }
    }, userSettings);

    return (
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110]" />

                <div class="fixed inset-0 flex items-start justify-center mt-20 z-[110]">
                    <Dialog.Content
                        class="w-[92vw] max-w-3xl md:max-w-5xl h-[80vh] md:h-[70vh] rounded-xl shadow-xl border"
                        id="user-settings"
                    >
                        <div
                            class="flex justify-between px-6 py-4"
                            id="user-settings-title"
                        >
                            <h2 class="text-xl font-semibold">Configuración</h2>
                            <Dialog.CloseButton
                                class="close-btn"
                            >
                                ✕
                            </Dialog.CloseButton>
                        </div>

                        <div
                            class="flex w-full h-full"
                            id="user-settings-body"
                        >
                            <aside
                                class="w-100 py-4 px-2"
                                id="options"
                            >
                                <div id="buttons" class="flex flex-col h-full">
                                    <div
                                        onClick={() => setCurrentMenu("general")}
                                        class="button-itm"
                                        classList={{
                                            "active": currentMenu() === "general"
                                        }}
                                    >
                                        <span>General</span>
                                    </div>
                                    <div
                                        onClick={() => setCurrentMenu("server")}
                                        class="button-itm"
                                        classList={{
                                            "active": currentMenu() === "server"
                                        }}
                                    >
                                        <span>Servidor</span>
                                    </div>
                                    <div
                                        onClick={() => setCurrentMenu("llm")}
                                        class="button-itm"
                                        classList={{
                                            "active": currentMenu() === "llm"
                                        }}
                                    >
                                        <span>LLM</span>
                                    </div>
                                    <Show when={unsavedChanges()}>
                                        <div
                                            onClick={() => handleSaveChanges()}
                                            class="save-btn"
                                        >
                                            <span>Guardar cambios</span>
                                        </div>
                                    </Show>
                                </div>
                            </aside>
                            <section
                                class="w-full p-4"
                                id="content"
                            >
                                {newSettings().length != 0 ? (
                                    <>
                                        <Show when={currentMenu() == "general"}>
                                            <div
                                                class="grid grid-cols-1 gap-x-4 gap-y-3 items-start sm:[grid-template-columns:160px_1fr]"
                                                id="grid-options"
                                            >
                                                <label>Directorio raíz</label>
                                                <input
                                                    type="text"
                                                    value={newSettings().general.root}
                                                    onInput={(e) => handleChange(e, "root")}
                                                />
                                                <label>Directorio LLM</label>
                                                <input
                                                    type="text"
                                                    value={newSettings().general.llm_model_dir}
                                                    onInput={(e) => handleChange(e, "llm_model_dir")}
                                                />
                                                <label>Directorio Embedding</label>
                                                <input
                                                    type="text"
                                                    value={newSettings().general.embedding_model_dir}
                                                    onInput={(e) => handleChange(e, "embedding_model_dir")}
                                                />
                                            </div>
                                        </Show>
                                        <Show when={currentMenu() == "server"}>
                                            <div
                                                class="grid grid-cols-1 gap-x-4 gap-y-3 items-start sm:[grid-template-columns:140px_1fr]"
                                                id="grid-options"
                                            >
                                                <label>Dtype</label>
                                                <input
                                                    type="text"
                                                    value={newSettings().server.dtype}
                                                    onInput={(e) => handleChange(e, "dtype")}
                                                />
                                                <label>Max Tokens</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={newSettings().server.max_tokens}
                                                    onInput={(e) => handleChange(e, "max_tokens")}
                                                />
                                                <label>Utilización GPU</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="1"
                                                    step="0.1"
                                                    value={newSettings().server.gpu_util}
                                                    onInput={(e) => handleChange(e, "gpu_util")}
                                                />
                                            </div>
                                            <div class="chips-itm">
                                                <label>Extensiones permitidas</label>
                                                <For each={getExts()}>
                                                    {(ext, idx) => (
                                                        <span class="chip">
                                                            {ext}
                                                            <button class="chip-x" onClick={() => removeExt(idx())}>x</button>
                                                        </span>
                                                    )}
                                                </For>
                                                <button class="chip-add" onClick={() => handleChipAdd()}>Agregar ext</button>
                                            </div>
                                        </Show>
                                        <Show when={currentMenu() == "llm"}>
                                            <div
                                                class="grid grid-cols-1 gap-x-4 gap-y-3 items-start sm:[grid-template-columns:220px_1fr]"
                                                id="grid-options"
                                            >
                                                <label>Mostrar pensamiento interno</label>
                                                <input
                                                    type="checkbox"
                                                    checked={newSettings().llm.show_internal_thinking}
                                                    onInput={(e) => handleChange(e, "show_internal_thinking")}
                                                />
                                                <label>Utilizar instruct de lenguaje</label>
                                                <input
                                                    type="checkbox"
                                                    checked={newSettings().llm.use_language_instruct}
                                                    onInput={(e) => handleChange(e, "use_language_instruct")}
                                                />
                                                <label>Language instruct</label>
                                                <textarea
                                                    rows="4"
                                                    cols="33"
                                                    value={newSettings().llm.language_instruct}
                                                    onInput={(e) => handleChange(e, "language_instruct")}
                                                />
                                                <label>Internal thinking instruct</label>
                                                <textarea
                                                    rows="4"
                                                    cols="33"
                                                    value={newSettings().llm.internal_thinking}
                                                    onInput={(e) => handleChange(e, "internal_thinking")}
                                                />
                                                <label>System prompt</label>
                                                <textarea
                                                    rows="4"
                                                    cols="33"
                                                    value={newSettings().llm.system_prompt}
                                                    onInput={(e) => handleChange(e, "system_prompt")}
                                                />
                                            </div>
                                        </Show>
                                    </>
                                ) : (
                                    <span>Cargando...</span>
                                )}
                            </section>
                        </div>
                    </Dialog.Content>
                </div>
            </Dialog.Portal >
        </Dialog >
    );
};

const ToastHost = () => {
    return (
        <Portal>
            <Toast.Region class="pointer-events-none fixed inset-0 z-[9999] flex">
                <div class="mx-auto mt-3 flex w-full max-w-[520px] justify-center">
                    <Toast.List class="flex w-full flex-col gap-2" />
                </div>
            </Toast.Region>
        </Portal>
    );
}

const ConnectionToast = ({ title, description, duration, variation } = {}) => {
    return toaster.show((props) => (
        <Toast.Root toastId={props.toastId} duration={duration}>
            <div
                class={`
                    pointer-events-auto w-full overflow-hidden rounded-md border shadow-md
                    ${variation == "success" ? 'border-emerald-300' : 'border-rose-300'}
                `}
                id="toast"
            >
                <div class="flex items-start gap-3 px-3 py-2">
                    <div class="flex-1">
                        <Toast.Title
                            class="font-medium"
                        >
                            {title}
                        </Toast.Title>
                        <Toast.Description
                            class="text-sm text-slate-600"
                            id="description"
                        >
                            {description}
                        </Toast.Description>
                    </div>

                    <Toast.CloseButton
                        class="rounded p-1"
                        aria-label="Cerrar"
                        id="close-btn"
                    >
                        x
                    </Toast.CloseButton>
                </div>

                <Toast.ProgressTrack class="w-full">
                    <Toast.ProgressFill
                        class={`
                            h-[5px] w-(--kb-toast-progress-fill-width) origin-left transition-transform ease-linear will-change-transform
                            ${variation == "success" ? 'bg-emerald-300' : 'bg-rose-300'}
                        `}
                        style={{
                            transform: "scaleX(var(--kb-toast-progress))",
                            transitionDuration: "var(--kb-toast-progress-duration)",
                        }}
                    />
                </Toast.ProgressTrack>
            </div>
        </Toast.Root>
    ));
}

export { OptionsMenu, SettingsMenu, ApiConsumptionBar, SearchModal, CreditsModal, UserSettingsModal, ToastHost, ConnectionToast };
