
var DISCRETE = 0;
var CONTINUOUS = 1;

/**
 *
 * @classdesc Recorder
 * It allows to record and play object properties.
 * The recording/playing is done on every update event emitted by a sampler
 * with respect to the duration of time elapsed since last update
 *
 */

function Recorder() {
	this._sampler = null;
	this._objectSamples = {};
	this._timeStamps = [];
	this._sampleIdx = 0;
	this._playingHead = 0;

	this._mode = 'none';
	this._state = 'idle';

	this._propertyOptions = {};

	var self = this;
	this._doRecord = function (speed) {
		self._record(speed);
	};
	this._doPlay = function (speed) {
		self._play(speed);
	};
}
module.exports = Recorder;

Recorder.prototype.record = function (sampler, objects) {
	// Initialization of the recorder
	this._mode = 'recorder';
	this._objectSamples = {};
	this._timeStamps = [];
	this._sampler = sampler;
	this._sampleIdx = 0;
	this._playingHead = 0;

	// Initialization of the samples
	for (var o = 0; o < objects.length; o += 1) {
		var properties = objects[o].properties;
		var object = objects[o].object;
		var id = objects[o].id;
		var samples = {};
		var sampleTypes = {};
		this._objectSamples[id] = { recordedObject: object, playedObject: object, samples: samples, sampleTypes: sampleTypes };
		for (var p = 0; p < properties.length; p += 1) {
			// Initialization of the array of samples
			var property = properties[p];
			samples[property.name] = [];
			sampleTypes[property.name] = (property.type === undefined) ? DISCRETE : ((property.type === 'continuous') ? CONTINUOUS : DISCRETE);
		}
	}

	this._startRecording();
};

Recorder.prototype._record = function (elapsedTime) {

	for (var id in this._objectSamples) {
		var objectSample = this._objectSamples[id];
		var object = objectSample.recordedObject;
		var samples = objectSample.samples;
		for (var property in samples) {
			samples[property][this._sampleIdx] = object[property];
		}
	}

	this._playingHead += elapsedTime;
	this._timeStamps[this._sampleIdx] = this._playingHead;
	this._sampleIdx += 1;
};

Recorder.prototype.play = function (sampler, maps) {
	// Initialization of the player
	this._mode = 'player';
	this._sampler = sampler;
	this._sampleIdx = 0;
	this._playingHead = 0;

	// Overwriting played objects with respect to the maps
	for (var m = 0; m < maps.length; m += 1) {
		var map = maps[m];
		this._objectSamples[map.id].playedObject = map.object;
	}

	this._startPlaying();
};

Recorder.prototype._play = function (playingHead) {

	this._playingHead = playingHead;

	// Finding the sample index for the current playing head position
	if (playingHead < this._timeStamps[this._sampleIdx]) {
		while (playingHead < this._timeStamps[this._sampleIdx]) {
			this._sampleIdx -= 1;

			if (this._sampleIdx === -1) {
				if (playingHead < 0) {
					playingHead = 0;
				}
				this._sampleIdx = 0;
				break;
			}
		}
	}

	if (this._timeStamps[this._sampleIdx + 1] < playingHead) {
		while (this._timeStamps[this._sampleIdx + 1] < playingHead) {
			this._sampleIdx += 1;

			if (this._sampleIdx === this._timeStamps.length - 1) {
				playingHead = this._timeStamps[this._sampleIdx];
				this._sampleIdx = this._timeStamps.length - 2;
				break;
			}
		}
	}
	var idx = this._sampleIdx;

	// for continuous values (interpolated)
	var nextIdx = this._sampleIdx + 1;
	var t = (this._timeStamps[nextIdx] - playingHead) / (this._timeStamps[nextIdx] - this._timeStamps[idx]);
	var u = 1 - t;

	var nObjs = this._objectSamples.length;
	for (var id in this._objectSamples) {
		var objectSample = this._objectSamples[id];
		var object = objectSample.playedObject;
		var samples = objectSample.samples;
		var sampleTypes = objectSample.sampleTypes;
		for (var property in samples) {

			if (sampleTypes[property] === DISCRETE) {
				object[property] = samples[property][idx];
			} else {
				object[property] = t * samples[property][idx] + u * samples[property][nextIdx];
			}
		}
	}
};

Recorder.prototype.getMode = function () {
	return this._mode;
};

Recorder.prototype.getState = function () {
	return this._state;
};

Recorder.prototype._startRecording = function () {
	// First record at time 0
	this._record(0);

	this._sampler.on('update', this._doRecord);
	this._state = 'recording';
};

Recorder.prototype._startPlaying = function () {
	// First play at time 0
	this._play(0);

	this._sampler.on('update', this._doPlay);
	this._state = 'playing';
};

Recorder.prototype.pause = function () {
	if (this._state === 'idle') {
		return;
	}

	this._state = 'paused';

	if (this._mode === 'recorder') {
		this._sampler.removeListener('update', this._doRecord);
	}

	if (this._mode === 'player') {
		this._sampler.removeListener('update', this._doPlay);
	}
};

Recorder.prototype.resume = function () {
	if (this._state !== 'paused') {
		return;
	}

	if (this._mode === 'recorder') {
		this._startRecording();
	}

	if (this._mode === 'player') {
		this._startPlaying();
	}
};

Recorder.prototype.stop = function () {
	this._mode = 'none';
	this._state = 'idle';

	if (this._mode === 'recorder') {
		this._sampler.removeListener('update', this._doRecord);
	}

	if (this._mode === 'player') {
		this._sampler.removeListener('update', this._doPlay);
	}
};
