import Gun from 'gun';
import 'gun/sea';

export interface Message {
  id: string;
  sender: string;
  receiver: string;
  content: string;
  encryptedContent?: string;
  iv?: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'failed' | 'pending_decryption';
  transport: 'gun';
  encrypted: boolean;
  decrypted?: boolean; // Flag to indicate if message was successfully decrypted
  disappearAfter?: number; // Minutes after which message should disappear
  burnAfterReading?: boolean; // Whether message should burn after being read
  isRead?: boolean; // Whether message has been read (for burn after reading)
  isExpired?: boolean; // Whether message has expired
  expiresAt?: number; // Timestamp when message expires
}

export interface MessageCallback {
  (message: Message): void;
}

export interface PresenceCallback {
  (users: string[]): void;
}

interface PublicKeyData {
  publicKey: string;
  timestamp: number;
  address: string;
}

interface SharedKeyInfo {
  key: CryptoKey;
  timestamp: number;
  publicKeyTimestamp: number;
}

class MessagingService {
  private gun: any;
  private sea: any;
  private messageCallbacks: MessageCallback[] = [];
  private presenceCallbacks: PresenceCallback[] = [];
  private isInitialized = false;
  private userAddress = '';
  private onlineUsers = new Set<string>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messageQueue: Message[] = [];
  private localMessages: Map<string, Message> = new Map();
  private processedMessageIds = new Set<string>();
  private gunConnected = false;
  private retryInterval: NodeJS.Timeout | null = null;
  private livePeers: string[] = [];
  private peerDiscoveryInterval: NodeJS.Timeout | null = null;
  private connectionRetryInterval: NodeJS.Timeout | null = null;
  
  // Enhanced encryption-related properties
  private keyPairs: Map<string, CryptoKeyPair> = new Map();
  private sharedKeys: Map<string, SharedKeyInfo> = new Map();
  private publicKeys: Map<string, PublicKeyData> = new Map();
  private keyRefreshInterval: NodeJS.Timeout | null = null;
  private decryptionRetryQueue: Map<string, Message> = new Map();

  async initialize(userAddress: string): Promise<void> {
    this.userAddress = userAddress.toLowerCase();
    
    try {
      console.log('Initializing messaging service for:', this.userAddress);
      
      // Load existing messages from localStorage
      this.loadMessagesFromLocalStorage();
      
      // Load persisted keys
      await this.loadPersistedKeys();
      
      // Discover live peers first
      await this.discoverLivePeers();
      
      // Initialize Gun.js with discovered peers
      await this.initializeGun();
      
      // Generate encryption keys
      await this.getOrCreateKeyPair(this.userAddress);
      
      // Publish public key
      await this.publishPublicKey();
      
      // Set up message listeners
      this.setupMessageListeners();
      
      // Set up presence system
      this.setupPresenceSystem();
      
      // Start retry mechanism
      this.startRetryMechanism();
      
      // Start peer discovery
      this.startPeerDiscovery();
      
      // Start connection monitoring
      this.startConnectionMonitoring();
      
      // Start key refresh mechanism
      this.startKeyRefreshMechanism();
      
      // Retry decryption for failed messages
      this.retryFailedDecryptions();
      
      this.isInitialized = true;
      console.log('Messaging service initialized successfully');
      
      // Process any queued messages
      setTimeout(() => this.processMessageQueue(), 3000);
      
    } catch (error) {
      console.error('Error initializing messaging service:', error);
      this.isInitialized = true; // Continue with limited functionality
    }
  }

  // Key persistence methods
  private async saveKeyPairToStorage(address: string, keyPair: CryptoKeyPair): Promise<void> {
    try {
      const publicKeyData = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
      const privateKeyData = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
      
      const keyData = {
        publicKey: btoa(String.fromCharCode(...new Uint8Array(publicKeyData))),
        privateKey: btoa(String.fromCharCode(...new Uint8Array(privateKeyData))),
        timestamp: Date.now()
      };
      
      localStorage.setItem(`kraken-keypair-${address}`, JSON.stringify(keyData));
      console.log('Key pair saved to storage for:', address);
    } catch (error) {
      console.error('Error saving key pair to storage:', error);
    }
  }

  private async loadKeyPairFromStorage(address: string): Promise<CryptoKeyPair | null> {
    try {
      const stored = localStorage.getItem(`kraken-keypair-${address}`);
      if (!stored) return null;
      
      const keyData = JSON.parse(stored);
      
      const publicKeyBytes = new Uint8Array(
        atob(keyData.publicKey).split('').map(char => char.charCodeAt(0))
      );
      const privateKeyBytes = new Uint8Array(
        atob(keyData.privateKey).split('').map(char => char.charCodeAt(0))
      );
      
      const publicKey = await window.crypto.subtle.importKey(
        'raw',
        publicKeyBytes,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        []
      );
      
      const privateKey = await window.crypto.subtle.importKey(
        'pkcs8',
        privateKeyBytes,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey']
      );
      
      console.log('Key pair loaded from storage for:', address);
      return { publicKey, privateKey };
    } catch (error) {
      console.error('Error loading key pair from storage:', error);
      return null;
    }
  }

  private async loadPersistedKeys(): Promise<void> {
    try {
      // Load our own key pair
      const keyPair = await this.loadKeyPairFromStorage(this.userAddress);
      if (keyPair) {
        this.keyPairs.set(this.userAddress, keyPair);
      }
      
      // Load cached public keys
      const publicKeysData = localStorage.getItem(`kraken-public-keys-${this.userAddress}`);
      if (publicKeysData) {
        const parsedKeys = JSON.parse(publicKeysData);
        for (const [address, keyData] of Object.entries(parsedKeys)) {
          this.publicKeys.set(address, keyData as PublicKeyData);
        }
        console.log('Loaded', Object.keys(parsedKeys).length, 'cached public keys');
      }
    } catch (error) {
      console.error('Error loading persisted keys:', error);
    }
  }

  private savePublicKeysToStorage(): void {
    try {
      const keysObject = Object.fromEntries(this.publicKeys.entries());
      localStorage.setItem(`kraken-public-keys-${this.userAddress}`, JSON.stringify(keysObject));
    } catch (error) {
      console.error('Error saving public keys to storage:', error);
    }
  }

  // Enhanced encryption methods with better error handling
  private async generateKeyPair(): Promise<CryptoKeyPair> {
    try {
      return await window.crypto.subtle.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256',
        },
        true,
        ['deriveKey']
      );
    } catch (error) {
      console.error('Error generating key pair:', error);
      throw new Error('Failed to generate cryptographic key pair');
    }
  }

  private async exportPublicKey(publicKey: CryptoKey): Promise<string> {
    try {
      const exported = await window.crypto.subtle.exportKey('raw', publicKey);
      return btoa(String.fromCharCode(...new Uint8Array(exported)));
    } catch (error) {
      console.error('Error exporting public key:', error);
      throw new Error('Failed to export public key');
    }
  }

  private async importPublicKey(publicKeyString: string): Promise<CryptoKey> {
    try {
      // Validate base64 format
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(publicKeyString)) {
        throw new Error('Invalid base64 format');
      }
      
      const keyData = new Uint8Array(
        atob(publicKeyString).split('').map(char => char.charCodeAt(0))
      );
      
      // Validate key length (P-256 uncompressed public key should be 65 bytes)
      if (keyData.length !== 65) {
        throw new Error(`Invalid key length: expected 65 bytes, got ${keyData.length}`);
      }
      
      return await window.crypto.subtle.importKey(
        'raw',
        keyData,
        {
          name: 'ECDH',
          namedCurve: 'P-256',
        },
        false,
        []
      );
    } catch (error) {
      console.error('Error importing public key:', error);
      throw new Error(`Failed to import public key: ${error.message}`);
    }
  }

  private async deriveSharedKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
    try {
      return await window.crypto.subtle.deriveKey(
        {
          name: 'ECDH',
          public: publicKey,
        },
        privateKey,
        {
          name: 'AES-GCM',
          length: 256,
        },
        false,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('Error deriving shared key:', error);
      throw new Error('Failed to derive shared encryption key');
    }
  }

  private async encryptMessage(text: string, sharedKey: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      const ciphertext = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv,
        },
        sharedKey,
        data
      );

      return {
        ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
        iv: btoa(String.fromCharCode(...new Uint8Array(iv)))
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  private async decryptMessage(ciphertext: string, iv: string, sharedKey: CryptoKey): Promise<string> {
    try {
      // Validate inputs
      if (!ciphertext || !iv || !sharedKey) {
        throw new Error('Missing required decryption parameters');
      }

      // Validate base64 format
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(ciphertext) || !/^[A-Za-z0-9+/]*={0,2}$/.test(iv)) {
        throw new Error('Invalid base64 format in encrypted data');
      }

      const ciphertextBytes = new Uint8Array(
        atob(ciphertext).split('').map(char => char.charCodeAt(0))
      );
      const ivBytes = new Uint8Array(
        atob(iv).split('').map(char => char.charCodeAt(0))
      );

      // Validate IV length (should be 12 bytes for AES-GCM)
      if (ivBytes.length !== 12) {
        throw new Error(`Invalid IV length: expected 12 bytes, got ${ivBytes.length}`);
      }

      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBytes,
        },
        sharedKey,
        ciphertextBytes
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error(`Failed to decrypt message: ${error.message}`);
    }
  }

  private async getOrCreateKeyPair(address: string): Promise<CryptoKeyPair> {
    if (!this.keyPairs.has(address)) {
      // Try to load from storage first
      const storedKeyPair = await this.loadKeyPairFromStorage(address);
      if (storedKeyPair) {
        this.keyPairs.set(address, storedKeyPair);
        console.log('Loaded existing key pair for:', address);
      } else {
        console.log('Generating new key pair for:', address);
        const keyPair = await this.generateKeyPair();
        this.keyPairs.set(address, keyPair);
        // Save to storage for persistence
        await this.saveKeyPairToStorage(address, keyPair);
      }
    }
    return this.keyPairs.get(address)!;
  }

  private async publishPublicKey(): Promise<void> {
    try {
      const keyPair = await this.getOrCreateKeyPair(this.userAddress);
      const publicKeyString = await this.exportPublicKey(keyPair.publicKey);
      const timestamp = Date.now();
      
      const keyData: PublicKeyData = {
        publicKey: publicKeyString,
        timestamp: timestamp,
        address: this.userAddress
      };

      console.log('Publishing public key for:', this.userAddress, 'timestamp:', timestamp);

      // Publish via Gun.js if available
      if (this.gunConnected && this.gun) {
        // Use consistent path structure
        this.gun.get('kraken_keys').get(this.userAddress).put(keyData);
        console.log('Published public key via Gun.js for:', this.userAddress);
      }

      // Store locally with timestamp
      this.publicKeys.set(this.userAddress, keyData);
      this.savePublicKeysToStorage();
      
    } catch (error) {
      console.error('Error publishing public key:', error);
    }
  }

  private async getPublicKey(address: string): Promise<PublicKeyData | null> {
    return new Promise((resolve) => {
      // Check cache first
      const cachedKey = this.publicKeys.get(address);
      
      if (!this.gunConnected || !this.gun) {
        console.warn('Gun.js not connected, using cached key for:', address);
        resolve(cachedKey || null);
        return;
      }

      let resolved = false;
      
      console.log(`Fetching public key for ${address}`);
      
      // Fetch from Gun with timeout
      this.gun.get('kraken_keys').get(address).once((data: any) => {
        if (!resolved && data && data.publicKey && data.timestamp && data.address === address) {
          console.log('Found public key for:', address, 'timestamp:', data.timestamp);
          
          const keyData: PublicKeyData = {
            publicKey: data.publicKey,
            timestamp: data.timestamp,
            address: data.address
          };
          
          // Update cache
          this.publicKeys.set(address, keyData);
          this.savePublicKeysToStorage();
          resolved = true;
          resolve(keyData);
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn('Timeout fetching public key for:', address, 'using cached key');
          resolve(cachedKey || null);
        }
      }, 5000);
    });
  }

  private async getOrCreateSharedKey(theirAddress: string): Promise<CryptoKey | null> {
    const keyId = [this.userAddress, theirAddress].sort().join('-');
    
    console.log('Getting shared key with:', theirAddress);

    // Get the latest public key data
    const theirPublicKeyData = await this.getPublicKey(theirAddress);
    if (!theirPublicKeyData) {
      console.warn('Could not get public key for:', theirAddress);
      return null;
    }

    // Check if we have a cached shared key and if it's still valid
    const cachedSharedKeyInfo = this.sharedKeys.get(keyId);
    const shouldRegenerateKey = !cachedSharedKeyInfo || 
      theirPublicKeyData.timestamp > cachedSharedKeyInfo.publicKeyTimestamp;

    if (shouldRegenerateKey) {
      console.log('Generating new shared key with:', theirAddress, 'using public key timestamp:', theirPublicKeyData.timestamp);
      
      try {
        const myKeyPair = await this.getOrCreateKeyPair(this.userAddress);
        const theirPublicKey = await this.importPublicKey(theirPublicKeyData.publicKey);
        const sharedKey = await this.deriveSharedKey(myKeyPair.privateKey, theirPublicKey);
        
        const sharedKeyInfo: SharedKeyInfo = {
          key: sharedKey,
          timestamp: Date.now(),
          publicKeyTimestamp: theirPublicKeyData.timestamp
        };
        
        this.sharedKeys.set(keyId, sharedKeyInfo);
        console.log('Successfully created shared key with:', theirAddress);
        return sharedKey;
      } catch (error) {
        console.error('Error creating shared key with', theirAddress, ':', error);
        return null;
      }
    } else {
      console.log('Using cached shared key for:', theirAddress);
      return cachedSharedKeyInfo.key;
    }
  }

  private startKeyRefreshMechanism(): void {
    // Refresh public keys every 5 minutes
    this.keyRefreshInterval = setInterval(async () => {
      console.log('Refreshing public keys...');
      
      // Re-publish our own public key
      await this.publishPublicKey();
      
      // Clear old shared keys to force regeneration with fresh public keys
      const now = Date.now();
      const maxAge = 10 * 60 * 1000; // 10 minutes
      
      for (const [keyId, sharedKeyInfo] of this.sharedKeys.entries()) {
        if (now - sharedKeyInfo.timestamp > maxAge) {
          console.log('Removing old shared key:', keyId);
          this.sharedKeys.delete(keyId);
        }
      }

      // Retry failed decryptions with fresh keys
      this.retryFailedDecryptions();
    }, 5 * 60 * 1000);
  }

  private async retryFailedDecryptions(): Promise<void> {
    console.log('Retrying failed decryptions...');
    
    const failedMessages = Array.from(this.localMessages.values()).filter(
      msg => msg.encrypted && msg.encryptedContent && msg.iv && 
      (msg.content.includes('🔒 Encrypted message (decryption failed') || msg.status === 'pending_decryption')
    );

    for (const message of failedMessages) {
      try {
        console.log('Retrying decryption for message from:', message.sender);
        
        // Get fresh shared key
        const sharedKey = await this.getOrCreateSharedKey(message.sender);
        if (!sharedKey || !message.encryptedContent || !message.iv) {
          continue;
        }

        const decryptedContent = await this.decryptMessage(
          message.encryptedContent,
          message.iv,
          sharedKey
        );

        // Update the message with decrypted content
        const updatedMessage: Message = {
          ...message,
          content: decryptedContent,
          status: 'delivered',
          decrypted: true
        };

        // Update local storage
        this.localMessages.set(message.id, updatedMessage);
        this.saveMessagesToLocalStorage();

        console.log('Successfully decrypted previously failed message from:', message.sender);

        // Notify callbacks about the updated message
        this.messageCallbacks.forEach(callback => callback(updatedMessage));

      } catch (error) {
        console.log('Still unable to decrypt message from:', message.sender, error.message);
      }
    }
  }

  private async discoverLivePeers(): Promise<void> {
    console.log('Discovering live Gun.js peers using Gun relay...');
    
    // Enhanced list of Gun.js relay servers and public peers
    const knownPeers = [
      // Primary Gun relay servers
      'https://gun-manhattan.herokuapp.com/gun',
      'https://gun-us.herokuapp.com/gun',
      'https://gun-eu.herokuapp.com/gun',
      'https://gunjs.herokuapp.com/gun',
      
      // Alternative relay servers
      'https://gun-manhattan.onrender.com/gun',
      'https://gun-relay.herokuapp.com/gun',
      'https://gun-relay.onrender.com/gun',
      
      // Community peers
      'https://peer.wallie.io/gun',
      'https://gun.eco/gun',
      'https://gundb.io/gun',
      
      // WebSocket peers
      'wss://gun-manhattan.herokuapp.com/gun',
      'wss://gun-us.herokuapp.com/gun',
      'wss://gunjs.herokuapp.com/gun',
      'wss://gun-relay.herokuapp.com/gun',
      
      // Additional relay servers
      'https://gun-relay-1.herokuapp.com/gun',
      'https://gun-relay-2.herokuapp.com/gun',
      'https://gun-relay-3.herokuapp.com/gun',
      'https://gun-relay-4.herokuapp.com/gun',
      'https://gun-relay-5.herokuapp.com/gun',
      
      // More community peers
      'https://gun.iris.to/gun',
      'https://gun-relay.iris.to/gun',
      'https://relay.gun.eco/gun'
    ];

    const livePeers: string[] = [];
    
    // Test each peer for availability with improved detection
    const testPromises = knownPeers.map(async (peer) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // Increased timeout
        
        // Try to fetch the peer endpoint
        const response = await fetch(peer.replace('/gun', '/'), {
          method: 'HEAD',
          signal: controller.signal,
          mode: 'no-cors' // Allow cross-origin requests
        });
        
        clearTimeout(timeoutId);
        
        // Accept any response (including CORS errors) as a sign the server is alive
        livePeers.push(peer);
        console.log('Live peer found:', peer);
        
      } catch (error) {
        // For no-cors mode, network errors might still indicate a live server
        if (error.name !== 'AbortError') {
          // Try the peer anyway as it might be a CORS issue
          livePeers.push(peer);
          console.log('Peer added despite error (might be CORS):', peer);
        } else {
          console.log('Peer timeout:', peer);
        }
      }
    });

    await Promise.allSettled(testPromises);
    
    // Always include some fallback peers even if tests fail
    const fallbackPeers = [
      'https://gun-manhattan.herokuapp.com/gun',
      'https://gun-us.herokuapp.com/gun',
      'https://gunjs.herokuapp.com/gun',
      'https://gun-relay.herokuapp.com/gun',
      'wss://gun-manhattan.herokuapp.com/gun'
    ];
    
    // Add fallback peers if we don't have enough
    fallbackPeers.forEach(peer => {
      if (!livePeers.includes(peer)) {
        livePeers.push(peer);
      }
    });
    
    this.livePeers = livePeers;
    console.log('Discovered', livePeers.length, 'total peers:', livePeers);
  }

  private startPeerDiscovery(): void {
    // Rediscover peers every 3 minutes
    this.peerDiscoveryInterval = setInterval(async () => {
      console.log('Rediscovering peers...');
      await this.discoverLivePeers();
      
      // Reconnect Gun with new peers if connection is poor
      if (!this.gunConnected || this.livePeers.length > 10) {
        console.log('Attempting to reconnect Gun with fresh peers...');
        await this.initializeGun();
      }
    }, 3 * 60 * 1000);
  }

  private startConnectionMonitoring(): void {
    // Monitor connection health every 30 seconds
    this.connectionRetryInterval = setInterval(async () => {
      if (!this.gunConnected) {
        console.log('Connection lost, attempting to reconnect...');
        await this.initializeGun();
      } else {
        // Test connection by trying to write a heartbeat
        try {
          const testData = {
            heartbeat: Date.now(),
            user: this.userAddress
          };
          this.gun.get('kraken_heartbeat').get(this.userAddress).put(testData);
        } catch (error) {
          console.warn('Connection test failed:', error);
          this.gunConnected = false;
        }
      }
    }, 30000);
  }

  private loadMessagesFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem(`kraken-messages-${this.userAddress}`);
      if (stored) {
        const messages = JSON.parse(stored) as Message[];
        messages.forEach(msg => {
          this.localMessages.set(msg.id, msg);
          this.processedMessageIds.add(msg.id);
        });
        console.log('Loaded', messages.length, 'messages from localStorage');
      }
    } catch (error) {
      console.error('Error loading messages from localStorage:', error);
    }
  }

  private saveMessagesToLocalStorage(): void {
    try {
      const messages = Array.from(this.localMessages.values());
      localStorage.setItem(`kraken-messages-${this.userAddress}`, JSON.stringify(messages));
    } catch (error) {
      console.error('Error saving messages to localStorage:', error);
    }
  }

  private async initializeGun(): Promise<void> {
    try {
      console.log('Initializing Gun.js with', this.livePeers.length, 'peers...');
      
      // Close existing Gun instance if it exists
      if (this.gun) {
        try {
          this.gun.off();
        } catch (error) {
          console.warn('Error closing existing Gun instance:', error);
        }
      }
      
      // Initialize Gun with discovered live peers and optimized settings
      this.gun = Gun({
        peers: this.livePeers,
        localStorage: false,
        radisk: false,
        retry: 10, // Reduced retry attempts
        timeout: 15000, // Reduced timeout
        wait: 1000, // Reduced wait time
        chunk: 1000 * 8, // Smaller chunks for better reliability
        until: 200, // Faster response expectation
        multicast: false // Disable multicast for better reliability
      });

      // Get SEA for authentication
      this.sea = Gun.SEA;
      
      // Test Gun connection with multiple attempts
      let connectionAttempts = 0;
      const maxAttempts = 3;
      
      while (connectionAttempts < maxAttempts && !this.gunConnected) {
        connectionAttempts++;
        console.log(`Gun.js connection attempt ${connectionAttempts}/${maxAttempts}`);
        
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.warn(`Gun.js connection attempt ${connectionAttempts} timeout`);
            resolve(null);
          }, 10000);

          // Test Gun connection with a simple write/read
          const testKey = `test-${this.userAddress}-${Date.now()}`;
          const testData = { 
            test: Date.now(),
            user: this.userAddress,
            timestamp: new Date().toISOString(),
            attempt: connectionAttempts
          };
          
          // Try to write data
          this.gun.get('kraken_test').get(testKey).put(testData, (ack: any) => {
            if (ack.err) {
              console.warn(`Gun.js test write failed (attempt ${connectionAttempts}):`, ack.err);
            } else {
              console.log(`Gun.js test write successful (attempt ${connectionAttempts})`);
              
              // Try to read back the data
              this.gun.get('kraken_test').get(testKey).once((data: any) => {
                if (data && data.test === testData.test) {
                  console.log(`Gun.js connected and verified successfully (attempt ${connectionAttempts})`);
                  this.gunConnected = true;
                  clearTimeout(timeout);
                  resolve(ack);
                } else {
                  console.warn(`Gun.js read verification failed (attempt ${connectionAttempts})`);
                }
              });
            }
          });
        });
        
        if (!this.gunConnected && connectionAttempts < maxAttempts) {
          // Wait before next attempt
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      if (!this.gunConnected) {
        console.error('Failed to establish Gun.js connection after all attempts');
        // Continue anyway with limited functionality
      }
      
    } catch (error) {
      console.error('Gun.js initialization failed:', error);
      this.gunConnected = false;
    }
  }

  private setupMessageListeners(): void {
    if (!this.gun) {
      console.warn('Gun.js not available, skipping message listeners');
      return;
    }

    console.log('Setting up Gun.js message listeners for:', this.userAddress);
    
    // Listen for messages addressed to this user with improved reliability
    this.gun.get('kraken_messages').get(this.userAddress).map().on(async (data: any, key: string) => {
      if (!data || !data.sender || data.sender === this.userAddress) return;
      
      // Skip if we already processed this message
      if (this.processedMessageIds.has(data.id)) {
        return;
      }
      
      try {
        console.log('Received message via Gun.js inbox:', data);
        await this.processReceivedMessage(data, 'gun');
      } catch (error) {
        console.error('Error processing Gun.js message:', error);
      }
    });

    // Global message listener for broadcast messages
    this.gun.get('kraken_global').map().on(async (data: any, key: string) => {
      if (!data || !data.receiver || !data.sender || data.sender === this.userAddress) return;
      
      // Only process messages addressed to this user
      if (data.receiver !== this.userAddress) return;
      
      // Skip if we already processed this message
      if (this.processedMessageIds.has(data.id)) {
        return;
      }
      
      try {
        console.log('Received global message via Gun.js:', data);
        await this.processReceivedMessage(data, 'gun');
      } catch (error) {
        console.error('Error processing global Gun.js message:', error);
      }
    });

    // Listen for direct messages using a more specific path
    this.gun.get('kraken_direct').get(this.userAddress).map().on(async (data: any, key: string) => {
      if (!data || !data.sender || data.sender === this.userAddress) return;
      
      // Skip if we already processed this message
      if (this.processedMessageIds.has(data.id)) {
        return;
      }
      
      try {
        console.log('Received direct message via Gun.js:', data);
        await this.processReceivedMessage(data, 'gun');
      } catch (error) {
        console.error('Error processing direct Gun.js message:', error);
      }
    });
  }

  private async processReceivedMessage(data: any, transport: 'gun'): Promise<void> {
    // Mark as processed to prevent duplicates
    this.processedMessageIds.add(data.id);

    let decryptedMessage: Message;
    
    if (data.encrypted && data.encryptedContent && data.iv) {
      console.log('Processing encrypted message from:', data.sender);
      
      try {
        // Get the most recent shared key for decryption
        const sharedKey = await this.getOrCreateSharedKey(data.sender);
        if (!sharedKey) {
          throw new Error('Could not establish shared key');
        }

        const decryptedContent = await this.decryptMessage(
          data.encryptedContent,
          data.iv,
          sharedKey
        );

        console.log('Successfully decrypted message from:', data.sender);

        decryptedMessage = {
          id: data.id,
          sender: data.sender,
          receiver: data.receiver,
          content: decryptedContent,
          encryptedContent: data.encryptedContent,
          iv: data.iv,
          timestamp: data.timestamp,
          status: 'delivered',
          encrypted: true,
          decrypted: true, // Mark as successfully decrypted
          transport
        };
      } catch (error) {
        console.error('Failed to decrypt message from', data.sender, ':', error);
        
        // Store as pending decryption message that can be retried later
        decryptedMessage = {
          id: data.id,
          sender: data.sender,
          receiver: data.receiver,
          content: `Ephemeral Message: No Longer Available`,
          encryptedContent: data.encryptedContent,
          iv: data.iv,
          timestamp: data.timestamp,
          status: 'delivered',
          encrypted: true,
          decrypted: false,
          transport
        };

        // Add to retry queue
        this.decryptionRetryQueue.set(data.id, decryptedMessage);
      }
    } else {
      // Unencrypted message
      console.log('Processing unencrypted message from:', data.sender);
      decryptedMessage = {
        id: data.id,
        sender: data.sender,
        receiver: data.receiver,
        content: data.content,
        timestamp: data.timestamp,
        status: 'delivered',
        encrypted: false,
        transport
      };
    }
    
    // Store locally
    this.localMessages.set(decryptedMessage.id, decryptedMessage);
    this.saveMessagesToLocalStorage();
    
    console.log('Processed and stored received message:', decryptedMessage);
    
    // Notify callbacks
    this.messageCallbacks.forEach(callback => callback(decryptedMessage));
  }

  private setupPresenceSystem(): void {
    if (!this.gun) return;

    console.log('Setting up presence system');

    // Announce presence immediately
    this.announcePresence();

    // Listen for other users' presence
    this.gun.get('kraken_presence').map().on((data: any, key: string) => {
      if (data && key !== this.userAddress) {
        const isOnline = data.online && (Date.now() - data.lastSeen) < 120000; // 2 minutes timeout
        
        if (isOnline && !this.onlineUsers.has(key)) {
          this.onlineUsers.add(key);
          console.log('User came online:', key);
        } else if (!isOnline && this.onlineUsers.has(key)) {
          this.onlineUsers.delete(key);
          console.log('User went offline:', key);
        }
        
        this.notifyPresenceCallbacks();
      }
    });

    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.announcePresence();
    }, 30000);
  }

  private announcePresence(): void {
    if (this.gun) {
      const presenceData = {
        online: true,
        lastSeen: Date.now(),
        address: this.userAddress,
        timestamp: new Date().toISOString()
      };
      
      this.gun.get('kraken_presence').get(this.userAddress).put(presenceData);
    }
  }

  private notifyPresenceCallbacks(): void {
    this.presenceCallbacks.forEach(callback => 
      callback(Array.from(this.onlineUsers))
    );
  }

  private startRetryMechanism(): void {
    // Retry failed messages every 30 seconds
    this.retryInterval = setInterval(() => {
      this.processMessageQueue();
    }, 30000);
  }

  private async processMessageQueue(): Promise<void> {
    if (this.messageQueue.length === 0) return;

    console.log(`Processing ${this.messageQueue.length} queued messages`);
    
    const messagesToProcess = [...this.messageQueue];
    this.messageQueue = [];
    
    for (const message of messagesToProcess) {
      try {
        await this.sendViaGun(message);
        message.transport = 'gun';
        message.status = 'sent';
        console.log('Queued message sent successfully via Gun.js');
        this.localMessages.set(message.id, message);
        this.saveMessagesToLocalStorage();
      } catch (error) {
        console.error('Error sending queued message:', error);
        
        // Re-queue failed messages (max 3 retries)
        const retries = (message as any).retries || 0;
        if (retries < 3) {
          (message as any).retries = retries + 1;
          this.messageQueue.push(message);
          console.log(`Re-queuing message ${message.id}, retry ${retries + 1}/3`);
        } else {
          message.status = 'failed';
          this.localMessages.set(message.id, message);
          this.saveMessagesToLocalStorage();
          console.log(`Message ${message.id} failed after 3 retries`);
        }
      }
    }
  }

  private async sendViaGun(message: Message): Promise<void> {
    if (!this.gun || !this.gunConnected) {
      throw new Error('Gun.js not available');
    }

    const messageData: any = {
      id: message.id,
      sender: message.sender,
      receiver: message.receiver,
      timestamp: message.timestamp,
      encrypted: message.encrypted,
      sent: new Date().toISOString()
    };

    if (message.encrypted && message.encryptedContent && message.iv) {
      messageData.encryptedContent = message.encryptedContent;
      messageData.iv = message.iv;
      console.log('Sending encrypted message via Gun.js to:', message.receiver);
    } else {
      messageData.content = message.content;
      console.log('Sending unencrypted message via Gun.js to:', message.receiver);
    }

    // Send to multiple paths for maximum reliability
    const promises = [
      // Send to receiver's inbox
      new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Gun.js send timeout (inbox)'));
        }, 10000);

        try {
          this.gun.get('kraken_messages').get(message.receiver).get(message.id).put(messageData, (ack: any) => {
            clearTimeout(timeout);
            if (ack.err) {
              reject(new Error('Gun.js send failed (inbox): ' + ack.err));
            } else {
              console.log('Message sent via Gun.js inbox to', message.receiver);
              resolve(ack);
            }
          });
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      }),
      
      // Send to global broadcast
      new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Gun.js send timeout (global)'));
        }, 10000);

        try {
          this.gun.get('kraken_global').get(message.id).put(messageData, (ack: any) => {
            clearTimeout(timeout);
            if (ack.err) {
              reject(new Error('Gun.js send failed (global): ' + ack.err));
            } else {
              console.log('Message sent via Gun.js global broadcast');
              resolve(ack);
            }
          });
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      }),

      // Send to direct message path
      new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Gun.js send timeout (direct)'));
        }, 10000);

        try {
          this.gun.get('kraken_direct').get(message.receiver).get(message.id).put(messageData, (ack: any) => {
            clearTimeout(timeout);
            if (ack.err) {
              reject(new Error('Gun.js send failed (direct): ' + ack.err));
            } else {
              console.log('Message sent via Gun.js direct path');
              resolve(ack);
            }
          });
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      })
    ];

    // Wait for at least one to succeed
    try {
      await Promise.any(promises);
      console.log('Message successfully sent via Gun.js to', message.receiver);
    } catch (error) {
      console.error('All Gun.js send attempts failed for message to', message.receiver);
      throw new Error('All Gun.js send attempts failed');
    }
  }

  async sendMessage(content: string, receiver: string, encrypted: boolean = false): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    const cleanReceiver = receiver.toLowerCase().trim();
    console.log('Sending message to:', cleanReceiver, 'content:', content, 'encrypted:', encrypted);

    const message: Message = {
      id: this.generateMessageId(),
      sender: this.userAddress,
      receiver: cleanReceiver,
      content: content.trim(),
      timestamp: Date.now(),
      status: 'sending',
      transport: 'gun',
      encrypted
    };

    try {
      if (encrypted) {
        console.log('Attempting to encrypt message for:', cleanReceiver);
        
        // Try to encrypt the message using the most recent shared key
        const sharedKey = await this.getOrCreateSharedKey(cleanReceiver);
        if (sharedKey) {
          const { ciphertext, iv } = await this.encryptMessage(content.trim(), sharedKey);
          message.encryptedContent = ciphertext;
          message.iv = iv;
          console.log('Message encrypted successfully for:', cleanReceiver);
        } else {
          // If encryption fails, send unencrypted with warning
          console.warn('Encryption failed for', cleanReceiver, '- sending unencrypted');
          message.encrypted = false;
          
          // Notify user about encryption failure
          setTimeout(() => {
            this.messageCallbacks.forEach(callback => callback({
              ...message,
              id: this.generateMessageId(),
              content: `⚠️ Failed to encrypt message to ${cleanReceiver}. Message sent unencrypted.`,
              status: 'delivered',
              encrypted: false,
              sender: 'system',
              receiver: this.userAddress
            }));
          }, 1000);
        }
      }

      // Store locally first
      this.localMessages.set(message.id, message);
      this.saveMessagesToLocalStorage();

      // Try to send immediately
      await this.sendViaGun(message);
      message.status = 'sent';
      this.localMessages.set(message.id, message);
      this.saveMessagesToLocalStorage();
      console.log('Message sent immediately to', cleanReceiver);
      
    } catch (error) {
      console.warn('Immediate send failed, queuing message for retry:', error);
      
      // Add to queue for retry instead of marking as failed
      this.messageQueue.push(message);
      
      // Don't throw the error - let the UI show the message as 'sending'
      // The background retry will handle delivery
    }
  }

  async loadMessagesFromLocal(): Promise<Message[]> {
    const messages = Array.from(this.localMessages.values()).sort((a, b) => a.timestamp - b.timestamp);
    console.log('Loaded', messages.length, 'messages from local storage');
    return messages;
  }

  onMessage(callback: MessageCallback): void {
    this.messageCallbacks.push(callback);
  }

  onPresence(callback: PresenceCallback): void {
    this.presenceCallbacks.push(callback);
  }

  getOnlineUsers(): string[] {
    return Array.from(this.onlineUsers);
  }

  isConnected(): boolean {
    return this.isInitialized && this.gunConnected;
  }

  getConnectionStatus(): { gun: boolean } {
    return {
      gun: this.gunConnected
    };
  }

  private generateMessageId(): string {
    return crypto.randomUUID();
  }

  destroy(): void {
    console.log('Destroying messaging service');
    
    // Mark as offline
    if (this.gun) {
      this.gun.get('kraken_presence').get(this.userAddress).put({
        online: false,
        lastSeen: Date.now()
      });
    }

    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }

    if (this.peerDiscoveryInterval) {
      clearInterval(this.peerDiscoveryInterval);
      this.peerDiscoveryInterval = null;
    }

    if (this.connectionRetryInterval) {
      clearInterval(this.connectionRetryInterval);
      this.connectionRetryInterval = null;
    }

    if (this.keyRefreshInterval) {
      clearInterval(this.keyRefreshInterval);
      this.keyRefreshInterval = null;
    }

    if (this.messageCleanupInterval) {
      clearInterval(this.messageCleanupInterval);
      this.messageCleanupInterval = null;
    }

    this.messageCallbacks = [];
    this.presenceCallbacks = [];
    this.isInitialized = false;
    this.gunConnected = false;
    this.onlineUsers.clear();
    this.messageQueue = [];
    this.processedMessageIds.clear();
    this.livePeers = [];
    this.keyPairs.clear();
    this.sharedKeys.clear();
    this.publicKeys.clear();
    this.decryptionRetryQueue.clear();
  }
}

export const messagingService = new MessagingService();