# Munnesir 1.0.1 - Cloudflare D1 Tek Şifreli Anlık Senkron

Bu sürüm Supabase kullanmaz. Sistem şu şekilde çalışır:

- Web sitesi Cloudflare Pages üzerinde yayınlanır.
- `/functions` klasörü Cloudflare Pages Functions olarak çalışır.
- Veriler Cloudflare D1 içinde tek bir bulut arşivinde tutulur.
- Web ve APK aynı arşive bağlanır.
- Giriş için yalnızca Munnesir şifresi gerekir.
- E-posta, doğrulama kodu, Supabase hesabı yoktur.
- Web/APK değişiklikleri internet varsa birkaç saniye içinde diğer cihazlara yansır.

## Cloudflare ayarları

1. Cloudflare Dashboard > Workers & Pages > D1 üzerinden bir veritabanı oluştur:
   `munnesir_db`

2. Pages projesine D1 binding ekle:
   - Binding name: `MUNNESIR_DB`
   - Database: oluşturduğun D1 veritabanı

3. Pages projesinde Environment variables / Secrets ekle:
   - `MUNNESIR_PASSWORD`: siteye girmek için kullanacağın şifre
   - `SESSION_SECRET`: uzun rastgele bir metin

İstersen `MUNNESIR_PASSWORD` yerine `MUNNESIR_PASSWORD_HASH` kullanabilirsin. Bu değer şifrenin SHA-256 hex karşılığıdır.

4. `cloudflare-d1-schema.sql` içeriğini D1 Console veya SQL ekranında çalıştır.

5. Bu klasörün içindeki dosyaları Cloudflare Pages'a yükle.

## İlk kullanım

1. Web sitesini aç.
2. Hamburger menü > Bulut girişi.
3. Site adresi boş kalabilir. APK tarafında `https://munnesir.com` yazabilirsin.
4. Munnesir şifresini gir.
5. Eski JSON yedeğini içe aktar.
6. `Bu cihazı buluta gönder` veya `Senkronize et` de.

## Eski yedek uyumu

Eski Munnesir JSON yedekleri ve Google Keep JSON import sistemi korunur. Eski yedeği yükledikten sonra senkron yaptığında buluta taşınır.
