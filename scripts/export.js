#!/usr/bin/env node

/* 
Description
------------------------------------
Exports event aggregates to Google BigQuery for better analytics.


Database
------------------------------------
Default database it connects to is `adexValidator`
but can be overwritten via the `DB_MONGO_NAME` environment variable


Options
------------------------------------
--channelId (required) prunes heartbeat validator messages for an unexpired channel and all validator messages for expired channel
--timestamp ( default = current date ) should be used with `--channelId` to indicate when to prune validator messages from
--all (optional) prune all expired channels validator messages



Example
----------------------------------------

Prune validator messages from `expiredChannel` in database X
DB_MONGO_NAME='x' ./scripts/prune.js --channelId='expiredChannel'

Prune validator messages from a specific date
./scripts/prune.js --timestamp='2012-01-01' --channelId='testing'

Delete validator Messages for epxired channel
./scripts/prune.js --channelId='testing'

Prune validator messages for all expired channels
./scripts/prune.js --all
 */

// const assert = require('assert')
const yargs = require('yargs')
const { BigQuery } = require('@google-cloud/bigquery')
const db = require('../db')
const logger = require('../services/logger')('export-bigquery')

const { argv } = yargs
	.usage('Usage $0 [options]')
	.option('channelId')
	.describe('channelId', 'channelId to prune')
	.option('datasetId')
	.describe('datasetId', 'Google bigquery dataset to connect to')
	.default('datasetId', 'adexEventAggregates')
	.option('tableId')
	.describe('tableId', 'table id to connect to, default is channelId')
	.option('date')
	.describe(
		'date',
		'Date range to export to bigquery. e.g. 2019/01/02-2019-03/05. Single argument for till present "2019-02-03" '
	)
	.boolean('create')
	.describe(
		'create',
		'Creates the dataset on BigQuery else assumes the dataset exists on Bigquery. Uses datasetId is specified else channelId to create dataset'
	)

const bigquery = new BigQuery()

async function exportData() {
	db.connect().then(async () => {
		const { channelId, datasetId, tableId, date, create } = argv
		const query = { channelId }

		if (create) {
			await createDataset(datasetId)
		}
		if (date) {
			const [minDate, maxDate = new Date()] = date.split('-')
			query.created = {
				$gte: new Date(minDate).toISOString(),
				$lte: new Date(maxDate).toISOString()
			}
		}
		const eventAggregateCol = db.getMongo().collection('eventAggregates')
		const data = await eventAggregateCol.find(query).toArray()
		await insertRowsAsStream(data, datasetId, tableId || channelId)
	})
}

async function createDataset(datasetId) {
	// Specify the geographic location where the dataset should reside
	const options = {
		location: 'US'
	}

	// Create a new dataset
	const [dataset] = await bigquery.createDataset(datasetId, options)
	logger.info(`Dataset ${dataset.id} created`)
	return dataset.id
}

async function insertRowsAsStream(rows, datasetId, tableId) {
	// Insert data into a table
	await bigquery
		.dataset(datasetId)
		.table(tableId)
		.insert(rows)
	logger.info(`Inserted ${rows.length} rows`)
}

exportData().then(function() {
	logger.info('finished exporting data')
})
