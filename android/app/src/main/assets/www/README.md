# Munnesir PWA

Google Keep export dosyalarındaki şiirleri içe aktarabilen, Android'de kurulabilir, çevrimdışı çalışan küçük bir web uygulaması.

## Özellikler

- Yeni şiir ekleme, düzenleme, silme
- Etiket ekleme: `aşk, yalnızlık, gece` gibi virgülle ayır
- Etikete basınca ilgili şiirleri filtreleme
- Başlık, metin ve etiket içinde arama
- Seçme şiir işaretleme
- Google Keep JSON dosyalarını içe aktarma
- Arşiv yedeği indirme ve geri yükleme
- IndexedDB ile cihazda yerel kayıt
- PWA manifest + service worker ile çevrimdışı kullanım
- Mobilde soldan açılan opak filtre menüsü
- Daha kare, daha az yuvarlak kart ve buton tasarımı

## Hızlı çalıştırma

Bu uygulama statik dosyalardan oluşur. En iyi sonuç için bir yerel sunucuda açın.

### Bilgisayarda

Python varsa klasörde şunu çalıştırın:

```bash
python -m http.server 5173
```

Sonra tarayıcıda açın:

```text
http://localhost:5173
```

## GitHub Pages'e yükleme

> Önemli: Google Keep JSON/HTML export dosyalarını GitHub'a yüklemeyin. GitHub Pages sitesinin kodu herkes tarafından görülebilir. Şiirleri uygulama açıldıktan sonra **Keep JSON yükle** butonuyla içe aktarın; böylece şiirler cihazın tarayıcı deposunda kalır.

### Kolay yöntem: GitHub web arayüzü

1. GitHub'da yeni repository oluşturun. Örnek ad: `munnesir`.
2. Bu klasörün içindeki dosyaları repository'ye yükleyin. Repository'nin en üstünde doğrudan şunlar görünmeli:
   - `index.html`
   - `style.css`
   - `app.js`
   - `sw.js`
   - `manifest.webmanifest`
   - `icons/`
3. Repository'de **Settings > Pages** bölümüne girin.
4. **Build and deployment** kısmında **Deploy from a branch** seçin.
5. Branch olarak `main`, folder olarak `/ (root)` seçin ve kaydedin.
6. Bir süre sonra site şu yapıda açılır:

```text
https://kullanici-adin.github.io/munnesir/
```

### Terminal yöntemi

Repository'yi GitHub'da oluşturduktan sonra bu klasörde şunları çalıştırabilirsiniz:

```bash
git init
git add .
git commit -m "Initial poetry archive PWA"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADIN/munnesir.git
git push -u origin main
```

Sonra yine **Settings > Pages** kısmından `main` ve `/ (root)` seçilir.

## Android'de kullanma

1. GitHub Pages linkini Android Chrome ile açın.
2. Menüden **Ana ekrana ekle** / **Uygulamayı yükle** seçin.
3. Uygulamayı ana ekrandan açın.
4. Keep JSON dosyalarınızı uygulama içinden içe aktarın.
5. Sık sık **Yedek indir** düğmesini kullanın.

> Not: PWA olarak kurulabilmesi ve service worker'ın düzgün çalışması için HTTPS gerekir. GitHub Pages HTTPS destekler.

## Google Keep içe aktarma

Google Takeout'tan gelen Keep klasöründeki `.json` dosyalarını seçin. Uygulama şu alanları okumaya çalışır:

- `title`
- `textContent`
- `labels`
- `createdTimestampUsec`
- `userEditedTimestampUsec`

Başlığı boş olan notlarda ilk dize başlık yapılır.

## Güvenlik ve mahremiyet

Uygulamanın kendi kodu şiirleri herhangi bir sunucuya göndermez. Veriler cihazın tarayıcı deposunda tutulur. Yine de tarayıcı verilerini temizlerseniz şiirler silinebilir. Bu yüzden sık sık **Yedek indir** düğmesini kullanın.

GitHub repository'sine şiir JSON/HTML dosyalarını koyarsanız bunlar yayınlanabilir. Bu yüzden sadece uygulama dosyalarını yükleyin.

## Sonraki sürüm fikirleri

- HTML Keep export desteği
- Toplu etiket düzenleme
- Kitap adayları koleksiyonu
- PDF / EPUB dışa aktarım
- Otomatik tema önerisi
- Şiir dönemleri ve istatistik paneli
