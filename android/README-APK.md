# Munnesir 1.0

Bu paket Munnesir Android kaynak paketidir. Android Studio ile açıp debug APK üretebilirsin.

## Bu 1.0 geliştirme paketinde eklenenler

- Çöp kutusu / son silinenler eklendi. Silinen şiirler sen kalıcı olarak silene kadar kalır.
- Çöp kutusunda tekil ve çoklu seçim, geri yükleme ve kalıcı silme var.
- Hamburger menüye Kitap adayları ve Çöp kutusu eklendi. Çöp kutusunun altında `munnesir.com` bağlantısı var.
- Kitap adayları ekranında kitap rafı oluşturup şiirleri genel arama, etiket ve durum üzerinden ekleyebilirsin.
- Yedek dosya adı `munnesir-DD-MM-YY_hour-minute.json` biçimine alındı.
- Arşiv yedeği yükle seçeneği Android'de hem tek JSON seçme hem klasör seçme desteği verir.
- Tema düğmesi artık pop-up açar: Açık Tema, Mor Tema, Zifiri Tema.
- Uygulama sürüm adı hâlâ `1.0` olarak kalır.

## APK üretme

Android Studio'da projeyi aç:

`Build > Build Bundle(s) / APK(s) > Build APK(s)`

APK genelde şurada oluşur:

`app/build/outputs/apk/debug/app-debug.apk`
