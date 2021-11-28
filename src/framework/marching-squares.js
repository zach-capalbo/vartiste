/**
 * Created by @sakri on 25-3-14.
 * Edited and optimized by @mamrehn on 08-09-16
 *
 * Javascript port of :
 * http://devblog.phillipspiess.com/2010/02/23/better-know-an-algorithm-1-marching-squares/
 * returns an Array of x and y positions defining the perimeter of a blob of non-transparent pixels on a canvas
 *

 The MIT License (MIT)

Copyright (c) 2014 Sakri Rosenstrom

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */

const MarchingSquaresOpt = {};

MarchingSquaresOpt.getBlobOutlinePoints = function(source_array, width, height=0, threshold = 0){
    // Note: object should not be on the border of the array, since there is
    //       no padding of 1 pixel to handle points which touch edges

    if (source_array instanceof HTMLCanvasElement){
      width = source_array.width;
      height = source_array.height;
      const data4 = source_array.getContext('2d').getImageData(0, 0, width, height).data,  // Uint8ClampedArray
        len = width * height,
        data = new Uint8Array(len);
      for (let i = 0; i < len; ++i){
          data[i] = data4[i * 4 + 3];
      }
      source_array = data;
    } else if (0 == height){
        height = (source_array.length / width)|0;
    }

    // find the starting point
    const startingPoint = MarchingSquaresOpt.getFirstNonTransparentPixelTopDown(source_array, width, height, threshold);
    if (null === startingPoint){
        console.log('[Warning] Marching Squares could not find an object in the given array');
        return [];
    }

    // return list of w and h positions
    return MarchingSquaresOpt.walkPerimeter(source_array, width, height, startingPoint.w, startingPoint.h, threshold);
};

MarchingSquaresOpt.getFirstNonTransparentPixelTopDown = function(source_array, width, height, threshold = 0){
    let idx;
    for(let h = 0|0; h < height; ++h){
        idx = (h * width)|0;
        for(let w = 0|0; w < width; ++w){
            if(source_array[idx] > threshold){
                return {w : w, h : h};
            }
            ++idx;
        }
    }
    return null;
};

MarchingSquaresOpt.walkPerimeter = function(source_array, width, height, start_w, start_h, threshold = 0){

    width = width|0;
    height = height|0;

    // Set up our return list
    const point_list = [],
        up = 1|0, left = 2|0, down = 3|0, right = 4|0,
        step_func = MarchingSquaresOpt.step;

    let idx = 0|0,  // Note: initialize it with an integer, so the JS interpreter optimizes for this type.

    // our current x and y positions, initialized
    // to the init values passed in
        w = start_w,
        h = start_h,

    // the main while loop, continues stepping until
    // we return to our initial points
        next_step;
    do {
        // evaluate our state, and set up our next direction
        idx = (h - 1) * width + (w - 1);
        next_step = step_func(idx, source_array, width, threshold);

        // if our current point is within our image
        // add it to the list of points
        if (w >= 0 && w < width && h >= 0 && h < height){
            point_list.push(w - 1, h);
        }

        switch (next_step){
            case up:    --h; break;
            case left:  --w; break;
            case down:  ++h; break;
            case right: ++w; break;
            default:
                break;
        }

    } while (w != start_w || h != start_h);

    point_list.push(w, h);

    return point_list;
};

// determines and sets the state of the 4 pixels that
// represent our current state, and sets our current and
// previous directions

MarchingSquaresOpt.step = function(idx, source_array, width, threshold = 0){
    //console.log('Sakri.MarchingSquaresOpt.step()');
    // Scan our 4 pixel area
    //Sakri.imageData = Sakri.MarchingSquaresOpt.sourceContext.getImageData(x-1, y-1, 2, 2).data;

    const up_left = 0 < source_array[idx + 1] - threshold,
        up_right = 0 < source_array[idx + 2] - threshold,
        down_left = 0 < source_array[idx + width + 1] - threshold,
        down_right = 0 < source_array[idx + width + 2] - threshold,
        none = 0|0, up = 1|0, left = 2|0, down = 3|0, right = 4|0;

    // Determine which state we are in
    let state = 0|0;

    if (up_left){state |= 1;}
    if (up_right){state |= 2;}
    if (down_left){state |= 4;}
    if (down_right){state |= 8;}

    // State now contains a number between 0 and 15
    // representing our state.
    // In binary, it looks like 0000-1111 (in binary)

    // An example. Let's say the top two pixels are filled,
    // and the bottom two are empty.
    // Stepping through the if statements above with a state
    // of 0b0000 initially produces:
    // Upper Left == true ==>  0b0001
    // Upper Right == true ==> 0b0011
    // The others are false, so 0b0011 is our state
    // (That's 3 in decimal.)

    // Looking at the chart above, we see that state
    // corresponds to a move right, so in our switch statement
    // below, we add a case for 3, and assign Right as the
    // direction of the next step. We repeat this process
    // for all 16 states.

    // So we can use a switch statement to determine our
    // next direction based on
    switch (state){
        case 1: MarchingSquaresOpt.next_step = up; break;
        case 2: MarchingSquaresOpt.next_step = right; break;
        case 3: MarchingSquaresOpt.next_step = right; break;
        case 4: MarchingSquaresOpt.next_step = left; break;
        case 5: MarchingSquaresOpt.next_step = up; break;
        case 6:
            if (MarchingSquaresOpt.next_step == up){  // info from previous_step
                MarchingSquaresOpt.next_step = left;
            } else {
                MarchingSquaresOpt.next_step = right;
            }
            break;
        case 7: MarchingSquaresOpt.next_step = right; break;
        case 8: MarchingSquaresOpt.next_step = down; break;
        case 9:
            if (MarchingSquaresOpt.next_step == right){  // info from previous_step
                MarchingSquaresOpt.next_step = up;
            } else {
                MarchingSquaresOpt.next_step = down;
            }
            break;
        case 10: MarchingSquaresOpt.next_step = down; break;
        case 11: MarchingSquaresOpt.next_step = down; break;
        case 12: MarchingSquaresOpt.next_step = left; break;
        case 13: MarchingSquaresOpt.next_step = up; break;
        case 14: MarchingSquaresOpt.next_step = left; break;
        default:
            MarchingSquaresOpt.next_step = none;  // this should never happen
            break;
    }
    return MarchingSquaresOpt.next_step;
};

export {MarchingSquaresOpt};
