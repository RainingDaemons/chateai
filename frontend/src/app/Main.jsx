import { createSignal, createEffect } from "solid-js";

import Conversations from './Conversations.jsx';
import Chat from './Chat.jsx';
import { useProv } from "../helpers/Provider";
import { ToastHost, ConnectionToast } from '../ui/Components';

const Main = () => {
  const { llmConn } = useProv();
  const [prevConn, setPrevConn] = createSignal(undefined);

  createEffect(() => {
    const curr = llmConn();
    const prev = prevConn();

    // Solo notificar cuando exista un cambio
    if (prev !== undefined && curr !== prev) {
      if (curr === true) {
        ConnectionToast({
          title: "Conectado con servidor LLM",
          description: "La conexión se estableció correctamente",
          duration: 3000,
          variation: "success",
        });
      } else {
        ConnectionToast({
          title: "No conectado",
          description: "No se pudo conectar con el LLM, intenta nuevamente",
          duration: 4500,
          variation: "error",
        });
      }
    }

    setPrevConn(curr);
  });

  return (
    <>
      <ToastHost />

      <main class="h-screen flex">
        <section
          class="w-100 py-4 px-2"
          id="conversations"
        >
          <Conversations />
        </section>
        <section
          class="w-full py-4 px-10"
          id="chat"
        >
          <Chat />
        </section>
      </main>
    </>
  );
};

export default Main;
