const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const process = require('process')
const FaviconsWebpackPlugin = require('favicons-webpack-plugin')
// const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TerserPlugin = require("terser-webpack-plugin");
const Visualizer = require('webpack-visualizer-plugin2');
const { StatsWriterPlugin } = require("webpack-stats-plugin")

const production = process.env["CI"] === "true" || process.env["PROD"] === "true"
const devMode = !production

const hostInfo = process.env["HTTPS"] === "true" ?
{
  // contentBase: './dist',
  //disableHostCheck: true,

  https: true,
  host: '0.0.0.0',
  port: 7979,
} : {
  // contentBase: './dist',
  // disableHostCheck: true,
};

let config = {
  mode: devMode ? "development" : "production",
  devtool: devMode ? 'inline-cheap-module-source-map' : undefined,
  devServer: devMode ? hostInfo : undefined,
  output: {
    filename: '[name].bundle.[contenthash].js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '',
  },
  resolve: {fallback: { "stream": false }},
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
      { test: /\.(md)$/, use: [{loader: 'html-loader'}, {loader: 'markdown-loader'}] },
      { test: /\.(ya?ml)$/, loader: 'yaml-loader', type: 'json'},
      { test: /\.v3\.(frag|vert|glsl)$/, loader: 'webpack-glsl-loader'},
      { test: /[^3]\.(frag|vert|glsl)$/, loader: 'glsl-shader-loader'},
      { test: /\.(styl)$/, use: [{loader: 'style-loader'}, {loader: 'css-loader'}, {loader: 'stylus-loader'}]},
      { test: /gallery.*\.vartistez?$/,
        use: [{
          loader: 'file-loader',
          options: {
            name: 'gallery/[name].[ext]'
          }
        }]
      },
      { test: /\.vartiste-brushez?$/, use: {loader: 'file-loader'} },
      {
        test: /\.worker\.js$/,
        use: { 
          loader: "worker-loader",
          options: {
            filename: "[name].[contenthash].worker.js",
          }, 
        },
      },
      {
        test: /(\@ffmpeg|xatlas-web).*\.wasm/,
        exclude: /flemist/,
        type: 'javascript/auto',
        use: [{
          loader: 'file-loader',
          options: {
            esModule: false,
            name: '[name].[ext]'
          }
        }]
      },
      {
        test: /\@ffmpeg.*\.worker\.js$/,
        type: 'javascript/auto',
        exclude: /flemist/,
        use: [{
          loader: 'file-loader',
          options: {
            esModule: false,
            name: '[name].[ext]'
          }
        }]
      },
      {
        test: /wasm.*\.wasm/,
        type: 'javascript/auto',
        exclude: /flemist/,
        use: [{
          loader: 'file-loader',
          options: {
            esModule: false,
            name: '[path][name].[contenthash].[ext]'
          }
        }]
      },
      {
        test: /wasm.*ffmpeg-core\.wasm/,
        type: 'javascript/auto',
        exclude: /flemist/,
        use: [{
          loader: 'file-loader',
          options: {
            esModule: false,
            name: '[name].[ext]'
          }
        }]
      },
      {
        test: /wasm.*\.js/,
        type: 'javascript/auto',
        exclude: /flemist|ffmpeg-core/,
        use: [{
          loader: "script-loader",
          // options: {
          //   esModule: false,
          //   name: '[path][name].[contenthash].[ext]'
          // }
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
      {test: /\.(png|jpe?g|gif|obj|mtl|glb|wav|hdr|webp|woff)$/i,
        type: 'asset/resource',
        parser: {
          dataUrlCondition: {
            maxSize: 4 * 1024 // 4kb
          }
        },
        generator: {
          filename: 'asset/[contenthash].[ext]'
        }
        // use: [
        //   {
        //     loader: 'url-loader',
        //     options: {
        //       limit: 1024,
        //       esModule: false,
        //       fallback: require.resolve('file-loader'),
        //       name: 'asset/[contenthash].[ext]',
        //     },
        //   },
        // ]
      },
      {
        test: /ffmpeg-core.*\.js$/,
        type: 'javascript/auto',
        use: [
          {
            loader: 'raw-loader'
          },
          {
          loader: 'file-loader',
          options: {
            esModule: false,
            name: '[name].[ext]'
          }
        }]
      },
    ]
  }
};

const faviconPath = './src/static/favicon.png'

function minimizer() {
  if (devMode) return undefined;

  return [new TerserPlugin({
  parallel: true,
  exclude: /ffmpeg-core/,
  terserOptions: {
    toplevel: true,
    keep_classnames: /Node|Layer|Brush/
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
      filename: 'index.html',
      scriptLoading: 'blocking',
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
    emitOnErrors: true,
  },
}, config);

let static = ['landing', 'license', 'guide', 'launcher'].map(name => { return Object.assign({
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
    optimization: {
      minimize: !devMode,
      minimizer: minimizer(),
      usedExports: true,
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
          exclude: /(node_modules|bower_components|index\.js|docgen-entry|doc-highlight.worker)/,
          use: [
            // {loader: 'file-loader', options: {
            //   esModule: false,
            //   name: '[name].doc.html'
            // }},
            {loader: 'html-loader'},
            {loader: 'markdown-loader', options: {gfm: true} },
            {loader: path.resolve('./docgen/docgen-loader.js')},
          ]
        },
        {
          test: /\.worker\.js$/,
          use: { 
            loader: "worker-loader",
            options: {
              filename: "[name].[contenthash].worker.js",
            },
          },
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
        { test: /\.(md)$/,  use: [{loader: 'html-loader'}, {loader: 'markdown-loader'}] },
        { test: /\.(frag|vert|glsl)$/, loader: 'glsl-shader-loader'},
        { test: /\.(styl)$/, use: [{loader: 'style-loader'}, {loader: 'css-loader'}, {loader: 'stylus-loader'}]},
        { test: /\.(css)$/, use: [{loader: 'style-loader'}, {loader: 'css-loader'}]},
        {test: /\.(png|jpe?g|gif|obj|mtl|glb|wav|hdr)$/i,
          type: 'asset/resource'
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
else if (process.env.VARTISTE_TOOLKIT_ONLY==="true")
{
  module.exports = [toolkit]
}
else
{
  module.exports = [app, toolkit, toolkitTest, toolkitDoc].concat(static)
}
