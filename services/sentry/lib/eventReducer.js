const BN = require('bn.js')
const assert = require('assert')

function newAggr(channelId) {
	return { channelId, created: new Date(), events: {} }
}

function reduce(channel, initialAggr, ev) {
	const aggr = { ...initialAggr }

	if (ev.type === 'IMPRESSION') {
		aggr.events.IMPRESSION = mergeEv(initialAggr.events.IMPRESSION, ev, channel)
	}

	if (ev.type === 'IMPRESSION_WITH_COMMISSION') {
		ev.earners.forEach(earner => {
			aggr.events.IMPRESSION = mergeEv(initialAggr.events.IMPRESSION, earner, channel)
		})
	}

	if (ev.type === 'CLOSE') {
		const { creator, depositAmount } = channel
		aggr.events.CLOSE = {
			eventCounts: {
				[creator]: new BN(1).toString()
			},
			eventPayouts: {
				[creator]: depositAmount
			}
		}
	}

	if (ev.type === 'PAY') {
		const { outputs } = ev
		const publishers = Object.keys(outputs)
		publishers.forEach(publisher => {
			aggr.events.PAY = mergeEv(
				initialAggr.events.PAY,
				{ publisher, output: outputs[publisher] },
				channel
			)
		})
	}

	if (ev.type === 'UPDATE_IMPRESSION_PRICE') {
		const price = new BN(ev.price, 10)
		assert.ok(isPriceOk(price, channel), 'invalid price per impression')
	}

	return aggr
}
// price must be within the min and max price impression
function isPriceOk(price, channel) {
	const minPrice = new BN(channel.spec.minPerImpression, 10)
	const maxPrice = new BN(channel.spec.maxPerImpression, 10)

	return price.gte(minPrice) && price.lte(maxPrice)
}

function mergeEv(initialMap = { eventCounts: {}, eventPayouts: {} }, ev, channel) {
	const map = {
		eventCounts: { ...initialMap.eventCounts },
		eventPayouts: { ...initialMap.eventPayouts }
	}

	const price = new BN(channel.currentPricePerImpression || channel.spec.minPerImpression, 10)
	assert.ok(isPriceOk(price, channel), 'invalid price per impression')

	if (typeof ev.publisher !== 'string') return map

	const eventCountKey = ev.adUnit ? `${ev.publisher}:${ev.adUnit}` : ev.publisher
	if (!map.eventCounts[eventCountKey]) map.eventCounts[eventCountKey] = new BN(0)
	if (!map.eventPayouts[ev.publisher]) map.eventPayouts[ev.publisher] = new BN(0)

	// if its a pay event which requires output key
	// do not increase event count
	// else increase the event count
	if (!ev.output) {
		const newEventCounts = new BN(map.eventCounts[eventCountKey], 10)
		map.eventCounts[eventCountKey] = addAndToString(newEventCounts, new BN(1))
	} else {
		const newEventCounts = new BN(map.eventCounts[eventCountKey], 10)
		map.eventCounts[eventCountKey] = addAndToString(newEventCounts, new BN(0))
	}

	// current publisher payout
	const currentAmount = new BN(map.eventPayouts[ev.publisher], 10)
	// check if promilles is set that means payout
	// a percentage of the currentAmount to the publisher
	if (ev.promilles) {
		const publisherAmount = price.mul(new BN(ev.promilles, 10)).div(new BN(1000, 10))
		map.eventPayouts[ev.publisher] = addAndToString(currentAmount, publisherAmount)
	} else {
		// add the output if set (pay event) else
		// add the price per impression
		// to the current eventPayouts for the publisher
		map.eventPayouts[ev.publisher] = addAndToString(
			currentAmount,
			(ev.output && new BN(ev.output, 10)) || price
		)
	}
	return map
}

function addAndToString(first, second) {
	return first.add(second).toString(10)
}

module.exports = { newAggr, reduce }
