# Guesser
Guesser is a Discord bot that can download a channel and train an AI model on it in order to guess which user sent a message. It's written in JavaScript, though it passes the AI-related takes off to Python.

## Installation

### Clone the repository:

    git clone https://github.com/midnightdoggo19/guesser.git
    cd guesser

### Install dependencies:

    pip install -r requirements.txt
    npm install

#### Copy example.env and add your bot's information, and rename it to ".env". This includes:
<li>TOKEN- Your bot token</li>
<li>ID- Your bot ID</li>
<li>LOG- The file to log to (default: archive.log)</li>
<li>DATASET- Used by main.js and train.py as the csv to save the channel text & usernames too</li>
<li>WORKINGCHANNEL- The channel the bot should respond in</li>

##### Run the bot:

    npm start

## Usage
### Commands
    !savechannel - Exports the current channel as a .csv file for use in training the model.
    !retrain - Makes use of the exported .csv file to train the model.

### Guessing
In order to have the bot start guessing, just send a channel in a server the bot has access to! It'll process the message and try and guess who sent it.
