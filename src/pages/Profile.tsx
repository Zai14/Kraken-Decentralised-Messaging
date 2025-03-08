import React, { useState, useEffect } from 'react';
import { Camera, Loader2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Profile {
  address: string;
  username: string;
  bio: string;
  avatar_url: string;
}

export function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatar, setAvatar] = useState<File | null>(null);
  const walletAddress = localStorage.getItem('walletAddress');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!walletAddress) return;

    try {
      // First try to get existing profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('address', walletAddress.toLowerCase())
        .maybeSingle();

      if (error) throw error;

      // If no profile exists, create a default one
      if (!data) {
        const defaultProfile = {
          address: walletAddress.toLowerCase(),
          username: `User_${walletAddress.slice(2, 8)}`,
          bio: '',
          avatar_url: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert(defaultProfile)
          .select()
          .single();

        if (insertError) throw insertError;
        setProfile(newProfile);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAvatar(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !walletAddress) return;

    setSaving(true);
    try {
      let avatarUrl = profile.avatar_url;

      if (avatar) {
        const path = `avatars/${walletAddress.toLowerCase()}-${Date.now()}`;
        await supabase.storage.from('avatars').upload(path, avatar);
        avatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      }

      const { error } = await supabase
        .from('profiles')
        .upsert({
          address: walletAddress.toLowerCase(),
          username: profile.username,
          bio: profile.bio || '',
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      setAvatar(null);
      await loadProfile();
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-8">Edit Profile</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center space-x-6">
          <div className="relative">
            <img
              src={profile?.avatar_url || 'https://via.placeholder.com/150'}
              alt="Profile"
              className="w-24 h-24 rounded-full object-cover"
            />
            <label className="absolute bottom-0 right-0 bg-blue-500 p-2 rounded-full cursor-pointer hover:bg-blue-600 transition-colors">
              <Camera className="w-4 h-4" />
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
          </div>
          <div>
            <h2 className="font-medium">{walletAddress}</h2>
            {avatar && <p className="text-sm text-zinc-400">New image selected</p>}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              type="text"
              value={profile?.username || ''}
              onChange={(e) => setProfile(p => p ? {...p, username: e.target.value} : null)}
              className="w-full bg-zinc-900 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Bio</label>
            <textarea
              value={profile?.bio || ''}
              onChange={(e) => setProfile(p => p ? {...p, bio: e.target.value} : null)}
              className="w-full bg-zinc-900 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-none"
              placeholder="Write something about yourself..."
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>Save Profile</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}