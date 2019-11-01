#!/usr/bin/env node

const tape = require('tape-catch')
const fetch = require('node-fetch')
const { postEvents, fetchPost, wait, genEvents, withdrawPeriodStart, validUntil } = require('./lib')

// const cfg = require('../cfg')
const dummyVals = require('./prep-db/mongo')

const leaderUrl = dummyVals.channel.spec.validators[0].url
const followerUrl = dummyVals.channel.spec.validators[1].url
// const defaultPubName = dummyVals.ids.publisher

const dummyChannelId2 = '0x7698f4ca3d772949066c4f278566086a96342085870e557357d21f23d9bb0bab'

tape('/cfg', async function(t) {
	const resp = await fetch(`${leaderUrl}/cfg`).then(res => res.json())
	t.ok(resp, 'has resp')
	t.ok(typeof resp.HEARTBEAT_TIME === 'number', 'has HEARTBEAT_TIME')
	t.end()
})

tape('/channel/list - with filters', async function(t) {
	const id = dummyVals.channel.spec.validators[0].id
	const creator = dummyVals.channel.creator
	// test channel list filters if there are any
	const channelFilterFixtures = [
		['', 1],
		[`?validator=${id}`, 1],
		[`?validator=${id}1`, 0],
		[`?creator=${creator}`, 1],
		[`?creator=${creator}1`, 0],
		// 2200-01-01
		[`?validUntil=7258118400`, 0]
	]
	await Promise.all(
		channelFilterFixtures.map(async item => {
			const [filter, length] = item
			const resp = await fetch(`${leaderUrl}/channel/list${filter}`).then(res => res.json())
			t.ok(Array.isArray(resp.channels), 'resp.channels is an array')
			t.equal(resp.channels.length, length, 'resp.channels is the right len')
		})
	)
	t.end()
})

tape('/channel/{id}/{status,validator-messages}: non existant channel', async function(t) {
	await Promise.all(
		['status', 'validator-messages'].map(path =>
			fetch(`${leaderUrl}/channel/xxxtentacion/${path}`).then(function(res) {
				t.equal(res.status, 404, 'status should be 404')
			})
		)
	)
	t.end()
})

tape('POST /channel/{id}/events: non existant channel', async function(t) {
	const resp = await postEvents(leaderUrl, 'xxxtentacion', [])
	t.equal(resp.status, 404, 'status should be 404')
	t.end()
})

tape('/channel/{id}/status', async function(t) {
	const resp = await fetch(`${leaderUrl}/channel/${dummyVals.channel.id}/status`).then(res =>
		res.json()
	)
	t.ok(resp.channel, 'has resp.channel')
	t.deepEqual(resp.channel, dummyVals.channel, 'channel is deepEqual')
	t.end()
})

tape(
	'POST /channel/{id}/validator-messages: malformed messages (leader -> follower)',
	async function(t) {
		await Promise.all(
			[
				null,
				{ type: 1 },
				{ type: 'NewState' },
				{ type: 'NewState', balances: 'iamobject' },
				{ type: 'ApproveState', stateRoot: 'notlongenough', signature: 'something' }
			].map(msg =>
				fetchPost(
					`${followerUrl}/channel/${dummyVals.channel.id}/validator-messages`,
					dummyVals.auth.leader,
					{ messages: [msg] }
				).then(function(resp) {
					t.equal(resp.status, 400, 'status must be BadRequest')
				})
			)
		)
		t.end()
	}
)

tape('POST /channel/{id}/events: malformed events', async function(t) {
	await Promise.all(
		[null, { type: 1 }, { type: null }].map(ev =>
			fetchPost(`${leaderUrl}/channel/${dummyVals.channel.id}/events`, dummyVals.auth.user, {
				events: [ev]
			}).then(function(resp) {
				t.equal(resp.status, 400, 'status is BadRequest')
			})
		)
	)
	t.end()
})

tape('POST /channel/{id}/validator-messages: wrong authentication', async function(t) {
	await fetchPost(`${leaderUrl}/channel/${dummyVals.channel.id}/validator-messages`, `WRONG AUTH`, {
		messages: []
	}).then(function(resp) {
		t.equal(resp.status, 401, 'status must be Unauthorized')
	})
	t.end()
})

tape('POST /channel/{id}/events: CLOSE, PAY: a publisher but not a creator', async function(t) {
	await Promise.all(
		[{ type: 'CLOSE' }, { type: 'PAY', outputs: { test: '1' } }].map(ev => {
			return fetchPost(
				`${leaderUrl}/channel/${dummyVals.channel.id}/events`,
				dummyVals.auth.publisher,
				{
					events: [ev]
				}
			).then(function(resp) {
				t.equal(resp.status, 403, 'status must be Forbidden')
			})
		})
	)
	t.end()
})

tape('POST /channel: should not work with invalid withdrawPeriodStart', async function(t) {
	const channel = {
		...dummyVals.channel,
		id: dummyChannelId2,
		validUntil,
		spec: {
			...dummyVals.channel.spec,
			withdrawPeriodStart: new Date('2200-01-01').getTime(),
			minPerImpression: '1',
			maxPerImpression: '1'
		}
	}
	const resp = await fetchPost(`${followerUrl}/channel`, dummyVals.auth.leader, channel).then(r =>
		r.json()
	)
	t.equal(
		resp.message,
		'channel withdrawPeriodStart is invalid',
		'should throw invalid withdrawPeriodStart error'
	)
	t.end()
})

tape('POST /channel: should reject validUntil greater than one year', async function(t) {
	const channel = {
		...dummyVals.channel,
		id: dummyChannelId2,
		validUntil: new Date('2200-01-01').getTime(),
		spec: {
			...dummyVals.channel.spec,
			withdrawPeriodStart: new Date('2200-01-01').getTime(),
			minPerImpression: '1',
			maxPerImpression: '1'
		}
	}
	const resp = await fetchPost(`${followerUrl}/channel`, dummyVals.auth.leader, channel).then(r =>
		r.json()
	)
	t.equal(
		resp.message,
		'channel.validUntil should not be greater than one year',
		'should throw invalid validUntil error'
	)
	t.end()
})

tape('POST /channel: create channel', async function(t) {
	const channel = {
		...dummyVals.channel,
		id: dummyChannelId2,
		validUntil,
		spec: {
			...dummyVals.channel.spec,
			minPerImpression: '1',
			maxPerImpression: '1',
			withdrawPeriodStart,
			adUnits: [],
			targeting: [{ tag: 'gender_female', score: 17 }]
		}
	}

	await Promise.all([
		fetchPost(`${leaderUrl}/channel`, dummyVals.auth.leader, channel),
		fetchPost(`${followerUrl}/channel`, dummyVals.auth.follower, channel)
	])
		.then(res => Promise.all(res.map(item => item.json())))
		.then(function(data) {
			data.forEach(resp => {
				t.equal(resp.success, true, 'Successfully created channel')
			})
		})

	const channelStatus = await fetch(`${followerUrl}/channel/${channel.id}/status`).then(res =>
		res.json()
	)
	t.ok(channelStatus.channel, 'has channelStatus.channel')
	t.deepEqual(channelStatus.channel, channel, 'channel is the same')

	const respFail = await fetchPost(`${followerUrl}/channel`, dummyVals.auth.leader, channel)
	t.equal(respFail.status, 409, 'cannot submit the same channel twice')

	t.end()
})

tape('POST /channel: should not create channel if it is not valid', async function(t) {
	await Promise.all(
		[
			// does not have ID
			{
				creator: 'someone',
				depositAsset: 'DAI',
				depositAmount: '1000',
				spec: {
					validators: [
						{ id: 'awesomeLeader', url: 'http://localhost:8005', fee: '100' },
						{ id: 'awesomeFollower', url: 'http://localhost:8006', fee: '100' }
					]
				}
			},
			// does not have anything
			{
				id: 'awesomeTestChannel'
			},
			// does not have enough validators
			{
				id: 'test',
				creator: 'someone',
				depositAsset: 'DAI',
				depositAmount: '1000',
				spec: {
					validators: [
						{ id: 'awesomeLeader', url: 'http://localhost:8005' },
						{ id: 'awesomeFollower', url: 'http://localhost:8006' }
					]
				}
			},
			// more than 2 validators
			{
				id: 'test',
				creator: 'someone',
				depositAsset: 'DAI',
				depositAmount: '1000',
				spec: {
					validators: [
						{ id: 'awesomeLeader', url: 'http://localhost:8005', fee: '100' },
						{ id: 'awesomeFollower', url: 'http://localhost:8006', fee: '100' },
						{ id: 'awesomeFollower2', url: 'http://localhost:8006', fee: '100' }
					]
				}
			}
		].map(async function(channel) {
			const resp = await fetchPost(`${followerUrl}/channel`, dummyVals.auth.leader, channel)
			t.equal(resp.status, 400, 'status must be BadRequest')
			const err = await resp.json()
			t.ok(err.message, 'has error message')
		})
	)
	t.end()
})

tape(
	'POST /channel: should not create channel if it does not pass adapter validation',
	async function(t) {
		const resp = await fetchPost(`${followerUrl}/channel`, dummyVals.auth.leader, {
			...dummyVals.channel,
			id: '0x3d69a4d75d871e662e007e3b71bfeacb2d3f12186968df94382452e83c517599',
			depositAmount: '0',
			validUntil,
			spec: {
				...dummyVals.channel.spec,
				withdrawPeriodStart
			}
		})
		t.equal(resp.status, 400, 'status must be BadRequest')
		const err = await resp.json()
		t.equal(err.message, 'adapter validation not successful')
		t.end()
	}
)

// Test rate limits with the new channel that we created (dummyChannelId2)
// to not interfere with integration.js
tape('POST /channel/{id}/events: rate limits', async function(t) {
	const ev = { type: 'IMPRESSION', publisher: dummyVals.ids.publisher }
	const url = `${leaderUrl}/channel/${dummyChannelId2}/events`
	// We cannot submit many events
	const resp = await fetchPost(url, dummyVals.auth.user, { events: [ev, ev] })
	t.equal(resp.status, 429, 'status is TooManyRequests')

	// We can submit one
	const respOk = await fetchPost(url, dummyVals.auth.user, { events: [ev] })
	t.equal(respOk.status, 200, 'status is ok')

	// But we cannot submit one right after
	const respNotOk = await fetchPost(url, dummyVals.auth.user, { events: [ev] })
	t.equal(respNotOk.status, 429, 'status is TooManyRequests')

	// but the creator can submit whatever they want
	t.equal(
		(await fetchPost(url, dummyVals.auth.creator, { events: [ev, ev] })).status,
		200,
		'status is ok'
	)
	t.equal(
		(await fetchPost(url, dummyVals.auth.creator, { events: [ev] })).status,
		200,
		'status is ok'
	)

	t.end()
})

tape('should prevent submitting events for expired channel', async function(t) {
	const channel = {
		...dummyVals.channel,
		id: '0x93d068a2157a063f7749d4e98921a955618f04bae86d099cb8577f364077a0fb',
		validUntil: Math.ceil(Date.now() / 1000) + 1,
		spec: {
			...dummyVals.channel.spec,
			withdrawPeriodStart: Date.now() + 500
		}
	}

	// Submit a new channel; we submit it to both sentries to avoid 404 when propagating messages
	await Promise.all([
		fetchPost(`${leaderUrl}/channel`, dummyVals.auth.leader, channel),
		fetchPost(`${followerUrl}/channel`, dummyVals.auth.follower, channel)
	])

	// wait till channel expires
	await wait(2100)

	const resp = await postEvents(followerUrl, channel.id, genEvents(1)).then(r => r.json())
	t.equal(resp.message, 'channel is expired', 'should prevent events after validUntil')
	t.end()
})

tape('should prevent submitting events for a channel in withdraw period', async function(t) {
	const channel = {
		...dummyVals.channel,
		id: '0xe49831d1b9e1a83f6ba6b672c6ddaf045a975d7c3175fe1399c83dca5174c71c',
		validUntil: Math.floor(Date.now() / 1000) + 20,
		spec: {
			...dummyVals.channel.spec,
			withdrawPeriodStart: Date.now() + 1000
		}
	}

	// Submit a new channel; we submit it to both sentries to avoid 404 when propagating messages
	await Promise.all([
		fetchPost(`${leaderUrl}/channel`, dummyVals.auth.leader, channel),
		fetchPost(`${followerUrl}/channel`, dummyVals.auth.follower, channel)
	])

	// wait till withdrawPeriodStart
	await wait(1100)

	const resp = await postEvents(followerUrl, channel.id, genEvents(1)).then(r => r.json())
	t.equal(
		resp.message,
		'channel is past withdraw period',
		'should prevent events after withdraw period'
	)
	// @TODO we can still submit validator messages

	t.end()
})

tape('GET /analytics: should get channel analytics', async function(t) {
	const resp = await fetch(`${leaderUrl}/analytics`).then(res => res.json())
	t.ok(resp.aggr[0].value, 'has value')
	t.ok(resp.aggr[0].time, 'has time')
	t.equal(typeof resp.aggr[0].value, 'string', 'value of have type of string')
	t.ok(+resp.aggr[0].value > 0, 'should have aggregate value greater than 0')
	t.end()
})
