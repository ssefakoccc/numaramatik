# Projeyi Canlıya Alma Adımları

## 1. Supabase Veritabanı
- Supabase paneline girin ve sol menüden **SQL Editor**'ü açın.
- Bu projedeki `supabase-kurulum.sql` dosyasının içindeki kodları kopyalayıp çalıştırın (Run).

## 2. Vercel Deployment
- Vercel.com'a girip "Add New > Project" diyerek bu GitHub reposunu seçin.
- Deploy butonuna basmadan önce **Environment Variables** (Çevre Değişkenleri) kısmına tıklayın.
- Bilgisayarınızdaki `.env.local` dosyasının içindeki 5 değişkeni (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ADMIN_SECRET_KEY) değerleriyle birlikte tek tek ekleyin.
- "Deploy" butonuna basın.

## 3. Domain Bağlama ve QR
- Deployment bitince Vercel proje ayarlarından "Domains" sekmesine gidip kendi alan adınızı ekleyin.
- Bu alan adının ana sayfa linkini kullanarak ücretsiz bir QR kod oluşturun ve aracınızın kartvizitine ekleyin.
