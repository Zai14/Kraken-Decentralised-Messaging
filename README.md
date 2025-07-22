Kraken - Decentralized Messaging Platform
Kraken is a secure, decentralized messaging application built on Web3 technologies. It enables users to send encrypted messages using their Ethereum wallet addresses as identities, with real-time peer-to-peer communication powered by Gun.js.

🚀 Features
Wallet-Based Authentication: Connect using MetaMask wallet
End-to-End Encryption: Messages encrypted using ECDH key exchange and AES-GCM
Decentralized Messaging: Peer-to-peer communication via Gun.js network
Real-time Communication: Instant message delivery and presence detection
Government ID Verification: PAN card verification for enhanced security
Cryptocurrency Market Data: Real-time crypto prices and charts
Profile Management: Customizable user profiles with avatars
Message History: Persistent local storage with cloud backup
🛠️ Technology Stack
Frontend: React 18, TypeScript, Tailwind CSS
Authentication: Supabase Auth with wallet integration
Database: Supabase PostgreSQL with Row Level Security
P2P Network: Gun.js for decentralized messaging
Encryption: Web Crypto API (ECDH + AES-GCM)
Wallet Integration: MetaMask via ethers.js
Charts: Lightweight Charts for market data
Deployment: Netlify
📋 Prerequisites
Node.js 18+ and npm
MetaMask browser extension
Modern web browser with Web Crypto API support
🔧 Installation
Clone the repository

git clone <repository-url>
cd kraken-messaging
Install dependencies

npm install
Environment Setup Create a .env file with your Supabase credentials:

VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
Database Setup

Create a new Supabase project
Run the migration files in the supabase/migrations folder
Ensure Row Level Security is enabled
Start Development Server

npm run dev
🚀 Deployment
The application is deployed on Netlify at: https://resonant-unicorn-0d783d.netlify.app

To deploy your own instance:

Build the project: npm run build
Deploy the dist folder to your hosting provider
Configure environment variables on your hosting platform
🔐 Security Features
End-to-End Encryption: All messages are encrypted client-side
Key Management: ECDH key pairs generated per user
Perfect Forward Secrecy: Unique encryption keys per conversation
Wallet Signatures: Message authenticity via wallet signatures
Row Level Security: Database access controlled by user authentication
📱 Usage
Connect Wallet: Click "Connect with MetaMask" and approve the connection
Choose Authentication: Select "Sign Up" for new users or "Login" for existing users
ID Verification: Complete PAN card verification (for new users)
Start Messaging: Navigate to Messages and enter a recipient's wallet address
Send Messages: Choose between encrypted or unencrypted messages
View Profile: Manage your profile settings and avatar
🔧 Configuration
Gun.js Peers
The application automatically discovers live Gun.js peers for optimal connectivity. You can modify the peer list in src/lib/messagingService.ts.

Encryption Settings
Encryption is enabled by default but can be toggled per message. The system uses:

ECDH P-256 for key exchange
AES-GCM 256-bit for message encryption
Random IV for each encrypted message
🐛 Troubleshooting
Common Issues:
Messages not sending: Check Gun.js peer connectivity and internet connection
Encryption failures: Ensure both users have published their public keys
Authentication issues: Verify Supabase configuration and wallet connection
Database errors: Check RLS policies and user permissions
Debug Mode:
Enable console logging by opening browser developer tools to see detailed connection and encryption status.

🤝 Contributing
Fork the repository
Create a feature branch: git checkout -b feature-name
Commit changes: git commit -m 'Add feature'
Push to branch: git push origin feature-name
Submit a pull request
📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

👨‍💻 Author
Za.i.14 - Creator and Lead Developer

🙏 Acknowledgments
Gun.js team for the decentralized database
Supabase for the backend infrastructure
MetaMask for wallet integration
CoinGecko for cryptocurrency market data
📞 Support
For support and questions:

Open an issue on GitHub
Contact the development team
Check the documentation for common solutions
Built with ❤️ for the decentralized web

Contact
For more information, please contact Zai14 through his Socials: Instagram LinkedIn X YouTube email .
