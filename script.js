'use strict';

// Quick & Dirty reference:
// no prefix: method
//  _ prefix: event handler
// __ prefix: variable

(function (wnd,doc,console,$) {
	(function () {
		// feature detection
		if (!(wnd.AudioContext || wnd.webkitAudioContext)
			|| !wnd.requestAnimationFrame
			|| !doc.querySelector) {
			wnd.addEventListener("load", this._onLoadNoFeatures.bind(this),false);
		} else {
			wnd.addEventListener("load", this._onLoad.bind(this),false);
		}
	}).call(
		{
			__startDate: null,
			__context: null,
			__interval: null,
			__introSource: null,
			__loopSource: null,
			__dragging: false,
			__dragStartY: null,
			__speedMultiplier: 1,
			__frameCount: 0,

			_onTwitterClick: function (e) {
				// update the Tweet text to reflect current time
				//
				var tweetPhrases = ["Sick beat","Tasty Jam"];

				var delta = new Date() - this.__startTime;
				var ms = delta % 1000;
				var seconds = (delta/1000)%60|0;
				var minutes = (delta/(60*1000))%60|0;
				var hours = (delta/(60*60*1000))|0;

				var tweetMessage = "Listened to this "
					+ tweetPhrases[this.__frameCount%2]
					+ " for "
					+ ((hours > 0) ? (hours.toString()+"h") : "")
					+ ((minutes > 0) ? (minutes.toString()+"m") : "")
					+ seconds.toString()
					+ "s!";

				e.target.href = 
					"https://twitter.com/share?text=" 
					+ encodeURIComponent(tweetMessage);
			},

			_onFacebookClick: function (e) {
				// Update href on facebook to reflect current URL
				// probably better as either a compile-time thing or a
				// onLoad thing, but maybe we'll use HTML5 history or
				// something.
				$("#fb").href = 
					"https://www.facebook.com/sharer/sharer.php?u="
					+ encodeURIComponent(wnd.location.href);
			},

			_onMouseDown: function (e) {
				if (e.target !== $("canvas")) {
					return;
				}
				this.__dragging = true;
				this._onMouseMove(e);
			},

			_onMouseUp: function (e) {
				this.__dragging = false;
				e.preventDefault();
			},

			_onMouseMove: function (e) {
				if (this.__dragging === false) {
					return;
				}
				this.__speedMultiplier = ((wnd.innerHeight- e.pageY) / wnd.innerHeight) * 2;
				this.__introSource.playbackRate.value = this.__speedMultiplier;
				this.__loopSource.playbackRate.value = this.__speedMultiplier;
				e.preventDefault();
			},

			addMouseListeners: function () {
				wnd.addEventListener("mousedown", this._onMouseDown.bind(this), false);
				wnd.addEventListener("mouseup", this._onMouseUp.bind(this), false);
				wnd.addEventListener("mousemove", this._onMouseMove.bind(this), false);
			},

			_onLoadNoFeatures : function () {
				console.error("We cannot proceed because a required feature is missing");
				doc.getElementsByClassName("H3")[0].innerHTML = 
					"DEVICE/BROWSER NOT SUPPORTED :-(";
			},

			_onLoad : function () {
				// display loading dots
				this.__interval = setInterval(this._loadOnInterval.bind(this),111);

				// set up Facebook click listener
				$("#fb").addEventListener("click", this._onFacebookClick.bind(this), false);

				// add tweet click listener
				$("#tw").addEventListener("click", this._onTwitterClick.bind(this), false);

				// allocate a context
				var AudioContext = wnd.AudioContext || wnd.webkitAudioContext;
				this.__context = new AudioContext();
				console.debug("Got a context");

				var source = this.__context.createBufferSource();

				var directory = "punkish";
				if (wnd.location.search.length > 0) {
					directory = wnd.location.search.substring(1);
				}
				var soundsToLoad = [directory+"/intro.ogg", directory+"/loop.ogg"];
				this.buffers = [null,null];
				this.scopeNode = this.__context.createAnalyser();
				this.scopeNode.connect(this.__context.destination);
				this.scopeNode.maxDecibels = -1;

				this.downloadSongMetaData(directory);

				soundsToLoad.forEach(function (name, i) {
					var req = new XMLHttpRequest();
					req.open('GET', name, true);
					req.responseType = 'arraybuffer';

					req.onload = function () {
						console.debug("Finished downloading", i==0 ? "intro" : "loop");
						this.__context.decodeAudioData(req.response, function (buffer) {
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
			},

			downloadSongMetaData : function (directory) {
				var req = new XMLHttpRequest();
				req.open('GET', directory+"/details.json", true);
				req.onload = function () {
					var data = JSON.parse(req.response);
					$("h2").innerHTML = data.title;
				}.bind(this);
				req.send();
			},

			updateTimer : function () {
				var delta = new Date() - this.__startTime;
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
				$("h3").innerHTML = [pad2(hours),pad2(minutes),pad2(seconds),pad3(ms)].join(":");
			},

			_loadOnInterval: function () {
				var dotSpan = $("h3 span");
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
			},

			_onAnimateFrame: function () {
				this.__frameCount++;
				this.updateTimer();
				this.renderCanvas();
				wnd.requestAnimationFrame(this._onAnimateFrame.bind(this));
			},

			computeGradient : function (startColor,endColor,percent) {
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
			},

			renderCanvas : function () {
				var canvas = $('canvas');
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

				var middle = height/2;
				ctx.beginPath();
				ctx.lineWidth = 2;
				ctx.strokeStyle = "#000";

				// if we have more width than datapoints, draw per datapoint.
				// otherwise, draw per pixel.
				if (width > timeByteData.length) {
					for (i = 0; i < timeByteData.length; i++) {
						var pixel = Math.round(width*i/timeByteData.length);
						var y = middle + timeByteData[i]/256 * middle;
						if (i==0) {
							ctx.moveTo(pixel,y);
						}
						ctx.lineTo(pixel,y);
					}
				} else {
					// more datapoints than pixels
					for (i = 0; i < width; i++) {
						// we can't show everything, so just show what we have
						var y = middle + timeByteData[i]/256 * middle;
						if (i==0) {
							ctx.moveTo(i,y);
						}
						ctx.lineTo(i,y);
					}
				}

				ctx.stroke();

				if (this.__speedMultiplier !== 1 || this.__dragging === true) {
					ctx.beginPath();
					var y = height - height*(this.__speedMultiplier/2);
					ctx.strokeStyle = "#711";
					ctx.moveTo(0,y);
					ctx.lineTo(width,y);
					ctx.stroke();
					ctx.font = '22px Monospace';
					ctx.fillStyle = "#711";
					ctx.fillText("SPEED MULT: " + this.__speedMultiplier.toFixed(4),10,y-10);
				}
			},

			startPlayback : function () {
				this.__introSource = this.__context.createBufferSource();
				this.__loopSource = this.__context.createBufferSource();

				this.__introSource.buffer = this.buffers[0];
				this.__loopSource.buffer = this.buffers[1];

				this.__loopSource.connect(this.scopeNode);
				this.__introSource.connect(this.scopeNode);

				this.__loopSource.loop = true;
				this.__introSource.start(this.__context.currentTime);
				this.__loopSource.start(this.__context.currentTime+this.__introSource.buffer.duration);
				this.__startTime = new Date();
				clearInterval(this.__interval);
				requestAnimationFrame(this._onAnimateFrame.bind(this));
				setTimeout(this.addMouseListeners.bind(this),this.__introSource.buffer.duration*1000);
			}
		}
	);
}).call(
	null,
	window,
	document,
	console || { log: function(){},debug: function (){}, warn: function(){}, error: function () {}},
  (document.querySelector || function (){}).bind(document)
);
