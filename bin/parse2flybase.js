#!/usr/bin/env node

var flybase = require('flybase'),
	optimist = require('optimist'),
	ProgressBar = require('progress'),
	assert = require('assert'),
	path = require('path');
	util = require('util');

// We try to write data in ~1MB chunks (in reality this often ends up being much smaller, due to the JSON structure).
var CHUNK_SIZE = 1024*1024;

// Keep ~50 writes outstanding at a time (this increases throughput, so we're not delayed by server round-trips).
var OUTSTANDING_WRITE_COUNT = 50; 

var argv = require('optimist')
	.usage('Usage: $0')

	.demand('flybase_key')
	.describe('flybase_key', 'Flybase API Key.')
	.alias('k', 'flybase_key')

	.demand('flybase_app')
	.describe('flybase_app', 'Flybase App Name.')
	.alias('a', 'flybase_app')

	.demand('flybase_collection')
	.describe('flybase_collection', 'Flybase Collection Name.')
	.alias('c', 'flybase_collection')

	.demand('json')
	.describe('json', 'The JSON file to import.')
	.alias('j', 'json')

	.boolean('merge')
	.describe('merge', 'Write the top-level children without overwriting the whole parent.')
	.alias('m', 'merge')

	.boolean('force')
	.describe('force', 'Don\'t prompt before overwriting data.')

	.argv;

function main() {
	var ref = flybase.init(argv.flybase_app, argv.flybase_collection, argv.flybase_key );

	var connFailTimeout = setTimeout(function() {
		console.log('Failed to connect to Flybase.');
		process.exit();
	}, 10000);

	function ready() {
		clearTimeout(connFailTimeout);
		promptToContinue(ref, function() { start(ref); });
	}

	ready();
}

function promptToContinue(ref, next) {
	if (argv.force) {
		next();
	} else {
		if (argv.merge) {
			console.log('Each document in ' + argv.json + ' will be written under ' + ref.toString() + '.  If a document already exists, it will be overwritten.');
		} else {
			console.log('All data at ' + ref.toString() + ' will be overwritten.');
		}
		console.log('Press <enter> to proceed, Ctrl-C to abort.');
		process.stdin.resume();
		process.stdin.once('data', next);
	}
}

function start(ref) {
	var file = path.resolve(argv.json);
	console.log('Reading ' + file + '... (may take a minute)');
	var json = require(file);
	var json = json.results;

	var clearFirst = true, splitTopLevel = false;
	if (argv.merge) {
		clearFirst = false;
		// Need to split into chunks at the top level to ensure we don't overwrite the parent.
		splitTopLevel = true;
	}

	console.log('Preparing JSON for import... (may take a minute)');
	var chunks = createChunks(ref, json, splitTopLevel);

	if (clearFirst) {
		//	drop collection..
		ref.drop( function(obj, error) {
			uploadChunks(chunks);
		});
	} else {
		uploadChunks(chunks);
	}
}

function uploadChunks(chunks) {
	var uploader = new ChunkUploader(chunks);
	uploader.go(function() {
		console.log('\nImport completed.');
		process.exit();
	});
}

function createChunks(ref, json, forceSplit) {
	var chunkRes = chunkInternal(ref, json, forceSplit);
	if (!chunkRes.chunks) {
		return [{ref: ref, json: json}];
	} else {
		return chunkRes.chunks;
	}
}

function chunkInternal(ref, json, forceSplit) {
	var size = 0;
	var priority = null;
	var jsonIsObject = json !== null && typeof json === 'object';
	if (jsonIsObject) {
		size += 2; // {}
	}

	var value = json;

	if (value === null || typeof value !== 'object') {
		size += JSON.stringify(value).length;
		return { chunks: null, size: size };
	} else {
		// children node.
		var chunks = [];
		var splitUp = false;
		for(var key in json) {
			size += key.length + 3;
		}
		if (forceSplit || splitUp || size >= CHUNK_SIZE) {
			return { chunks: chunks, size: size };
		} else {
			return { chunks: null, size: size }
		}
	}
}

function ChunkUploader(chunks) {
	this.next = 0;
	this.chunks = chunks;
	this.bar = new ProgressBar(
		'Importing [:bar] :percent (:current/:total)', 
		{ width: 50, total: chunks.length, incomplete: ' ' }
	);
}

ChunkUploader.prototype.go = function(onComplete) {
	this.onComplete = onComplete;

	for(var i = 0; i < OUTSTANDING_WRITE_COUNT && i < this.chunks.length; i++) {
		this.uploadNext();
	}
};

ChunkUploader.prototype.uploadNext = function() {
	var chunkNum = this.next, chunk = this.chunks[chunkNum];
	assert(chunkNum < this.chunks.length);
	this.next++;

	var self = this;
	var onComplete = function(result, error) {
		if (error) { 
			console.log('Error uploading to ' + self.chunks[i].ref.toString() + ': ' + util.inspect(json));
			console.error(error);
			throw error; 
		}

		self.bar.tick();

		if (chunkNum === self.chunks.length - 1) {
			self.onComplete();
		} else {
			// upload next chunk.
			assert(self.next === self.chunks.length || self.next === chunkNum + OUTSTANDING_WRITE_COUNT);
			if (self.next < self.chunks.length)
				self.uploadNext();
		}
	};

	chunk.ref.set(chunk.json, onComplete);
}

main();
