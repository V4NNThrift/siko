const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const Boom = require('@hapi/boom');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const logger = require('./logger');

const authFilePath = path.join(__dirname, 'session');

let sock;
const waCommands = new Map();

const waCommandFolder = path.join(__dirname, 'commands', 'wa');
fs.readdirSync(waCommandFolder).forEach(file => {
  const command = require(path.join(waCommandFolder, file));
  if (command.name && typeof command.execute === 'function') {
    waCommands.set(command.name, command);
    console.log(`[WA] Loaded WA command: ${command.name}`);
  }
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function startWA(client) {
  const { state, saveCreds } = await useMultiFileAuthState(authFilePath);

  const sock = makeWASocket({
    logger,
    auth: state,
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '22.04.4']
  });

  global.sock = sock;

  sock.ev.on('creds.update', saveCreds);

  if (!state.creds?.me?.id) {
    console.log('📱 Masukkan nomor WhatsApp untuk bot (contoh: 628xxxxxx):');
    let phoneNumber = await question('> ');
    phoneNumber = phoneNumber.replace(/\D/g, '');
    if (!phoneNumber.startsWith('62')) phoneNumber = '62' + phoneNumber;

    try {
      const code = await sock.requestPairingCode(phoneNumber);
      const pairingCode = code.match(/.{1,4}/g)?.join('-') || code;
      console.log(`🔗 Pairing Code: ${pairingCode}`);
    } catch (err) {
      console.error('❌ Gagal mendapatkan Pairing Code:', err);
      return;
    }
  }

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      console.log('✅ WA Connected!');
      const ownerPhone = process.env.OWNER_PHONE;
      const message = `🤖 Bot WhatsApp berhasil online dan terhubung ke Discord.`;
      await sendWaNotif(`${ownerPhone}@s.whatsapp.net`, message);
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error &&
        Boom.isBoom(lastDisconnect.error) &&
        lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;

      console.log('[WA] ❌ Koneksi terputus. Reconnect:', shouldReconnect);
      if (shouldReconnect) await startWA(client);
      else console.log('[WA] ✅ Sesi logout atau tidak bisa reconnect.');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!body || !body.startsWith('!')) return;

    const args = body.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = waCommands.get(commandName);

    if (!command) return;

    try {
      const { client } = require('./index');
      await command.execute({ sock, msg, args, client });
    } catch (err) {
      console.error(`[WA] Gagal eksekusi command: ${commandName}`, err);
      await sock.sendMessage(sender, {
        text: '❌ Terjadi kesalahan saat memproses perintah.'
      });
    }
  });

  return sock;
}

function sendWaNotif(jid, message) {
  if (!global.sock || !global.sock.user || !global.sock.sendMessage) {
    console.log('❌ WhatsApp belum siap, tidak bisa kirim pesan');
    return;
  }

  try {
    return global.sock.sendMessage(jid, { text: message });
  } catch (err) {
    console.error('❌ Gagal kirim WA:', err);
  }
}

module.exports = { startWA, sendWaNotif };