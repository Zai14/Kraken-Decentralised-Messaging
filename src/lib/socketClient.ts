import { io, Socket } from 'socket.io-client';
import { useMessageStore } from './messageStore';

class SocketClient {
  private socket: Socket | null = null;
  private userId: string | null = null;

  connect(userId: string) {
    this.userId = userId;
    this.socket = io(import.meta.env.VITE_SOCKET_URL, {
      auth: {
        userId,
      },
    });

    this.setupListeners();
  }

  private setupListeners() {
    if (!this.socket) return;

    this.socket.on('message', (message) => {
      const messageStore = useMessageStore.getState();
      messageStore.addMessage({
        content: message.content,
        sender: message.sender,
        receiver: message.receiver,
        attachments: message.attachments,
      });
    });

    this.socket.on('messageStatus', ({ messageId, status }) => {
      const messageStore = useMessageStore.getState();
      messageStore.setMessageStatus(messageId, status);
    });
  }

  sendMessage(message: {
    content: string;
    receiver: string;
    attachments?: { url: string; type: string; name: string; }[];
  }) {
    if (!this.socket || !this.userId) return;

    this.socket.emit('message', {
      ...message,
      sender: this.userId,
      timestamp: new Date().toISOString(),
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.userId = null;
    }
  }
}

export const socketClient = new SocketClient();