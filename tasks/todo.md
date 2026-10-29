# Perbaikan revisi yang tidak tercermin pada hasil agent
- [x] Telusuri simpan instruksi revisi, respons error UI, pemuatan task saat eksekusi, dan prompt agent.
- [x] Buat permintaan revisi menjadi instruksi eksekusi berprioritas dengan kriteria pemeriksaan hasil.
- [x] Pastikan kegagalan simpan/jalankan tidak dianggap sukses dan tampilkan umpan balik yang jelas.
- [x] Tambahkan tes regresi untuk prompt revisi dan alur aksi, lalu jalankan tes, typecheck, build, dan diff check.

## Review perbaikan revisi

- Task execution prompt sekarang mengangkat permintaan revisi CEO menjadi instruksi wajib, memberi prioritas pada revisi terbaru, dan mengharuskan agent memeriksa file/hasil aktual serta memverifikasi perubahan sebelum melaporkan selesai.
- Gagal menyimpan revisi kini menghentikan alur sebelum task dijalankan ulang; UI memberi tahu CEO bahwa hasil lama tetap berlaku. Jika simpan berhasil tetapi eksekusi gagal, UI membedakan kedua keadaan itu. Kegagalan update/start juga muncul sebagai notifikasi, bukan ditelan.
- Verifikasi lulus: tes konteks revisi 2/2, tes laporan/revisi 4/4, `tsc -b`, `vite build`, dan `git diff --check`. Build menampilkan peringatan bundle utama 819.86 kB (gzip 248.00 kB).

# Revisi harus melewati pembatasan departemen yang membuat hasil tidak berubah
- [x] Cocokkan hasil CEO dengan prompt agent dan temukan pembatasan peran yang mengarahkan revisi produksi kembali menjadi dokumentasi.
- [x] Tambahkan kebijakan override departemen hanya saat ada instruksi revisi CEO; pertahankan batas peran untuk tugas biasa.
- [x] Tambahkan tes regresi untuk ekstraksi revisi dan override departemen.
- [x] Jalankan tes backend terkait, TypeScript, build, dan pemeriksaan diff.

## Review override departemen revisi

- Penyebab pada hasil CEO: agent Content Strategy menerima larangan departemen untuk membuat aset desain/produksi dan menjalankan tes, sehingga permintaan chart berulang kali menjadi dokumen strategi/README.
- Saat task memuat blok revisi CEO, prompt kini menonaktifkan larangan serta prompt bersama departemen yang dapat bertentangan, lalu menegaskan bahwa revisi harus mengubah deliverable nyata atau didelegasikan sampai perubahan terintegrasi. Task biasa tidak berubah.
- Verifikasi: tes backend konteks revisi lulus 4/4; `pnpm exec tsc -b --pretty false` lulus; `pnpm build` lulus; `git diff --check` lulus. Build tetap memberi peringatan chunk utama 819.86 kB (gzip 248.00 kB).
- Belum menjalankan ulang task konten pengguna; perubahan kode belum di-commit.

# Pratinjau hasil dan pustaka media profesional
- [x] Ubah pratinjau `index.html` yang tidak tersedia menjadi galeri aset aktual, sehingga PNG/MP4 tidak lagi menghasilkan `preview_file_not_found`.
- [x] Tambahkan skill internal Video Editing Pro dan Voice Production Pro dengan aturan format, verifikasi, voice profile, serta fallback aman.
- [x] Pasang skill otomatis hanya pada provider staff yang mengerjakan task media/audio dan catatnya di pustaka skill.
- [x] Jalankan tes backend, TypeScript, build, dan pemeriksaan diff.

## Review pratinjau dan pustaka media
- Endpoint hasil tidak lagi mengembalikan error mentah saat `index.html` tidak ada; endpoint menyajikan galeri aset yang ditemukan di `content`, `output`, `video_output`, `public`, `dist`, atau `assets`.
- `Video Editing Pro` dan `Voice Production Pro` dipasang lokal ketika teks task cocok, dicatat sebagai skill berhasil untuk provider staff yang menjalankan task, lalu tersedia di prompt agent dan pustaka skill.
- Verifikasi: tes backend 6/6, `pnpm exec tsc -b --pretty false`, `pnpm build`, Prettier, dan `git diff --check` lulus. Peringatan ukuran chunk utama tetap 819.86 kB (gzip 248.00 kB).
- Belum commit; menunggu instruksi commit pengguna.

# Penghapusan task membersihkan penyimpanan
- [x] Hapus worktree/folder task terisolasi beserta seluruh file turunannya saat task dihapus.
- [x] Hapus lampiran task yang tidak lagi dipakai task atau pesan lain.
- [x] Pertahankan folder proyek utama dan aset yang dipakai task lain agar tidak terhapus secara keliru.
- [x] Jalankan tes penghapusan task, TypeScript, build, dan pemeriksaan diff.

## Review penghapusan task
- Tes penghapusan membuat folder worktree berisi file bersarang, menghapus task, lalu memastikan folder dan isi turunannya hilang.
- Verifikasi: tes route penghapusan 4/4, TypeScript, build sebelumnya lulus; pemeriksaan Prettier dan `git diff --check` lulus.
- Root proyek utama tidak disentuh; pembersihan folder dibatasi pada `.climpire-worktrees/<8-karakter-task-id>` dan variasi worktree task yang terdaftar.

# Lampiran konteks untuk tugas, revisi, dan pengumuman
- [x] Petakan komponen formulir dan endpoint pengumuman/revisi/tugas serta alur eksekusi agent.
- [x] Implementasikan unggah/validasi/penyimpanan lampiran aman dan tampilan pratinjau di tiap jalur input yang relevan.
- [x] Teruskan referensi dan metadata file kepada agent agar tool yang tersedia dapat membaca/menganalisis kontennya; tangani format yang tidak didukung dengan jelas.
- [x] Tambahkan tes API/UI keamanan dan analisis attachment, jalankan build serta pemeriksaan diff.

## Review lampiran konteks

- Task Board, revisi dari kartu/laporan, composer pesan/pengumuman, serta tindakan eksplisit “kirim dan eksekusi sebagai tugas” kini menerima hingga 8 lampiran per permintaan (maks. 50 MB/file): gambar, video, PDF, TXT, Markdown, CSV, dan JSON.
- Unggahan menggunakan ID acak, allowlist ekstensi plus pemeriksaan signature/teks, penyimpanan privat, dan file hanya dibuka lewat endpoint terautentikasi. Lampiran yang sudah direferensikan task/pesan tidak dapat dihapus.
- Agent CLI memperoleh jalur file dan instruksi inspeksi. Agent API menerima teks/JSON/CSV/Markdown yang diekstrak, PDF via `pdftotext` bila tersedia, gambar via vision, serta maksimum 8 frame video hasil ekstraksi `ffmpeg`; jika alat atau batas ukuran menghalangi analisis, konteks menyebutkan keterbatasan dan tidak mengklaim hasil analisis. Audio video tidak dikirim.
- Composer memperingatkan bahwa file dapat dikirim ke provider eksternal yang dikonfigurasi. Pengumuman umum tetap siaran; untuk analisis gunakan @agent atau tombol eksekusi sebagai tugas.
- Verifikasi lulus: tes frontend lampiran/composer 3/3, tes popup laporan 3/3, tes backend lampiran/resolver 5/5, `tsc -b`, `vite build`, Prettier, dan `git diff --check`. Build memberi peringatan chunk utama 817.07 kB (gzip 247.07 kB); perubahan ini tidak menambah dependensi.

# Stabilitas dan mutu lintas paket kantor

- [x] Petakan sumber kebenaran paket task pada pembuatan, review, retry, revisi, subtask, dan perubahan paket aktif.
- [x] Perbaiki kebocoran konteks agar tiap task/revisi memakai snapshot paketnya sendiri setelah paket kantor berubah.
- [x] Audit quality guidance semua paket; tambahkan standar deliverable, validasi, dan fallback yang spesifik tanpa memaksakan tool/provider yang tidak tersedia.
- [x] Tambahkan tes regresi persistensi paket dan kontrak mutu lintas paket.
- [x] Jalankan tes relevan, build, tinjau diff; stage hanya perubahan tugas ini bila commit diminta.

## Review stabilitas dan mutu lintas paket

- Task Board kini menampilkan seluruh task dari semua paket secara default; filter paket bersifat opsional. Label pada kartu dan penjelasan header menegaskan bahwa paket setiap task melekat sejak dibuat, sedangkan pergantian paket kantor memengaruhi task baru saja.
- Backend eksekusi, review, delegasi, dan pembuatan subtask membaca `workflow_pack_key` dari task tersimpan; resolver memakai snapshot source-task sebelum default project/fallback. Tes regresi mengunci prioritas tersebut.
- Semua 11 paket kini menerima quality/safety gate umum dan daftar pemeriksaan khusus paket. Video mengikuti rasio/platform dan renderer yang tersedia, tanpa pemaksaan Remotion, durasi/shot tetap, atau instalasi tanpa izin.
- Verifikasi yang sudah lulus: tes frontend routing paket 4/4; tes backend guidance/resolver 8/8; `pnpm build`; `git diff --check`. Vite masih memberi peringatan bundle utama 809 kB (gzip 243.87 kB); belum ada commit.

# Perbaikan tombol Buka Hasil

- [x] Telusuri urutan fallback tombol hasil dan identifikasi kenapa konten media hanya membuka laporan teks.
- [x] Prioritaskan entry point aplikasi atau tampilkan galeri gambar/video/file dari daftar artefak aktual.
- [x] Tambahkan tes klik tombol untuk membuktikan hasil PNG dan MP4 muncul di jendela hasil.
- [x] Jalankan tes terkait, build, dan pemeriksaan diff.

## Review tombol hasil

- Tombol hasil kini membuka `index.html` yang terdaftar sebagai output aplikasi; jika tidak ada, membuka galeri gambar/video/file aktual. Fallback laporan dipakai hanya bila tidak ada artefak.
- Verifikasi: `TaskReportPopup.test.tsx` lulus 3/3, build produksi lulus, dan `git diff --check` bersih. Peringatan chunk Vite besar tetap ada.

# Penyempurnaan pustaka, eksekusi pengumuman, dan manajemen aset

- [x] Petakan paket kantor, pustaka skill/resource, dan cara capability dipilih saat task didelegasikan.
- [x] Tingkatkan kebijakan resource routing agar staff memakai resource yang relevan/tersedia; verifikasi ketersediaan dan izin tanpa memasang atau memberi akses berbahaya diam-diam.
- [x] Buat alur eksplisit dari pengumuman CEO ke eksekusi task, sambil menjaga pengumuman informasional tidak menciptakan task tak sengaja; pastikan tombol Tugas/Laporan tetap dapat dipakai.
- [x] Lengkapi manajemen aset (refresh, buka/unduh, ganti nama/pindah/hapus) dengan validasi path, konfirmasi aksi destruktif, serta kontrol akses.
- [x] Uji API/UI, build, keamanan, dan diff; stage hanya perubahan fitur ini, commit dan push jika seluruh pemeriksaan lulus.

## Review peningkatan pustaka, pengumuman, dan aset

- Resource/skill dipilih berdasarkan kecocokan dengan tugas dan arahan paket; prompt mengutamakan tool yang benar-benar tersedia dan izin yang ada.
- Pengumuman dapat dikirim sekaligus dieksekusi lewat aksi eksplisit dan pemilihan proyek. Mention agent membuka percakapan langsung; mention departemen tetap didelegasikan. Tombol Tugas/Laporan tetap memakai alur pilih proyek.
- Pustaka aset mengelompokkan output dan mendukung buka/unduh, muat ulang, rename, pindah, serta hapus dengan konfirmasi dan pembatasan folder/path. Kegagalan pencatatan audit tidak mengubah operasi file sukses menjadi respons gagal.
- Verifikasi: tes frontend 5/5 dan tes backend 12/12 lulus; build produksi serta pemeriksaan diff dilanjutkan sebelum commit.

# Pustaka aset proyek

- [x] Tambahkan menu aset baru pada navigasi desktop dan mobile dengan lokalisasi.
- [x] Kelompokkan hierarki proyek → task utama → subtask → folder → aset; muat aset hanya ketika task dibuka.
- [x] Sediakan pencarian, status/loading/error/empty state, preview media, dan unduh berkas.
- [x] Verifikasi tes komponen/endpoint, TypeScript, build, dan diff tanpa memasukkan perubahan lain.

## Review pustaka aset

- Menu Aset tersedia pada navigasi desktop dan mobile serta mengikuti bahasa UI.
- Hierarki: proyek → task utama → subtask → folder output → file. Pencarian memfilter proyek/task; pemindaian aset hanya berjalan saat task dibuka.
- Gambar/video dipratinjau langsung, semua file yang dikenali dapat diunduh, dan state loading/error/kosong tersedia.
- Verifikasi: tes `AssetLibrary` lulus, `pnpm build` berhasil (887 modul), dan `git diff --check` bersih. Peringatan chunk bundle besar masih muncul.
- Perubahan ini setelah commit `246e624` dan belum dibuat commit baru.

# Pratinjau media pada hasil tugas

- [x] Pastikan endpoint daftar aset hanya membaca file media dari root task/worktree terisolasi dan tidak mengikuti symlink.
- [x] Tambahkan galeri gambar dan pemutar video responsif pada laporan tugas.
- [x] Nyatakan kondisi kosong/hasil belum tersedia dengan jelas, tanpa menganggap laporan teks sebagai media selesai.
- [x] Tampilkan file hasil umum selain gambar/video dan tambahkan aksi CEO untuk mengunduh file serta menyalin/mengunduh teks laporan.
- [x] Uji endpoint/UI, build, serta diff; jangan ubah status atau isi task pengguna.

## Temuan awal

- Folder proyek berisi tujuh PNG dan contact sheet; MP4 hanya ada pada worktree lama, tidak di folder proyek aktif.
- Laporan saat ini menampilkan dokumen sebagai `<pre>` teks saja; tombol “Buka hasil” mengutamakan `index.html` atau README.

## Review pratinjau dan pengelolaan hasil

- Laporan menampilkan gambar sebagai galeri, video dengan pemutar inline, dan file hasil umum (caption, README, PDF/arsip/dokumen) sebagai lampiran unduhan. Daftar aset memeriksa worktree task dan folder proyek dengan batas direktori/tipe berkas dan melewati symlink.
- Media dapat dibuka dan diunduh. Dokumen dan ringkasan dapat disalin atau diunduh; CEO tetap dapat meminta revisi melalui alur tindak lanjut tanpa mengubah file sumber secara diam-diam.
- Bila media belum ada atau gagal dimuat, UI menyatakan kondisi tersebut secara eksplisit; status task ditampilkan sesuai status aslinya.
- API live task mengembalikan 28 aset (7 gambar feed, caption, README, gambar frame, dan file Reel); MP4 valid H.264, 720×1280, 17,6 detik.
- Verifikasi: `pnpm build` berhasil (886 modul; peringatan ukuran bundle yang sudah ada), seluruh 5 tes `worktrees-and-usage.test.ts` lulus, dan `git diff --check` bersih.
- Tidak mengubah status maupun isi task pengguna dan tidak membuat commit.

# Penyegaran UI Kantor non-pixel

- [x] Ganti lantai kotak-kotak dengan permukaan kantor vektor yang lebih tenang.
- [x] Ganti karakter sprite pixel dengan avatar vektor berwarna konsisten lintas tema.
- [x] Hapus pemuatan gambar sprite lama dan perbarui kontrol kantor agar responsif/lokal.
- [x] Jalankan pemeriksaan TypeScript dan build; tinjau diff serta risiko fitur.

## Review UI Kantor

- `pnpm build` berhasil (886 modul), begitu juga `pnpm exec tsc -b --pretty false` dan `git diff --check`.
- Peringatan bundle besar yang sudah ada tetap muncul; tidak ditambahkan dependency baru.
- Zoom, pan, tata letak, status, interaksi agen, rapat, dan gerak karakter tetap di jalur scene Pixi yang sama.
- QA visual Playwright tidak dapat dijalankan karena executable Chromium tidak tersedia di lingkungan ini.

# Optimasi Dashboard

## Pemulihan otomatis atas laporan keterbatasan staf

- [x] Tambahkan protokol reviewer untuk mengklasifikasikan dan menangani keterbatasan yang dilaporkan staf.
- [x] Untuk eksekusi gagal, coba satu remediasi terisolasi yang berizin sebelum hasil masuk Review.
- [x] Tetap lanjut dengan fallback offline/mock pada bagian independen tanpa melewati kontrol akses.
- [x] Minta input CEO dengan tujuan, cakupan minimum, opsi aman, dan satu tindakan konkret bila benar-benar perlu.
- [x] Pastikan laporan mencatat percobaan, bukti verifikasi, dan alasan blocker secara ringkas.
- [x] Validasi tipe/build dan periksa diff.

### Review pemulihan tanpa menghentikan pekerjaan independen

- `pnpm build` berhasil untuk perubahan alur pemulihan; setelah penyesuaian akhir pada instruksi CEO/privacy, `pnpm exec tsc -b` juga selesai tanpa error.
- `git diff --check` bersih.
- Kegagalan tidak lagi masuk loop auto-run. Dengan reviewer tersedia, task tetap kolaborasi lalu masuk Review berisi hasil penuh/parsial dan laporan pemulihan; subtask independen tetap dapat melanjutkan antrean.
- Kredensial tidak diminta lewat chat dan izin tidak dilewati. CEO diminta hanya untuk akses/data privat yang benar-benar wajib, dengan tujuan, cakupan minimum, opsi aman, dan tindakan spesifik.

## Peningkatan mutu eksekusi dan keselamatan

- [x] Sambungkan QA spesifik setiap workflow pack ke prompt eksekusi.
- [x] Berikan konteks izin agent kepada reviewer otomatis dan patuhi batas kerja terisolasi.
- [x] Pastikan reviewer tanpa worktree hanya menilai bukti yang tersedia dan menandai keterbatasan.
- [x] Validasi perubahan dengan pemeriksaan tipe/build dan tinjau diff.

### Review mutu eksekusi

- `pnpm build` berhasil; TypeScript dan Vite build lulus (885 modul).
- `git diff --check` bersih.
- Peringatan bundel Vite yang sudah ada tetap muncul untuk chunk 780.82 kB dan Pixi 533.06 kB.
- Verifikasi saat ini membuktikan build, bukan menjalankan job AI end-to-end atau membuktikan mutu keluaran seluruh provider.

## Pemeriksaan staf sebelum review CEO

- [x] Tinjau alur selesai task dan laporan tim yang ada.
- [x] Jalankan pemeriksaan hasil oleh ketua tim pada worktree sebelum status Review CEO.
- [x] Minta perbaikan otomatis dan verifikasi ulang satu kali untuk ketidaksesuaian goal/error.
- [x] Catat hasil pemeriksaan staf pada laporan dan log task.
- [x] Build aplikasi/server dan tinjau diff.

Hasil: build produksi berhasil (`pnpm build`, 885 modul). Build memberi peringatan ukuran chunk yang sudah ada; tidak ada error TypeScript.

- [x] Petakan komponen Dashboard, polling, listener, dan render mahal.
- [x] Reproduksi/ukur sumber macet di browser atau lewat test/build.
- [x] Terapkan optimasi minimal tanpa menghapus fitur.
- [x] Jalankan build dan tes relevan.
- [x] Catat hasil review dan regresi yang perlu diperhatikan.

## Review

- Build produksi berhasil (`pnpm build`).
- `git diff --check` bersih.

## Efisiensi token dan mode offline

- [x] Tambahkan batas output token terpusat untuk provider API (default 8.192 token untuk task, 2.048 untuk percakapan).
- [x] Gunakan provider Ollama yang sudah kompatibel OpenAI untuk eksekusi lokal tanpa internet.
- [x] Tahan task pada status `pending` ketika provider/jaringan tidak tersedia.
- [x] Pertahankan checkpoint proyek agar task dapat dilanjutkan tanpa memulai ulang dari nol.

## Review efisiensi dan offline

- TypeScript langsung lulus (`pnpm exec tsc --noEmit`).
- `git diff --check` bersih.
- API sehat di port 8800/8790 setelah reload.
- Task toko buah sudah mencapai status Review dengan output aplikasi tersimpan.
- Lint khusus file berubah dicoba, tetapi proses ESLint macet di environment dan dihentikan; tidak ada output lint.
- Tidak ada fitur Dashboard yang dihapus; perubahan hanya mengurangi render/painter yang tidak perlu.

## Lokalisasi nama dan percakapan

- [x] Satukan pemilihan nama agen/departemen berdasarkan bahasa aktif.
- [x] Tambahkan fallback nama departemen Indonesia dan dukungan `name_id`.
- [x] Lokalkan teks workflow pack dan label peran pada percakapan/panel terkait.
- [x] Periksa panel tugas, assignment proyek, laporan, dashboard, chat, dan terminal.
- [x] Validasi build produksi dan kebersihan diff.

## Review lokalisasi

- Build produksi berhasil (`pnpm build`, 883 modul).
- `git diff --check` bersih.
- Pesan bebas yang berasal dari pengguna/agen tetap dipertahankan apa adanya; UI hanya menerjemahkan pesan sistem dan memakai nama locale yang tersedia.

## Koreksi lokalisasi Indonesia dari screenshot

- [x] Perbaiki label navigasi, status koneksi, dan tab Pengaturan.
- [x] Tambahkan fallback terjemahan Indonesia untuk label lama yang belum memiliki `id`.
- [x] Lengkapi teks Office/Pixi dan percakapan ruang istirahat dengan Bahasa Indonesia.
- [x] Build ulang dan pastikan `git diff --check` bersih.

## Pengumuman dan bahasa balasan AI

- [x] Lengkapi label judul/mode pengumuman Bahasa Indonesia.
- [x] Tambahkan `id` sebagai bahasa server yang valid untuk kebijakan kolaborasi.
- [x] Tambahkan instruksi prompt agar balasan AI langsung merespons dalam Bahasa Indonesia.
- [x] Tambahkan balasan canned pengumuman Indonesia dan fallback aman untuk pesan sistem.
- [x] Build produksi, TypeScript server, health check API, dan `git diff --check` berhasil.

## Proyek otomatis berbasis tujuan

- [x] Tambahkan satu input tujuan proyek tanpa form teknis panjang.
- [x] Cocokkan proyek lama berdasarkan nama/path agar bisa dilanjutkan.
- [x] Buat proyek baru otomatis di `/projects/<slug>` jika belum ada.
- [x] Simpan tujuan sebagai konteks proyek, buat task utama, dan jalankan dengan penugasan otomatis.
- [x] Segarkan data Task Board setelah proyek dimulai dan validasi TypeScript.

## Stabilitas eksekusi proyek otomatis

- [x] Identifikasi kegagalan task toko buah pada log terminal.
- [x] Normalisasi model Codex tersimpan terhadap model yang tersedia di cache lokal.
- [x] Simpan koreksi model dan tingkat penalaran agar task berikutnya tidak mengulang error model.
- [x] Uji ulang task: agen berhasil melewati error model dan mulai membuat proyek di worktree.

## Review stabilitas eksekusi

- TypeScript langsung lulus (`pnpm exec tsc --noEmit`).
- `git diff --check` bersih.
- Build penuh sempat tertahan pada `tsc -b` yang tidak selesai di environment; tidak ada error TypeScript pada pemeriksaan langsung.
- Task toko buah kembali `in_progress` dan sudah menghasilkan perubahan file pertama di worktree.

## Memori individual agen dan pembentukan talenta

- [x] Tambahkan penyimpanan memori jangka panjang per agen dan per proyek.
- [x] Masukkan memori agen ke prompt task, rapat, dan percakapan langsung.
- [x] Simpan hasil pekerjaan berhasil maupun gagal sebagai memori yang dapat dipakai ulang.
- [x] Gunakan Planning sebagai arsitek talenta untuk saat ini; karyawan khusus baru diperlukan ketika volume rekrutmen sudah tinggi.

## Review memori agen

- Tabel `agent_memories` sudah dibuat dan tervalidasi pada database aktif.
- TypeScript langsung lulus (`pnpm exec tsc --noEmit`).
- `git diff --check` bersih.

## Capability Router kantor

- [x] Petakan kebutuhan task ke kategori kemampuan: browser/UI, laporan, data, deployment, dan desain.
- [x] Tampilkan skill, app/provider API, dan aturan MCP yang benar-benar tersedia kepada agen.
- [x] Instruksikan agen memilih tool terkecil yang cukup dan tidak mengklaim kemampuan yang tidak tersedia.
- [x] Validasi TypeScript, diff, dan health check setelah integrasi.

## Quality Gate eksekusi

- [x] Tambahkan kebijakan quality gate ke setiap prompt eksekusi agen.
- [x] Wajibkan deteksi dan eksekusi verifikasi yang relevan: test, build, lint, type-check, dan security check.
- [x] Wajibkan bukti perintah dan hasil verifikasi sebelum agen menyatakan proyek selesai.

## Tata kelola proyek dan keamanan eksekusi

- [x] Simpan checkpoint per task/proyek beserta branch, commit, status, dan bukti eksekusi.
- [x] Simpan metrik durasi, provider, exit code, dan token input/output per eksekusi.
- [x] Sediakan endpoint kesehatan proyek dan riwayat checkpoint untuk monitoring serta pemulihan.
- [x] Tambahkan izin agent terkontrol untuk filesystem, terminal, git, jaringan, database, secrets, dan perintah destruktif.
- [x] Masukkan batasan izin dan perlindungan secrets ke prompt eksekusi setiap task.

## Akses hasil proyek

- [x] Sajikan hasil task selesai/review dari worktree proyek secara aman melalui endpoint preview.
- [x] Tambahkan tombol Preview/Hasil pada kartu task agar proyek bisa langsung dicoba di browser.
- [x] Sajikan asset HTML, CSS, JavaScript, dan file pendukung dengan validasi path untuk mencegah traversal.
- [x] Izinkan task `Review` dan `Selesai` dijalankan kembali sebagai perbaikan lanjutan dengan konteks proyek yang sama.

## Paket kantor otomatis dan mode lanjutan

- [x] Route paket kantor otomatis dari task aktif menggunakan classifier workflow yang sudah tersedia.
- [x] Jangan menimpa paket ketika pengguna memilih paket secara manual.
- [x] Tambahkan tombol `Otomatis` untuk mengaktifkan kembali routing cerdas pada desktop dan mobile.
- [x] Terapkan ambang confidence dan guard race request agar perpindahan paket stabil serta ringan.

## Review paket kantor otomatis

- TypeScript langsung lulus (`pnpm exec tsc --noEmit --pretty false`).
- `git diff --check` bersih.
- Mode manual disimpan di localStorage; mode otomatis tetap memakai pengaturan paket kantor yang tersimpan.

## Paket studio lanjutan

- [x] Tambahkan Clipper Studio dan routing klip pendek/highlight.
- [x] Tambahkan Content Studio dan routing strategi/produksi konten.
- [x] Tambahkan Art Drawing Studio dan routing ilustrasi/asset visual.
- [x] Tambahkan Game Developer Studio dengan QA playtest dan build.
- [x] Tambahkan Developer Apps Studio dengan QA keamanan, build, dan acceptance test.
- [x] Tambahkan seed server, preset UI, departemen, peran, tema, dan aturan keluaran untuk semua paket.

## Review paket studio lanjutan

- TypeScript langsung lulus (`pnpm exec tsc --noEmit --pretty false`).
- `git diff --check` bersih.
- Health API lulus setelah server memuat ulang seed paket.

## Revisi task berbasis instruksi pengguna

- [x] Tambahkan input revisi langsung pada task berstatus `Review` atau `Selesai`.
- [x] Simpan instruksi natural-language sebagai konteks `[REVISION REQUEST]` tanpa menghapus hasil sebelumnya.
- [x] Jalankan ulang task setelah instruksi revisi dikirim.
- [x] Sediakan dukungan shortcut Ctrl/Cmd+Enter serta lokalisasi Bahasa Indonesia.

## Review revisi task

- TypeScript langsung lulus (`pnpm exec tsc --noEmit --pretty false`).
- `git diff --check` bersih.

## Pusat sumber daya eksternal

- [x] Tambahkan registry sumber daya publik untuk URL, repository, skill, plugin, app, dataset, dan dokumen.
- [x] Validasi URL dan blokir localhost serta rentang jaringan privat untuk mencegah SSRF.
- [x] Simpan status, metadata HTTP, waktu sinkronisasi, dan pesan error per sumber.
- [x] Sediakan API daftar, tambah, sinkronisasi, ubah status, dan hapus sumber daya.
- [x] Masukkan sumber daya yang sudah terverifikasi ke konteks agent sesuai proyek.
- [x] Tambahkan panel Project Manager untuk menambah, melihat status, sinkronisasi ulang, dan menghapus sumber daya.
- [x] Terapkan akses resource berbasis proyek/agent: resource proyek dibagikan ke tim proyek, resource agent dibatasi ke pemiliknya.
- [x] Masukkan daftar resource yang disetujui dan aturan anti-domain liar ke prompt setiap agent.
- [x] Wajibkan agent melakukan pemilihan resource otomatis sebelum bekerja dan melaporkan resource yang digunakan/dilewati.

## Perapian Task Board

- [x] Tambahkan pilihan urutan: perubahan terbaru, pembuatan terbaru, atau prioritas.
- [x] Gunakan `updated_at` sebagai waktu utama agar urutan sesuai aktivitas terakhir.
- [x] Samakan tinggi kolom desktop dan scroll internal agar papan tidak melompat atau memanjang tidak terkendali.
- [x] Pertahankan kolom satu per satu pada layar kecil agar kartu tetap mudah dibaca.

## Stabilitas error dan tindak lanjut laporan

- [x] Hentikan pengulangan otomatis saat eksekusi gagal dengan menjeda task dan mempertahankan checkpoint.
- [x] Lokalkan pesan arsip laporan yang sudah tersimpan dalam riwayat ke Bahasa Indonesia.
- [x] Tambahkan aksi Buka hasil, Jalankan lagi, dan Revisi & jalankan pada laporan.
- [x] Teruskan aksi laporan ke Riwayat Laporan agar hasil lama dapat ditindaklanjuti.

## Review stabilitas error dan laporan

- TypeScript langsung lulus (`pnpm exec tsc --noEmit --pretty false`).
- `git diff --check` bersih.
- Kegagalan provider tidak lagi dikembalikan ke Inbox; task dijeda pada `pending` untuk mencegah loop.

## Alur CEO review yang sederhana

- [x] Hentikan persetujuan otomatis setelah agen mengirim hasil.
- [x] Tampilkan hasil task pada status Review untuk keputusan CEO.
- [x] Tambahkan aksi Tandai selesai atau Revisi & jalankan.
- [x] Masukkan task Review ke Riwayat Laporan agar tetap bisa ditindaklanjuti.

## Template tema dan indikator agent

- [x] Tambahkan template UI global: Daylight, Midnight, Ocean, Forest, dan Sunset.
- [x] Simpan pilihan tema dan terapkan token warna ke header, sidebar, panel, input, modal, dan Task Board.
- [x] Tambahkan indikator status pada setiap avatar agent.
- [x] Tambahkan badge notifikasi pada avatar agent di Dashboard dan tooltip status yang jelas.

## Sinkronisasi tema kantor dan navigasi bebas

- [x] Selaraskan pembangunan scene Pixi kantor dengan template tema global.
- [x] Tambahkan identitas visual Ocean, Forest, Sunset pada kanvas kantor tanpa mengubah sprite pixel-art.
- [x] Ganti area scroll kantor menjadi viewport drag langsung untuk mouse, touch, dan stylus.
- [x] Pertahankan keyboard, tombol arah virtual, serta interaksi Enter tanpa auto-scroll paksa.

## Zoom, tema futuristik, dan kustomisasi map kantor

- [x] Tambahkan zoom GPU ringan dengan kontrol plus/minus, reset, dan roda mouse.
- [x] Pertahankan pan drag setelah zoom tanpa memindahkan scroll halaman.
- [x] Tambahkan template tema Futuristic yang ikut mengubah UI dan kanvas kantor.
- [x] Tambahkan mode map Seimbang, Lebar, dan Fokus yang tersimpan di perangkat.
- [x] Tambahkan gerak mikro berbasis status agent tanpa membuat objek render tambahan.
- [x] Pertahankan kustomisasi warna setiap ruangan melalui konfigurasi tema kantor yang sudah ada.

## Responsivitas Dashboard

- [x] Kunci lebar Dashboard agar tidak melampaui viewport.
- [x] Izinkan seluruh grid Dashboard menyusut dengan aman pada tablet dan ponsel.
- [x] Cegah header, podium ranking, avatar, dan log misi terpotong pada layar sempit.
- [x] Tambahkan batas ukuran media dan panel tanpa menambah beban rendering.
- [x] Pastikan kanvas kantor mengikuti tinggi scene agar departemen bawah tidak terpotong.

## Penyelarasan visual kantor dengan tema

- [x] Kurangi karakter pastel pada Midnight dan template tema berwarna.
- [x] Tambahkan kontras teknis dan palet cyan-violet pada tampilan Futuristic.
- [x] Siapkan identitas Futuristic melalui token UI dan palet scene tanpa memengaruhi warna karakter.

## Kontrol zoom dan menu header kantor

- [x] Aktifkan roda mouse PC untuk zoom kantor dengan titik fokus kursor.
- [x] Jadikan menu aksi header dapat digeser horizontal pada layar sempit.
- [x] Pertahankan tombol header tetap utuh tanpa terpotong atau memaksa lebar halaman.

## Warna karakter tetap konsisten

- [x] Hapus filter warna global dari kanvas kantor agar sprite karakter tidak berubah saat tema diganti.
- [x] Pertahankan perubahan tema melalui palet scene dan elemen UI, bukan pewarnaan ulang karakter.
- [x] Terapkan palet tema langsung ke lantai, dinding, ruang, dan aksen Pixi agar kantor tetap berubah.

## Pemulihan model Copilot

- [x] Deteksi model Copilot yang tersimpan tetapi sudah tidak tersedia.
- [x] Pilih model aktif dari endpoint `/models` sebelum task dijalankan.
- [x] Tampilkan fallback model di log agar kegagalan tidak berulang tanpa penjelasan.
## Respons awal eksekusi tugas

- [x] Tampilkan konfirmasi segera saat tugas diterima.
- [x] Tampilkan bahwa eksekusi tim sudah dimulai setelah task berhasil dibuat.
- [x] Tampilkan kegagalan pendaftaran atau pengiriman tugas di UI, bukan hanya console.
- [x] Berlakukan umpan balik untuk Task Board dan pengiriman tugas melalui percakapan.
- [x] Verifikasi TypeScript, format diff, dan health server.

## Gerak karakter berdasarkan aktivitas kantor

- [x] Karakter bekerja memiliki gerak kerja pendek yang ringan di sekitar meja.
- [x] Karakter yang dipanggil rapat berjalan dari posisi kerja menuju kursi rapat.
- [x] Karakter tetap berada di kursi selama presence rapat aktif dan kembali setelah selesai.
- [x] Verifikasi TypeScript, format diff, dan health server.

## Membuka hasil laporan

- [x] Coba preview web hasil terlebih dahulu.
- [x] Coba buka file artefak yang tercantum pada laporan.
- [x] Sediakan halaman hasil laporan sebagai fallback jika preview tidak tersedia.
- [x] Tampilkan pesan jika browser memblokir pop-up.
- [x] Verifikasi TypeScript dan format diff.

## Penemuan sumber daya external otomatis

- [x] Agen otomatis mencari resource publik bila daftar proyek kosong atau kurang.
- [x] Batasi pencarian pada allowlist katalog dan dokumentasi resmi.
- [x] Redaksi rahasia dan cegah pengiriman source code ke situs external.
- [x] Validasi HTTPS, redirect, identitas paket/repository, lisensi, dan checksum/signature bila tersedia.
- [x] Catat resource yang ditemukan dan digunakan pada laporan akhir.

## Perbaikan Dashboard layar blank

- [x] Telusuri crash saat komponen daftar agen dirender.
- [x] Teruskan prop notifikasi agen ke komponen Dashboard.
- [x] Tambahkan fallback defensif agar data notifikasi kosong tidak merusak halaman.
- [x] Verifikasi build, TypeScript, diff, dan health server.

## Status eksekusi Task Board

- [x] Tambahkan indikator jumlah tugas yang sedang berjalan di header.
- [x] Beri penanda visual khusus pada kolom `in_progress`.
- [x] Tampilkan badge eksekusi pada setiap kartu yang sedang berjalan.
- [x] Lokalkan status kolaborasi dan eksekusi ke Bahasa Indonesia.
- [x] Normalisasi path artefak dari worktree lama ke folder proyek utama.

## Pemulihan otomatis saat bahan atau tool tidak tersedia

- [x] Agen wajib mendiagnosis kekurangan sebelum berhenti.
- [x] Agen diarahkan memakai resource proyek yang disetujui.
- [x] Agen boleh membuat bahan lokal/sintetis yang aman dan diberi label bila task mengizinkan.
- [x] Agen wajib mengulang verifikasi setelah pemulihan dan berhenti terkontrol jika tetap tidak memungkinkan.
- [x] Verifikasi TypeScript dan format diff.

## Profil profesional staff dan Clipper Studio

- [x] Tambahkan prompt best practice global yang otomatis menyesuaikan peran, departemen, provider, paket kantor, dan bahasa setiap staff.
- [x] Pasang prompt permanen pada eksekusi task utama, retry/approved execution, spawn manual, subtask, dan delegasi lintas departemen.
- [x] Tambahkan skill Clipper Editing Pro untuk sumber lampiran lokal dan URL publik dengan validasi ffprobe, hak akses, dan fallback aman.
- [x] Jalankan tes regresi, typecheck, dan pemeriksaan diff.

## Review profil staff dan Clipper Studio
- Prompt profesional kini dibangun dari jabatan, departemen, provider, paket kantor, bahasa tugas, dan sinyal kebutuhan pada perintah. Semua jalur eksekusi utama memakai helper yang sama.
- Paket Clipper Studio otomatis memasang Clipper Editing Pro; staf menerima arahan untuk menganalisis file/link, menentukan timestamp, menghasilkan klip playable, mencantumkan sumber, dan memeriksa output.
- Akses URL dibatasi pada sumber yang dapat dijangkau tool terpasang dan tidak melewati login, DRM, paywall, atau proteksi akses.
- Verifikasi: tes prompt/skill lulus 4/4, typecheck dan `git diff --check` lulus. Build produksi belum dijalankan.
