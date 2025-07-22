## Kraken - Decentralized Messaging Platform

Kraken is a secure, decentralized messaging application built on Web3 technologies. It enables users to send encrypted messages using their Ethereum wallet addresses as identities, with real-time peer-to-peer communication powered by Gun.js.

### 🚀 Features

- **Wallet-Based Authentication**: Connect using MetaMask wallet
- **End-to-End Encryption**: Messages encrypted using ECDH key exchange and AES-GCM
- **Decentralized Messaging**: Peer-to-peer communication via Gun.js network
- **Real-time Communication**: Instant message delivery and presence detection
- **Government ID Verification**: PAN card verification for enhanced security
- **Cryptocurrency Market Data**: Real-time crypto prices and charts
- **Profile Management**: Customizable user profiles with avatars
- **Message History**: Persistent local storage with cloud backup

### 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Authentication**: Supabase Auth with wallet integration
- **Database**: Supabase PostgreSQL with Row Level Security
- **P2P Network**: Gun.js for decentralized messaging
- **Encryption**: Web Crypto API (ECDH + AES-GCM)
- **Wallet Integration**: MetaMask via ethers.js
- **Charts**: Lightweight Charts for market data
- **Deployment**: Netlify

### 📋 Prerequisites

- Node.js 18+ and npm
- MetaMask browser extension
- Modern web browser with Web Crypto API support

### 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd kraken-messaging
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Database Setup**
   - Create a new Supabase project
   - Run the migration files in the `supabase/migrations` folder
   - Ensure Row Level Security is enabled

5. **Start Development Server**
   ```bash
   npm run dev
   ```

### 🚀 Deployment

The application is deployed on Netlify at: (https://resonant-unicorn-0d783d.netlify.app/)

To deploy your own instance:
1. Build the project: `npm run build`
2. Deploy the `dist` folder to your hosting provider
3. Configure environment variables on your hosting platform

### 🔐 Security Features

- **End-to-End Encryption**: All messages are encrypted client-side
- **Key Management**: ECDH key pairs generated per user
- **Perfect Forward Secrecy**: Unique encryption keys per conversation
- **Wallet Signatures**: Message authenticity via wallet signatures
- **Row Level Security**: Database access controlled by user authentication

### 📱 Usage

1. **Connect Wallet**: Click "Connect with MetaMask" and approve the connection
2. **Choose Authentication**: Select "Sign Up" for new users or "Login" for existing users
3. **ID Verification**: Complete PAN card verification (for new users)
4. **Start Messaging**: Navigate to Messages and enter a recipient's wallet address
5. **Send Messages**: Choose between encrypted or unencrypted messages
6. **View Profile**: Manage your profile settings and avatar

### 🔧 Configuration

#### Gun.js Peers
The application automatically discovers live Gun.js peers for optimal connectivity. You can modify the peer list in `src/lib/messagingService.ts`.

#### Encryption Settings
Encryption is enabled by default but can be toggled per message. The system uses:
- **ECDH P-256** for key exchange
- **AES-GCM 256-bit** for message encryption
- **Random IV** for each encrypted message

### 🐛 Troubleshooting

#### Common Issues:

1. **Messages not sending**: Check Gun.js peer connectivity and internet connection
2. **Encryption failures**: Ensure both users have published their public keys
3. **Authentication issues**: Verify Supabase configuration and wallet connection
4. **Database errors**: Check RLS policies and user permissions

#### Debug Mode:
Enable console logging by opening browser developer tools to see detailed connection and encryption status.

### 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

### 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

### 👨‍💻 Author

**Za.i.14** - Creator and Lead Developer

### 🙏 Acknowledgments

- Gun.js team for the decentralized database
- Supabase for the backend infrastructure
- MetaMask for wallet integration
- CoinGecko for cryptocurrency market data

### 📞 Support

For support and questions:
- Open an issue on GitHub
- Contact the development team
- Check the documentation for common solutions

---

*Built with ❤️ for the decentralized web*
### Contact
For more information, please contact Zai14 through his Socials:
 [![Instagram](https://img.shields.io/badge/Instagram-%23E4405F.svg?logo=Instagram&logoColor=white)](https://instagram.com/Za.i.14) [![LinkedIn](https://img.shields.io/badge/LinkedIn-%230077B5.svg?logo=linkedin&logoColor=white)](https://linkedin.com/in/zai14) [![X](https://img.shields.io/badge/X-black.svg?logo=X&logoColor=white)](https://x.com/Za_i14) [![YouTube](https://img.shields.io/badge/YouTube-%23FF0000.svg?logo=YouTube&logoColor=white)](https://youtube.com/@Za.i.14) [![email](https://img.shields.io/badge/Email-D14836?logo=gmail&logoColor=white)](mailto:ZaidShabir67@gmail.com) 
.
