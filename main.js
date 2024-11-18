require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const winston = require('winston');

// Setup Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(info => `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: process.env.LOG || 'archive.log' }),
    ]
});

// Dataset File Path
const DATASET_FILE = process.env.DATASET || 'dataset.csv';
const WORKING_CHANNEL = process.env.WORKINGCHANNEL;

// Analytics File Path
const ANALYTICS_FILE = path.resolve(__dirname, './data/analytics.json');

// Initialize Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// From the emoijs tab of the bot's dev portal page
const loadingEmojis = ['<a:loading2:1307386878609064030>', '<a:loading1:1307386865191620608>', '<a:loading:1307386851698409512>', '<a:loading3:1307386838947856474>', '<a:shakingeyes:1307349244717432954>'];

function randomReact (message) {
    let loadingReaction = loadingEmojis[(Math.random() * loadingEmojis.length) | 0] // Pick a random emoji from the above array
    message.react(loadingReaction)
}

// Generate analytics
function generateAnalytics(dataset) {
    //if (!Array.isArray(dataset)) {
    //    logger.error('Dataset is not an array. Cannot generate analytics.');
    //    return {};
    //}

    // Verify dataset structure
    const isValid = dataset.every(
        entry => typeof entry.Message === 'string' && typeof entry.Username === 'string'
    );

    if (!isValid) {
        logger.error('Dataset entries are invalid. Ensure all entries have "Message" and "Username" fields.');
        return {};
    }

    const totalMessages = dataset.length;

    const messagesPerUser = dataset.reduce((acc, row) => {
        acc[row.Username] = (acc[row.Username] || 0) + 1;
        return acc;
    }, {});

    const wordCountPerUser = dataset.reduce((acc, row) => {
        const wordCount = row.Message.split(/\s+/).length;
        acc[row.Username] = (acc[row.Username] || 0) + wordCount;
        return acc;
    }, {});

    return {
        totalMessages,
        messagesPerUser,
        wordCountPerUser,
    };
}

// Save analytics to a file
function saveAnalytics(analytics) {
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analytics, null, 2));
    logger.info('Analytics generated and saved.');
}

function loadDataset() {
    const dataset = [];
    if (fs.existsSync(DATASET_FILE)) {
        if (!Array.isArray(dataset)) { throw new logger.error('Dataset is not an array.'); }
        const content = fs.readFileSync(DATASET_FILE, 'utf8');
        const lines = content.split('\n').filter(line => line.trim() !== '');
        if (lines.length > 1) {
            const headers = lines[0].split(','); // Ensure valid headers
            const rows = lines.slice(1);
            rows.forEach(line => {
                const values = line.split(',');
                dataset.push({
                    [headers[0]]: values[0],
                    [headers[1]]: values[1],
                });
            });
        }
        logger.info(`Loaded dataset with ${dataset.length} entries.`);
    } else {
        logger.warn('Dataset file not found. Starting with an empty dataset.');
    }
    return dataset;
}

// Save Dataset
function saveDataset(dataset) {
    const csvWriter = createCsvWriter({
        path: DATASET_FILE,
        header: [
            { id: 'Message', title: 'Message' },
            { id: 'Username', title: 'Username' },
        ],
    });
    csvWriter.writeRecords(dataset).then(() => logger.info('Dataset saved successfully.'));
}

// Archive Messages
async function archiveMessages(channel) {
    let messages = [];
    let lastMessageId;

    while (true) {
        const fetched = await channel.messages.fetch({ limit: 100, before: lastMessageId });
        if (fetched.size === 0) break;

        fetched.forEach(msg => {
            if (!msg.author.bot) {
                messages.push({ Message: msg.content, Username: msg.author.username });
            }
        });
        lastMessageId = fetched.last().id;
    }

    saveDataset(messages);
    return messages.length;
}

// Retrain Model
function retrainModel() {
    logger.info('Retraining model...');
    const python = spawn('python3', ['python/train.py', DATASET_FILE]);

    python.stdout.on('data', data => logger.info(`Model Output: ${data.toString()}`));
    python.stderr.on('data', err => logger.error(`Model Error: ${err.toString()}`));

    python.on('close', code => {
        if (code === 0) logger.info('Model retrained successfully.');
        else logger.error(`Model retrain process exited with code ${code}.`);
    });
}

// Listen to all messages
client.on('messageCreate', async (message) => {
    // Ignore messages not in valid channel or from bot itself
    if (message.author.bot) return;
    if (message.channel.id != process.env.WORKINGCHANNEL) return;

    // Log each received message
    logger.info(`Received message from ${message.author.username}: ${message.content}`);

    // Save to dataset file
    if (message.content.toLowerCase() === '!savechannel') {
        logger.info(`Archive command received in channel ${message.channel.name} by ${message.author.username}`);

        if (!message.channel.isTextBased()) {
            await message.reply('Please use this command in a text-based channel.');
            return;
        }

        randomReact(message);

        try {
            let messages = [];
            let lastMessageId;

            // Fetch messages in chunks of 100 (can take some time for large channels)
            while (true) {
                const fetchedMessages = await message.channel.messages.fetch({ limit: 100, before: lastMessageId });
                if (fetchedMessages.size === 0) break;

                fetchedMessages.forEach(msg => {
                    if (!msg.author.bot) {
                        messages.push({
                            message: msg.content,
                            username: msg.author.username,
                        });
                    }
                });

                lastMessageId = fetchedMessages.last().id;
            }

            let writtenFile = './dataset.csv'

            // Create CSV Writer
            const csvWriter = createCsvWriter({
                path: writtenFile,
                header: [
                    { id: 'message', title: 'text' },
                    { id: 'username', title: 'username' },
                ]
            });

            // Write to CSV
            await csvWriter.writeRecords(messages);
            logger.info(`Archived ${messages.length} messages from channel ${message.channel.name}`);

            // Notify user
            message.react('<:check:1307855194930942033>')
            await message.reply({
                content: 'Messages archived successfully!',
                files: [{ attachment: writtenFile }]
            });
        } catch (error) {
            logger.error(`Error archiving messages: ${error.message}`);
            await message.reply('There was an error archiving messages.');
        }
        return;
    }

    else if (message.content.toLowerCase() === '!retrain') {
        logger.info(`Retrain command received in channel ${message.channel.name} by ${message.author.username}`);
        try {
            randomReact(message);
            const retrain = spawn('python3', ['./python/train.py']); // Run a python script to retrain the model
            retrain.stdout.on('data', data => {
                console.log(data.toString()); // Log output from python
            });
            retrain.on('close', async code => { // When python finishes
                message.react('<:check:1307855194930942033>')
                logger.info('Model training finished!')
            });
        }
        catch (error) {
            await message.reply('There was an error retraining the model.');
            await logger.error(`Error retraining model: ${error.message}`);
        }
    }

    else if (message.content.toLowerCase() === '!generateanalytics') {
        randomReact(message);
        const analytics = generateAnalytics(DATASET_FILE);
        saveAnalytics(ANALYTICS_FILE);
        await message.reply('Analytics generated and saved!');
    }

    else {
        // AI guessing for each message
        const predictor = spawn('python3', ['./python/predictor.py', message.content]);

        let prediction = '';
        predictor.stdout.on('data', data => {
            prediction += data.toString();
        });

        predictor.stderr.on('data', err => {
            logger.error(`Python script error: ${err.toString()}`);
        });

        predictor.on('close', async code => {
            if (code !== 0) {
                 logger.error(`Python script exited with code ${code}`);
                 await message.reply('**Sorry, there was an error making the prediction.**\nPlease try running \`!retrain\`. If that fails, please try \`!archive\`. If that fails, please [open a GitHub issue](<https://github.com/midnightdoggo19/guesser/issues/new>).');
            } else {
                 const predictedUser = prediction.trim();
                 logger.info(`Predicted user for message "${message.content}": ${predictedUser}`);
                 await message.reply(`The user most likely to have sent this message is: ${predictedUser}`);
            }
        });
    }
});

// Bot Ready Event
client.once('ready', () => {
    logger.info('Bot is online and ready.');
});

client.login(process.env.TOKEN);
