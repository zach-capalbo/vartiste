// Copyright 2010 William Malone (www.williammalone.com)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Modified by Zach Capalbo to adapt so flood fill function is usable in VARTISTE.

/*jslint browser: true */
/*global G_vmlCanvasManager, $ */

// From: https://github.com/williammalone/HTML5-Paint-Bucket-Tool

var paintBucketApp = (function () {

	"use strict";

	var context,
		canvasWidth = 490,
		canvasHeight = 220,
		colorPurple = {
			r: 203,
			g: 53,
			b: 148
		},
		colorGreen = {
			r: 101,
			g: 155,
			b: 65
		},
		colorYellow = {
			r: 255,
			g: 207,
			b: 51
		},
		colorBrown = {
			r: 152,
			g: 105,
			b: 40
		},
		curColor = colorPurple,
		drawingAreaX = 0,
		drawingAreaY = 0,
		drawingAreaWidth = 267,
		drawingAreaHeight = 200,
		colorLayerData,
		outlineLayerData,
		totalLoadResources = 3,
		curLoadResNum = 0,

		// Clears the canvas.
		clearCanvas = function () {

			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
		},

		// Draw a color swatch
		drawColorSwatch = function (color, x, y) {

			context.beginPath();
			context.arc(x + 46, y + 23, 18, 0, Math.PI * 2, true);
			context.closePath();
			context.fillStyle = "rgb(" + color.r + "," + color.g + "," + color.b + ")";
			context.fill();

			if (curColor === color) {
				context.drawImage(swatchImage, 0, 0, 59, swatchImageHeight, x, y, 59, swatchImageHeight);
			} else {
				context.drawImage(swatchImage, x, y, swatchImageWidth, swatchImageHeight);
			}
		},

		// Draw the elements on the canvas
		redraw = function () {

			var locX,
				locY;

			// Make sure required resources are loaded before redrawing
			if (curLoadResNum < totalLoadResources) {
				return;
			}

			clearCanvas();

			// Draw the current state of the color layer to the canvas
			context.putImageData(colorLayerData, 0, 0);

			// Draw the background
			context.drawImage(backgroundImage, 0, 0, canvasWidth, canvasHeight);

			// Draw the color swatches
			locX = 52;
			locY = 19;
			drawColorSwatch(colorPurple, locX, locY);

			locY += 46;
			drawColorSwatch(colorGreen, locX, locY);

			locY += 46;
			drawColorSwatch(colorYellow, locX, locY);

			locY += 46;
			drawColorSwatch(colorBrown, locX, locY);

			// Draw the outline image on top of everything. We could move this to a separate
			//   canvas so we did not have to redraw this everyime.
			context.drawImage(outlineImage, drawingAreaX, drawingAreaY, drawingAreaWidth, drawingAreaHeight);
		},

		matchOutlineColor = function (r, g, b, a) {

			return (r + g + b < 100 && a === 255);
		},

		matchStartColor = function (pixelPos, startR, startG, startB) {

			// var r = outlineLayerData.data[pixelPos],
			// 	g = outlineLayerData.data[pixelPos + 1],
			// 	b = outlineLayerData.data[pixelPos + 2],
			// 	a = outlineLayerData.data[pixelPos + 3];
			//
			// // If current pixel of the outline image is black
			// if (matchOutlineColor(r, g, b, a)) {
			// 	return false;
			// }

			var r = colorLayerData.data[pixelPos],
			g = colorLayerData.data[pixelPos + 1],
			b = colorLayerData.data[pixelPos + 2];

			// If the current pixel matches the clicked color
			if (r === startR && g === startG && b === startB) {
				return true;
			}

			// If current pixel matches the new color
			if (r === curColor.r && g === curColor.g && b === curColor.b) {
				return false;
			}

			return true;
		},

		colorPixel = function (pixelPos, r, g, b, a) {

			colorLayerData.data[pixelPos] = r;
			colorLayerData.data[pixelPos + 1] = g;
			colorLayerData.data[pixelPos + 2] = b;
			colorLayerData.data[pixelPos + 3] = a !== undefined ? a : 255;
		},

		floodFill = function (startX, startY, startR, startG, startB) {

			var newPos,
				x,
				y,
				pixelPos,
				reachLeft,
				reachRight,
				drawingBoundLeft = drawingAreaX,
				drawingBoundTop = drawingAreaY,
				drawingBoundRight = drawingAreaX + drawingAreaWidth - 1,
				drawingBoundBottom = drawingAreaY + drawingAreaHeight - 1,
				pixelStack = [[startX, startY]];

			while (pixelStack.length) {

				newPos = pixelStack.pop();
				x = newPos[0];
				y = newPos[1];

				// Get current pixel position
				pixelPos = (y * canvasWidth + x) * 4;

				// Go up as long as the color matches and are inside the canvas
				while (y >= drawingBoundTop && matchStartColor(pixelPos, startR, startG, startB)) {
					y -= 1;
					pixelPos -= canvasWidth * 4;
				}

				pixelPos += canvasWidth * 4;
				y += 1;
				reachLeft = false;
				reachRight = false;

				// Go down as long as the color matches and in inside the canvas
				while (y <= drawingBoundBottom && matchStartColor(pixelPos, startR, startG, startB)) {
					y += 1;

					colorPixel(pixelPos, curColor.r, curColor.g, curColor.b);

					if (x > drawingBoundLeft) {
						if (matchStartColor(pixelPos - 4, startR, startG, startB)) {
							if (!reachLeft) {
								// Add pixel to stack
								pixelStack.push([x - 1, y]);
								reachLeft = true;
							}
						} else if (reachLeft) {
							reachLeft = false;
						}
					}

					if (x < drawingBoundRight) {
						if (matchStartColor(pixelPos + 4, startR, startG, startB)) {
							if (!reachRight) {
								// Add pixel to stack
								pixelStack.push([x + 1, y]);
								reachRight = true;
							}
						} else if (reachRight) {
							reachRight = false;
						}
					}

					pixelPos += canvasWidth * 4;
				}
			}
		},

		// Start painting with paint bucket tool starting from pixel specified by startX and startY
		paintAt = function (startX, startY) {

			var pixelPos = (startY * canvasWidth + startX) * 4,
				r = colorLayerData.data[pixelPos],
				g = colorLayerData.data[pixelPos + 1],
				b = colorLayerData.data[pixelPos + 2],
				a = colorLayerData.data[pixelPos + 3];

			if (r === curColor.r && g === curColor.g && b === curColor.b) {
				// Return because trying to fill with the same color
				return;
			}

			// if (matchOutlineColor(r, g, b, a)) {
			// 	// Return because clicked outline
			// 	return;
			// }

			floodFill(startX, startY, r, g, b);

			// redraw();
		},

    _floodfill = function(canvas, startX, startY) {
      context = canvas.getContext('2d')
      drawingAreaWidth = canvasWidth = canvas.width
      drawingAreaHeight = canvasHeight = canvas.height
      colorLayerData = context.getImageData(0, 0, canvasWidth, canvasHeight)
      paintAt(startX, startY)
      context.putImageData(colorLayerData, 0, 0)
    };

	return {
		floodFill: _floodfill
	};
}());
window.paintBucketApp = paintBucketApp;
