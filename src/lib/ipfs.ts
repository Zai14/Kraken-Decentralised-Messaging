import { Web3Storage } from 'web3.storage';
import { EncryptedMessage } from './crypto';

const client = new Web3Storage({ token: import.meta.env.VITE_WEB3_STORAGE_TOKEN });

export async function storeMessage(message: EncryptedMessage): Promise<string> {
  const blob = new Blob([JSON.stringify(message)], { type: 'application/json' });
  const file = new File([blob], `${message.id}.json`);
  const cid = await client.put([file]);
  return `https://${cid}.ipfs.dweb.link/${message.id}.json`;
}

export async function retrieveMessage(cid: string): Promise<EncryptedMessage> {
  const response = await fetch(`https://${cid}.ipfs.dweb.link`);
  return response.json();
}

export async function storeFile(file: File): Promise<string> {
  const cid = await client.put([file]);
  return `https://${cid}.ipfs.dweb.link/${file.name}`;
}