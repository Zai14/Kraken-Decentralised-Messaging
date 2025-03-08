import Gun from 'gun';

// Initialize Gun with peers
const gun = Gun({
  peers: [
    'https://gun-manhattan.herokuapp.com/gun',
    'https://gun-us.herokuapp.com/gun'
  ]
});

export const messagesDB = gun.get('kraken-messages');

export const sendMessage = (sender: string, receiver: string, content: string) => {
  const messageId = Date.now().toString();
  const message = {
    id: messageId,
    sender: sender.toLowerCase(),
    receiver: receiver.toLowerCase(),
    content,
    timestamp: Date.now(),
  };

  messagesDB.get(messageId).put(message);
  return messageId;
};

export const subscribeToMessages = (
  userAddress: string,
  callback: (message: any) => void
) => {
  messagesDB.map().on((message: any) => {
    if (!message) return;
    const receiverMatch = message.receiver?.toLowerCase() === userAddress.toLowerCase();
    const senderMatch = message.sender?.toLowerCase() === userAddress.toLowerCase();
    
    if (receiverMatch || senderMatch) {
      callback(message);
    }
  });
};

export default gun;