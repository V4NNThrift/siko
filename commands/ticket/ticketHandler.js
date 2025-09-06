const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');

const { sendWaNotif } = require('../../wa');

module.exports = {
  async handleInteraction(interaction) {
    if (!interaction.isButton()) return;

    const { guild, user, customId, channel } = interaction;
    const TICKET_ROLE_ID = process.env.TICKET_ROLE_ID;
    const SUPPORT_CHANNEL_ID = process.env.TICKET_SUPPORT_CHANNEL;
    const supportRole = guild.roles.cache.get(TICKET_ROLE_ID);

    if (!supportRole) {
      return interaction.reply({
        content: '❌ Role support tidak ditemukan.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (customId === 'create_ticket') {
      const supportChannel = guild.channels.cache.get(SUPPORT_CHANNEL_ID);
      if (!supportChannel || supportChannel.type !== ChannelType.GuildText) {
        return interaction.reply({
          content: '❌ Channel support tidak ditemukan.',
          flags: MessageFlags.Ephemeral
        });
      }

      const now = new Date();
      const dateFormatted = `${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear().toString().slice(-2)}`;
      const sanitizedUsername = user.username.toLowerCase().replace(/[^a-z0-9]/gi, '-');
      const threadName = `ticket-${sanitizedUsername}-${dateFormatted}`;

      const existing = supportChannel.threads.cache.find(thread =>
        thread.name.startsWith(`ticket-${sanitizedUsername}`) &&
        thread.ownerId === user.id &&
        !thread.archived
      );

      if (existing) {
        return interaction.reply({
          content: `⚠️ Kamu sudah punya ticket aktif: <#${existing.id}>`,
          flags: MessageFlags.Ephemeral
        });
      }

      // Buat private thread
      const thread = await supportChannel.threads.create({
        name: threadName,
        autoArchiveDuration: 1440,
        type: ChannelType.PrivateThread,
        reason: `Ticket dibuat oleh ${user.tag}`
      });

      // Tambahkan user pembuat ke thread
      await thread.members.add(user.id);

      // Tambahkan semua member role support ke thread
      for (const member of supportRole.members.values()) {
        try {
          await thread.members.add(member.id);
        } catch (err) {
          console.warn(`⚠️ Gagal tambah ${member.user.tag} ke thread:`, err.message);
        }
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`close_ticket_${user.id}`)
          .setLabel('🔒 Close Ticket')
          .setStyle(ButtonStyle.Danger)
      );

      await thread.send({
        content: `🎟️ Ticket dibuat oleh ${user}\n<@&${TICKET_ROLE_ID}>`,
        components: [row]
      });

      const ownerPhone = process.env.OWNER_PHONE;
      const waMessage = `🔔 *Ticket baru Dibuat!*\n\nUser: ${user.tag} (${user.id})\nThread: ${thread.name}`;
      await sendWaNotif(`${ownerPhone}@s.whatsapp.net`, waMessage);

      const NOTIF_CHANNEL_ID = process.env.TICKET_NOTIFY_CHANNEL;
      const notifChannel = guild.channels.cache.get(NOTIF_CHANNEL_ID);
      if (notifChannel) {
        notifChannel.send({
          content: `📨 Ticket baru dibuat: <#${thread.id}>\n\nhandle it immediately <@&${TICKET_ROLE_ID}>`
        }).catch(console.error);
      }

      return interaction.reply({
        content: `✅ Ticket berhasil dibuat: <#${thread.id}>`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (customId.startsWith('close_ticket')) {
      const ticketOwner = customId.split('_')[2];

      if (channel.archived) {
        return interaction.reply({
          content: '❌ Ticket ini sudah ditutup.',
          flags: MessageFlags.Ephemeral
        });
      }

      if (user.id !== ticketOwner && !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({
          content: '⚠️ Kamu tidak bisa menutup ticket ini.',
          flags: MessageFlags.Ephemeral
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm_close').setLabel('✅ Ya, tutup').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('cancel_close').setLabel('❎ Batal').setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({
        content: 'Apakah kamu yakin ingin menutup ticket ini?',
        components: [row],
        flags: MessageFlags.Ephemeral
      });
    }

    if (customId === 'confirm_close') {
      await interaction.update({
        content: '📁 Ticket sedang ditutup...',
        components: []
      });

      try {
        await channel.setArchived(true, 'Ticket ditutup');
        await channel.send('🔒 Ticket ini telah ditutup dan diarsipkan.');
      } catch (err) {
        console.error('❌ Gagal mengarsipkan thread:', err);
        try {
          await channel.send('⚠️ Terjadi kesalahan saat menutup ticket.');
        } catch (sendErr) {
          console.error('❌ Gagal kirim pesan error:', sendErr);
        }
      }
    }

    if (customId === 'cancel_close') {
      return interaction.update({
        content: '✅ Penutupan ticket dibatalkan.',
        components: []
      });
    }
  }
};