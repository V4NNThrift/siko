# 🤖 Araz BOT - SAMP BOT

Araz BOT adalah bot Discord multifungsi untuk menangani sistem **SAMP** dan **SERVER DISCORD** Agar Lebih Efisien.

---

## ✨ Fitur Utama

### 🛠️ Anti RAID Sistem.
- Mencegah RAID Discord dengan hanya mengijinkan owner atau role tertentu yang bisa melakukan perubahan pada discord server.
- otomatis melakukan kick ketika ada yang melakukan perubahan tidak dikenal
- mengembalikan nama server, nama channel, foto server ke semula jika di rubah tanpa ijin.
- mengirim notifikasi langsung ke whatsapp owner.


### 🛠️ Sistem UCP
- Registrasi Ucp.
- Reffund Role
- verifikasi otp whatsapp.
- validasi umur discord.
- announce tag evryone dari whatsapp mengunakan cmd `!pengumuman` dan dikirim ke channel discord

### 🛠️ Status Server
- Pemantauan Status server SAMP
- Otomatis kirim ke channel yang di setting ketika memulai bot
- delay update setiap 10 detik
- jika restart/mematikan bot otomatis menghapus chat status sebelumnya dan mengirim ulang chat status baru

### 🎟️ Ticket System
- Slash command `/ticket` untuk membuat tombol pembuatan tiket.
- Otomatis membuat channel baru untuk setiap user.
- Tombol `🔒 Close Ticket` untuk menutup dan mengarsipkan.
- Proteksi agar satu user hanya bisa punya satu ticket aktif.
- notifikasi ke channel admin dan ke whatsapp ketika ada yang membuat ticket.

### 💸 Sistem Topup Produk
- Langkah bertahap: Pilih kategori → Pilih produk → Buat QR → Cek status pembayaran.
- Integrasi Tripay (sandbox/production).
- Mendukung pengiriman item ke karakter SA-MP dari database MySQL (kendaraan / skin).
- Pilihan karakter jika user punya lebih dari 1.
- Tombol batalkan pembayaran.

---

## 🛠️ Instalasi

### 1. Clone Repository

```bash
git clone https://github.com/aruliazmi/bot-diskort
cd bot-diskort
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Buat File `.env`

```env
# ======================================

DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
OWNER_ID=
DEV_ROLE_ID=
OWNER_PHONE=
RAID_NOTIFY_CHANNEL=

# ======================================

TOPUP_CHANNEL=
REGIST_CHANNEL=
REGISTER_LOG_CHANNEL=

# ======================================

TICKET_COMMAND_CHANNEL=
TICKET_ROLE_ID=
TICKET_CATEGORY_ID=
TICKET_ARCHIVE_CATEGORY_ID=
TICKET_NOTIFY_CHANNEL=

# ======================================

SAMP_HOST=
SAMP_PORT=
STATUS_CHANNEL_ID=

# ======================================

DB_HOST=
DB_NAME=
DB_USER=
DB_PASS=

# ======================================

TRIPAY_MERCHANT_CODE=
TRIPAY_API_KEY=
TRIPAY_PRIVATE_KEY=

# ======================================

ANNOUNCE_CHANNEL_ID=
UCP_ROLE_ID=
```

### 4. Jalankan Bot

```bash
npx nodemon
```

---

## 🗃️ Struktur File

```
├── commands/
│   └── ticket/
│   └── donate/
│   └── status/
│   └── ucp/
│
├── data/
│   └── produk.json         # Data produk kategori kendaraan & skin
│
│
├── index.js                # Entry point bot
├── db.js                   # mengatur database
├── deploy-commands.js      # untuk update jika ada penambahan/penghapusan slash command
├── package.json
├── nodemon.json
├── .env                    # Variabel lingkungan (jangan dishare)
├── .gitignore
└── README.md
```

## ⚙️ Tripay Testing

Gunakan `https://tripay.co.id/api-sandbox/` saat testing dan pastikan status pembayaran `PAID` akan memicu pemberian item.

---

## 👨‍💻 Developer

Made with ❤️ by [@AruliAzmi](https://github.com/aruliazmi)

---

## 📄 Lisensi

MIT License
