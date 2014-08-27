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
			__buffers: null,
			__canvasScope: null,
			__canvasPeaks: null,
			__canvasFavicon: document.createElement("canvas"),
			__contextScope: null,
			__contextPeaks: null,
			__contextFavicon: null,

			/**
			 * Handles resizing canvases when the window size changes.
			 */
			_onResize: function () {
				[this.__canvasScope,
				 this.__canvasPeaks
				].forEach(function (canvas) {
					this.setCanvasSize(canvas);
				},this);

				this.__canvasSpeed.width = this.__canvasScope.clientWidth;
				// reinitialize the canvases. We need to this because changing the
				// canvas size appears to stroke colors
				this.initializeCanvases();
			},

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
				if ((e instanceof wnd.MouseEvent && e.which !== 1) // only work for leftclick
				 || e.target.nodeName === "SELECT"
				 || e.target.nodeName === "A"
				 || e.target.nodeName === "LABEL"
				 || e.target.nodeName === "OPTION"
				 || this.__context.currentTime < this.__introEndTime) {
					return;
				}
				this.__dragging = true;

				if (e instanceof wnd.MouseEvent) {
					this._onMouseMove(e);
				}
			},

			/**
			 * The user has stopped changing the playback speed.
			 */
			_onMouseUp: function (e) {
				this.__dragging = false;
				e.preventDefault();
			},

			/**
			 * Sets the current playback speed.
			 */
			setPlaybackSpeed: function (speed) {
				this.__speedMultiplier = speed;
				this.__introSource.playbackRate.value = this.__speedMultiplier;
				this.__loopSource.playbackRate.value = this.__speedMultiplier;
				this.renderSpeed();
			},

			/**
			 * Called when the mouse is moved in order to change the playback
			 * speed.
			 */
			_onMouseMove: function (e) {
				if (this.__dragging === false) {
					return;
				}
				var pageY = (e instanceof wnd.MouseEvent) ? e.pageY : e.touches[0].pageY;
				this.setPlaybackSpeed(((wnd.innerHeight- pageY) / wnd.innerHeight) * 2);
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

				if ('ontouchstart' in wnd) {
					wnd.addEventListener("touchstart", this._onMouseDown.bind(this), false);
					wnd.addEventListener("touchmove", this._onMouseMove.bind(this), false);
					wnd.addEventListener("touchend", this._onMouseUp.bind(this), false);
					wnd.addEventListener("touchcancel", this._onMouseUp.bind(this), false);
				}
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

				// initialize the canvases
				this.initializeCanvases();

				// Listen for window resizing, and trigger an initial sizing
				wnd.addEventListener("resize", this._onResize.bind(this), false);
				this._onResize();

				wnd.requestAnimationFrame(this._onAnimateFrame.bind(this));

				// allocate a context
				var AudioContext = wnd.AudioContext || wnd.webkitAudioContext;
				this.__context = new AudioContext();
				console.debug("Got a context");

				// Make the pluming
				this.__scopeNode = this.__context.createAnalyser();
				// Fix for a firefox bug: explicitly set scopeNode to stereo
				this.__scopeNode.channelCount = 2;
				this.__gainNode = this.__context.createGain();
				this.__gainNode.connect(this.__scopeNode);
				this.__scopeNode.connect(this.__context.destination);
				this.__scopeNode.maxDecibels = -1;

				// Create the favicon's canvas stuff
				this.__canvasFavicon.width = this.__canvasFavicon.height = 16;
				this.__contextFavicon = this.__canvasFavicon.getContext("2d");

				var directory = "punkish";
				if (wnd.location.hash.length > 2) {
					directory = wnd.location.hash.substring(2);
				}
				this.loadDirectory(directory);
			},

			/**
			 * Starts the loading of the given musical selection
			 */
			loadDirectory: function (directory) {
				$('h3').innerHTML = "LOADING<SPAN id=dots>&nbsp;&nbsp;&nbsp;</SPAN>";
				// display loading dots
				this.__interval = wnd.setInterval(this._loadOnInterval.bind(this),111);

				this.__directory = directory;
				var soundsToLoad = [this.__directory+"/intro.ogg", this.__directory+"/loop.ogg"];
				this.__buffers = [null,null];

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
							this.__buffers[i] = buffer;
							if (this.__buffers[0] && this.__buffers[1]) {
								console.debug("All decoded, starting playback");
								wnd.requestAnimationFrame(this.startPlayback.bind(this));
							}
						}.bind(this));
					}.bind(this);

					req.onerror = function () {
						wnd.clearInterval(this.__interval);
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
				document.title = "Loading...";
				var req = new wnd.XMLHttpRequest();
				req.open('GET', directory+"/details.json", true);
				req.onload = function () {
					var data = JSON.parse(req.response);
					var author = data.author || "Aaron Opfer";
					var title = data.title || "Untitled?";
					$("#title").innerHTML = title.toUpperCase();
					$("#author").innerHTML = author.toUpperCase();
					document.title = [title,author].join(" - ");
					history.replaceState("",null,"#!"+directory);
					if ('colors' in data) {
						this.__primaryColor = data.colors.primary;
						this.__secondaryColor = data.colors.secondary;
					} else {
						this.__primaryColor = "#000077";
						this.__secondaryColor = "#0000FF";
					}
					this.__contextScope.strokeStyle = this.__primaryColor;
					this.__contextFavicon.fillStyle = this.__primaryColor;

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
				if ($("#dots")) {
					$("h3").removeChild($("#dots"));
				}

				$("h3").firstChild.nodeValue = [pad2(hours),pad2(minutes),pad2(seconds),pad3(ms)].join(":");
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
				this.renderPeaks();
				this.renderScope();
				this.renderFavicon();
				wnd.requestAnimationFrame(this._onAnimateFrame.bind(this));
			},

			/**
			 * Renders the favicon canvas. This is ridiculous.
			 */
			renderFavicon: function () {
				var freqByteData = new Uint8Array(this.__scopeNode.frequencyBinCount);
				this.__scopeNode.getByteFrequencyData(freqByteData);

				var ctx = this.__contextFavicon;
				ctx.fillStyle = "black";
				ctx.fillRect(0,0,16,16);
				ctx.fillStyle = "white";

				var bytesPerPixel = freqByteData.length/8;
				for (var j = 0; j < 8; j++) {
					var magnitude = 0;
					for (var k = 0; k < bytesPerPixel; k++) {
						magnitude += freqByteData[j*bytesPerPixel + k];
					}
					var y = magnitude / (bytesPerPixel * 8);
					ctx.fillRect(j*2,16-y,1,y);
				}
				$("#favicon").setAttribute('href',this.__canvasFavicon.toDataURL());
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
			 * Ensures a canvas is the correct size for the current window.
			 */
			setCanvasSize: function (canvas) {
				if (canvas.width !== canvas.clientWidth) {
					canvas.width = canvas.clientWidth;
				}
				if (canvas.height !== canvas.clientHeight) {
					canvas.height = canvas.clientHeight;
				}
			},

			/**
			 * Performs some one-time init for canvases. This prevents us
			 * from doing these tasks inside the inner-loop, needlessly
			 * wasting cycles.
			 */
			initializeCanvases: function () {
				this.__canvasPeaks = $('canvas#peaks');
				this.__contextPeaks = this.__canvasPeaks.getContext('2d');

				this.__canvasScope = $('canvas#scope');
				this.__contextScope = this.__canvasScope.getContext('2d');
				this.__contextScope.strokeStyle = this.__primaryColor;
				this.__contextScope.fillStyle = "rgb(26,0,22)";

				this.__canvasSpeed = $('canvas#speed');
				this.__canvasSpeed.height = 40;
				this.__contextSpeed = this.__canvasSpeed.getContext('2d');

				this.renderSpeed();
			},

			/**
			 * Renders the song speed meter.
			 */
			renderSpeed: function () {
				var canvas = this.__canvasSpeed;
				if (this.__speedMultiplier === 1 && this.__dragging === false) {
					if (canvas.style.display !== "none") {
						canvas.style.display = "none";
					}
					return;
				}
				if (canvas.style.display === "none") {
					canvas.style.display = "block";
				}
				var ctx = this.__contextSpeed;
				var width = canvas.width;
				var height = canvas.height;
				var wndHeight = wnd.innerHeight;
				ctx.fillStyle   = "#700";
				ctx.strokeStyle = "#700";
				ctx.font = '22px Monospace';

				ctx.beginPath();
				ctx.moveTo(0,height);
				ctx.lineTo(width,height);
				ctx.stroke();
				ctx.clearRect(0, 0, width, height-1);
				var topStyle = wndHeight- wndHeight*(this.__speedMultiplier/2) - height + "px";
				if (canvas.style.top != topStyle) {
					canvas.style.top = topStyle;
				}
				ctx.fillText("SPEED MULT: " + this.__speedMultiplier.toFixed(4),10,height-10);
			},

			/**
			 * Renders the frequency peak graph.
			 */
			renderPeaks : function () {
				var canvas = this.__canvasPeaks;
				var ctx = this.__contextPeaks;
				var width = canvas.width;
				var height = canvas.height;
				var barWidth = 10;
				var barCount = Math.round(width / barWidth);
				var bytesPerBar = Math.floor(this.__scopeNode.frequencyBinCount / barCount);

				// to keep the graph more interesting, we focus more on
				// lower frequencies
				bytesPerBar = Math.max(bytesPerBar-4,1);

				ctx.fillStyle = "rgb(26,0,22)";
				ctx.fillRect(0, 0, width, height);

				var freqByteData = new Uint8Array(this.__scopeNode.frequencyBinCount);
				this.__scopeNode.getByteFrequencyData(freqByteData);

				if (!this.__peakData || this.__peakData.length !== barCount) {
					this.__peakData = Array(barCount);
				}
				
				for (var i = 0; i < barCount; i++) {
					var magnitude = 0;
					for (var j = 0; j < bytesPerBar; j++) {
						magnitude += freqByteData[i*bytesPerBar + j];
					}
					// now that we avg, the peaks are much smaller, so we
					// increase them by a factor here
					magnitude /= bytesPerBar/1.33;

					ctx.fillStyle = this.computeGradient(
							parseInt(this.__secondaryColor.substring(1),16),
							parseInt(this.__primaryColor.substring(1),16),
							1-(magnitude/255));

					ctx.fillRect(barWidth * i, height, barWidth - 2, -(magnitude/255*height));
					if (!this.__peakData[i] || magnitude > this.__peakData[i]) {
						this.__peakData[i] = magnitude;
					} else {
						this.__peakData[i]-= 1 + (this.__frameCount%3==1); // descend at 1.33
					}
					ctx.fillRect(barWidth * i, height-this.__peakData[i]/255*height, barWidth -2, 2);
				}
			},

			/**
			 * Renders the oscilloscope.
			 */
			renderScope : function () {
				var canvas = this.__canvasScope;
				var ctx = this.__contextScope;
				var width = canvas.width;
				var height = canvas.height;

				// The scope and the peaks are positioned such that the
				// peaks never go above the middle line of the scope, so
				// we can get away with painting background color on the
				// top half of the scope
				ctx.fillRect(0, 0, width, height/2);
				ctx.clearRect(0, height/2, width, height - height/2);

				var timeByteData = new Uint8Array(this.__scopeNode.frequencyBinCount);
				this.__scopeNode.getByteTimeDomainData(timeByteData);


				// Some state initialization
				var middle = height/2;
				var ratio = middle/128;
				ctx.lineWidth = 2;
				ctx.beginPath();
				var i = 1;
				ctx.moveTo(0, timeByteData[0] * ratio);
				var widthPerByte = width/timeByteData.length;

				// This function is for reducing the amount of points we ask
				// the canvas to draw. By looking ahead and behind a point, we
				// determine if this point is significantly different from the
				// current linear slope enough to render.
				function slopeTest(i) {
					// If the slope difference is greather than 8 (3%)
					return (i < width+1 && Math.abs(timeByteData[i]*2 - timeByteData[i-1] - timeByteData[i+1]) < 8);
				}
				while (i < timeByteData.length) {
					var max_i = i+12; // look up to 12 points ahead (about 20%)
					while(i < max_i && slopeTest(i)) {
						i += 1;
					}
					ctx.lineTo(
							i* widthPerByte,
							timeByteData[i] * ratio
					);
					i++;
				}

				ctx.stroke();
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
				// clear the speed display if it is still there
				this.renderSpeed();

				this.__introSource = this.__context.createBufferSource();
				this.__loopSource = this.__context.createBufferSource();

				this.__introSource.buffer = this.__buffers[0];
				this.__loopSource.buffer = this.__buffers[1];

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
