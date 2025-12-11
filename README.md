# NiamChat - Complete Chat Application

## 🚀 Live Chat Features
- Real-time messaging with Supabase
- 10 beautiful themes with animations
- Admin/Owner controls with special privileges
- Image uploads (5MB limit)
- Like/dislike system with animations
- Typing indicators
- Announcement system
- Mobile responsive design

## 📋 Prerequisites
1. A Supabase account (free)
2. Your Supabase URL and anon key
3. A modern web browser

## 🛠️ Setup Instructions

### Step 1: Database Setup
1. Go to your Supabase project: `https://cwbdhrlbflsygamnsanf.supabase.co`
2. Navigate to **SQL Editor**
3. Run these SQL queries:

```sql
-- Create users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'owner')),
  online BOOLEAN DEFAULT false,
  typing BOOLEAN DEFAULT false,
  last_seen TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

-- Create messages table
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  sender_id UUID REFERENCES users(id),
  sender_name TEXT,
  room TEXT DEFAULT 'public' CHECK (room IN ('public', 'admin')),
  timestamp TIMESTAMP DEFAULT now(),
  likes UUID[] DEFAULT array[]::UUID[],
  dislikes UUID[] DEFAULT array[]::UUID[],
  reply_to UUID REFERENCES messages(id),
  image_url TEXT,
  deleted BOOLEAN DEFAULT false
);

-- Create announcements table
CREATE TABLE announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  timestamp TIMESTAMP DEFAULT now(),
  read_by UUID[] DEFAULT array[]::UUID[]
);

-- Add owner user (You)
INSERT INTO users (username, display_name, role) 
VALUES ('Main413H', 'Owner - Niam', 'owner')
ON CONFLICT (username) DO UPDATE SET role = 'owner';
