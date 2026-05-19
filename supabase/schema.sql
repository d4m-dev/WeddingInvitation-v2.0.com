-- 1. Bảng Comments (Lời chúc của khách)
CREATE TABLE comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    is_presence BOOLEAN, -- true: có mặt, false: vắng mặt
    content TEXT,
    gif_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Bảng Likes (Lượt thích bình luận)
CREATE TABLE likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Bảng Configs (Cấu hình thiệp cưới: ẩn/hiện mừng cưới, v.v...)
CREATE TABLE configs (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

-- 4. Bảng Profiles (Thông tin người dùng, bao gồm vai trò admin)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    role TEXT DEFAULT 'user' NOT NULL, -- 'user' hoặc 'admin'
    -- Thêm các trường khác nếu cần, ví dụ: name, avatar_url, v.v.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Kích hoạt RLS cho bảng profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Chỉ người dùng đã xác thực mới có thể xem profile của chính họ
CREATE POLICY "Người dùng có thể xem profile của chính họ" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Policy: Người dùng có thể cập nhật profile của chính họ
CREATE POLICY "Người dùng có thể cập nhật profile của chính họ" ON profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Policy: Admin có thể xem tất cả profiles
CREATE POLICY "Admin có thể xem tất cả profiles" ON profiles
    FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Policy: Khi một người dùng mới được tạo trong auth.users, tự động tạo một profile tương ứng
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (NEW.id, NEW.email, 'user'); -- Sử dụng email làm username ban đầu, bạn có thể điều chỉnh
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- Chèn dữ liệu cấu hình mẫu
INSERT INTO configs (key, value) VALUES 
('guest_book', '{"enabled": true}'),
('music', '{"enabled": true, "autoplay": false}');

-- Kích hoạt RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE configs ENABLE ROW LEVEL SECURITY;

-- Cho phép TẤT CẢ mọi người (anon) được XEM danh sách lời chúc
CREATE POLICY "Cho phép mọi người xem lời chúc" ON comments
    FOR SELECT USING (true);

-- Cho phép TẤT CẢ mọi người (anon) được GỬI lời chúc mới
CREATE POLICY "Cho phép mọi người gửi lời chúc" ON comments
    FOR INSERT WITH CHECK (true);

-- Cho phép khách SỬA lời chúc của chính họ (nếu cần bảo mật cao hơn có thể tuỳ chỉnh, tạm thời mở public)
CREATE POLICY "Cho phép cập nhật lời chúc" ON comments
    FOR UPDATE USING (true);

-- Cho phép xoá bình luận
CREATE POLICY "Cho phép xoá lời chúc" ON comments
    FOR DELETE USING (true);

-- Cho phép mọi người xem và thả tim
CREATE POLICY "Cho phép mọi người xem likes" ON likes FOR SELECT USING (true);
CREATE POLICY "Cho phép mọi người tạo likes" ON likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Cho phép mọi người bỏ likes" ON likes FOR DELETE USING (true);

-- Cấu hình chỉ cho phép đọc
CREATE POLICY "Mọi người có thể đọc cấu hình" ON configs FOR SELECT USING (true);
