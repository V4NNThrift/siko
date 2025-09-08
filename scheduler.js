const cron = require('node-cron');
const { ServerConfig } = require('./db');
const { performBackup, sendBackupToUser } = require('./utils/backup');

let scheduledTask;

const DEFAULT_SCHEDULE = '0 */3 * * *'; // Every 3 hours

async function start(client) {
    let scheduleConfig = await ServerConfig.findOne({ where: { key: 'backupSchedule' } });

    if (!scheduleConfig) {
        scheduleConfig = await ServerConfig.create({ key: 'backupSchedule', value: DEFAULT_SCHEDULE });
    }

    const schedule = scheduleConfig.value;

    if (!cron.validate(schedule)) {
        console.error(`[\x1b[31mCRON ERROR\x1b[0m] Invalid cron schedule found in database: "${schedule}". Using default.`);
        schedule = DEFAULT_SCHEDULE;
    }

    console.log(`[\x1b[34mCRON\x1b[0m] Scheduling database backup with schedule: "${schedule}"`);

    scheduledTask = cron.schedule(schedule, async () => {
        console.log('[\x1b[34mCRON\x1b[0m] Running scheduled backup job...');
        try {
            const backupPath = await performBackup();
            await sendBackupToUser(client, backupPath);
        } catch (error) {
            console.error('[\x1b[31mCRON ERROR\x1b[0m] An error occurred during the scheduled backup:', error);
        }
    });
}

function stop() {
    if (scheduledTask) {
        scheduledTask.stop();
        scheduledTask = null;
        console.log('[\x1b[34mCRON\x1b[0m] Stopped existing backup schedule.');
    }
}

async function reschedule(client, newSchedule) {
    stop();
    await ServerConfig.update({ value: newSchedule }, { where: { key: 'backupSchedule' } });
    console.log(`[\x1b[34mCRON\x1b[0m] Updated backup schedule in database to: "${newSchedule}"`);
    await start(client);
}

module.exports = {
    start,
    stop,
    reschedule,
};
