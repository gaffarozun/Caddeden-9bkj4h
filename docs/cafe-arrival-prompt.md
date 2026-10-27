# Yakınlık sıralaması ve 50 m mekân seçimi

- Keşfet → En yakın, açık konum izniyle alınan güncel GPS ölçümüne göre işletmeleri sıralar. Konumu olmayan işletmeler ve demolar sona gelir; sahte mesafe kullanılmaz. Önerilen/puan sıralaması ve ürünlerin fiyat sıralaması korunur. Konum sıralaması kullanıcının seçimiyle, daha sonraki konum yenilemesi aşağı çekmeyle yapılır; keşfet otomatik yenilenmez.
- Yakınlık bulutu, 50 metreden yakın tüm yayındaki konumlu işletmeleri yakınlığa göre listeler. Kullanıcı bir işletme seçip “Evet, buradayım” ile doğrular. Tarama kendi başına katılım oluşturmaz. Onay anında GPS yeniden alınır ve seçilen işletme sunucuda doğrulanır.
- 20 m GPS hassasiyet sınırı kaldırılmıştır; hassasiyet eksik olabilir veya 20 m üzerinde olabilir. Geçersiz koordinatlar, negatif/sonsuz hassasiyet ve eski ölçümler reddedilir. Mesafe GPS ölçümüne dayanır; gerçek fiziksel doğruluk cihaz koşullarına bağlıdır.
- Giriş mesafesi 50 m altıdır. Aynı sınırın dışına çıkınca mevcut ön plan konum kontrolü katılımı sonlandırır. Uygulama kapalı/arka plandaysa konum izlenmez; son başarılı doğrulamadan 90 saniye sonra katılım sona erer. RPC kilidi ve süresi dolmuş katılımı kendiliğinden yenilememe kuralı korunur.
- Doluluk ve demografik oranlar herkese açıktır. Profil ve fotoğraf erişimi yalnızca doğrulanmış aynı mekândaki, Instagram eklemiş müşterilere açılır. Genel gizlilik ve giriş başına Göster/Gizle seçenekleri korunur. İşletmeler müşteri erişimini kapatamaz.
- Kompakt doluluk kartında iki ayrı çift vardır: Kadın / Erkek ve Üniversite öğrencisi / Üniversite öğrencisi değil. Her çift kendi beyan edilmiş grubunda %100'e tamamlanır. Açıklanmayan beyanlar gizlenir ve üniversite öğrencisi değil olarak etiketlenmez. Sıfır bilinen beyanda oran yerine çizgi gösterilir.
- Doluluk yüzdesi onaylı katılımcı / işletmenin masa kapasitesidir; fiziksel doluluk sayımı değildir. Kapasite tanımlanmadığında oran uydurulmaz. Kullanıcılara masa çizimi gösterilmez.
- Bildirim kutusu, karşılıklı Instagram onayı ve iki taraftan izin kaldırma; okul/soyad gizliliği; kapalı işletmede sipariş engeli değişmedi.

## Kontroller
Sunucu 50 m sınırı, hassasiyet üst sınırının kalkması, GPS güncelliği, heartbeat kilidi ve uzaktan profil gizliliği salt okunur SQL ile doğrulandı. TypeScript regresyonları `tests/cafeArrivalChecks.ts` ve `tests/nearbyDiscoveryChecks.ts` içindedir. Gerçek cihazda izin reddi, birden fazla yakındaki işletmeden seçim, 49/50/51 m, arka plana geçiş ve GPS kaybı ayrıca test edilmelidir.
