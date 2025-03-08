import { supabase } from './supabase';
import { ethers } from 'ethers';

interface RTCMessage {
  type: string;
  content: string;
  sender: string;
  timestamp: string;
  signature?: string;
}

class P2PManager {
  private connections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private messageCallbacks: ((message: RTCMessage) => void)[] = [];
  private channelReadyCallbacks: Map<string, (() => void)[]> = new Map();
  private connectionAttempts: Map<string, number> = new Map();
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000;

  constructor(private myAddress: string) {}

  async initConnection(targetAddress: string, initiator: boolean = false): Promise<void> {
    if (this.connections.has(targetAddress)) {
      const connection = this.connections.get(targetAddress)!;
      if (connection.connectionState === 'connected') {
        return;
      }
      // Clean up existing failed connection
      this.cleanup(targetAddress);
    }

    const attempts = this.connectionAttempts.get(targetAddress) || 0;
    if (attempts >= this.MAX_RETRIES) {
      this.connectionAttempts.delete(targetAddress);
      throw new Error('Max connection attempts reached');
    }

    this.connectionAttempts.set(targetAddress, attempts + 1);

    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    const peerConnection = new RTCPeerConnection(configuration);
    this.connections.set(targetAddress, peerConnection);

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.cleanup(targetAddress);
        reject(new Error('Connection timeout'));
      }, 30000);

      if (initiator) {
        const dataChannel = peerConnection.createDataChannel('messageChannel', {
          ordered: true,
          maxRetransmits: 3,
        });
        this.setupDataChannel(dataChannel, targetAddress);
        
        dataChannel.onopen = () => {
          clearTimeout(timeoutId);
          this.connectionAttempts.delete(targetAddress);
          resolve();
        };
      } else {
        peerConnection.ondatachannel = (event) => {
          this.setupDataChannel(event.channel, targetAddress);
          clearTimeout(timeoutId);
          this.connectionAttempts.delete(targetAddress);
          resolve();
        };
      }

      peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await this.sendSignal(targetAddress, {
              type: 'ice-candidate',
              candidate: event.candidate,
            });
          } catch (error) {
            console.error('Error sending ICE candidate:', error);
          }
        }
      };

      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'failed') {
          this.cleanup(targetAddress);
          reject(new Error('Connection failed'));
        }
      };

      if (initiator) {
        this.createAndSendOffer(peerConnection, targetAddress).catch(reject);
      }
    });
  }

  private async createAndSendOffer(peerConnection: RTCPeerConnection, targetAddress: string) {
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      await this.sendSignal(targetAddress, {
        type: 'offer',
        sdp: offer,
      });
    } catch (error) {
      console.error('Error creating offer:', error);
      this.cleanup(targetAddress);
      throw error;
    }
  }

  private setupDataChannel(channel: RTCDataChannel, peerAddress: string): void {
    this.dataChannels.set(peerAddress, channel);

    channel.onopen = () => {
      console.log(`Data channel opened with ${peerAddress}`);
      const callbacks = this.channelReadyCallbacks.get(peerAddress) || [];
      callbacks.forEach(callback => callback());
      this.channelReadyCallbacks.delete(peerAddress);
    };

    channel.onclose = () => {
      console.log(`Data channel closed with ${peerAddress}`);
      this.cleanup(peerAddress);
    };

    channel.onerror = (error) => {
      console.error(`Data channel error with ${peerAddress}:`, error);
      this.cleanup(peerAddress);
    };

    channel.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data) as RTCMessage;
        if (message.signature) {
          const isValid = await this.verifySignature(message);
          if (!isValid) {
            console.error('Invalid message signature');
            return;
          }
        }
        this.messageCallbacks.forEach(callback => callback(message));
      } catch (error) {
        console.error('Error handling message:', error);
      }
    };
  }

  private cleanup(peerAddress: string): void {
    const connection = this.connections.get(peerAddress);
    if (connection) {
      connection.close();
      this.connections.delete(peerAddress);
    }
    this.dataChannels.delete(peerAddress);
  }

  async sendMessage(targetAddress: string, content: string): Promise<void> {
    const dataChannel = this.dataChannels.get(targetAddress);
    
    if (!dataChannel) {
      throw new Error('No data channel exists');
    }

    if (dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    const message: RTCMessage = {
      type: 'message',
      content,
      sender: this.myAddress,
      timestamp: new Date().toISOString(),
    };

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const messageHash = ethers.hashMessage(
        JSON.stringify({
          content: message.content,
          sender: message.sender,
          timestamp: message.timestamp
        })
      );
      message.signature = await signer.signMessage(messageHash);
      dataChannel.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  onMessage(callback: (message: RTCMessage) => void): void {
    this.messageCallbacks.push(callback);
  }

  destroy(): void {
    this.connections.forEach((connection, peerAddress) => {
      this.cleanup(peerAddress);
    });
    this.messageCallbacks = [];
    this.channelReadyCallbacks.clear();
    this.connectionAttempts.clear();
  }

  private async verifySignature(message: RTCMessage): Promise<boolean> {
    if (!message.signature) return false;
    
    try {
      const messageHash = ethers.hashMessage(
        JSON.stringify({
          content: message.content,
          sender: message.sender,
          timestamp: message.timestamp
        })
      );
      const recoveredAddress = ethers.verifyMessage(messageHash, message.signature);
      return recoveredAddress.toLowerCase() === message.sender.toLowerCase();
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  }

  private async sendSignal(targetAddress: string, signal: any): Promise<void> {
    try {
      await supabase.from('signals').insert({
        from_address: this.myAddress,
        to_address: targetAddress,
        signal_data: signal,
      });
    } catch (error) {
      console.error('Error sending signal:', error);
      throw error;
    }
  }
}

export default P2PManager;