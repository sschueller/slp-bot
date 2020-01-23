'use strict';
const sqlite = require('sqlite');
const dbPromise = Promise.resolve()
  .then(() => sqlite.open(__dirname + '/sqlite3.db', { Promise }))
  .then(db => db.migrate({ force: 'last' }));

var database = {

    txIdRecorded: function(txId) {
        return new Promise(function (resolve, reject) {
            dbPromise.then(function (db) {
                db.get("SELECT id FROM trans_log WHERE tx_id = $txId", {
                    $txId: txId
                }).then(function (row) {
                    resolve(row ? true : false);                    
                }).catch(error => reject(error));
            }).catch(err => console.log('DB Promise error', err))         
        });
    },

    logTransaction: function (txId, amount, fromUser, toUser, type) {
        let timestamp = new Date().getTime();
        return new Promise(function (resolve, reject) {
            dbPromise.then(function (db) {
                db.run("INSERT INTO trans_log (tx_id, amount, timestamp, from_user, to_user, type) VALUES ($txId, $amount, $timestamp, $fromUser, $toUser, $type)", {
                    $txId: txId,
                    $amount: amount,
                    $timestamp: timestamp,
                    $fromUser: fromUser,
                    $toUser: toUser,
                    $type: type
                }).then(function () {
                    resolve(this.lastID);                    
                }).catch(error => reject(error));
            }).catch(err => console.log('DB Promise error', err))         
        });
    },

    getFundingAddresses: function (offset, limit) {
        return new Promise(function (resolve, reject) {
            dbPromise.then(function (db) {
                db.all("SELECT id, deposit_addr FROM balances WHERE deposit_addr IS NOT NULL ORDER BY id DESC LIMIT $offset, $limit", {
                    $offset: offset || 0,
                    $limit: limit || 100
                }).then(function (rows) {
                    resolve(rows);                    
                }).catch(error => reject(error));
            }).catch(err => console.log('DB Promise error', err))  
        });
    },

    getDbIndexFromUserId: function (userId) {
        return new Promise(function (resolve, reject) {
            dbPromise.then(function (db) {
                db.get("SELECT id FROM balances WHERE user_id = $userId", {
                    $userId: userId
                }).then(function (row) {
                    resolve(row.id);                    
                }).catch(error => reject(error));
            }).catch(err => console.log('DB Promise error', err))  
        });
    },

    getTotalBalance: function () {
        return new Promise(function (resolve, reject) {
            dbPromise.then(function (db) {
                db.get("SELECT SUM(balance) FROM balances", {}).then(function (row) {
                    resolve(row ? row : 0);                    
                }).catch(error => reject(error));
            }).catch(err => console.log('DB Promise error', err))  
        });
    },

    getUserIdByDepositAddress: function (depositAddress) {
        return new Promise(function (resolve, reject) {
            dbPromise.then(function (db) {
                db.get("SELECT user_id FROM balances WHERE deposit_addr = $depositAddress", {
                    $depositAddress: depositAddress
                }).then(function (row) {
                    resolve(row ? row.user_id : false);                    
                }).catch(error => reject(error));
            }).catch(err => console.log('DB Promise error', err))  
        });
    },

    userIdExists: function (userId) {
        return new Promise(function (resolve, reject) {
            dbPromise.then(function (db) {
                db.get("SELECT id FROM balances WHERE user_id = $userId", {
                    $userId: userId
                }).then(function (row) {
                    resolve(row ? true : false);                    
                }).catch(error => reject(error));
            }).catch(err => console.log('DB Promise error', err))  
        });
    },

    userIdHasBalance: function (userId, balance) {
        return new Promise(function (resolve, reject) {
            database.getBalanceFromUserId(userId).then(function (currentBalance) {
                resolve(currentBalance >= balance);
            }).catch(function () {
                reject();
            });
        });
    },

    getBalanceFromUserId: function (userId) {
        return new Promise(function (resolve, reject) {
            dbPromise.then(function (db) {
                db.get("SELECT balance FROM balances WHERE user_id = $userId", {
                    $userId: userId
                }).then(function (row) {
                    let balance = row ? row.balance : 0;
                    resolve(balance);                    
                }).catch(error => reject(error));
            }).catch(err => console.log('DB Promise error', err))  
        });
    },

    setBalanceForUserId: function (userId, newBalance) {
        return new Promise(function (resolve, reject) {            
            database.userIdExists(userId).then(function (result) {
                if (!result) {
                    return database.insertBalanceForUserId(userId, newBalance)
                        .then(function () {
                            resolve();
                        }).catch(function (error) {
                            reject(error);
                        });
                } else {
                    dbPromise.then(function (db) {
                        //console.log('user exist ', newBalance, userId);
                        db.run("UPDATE balances SET balance = $balance WHERE user_id = $userId", {
                            $balance: newBalance,
                            $userId: userId
                        }).then(function () {
                            resolve();                            
                        }).catch(error => reject(error));
                    }).catch(err => console.log('DB Promise error', err))  
                }
            }).catch(function (error) {
                reject(error);
            });
        });
    },

    insertBalanceForUserId: function (userId, balance) {
        return new Promise(function (resolve, reject) {
            dbPromise.then(function (db) {
                db.run("INSERT INTO balances (balance, user_id) VALUES ($balance, $userId)", {
                    $balance: balance,
                    $userId: userId
                }).then(function () {
                    resolve(this.lastID);                    
                }).catch(error => reject(error));
            }).catch(err => console.log('DB Promise error', err))  
        });
    },

    getBalanceForUserId: function (userId) {
        return new Promise(function (resolve, reject) {
            dbPromise.then(function (db) {
                db.get("SELECT balance FROM balances WHERE user_id = $userId", {
                    $userId: userId
                }).then(function (row) {
                    let balance = row ? row.balance : 0;
                    resolve(balance);                    
                }).catch(error => reject(error));
            }).catch(err => console.log('DB Promise error', err))  
        });
    },

    getDepositAddressForUserId: function (userId) {
        return new Promise(function (resolve, reject) {
            dbPromise.then(function (db) {
                db.get("SELECT deposit_addr FROM balances WHERE user_id = $userId", {
                    $userId: userId
                }).then(function (row) {
                    if (row) {
                        resolve(row.deposit_addr);
                    } else {
                        resolve(false);
                    }                    
                }).catch(error => reject(error));
            }).catch(err => console.log('DB Promise error', err))  
        });
    },

    setDepositAddressForUserId: function (userId, depositAddress) {
        return new Promise(function (resolve, reject) {
            database.userIdExists(userId)
                .then(function () {
                    dbPromise.then(function (db) {
                        db.run("UPDATE balances SET deposit_addr = $depositAddress WHERE user_id = $userId", {
                            $depositAddress: depositAddress,
                            $userId: userId
                        }).then(function () {
                            resolve();                            
                        }).catch(error => reject(error));
                    }).catch(err => console.log('DB Promise error', err))  
                }).catch(function (error) {
                    reject(error);
                });
            
        });
    }
};

module.exports = database;