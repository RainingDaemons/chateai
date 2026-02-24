import { createEffect, onMount, onCleanup, on } from 'solid-js';

import { DBGetMessagesByConversationID, ReadLocalFile } from "../../wailsjs/go/main/App";
import { useProv } from "../helpers/Provider";
import { textParser } from '../helpers/Parser';
import MessageBar from '../components/MessageBar.jsx';
import "../styles/parser.css";

const Chat = () => {
    const { convID, chat, setChat, ragEnabled, docsDir } = useProv();

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

    onMount(() => {
        const clickHandler = async (e) => {
            const a = e.target.closest?.('.rag-local-link');
            if (!a) return;
            const localPath = a.dataset?.localPath;
            if (!localPath) return;

            e.preventDefault();

            try {
                // Leer archivo desde el backend
                const payload = await ReadLocalFile(localPath);
                const { name, mime, dataBase64 } = payload;

                // Convertir base64 a bytes
                const byteChars = atob(dataBase64);
                const byteNums = new Array(byteChars.length);
                for (let i = 0; i < byteChars.length; i++) {
                    byteNums[i] = byteChars.charCodeAt(i);
                }
                const bytes = new Uint8Array(byteNums);

                // Crear Blob y URL
                const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
                const url = URL.createObjectURL(blob);

                // Abrir en nueva pestaña si el MIME lo permite
                const canPreview = /^text\/|^image\/|^application\/pdf$/.test(mime);
                if (canPreview) {
                    window.open(url, '_blank', 'noopener');
                } else {
                    // Forzar descarga
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = name || 'archivo';
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                }

                // Eliminar url para liberar recursos
                setTimeout(() => URL.revokeObjectURL(url), 60_000);
            } catch (err) {
                console.error('Error: No se pudo obtener el archivo:', err);
            }
        };

        document.addEventListener('click', clickHandler);
        onCleanup(() => document.removeEventListener('click', clickHandler));
    });

    return (
        <>
            {chat().length < 1 ? (
                <div class='w-full h-full flex flex-col justify-center items-center'>
                    <h1 class="mb-6 text-center text-2xl font-semibold">¿Por dónde empezamos?</h1>
                    <MessageBar />
                </div>
            ) : (
                <>
                    <div class='w-full h-full flex flex-col relative'>
                        <div
                            class={`
                                flex-1 overflow-y-auto px-4
                                ${ragEnabled() ? 'pb-24' : 'pb-16'}
                            `}
                            id='chat-list'
                        >
                            {chat().map((msg, index) => {
                                const isMd = hasMarkdown(msg.content);
                                const parsedHtml = isMd ? textParser(msg.content, docsDir()) : null;

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
                                    class='rounded-xl'
                                    id='message-send'
                                >
                                    <MessageBar />
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
