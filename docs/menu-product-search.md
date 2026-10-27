# Keşfet: ürün ve hizmet araması

- İşletme/kategori araması korundu; aynı alanda Menü & Fiyatlar listelerindeki ürün ve hizmet adları da aranır.
- Örneğin “döner” sorgusu döner ürünlerini fiyatı düşükten yükseğe gösterir. Kartta ürün adı, güncel fiyat, işletme adı, bağımsız işletme yıldız puanı ve oy sayısı bulunur. Ürüne ayrı bir puan verilmez; puansız işletmeler “Henüz puan yok” olarak gösterilir.
- Ürün kartından ilgili işletmenin menüsüne ve ürünün menü grubuna, işletme adından profiline geçilir. Uzun menülerde satıra otomatik kaydırma henüz yapılmaz.
- Ana/alt kategori ve Sadece Açık filtresi ürün sonuçlarına da uygulanır. Açık işletme kimlikleri mevcut çalışma saati değerlendirmesiyle belirlenir. Açık filtresi mevcut Keşfet işletme kapsamını kullanır.
- Ürün fiyat sırası işletme puan sıralamasından bağımsızdır. İşletme/kategori eşleşmeleri ürünlerin altında gösterilir. Arama temizlenince kampanya alanı ve normal Keşfet sıralaması geri gelir.
- Türkçe harfler, büyük/küçük harfler ve ASCII yazım eşleştirilir; tüm kelimeler ürün adında aranır. `%` ve `_` gibi karakterler sorguyu genişleten SQL jokerleri değildir.

## Veri ve performans

`searchTextService` / `menuSearchService` → `useMenuSearch` / `useDiscoveryFeed` → `MenuSearchCard` / Keşfet ekranı.

Ürünler gerçek OnSpace Cloud `menu_items` kayıtlarından gelir; yeni örnek ürünler eklenmez. Önceden var olan örnek işletmeler normal işletme sonuçlarında kalır. `public_menu_search` yalnızca onaylı, yayındaki ve fiyat listesini paylaşan işletmeleri döndürür; kullanıcı/işletme sahibi özel bilgilerini döndürmez. Mevcut RLS ve tüm geçmiş kayıtları korunmuştur.

Sorgular 250 ms geciktirilir, 200 karakterle sınırlandırılır; sayfa başına en fazla 40 sonuç döner. Eşit fiyatlarda ürün kimliği kararlı sıralama sağlar. Daha fazla sonuç için sayfalama, yükleme/boş/hata durumları ve yeniden deneme vardır. Eski sorgu yanıtları ve ekran kapanışından sonra gelen yanıtlar yok sayılır. Mevcut puan yenileme döngüsü ve elle yenileme aramayı günceller.

## Doğrulama

Canlı veritabanında salt okunur kontroller başarıyla çalıştırıldı: Türkçe normalizasyonu, boş/geçersiz sorgular, boş açık-işletme filtresi, ürünlerin yayın görünürlüğü, gerçek fiyatlar, artan fiyat sırası, eşit fiyat sırası, sayfalama ve anonim erişim. Mevcut yayındaki bir döner ürünü, fiyatı ve işletmenin 4,5 yıldız puanı ile gerçek sorgu üzerinden doğrulandı. İşletme ve menü tablolarında RLS korunuyor.

Tekrarlanabilir kontroller: `supabase/tests/menu_product_search_read_only.sql` ve `runMenuSearchChecks()`. Bu oturumda TypeScript test çalıştırıcısı veya iOS/Android cihaz testi çalıştırılmadı.

Cihaz kontrolü: “döner” / “doner” / “DÖNER”; hizmet araması; kategori değişimi; Sadece Açık; hızlı yazma/silme; fiyat sıralı sayfalama; puansız işletme; ürünün menü grubuna ve işletme profiline geçiş; küçük ekran ve yatay görünüm.
