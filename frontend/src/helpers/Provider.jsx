import { createContext, useContext } from 'solid-js';
import { createSignal, createEffect, onMount } from 'solid-js';
import { DBGetAllConversations, DBGetAllMessages } from "../../wailsjs/go/main/App";

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

    const [convID, setConvID] = createSignal(init);
    const [chat, setChat] = createSignal([]);
    const [convs, setConvs] = createSignal([]);
    const [msgs, setMsgs] = createSignal([]);

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

    // Carga inicial de conversaciones
    onMount(() => {
        updateConvs();
        updateMsgs();
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
        msgs, updateMsgs
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