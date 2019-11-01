const fetch = require('node-fetch')
const childproc = require('child_process')
const dummyVals = require('./prep-db/mongo')

const defaultPubName = dummyVals.ids.publisher

// note that the dummy adapter just requires the ID as an auth token
function fetchPost(url, authToken, body) {
	return fetch(url, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${authToken}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify(body)
	})
}

function postEvents(url, channelId, events, auth = dummyVals.auth.creator) {
	// It is important to use creator auth, otherwise we'd hit rate limits
	return fetchPost(`${url}/channel/${channelId}/events`, auth, { events })
}

function genEvents(n, pubName, type, adUnit, earners, outputs) {
	const events = []
	let ev = {
		type: type || 'IMPRESSION',
		publisher: pubName || defaultPubName
	}
	if (type === 'IMPRESSION_WITH_COMMISSION') {
		ev = {
			type,
			earners:
				earners ||
				[dummyVals.ids.publisher, dummyVals.ids.publisher2].map(earner => ({
					publisher: earner,
					promilles: 500
				}))
		}
	}
	if (type === 'PAY') {
		ev = {
			type,
			outputs: outputs || {
				[dummyVals.ids.publisher]: '10',
				[dummyVals.ids.publisher2]: '10'
			}
		}
	}
	ev = adUnit ? { ...ev, adUnit } : ev
	for (let i = 0; i < n; i += 1) {
		events.push({ ...ev })
	}
	return events
}

function getDummySig(hash, from) {
	return `Dummy adapter signature for ${hash} by ${from}`
}

function wait(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function exec(cmd) {
	return new Promise((resolve, reject) => {
		const proc = childproc.exec(cmd, err => (err ? reject(err) : resolve()))
		proc.stdout.pipe(process.stdout)
		proc.stderr.pipe(process.stderr)
	})
}

function forceTick() {
	if (process.env.RUST_VALIDATOR_WORKER) {
		return Promise.all([
			exec(
				`RUST_BACKTRACE=1 ${
					process.env.RUST_VALIDATOR_WORKER
				} -a dummy -i 0xce07cbb7e054514d590a0262c93070d838bfba2e -u http://localhost:8005 -t`
			),
			exec(
				`RUST_BACKTRACE=1 ${
					process.env.RUST_VALIDATOR_WORKER
				} -a dummy -i 0xc91763d7f14ac5c5ddfbcd012e0d2a61ab9bded3 -u http://localhost:8006 -t`
			)
		])
	}
	return Promise.all([
		exec(
			`./bin/validatorWorker.js --single-tick --adapter=dummy --dummyIdentity=0xce07cbb7e054514d590a0262c93070d838bfba2e --sentryUrl=http://localhost:8005`
		),
		exec(
			`./bin/validatorWorker.js --single-tick --adapter=dummy --dummyIdentity=0xc91763d7f14ac5c5ddfbcd012e0d2a61ab9bded3 --sentryUrl=http://localhost:8006`
		)
	])
}

let validUntil = new Date()
validUntil.setFullYear(validUntil.getFullYear() + 1)
validUntil = Math.floor(validUntil.getTime() / 1000)

let withdrawPeriodStart = new Date()
withdrawPeriodStart.setMonth(withdrawPeriodStart.getMonth() + 6)
withdrawPeriodStart = withdrawPeriodStart.getTime()

module.exports = {
	postEvents,
	genEvents,
	getDummySig,
	forceTick,
	wait,
	fetchPost,
	exec,
	validUntil,
	withdrawPeriodStart
}
