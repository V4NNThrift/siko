const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  AttachmentBuilder
} = require('discord.js');

const path = require('path');
const mysql = require('mysql2/promise');
const produkData = require('../../data/produk.json');

const TOPUP_CHANNEL = process.env.TOPUP_CHANNEL;
const OWNER_ID = process.env.OWNER_ID;
const GUILD_ID = process.env.GUILD_ID;
const UCP_DONATE_ROLE_ID = process.env.UCP_DONATE_ROLE_ID;

module.exports = {
  async handleInteraction(interaction) {
    if (interaction.isButton() && interaction.customId === 'start_topup') {
      if (interaction.channelId !== TOPUP_CHANNEL) return;

      const kategoriMenu = new StringSelectMenuBuilder()
        .setCustomId('pilih_kategori')
        .setPlaceholder('Pilih kategori produk...')
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('Kendaraan').setValue('kategori_kendaraan'),
          new StringSelectMenuOptionBuilder().setLabel('Skin').setValue('kategori_skin')
        );

      const row = new ActionRowBuilder().addComponents(kategoriMenu);
      return interaction.reply({
        content: '✅ Step 1: Pilih kategori terlebih dahulu',
        components: [row],
        flags: MessageFlags.Ephemeral
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'pilih_kategori') {
      const kategori = interaction.values[0];
      const pilihan = produkData[kategori];
      if (!pilihan) {
        return interaction.update({
          content: '❌ Kategori tidak ditemukan.',
          components: [],
          flags: MessageFlags.Ephemeral
        });
      }

      const produkMenu = new StringSelectMenuBuilder()
        .setCustomId('pilih_produk')
        .setPlaceholder('Pilih produk...')
        .addOptions(pilihan.map(item =>
          new StringSelectMenuOptionBuilder().setLabel(item.label).setValue(item.value)
        ));

      const row = new ActionRowBuilder().addComponents(produkMenu);
      return interaction.update({
        content: '✅ Step 2: Pilih produk yang tersedia',
        components: [row],
        flags: MessageFlags.Ephemeral
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'pilih_produk') {
      const selected = interaction.values[0];
      const allProduk = Object.values(produkData).flat().reduce((acc, item) => {
        acc[item.value] = { label: item.label.split(' (')[0], harga: item.harga };
        return acc;
      }, {});
      const item = allProduk[selected];
      if (!item) {
        return interaction.update({
          content: '❌ Produk tidak ditemukan.',
          components: [],
          flags: MessageFlags.Ephemeral
        });
      }

      const totalHarga = item.harga.toLocaleString();
      const attachment = new AttachmentBuilder(path.resolve(__dirname, '../../assets/qris.jpg'), { name: 'qris.jpg' });

      await interaction.update({
        content: `🛒 Produk: **${item.label}**\n💰 Harga: **Rp${totalHarga}**\n\n📲 Silakan bayar melalui QRIS berikut. Setelah pembayaran, admin akan memverifikasi dan memproses topup kamu.`,
        files: [attachment],
        components: [],
        flags: MessageFlags.Ephemeral
      });

      const guild = interaction.guild || await interaction.client.guilds.fetch(GUILD_ID);
      const owner = await guild.members.fetch(OWNER_ID).catch(() => null);
      if (!owner) return;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`manualaccept_${interaction.user.id}_${selected}`).setLabel('✅ Terima').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`manualdecline_${interaction.user.id}`).setLabel('❌ Tolak').setStyle(ButtonStyle.Danger)
      );

      await owner.send({
        content: `🔔 Permintaan topup dari <@${interaction.user.id}>:\n📦 Produk: **${item.label}**\n💸 Harga: **Rp${totalHarga}**\n\nLanjutkan topup ini?`,
        components: [row]
      }).catch(console.error);
    }

    if (interaction.isButton() && interaction.customId.startsWith('manualaccept_')) {
      if (interaction.message.components[0].components.every(b => b.data.disabled)) {
        return interaction.reply({ content: '⚠️ Tombol ini sudah tidak aktif.', ephemeral: true });
      }

      await interaction.deferUpdate();

      const [, userId, produkValue] = interaction.customId.split('_');
      const guild = interaction.client.guilds.cache.get(GUILD_ID);
      const member = await guild.members.fetch(userId).catch(() => null);

      const allProduk = Object.values(produkData).flat().reduce((acc, item) => {
        acc[item.value] = item;
        return acc;
      }, {});
      const item = allProduk[produkValue];
      const isKendaraan = produkData.kategori_kendaraan.map(p => p.value).includes(produkValue);

      const db = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME
      });

      const [ucpRows] = await db.execute('SELECT ucp FROM playerucp WHERE DiscordID = ?', [userId]);
      if (!ucpRows.length) return;

      const ucp = ucpRows[0].ucp;
      const [playerRows] = await db.execute('SELECT pID, Char_Name FROM player_characters WHERE Char_UCP = ?', [ucp]);
      if (!playerRows.length) return;

      if (playerRows.length === 1) {
        const pID = playerRows[0].pID;
        if (isKendaraan) {
          await db.execute('INSERT INTO player_vehicles (PVeh_OwnerID, PVeh_ModelID, PVeh_PosX, PVeh_PosY, PVeh_PosZ, PVeh_PosA, PVeh_Parked) VALUES (?, ?, ?, ?, ?, ?, ?)', [pID, parseInt(produkValue), 563.829, -1283.34, 17.3624, 251.826, 38]);
        } else {
          await db.execute('UPDATE player_characters SET Char_Skin = ? WHERE pID = ?', [parseInt(produkValue), pID]);
        }

        if (member && UCP_DONATE_ROLE_ID && guild.roles.cache.has(UCP_DONATE_ROLE_ID)) {
          await member.roles.add(UCP_DONATE_ROLE_ID).catch(() => null);
        }

        await member?.send(`✅ Topup kamu untuk produk **${item.label}** telah diterima dan diberikan ke karakter **${playerRows[0].Char_Name}**.`).catch(() => null);
      } else {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`pilih_player_${isKendaraan ? 'kendaraan' : 'skin'}_${userId}_${produkValue}`)
          .setPlaceholder('Pilih karakter yang ingin menerima produk')
          .addOptions(playerRows.map(p =>
            new StringSelectMenuOptionBuilder().setLabel(p.Char_Name).setValue(p.pID.toString())
          ));

        const row = new ActionRowBuilder().addComponents(selectMenu);
        await member?.send({
          content: `👤 Kamu memiliki lebih dari satu karakter.\nSilakan pilih karakter yang akan menerima produk **${item.label}**:`,
          components: [row]
        }).catch(() => null);
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('manualaccept_disabled').setLabel('✅ Diterima').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('manualdecline_disabled').setLabel('❌ Tolak').setStyle(ButtonStyle.Danger).setDisabled(true)
      );

      await interaction.message.edit({
        content: `✅ Topup telah diterima untuk <@${userId}>.`,
        components: [row]
      });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('pilih_player_')) {
      const [, , type, userId, produkValue] = interaction.customId.split('_');
      const pID = parseInt(interaction.values[0]);

      const db = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME
      });

      if (type === 'kendaraan') {
        await db.execute('INSERT INTO player_vehicles (PVeh_OwnerID, PVeh_ModelID, PVeh_PosX, PVeh_PosY, PVeh_PosZ, PVeh_PosA, PVeh_Parked) VALUES (?, ?, ?, ?, ?, ?, ?)', [pID, parseInt(produkValue), 563.829, -1283.34, 17.3624, 251.826, 38]);
      } else {
        await db.execute('UPDATE player_characters SET Char_Skin = ? WHERE pID = ?', [parseInt(produkValue), pID]);
      }

      const item = Object.values(produkData).flat().find(i => i.value === produkValue);

      const disabledRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('done_select')
          .setPlaceholder('✅ Karakter telah dipilih')
          .setDisabled(true)
          .addOptions([new StringSelectMenuOptionBuilder().setLabel(`Karakter ID: ${pID}`).setValue(pID.toString())])
      );

      await interaction.update({
        content: `✅ Produk **${item.label}** berhasil diberikan ke karakter ID: **${pID}**`,
        components: [disabledRow],
        ephemeral: true
      });
    }

    if (interaction.isButton() && interaction.customId.startsWith('manualdecline_')) {
      if (interaction.message.components[0].components.every(b => b.data.disabled)) {
        return interaction.reply({ content: '⚠️ Tombol ini sudah tidak aktif.', ephemeral: true });
      }

      await interaction.deferUpdate();
      const [, userId] = interaction.customId.split('_');
      const guild = interaction.client.guilds.cache.get(GUILD_ID);
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) {
        await member.send('❌ Topup kamu telah ditolak oleh admin.').catch(() => null);
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('manualaccept_disabled').setLabel('✅ Terima').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('manualdecline_disabled').setLabel('❌ Ditolak').setStyle(ButtonStyle.Danger).setDisabled(true)
      );

      await interaction.message.edit({
        content: `❌ Topup telah ditolak untuk <@${userId}>.`,
        components: [row]
      });
    }
  }
};