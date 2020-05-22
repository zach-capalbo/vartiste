/**
* @author Prashant Sharma / spidersharma03
* @author Ben Houston / http://clara.io / bhouston
* @modified Zach Capalbo / https://vartiste.xyz
*/

/**
The MIT License

Copyright © 2010-2020 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

import {
	CubeTexture,
	DataTexture,
	FileLoader,
	FloatType,
	HalfFloatType,
	LinearEncoding,
	LinearFilter,
	Loader,
	NearestFilter,
	RGBAFormat,
	RGBEEncoding,
	RGBFormat,
	UnsignedByteType
} from "../../../build/three.module.js";
import { RGBELoader } from "../loaders/RGBELoader.js";

var HDRCubeTextureLoader = function ( manager ) {

	Loader.call( this, manager );

	this.hdrLoader = new RGBELoader();
	this.type = UnsignedByteType;

};

HDRCubeTextureLoader.prototype = Object.assign( Object.create( Loader.prototype ), {

	constructor: HDRCubeTextureLoader,

	load: function ( urls, onLoad, onProgress, onError ) {

		if ( ! Array.isArray( urls ) ) {

			console.warn( 'THREE.HDRCubeTextureLoader signature has changed. Use .setDataType() instead.' );

			this.setDataType( urls );

			urls = onLoad;
			onLoad = onProgress;
			onProgress = onError;
			onError = arguments[ 4 ];

		}

		var texture = new CubeTexture();

		texture.type = this.type;

		switch ( texture.type ) {

			case UnsignedByteType:

				texture.encoding = RGBEEncoding;
				texture.format = RGBAFormat;
				texture.minFilter = NearestFilter;
				texture.magFilter = NearestFilter;
				texture.generateMipmaps = false;
				break;

			case FloatType:

				texture.encoding = LinearEncoding;
				texture.format = RGBFormat;
				texture.minFilter = LinearFilter;
				texture.magFilter = LinearFilter;
				texture.generateMipmaps = false;
				break;

			case HalfFloatType:

				texture.encoding = LinearEncoding;
				texture.format = RGBFormat;
				texture.minFilter = LinearFilter;
				texture.magFilter = LinearFilter;
				texture.generateMipmaps = false;
				break;

		}

		var scope = this;

		var loaded = 0;

		function loadHDRData( i, onLoad, onProgress, onError ) {

			new FileLoader( scope.manager )
				.setPath( scope.path )
				.setResponseType( 'arraybuffer' )
				.load( urls[ i ], function ( buffer ) {

					loaded ++;

					var texData = scope.hdrLoader.parse( buffer );

					if ( ! texData ) return;

					if ( texData.data !== undefined ) {

						var dataTexture = new DataTexture( texData.data, texData.width, texData.height );

						dataTexture.type = texture.type;
						dataTexture.encoding = texture.encoding;
						dataTexture.format = texture.format;
						dataTexture.minFilter = texture.minFilter;
						dataTexture.magFilter = texture.magFilter;
						dataTexture.generateMipmaps = texture.generateMipmaps;

						texture.images[ i ] = dataTexture;

					}

					if ( loaded === 6 ) {

						texture.needsUpdate = true;
						if ( onLoad ) onLoad( texture );

					}

				}, onProgress, onError );

		}

		for ( var i = 0; i < urls.length; i ++ ) {

			loadHDRData( i, onLoad, onProgress, onError );

		}

		return texture;

	},

	setDataType: function ( value ) {

		this.type = value;
		this.hdrLoader.setDataType( value );

		return this;

	}

} );

export { HDRCubeTextureLoader };
