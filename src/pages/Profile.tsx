import React, { useState, useEffect } from 'react';
import { Camera, Loader2, Save, User, Wallet, Shield, Copy, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useContext } from 'react';
import { AuthContext } from '../App';

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
  const [copied, setCopied] = useState(false);
  const { walletAddress } = useContext(AuthContext);

  useEffect(() => {
    if (walletAddress) {
      loadProfile();
    }
  }, [walletAddress]);

  const loadProfile = async () => {
    if (!walletAddress) return;

    try {
      console.log('Loading profile for address:', walletAddress);
      
      // Try to get existing profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('address', walletAddress.toLowerCase())
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // If no profile exists, create a default one
      if (!data) {
        console.log('No profile found, creating default profile...');
        
        const defaultProfile = {
          address: walletAddress.toLowerCase(),
          username: `User_${walletAddress.slice(2, 8)}`,
          bio: 'New Kraken user',
          avatar_url: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert(defaultProfile)
          .select()
          .single();

        if (insertError) {
          console.error('Error creating profile:', insertError);
          throw insertError;
        }
        
        setProfile(newProfile);
        console.log('Default profile created successfully');
      } else {
        setProfile(data);
        console.log('Profile loaded successfully:', data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      setAvatar(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !walletAddress) return;

    setSaving(true);
    try {
      let avatarUrl = profile.avatar_url;

      if (avatar) {
        console.log('Uploading avatar...');
        const fileExt = avatar.name.split('.').pop();
        const fileName = `${walletAddress.toLowerCase()}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, avatar);

        if (uploadError) {
          console.error('Avatar upload error:', uploadError);
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('attachments')
          .getPublicUrl(filePath);

        avatarUrl = publicUrl;
        console.log('Avatar uploaded successfully:', avatarUrl);
      }

      console.log('Updating profile...');
      const { error } = await supabase
        .from('profiles')
        .upsert({
          address: walletAddress.toLowerCase(),
          username: profile.username,
          bio: profile.bio || '',
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Profile update error:', error);
        throw error;
      }

      setAvatar(null);
      await loadProfile();
      console.log('Profile updated successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async () => {
    if (walletAddress) {
      try {
        await navigator.clipboard.writeText(walletAddress);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-zinc-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Profile Settings</h1>
        <p className="text-zinc-400">Manage your Kraken profile and account settings</p>
      </div>

      {/* Account Information */}
      <div className="bg-zinc-900/50 rounded-lg p-6 border border-zinc-800 mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <Shield className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-zinc-100">Account Information</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Wallet Address
            </label>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                <p className="text-zinc-100 font-mono text-sm break-all">
                  {walletAddress || 'Not connected'}
                </p>
              </div>
              <button
                onClick={copyToClipboard}
                className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg transition-colors flex items-center space-x-2"
                title="Copy wallet address"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Account Status
            </label>
            <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-zinc-100 text-sm">Connected & Verified</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSubmit} className="bg-zinc-900/50 rounded-lg p-6 border border-zinc-800">
        <div className="flex items-center space-x-3 mb-6">
          <User className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-zinc-100">Profile Details</h2>
        </div>

        <div className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center space-x-6">
            <div className="relative">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover border-2 border-zinc-700"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center">
                  <User className="w-10 h-10 text-zinc-400" />
                </div>
              )}
              <label className="absolute bottom-0 right-0 bg-blue-500 p-2 rounded-full cursor-pointer hover:bg-blue-600 transition-colors">
                <Camera className="w-4 h-4 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </label>
            </div>
            <div>
              <h3 className="font-medium text-zinc-100 mb-1">Profile Picture</h3>
              <p className="text-sm text-zinc-400 mb-2">
                Upload a profile picture (max 5MB)
              </p>
              {avatar && (
                <p className="text-sm text-blue-400">
                  New image selected: {avatar.name}
                </p>
              )}
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Username
            </label>
            <input
              type="text"
              value={profile?.username || ''}
              onChange={(e) => setProfile(p => p ? {...p, username: e.target.value} : null)}
              className="w-full bg-zinc-800 rounded-lg py-3 px-4 text-zinc-100 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your username"
              maxLength={50}
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Bio
            </label>
            <textarea
              value={profile?.bio || ''}
              onChange={(e) => setProfile(p => p ? {...p, bio: e.target.value} : null)}
              className="w-full bg-zinc-800 rounded-lg py-3 px-4 text-zinc-100 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32 resize-none"
              placeholder="Tell us about yourself..."
              maxLength={500}
            />
            <p className="text-xs text-zinc-500 mt-1">
              {profile?.bio?.length || 0}/500 characters
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-6 border-t border-zinc-800 mt-6">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 w-full sm:w-auto"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}