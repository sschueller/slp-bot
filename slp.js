'use strict';

const BigNumber = require('bignumber.js');
const SLPSDK = require("slp-sdk");
const fs = require("fs");
const forEach = require('async-foreach').forEach;
const nodemailer = require('nodemailer');

const config = require(__dirname + '/config.json');
const walletFile = __dirname + '/wallet.json';

if (!fs.existsSync(walletFile)) {
    console.error('error_no_wallet_file', walletFile);
    process.exit(1);
}

const wallet = require(walletFile);

const net = config.testnet ? config.network_testnet : config.network_mainnet;
const webSocketUrl = config.testnet ? config.ws_testnet : config.ws_mainnet;

const SLP = new SLPSDK({ restURL: net });
const slpjs = SLP.slpjs;
const bitbox = SLP;
const bitboxNetwork = new slpjs.BitboxNetwork(SLP);

const transporter = nodemailer.createTransport(config.email.config);

var token = {

    getPrimaryFundingAddress: function () {
        return slpjs.Utils.toSlpAddress(wallet.cashAddress);
    },

    addToBalance: function (balance, addAmount) {
        return (new BigNumber(balance)).plus((new BigNumber(addAmount))).toPrecision();
    },

    substractFromBalance: function (balance, subtractAmount) {
        return (new BigNumber(balance)).minus((new BigNumber(subtractAmount))).toPrecision();
    },

    getTokenInfo: function () {
        return bitboxNetwork.getTokenInformation(config.tokenAddress);
    },

    generateDepositAddress: function (derivePathInteger) {
        return new Promise(function (resolve, reject) {
            let seedBuffer = bitbox.Mnemonic.toSeed(wallet.mnemonic);
            const masterHDNode = bitbox.HDNode.fromSeed(seedBuffer);
            const childNode = masterHDNode.derivePath(`m/44'/145'/0'/0/${derivePathInteger}`)
            let newAddr = bitbox.HDNode.toCashAddress(childNode);
            let slpAddr = slpjs.Utils.toSlpAddress(newAddr);
            if (slpAddr) {
                resolve(slpAddr);
            } else {
                reject();
            }
        });
    },

    getWifForAddress: function (derivePathInteger, address) {
        return new Promise(function (resolve, reject) {
            let WIF = '';
            let seedBuffer = bitbox.Mnemonic.toSeed(wallet.mnemonic);
            const masterHDNode = bitbox.HDNode.fromSeed(seedBuffer);
            const bchAccount = masterHDNode.derivePath(`m/44'/145'/0'/0/${derivePathInteger}`)

            if (slpjs.Utils.toSlpAddress(bitbox.HDNode.toCashAddress(bchAccount)) === address) {
                WIF = bitbox.HDNode.toWIF(bchAccount);
                // console.log('WIF', WIF);
            }
            if (WIF) {
                resolve(WIF);
            } else {
                reject();
            }
        });
    },

    getBalance: function (address) {
        return bitboxNetwork.getAllSlpBalancesAndUtxos(address || wallet.cashAddress);
    },

    findFundsForTx: function (fundingAddresses, requiredAmount) {
        return new Promise(function (resolve, reject) {

            let inputUtxos = [];
            let have = 0;

            (async () => {
                await asyncForEach(fundingAddresses, async (address) => {
                    //if (have < requiredAmount) {
                        await token.getBalance(address.deposit_addr).then(function (balances) {

                            if (balances.slpTokenBalances[config.tokenAddress] !== undefined) {
                                // get WIF                                                
                                token.getWifForAddress(address.id, address.deposit_addr).then(function (WIF) {
                                    balances.slpTokenUtxos[config.tokenAddress].forEach(txo => txo.wif = WIF);
                                    inputUtxos = inputUtxos.concat(balances.slpTokenUtxos[config.tokenAddress]);

                                    // Added BCH for funding
                                    balances.nonSlpUtxos.forEach(txo => txo.wif = WIF);
                                    inputUtxos = inputUtxos.concat(balances.nonSlpUtxos);

                                    have = token.addToBalance(have, balances.slpTokenBalances[config.tokenAddress]);
                                }).catch(function (error) {
                                    reject(error);
                                });
                            }
                        }).catch(function (error) {
                            console.log(error)
                            // do nothing, we ignore txos which we can't use. e.g. 0 conf
                        });
                    //}

                });
                resolve(inputUtxos);
            })();
        });

    },

    // Assumes user is permitted to retrieve amount
    withdraw: function (tokenReceiverAddresses, amount, inputUtxos) {
        return new Promise(function (resolve, reject) {

            (async function () {

                let tokenInfo = await token.getTokenInfo();
                let sendAmounts = [amount];
                let bchChangeReceiverAddress = slpjs.Utils.toSlpAddress(wallet.cashAddress);

                sendAmounts = sendAmounts.map(a => (new BigNumber(a)).times(10 ** tokenInfo.decimals));

                // console.info('tokenAddress', config.tokenAddress);
                // console.info('sendAmounts', sendAmounts);
                // console.info('inputUtxos', inputUtxos);
                // console.info('tokenReceiverAddresses', tokenReceiverAddresses);
                // console.info('bchChangeReceiverAddress', bchChangeReceiverAddress);

                let extraFee = (8) * inputUtxos.length;

                // Send token
                let sendTxid;
                (async function () {

                    sendTxid = await bitboxNetwork.simpleTokenSend(
                        config.tokenAddress, // tokenId
                        sendAmounts,
                        inputUtxos,
                        tokenReceiverAddresses,
                        bchChangeReceiverAddress,
                        [], // requiredNonTokenOutputs
                        extraFee
                    ).catch(function (error) {
                        if (error.toString().includes("input BCH amount is too low.")) {
                            // send email on low funds to owner
                            // transporter.sendMail({
                            //     from: config.email,
                            //     to: config.email,
                            //     subject: 'SLP-Bot is out of funds',
                            //     text: 'Please deposit some BCH to: ' + wallet.cashAddress + " in order for users to make SLP withdrawls."
                            // }, function (error, info) {
                            //     if (error) {
                            //         console.info(error);
                            //     } else {
                            //         console.info('Email sent: ' + info.response);
                            //     }
                            // });
                        }
                        console.info('error', error);
                    })

                    if (sendTxid) {
                        console.info("SEND txn complete:", sendTxid);
                        resolve(sendTxid);
                    } else {
                        console.info("txn failed: ", tokenReceiverAddresses, amount);
                        reject();
                    }
                })();
            })();
        });
    },

    startWebSocket: function (__callback) {

        // listen for mempool entries
        let socket = new SLP.Socket({
            callback: () => {
                console.info("Web Socket Connected")
            },
            wsURL: webSocketUrl
        })
        socket.listen(
            {
                v: 3,
                q: {
                    find: {
                    }
                }
            },
            (message) => {

                let obj = JSON.parse(message);

                // console.log(message);

                if (obj.type === "mempool") {
                    obj.data.forEach(data => {
                        if (data && data.slp) {
                            // is this my token
                            if (data.slp.detail.tokenIdHex === config.tokenAddress) {
                                // console.log(data.slp.detail);
                                // console.log(data.slp.detail.outputs);

                                for (const output of data.slp.detail.outputs) {
                                    __callback({
                                        outputAddress: output.address,
                                        amount: output.amount
                                    });
                                };
                            }
                        }
                    });
                }
            }
        )
    }

};

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

module.exports = token;