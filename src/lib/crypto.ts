import { ethers } from 'ethers';

// ECDH Key Management
export class CryptoManager {
  private keyPairs: Map<string, CryptoKeyPair> = new Map();
  private sharedKeys: Map<string, CryptoKey> = new Map();

  async generateKeyPair(): Promise<CryptoKeyPair> {
    return await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey']
    );
  }

  async exportPublicKey(publicKey: CryptoKey): Promise<string> {
    const exported = await window.crypto.subtle.exportKey('raw', publicKey);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  }

  async importPublicKey(publicKeyString: string): Promise<CryptoKey> {
    const keyData = new Uint8Array(
      atob(publicKeyString).split('').map(char => char.charCodeAt(0))
    );
    
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
  }

  async deriveSharedKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
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
  }

  async encryptMessage(text: string, sharedKey: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
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
  }

  async decryptMessage(ciphertext: string, iv: string, sharedKey: CryptoKey): Promise<string> {
    const ciphertextBytes = new Uint8Array(
      atob(ciphertext).split('').map(char => char.charCodeAt(0))
    );
    const ivBytes = new Uint8Array(
      atob(iv).split('').map(char => char.charCodeAt(0))
    );

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
  }

  async getOrCreateKeyPair(address: string): Promise<CryptoKeyPair> {
    if (!this.keyPairs.has(address)) {
      const keyPair = await this.generateKeyPair();
      this.keyPairs.set(address, keyPair);
    }
    return this.keyPairs.get(address)!;
  }

  async getOrCreateSharedKey(myAddress: string, theirAddress: string, theirPublicKey?: string): Promise<CryptoKey> {
    const keyId = [myAddress, theirAddress].sort().join('-');
    
    if (!this.sharedKeys.has(keyId) && theirPublicKey) {
      const myKeyPair = await this.getOrCreateKeyPair(myAddress);
      const theirPubKey = await this.importPublicKey(theirPublicKey);
      const sharedKey = await this.deriveSharedKey(myKeyPair.privateKey, theirPubKey);
      this.sharedKeys.set(keyId, sharedKey);
    }
    
    return this.sharedKeys.get(keyId)!;
  }

  async signMessage(message: string): Promise<string> {
    if (!window.ethereum) throw new Error('MetaMask not installed');
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return await signer.signMessage(message);
  }

  async verifySignature(message: string, signature: string, address: string): Promise<boolean> {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  }
}

export const cryptoManager = new CryptoManager();