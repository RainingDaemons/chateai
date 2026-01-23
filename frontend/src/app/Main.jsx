import Conversations from './Conversations.jsx';
import Chat from './Chat.jsx';

const Main = () => {
  return (
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
  );
};

export default Main;
