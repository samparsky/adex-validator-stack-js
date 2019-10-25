const db = require('../db')

function channelLoad(req, res, next) {
	const { id } = req.params
	const channelsCol = db.getMongo().collection('channels')

	channelsCol
		.find({ _id: id }, { projection: { _id: 0 } })
		.toArray()
		.then(function(channels) {
			if (!channels.length) {
				res.status(404).json(null)
			} else {
				req.channel = channels[0]
				next()
			}
		})
		.catch(next)
}

function channelIfFind(cond, req, res, next) {
	const channelsCol = db.getMongo().collection('channels')
	channelsCol
		.countDocuments(cond, { limit: 1 })
		.then(function(n) {
			if (!n) {
				res.status(404).json({"error": "no id"})
			} else {
				next()
			}
		})
		.catch(next)
}

function channelIfExists(req, res, next) {
	channelIfFind({ _id: req.params.id }, req, res, next)
}

function channelIfActive(req, res, next) {
	channelIfFind({ _id: req.params.id, 'spec.validators.id': req.whoami }, req, res, next)
}

module.exports = { channelLoad, channelIfExists, channelIfActive }
