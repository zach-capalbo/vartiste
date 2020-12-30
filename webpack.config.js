const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const process = require('process')
const FaviconsWebpackPlugin = require('favicons-webpack-plugin')
// const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TerserPlugin = require("terser-webpack-plugin");
const Visualizer = require('webpack-visualizer-plugin2');
const { StatsWriterPlugin } = require("webpack-stats-plugin")
const webpack = require('webpack')

const production = process.env["CI"] === "true" || process.env["PROD"] === "true"
const devMode = !production

let config = {
  mode: devMode ? "development" : "production",
  devtool: devMode ? 'inline-cheap-module-source-map' : undefined,
  devServer: {
    contentBase: './dist',
    disableHostCheck: true,
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
      { test: /\.html$/, loader: 'html-loader' },
      { test: /oss-licenses-used/,loader: 'raw-loader'},
      { test: /\.html\.(pug)$/, loader: 'pug-loader' },
      { test: /\.(md)$/, loader: 'html-loader!markdown-loader' },
      { test: /\.(frag|vert|glsl)$/, loader: 'glsl-shader-loader'},
      { test: /\.(styl)$/, loader: 'style-loader!css-loader!stylus-loader'},
      { test: /gallery.*\.vartistez?$/,
        use: [{
          loader: 'file-loader',
          options: {
            name: 'gallery/[name].[ext]'
          }
        }]
      },
      {
        test: /\.worker\.js$/,
        use: { loader: "worker-loader" },
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
              limit: 1024,
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

function minimizer() {
  if (devMode) return undefined;

  return [new TerserPlugin({
  parallel: true,
  terserOptions: {
    toplevel: true,
    keep_classnames: /Node|Layer/
  }
})]};

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
  ].concat(devMode
    ? [
       // new webpack.SourceMapDevToolPlugin({
       //   exclude: /material-packs/,
       // })
    ]
    : [
    new StatsWriterPlugin({
        filename: path.join('.', 'stats', 'app-log.json'),
        fields: null,
        stats: { chunkModules: true },
    }),
    new Visualizer({
        filename: path.join('.', 'stats', 'app-statistics.html'),
    }),
  ]),
  optimization: {
    splitChunks: {},
    minimize: !devMode,
    minimizer: minimizer(),
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
    new StatsWriterPlugin({
        filename: path.join('.', 'stats', 'toolkit-log.json'),
        fields: null,
        stats: { chunkModules: true },
    }),
    new Visualizer({
        filename: path.join('.', 'stats', 'toolkit-statistics.html'),
    }),
  ],
  optimization: {
    minimize: !devMode,
    minimizer: minimizer(),
  },
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
        template: `./src/toolkit/toolkit-test.html`,
        filename: `toolkit-test.html`,
        // inject: false
      }),
    ],
  }, config);

let toolkitDoc = Object.assign({
    entry: {
      toolkitDoc: `./src/docgen-entry.js`
    },
    plugins: [
      // new CleanWebpackPlugin(['dist/*']) for < v2 versions of CleanWebpackPlugin
      // new CleanWebpackPlugin(),
      new FaviconsWebpackPlugin(faviconPath),
      new HtmlWebpackPlugin({
        template: `./src/static/docs.html.slm`,
        filename: `docs.html`,
        // inject: false
      }),
    ]
  }, config, {
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /(node_modules|bower_components|index\.js|docgen-entry)/,
          use: [
            // {loader: 'file-loader', options: {
            //   esModule: false,
            //   name: '[name].doc.html'
            // }},
            {loader: 'html-loader'},
            {loader: 'markdown-loader' },
            {loader: path.resolve('./docgen/docgen-loader.js')},
          ]
        },
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
        }
      ]
    }
  });

if (process.env.VARTISTE_TOOLKIT==="true")
{
  module.exports = [toolkit, toolkitTest, toolkitDoc]
}
else if (process.env.VARTISTE_APP_ONLY==="true")
{
  module.exports = [app]
}
else
{
  module.exports = [app, toolkit, toolkitTest, toolkitDoc].concat(static)
}
