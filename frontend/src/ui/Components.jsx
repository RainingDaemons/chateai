import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { Dialog } from "@kobalte/core/dialog";
import { Switch } from "@kobalte/core/switch";
import { Toast, toaster } from "@kobalte/core";
import { createSignal, createMemo } from "solid-js";
import { Portal } from "solid-js/web";

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

                        {/* Toggle para Modo RAG */}
                        <div class="flex justify-between items-center">
                            <span>Modo RAG</span>
                            <Switch
                                id="rag-switch"
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
                    </div>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu>
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
                <Dialog.Overlay class="fixed inset-0 bg-black/50 backdrop-blur-sm" />

                <div class="fixed inset-0 flex items-start justify-center mt-20">
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

export { OptionsMenu, SettingsMenu, SearchModal, CreditsModal, ToastHost, ConnectionToast };
