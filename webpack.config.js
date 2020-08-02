const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const process = require('process')
const FaviconsWebpackPlugin = require('favicons-webpack-plugin')
// const { CleanWebpackPlugin } = require('clean-webpack-plugin');

let config = {
  mode: "development",
  devtool: 'inline-source-map',
  devServer: {
    contentBase: './dist',
  },
  output: {
    filename: '[name].bundle.[contenthash].js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.html\.(slm|slim)$/,
        use: [
          {loader: 'html-loader'},
          {loader: path.resolve('./slm-loader.js'), options: {useCache: false, cache: false} }
        ]
      },
      { test: /oss-licenses-used/,loader: 'raw-loader'},
      { test: /\.html\.(pug)$/, loader: 'pug-loader' },
      { test: /\.(md)$/, loader: 'html-loader!markdown-loader' },
      { test: /\.(frag|vert|glsl)$/, loader: 'glsl-shader-loader'},
      { test: /\.(styl)$/, loader: 'style-loader!css-loader!stylus-loader'},
      { test: /gallery.*\.vartiste$/,
        use: [{
          loader: 'file-loader',
          options: {
            name: 'gallery/[name].[ext]'
          }
        }]
      },
      {
        test: /ai-models.*json/,
        type: 'javascript/auto',
        use: [{
          loader: 'file-loader',
          options: {
            esModule: false,
            name: 'ai/[path][name].[ext]'
          }
        }]
      },
      {
        test: /ai-models.*(group|LICENSE)/,
        // type: 'javascript/auto',
        use: [{
          loader: 'file-loader',
          options: {
            esModule: false,
            regExp: /(\.bin|$)/i,
            name: 'ai/[path][name][1]'
          }
        }]
      },
      {test: /\.(png|jpe?g|gif|obj|mtl|glb|wav|hdr)$/i,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 8192,
              esModule: false,
              fallback: require.resolve('file-loader'),
              name: 'asset/[contenthash].[ext]',
            },
          },
        ]
      },
    ]
  }
};

const faviconPath = './src/static/favicon.png'

let app = Object.assign({
  entry: {
    app: './src/index.js'
  },
  plugins: [
    new FaviconsWebpackPlugin(faviconPath),
    new HtmlWebpackPlugin({
      template: './src/template.html.slm',
      filename: 'index.html'
    }),
  ],
  optimization: {
    splitChunks: {}
  },
}, config);

let static = ['landing', 'license', 'guide'].map(name => { return Object.assign({
    entry: {
      [name]: `./src/static/${name}.js`
    },
    plugins: [
      // new CleanWebpackPlugin(['dist/*']) for < v2 versions of CleanWebpackPlugin
      // new CleanWebpackPlugin(),
      new FaviconsWebpackPlugin(faviconPath),
      new HtmlWebpackPlugin({
        template: `./src/static/${name}.html.slm`,
        filename: `${name}.html`
      }),
    ],
  }, config);
})

let toolkit = Object.assign({
  entry: {
    toolkit: './src/vartiste-toolkit.js'
  },
  plugins: [
    // new FaviconsWebpackPlugin(faviconPath),
    // new HtmlWebpackPlugin({
    //   template: './src/template.html.slm',
    //   filename: 'index.html'
    // }),
  ],
  // optimization: {
  //   splitChunks: {}
  // },
}, config, {
  output: {
    filename: 'vartiste-toolkit.js',
    path: path.resolve(__dirname, 'dist'),
  },
});

let toolkitTest = Object.assign({
    entry: {
      toolkitTest: `./src/toolkit/toolkit-test.js`
    },
    plugins: [
      // new CleanWebpackPlugin(['dist/*']) for < v2 versions of CleanWebpackPlugin
      // new CleanWebpackPlugin(),
      new FaviconsWebpackPlugin(faviconPath),
      new HtmlWebpackPlugin({
        template: `./src/toolkit/toolkit-test.html.slm`,
        filename: `toolkit-test.html`,
        // inject: false
      }),
    ],
  }, config);

if (process.env.VARTISTE_TOOLKIT==="true")
{
  module.exports = [toolkit, toolkitTest]
}
else
{
  module.exports = [app, toolkit, toolkitTest].concat(static)
}
