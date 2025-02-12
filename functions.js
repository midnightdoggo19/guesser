require('dotenv').config();
const { spawn } = require('child_process');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const winston = require('winston');
const csv = require('csv-parser');

// Setup Logger
const logger = winston.createLogger({
    level: process.env.LOGLEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(info => `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: process.env.LOG || 'guess.log' }),
    ]
});

const DATASET_FILE = process.env.DATASET || 'dataset.csv';
let processedMessages = 0; // Tracks processed messages
const AI_PROCESS_LIMIT = process.env.MAXPROCESS; // Maximum messages to process
let dataset = [];

if (fs.existsSync(DATASET_FILE)) {
    fs.createReadStream(DATASET_FILE)
        .pipe(csv())
        .on('data', (row) => {
            if (row.text && row.username) {
                dataset.push({ text: row.text, username: row.username });
            } // else {
                // console.warn('Malformed row:', row);
            // }
        })
        .on('end', () => logger.info(`Dataset loaded with ${dataset.length} entries.`));
}
else if (dataset.length <= 0) {
    logger.warn('Dataset file is empty!')
}
else {
    logger.warn('Dataset file not found. Starting with an empty dataset.');
}

function randomReact () {
    return loadingReaction = process.env.EMOJIS[(Math.random() * process.env.EMOJIS.length) | 0]; // return a random emoji from an array
}

function removeUserFromDataset(dataset, username) {
    const filteredDataset = dataset.filter(row => row.username !== username);

    dataset = dataset.filter(row => {
        if (!row || !row.Username || !row.Message) {
            console.warn('Skipping malformed row:', row);
            return true; // Keep malformed rows, only exclude matching users
        }
        return row.Username.trim() !== usernameToRemove;
    });


    logger.info(`Removed entries for user: ${username}. Remaining entries: ${filteredDataset.length}`);
    return filteredDataset;
}

function saveDataset(dataset) {
    const csvWriter = createCsvWriter({
        path: DATASET_FILE,
        header: [
            { id: 'text', title: 'text' },
            { id: 'username', title: 'username' },
        ],
    });
    csvWriter.writeRecords(dataset).then(() => logger.info('Dataset saved successfully.'));
}

async function archiveMessages(channel) {
    logger.info('Archive command commencing.')
    let messages = [];
    let lastMessageId;

    while (true) {
        const fetched = await channel.messages.fetch({ limit: 100, before: lastMessageId });
        if (fetched.size === 0) break;

        fetched.forEach(msg => {
            if (!msg.author.bot) {
                logger.debug(`Pushing ${msg.content} by ${msg.author.username} to dataset.`)
                messages.push({ text: msg.content, username: msg.author.username });
            }
        });
        lastMessageId = fetched.last().id;
    }

    logger.info('Archive command finished; saving.')
    saveDataset(messages);
    return messages.length;
}

async function retrainModel () {
    logger.info('Retraining model...');
    const python = spawn('python3', ['./train.py', DATASET_FILE]);

    python.stdout.on('data', data => console.log(`Model Output: ${data.toString()}`));
    python.stderr.on('data', err => console.log(`Model Error: ${err.toString()}`));

    python.on('close', code => {
        if (code === 0) { logger.info('Model retrained successfully.'); }
        else { logger.error(`Model retrain process exited with code ${code}.`); }
    });
    return;
}

module.exports = { randomReact, retrainModel, archiveMessages, saveDataset, logger, removeUserFromDataset, dataset }