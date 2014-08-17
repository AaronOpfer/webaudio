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
			__startTime: null,
			__context: null,
			__interval: null,
			__introSource: null,
			__loopSource: null,
			__scopeNode: null,
			__gainNode: null,
			__dragging: false,
			__speedMultiplier: 1,
			__frameCount: 0,
			__peakData: null,
			__primaryColor: "#000077",
			__secondaryColor: "#0000FF",
			__directory: null,
			__introEndTime: null,

			/**
			 * Handles the user selecting a different song from the dropdown list.
			 */
			_onSongChange: function (e) {
				var newSong = e.target.value;
				if (newSong === this.__directory) {
					return;
				}
				this.__gainNode.gain.linearRampToValueAtTime(1,this.__context.currentTime);
				this.__gainNode.gain.linearRampToValueAtTime(0,this.__context.currentTime+0.2);
				this.__startTime = null;
				this.loadDirectory(newSong);
			},

			/**
			 * Called when the twitter share button is clicked, and updates
			 * the URL so that the tweet contains the current timestamp.
			 */
			_onTwitterClick: function (e) {
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

			/**
			 * Called when the facebook link is clicked. Puts the correct URL
			 * in the link.
			 */
			_onFacebookClick: function (e) {
				// Update href on facebook to reflect current URL
				// probably better as either a compile-time thing or a
				// onLoad thing, but maybe we'll use HTML5 history or
				// something.
				$("#fb").href = 
					"https://www.facebook.com/sharer/sharer.php?u="
					+ encodeURIComponent(wnd.location.href);
			},

			/**
			 * The user has initated a change in playback speed.
			 */
			_onMouseDown: function (e) {
				if (e.which !== 1 || // only work for leftclick
						e.target !== $("canvas") || 
						this.__context.currentTime < this.__introEndTime) {
					return;
				}
				this.__dragging = true;
				this._onMouseMove(e);
			},

			/**
			 * The user has stopped changing the playback speed.
			 */
			_onMouseUp: function (e) {
				this.__dragging = false;
				e.preventDefault();
			},

			/**
			 * Called when the mouse is moved in order to change the playback
			 * speed.
			 */
			_onMouseMove: function (e) {
				if (this.__dragging === false) {
					return;
				}
				this.__speedMultiplier = ((wnd.innerHeight- e.pageY) / wnd.innerHeight) * 2;
				this.__introSource.playbackRate.value = this.__speedMultiplier;
				this.__loopSource.playbackRate.value = this.__speedMultiplier;
				e.preventDefault();
			},

			/**
			 * Adds event listeners to the window for changing the playback
			 * speed. This lives in a separate function because these are not
			 * active right away. They are added once the intro segment has
			 * finished to prevent timing problems.
			 */
			addMouseListeners: function () {
				wnd.addEventListener("mousedown", this._onMouseDown.bind(this), false);
				wnd.addEventListener("mouseup", this._onMouseUp.bind(this), false);
				wnd.addEventListener("mousemove", this._onMouseMove.bind(this), false);
			},

			/**
			 * Called if any features that we require are missing from the
			 * browser.
			 */
			_onLoadNoFeatures : function () {
				console.error("We cannot proceed because a required feature is missing");
				doc.getElementsByTagName("H3")[0].innerHTML =
					"DEVICE/BROWSER NOT SUPPORTED :-(";
			},

			/**
			 * Initializes virtually everything, esp. the audio contexts and
			 * most event listeners.
			 */
			_onLoad : function () {
				// set up Facebook click listener
				$("#fb").addEventListener("click", this._onFacebookClick.bind(this), false);

				// add tweet click listener
				$("#tw").addEventListener("click", this._onTwitterClick.bind(this), false);

				// add song change listener
				$("#directory").addEventListener("change", this._onSongChange.bind(this), false);

				requestAnimationFrame(this._onAnimateFrame.bind(this));

				// allocate a context
				var AudioContext = wnd.AudioContext || wnd.webkitAudioContext;
				this.__context = new AudioContext();
				console.debug("Got a context");

				// Make the pluming
				this.__scopeNode = this.__context.createAnalyser();
				this.__gainNode = this.__context.createGain();
				this.__gainNode.connect(this.__scopeNode);
				this.__scopeNode.connect(this.__context.destination);
				this.__scopeNode.maxDecibels = -1;

				var directory = "punkish";
				if (wnd.location.search.length > 0) {
					directory = wnd.location.search.substring(1);
				}
				this.loadDirectory(directory);
			},

			/**
			 * Starts the loading of the given musical selection
			 */
			loadDirectory: function (directory) {
				$('h3').innerHTML = "LOADING<SPAN id=dots>&nbsp;&nbsp;&nbsp;</SPAN>";
				// display loading dots
				this.__interval = setInterval(this._loadOnInterval.bind(this),111);

				this.__directory = directory;
				var soundsToLoad = [this.__directory+"/intro.ogg", this.__directory+"/loop.ogg"];
				this.buffers = [null,null];

				this.downloadSongMetaData(this.__directory);

				this.__loadingRequests = soundsToLoad.map(function (name, i) {
					var req = new XMLHttpRequest();
					req.open('GET', name, true);
					req.responseType = 'arraybuffer';

					req.onload = function () {
						if (req.status >= 400 && req.status <= 600) {
							return req.onerror();
						}
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

					req.onerror = function () {
						clearInterval(this.__interval);
						$('h3').innerHTML = "NETWORK ERROR :-(";
						this.__loadingRequests.forEach(function (xhr) { xhr.abort(); });
					}.bind(this);

					req.send();
					return req;
				}, this);
			},

			/**
			 * Downloads metadata related to the current song. Currently this
			 * is just the song title.
			 *
			 * @param directory {String} The subdirectory representing the song
			 *  whose metadata needs to be retrieved.
			 */
			downloadSongMetaData : function (directory) {
				var req = new XMLHttpRequest();
				req.open('GET', directory+"/details.json", true);
				req.onload = function () {
					var data = JSON.parse(req.response);
					$("#song").innerHTML = data.title;
					if ('colors' in data) {
						this.__primaryColor = data.colors.primary;
						this.__secondaryColor = data.colors.secondary;
					} else {
						this.__primaryColor = "#000077";
						this.__secondaryColor = "#0000FF";
					}

				}.bind(this);
				req.send();
			},

			/**
			 * Renders the timer (HTML element) that shows how long the user
			 * has been listening for
			 */
			updateTimer : function () {
				if (!this.__startTime) {
					return;
				}
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

			/**
			 * Prints a moving loading dot while content is being loaded and
			 * decoded.
			 */
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

			/**
			 * Dispatcher for on-frame-rendering activities.
			 */
			_onAnimateFrame: function () {
				this.__frameCount++;
				this.updateTimer();
				this.renderCanvas();
				wnd.requestAnimationFrame(this._onAnimateFrame.bind(this));
			},

			/**
			 * Computes a CSS color that is percent between startColor and
			 * endColor.
			 *
			 * @param startColor {Integer} the start color. Notice that this
			 *   is not a string. (0xFF00FF okay, "#FF00FF" is not)
			 * @param endColor {Integer} the end color.
			 * @param percent {Float} Value between 0.0 and 1.0.
			 */
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

			/**
			 * Renders the canvas element. This incldes a frequency band graph
			 * as well as an oscilliator.
			 */
			renderCanvas : function () {
				var canvas = $('canvas');
				var ctx = canvas.getContext('2d');
				var width = canvas.width = wnd.innerWidth;
				var height = canvas.height = wnd.innerHeight;
				var barWidth = 10;
				var barCount = Math.round(width / barWidth);

				ctx.clearRect(0, 0, width, height);

				var freqByteData = new Uint8Array(this.__scopeNode.frequencyBinCount);
				this.__scopeNode.getByteFrequencyData(freqByteData);

				if (!this.__peakData || this.__peakData.length !== barCount) {
					this.__peakData = Array(barCount);
				}
				
				for (var i = 0; i < barCount; i++) {
					var magnitude = freqByteData[i];
					ctx.fillStyle = this.computeGradient(
							parseInt(this.__secondaryColor.substring(1),16),
							parseInt(this.__primaryColor.substring(1),16),
							1-(magnitude/355)); // 355 keeps bars away from text
					ctx.fillRect(barWidth * i, height, barWidth - 2, -(magnitude/255*height));
					if (!this.__peakData[i] || magnitude > this.__peakData[i]) {
						this.__peakData[i] = magnitude;
					} else {
						this.__peakData[i]-= 1 + (this.__frameCount%3==1); // descend at 1.33
					}
					ctx.fillRect(barWidth * i, height-this.__peakData[i]/255*height, barWidth -2, 2);
				}

				var timeByteData = new Uint8Array(this.__scopeNode.frequencyBinCount);
				this.__scopeNode.getByteTimeDomainData(timeByteData);

				var middle = height/2;
				ctx.beginPath();
				ctx.lineWidth = 2;
				ctx.strokeStyle = this.__primaryColor;

				// if we have more width than datapoints, draw per datapoint.
				// otherwise, draw per pixel.
				if (width > timeByteData.length) {
					for (i = 0; i < timeByteData.length; i++) {
						var pixel = Math.round(width*i/timeByteData.length);
						var y = height - (middle + timeByteData[i]/256 * middle);
						if (i==0) {
							ctx.moveTo(pixel,y);
						}
						ctx.lineTo(pixel,y);
					}
				} else {
					// more datapoints than pixels
					for (i = 0; i < width; i++) {
						// we can't show everything, so just show what we have
						var y = height - (middle + timeByteData[i]/256 * middle);
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
					ctx.strokeStyle = "#700";
					ctx.moveTo(0,y);
					ctx.lineTo(width,y);
					ctx.stroke();
					ctx.font = '22px Monospace';
					ctx.fillStyle = "#700";
					ctx.fillText("SPEED MULT: " + this.__speedMultiplier.toFixed(4),10,y-10);
				}
			},

			/**
			 * Hooks all of the audio nodes to the context such that playback
			 * can begin, and then does some runtime initialization of other
			 * components.
			 */
			startPlayback : function () {
				if (this.__introSource) {
					this.__introSource.disconnect();
				}
				if (this.__loopSource) {
					this.__loopSource.disconnect();
				}

				this.__speedMultiplier = 1;

				this.__introSource = this.__context.createBufferSource();
				this.__loopSource = this.__context.createBufferSource();

				this.__introSource.buffer = this.buffers[0];
				this.__loopSource.buffer = this.buffers[1];

				this.__loopSource.connect(this.__gainNode);
				this.__introSource.connect(this.__gainNode);

				this.__gainNode.gain.cancelScheduledValues(0);
				this.__gainNode.gain.linearRampToValueAtTime(1,this.__context.currentTime);
				this.__gainNode.gain.value = 1;

				this.__loopSource.loop = true;
				this.__introEndTime = this.__context.currentTime+this.__introSource.buffer.duration;
				this.__introSource.start(this.__context.currentTime);
				this.__loopSource.start(this.__introEndTime);
				this.__startTime = new Date();
				clearInterval(this.__interval);
				setTimeout(this.addMouseListeners.bind(this),this.__introSource.buffer.duration*1000);
			},

			/**
			 * Puts a particular audio node into the chain between the
			 * music sources and the scope. If null, removes any effect
			 * node from the chain. Only one node can be the intermediate
			 * node at a time.
			 */
			setMixerNode: function (node) {
				this.__introSource.disconnect();
				this.__loopSource.disconnect();

				if (node) {
					node.connect(this.__gainNode);
				} else {
					node = this.__gainNode;
				}
				this.__introSource.connect(node);
				this.__loopSource.connect(node);
			}
		}
	);
})(
	window,
	document,
	console || { log: function(){},debug: function (){}, warn: function(){}, error: function () {}},
  (document.querySelector || function (){}).bind(document)
);
