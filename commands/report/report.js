require('dotenv').config();
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionsBitField } = require('discord.js');
const { sequelize, ServerConfig } = require('../../db');

// --- Config IDs ---
const STAFF_ROLE_IDS = (process.env.CEKUCP_ROLE_IDS || '').split(',').map(id => id.trim());
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID || '1414136407307456553';
const SUPPORT_ROLE_ID = process.env.REFUND_TICKET_SUPPORT_ROLE_ID || '1365274991825915982';
const DEV_ROLE_ID = process.env.BUG_REPORT_DEV_ROLE_ID || '1365274991859466260';

const TICKET_TYPES = {
  player: { name: 'Report Player', prefix: 'report-player-', dbKey: 'playerReportCount', emoji: '👤', color: '#E67E22' },
  staff: { name: 'Report Staff', prefix: 'report-staff-', dbKey: 'staffReportCount', emoji: '🛡️', color: '#95A5A6' },
  refund: { name: 'Refund', prefix: 'tiket-reffund-', dbKey: 'refundTicketCount', emoji: '💸', color: '#2ECC71' },
  bug: { name: 'Report Bug', prefix: 'report-bug-', dbKey: 'bugReportCount', emoji: '🐞', color: '#E91E63' }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('report-panel')
    .setDescription('Mengirim panel report ke channel ini.'),

  async execute(interaction) {
    const hasPermission = interaction.member.roles.cache.some(role => STAFF_ROLE_IDS.includes(role.id));
    if (!hasPermission) return interaction.reply({ content: '❌ Kamu tidak punya izin untuk melakukan perintah ini.', ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('Laporan & Bantuan WINDCITY RP')
      .setDescription('Silakan gunakan tombol di bawah ini untuk memulai laporan atau permohonan refund Anda. Setiap tombol akan membuat channel tiket pribadi.')
      .setFooter({ text: 'WINDCITY RP | Report System' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_create_player').setLabel('Report Player').setStyle(ButtonStyle.Danger).setEmoji('👤'),
      new ButtonBuilder().setCustomId('ticket_create_staff').setLabel('Report Staff').setStyle(ButtonStyle.Secondary).setEmoji('🛡️'),
      new ButtonBuilder().setCustomId('ticket_create_refund').setLabel('Refund').setStyle(ButtonStyle.Success).setEmoji('💸'),
      new ButtonBuilder().setCustomId('ticket_create_bug').setLabel('Report Bug').setStyle(ButtonStyle.Primary).setEmoji('🐞')
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ Panel report berhasil dikirim.', ephemeral: true });
  },

  async handleInteraction(interaction) {
    const [action, type, ...rest] = interaction.customId.split('_');

    if (action !== 'ticket' && action !== 'modal') return;

    try {
      if (interaction.isButton()) {
        if (action === 'ticket' && type === 'create') await handleTicketCreation(interaction, rest[0]);
        else if (action === 'ticket' && type === 'open' && rest[0] === 'modal') await handleOpenModal(interaction, rest[1]);
        else if (action === 'ticket' && type === 'close' && rest[0] === 'request') await handleCloseRequest(interaction);
        else if (action === 'ticket' && type === 'close' && rest[0] === 'confirm') await handleCloseConfirm(interaction);
      } else if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction, type);
      }
    } catch (error) {
      console.error(`[Interaction Error] Custom ID: ${interaction.customId}\n`, error);
      const replyPayload = { content: '❌ Terjadi kesalahan internal saat memproses permintaan Anda.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(replyPayload).catch(console.error);
      } else {
        await interaction.reply(replyPayload).catch(console.error);
      }
    }
  },
};

async function handleTicketCreation(interaction, ticketType) {
  await interaction.deferReply({ ephemeral: true });
  const typeInfo = TICKET_TYPES[ticketType];
  if (!typeInfo) return interaction.editReply({ content: '❌ Tipe tiket tidak valid.' });

  const existingTicket = interaction.guild.channels.cache.find(c =>
    c.name.startsWith(typeInfo.prefix) && c.permissionOverwrites.cache.has(interaction.user.id)
  );
  if (existingTicket) return interaction.editReply({ content: `❌ Anda sudah memiliki tiket ${typeInfo.name} yang aktif di <#${existingTicket.id}>.` });

  const t = await sequelize.transaction();
  try {
    let countConfig = await ServerConfig.findOne({ where: { key: typeInfo.dbKey }, transaction: t });
    if (!countConfig) countConfig = await ServerConfig.create({ key: typeInfo.dbKey, value: '0' }, { transaction: t });

    const newCount = parseInt(countConfig.value, 10) + 1;
    await countConfig.update({ value: newCount.toString() }, { transaction: t });
    await t.commit();

    const channel = await interaction.guild.channels.create({
      name: `${typeInfo.prefix}${newCount}`,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: SUPPORT_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        // Add dev role permission for bug reports
        ...(ticketType === 'bug' ? [{ id: DEV_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }] : []),
      ],
    });

    const embed = new EmbedBuilder()
      .setColor(typeInfo.color)
      .setTitle(`${typeInfo.emoji} Tiket ${typeInfo.name} #${newCount}`)
      .setDescription(`Selamat datang, <@${interaction.user.id}>!\n\nStaf kami akan segera membantu Anda. Silakan klik tombol di bawah ini untuk mengisi formulir laporan Anda.`)
      .setFooter({ text: 'Mohon siapkan bukti yang jelas jika diperlukan.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket_open_modal_${ticketType}`).setLabel('Buka Form Laporan').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_close_request').setLabel('Tutup Tiket').setStyle(ButtonStyle.Danger)
    );

    let pingContent = `<@&${SUPPORT_ROLE_ID}>`;
    if (ticketType === 'bug') {
        pingContent += `, <@&${DEV_ROLE_ID}>`;
    }

    await channel.send({ content: pingContent, embeds: [embed], components: [row] });
    await interaction.editReply({ content: `✅ Tiket Anda telah dibuat: <#${channel.id}>` });
  } catch (error) {
    await t.rollback();
    console.error('Error creating ticket:', error);
    await interaction.editReply({ content: '❌ Terjadi kesalahan saat membuat tiket.' });
  }
}

async function handleOpenModal(interaction, ticketType) {
    const initialMessage = await interaction.channel.messages.fetch(interaction.message.id);
    const creatorId = initialMessage.embeds[0].description.match(/<@(\d+)>/)[1];
    if (interaction.user.id !== creatorId) {
        return interaction.reply({ content: '❌ Hanya pembuat tiket yang dapat membuka form ini.', ephemeral: true });
    }

    let modal;
    if (ticketType === 'player') modal = createReportPlayerModal();
    else if (ticketType === 'staff') modal = createReportStaffModal();
    else if (ticketType === 'refund') modal = createRefundModal();
    else if (ticketType === 'bug') modal = createBugReportModal();

    if(modal) await interaction.showModal(modal);
}

async function handleCloseRequest(interaction) {
    const hasPermission = interaction.member.roles.cache.has(SUPPORT_ROLE_ID);
    if (!hasPermission) return interaction.reply({ content: '❌ Anda tidak memiliki izin untuk menutup tiket ini.', ephemeral: true });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('Konfirmasi Tutup').setStyle(ButtonStyle.Danger)
    );
    await interaction.reply({ content: 'Apakah Anda yakin ingin menutup tiket ini? Tindakan ini tidak dapat diurungkan.', components: [row], ephemeral: true });
}

async function handleCloseConfirm(interaction) {
    const hasPermission = interaction.member.roles.cache.has(SUPPORT_ROLE_ID);
    if (!hasPermission) return interaction.reply({ content: '❌ Anda tidak memiliki izin untuk menutup tiket ini.', ephemeral: true });

    await interaction.reply({ content: '✅ Tiket akan ditutup dalam 5 detik...', ephemeral: true });
    setTimeout(() => interaction.channel.delete('Ticket closed by staff.'), 5000);
}

async function handleModalSubmit(interaction, ticketType) {
    await interaction.deferReply({ ephemeral: true });

    let logEmbed;
    if (ticketType === 'player') logEmbed = processReportPlayer(interaction);
    else if (ticketType === 'staff') logEmbed = processReportStaff(interaction);
    else if (ticketType === 'refund') logEmbed = processRefund(interaction);
    else if (ticketType === 'bug') logEmbed = processBugReport(interaction);

    if (!logEmbed) return interaction.editReply({ content: '❌ Gagal memproses laporan, tipe tidak dikenal.' });

    await interaction.channel.send({ embeds: [logEmbed.setAuthor({ name: `Dari: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })] });

    const originalMessage = interaction.message;
    const disabledButton = new ButtonBuilder().setCustomId('form_submitted').setLabel('Form Telah Dikirim').setStyle(ButtonStyle.Secondary).setDisabled(true);
    const closeButton = new ButtonBuilder().setCustomId('ticket_close_request').setLabel('Tutup Tiket').setStyle(ButtonStyle.Danger);
    const disabledRow = new ActionRowBuilder().addComponents(disabledButton, closeButton);
    await originalMessage.edit({ components: [disabledRow] });

    await interaction.editReply({ content: 'Laporan Anda telah dikirim di channel ini. Terima kasih!' });
}

function createReportPlayerModal() {
  return new ModalBuilder().setCustomId('modal_player').setTitle('Report Player')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pelaporName').setLabel("Nama Pelapor (IC)").setPlaceholder("Nama IC/Discord Anda").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('terlaporName').setLabel("Nama Terlapor").setPlaceholder("Nama IC/Discord yang dilaporkan").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tanggalKejadian').setLabel("Tanggal Kejadian").setPlaceholder("Contoh: 26 April 2025").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('kronologi').setLabel("Kronologi / Kerugian").setPlaceholder("Jelaskan detail kejadian & kerugian").setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true))
    );
}

function createReportStaffModal() {
  return new ModalBuilder().setCustomId('modal_staff').setTitle('Report Staff')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pelaporName').setLabel("Name Pelapor (IC)").setPlaceholder("Pelapor Name IC").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('staffName').setLabel("Name Staff").setPlaceholder("Nama Staff Ingame (Harus Valid)").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tanggalKejadian').setLabel("Tanggal Kejadian").setPlaceholder("Contoh: 26 April 2025").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pelanggaran').setLabel("Pelanggaran Terlapor").setPlaceholder("Contoh: Admin Glen...").setStyle(TextInputStyle.Paragraph).setMaxLength(750).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('kronologi').setLabel("Kronologi Pelapor").setPlaceholder("Contoh: Kemaren aku lewat...").setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true))
    );
}

function createRefundModal() {
  return new ModalBuilder().setCustomId('modal_refund').setTitle('Formulir Permohonan Refund')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('icName').setLabel("Name (IC)").setPlaceholder("Name IC").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tanggalKejadian').setLabel("Tanggal Kejadian").setPlaceholder("Contoh: 26 April 2025").setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('itemsRefund').setLabel("Items Reffund").setPlaceholder("Contoh: Kehilangan item X sebanyak 10 buah.").setStyle(TextInputStyle.Paragraph).setMaxLength(750).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('kronologi').setLabel("Kronologi").setPlaceholder("Jelaskan secara rinci bagaimana Anda kehilangan item tersebut.").setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true))
    );
}

function processReportPlayer(interaction) {
  const pelaporName = interaction.fields.getTextInputValue('pelaporName');
  const terlaporName = interaction.fields.getTextInputValue('terlaporName');
  const tanggalKejadian = interaction.fields.getTextInputValue('tanggalKejadian');
  const kronologi = interaction.fields.getTextInputValue('kronologi');
  const bukti = extractUrl(kronologi);

  return new EmbedBuilder().setColor('#E67E22').setTitle('👤 Laporan Pemain')
    .addFields(
      { name: 'Nama Pelapor (IC)', value: pelaporName, inline: true },
      { name: 'Nama Terlapor', value: terlaporName, inline: true },
      { name: 'Tanggal Kejadian', value: tanggalKejadian, inline: true },
      { name: 'Kronologi / Kerugian', value: `\`\`\`${kronologi}\`\`\`` },
    )
    .addFields(bukti ? { name: 'Bukti Terlampir', value: bukti } : [])
    .setTimestamp();
}

function processReportStaff(interaction) {
  const pelaporName = interaction.fields.getTextInputValue('pelaporName');
  const staffName = interaction.fields.getTextInputValue('staffName');
  const tanggalKejadian = interaction.fields.getTextInputValue('tanggalKejadian');
  const pelanggaran = interaction.fields.getTextInputValue('pelanggaran');
  const kronologi = interaction.fields.getTextInputValue('kronologi');
  const bukti = extractUrl(kronologi);

  return new EmbedBuilder().setColor('#95A5A6').setTitle('🛡️ Laporan Staff')
    .addFields(
        { name: 'Name Pelapor (IC)', value: pelaporName, inline: true },
        { name: 'Name Staff', value: staffName, inline: true },
        { name: 'Tanggal Kejadian', value: tanggalKejadian, inline: true },
        { name: 'Pelanggaran Terlapor', value: `\`\`\`${pelanggaran}\`\`\`` },
        { name: 'Kronologi Pelapor', value: `\`\`\`${kronologi}\`\`\`` },
    )
    .addFields(bukti ? { name: 'Bukti Terlampir', value: bukti } : [])
    .setTimestamp();
}

function processRefund(interaction) {
  const icName = interaction.fields.getTextInputValue('icName');
  const tanggalKejadian = interaction.fields.getTextInputValue('tanggalKejadian');
  const itemsRefund = interaction.fields.getTextInputValue('itemsRefund');
  const kronologi = interaction.fields.getTextInputValue('kronologi');
  const bukti = extractUrl(kronologi);

  return new EmbedBuilder().setColor('#2ECC71').setTitle('💸 Permohonan Refund')
    .addFields(
        { name: 'Name (IC)', value: icName, inline: true },
        { name: 'Tanggal Kejadian', value: tanggalKejadian, inline: true },
        { name: 'Items Reffund', value: `\`\`\`${itemsRefund}\`\`\`` },
        { name: 'Kronologi', value: `\`\`\`${kronologi}\`\`\`` },
    )
    .addFields(bukti ? { name: 'Bukti Terlampir', value: bukti } : [])
    .setTimestamp();
}

function extractUrl(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex);
    return urls ? urls.join('\n') : null;
}

function createBugReportModal() {
  return new ModalBuilder().setCustomId('modal_bug').setTitle('Formulir Laporan Bug')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bug_dialami').setLabel("Bug yang dialami").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("Contoh: Tidak bisa membuka inventory")),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tanggal_kejadian').setLabel("Tanggal terjadi bugnya").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("Contoh: 27 April 2025")),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bukti_info').setLabel("Bukti/Info Tambahan").setStyle(TextInputStyle.Paragraph).setRequired(false).setPlaceholder("Sertakan link screenshot atau video jika ada."))
    );
}

function processBugReport(interaction) {
  const bugDialami = interaction.fields.getTextInputValue('bug_dialami');
  const tanggalKejadian = interaction.fields.getTextInputValue('tanggal_kejadian');
  const buktiInfo = interaction.fields.getTextInputValue('bukti_info');
  const bukti = extractUrl(buktiInfo);

  const embed = new EmbedBuilder().setColor('#E91E63').setTitle('🐞 Laporan Bug')
    .addFields(
        { name: 'Bug yang dialami', value: bugDialami },
        { name: 'Tanggal terjadi bugnya', value: tanggalKejadian }
    );

  if (buktiInfo) {
    embed.addFields({ name: 'Bukti/Info Tambahan', value: `\`\`\`${buktiInfo}\`\`\`` });
  }
  if (bukti) {
    embed.addFields({ name: 'Link Bukti Terdeteksi', value: bukti });
  }

  embed.setTimestamp();
  return embed;
}
