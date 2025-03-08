import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { shortenAddress } from '../lib/web3';
import { useContext } from 'react';
import { AuthContext } from '../App';
import { sendMessage, subscribeToMessages } from '../lib/gun';

interface Message {
  id: string;
  content: string;
  sender: string;
  receiver: string;
  timestamp: number;
}

export function Messages() {
  const [newMessage, setNewMessage] = useState('');
  const [recipient, setRecipient] = useState('');
  const [showRecipient, setShowRecipient] = useState(true);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { walletAddress } = useContext(AuthContext);

  useEffect(() => {
    if (walletAddress) {
      // Subscribe to messages
      subscribeToMessages(walletAddress, (message) => {
        setMessages((prevMessages) => {
          // Check if message already exists
          const exists = prevMessages.some((m) => m.id === message.id);
          if (exists) return prevMessages;
          
          // Add new message
          return [...prevMessages, message].sort((a, b) => a.timestamp - b.timestamp);
        });
      });
    }
  }, [walletAddress]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !recipient.trim() || !walletAddress) return;

    setLoading(true);
    try {
      await sendMessage(walletAddress, recipient, newMessage.trim());
      setNewMessage('');
      setShowRecipient(false);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!walletAddress) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-center space-y-4">
          <AlertCircle className="w-8 h-8 mx-auto text-red-500" />
          <p className="text-gray-400">Please connect your wallet to continue</p>
        </div>
      </div>
    );
  }

  const filteredMessages = messages.filter(m => 
    (m.sender.toLowerCase() === recipient.toLowerCase() && m.receiver.toLowerCase() === walletAddress.toLowerCase()) ||
    (m.sender.toLowerCase() === walletAddress.toLowerCase() && m.receiver.toLowerCase() === recipient.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Header */}
      <div className="border-b border-zinc-800 p-4">
        {showRecipient ? (
          <h1 className="text-xl font-semibold text-white">New Message</h1>
        ) : (
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setShowRecipient(true)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h2 className="font-medium text-white">{shortenAddress(recipient)}</h2>
              <p className="text-sm text-gray-500">Ethereum Address</p>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredMessages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.sender.toLowerCase() === walletAddress.toLowerCase() ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[70%] rounded-2xl p-4 ${
                message.sender.toLowerCase() === walletAddress.toLowerCase()
                  ? 'bg-blue-500 text-white'
                  : 'bg-zinc-800 text-white'
              }`}
            >
              <p className="text-sm break-words">{message.content}</p>
              <p className="text-xs opacity-60 mt-1">
                {new Date(message.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-zinc-800">
        {showRecipient && (
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Enter Ethereum address (0x...)"
            className="w-full bg-zinc-900 rounded-xl py-3 px-4 text-white placeholder-gray-500 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
        <div className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-zinc-900 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || !recipient.trim() || loading}
            className="bg-blue-500 text-white p-3 rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}