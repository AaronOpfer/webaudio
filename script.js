'use strict';

window.addEventListener('load', (function (wnd,doc,console) {
	var AudioContext = wnd.AudioContext || wnd.webkitAudioContext;
	if (!AudioContext || !requestAnimationFrame) {
		console.log("Failed initialization");
		doc.querySelector("h3").innerHTML = "DEVICE/BROWSER NOT SUPPORTED :-(";
		return;
	}
	var context = new AudioContext();
	console.debug("Got a context");

	var source = context.createBufferSource();

	var soundsToLoad = ["intro.ogg", "loop.ogg"];
	this.buffers = [null,null];
	this.scopeNode = context.createAnalyser();
	this.scopeNode.connect(context.destination);
	this.scopeNode.maxDecibels = -1;

	this.computeGradient = function (startColor,endColor,percent) {
		var r1 = startColor >> 16,
		g1 = (startColor >> 8) & 0xFF,
		b1 = startColor & 0xFF,
		r2 = endColor >> 16,
		g2 = (endColor >> 8) & 0xFF,
		b2 = endColor & 0xFF;

		return "rgb(" +
			(0|(percent*r1 + (1-percent)*r2)).toString() + ',' +
			(0|(percent*g1 + (1-percent)*g2)).toString() + ',' +
			(0|(percent*b1 + (1-percent)*b2)).toString() + ')';
	};

	this.updateTimer = function () {
		var delta = new Date() - this.startTime;
		var ms = delta % 1000;
		var seconds = (delta/1000)%60|0;
		var minutes = (delta/(60*1000))%60|0;
		var hours = (delta/(60*60*1000))|0;

		function pad2(x) {
			return x < 10 ? "0"+x.toString() : x.toString();
		}

		function pad3(x) {
			return x < 100 ? x < 10 ? "00"+x.toString() : "0"+x.toString() : x.toString();
		}
		doc.querySelector("h3").innerHTML = [pad2(hours),pad2(minutes),pad2(seconds),pad3(ms)].join(":");
	};

	var interval = setInterval(function () {
			var dotSpan = doc.querySelector("h3 span");
			if (!dotSpan) {
				return;
			}
			switch (dotSpan.innerHTML) {
				case "&nbsp;&nbsp;&nbsp;":
				case "&nbsp;&nbsp;.":
					dotSpan.innerHTML = ".&nbsp;&nbsp;";
					break;

				case "&nbsp;.&nbsp;":
					dotSpan.innerHTML = "&nbsp;&nbsp;.";
					break;

				case ".&nbsp;&nbsp;":
					dotSpan.innerHTML = "&nbsp;.&nbsp;";
					break;
			}
		},100);


	this.renderCanvas = function () {
		this.updateTimer();
		var canvas = document.querySelector('canvas');
		var ctx = canvas.getContext('2d');
		var width = canvas.width = wnd.innerWidth;
		var height = canvas.height = wnd.innerHeight;
		var barWidth = 10;

		ctx.clearRect(0, 0, width, height);

		var freqByteData = new Uint8Array(this.scopeNode.frequencyBinCount);
		this.scopeNode.getByteFrequencyData(freqByteData);

		
		var barCount = Math.round(width / barWidth);
		for (var i = 0; i < barCount; i++) {
			var magnitude = freqByteData[i];
			ctx.fillStyle = this.computeGradient(0x0000FF,0x000077,1-(magnitude/355));
			ctx.fillRect(barWidth * i, height, barWidth - 2, -(magnitude/255*height));
		}

		var timeByteData = new Uint8Array(this.scopeNode.frequencyBinCount);
		this.scopeNode.getByteTimeDomainData(timeByteData);

		barWidth /=3;
		barCount *=3;
		
		var middle = height/2;
		ctx.lineWidth = 2;
		ctx.strokeStyle = "#000";

		for (i = 0; i < barCount; i++) {
			var x = i * barWidth+5;
			var y = middle + +timeByteData[Math.round(timeByteData.length/barCount) * i]/128 * (middle/2);
			if (i == 0) {
				ctx.moveTo(x,y);
			}
			ctx.lineTo(x,y);
		}
	
		ctx.stroke();
		requestAnimationFrame(this.renderCanvas.bind(this));

	};


	this.startPlayback = function () {
		var introSource = context.createBufferSource();
		var loopSource = context.createBufferSource();

		introSource.buffer = this.buffers[0];
		loopSource.buffer = this.buffers[1];

		loopSource.connect(this.scopeNode);
		introSource.connect(this.scopeNode);


		loopSource.loop = true;
		introSource.start(context.currentTime);
		loopSource.start(context.currentTime+introSource.buffer.duration);
		this.startTime = new Date();
		clearInterval(interval);
		requestAnimationFrame(this.renderCanvas.bind(this));
	};

	soundsToLoad.forEach(function (name, i) {
		var req = new XMLHttpRequest();
		req.open('GET', name, true);
		req.responseType = 'arraybuffer';

		req.onload = function () {
			console.debug("Finished downloading", i==0 ? "intro" : "loop");
			context.decodeAudioData(req.response, function (buffer) {
				console.debug("Finished decoding", i==0 ? "intro" : "loop");
				this.buffers[i] = buffer;
				if (this.buffers[0] && this.buffers[1]) {
					console.debug("All decoded, starting playback");
					wnd.requestAnimationFrame(this.startPlayback.bind(this));
				}
			}.bind(this));
		}.bind(this);
		req.send();
	}, this);
}).bind({},window,document,console || { log: function(){},debug: function (){}, warn: function(){}, error: function () {}}),false);
