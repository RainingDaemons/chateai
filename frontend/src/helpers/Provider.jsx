import { createContext, useContext } from 'solid-js';
import { createSignal, createEffect, onMount } from 'solid-js';
import { DBGetAllConversations, DBGetAllMessages, GetDocsDir } from "../../wailsjs/go/main/App";

import { fetchWithTimeout } from '../helpers/Utils';

const ctx = createContext();

const Provider = (props) => {
    // Inicializar conversation ID
    const init = (() => {
        try {
            const s = sessionStorage.getItem('convID');
            return s ? JSON.parse(s) : null;
        } catch {
            return null;
        }
    })();

    // Inicializar tema
    const initTheme = (() => {
        try {
            const saved = localStorage.getItem('theme');
            if (saved) return saved;
            // Detectar preferencia del sistema
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                return 'dark';
            }
            return 'light';
        } catch {
            return 'dark';
        }
    })();

    const [convID, setConvID] = createSignal(init);
    const [chat, setChat] = createSignal([]);
    const [convs, setConvs] = createSignal([]);
    const [msgs, setMsgs] = createSignal([]);
    const [theme, setTheme] = createSignal(initTheme);
    const [llmConn, setLlmConn] = createSignal(null);
    const [ragEnabled, setRagEnabled] = createSignal(false);
    const [docsDir, setDocsDir] = createSignal(null);

    // Función para alternar tema
    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    // Aplicar clase de tema al documento
    createEffect(() => {
        const currentTheme = theme();
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(currentTheme);
        try {
            localStorage.setItem('theme', currentTheme);
        } catch { }
    });

    // Función para cargar listado de conversaciones desde la BD
    const updateConvs = async () => {
        try {
            const jsonStr = await DBGetAllConversations();
            const payload = JSON.parse(jsonStr);
            setConvs(payload.data ?? []);
        } catch (e) {
            console.error("Error: No se pudo obtener el listado de conversaciones");
            setConvs([]);
        }
    };

    // Función para cargar listado de mensajes desde la BD
    const updateMsgs = async () => {
        try {
            const jsonStr = await DBGetAllMessages();
            const payload = JSON.parse(jsonStr);
            setMsgs(payload.data ?? []);
        } catch (e) {
            console.log("Error: No se ha podido obtener el listado de mensajes");
            setMsgs([]);
        }
    }

    // Función para verificar conexión con el LLM
    const pingLlm = async () => {
        try {
            const apiUrl = "http://127.0.0.1:8000/health";

            const apiRes = await fetchWithTimeout(apiUrl, 10, {
                method: "GET",
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!apiRes.ok) {
                setLlmConn(false);
                return false;
            } else {
                setLlmConn(true);
                return true;
            }
        } catch (err) {
            setLlmConn(false);
            return false;
        }
    }

    // Carga inicial de conversaciones y directorio data/docs
    onMount(async () => {
        try {
            const okConn = await pingLlm();
            if (okConn) {
                updateConvs();
                updateMsgs();
            }
            const path = await GetDocsDir();
            setDocsDir(path);
        } catch (e) {
            console.error('No se pudo obtener docsDir:', e);
            setDocsDir(null);
        }
    });

    // Limpiar chat
    const clearChat = () => {
        setChat([]);
        setConvID(0);
    }

    // Actualizar conversation ID
    createEffect(() => {
        try {
            sessionStorage.setItem('convID', JSON.stringify(convID()));
        } catch { }
    });

    const store = {
        convID, setConvID,
        chat, setChat, clearChat,
        convs, updateConvs,
        msgs, updateMsgs,
        theme, toggleTheme,
        llmConn,
        ragEnabled, setRagEnabled,
        docsDir, setDocsDir
    };

    return (
        <ctx.Provider value={store}>
            {props.children}
        </ctx.Provider>
    );
}

const useProv = () => {
    const lctx = useContext(ctx);
    if (!lctx) throw new Error('useProv must be used within <Provider>');
    return lctx;
}

export { Provider, useProv };