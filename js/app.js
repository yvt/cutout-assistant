$(function () {
	"use strict";

	function CoordQueue()
	{
		this.data = new Int32Array(128);
		this.index = 0; // read index
		this.length = 0;
		this.outX = 0;
		this.outY = 0;
	}
	CoordQueue.prototype = {
		push: function (x, y) {
			var data = this.data;
			var length = this.length;
			if (this.length == this.data.length) {
				var newData = new Int32Array(data.length << 1);
				for (var i = this.index, k = 0;
					k !== length; ++k) {
					newData[k] = data[i];
					++i;
					if (i == data.length) {
						i = 0;
					}
				}
				data = this.data = newData;
				this.index = 0;
			}
			var writeIndex = (this.index + length) & (this.data.length - 1);
			data[writeIndex++] = x;
			data[writeIndex] = y;
			this.length += 2;
		},
		shift: function () {
			var data = this.data;
			if (this.length === 0) {
				throw new Error("queue empty");
			}
			this.outX = data[this.index++];
			this.outY = data[this.index++];
			data[this.index - 2] = data[this.index - 1] = -1000000;
			this.length -= 2;
			this.index &= data.length - 1;
		}
	};

	/*
	 * @param data{ImageData}
	 * @param x{Number}
	 * @param y{Number}
	 */
	function buildProximityMap(data, x, y)
	{
		var width = data.width,
			height = data.height,
			bmp = data.data;
		var map = new Float32Array(width * height);
		var queuedMap = new Uint8Array(width * height);
		var queue = new CoordQueue();
		var baseR = bmp[((x + y * width) << 2)];
		var baseG = bmp[((x + y * width) << 2) + 1];
		var baseB = bmp[((x + y * width) << 2) + 2];
		var count =  width * height * 8;
		queue.push(x, y);
		queuedMap[x + y * width] = 1;
		var first = true;
		while (queue.length) {
			if (count-- < 0) {
				break;
			}
			queue.shift();
			var cx = queue.outX;
			var cy = queue.outY;
			queuedMap[cx + cy * width] = 0;
			var maxProx = 0;
			if (!first) {
				if (cx > 0) {
					maxProx = Math.max(maxProx, map[(cx - 1) + (cy) * width]);
				}
				if (cx < width - 1) {
					maxProx = Math.max(maxProx, map[(cx + 1) + (cy) * width]);
				}
				if (cy > 0) {
					maxProx = Math.max(maxProx, map[(cx) + (cy - 1) * width]);
				}
				if (cy < height - 1) {
					maxProx = Math.max(maxProx, map[(cx) + (cy + 1) * width]);
				}
			} else {
				first = false;
				maxProx = 0x30000;
			}
			var dr = baseR - bmp[((cx + cy * width) << 2)];
			var dg = baseG - bmp[((cx + cy * width) << 2) + 1];
			var db = baseB - bmp[((cx + cy * width) << 2) + 2];
			var dist = dr * dr + dg * dg + db * db;
			dist = 0x30000 - dist;
			maxProx = Math.min(maxProx, dist);
			if (maxProx < map[cx + cy * width] + 10) {
				continue;
			}
			map[cx + cy * width] = maxProx;
			if (cx > 0 && queuedMap[(cx - 1) + (cy) * width] === 0) {
				queue.push(cx - 1, cy);
				queuedMap[(cx - 1) + (cy) * width] = 1;
			}
			if (cx < width - 1 && queuedMap[(cx + 1) + (cy) * width] === 0) {
				queue.push(cx + 1, cy);
				queuedMap[(cx + 1) + (cy) * width] = 1;
			}
			if (cy > 0 && queuedMap[(cx) + (cy - 1) * width] === 0) {
				queue.push(cx, cy - 1);
				queuedMap[(cx) + (cy - 1) * width] = 1;
			}
			if (cy < height - 1 && queuedMap[(cx) + (cy + 1) * width] === 0) {
				queue.push(cx, cy + 1);
				queuedMap[(cx) + (cy + 1) * width] = 1;
			}
		}
		return map;
	}

	function getImageDataForImage(img)
	{
		var canvas = document.createElement("canvas");
		canvas.width = img.width;
		canvas.height = img.height;

		var c = canvas.getContext("2d");
		c.drawImage(img, 0, 0);
		return c.getImageData(0, 0, img.width, img.height);
	}

	function diffImageData(out, a, b)
	{
		var ln = out.width * out.height * 4;
		a = a.data;
		b = b.data;
		out = out.data;
		for (var i = 0; i < ln; ) {
			out[i] = Math.sqrt(Math.abs(a[i] - b[i])) * 23; ++i;
			out[i] = Math.sqrt(Math.abs(a[i] - b[i])) * 23; ++i;
			out[i] = Math.sqrt(Math.abs(a[i] - b[i])) * 23; ++i;
			out[i] = 255; ++i;
		}
	}

	var canvas = $("#canvas")[0];

	var img, bestMap, diffImgData, outImgData, img, imgData;

	$(canvas).mousedown(function (e) {
		if (e.which !== 1) {
			return;
		}
		if ($("#working").is(":visible")) {
			return;
		}
		var x = e.pageX - $(canvas).offset().left | 0;
		var y = e.pageY - $(canvas).offset().top | 0;
		x %= imgData.width;
		$("#working").show();
		setTimeout(function () {
			onClick(x, y);
			$("#working").hide();
		}, 30);
	});

	function onClick(x, y)
	{
		var map = buildProximityMap(imgData, x, y);
		var colR = imgData.data[(x + y * imgData.width) * 4];
		var colG = imgData.data[(x + y * imgData.width) * 4 + 1];
		var colB = imgData.data[(x + y * imgData.width) * 4 + 2];
		var outD = outImgData.data;
		for (var i = 0; i < bestMap.length; ++i) {
			if (map[i] < bestMap[i]) {
				continue;
			}
			bestMap[i] = map[i];
			outD[(i << 2)] = colR;
			outD[(i << 2) + 1] = colG;
			outD[(i << 2) + 2] = colB;
			outD[(i << 2) + 3] = 255;
		}
		render();
	}

	function setImage(img)
	{
		imgData = getImageDataForImage(img);
		bestMap = new Float32Array(imgData.width * imgData.height);
		diffImgData = canvas.getContext("2d").createImageData(imgData.width, imgData.height);
		outImgData = canvas.getContext("2d").createImageData(imgData.width, imgData.height);
		$("#canvas-wrapper").css({
			width: imgData.width * 2,
			height: imgData.height
		});
		render();
	}

	function render()
	{
		canvas.width = imgData.width * 2;
		canvas.height = imgData.height;
		var c = canvas.getContext("2d");

		diffImageData(diffImgData, imgData, outImgData);

		c.putImageData(diffImgData, 0, 0);
		c.putImageData(outImgData, outImgData.width, 0);
	}

	var theImage = new Image();
	theImage.onload = function () {
		setImage(theImage);
	};
	theImage.src = "img/test.jpg";

	$(canvas).on("dragenter", function (e) {
		e.preventDefault();
	});
	$(canvas).on("dragover", function (e) {
		e.preventDefault();
	});
	$(canvas).on("drop", function (e) {
		var reader = new FileReader();
		reader.onload = function (e2) {
			theImage.src = reader.result;
		};
		reader.readAsDataURL(e.originalEvent.dataTransfer.files[0]);
		e.preventDefault();
	});

});
