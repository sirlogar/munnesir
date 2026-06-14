# Cloudflare Pages Kurulumu - Munnesir 1.0.1

Bu paket Cloudflare Pages + Pages Functions + D1 ile çalışır.

## Yükleme

Cloudflare Dashboard > Workers & Pages > Pages > Upload assets.

Zip'i çıkarıp içindeki dosyaları ve `functions/` klasörünü yükle.

## D1 Binding

Pages projesinde D1 binding ekle:

- Binding name: `MUNNESIR_DB`
- Database: oluşturduğun D1 veritabanı

## Secrets

Pages projesinde environment variable / secret ekle:

- `MUNNESIR_PASSWORD`: Munnesir giriş şifresi
- `SESSION_SECRET`: uzun rastgele bir metin

## SQL

`cloudflare-d1-schema.sql` dosyasını D1 SQL Console içinde çalıştır.

## Mantık

Web site herkese açık adreste durur; ancak uygulama ekranına erişmek ve senkron yapmak için Munnesir şifresi gerekir. E-posta/kod yoktur.
