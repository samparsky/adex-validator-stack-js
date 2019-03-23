#!/usr/bin/env node
const assert = require('assert')
const yargs = require('yargs')
const cfg = require('../cfg')
const db = require('../db')
const adapters = require('../adapters')
const leader = require('../services/validatorWorker/leader')
const follower = require('../services/validatorWorker/follower')

const { argv } = yargs
	.usage('Usage $0 [options]')
	.describe('adapter', 'the adapter for authentication and signing')
	.choices('adapter', Object.keys(adapters))
	.default('adapter', 'ethereum')
	.describe('keystoreFile', 'path to JSON Ethereum keystore file')
	.describe('keystorePwd', 'password to unlock the Ethereum keystore file')
	.describe('dummyIdentity', 'the identity to use with the dummy adapter')
	.boolean('singleTick')
	.describe('singleTick', 'run a single tick and exit')
	.demandOption(['adapter'])

const adapter = adapters[argv.adapter]

db.connect()
	.then(function() {
		return adapter.init(argv).then(() => adapter.unlock(argv))
	})
	.then(function() {
		if (argv.singleTick) {
			allChannelsTick().then(() => process.exit(0))
		} else {
			loopChannels()
		}
	})
	.catch(function(err) {
		console.error('Fatal error while connecting to the database', err)
		process.exit(1)
	})

function allChannelsTick() {
	const channelsCol = db.getMongo().collection('channels')
	return channelsCol
		.find({ validators: adapter.whoami() })
		.limit(cfg.MAX_CHANNELS)
		.toArray()
		.then(function(channels) {
			return Promise.all(channels.map(validatorTick))
		})
}

function loopChannels() {
	Promise.all([allChannelsTick(), wait(cfg.WAIT_TIME)]).then(function([allResults]) {
		logPostChannelsTick(allResults)
		loopChannels()
	})
}

function validatorTick(channel) {
	const validatorIdx = channel.validators.indexOf(adapter.whoami())
	assert.ok(validatorIdx !== -1, 'validatorTick: processing a channel where we are not validating')

	const isLeader = validatorIdx === 0
	const tick = isLeader ? leader.tick : follower.tick
	return tick(adapter, channel)
}
function wait(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function logPostChannelsTick(channels) {
	console.log(`validatorWorker: processed ${channels.length} channels`)
	if (channels.length === cfg.MAX_CHANNELS) {
		console.log(
			`validatorWorker: WARNING: channel limit cfg.MAX_CHANNELS=${cfg.MAX_CHANNELS} reached`
		)
	}
}
