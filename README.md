# SLP Telegram Bot

## WARNING:
This bot was written in a few hours. There are no tests and it has not been certified to work correctly. Do not use tokens of value with this bot. I take no responsiblity for any lost funds of any kind.

Also note this project is written in Javascript using npm packages which should be consider insecure.

### TODO:
- If the bot is not running deposits are not added to DB. Bot needs to go through history mempool on start to make sure it accounted for all deposits if it crashed.
- test tokens with decimal places
- Add tests
- Cleanup code


## General Information

This bot listens for specific tipping messages in groups it has been invited in as well as direct messages (balance, deposit, withdraw and help). 

The Bot has a HD Wallet which is used for all tokens. Deposists by users are sent to na unique slp address generated from the HD Wallet for each user. Token balances are tracked in an SQLite db.

In order for the bot to do withdrawl requests there needs to be some BCH in the wallet. Make sure you keep track of this and fill it when required.

SLP dividends are not tracked and all go to the bots Wallet.

### Setup

#### Install required packages
```bash
yarn install
``` 

#### config.json
1. Copy ```config.json.dist``` to ```config.json```
    ```bash
    cp config.json.dist config.json
    ```
2. Adjust ```config.json``` for your needs

#### Create a bot on telegram via the BotFather
Send the following messages to ```@BotFather```
1. ```/newbot``` and follow the prompts to create your bot.
2. ```/setprivacy``` set privancy to Disabled (required for bot to hear messages in group chats): 
3. Copy the ```token``` into your ```config.json``` for key ```telegramToken```

#### Create a wallet for the bot
1. Run ```node create-wallet.js``` to create a new wallet
2. Write down the 12 seeds words and keep them in a safe location



## Donate

If you like this bot and want to support me, send me some tokens or crypto: 

SLP: 

<img alt="simpleledger:qq0dg8mk42k2czhqv008tsaqj4tf24f3e52whts56e"
     src="https://bwipjs-api.metafloor.com/?bcid=qrcode&text=simpleledger:qq0dg8mk42k2czhqv008tsaqj4tf24f3e52whts56e">

     simpleledger:qq0dg8mk42k2czhqv008tsaqj4tf24f3e52whts56e

BCH:

<img alt="bitcoincash:qp8uwzjfw4nce7terjre80u38kfvcnxf5glm5rv676"
     src="https://bwipjs-api.metafloor.com/?bcid=qrcode&text=bitcoincash:qp8uwzjfw4nce7terjre80u38kfvcnxf5glm5rv676">

     bitcoincash:qp8uwzjfw4nce7terjre80u38kfvcnxf5glm5rv676

BTC:

<img alt="1Lv4Etacsjj1yi3AUGbzZZrcHHhbVbrNkY"
     src="https://bwipjs-api.metafloor.com/?bcid=qrcode&text=1Lv4Etacsjj1yi3AUGbzZZrcHHhbVbrNkY">

     1Lv4Etacsjj1yi3AUGbzZZrcHHhbVbrNkY

ETH:

<img alt="0xe5faC92651dD9Cf6ebab9C8B47d625502B334096"
     src="https://bwipjs-api.metafloor.com/?bcid=qrcode&text=0xe5faC92651dD9Cf6ebab9C8B47d625502B334096">

     0xe5faC92651dD9Cf6ebab9C8B47d625502B334096


