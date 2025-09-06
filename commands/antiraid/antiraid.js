const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');

const originalGuildData = {};
const allowedRoleIds = [process.env.DEV_ROLE_ID];
const { sendWaNotif } = require('../../wa');

module.exports = {
  name: 'ready',
  async execute(client) {
    const guild = client.guilds.cache.first();
    if (guild) {
      originalGuildData[guild.id] = {
        name: guild.name,
        icon: guild.iconURL(),
        banner: guild.bannerURL()
      };
      console.log(`[ANTIRAID] Data asli guild "${guild.name}" disimpan untuk rollback.`);
    }

    client.on('guildUpdate', async (oldGuild, newGuild) => {
      try {
        const fetchedLogs = await newGuild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.GuildUpdate });
        const entry = fetchedLogs.entries.first();
        if (!entry) return;

        const { executor } = entry;
        if (!executor || executor.bot) return;

        const member = await newGuild.members.fetch(executor.id).catch(() => null);
        const me = newGuild.members.me;

        if (!member || !me) return;

        const isAllowed = member.roles.cache.some(r => allowedRoleIds.includes(r.id));
        const isHigher = me.roles.highest.comparePositionTo(member.roles.highest) > 0;

        if (isAllowed || !isHigher) return;

        await member.kick('[ANTI-RAID] Mengubah setting server tanpa izin');

        const original = originalGuildData[newGuild.id];
        if (original.name !== newGuild.name) await newGuild.setName(original.name, '[ANTI-RAID] Rollback nama');
        if (original.icon !== newGuild.iconURL()) await newGuild.setIcon(original.icon, '[ANTI-RAID] Rollback icon');
        if (original.banner !== newGuild.bannerURL()) await newGuild.setBanner(original.banner, '[ANTI-RAID] Rollback banner');

        console.log(`[ANTIRAID] Perubahan server dibatalkan & ${executor.tag} telah di-kick.`);
      } catch (e) {
        console.error('[ANTIRAID] Error rollback guild update:', e);
      }
    });

    client.on('channelCreate', async (channel) => await handleChannelEvent(channel.guild, AuditLogEvent.ChannelCreate));
    client.on('channelDelete', async (channel) => await handleChannelEvent(channel.guild, AuditLogEvent.ChannelDelete));
    client.on('channelUpdate', async (oldChannel, newChannel) => await handleChannelUpdate(oldChannel, newChannel));

    client.on('roleCreate', async (role) => await handleRoleEvent(role.guild, AuditLogEvent.RoleCreate));
    client.on('roleDelete', async (role) => await handleRoleEvent(role.guild, AuditLogEvent.RoleDelete));
    client.on('roleUpdate', async (oldRole, newRole) => await handleRoleEvent(newRole.guild, AuditLogEvent.RoleUpdate));

    async function handleChannelEvent(guild, type) {
      try {
        const logs = await guild.fetchAuditLogs({ limit: 1, type });
        const entry = logs.entries.first();
        if (!entry) return;

        const { executor } = entry;
        if (!executor || executor.bot) return;

        const member = await guild.members.fetch(executor.id).catch(() => null);
        const me = guild.members.me;

        if (!member || !me) return;

        const isAllowed = member.roles.cache.some(r => allowedRoleIds.includes(r.id));
        const isHigher = me.roles.highest.comparePositionTo(member.roles.highest) > 0;

        if (isAllowed || !isHigher) return;

        await member.kick(`[ANTI-RAID] ${AuditLogEvent[type]} tanpa izin`);
        console.log(`[ANTIRAID] ${executor.tag} telah dikeluarkan karena Mencoba Melakukan Perubahan pada server.`);
      } catch (e) {
        console.error('[ANTIRAID] Error audit log channel event:', e);
      }
    }

    async function handleChannelUpdate(oldChannel, newChannel) {
      try {
        const logs = await newChannel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelUpdate });
        const entry = logs.entries.first();
        if (!entry) return;

        const { executor } = entry;
        if (!executor || executor.bot) return;

        const member = await newChannel.guild.members.fetch(executor.id).catch(() => null);
        const me = newChannel.guild.members.me;

        if (!member || !me) return;

        const isAllowed = member.roles.cache.some(r => allowedRoleIds.includes(r.id));
        const isHigher = me.roles.highest.comparePositionTo(member.roles.highest) > 0;

        if (isAllowed || !isHigher) return;

        if (oldChannel.name !== newChannel.name) {
          await newChannel.setName(oldChannel.name, '[ANTI-RAID] Rollback nama channel');
          console.log(`[ANTIRAID] Nama channel dikembalikan ke: ${oldChannel.name}`);
        }

        await member.kick('[ANTI-RAID] Mengubah channel tanpa izin');
        console.log(`[ANTIRAID] ${executor.tag} telah di-kick karena Mencoba Melakukan RAID!`);
        const ownerPhone = process.env.OWNER_PHONE;
        const message = `⚠️ *[ANTIRAID]*\n\nUser ${executor.tag}  Mencoba Merubah Server Tanpa Izin!`;
        await sendWaNotif(`${ownerPhone}@s.whatsapp.net`, message);
      } catch (e) {
        console.error('[ANTIRAID] Error rollback channel update:', e);
      }
    }

    async function handleRoleEvent(guild, type) {
      try {
        const logs = await guild.fetchAuditLogs({ limit: 1, type });
        const entry = logs.entries.first();
        if (!entry) return;

        const { executor } = entry;
        if (!executor || executor.bot) return;

        const member = await guild.members.fetch(executor.id).catch(() => null);
        const me = guild.members.me;

        if (!member || !me) return;

        const isAllowed = member.roles.cache.some(r => allowedRoleIds.includes(r.id));
        const isHigher = me.roles.highest.comparePositionTo(member.roles.highest) > 0;

        if (isAllowed || !isHigher) return;

        await member.kick(`[ANTI-RAID] ${AuditLogEvent[type]} tanpa izin`);
        console.log(`[ANTIRAID] ${executor.tag} telah di-kick karena ${type}`);
      } catch (e) {
        console.error('[ANTIRAID] Error audit log role event:', e);
      }
    }
  }
}