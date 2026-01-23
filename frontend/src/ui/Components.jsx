import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { Dialog } from "@kobalte/core/dialog";
import { createSignal, createMemo } from "solid-js";

import pkg from "../../package.json";
import { useProv } from "../helpers/Provider";

import ChatIcon from "../icons/chat.svg";
import DotsIcon from "../icons/dots.svg";

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
                            <p>Aplicación desarrollada por 
                                <a 
                                    href="https://github.com/RainingDaemons"
                                    target="_blank"
                                    class="font-bold"
                                >
                                    RainingDaemons
                                </a>
                            </p>
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

export { OptionsMenu, SearchModal, CreditsModal };
