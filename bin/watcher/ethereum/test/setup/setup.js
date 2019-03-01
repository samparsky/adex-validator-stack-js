const Web3 = require('web3');
const web3 = new Web3('http://localhost:8545');
const solc = require('solc')
const fs = require('fs')
const { providers, Contract, Wallet, ContractFactory } = require('ethers')
const provider = new providers.JsonRpcProvider('http://localhost:8545');
const { Channel } = require('adex-protocol-eth/js/Channel')


let core = null
let token = null
let channel = null
const privateKey = '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501200';
let wallet = new Wallet(privateKey, provider);

const input = {
	language: 'Solidity',
	sources: {
		'Token.sol': {
			content: fs.readFileSync('./test/mocks/Token.sol', 'utf-8')
		}
	},
	settings: {
		outputSelection: {
			'*': {
				'*': [ '*' ]
			}
		}
	}
}

const MockToken = JSON.parse(solc.compile(JSON.stringify(input)))

// create deploy json
async function deployContracts(){
    const abi = require('adex-protocol-eth/abi/AdExCore.json')
    const AdexCore = require('adex-protocol-eth/build/contracts/AdExCore.json')
    const { bytecode } = AdexCore
    core = new ContractFactory(abi, bytecode, wallet);

    const tokenbytecode = MockToken['contracts']['Token.sol']['Token']['evm']['bytecode']['object']
    const tokenabi = MockToken['contracts']['Token.sol']['Token']['abi']
    token = new ContractFactory(tokenabi, tokenbytecode, wallet)
    
    core = await core.deploy()
    token = await token.deploy()

    core = await core.deployed()
    token = await token.deployed()

    const blockTime = (await web3.eth.getBlock('latest')).timestamp
    channel = sampleChannel(wallet.address, 2000, blockTime+50, 0)
    
    // write contract address
    let tuple = channel.toSolidityTuple()
    tuple[5] = tuple[5].toString('hex')
    
    const data = JSON.stringify({
        'adexcore': core.address,
        'token': token.address,
        'channelId': channel.hashHex(core.address).toString('hex'),
        'channelSolidityTuple': tuple,
    })

    fs.writeFileSync('./test/mocks/tokenabi.json', JSON.stringify(tokenabi));
    fs.writeFileSync('./test/mocks/deploy.json', data);
}

function sampleChannel(creator, amount, validUntil, nonce) {
    const spec = new Buffer(32)
    spec.writeUInt32BE(nonce)
    return new Channel({
        creator,
        tokenAddr: token.address,
        tokenAmount: amount,
        validUntil,
        validators: [creator, creator],
        spec,
    })
}


deployContracts()
.then(function(){
    console.log(`🔥 Successfully deployed contracts 🔥`)
})