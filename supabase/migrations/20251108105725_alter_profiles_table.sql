-- Alter profiles table to add operator_id and profile columns, and set up RLS policies

-- Note: Supabase automatically creates the profiles table, but we need to ensure it has the right structure
-- If profiles table exists, alter it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
        -- Add operator_id if not exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'operator_id') THEN
            ALTER TABLE profiles ADD COLUMN operator_id integer REFERENCES operators(id);
        END IF;

        -- Add profile column if not exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'profile') THEN
            ALTER TABLE profiles ADD COLUMN profile jsonb;
        END IF;
    ELSE
        -- Create profiles table if it doesn't exist
        CREATE TABLE profiles (
            id uuid REFERENCES auth.users(id) PRIMARY KEY,
            full_name text,
            email text,
            operator_id integer REFERENCES operators(id),
            profile jsonb,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );
    END IF;
END $$;

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create RLS policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Bypass RLS for the insert
  SET LOCAL row_security = off;
  INSERT INTO public.profiles (id, full_name, email, operator_id, profile)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email, (new.raw_user_meta_data->>'operator_id')::integer, new.raw_user_meta_data);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
