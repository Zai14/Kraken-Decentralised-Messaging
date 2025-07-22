import React, { useState } from 'react';
import { X, Upload, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CreateGroupChatProps {
  account: string;
  onClose: () => void;
  onGroupCreated: (conversationId: string) => void;
}

export function CreateGroupChat({ account, onClose, onGroupCreated }: CreateGroupChatProps) {
  const [groupName, setGroupName] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [newParticipant, setNewParticipant] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAddParticipant = () => {
    if (!newParticipant) return;
    setParticipants([...participants, newParticipant]);
    setNewParticipant('');
  };

  const handleRemoveParticipant = (address: string) => {
    setParticipants(participants.filter(p => p !== address));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAvatar(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName || participants.length === 0) return;

    setLoading(true);
    try {
      let avatarUrl = '';
      if (avatar) {
        const path = `group-avatars/${Date.now()}-${avatar.name}`;
        await supabase.storage.from('attachments').upload(path, avatar);
        avatarUrl = supabase.storage.from('attachments').getPublicUrl(path).data.publicUrl;
      }

      const { data: conversation, error } = await supabase
        .from('conversations')
        .insert({
          participants: [account, ...participants],
          is_group: true,
          group_name: groupName,
          group_avatar: avatarUrl || null,
        })
        .select()
        .single();

      if (error) throw error;
      onGroupCreated(conversation.id);
      onClose();
    } catch (error) {
      console.error('Error creating group:', error);
      alert('Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border-b border-zinc-800">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Group Name</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full bg-zinc-800 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter group name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Group Avatar</label>
            <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-zinc-600 rounded-lg hover:border-blue-500 cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              {avatar ? (
                <div className="text-center">
                  <p className="text-sm">{avatar.name}</p>
                  <p className="text-xs text-zinc-400">Click to change</p>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="w-6 h-6 mx-auto mb-2 text-zinc-400" />
                  <p className="text-sm text-zinc-400">Upload group avatar</p>
                </div>
              )}
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Add Participants</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newParticipant}
                onChange={(e) => setNewParticipant(e.target.value)}
                className="flex-1 bg-zinc-800 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter wallet address (0x...)"
              />
              <button
                type="button"
                onClick={handleAddParticipant}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {participants.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {participants.map((address) => (
                <div
                  key={address}
                  className="flex items-center bg-zinc-700 rounded-full px-3 py-1"
                >
                  <span className="text-sm mr-2">
                    {`${address.slice(0, 6)}...${address.slice(-4)}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveParticipant(address)}
                    className="text-zinc-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex space-x-2">
            <button
              type="submit"
              disabled={loading || !groupName || participants.length === 0}
              className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                'Create Group'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-zinc-700 text-white py-2 rounded-lg hover:bg-zinc-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}