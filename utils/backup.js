require('dotenv').config();
const mysqldump = require('mysqldump');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const OWNER_ID = '714045397659811911';

const dbConfig = {
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
    },
    dump: {
        schema: {
            tables: true,
            views: true,
            triggers: true,
            routines: true,
            events: true,
        },
        data: {
            verbose: false,
        },
    }
};

async function performBackup() {
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sqlFileName = `backup-${timestamp}.sql`;
    const zipFileName = `backup-${timestamp}.tar.gz`;
    const sqlFilePath = path.join(backupDir, sqlFileName);
    const zipFilePath = path.join(backupDir, zipFileName);

    console.log('[\x1b[34mBACKUP\x1b[0m] Starting database dump...');
    await mysqldump({ ...dbConfig, dumpToFile: sqlFilePath });
    console.log('[\x1b[34mBACKUP\x1b[0m] Database dump complete.');

    await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipFilePath);
        const archive = archiver('tar', {
            gzip: true,
        });

        output.on('close', () => {
            console.log(`[\x1b[34mBACKUP\x1b[0m] Archive created: ${archive.pointer()} total bytes`);
            resolve();
        });

        archive.on('error', (err) => {
            reject(err);
        });

        archive.pipe(output);
        archive.file(sqlFilePath, { name: sqlFileName });
        archive.finalize();
    });

    // Clean up the .sql file
    fs.unlinkSync(sqlFilePath);
    console.log('[\x1b[34mBACKUP\x1b[0m] Temporary .sql file deleted.');

    return zipFilePath;
}

async function sendBackupToUser(client, filePath) {
    try {
        const user = await client.users.fetch(OWNER_ID);
        if (!user) {
            console.error('[\x1b[31mBACKUP ERROR\x1b[0m] Could not find owner to send backup to.');
            return;
        }

        await user.send({
            content: `✨ Berikut adalah backup database otomatis pada ${new Date().toUTCString()}`,
            files: [filePath],
        });
        console.log('[\x1b[32mBACKUP\x1b[0m] Backup file sent to owner via DM.');
    } catch (error) {
        console.error('[\x1b[31mBACKUP ERROR\x1b[0m] Failed to send backup file to user:', error);
    } finally {
        // Clean up the .tar.gz file
        fs.unlinkSync(filePath);
        console.log('[\x1b[34mBACKUP\x1b[0m] Compressed backup file deleted.');
    }
}

module.exports = {
    performBackup,
    sendBackupToUser,
};
