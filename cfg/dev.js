module.exports = {
	MAX_CHANNELS: 512,
	WAIT_TIME: 1000,
	AGGR_THROTTLE: 0,
	HEARTBEAT_TIME: 30000,
	CHANNELS_FIND_LIMIT: 200,
	EVENTS_FIND_LIMIT: 100,
	EVENTS_FIND_LIMIT_BY_CHANNEL_SEGMENT: 100 * 25, // Market `maxChannelsEarningFrom=25`
	MSGS_FIND_LIMIT: 10,
	HEALTH_THRESHOLD_PROMILLES: 950,
	HEALTH_UNSIGNABLE_PROMILLES: 750,
	PROPAGATION_TIMEOUT: 5000,
	FETCH_TIMEOUT: 5000,
	LIST_TIMEOUT: 5000,
	VALIDATOR_TICK_TIMEOUT: 5000,
	IP_RATE_LIMIT: { type: 'ip', timeframe: 20000 },
	SID_RATE_LIMIT: { type: 'sid', timeframe: 20000 },
	CREATORS_WHITELIST: [],
	MINIMAL_DEPOSIT: 0,
	MINIMAL_FEE: 0,
	ETHEREUM_CORE_ADDR: '0x333420fc6a897356e69b62417cd17ff012177d2b',
	ETHEREUM_NETWORK: 'goerli',
	ETHEREUM_ADAPTER_RELAYER: 'https://goerli-relayer.adex.network',
	VALIDATORS_WHITELIST: [],
	CHANNEL_REFRESH_INTERVAL: 1000
}
