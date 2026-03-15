import { createSignal, createEffect, on } from 'solid-js';
import { DBDeleteConversation, DBUpdateConversationName } from "../../wailsjs/go/main/App";

import { useProv } from "../helpers/Provider";
import { OptionsMenu, SearchModal, CreditsModal, UserSettingsModal } from '../ui/Components';

import Logo from "../icons/logo.svg";
import SearchIcon from "../icons/search.svg";
import WriteIcon from "../icons/write.svg";
import SettingsIcon from "../icons/settings2.svg";
import SunIcon from "../icons/sun.svg";
import MoonIcon from "../icons/moon.svg";

const Conversations = () => {
    const [openModal, setOpenModal] = createSignal(false);
    const [openCredits, setOpenCredits] = createSignal(false);
    const [openUserSettings, setOpenUserSettings] = createSignal(false);
    const { convID, setConvID, clearChat, convs, updateConvs, msgs, updateMsgs, theme, toggleTheme, llmConn } = useProv();

    // Dropdown menu options
    const handleEdit = async (id) => {
        const newName = prompt("Nuevo nombre:");
        if (!newName) return;

        const cleanName = newName.trim();

        // Limitar a 80 caracteres
        if (cleanName.length > 60) {
            alert("Error: El nombre no puede superar los 60 caracteres");
            return;
        }

        try {
            await DBUpdateConversationName(id, cleanName);

            // Actualizar listado de conversaciones
            updateConvs();
        } catch (e) {
            alert("Error: No se ha podido actualizar el nombre de la conversación");
        }
    }

    const handleDelete = async (id) => {
        const res = confirm("¿Seguro que deseas eliminar esta conversación?");
        if (!res) return;

        try {
            await DBDeleteConversation(id);
            clearChat();

            // Actualizar listado de conversaciones
            updateConvs();
        } catch (e) {
            alert("Error: No se ha podido eliminar la conversación");
        }
    }

    // Ejecutar solamente cuando exista conexión con el LLM
    createEffect(
        on(llmConn, (curr, prev) => {
            if (curr === true && prev !== true) {
                updateConvs();
                updateMsgs();
            }
        })
    );

    return (
        <div class="flex h-full flex-col">
            <SearchModal
                messages={msgs()}
                open={openModal()}
                onOpenChange={setOpenModal}
            />
            <CreditsModal
                open={openCredits()}
                onOpenChange={setOpenCredits}
            />
            <UserSettingsModal
                open={openUserSettings()}
                onOpenChange={setOpenUserSettings}
            />
            <div
                class='ml-1'
                id="logo"
                onClick={() => setOpenCredits(true)}
            >
                <Logo class="w-40 h-auto" />
            </div>
            <div class="pt-8" id="buttons">
                <div 
                    onClick={(e) => clearChat()}
                    class="button-itm"
                >
                    <WriteIcon class="w-6 h-6 mr-2" />
                    <span class="text-md">Nuevo chat</span>
                </div>
                <div
                    onclick={() => setOpenModal(true)}
                    class="button-itm"
                >
                    <SearchIcon class="w-6 h-6 mr-2" />
                    <span class="text-md">Buscar chats</span>
                </div>
                <div
                    onclick={() => toggleTheme()}
                    class="button-itm"
                >
                    {theme() === 'dark' ? (
                        <SunIcon class="w-6 h-6 mr-2" />
                    ) : (
                        <MoonIcon class="w-6 h-6 mr-2" />
                    )}
                    <span class="text-md">{theme() === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
                </div>
            </div>
            <div class="pt-8">
                <h1 class="mb-1 ml-2" style="color: var(--text-secondary)">Chats</h1>
                {convs().length < 1 ? (
                    <span class='px-2 py-2'>No hay chats realizados</span>
                ) : (
                    <div id='chat-list'>
                        {convs().map((msg, index) => (
                            <div
                                title={msg.name}
                                class="button-itm"
                                classList={{
                                    "active": msg.id === convID()
                                }}
                            >
                                <span
                                    onClick={() => setConvID(msg.id)}
                                    class='w-full'
                                >
                                    {msg.name.length > 30 ? `${msg.name.slice(0, 25)}...` : msg.name}
                                </span>

                                <OptionsMenu
                                    onEdit={() => handleEdit(msg.id)}
                                    onDelete={() => handleDelete(msg.id)}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div class='pt-4 mt-auto'>
                <div 
                    class="button-itm"
                >
                    <SettingsIcon class="w-6 h-6 mr-2" />
                    <span
                        onClick={() => setOpenUserSettings(true)}
                        class="text-md"
                    >
                        Configuración
                    </span>
                </div>
            </div>
        </div>
    );
};

export default Conversations;
