import { createSignal, createEffect, on } from 'solid-js';

import { DBCreateConversation, DBCreateMessage, DBGetMessagesByConversationID } from "../../wailsjs/go/main/App";
import { fetchWithTimeout, getLlmParams } from '../helpers/Utils';
import { useProv } from "../helpers/Provider";

import { textParser } from '../helpers/Parser';
import "../styles/parser.css";

import SendIcon from "../icons/send.svg";
import LoadingIcon from "../icons/loading.svg";

const Chat = () => {
    const [message, setMessage] = createSignal("");
    const [isLoading, setIsLoading] = createSignal(false);
    const { convID, setConvID, chat, setChat, updateConvs, updateMsgs } = useProv();

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
    const dbLoadChat = async (newID) => {
        try {
            const jsonStr = await DBGetMessagesByConversationID(newID);
            const payload = JSON.parse(jsonStr);
            setChat(payload.data);
        } catch (e) {
            setChat([]);
            console.log("Error: No se ha podido obtener el listado de conversaciones");
        }
    }

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

    // Buttons
    const handleSubmit = async (e) => {
        e.preventDefault();

        const userMessage = {
            "role": "user",
            "content": message()
        };

        const apiUrl = "http://127.0.0.1:8000/v1/chat/completions";

        setIsLoading(true);
        try {
            const llmParams = getLlmParams();
            const payload = {
                "messages": [userMessage],
                ...llmParams
            }
            
            const apiRes = await fetchWithTimeout(apiUrl, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

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

    // Detectar mensajes que vienen de formato markdown
    const hasMarkdown = (text) => {
        return /[#_*`\-]/.test(text);
    };

    // Cargar listado de mensajes cuando se obtenga la ID de un chat
    createEffect(
        on(
            convID,
            (newVal) => {
                if (newVal != null && newVal != 0) {
                    dbLoadChat(newVal);
                } else {
                    setChat([]);
                }
            },
            { defer: true }
        )
    );

    return (
        <>
            {chat().length < 1 ? (
                <div class='w-full h-full flex flex-col justify-center items-center'>
                    <h1 class="mb-6 text-center text-2xl font-semibold text-white">¿Por dónde empezamos?</h1>
                    <div 
                        class="mx-auto my-2 px-4 py-2 w-200 max-w-2xl sm:w-full flex border border-transparent rounded-full"
                        id='message-send'
                    >
                        <input
                            value={message()}
                            onInput={handleChange}
                            onKeyDown={(e) => handleKeyboard(e)}
                            type="text"
                            placeholder="Pregunta lo que quieras"
                            class="px-2 mr-4 grow outline-none text-white"
                        />
                        <div>
                            {isLoading() ? (
                                <LoadingIcon class="w-10 h-10 text-white" />
                            ) : (
                                <button
                                    onClick={handleSubmit}
                                    class="w-10 h-10 flex items-center justify-center rounded-full"
                                >
                                    <SendIcon class="w-6 h-6 text-black" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <div class='w-full h-full flex flex-col relative'>
                        <div 
                            class="flex-1 overflow-y-auto px-4 pb-16"
                            id='chat-list'
                        >
                            {chat().map((msg, index) => {
                                const isMd = hasMarkdown(msg.content);
                                const parsedHtml = isMd ? textParser(msg.content) : null;
                                
                                return (
                                    <div
                                        key={index}
                                        class={`w-fit mb-6 px-6 py-4 rounded-md 
                                            ${msg.role === 'user' ? 'msg-user ml-auto' : 'msg-llm mr-auto'}
                                        `}
                                    >
                                        {isMd ? (
                                            <div innerHTML={parsedHtml} class="markdown-item">
                                            </div>
                                        ) : (
                                            <p>{msg.content}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div class="absolute inset-x-0 bottom-0 z-50">
                            <div class="mx-auto max-w-2xl px-10 pb-[env(safe-area-inset-bottom)]">
                                <div 
                                    class="my-2 px-4 py-2 w-full flex rounded-full"
                                    id='message-send'
                                >
                                    <input
                                        value={message()}
                                        onInput={handleChange}
                                        onKeyDown={(e) => handleKeyboard(e)}
                                        type="text"
                                        placeholder="Pregunta lo que quieras"
                                        class="px-2 mr-4 grow outline-none text-white"
                                    />
                                    <div>
                                        {isLoading() ? (
                                            <LoadingIcon class="w-10 h-10 text-white" />
                                        ) : (
                                            <button
                                                onClick={handleSubmit}
                                                class="w-10 h-10 flex items-center justify-center rounded-full"
                                            >
                                                <SendIcon class="w-6 h-6 text-black" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export default Chat;
