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
