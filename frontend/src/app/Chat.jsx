import { createEffect, on } from 'solid-js';

import { DBGetMessagesByConversationID } from "../../wailsjs/go/main/App";
import { useProv } from "../helpers/Provider";
import { textParser } from '../helpers/Parser';
import MessageBar from '../components/MessageBar.jsx';
import "../styles/parser.css";

const Chat = () => {
    const { convID, chat, setChat } = useProv();

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
