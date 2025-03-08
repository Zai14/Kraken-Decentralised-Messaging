import React, { useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';

export function Search() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="relative mb-8">
        <SearchIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by wallet address (0x...)"
          className="w-full bg-zinc-900 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="text-center text-zinc-400 py-8">
        Enter a wallet address to start a conversation
      </div>
    </div>
  );
}