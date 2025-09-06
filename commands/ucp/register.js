const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  InteractionType,
  MessageFlags
} = require('discord.js');

const { PlayerUCP } = require('../../db');
const crypto = require('crypto');
const GUILD_ID = process.env.GUILD_ID;
const VERIFIED_ROLE_ID = process.env.VERIFIED_ROLE_ID;
const OWNER_ID = process.env.DEV_ID;
const REGIST_CHANNEL = process.env.REGIST_CHANNEL;
const tagChannel = `<#${REGIST_CHANNEL}>`;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('handleregist')
    .setDescription('Mulai registrasi UCP kamu'),

  async execute(interaction) {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({
        content: '⚠️ Hanya owner yang dapat menggunakan perintah ini.',
        ephemeral: true
      });
    }

    if (interaction.channelId !== REGIST_CHANNEL) {
      return interaction.reply({
        content: `❌ Command ini hanya bisa digunakan di channel ${tagChannel}`,
        ephemeral: true
      });
    }

    const msgEmbed = new EmbedBuilder()
    .setAuthor({
      name: 'WINDCITY RP | User Control Panel',
      iconURL: interaction.client.user.displayAvatarURL()
    })
    .setThumbnail(interaction.client.user.displayAvatarURL())
    .setColor('#FF0000')
    .setDescription(
      "Channel ini merupakan tempat untuk mengatur akun UCP kamu. Berikut fungsi dari tombol yang tersedia:\n\n" +
      "📃 __Register__\n> Daftarkan akun UCP kamu ke sistem dan dapatkan data kamu di DM.\n\n" +
      "♻️ __Refund Role__\n> Jika kamu sebelumnya sudah terdaftar dan keluar dari Discord, gunakan tombol ini untuk mengembalikan role dan data UCP kamu.\n\n" +
      "🔍 __Check UCP__\n> Melihat kembali data UCP kamu (username, kode, dan tanggal daftar) melalui DM.\n\n" +
      "⚠️ __Reset Password__\n> Gunakan ini untuk mereset password akun UCP kamu jika lupa."
    )
    .setFooter({ text: "WINDCITY RP" })
    .setTimestamp();

    const Buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
        .setCustomId("open_modal")
        .setLabel("Register")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("📃"),

    new ButtonBuilder()
        .setCustomId("button-reffrole")
        .setLabel("Refund Role")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("♻️"),

    new ButtonBuilder()
        .setCustomId("button-checkucp")
        .setLabel("Check UCP")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🔍"),
    new ButtonBuilder()
        .setCustomId("reset-password")
        .setLabel("Reset Password")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("⚠️")
    );

    return interaction.reply({
      embeds: [msgEmbed],
      components: [Buttons]
    });
  },

  async handleInteraction(interaction) {
    // ==== MODAL SUBMIT ====
    if (
      interaction.type === InteractionType.ModalSubmit &&
      interaction.customId === 'form_nama'
    ) {
      const nama = interaction.fields.getTextInputValue('username').trim();

      if (!/^[a-zA-Z0-9]{5,}$/.test(nama)) {
        return interaction.reply({
          content: '❌ Username harus alfanumerik dan minimal 5 karakter.',
          ephemeral: true
        });
      }

      const ageMs = Date.now() - interaction.user.createdAt.getTime();
      if (ageMs / (1000 * 60 * 60 * 24) < 7) {
        return interaction.reply({
          content: '❌ Akun Discord harus minimal 7 hari.',
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const ucpUsed = await PlayerUCP.findOne({ where: { ucp: nama } });
      if (ucpUsed && ucpUsed.DiscordID !== interaction.user.id) {
        return interaction.editReply({
          content: '❌ Nama UCP sudah digunakan oleh user lain. Gunakan nama lain.'
        });
      }

      const userRegistered = await PlayerUCP.findOne({ where: { DiscordID: interaction.user.id } });
      if (userRegistered) {
        return interaction.editReply({
          content: '✅ Kamu sudah terdaftar sebelumnya.'
        });
      }

      const verifycode = Math.floor(100000 + Math.random() * 900000).toString();

      try {
        await PlayerUCP.create({
          ucp: nama,
          DiscordID: interaction.user.id,
          verifycode,
          verified: true,
          reg_date: new Date()
        });

        const dmEmbed = new EmbedBuilder()
          .setAuthor({
            name: 'WINDCITY RP | User Control Panel',
            iconURL: interaction.client.user.displayAvatarURL()
          })
          .setThumbnail(interaction.client.user.displayAvatarURL())
          .setColor('#FF0000')
          .setDescription(
            `Pendaftaran akun UCP kamu telah berhasil disimpan oleh sistem.\n\n` +
            `🧾 __Data Pendaftaran__\n` +
            `> **Username UCP:** \`${nama}\`\n` +
            `> **Kode Registrasi:** \`${verifycode}\`\n\n` +
            `Silakan simpan kode ini sebagai bukti atau referensi jika diperlukan di kemudian hari.`
          )
          .setFooter({ text: 'WINDCITY RP' })
          .setTimestamp();

        try {
          await interaction.user.send({ embeds: [dmEmbed] });
        } catch (err) {
          console.warn('⚠️ Gagal kirim DM:', err.message);
        }

        const adminEmbed = new EmbedBuilder()
          .setTitle('New UCP Registration')
          .setColor('#00AAFF')
          .addFields(
            { name: 'UCP Name', value: nama, inline: false },
            { name: 'Discord', value: interaction.user.tag, inline: false },
            { name: 'Discord ID', value: interaction.user.id, inline: false },
            { name: 'Register Date', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: false }
          )
          .setFooter({ text: 'WINDCITY RP' })
          .setTimestamp();

        const adminChannelId = '1365274992786542600';
        const adminChannel = await interaction.client.channels.fetch(adminChannelId).catch(console.error);
        if (adminChannel && adminChannel.isTextBased()) {
          await adminChannel.send({ embeds: [adminEmbed] }).catch(console.error);
        }

        // Tambahkan role ke user
        const guild = interaction.client.guilds.cache.get(GUILD_ID);
        const role = guild?.roles.cache.get(VERIFIED_ROLE_ID);
        const member = await guild.members.fetch(interaction.user.id);

        if (role && member && !member.roles.cache.has(role.id)) {
          await member.roles.add(role);
        }
        
        await member.roles.add(role);

// Ganti nickname user jadi "Warga | nama_UCP"
const newNick = `Warga | ${nama}`;
if (member.manageable) {
  await member.setNickname(newNick).catch(err => {
    console.warn('⚠️ Gagal ganti nickname:', err.message);
  });
}

        return interaction.editReply({
          content: '✅ Data berhasil disimpan dan role diberikan (jika belum ada). Cek DM kamu!'
        });
      } catch (err) {
        console.error('❌ Gagal simpan data:', err);
        return interaction.editReply({
          content: '❌ Terjadi error saat menyimpan data. Coba lagi nanti atau hubungi admin.'
        });
      }
    }

    // ==== BUKA MODAL ====
    if (interaction.isButton() && interaction.customId === 'open_modal') {
      const modal = new ModalBuilder()
        .setCustomId('form_nama')
        .setTitle('Isi Data UCP Kamu');

      const namaInput = new TextInputBuilder()
        .setCustomId('username')
        .setLabel('Masukkan username UCP')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(5);

      modal.addComponents(new ActionRowBuilder().addComponents(namaInput));
      return await interaction.showModal(modal);
    }

    // ==== REFUND ROLE ====
    if (interaction.isButton() && interaction.customId === 'button-reffrole') {
    const userData = await PlayerUCP.findOne({
        where: { DiscordID: interaction.user.id }
    });

    if (!userData) {
        return interaction.reply({
        content: '❌ Kamu belum terdaftar di sistem.',
        ephemeral: true
        });
    }

    const guild = interaction.client.guilds.cache.get(GUILD_ID);
    const role = guild?.roles.cache.get(VERIFIED_ROLE_ID);

    try {
        const member = await guild.members.fetch(interaction.user.id);

        if (member.roles.cache.has(role.id)) {
        return interaction.reply({
            content: '✅ Role kamu sudah aktif.',
            ephemeral: true
        });
        }

        await member.roles.add(role);

        // Ganti nickname
        const newNick = `Warga | ${userData.ucp}`;
        if (member.manageable) {
        await member.setNickname(newNick).catch(err => {
            console.warn('⚠️ Gagal ganti nickname:', err.message);
        });
        }

        return interaction.reply({
        content: '✅ Role berhasil dikembalikan dan nickname telah diperbarui!',
        ephemeral: true
        });
    } catch (err) {
        console.error('❌ Gagal refund role:', err.message);
        return interaction.reply({
        content: '❌ Gagal mengatur role. Pastikan kamu masih di server.',
        ephemeral: true
        });
    }
    }
    // ==== CHECK UCP ====
    if (interaction.isButton() && interaction.customId === 'button-checkucp') {
        const userData = await PlayerUCP.findOne({
            where: { DiscordID: interaction.user.id }
        });

        if (!userData) {
            return interaction.reply({
            content: '❌ Data UCP kamu belum ditemukan.',
            ephemeral: true
            });
        }

        const formattedDate = `<t:${Math.floor(new Date(userData.reg_date).getTime() / 1000)}:F>`;

        const dmEmbed = new EmbedBuilder()
            .setAuthor({
            name: 'Araz BOT | User Control Panel',
            iconURL: interaction.client.user.displayAvatarURL()
            })
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setColor('#FF0000')
            .setDescription(
            `Berikut adalah data UCP kamu yang terdaftar di sistem:\n\n` +
            `🧾 __UCP Info__\n` +
            `> **Username UCP:** \`${userData.ucp}\`\n` +
            `> **Kode Registrasi:** \`${userData.verifycode}\`\n` +
            `> **Tanggal Daftar:** ${formattedDate}`
            )
            .setFooter({ text: 'Aruli Azmi' })
            .setTimestamp();

        try {
            await interaction.user.send({ embeds: [dmEmbed] });
            return interaction.reply({
            content: '✅ Data UCP kamu telah dikirim ke DM!',
            ephemeral: true
            });
        } catch (err) {
            console.error('❌ Gagal kirim DM:', err.message);
            return interaction.reply({
            content: '⚠️ Gagal mengirim DM. Mungkin DM kamu tertutup.',
            ephemeral: true
            });
        }
    }
    
    if (interaction.isButton() && interaction.customId === 'reset-password') {
        const userData = await PlayerUCP.findOne({ where: { DiscordID: interaction.user.id } });

        if (!userData) {
            return interaction.reply({
            content: '❌ Akun UCP kamu belum terdaftar.',
            ephemeral: true
            });
        }

        const modal = new ModalBuilder()
            .setCustomId('reset-ucp-password')
            .setTitle('Reset Password UCP');

        const passwordInput = new TextInputBuilder()
            .setCustomId('new-password')
            .setLabel('Password Baru')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(6)
            .setPlaceholder('Password baru (min 6 karakter)');

        const row = new ActionRowBuilder().addComponents(passwordInput);
        modal.addComponents(row);

        return await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && interaction.customId === 'reset-ucp-password') {
        const newPassword = interaction.fields.getTextInputValue('new-password');
        const userData = await PlayerUCP.findOne({ where: { DiscordID: interaction.user.id } });

        if (!userData) {
            return interaction.reply({
            content: '❌ Akun UCP kamu tidak ditemukan.',
            ephemeral: true
            });
        }

        try {
            let salt = '';
            for (let i = 0; i < 16; i++) {
                salt += String.fromCharCode(Math.floor(Math.random() * 94) + 33);
            }

            const hashedPassword = crypto
                .createHash('sha256')
                .update(newPassword + salt)
                .digest('hex')
                .toUpperCase();

            await PlayerUCP.update(
                {
                    password: hashedPassword,
                    salt: salt,
                    extrac: 0
                },
                {
                    where: { DiscordID: interaction.user.id }
                }
            );

            const embed = new EmbedBuilder()
            .setAuthor({
                name: 'WINDCITY RP | Reset Password',
                iconURL: interaction.client.user.displayAvatarURL()
            })
            .setColor('#FF0000')
            .setDescription(
                `✅ Password akun UCP kamu berhasil direset.\n\n` +
                `🧾 __Akun__\n` +
                `> **Username:** \`${userData.ucp}\`\n` +
                `> **Password Baru:** \`${newPassword}\``
            )
            .setFooter({ text: 'WINDCITY RP' })
            .setTimestamp();

            await interaction.user.send({ embeds: [embed] });

            return interaction.reply({
            content: '✅ Password berhasil direset dan dikirim ke DM kamu!',
            ephemeral: true
            });
        } catch (err) {
            console.error('Gagal reset password:', err);
            return interaction.reply({
            content: '❌ Terjadi kesalahan saat reset password.',
            ephemeral: true
            });
        }
    }
  }
};