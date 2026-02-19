import { createSignal, createMemo, Show, For } from "solid-js";

import { DBCreateConversation, DBCreateMessage } from "../../wailsjs/go/main/App";
import { getLlmParams } from '../helpers/Utils';
import { useProv } from "../helpers/Provider";
import { SettingsMenu } from '../ui/Components';

import SendIcon from "../icons/send.svg";
import LoadingIcon from "../icons/loading.svg";
import ClipIcon from "../icons/clip.svg";

const MessageBar = () => {
    const MAX_VISIBLE = 3;

    const [message, setMessage] = createSignal("");
    const [isLoading, setIsLoading] = createSignal(false);
    const [files, setFiles] = createSignal([]);
    const visibleFiles = createMemo(() => files().slice(0, MAX_VISIBLE));
    const hiddenFiles = createMemo(() => files().slice(MAX_VISIBLE));
    const hiddenCount = createMemo(() => Math.max(0, files().length - MAX_VISIBLE));
    const { convID, setConvID, chat, setChat, updateConvs, updateMsgs, ragEnabled, setRagEnabled } = useProv();

    // Texto y estados
    const formatText = (text) => {
        const index = text.indexOf("</think>");
        if (index === -1) return text.trim();
        return text.slice(index + "</think>".length).trim();
    };

    const clearOldMessage = () => {
        setMessage("");
    }

    const handleChange = (e) => {
        setMessage(e.currentTarget.value);
    };

    const updateChat = (newMessage) => {
        setChat([...chat(), newMessage]);
    }

    // Database
    const dbSaveMessage = async (id, role, content) => {
        try {
            await DBCreateMessage(id, role, content);
            return true;
        } catch (e) {
            return false;
        }
    }

    const dbCreateConversation = async (msg) => {
        try {
            // Guardar como nombre los primeros 60 caracteres
            const preview = msg.length > 60
                ? msg.slice(0, 60)
                : msg;

            const jsonStr = await DBCreateConversation(preview);
            const payload = JSON.parse(jsonStr);
            return payload.id;
        } catch (e) {
            return null;
        }
    }

    // Files
    const handleFiles = (fileList) => {
        const incoming = Array.from(fileList || []);
        const merged = [...files(), ...incoming].slice(0, 10); // Max 10 archivos
        setFiles(merged);
    }

    const removeFile = (idx) => {
        const next = [...files()];
        next.splice(idx, 1);
        setFiles(next);
    }

    // Buttons
    const handleSubmit = async (e) => {
        e.preventDefault();

        const userMessage = {
            "role": "user",
            "content": message()
        };

        // Validar si mensaje no está vacío
        if (!userMessage.content || userMessage.content.trim() === "") return;

        let apiUrl = "";
        const isRag = ragEnabled();
        if (isRag) {
            apiUrl = "http://127.0.0.1:8000/v1/chat/rag";
            if (files().length === 0) {
                alert("Error: Adjunta al menos un archivo en el modo RAG.");
                return;
            }
        } else {
            apiUrl = "http://127.0.0.1:8000/v1/chat/completions";
        }

        setIsLoading(true);
        try {
            const llmParams = getLlmParams();

            // Al utilizar modo RAG enviar archivos como multipart/form-data
            let apiRes;
            if (isRag) {
                const form = new FormData();

                // El campo "chat" es un json que contiene el mensaje y params
                const chatObj = {
                    messages: [userMessage],
                    params: llmParams,
                };
                form.append("chat", JSON.stringify(chatObj));
                form.append("sync", "true");

                // Adjuntar archivos al form-data
                files().forEach((f) => form.append("file0", f));

                apiRes = await fetch(apiUrl, {
                    method: "POST",
                    body: form,
                });
            } else {
                // Si no es RAG, enviar como JSON normal
                const payload = {
                    messages: [userMessage],
                    params: llmParams,
                };

                apiRes = await fetch(apiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                });
            }

            if (!apiRes.ok) {
                alert("Error: el servidor no ha respondido correctamente");
                return;
            }

            // Parsear la respuesta
            const data = await apiRes.json();

            // Validar respuesta del LLM
            const content = data.choices[0].message.content;
            if (typeof content !== "string" || content.trim() === "") {
                alert("Error: respuesta del LLM es inválida");
                return;
            }
            
            // Si es una nueva conversación, crear primero en BD
            let actualID = convID();
            if (chat().length == 0) {
                const newConvID = await dbCreateConversation(message());
                actualID = newConvID;
            }

            await dbSaveMessage(actualID, userMessage.role, userMessage.content);

            // Formatear respuesta del LLM
            const res = formatText(data.choices[0].message.content);
            const llmMessage = {
                "role": "assistant",
                "content": res
            };

            // Actualizar UI
            updateChat(userMessage);
            clearOldMessage();
            updateChat(llmMessage);

            await dbSaveMessage(actualID, llmMessage.role, llmMessage.content);

            // Actualizar listado de conversaciones y mensajes
            setConvID(actualID);
            await updateConvs();
            await updateMsgs();
            setFiles([]);
        } catch (err) {
            console.error('Error:', err);
            alert("Error: No se pudo conectar con el LLM, verifica tu conexión a internet");
        } finally {
            setIsLoading(false);
        }
    };

    // Keyboard
    const handleKeyboard = (e) => {
        if (e.isComposing) return;
        if (isLoading() || !message().trim()) return;

        if (e.key === 'Enter' && !e.shiftKey) {
            handleSubmit(e);
        }
    }

    return (
        <div
            class="mx-auto my-2 px-4 py-2 w-200 max-w-2xl sm:w-full border border-transparent rounded-xl"
            id='message-send'
        >
            {/* Input de archivos solo en modo RAG */}
            <Show when={ragEnabled()}>
                <div 
                    class="flex items-center gap-2 mb-2"
                    id="rag-files"
                >
                    <label 
                        class="cursor-pointer text-sm px-3 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                        id="files-btn"
                    >
                        <div class='flex gap-1'>
                            <ClipIcon />
                            <span>Adjuntar archivos</span>
                        </div>
                        <input
                            type="file"
                            multiple
                            class="hidden"
                            onChange={(e) => handleFiles(e.currentTarget.files)}
                            accept=".pdf,.md"
                        />
                    </label>
                    <div class="flex flex-wrap gap-1 justify-end overflow-visible grow">
                        {/* Chips visibles */}
                        <For each={visibleFiles()}>
                            {(f, i) => (
                                <span 
                                    class="text-xs px-2 py-1 rounded-md flex items-center gap-1 whitespace-nowrap"
                                    id="files"
                                >
                                    <span class="truncate max-w-[140px]" title={f.name}>
                                        {f.name}
                                    </span>
                                    <button
                                        class="hover:text-red-500"
                                        onClick={() => removeFile(i())}
                                        aria-label={`Quitar ${f.name}`}
                                        title="Quitar"
                                    >
                                        x
                                    </button>
                                </span>
                            )}
                        </For>

                        {/* Chip "+x" con popover si hay archivos que no caben en listado */}
                        <Show when={hiddenCount() > 0}>
                            <div class="relative group">
                                <span
                                    class="text-xs px-2 py-1 rounded-md whitespace-nowrap cursor-default select-none"
                                    id="files-plus"
                                    aria-haspopup="true"
                                    aria-expanded="false"
                                >
                                    +{hiddenCount()}
                                </span>

                                {/* Popover hacia arriba */}
                                <div
                                    class="
                                        absolute right-0 bottom-full mt-1 z-20 hidden group-hover:block group-focus-within:block
                                        w-64 max-h-48 overflow-auto
                                        rounded-lg border border-neutral-200 dark:border-neutral-700
                                        bg-white dark:bg-neutral-900 shadow-lg
                                        p-2
                                    "
                                    id="files-plus-extended-tlp"
                                    role="tooltip"
                                >
                                    <ul class="space-y-1">
                                        <For each={hiddenFiles()}>
                                            {(hf) => (
                                            <li
                                                class="text-sm px-2 py-1 rounded-md truncate"
                                                id="files-plus-extended"
                                                title={hf.name}
                                            >
                                                {hf.name}
                                            </li>
                                            )}
                                        </For>
                                    </ul>
                                </div>
                            </div>
                        </Show>
                    </div>
                </div>
            </Show>
            <div class='flex'>
                <div 
                    class='w-10 h-10 flex items-center justify-center rounded-full'
                    id='settings-btn'
                >
                    <SettingsMenu 
                        ragEnabled={ragEnabled}
                        setRagEnabled={setRagEnabled}
                    />
                </div>
                <input
                    value={message()}
                    onInput={handleChange}
                    onKeyDown={(e) => handleKeyboard(e)}
                    type="text"
                    placeholder="Pregunta lo que quieras"
                    class="px-2 mr-4 grow outline-none"
                />
                <div>
                    {isLoading() ? (
                        <LoadingIcon class="w-10 h-10" />
                    ) : (
                        <button
                            onClick={handleSubmit}
                            class="w-10 h-10 flex items-center justify-center rounded-full"
                            id="send-btn"
                        >
                            <SendIcon class="w-6 h-6" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
};

export default MessageBar;