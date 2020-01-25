#!/usr/bin/env node
process.env.NTBA_FIX_319 = 1; // fixes issue with telegram api

require("log-timestamp");

const TelegramBot = require('node-telegram-bot-api');
const i18n = require("i18n");

const config = require(__dirname + '/config.json');
const database = require(__dirname + '/db.js');
const token = require(__dirname + '/slp.js');

let lastCheckedBlock = 0;

i18n.configure({
  locales: [config.language],
  register: global,
  directory: __dirname + '/i18n'
});
i18n.setLocale(config.language);

const bot = new TelegramBot(config.telegram_token, { polling: true });

// used to block withdraw for current user Id
let currentUser = new Array();

token.getTokenInfo().then(function (tokenInfo) {

  bot.onText(/help|info/i, (msg) => {
    if (msg.chat.type === 'private') {
      bot.sendMessage(msg.chat.id, __('info_help', {
        tokenName: tokenInfo.name,
        tokenSymbol: tokenInfo.symbol
      }), {});
    }
  });

  bot.onText(/^tip$/i, (msg) => {
    if (msg.chat.type === 'private') {
      bot.sendMessage(msg.chat.id, __('help_tip', {
        tokenSymbol: tokenInfo.symbol
      }), {});
    }
  });

  // for testing this will send tokens even if they don't exist
  //
  // bot.onText(/^givemesome/i, (msg) => {
  //   if (msg.chat.type === 'private') {
  //     // do we give out free stuff?
  //     if (config.default_tip_amount > 0) {
  //       // get db totals
  //       let totalDb;
  //       database.getTotalBalance()
  //         .then(function (totalDb) {
  //           // get wallet totals
  //           return token.getBalance();
  //         }).then(function (tokenBalance) {
  //           // do we have enogh?
  //           if (tokenBalance - totalDb < config.default_tip_amount) {
  //             console.error('Token Balance - DB balance is less than default Tip ammount');
  //             throw 'no_gifts'
  //           }
  //         }).then(function () {
  //           // do you already have some
  //           return database.getBalanceForUserId(msg.from.id);
  //         }).then(function (balance) {
  //           if (balance > config.default_tip_amount) {
  //             console.error('User already has more than default Tip Ammount');
  //             throw 'no_gifts'
  //           }
  //           return balance;
  //         }).then(function (balance) {
  //           return database.setBalanceForUserId(msg.from.id, balance + config.default_tip_amount)
  //         }).then(function () {
  //           console.info('User tipped default Tip Ammount');
  //           throw 'gift_sent'
  //         }).catch(function (message) {
  //           if (message) {
  //             bot.sendMessage(msg.chat.id, __(message, {
  //               tokenSymbol: tokenInfo.symbol,
  //               ammount: config.default_tip_amount
  //             }), {});
  //           }
  //         });
  //     } else {
  //       console.info('Tipped default Tip Ammount is 0, disabled');
  //       bot.sendMessage(msg.chat.id, __('no_gifts', {
  //         tokenSymbol: tokenInfo.symbol
  //       }), {});
  //     }
  //   }
  // });

  bot.onText(/^withdraw$/i, (msg) => {
    if (msg.chat.type === 'private') {
      bot.sendMessage(msg.chat.id, __('help_withdraw', {}), {});
    }
  });

  // Reply balance only in private chat
  bot.onText(/balance/i, (msg) => {
    if (msg.chat.type === 'private') {
      database.getBalanceForUserId(msg.from.id).then(function (balance) {
        bot.sendMessage(msg.chat.id, __('balance_info', {
          balance: balance
        }), {});
      });
    }
  });

  // bot.onText(/whoami/i, (msg) => {
  //   if (msg.chat.type === 'private') {
  //     bot.sendMessage(msg.chat.id, __('who_am_i', {
  //       userId: msg.from.id
  //     }), {});
  //   }
  // });

  // bot.onText(/resync\s+([0-9]+)/i, (msg, match) => {
  //   if (msg.chat.type === 'private' && parseInt(msg.from.id) === config.owner_telegram_id) {
  //     let blockHeight = match[1];
  //     token.syncTransactions(blockHeight, function (transaction) {
  //       return user.depositFunds(transaction);
  //     });
  //   }
  // });

  bot.onText(/deposit/i, (msg) => {
    if (msg.chat.type === 'private') {
      let address = '';
      database.getDepositAddressForUserId(msg.from.id)
        .then(function (depositAddress) {
          if (depositAddress === false) {
            return database.insertBalanceForUserId(msg.from.id, 0)
              .then(function (newDbIndex) {
                return token.generateDepositAddress(newDbIndex);
              }).then(function (newDepositAddress) {
                address = newDepositAddress;
                return database.setDepositAddressForUserId(msg.from.id, newDepositAddress);
              }).catch(function (err) {
                console.error('error inserting balance', err);
              });
          } else if (!depositAddress) {
            return database.getDbIndexFromUserId(msg.from.id)
              .then(function (dbIndex) {
                return token.generateDepositAddress(dbIndex)
              }).then(function (newDepositAddress) {
                address = newDepositAddress;
                return database.setDepositAddressForUserId(msg.from.id, newDepositAddress);
              }).catch(function (err) {
                console.error('error getDbIndexFromUserId', err);
              });
          } else {
            address = depositAddress;
          }
        }).then(function () {
          bot.sendMessage(msg.chat.id, __('deposit_info'), {});
          bot.sendMessage(msg.chat.id, address, {});
        }).catch(function (err) {
          console.error('error getting deposit address', err);
        });
    }
  });

  bot.onText(/withdraw\s+([0-9]+)\s+(slptest.*|simpleledger.*)+/i, (msg, match) => {
    if (msg.chat.type === 'private') {
      let amount = match[1];
      let address = match[2];
      let transactionId;
      let newBalance;
      let currentBalance = 0;
      let userId = msg.from.id;

      // check if userId already exists in array
      if (user.hasPendingWithdrawl(userId)) {
        //throw 'withdraw in progress' error if it does
        bot.sendMessage(msg.chat.id, __('withdraw_in_progress', {}), {});
        return;
      } else {
        user.lockWithdrawl(userId);
      }

      database.userIdHasBalance(msg.from.id, amount)
        .then(function (result) {
          if (!result) {
            console.error('Withdraw error');
            // remove userId from array upon error
            throw 'not_enough_funds_error';
          }
          return database.getBalanceForUserId(msg.from.id);
        }).then(function (balance) {
          currentBalance = balance;
          return database.getFundingAddresses();
        }).then(function (fundingAddresses) {
          newBalance = token.substractFromBalance(currentBalance, amount);
          fundingAddresses.push({
            id: 0,
            deposit_addr: token.getPrimaryFundingAddress()
          });
          return token.findFundsForTx(fundingAddresses, amount);
        }).then(function (txos) {
          if (txos.length === 0) {
            console.error('No txos or all txos unconfirmed');
            // remove userId from array upon error
            throw 'not_enough_txos';
          }
          return token.withdraw(address, amount, txos);
        }).then(function (transactionId) {
          console.info('transactionId', transactionId);
          if (transactionId) {
            // update db
            database.setBalanceForUserId(msg.from.id, newBalance);
            //
            database.logTransaction(transactionId, amount, msg.from.id, '', 'withdraw');
            // send msg
            console.info('Withdraw completed: %s to user %s txd: %s', amount, msg.from.id, transactionId);

            // withdraw completed, remove userId so they can submit another withdraw
            user.unlockWithdrawl(userId);
            bot.sendMessage(msg.chat.id, __('withdraw_completed', {
              sendTxid: transactionId
            }), {});
          }
        }).catch(function (message) {
          console.error('Withdraw error: msg: ', message);
          let responseMessage = __(message, { sendTxid: transactionId });
          if (!responseMessage) {
            responseMessage = "Unable to send funds at this time. Please try again later."
          }
          // remove userId from array upon error
          user.unlockWithdrawl(userId);
          bot.sendMessage(msg.chat.id, responseMessage);

        });
    }
  });

  // tip messages
  bot.on('message', (msg) => {

    // if message is a reply
    if (msg.reply_to_message) {

      let amount = 0;

      // tip amount
      let regex = new RegExp(config.tip_keyword, 'i');
      let match = regex.exec(msg.text);
      if (match) {
        amount = match[1];
      }

      config.tip_emojis.forEach(function (item) {
        const count = (str) => {
          let regex = new RegExp(item.icon, 'g');
          return ((str || '').match(regex) || []).length
        }

        let occurance = count(msg.text);
        if (occurance > 0) {
          amount += (item.value * occurance);
        }
      });

      if (amount > 0) {

        // meta data
        let chatId = msg.chat.id;
        let fromUserId = msg.from.id;
        let fromUserFirstname = msg.from.first_name || '';
        let fromUserLastname = msg.from.last_name || '';
        let toUserId = msg.reply_to_message.from.id;
        let toUserFirstname = msg.reply_to_message.from.first_name || '';
        let toUserLastname = msg.reply_to_message.from.last_name || '';
        let timestamp = msg.date;

        let newFromBalance;
        database.userIdHasBalance(fromUserId, amount)
          .then(function (result) {
            if (!result) {
              // not enough funds
              console.error('Tip error, not enough funds');
              throw 'not_enough_funds_error';
            }
            return database.getBalanceForUserId(fromUserId)
          }).then(function (fromBalance) {
            newFromBalance = token.substractFromBalance(fromBalance, amount);
          }).then(function () {
            return database.getBalanceForUserId(toUserId)
          }).then(function (toBalance) {
            return token.addToBalance(toBalance, amount);
          }).then(function (newToBalance) {
            return database.setBalanceForUserId(toUserId, newToBalance);
          }).then(function () {
            return database.setBalanceForUserId(fromUserId, newFromBalance);
          }).then(function () {
            console.info('Tip successful %s to user %s from user %s', amount, toUserId, fromUserId);
            database.logTransaction('', amount, fromUserId, toUserId, 'tip');
            throw 'successful_tip';
          }).catch(function (message) {
            bot.sendMessage(chatId, __(message, {
              fromUserFirstname: fromUserFirstname,
              fromUserLastname: fromUserLastname,
              amount: amount,
              symbol: tokenInfo.symbol,
              toUserFirstname: toUserFirstname,
              toUserLastname: toUserLastname,
            }), {});
          });
      }
    }
  });

  bot.on('polling_error', (error) => {
    console.error('Bot Polling Error', error);
  });

  // listen for deposits
  token.startWebSocket(function (transaction) {
    user.depositFunds(transaction);
  });

  // periodic check of mempool and blockchain for changes
  setInterval(function () {
    (async () => {
      lastCheckedBlock = await token.syncTransactions(lastCheckedBlock, function (transaction) {
        return user.depositFunds(transaction);
      });
    })();
  }, 60000);

  let user = {
    pendingWithdrawUsers: [],
    hasPendingWithdrawl: function (userId) {
      return this.pendingWithdrawUsers.indexOf(userId) !== -1
    },
    lockWithdrawl: function (userId) {
      this.pendingWithdrawUsers.push(userId);
    },
    unlockWithdrawl: function (userId) {
      let index = this.pendingWithdrawUsers.indexOf(userId);
      if (index > -1) {
        this.pendingWithdrawUsers.splice(index, 1);
      }
    },
    depositFunds: function (transaction) {
      return new Promise(function (resolve, reject) {
        let updatedBalance;
        // check we didn't already process this id
        database.txIdRecorded(transaction.txId).then(function (result) {
          if (!result) {
            database.getUserIdByDepositAddress(transaction.outputAddress)
              .then(function (userId) {
                if (userId) {
                  // update balance of user
                  console.info("Found payment of " + transaction.amount + ", adding to: " + userId);
                  database.getBalanceFromUserId(userId)
                    .then(function (balance) {
                      console.info("User " + userId + " existing balance " + balance);
                      return token.addToBalance(balance, transaction.amount);
                    }).then(function (newBalance) {
                      console.info("Settings new balance " + newBalance + " for " + userId);
                      updatedBalance = newBalance;
                      return database.setBalanceForUserId(userId, newBalance);
                    }).then(function () {
                      database.logTransaction(transaction.txId, transaction.amount, '', userId, 'deposit');
                      bot.sendMessage(userId, __('deposit_received', {
                        txId: transaction.txId,
                        amount: transaction.amount,
                        updatedBalance: updatedBalance,
                        tokenSymbol: tokenInfo.symbol
                      }), {});
                      resolve();
                    }).catch(function (error) {
                      console.error(error);
                      resolve();
                    });
                } else {
                  resolve();
                }
              }).catch(function (error) {
                console.error(error);
                resolve();
              });
          } else {
            resolve();
          }

        }).catch(function (error) {
          console.error(error);
          resolve();
        });
      });
    }
  }

}).catch(function () {
  console.error('Unable to get Token Information, Is the token address correct in config.json?');
  process.exit(1);
})
