import React, { useRef } from 'react';
import { Paperclip, File, Image, X } from 'lucide-react';
import { uploadFile } from '../lib/supabase';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
}

export function FileUpload({ onFileSelect, selectedFile, onClear }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const getFileIcon = () => {
    if (!selectedFile) return null;
    return selectedFile.type.startsWith('image/') ? <Image className="w-5 h-5" /> : <File className="w-5 h-5" />;
  };

  return (
    <div className="relative">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      {selectedFile ? (
        <div className="flex items-center space-x-2 bg-zinc-700 rounded-lg px-3 py-1">
          {getFileIcon()}
          <span className="text-sm truncate max-w-[200px]">{selectedFile.name}</span>
          <button
            onClick={onClear}
            className="text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 hover:bg-zinc-700 rounded-full transition-colors"
        >
          <Paperclip className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}