import { create } from 'zustand';
import { 
  generateKeyPair, 
  deriveSharedKey, 
  encryptMessage, 
  decryptMessage,
  signMessage,
  verifySignature,
  type EncryptedMessage 
} from './crypto';
import { storeMessage, retrieveMessage } from './ipfs';
import { connectWallet } from './web3';
import P2PManager from './p2p';

interface MessageState {
  messages: EncryptedMessage[];
  keyPairs: Map<string, CryptoKeyPair>;
  sharedKeys: Map<string, CryptoKey>;
  address: string | null;
  connecting: boolean;
  initialized: boolean;
  error: string | null;
  p2pManager: P2PManager | null;
  
  connect: () => Promise<void>;
  sendMessage: (content: string, receiver: string) => Promise<void>;
  loadMessages: () => Promise<void>;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: [],
  keyPairs: new Map(),
  sharedKeys: new Map(),
  address: null,
  connecting: false,
  initialized: false,
  error: null,
  p2pManager: null,

  connect: async () => {
    set({ connecting: true, error: null });
    try {
      const address = await connectWallet();
      const keyPair = await generateKeyPair();
      
      const keyPairs = new Map(get().keyPairs);
      keyPairs.set(address.toLowerCase(), keyPair);
      
      // Initialize P2P manager
      const p2pManager = new P2PManager(address.toLowerCase());
      
      set({ 
        address: address.toLowerCase(),
        keyPairs,
        p2pManager,
        connecting: false,
        initialized: true 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to connect',
        connecting: false 
      });
    }
  },

  sendMessage: async (content: string, receiver: string) => {
    const state = get();
    if (!state.address || !state.initialized) {
      throw new Error('Not connected');
    }

    try {
      // Get or generate shared key
      let sharedKey = state.sharedKeys.get(receiver);
      if (!sharedKey) {
        const senderKeyPair = state.keyPairs.get(state.address);
        if (!senderKeyPair) throw new Error('No key pair found');
        
        // Generate temporary key pair for the receiver
        const receiverKeyPair = await generateKeyPair();
        sharedKey = await deriveSharedKey(senderKeyPair.privateKey, receiverKeyPair.publicKey);
        
        const sharedKeys = new Map(state.sharedKeys);
        sharedKeys.set(receiver, sharedKey);
        set({ sharedKeys });
      }

      // Encrypt message
      const { ciphertext, iv } = await encryptMessage(content, sharedKey);
      
      // Create and sign message
      const message: EncryptedMessage = {
        id: crypto.randomUUID(),
        sender: state.address,
        receiver,
        encryptedContent: Buffer.from(ciphertext).toString('base64'),
        iv: Buffer.from(iv).toString('base64'),
        signature: await signMessage(content),
        timestamp: Date.now(),
      };

      // Initialize P2P connection if needed
      if (state.p2pManager) {
        try {
          await state.p2pManager.initConnection(receiver, true);
          await state.p2pManager.sendMessage(receiver, content);
        } catch (p2pError) {
          console.warn('P2P message sending failed, falling back to IPFS:', p2pError);
          // Store message in IPFS as fallback
          await storeMessage(message);
        }
      } else {
        // Store message in IPFS if P2P is not available
        await storeMessage(message);
      }

      // Update local state
      set({ messages: [...state.messages, message] });
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  loadMessages: async () => {
    const state = get();
    if (!state.address || !state.initialized) {
      throw new Error('Not connected');
    }

    try {
      // Set up P2P message listener
      if (state.p2pManager) {
        state.p2pManager.onMessage((message) => {
          const messages = [...get().messages];
          const newMessage: EncryptedMessage = {
            id: crypto.randomUUID(),
            sender: message.sender,
            receiver: state.address!,
            encryptedContent: message.content,
            iv: '',
            signature: message.signature || '',
            timestamp: Date.now(),
          };
          messages.push(newMessage);
          set({ messages });
        });
      }

      // Load existing messages from local state
      const messages = [...state.messages];
      set({ messages });
    } catch (error) {
      console.error('Error loading messages:', error);
      throw error;
    }
  },
}));