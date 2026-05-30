# 🚀 PANDUAN DEPLOYMENT MANUAL KE VPS

Panduan ini berisi langkah-langkah detail untuk melakukan deployment pembaruan kode dari repositori lokal Anda (`PPOB-Adnanpay` branch) ke VPS (`192.168.1.8`) melalui GitHub.

---

## 💻 Langkah 1: Push Pembaruan dari Komputer Lokal ke GitHub

Pastikan Anda berada di branch `PPOB-Adnanpay` dan lakukan push ke repositori GitHub Anda:

```bash
# Pastikan berada di branch yang benar
git checkout PPOB-Adnanpay

# Push commit terbaru ke remote github (bokirbeling)
git push bokirbeling PPOB-Adnanpay
```

---

## 🖥️ Langkah 2: Hubungkan ke VPS via SSH

Buka terminal di komputer Anda, lalu masuk ke VPS menggunakan SSH:

```bash
ssh root@192.168.1.8
```

---

## 🛠️ Langkah 3: Konfigurasi Git di VPS (Penting!)

VPS Anda memiliki kendala routing IPv6 ke GitHub yang menyebabkan koneksi `git clone` / `git pull` mengalami timeout. Jalankan perintah berikut di VPS untuk memaksa Git menggunakan IPv4:

```bash
git config --global http.ipresolve v4
```

---

## 📂 Langkah 4: Proses Unduh & Build di VPS

Kami menyarankan menggunakan folder staging (`/mnt/usb/webtopup-repo`) agar tidak mengganggu folder aplikasi yang sedang berjalan.

### 1. Ambil Kode Terbaru dari GitHub

Jika Anda pertama kali men-deploy:
```bash
# Clone repository ke folder staging
git clone -4 https://github.com/bokirbeling/webtopup.git /mnt/usb/webtopup-repo

# Masuk ke folder repository
cd /mnt/usb/webtopup-repo

# Pindah ke branch PPOB-Adnanpay
git checkout PPOB-Adnanpay
```

Jika repositori sudah pernah diclone sebelumnya, cukup lakukan pull:
```bash
cd /mnt/usb/webtopup-repo
git pull origin PPOB-Adnanpay
```

### 2. Build Backend di VPS

```bash
cd /mnt/usb/webtopup-repo/backend
npm install
npm run build
```

### 3. Build Frontend di VPS

```bash
cd /mnt/usb/webtopup-repo/Frontend

# Buat file konfigurasi environment untuk frontend
echo "VITE_API_BASE_URL=/api" > .env

# Install dependensi dan build aset statis
npm install
npm run build
```

---

## 🚀 Langkah 5: Terapkan Pembaruan (Deployment)

Setelah proses kompilasi (build) selesai, pindahkan hasil build ke folder aplikasi aktif Anda (`/mnt/usb/ppob-demo`).

### 1. Deploy Frontend
```bash
# Bersihkan aset lama di folder frontend aktif
rm -rf /mnt/usb/ppob-demo/frontend/assets

# Copy hasil build frontend baru
cp -r /mnt/usb/webtopup-repo/Frontend/dist/* /mnt/usb/ppob-demo/frontend/
```

### 2. Deploy Backend
```bash
# Bersihkan build lama di folder backend aktif
rm -rf /mnt/usb/ppob-demo/backend/dist

# Copy hasil build backend baru
cp -r /mnt/usb/webtopup-repo/backend/dist /mnt/usb/ppob-demo/backend/dist

# Salin package.json jika ada dependensi baru yang berubah
cp /mnt/usb/webtopup-repo/backend/package.json /mnt/usb/ppob-demo/backend/package.json

# Install dependencies produksi di folder backend aktif jika diperlukan
cd /mnt/usb/ppob-demo/backend
npm install --omit=dev
```

### 3. Restart Aplikasi di PM2
```bash
pm2 restart ppob-backend
```

---

## 🔍 Langkah 6: Verifikasi Hasil Deployment

Jalankan perintah berikut di VPS untuk memastikan semuanya berjalan dengan normal:

```bash
# 1. Periksa status PM2
pm2 status ppob-backend

# 2. Periksa log PM2 untuk melihat apakah ada error saat startup
pm2 logs ppob-backend --lines 50

# 3. Test endpoint health-check backend
curl -s http://localhost:3001/api/health
# Output yang diharapkan: {"status":"ok"} atau respons JSON sejenis

# 4. Test akses domain Nginx
curl -I http://demo.hanzserver.online/
```

---

## ⚡ OPSI OTOMATIS: Script Installer Sekali Klik (`deploy-vps.sh`)

Untuk mempermudah proses di atas pada masa mendatang, Anda dapat membuat file script di VPS Anda:

1. Buat file script di VPS:
   ```bash
   nano /mnt/usb/deploy-vps.sh
   ```
2. Salin dan tempel kode berikut di dalam file tersebut:
   ```bash
   #!/bin/bash
   set -e

   echo "=== 1. Menarik kode terbaru dari GitHub ==="
   if [ ! -d "/mnt/usb/webtopup-repo" ]; then
       git clone -4 https://github.com/bokirbeling/webtopup.git /mnt/usb/webtopup-repo
       cd /mnt/usb/webtopup-repo
       git checkout PPOB-Adnanpay
   else
       cd /mnt/usb/webtopup-repo
       git checkout PPOB-Adnanpay
       git pull origin PPOB-Adnanpay
   fi

   echo "=== 2. Membangun Backend ==="
   cd /mnt/usb/webtopup-repo/backend
   npm install
   npm run build

   echo "=== 3. Membangun Frontend ==="
   cd /mnt/usb/webtopup-repo/Frontend
   echo "VITE_API_BASE_URL=/api" > .env
   npm install
   npm run build

   echo "=== 4. Sinkronisasi ke folder ppob-demo ==="
   # Frontend
   rm -rf /mnt/usb/ppob-demo/frontend/assets
   cp -r /mnt/usb/webtopup-repo/Frontend/dist/* /mnt/usb/ppob-demo/frontend/

   # Backend
   rm -rf /mnt/usb/ppob-demo/backend/dist
   cp -r /mnt/usb/webtopup-repo/backend/dist /mnt/usb/ppob-demo/backend/dist
   cp /mnt/usb/webtopup-repo/backend/package.json /mnt/usb/ppob-demo/backend/package.json
   cd /mnt/usb/ppob-demo/backend
   npm install --omit=dev

   echo "=== 5. Restart PM2 ==="
   pm2 restart ppob-backend

   echo "=== 6. Selesai! Menampilkan status aplikasi ==="
   pm2 status ppob-backend
   ```
3. Simpan (Ctrl+O, Enter) dan keluar (Ctrl+X).
4. Berikan izin eksekusi pada script tersebut:
   ```bash
   chmod +x /mnt/usb/deploy-vps.sh
   ```
5. Setiap kali Anda ingin melakukan deploy di kemudian hari, Anda cukup menjalankan:
   ```bash
   /mnt/usb/deploy-vps.sh
   ```
