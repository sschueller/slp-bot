#!/usr/bin/env node

const inquirer = require("inquirer");
const chalk = require("chalk");
const figlet = require("figlet");
const shell = require("shelljs");
const config = require('./config.json');
const BITBOXSDK = require('bitbox-sdk')
const slpjs = require('slpjs');
const BigNumber = require('bignumber.js');
const fs = require("fs")

const walletFile = './wallet.json';
if (!fs.existsSync(walletFile)) {
    console.error('Wallet missing, create one first withe "node create-wallet.js"')
    process.exit(1);
}

const wallet = require(walletFile);
const slpAddr = slpjs.Utils.toSlpAddress(wallet.cashAddress);

const init = () => {
    console.log(
        chalk.green(
            figlet.textSync("SLP Creator", {
                font: "Ghost",
                horizontalLayout: "default",
                verticalLayout: "default"
            })
        )
    );
}

const askQuestions = () => {
    const questions = [
        {
            name: "NAME",
            type: "input",
            message: "Token Name:"
        },
        {
            name: "TICKER",
            type: "input",
            message: "Token Ticker:"
        },
        {
            name: "DECIMALS",
            type: "input",
            message: "Decimals:",
            default: 0
        },
        {
            name: "INITTOKENQTY",
            type: "input",
            message: "Initial Token Qty:",
            default: 1000000
        },        
        {
            name: "DOCURI",
            type: "input",
            message: "Document URI:"
        }
    ];
    return inquirer.prompt(questions);
};

const run = async () => {
    // show script introduction
    init();

    // ask questions
    const answers = await askQuestions();
    const { NAME, TICKER, DECIMALS, INITTOKENQTY, DOCURI } = answers;

    let decimals = DECIMALS;
    let name = NAME;
    let ticker = TICKER;
    let documentUri = DOCURI;
    let documentHash = null
    let initialTokenQty = INITTOKENQTY

    const bitbox = new BITBOXSDK.BITBOX({ restURL: config.network });
    const bitboxNetwork = new slpjs.BitboxNetwork(bitbox);
    
    // Get all balances at the funding address.
    let balances;
    (async function () {
        balances = await bitboxNetwork.getAllSlpBalancesAndUtxos(wallet.cashAddress);
        console.log('BCH balance:', balances.satoshis_available_bch);      
    
        // Calculate the token quantity with decimal precision included
        initialTokenQty = (new BigNumber(initialTokenQty)).times(10 ** decimals);
    
        // Set private keys
        balances.nonSlpUtxos.forEach(txo => txo.wif = wallet.WIF)
    
        // Use "simpleTokenGenesis()" helper method
        let genesisTxid;
        (async function () {
            genesisTxid = await bitboxNetwork.simpleTokenGenesis(
                name,
                ticker,
                initialTokenQty,
                documentUri,
                documentHash,
                decimals,
                slpAddr, // tokenReceiverAddress
                slpAddr, // batonReceiverAddress
                slpAddr, // bchChangeReceiverAddress
                balances.nonSlpUtxos
            )
            console.log("GENESIS txn complete:", genesisTxid)
        })();
    
    })();

};

run();




