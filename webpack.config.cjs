const path = require('path');
const {DefinePlugin} = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const base = {
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    devtool: process.env.NODE_ENV === 'production' ? false : 'cheap-source-map',
    target: 'web',
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                loader: 'babel-loader',
                options: {
                    presets: ['@babel/preset-env', '@babel/preset-react']
                }
            },
            {
                test: /\.(svg|png|wav|gif|jpg|mp3|woff2|hex)$/,
                loader: 'file-loader',
                options: {
                    outputPath: 'static/assets/',
                    esModule: false
                }
            },
            {
                test: /\.css$/,
                use: [
                    {
                        loader: 'style-loader'
                    },
                    {
                        loader: 'css-loader',
                        options: {
                            modules: true,
                            importLoaders: 1,
                            localIdentName: '[name]_[local]_[hash:base64:5]',
                            camelCase: true
                        }
                    },
                    {
                        loader: 'postcss-loader',
                        options: {
                            postcssOptions: {
                                plugins: [
                                    'postcss-import',
                                    'postcss-simple-vars',
                                    'autoprefixer'
                                ]
                            }
                        }
                    }
                ]
            },
            {
                // webpack 4 把 .mjs 当严格 ESM，禁止 CommonJS 互操作，会报
                // "Can't import the named export ... from non EcmaScript module"。
                // markdown-it v14 是纯 ESM 包（.mjs），降级为 javascript/auto 才能解析其具名导出。
                test: /\.mjs$/,
                type: 'javascript/auto'
            }
        ]
    }
}

module.exports = [
    {
        ...base,
        output: {
            path: path.resolve(__dirname, 'dist-renderer-webpack/editor/gui'),
            filename: 'index.js'
        },
        entry: './src-renderer-webpack/editor/gui/index.jsx',
        plugins: [
            new DefinePlugin({
                'process.env.ROOT': '""'
            }),
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: 'node_modules/scratch-blocks/media',
                        to: 'static/blocks-media/default'
                    },
                    {
                        from: 'node_modules/scratch-blocks/media',
                        to: 'static/blocks-media/high-contrast'
                    },
                    {
                        from: 'node_modules/scratch-gui/src/lib/themes/blocks/high-contrast-media/blocks-media',
                        to: 'static/blocks-media/high-contrast',
                        force: true
                    },
                    {
                        from: 'node_modules/scratch-gui/static/extensions',
                        to: 'static/extensions'
                    },
                    {
                        from: 'node_modules/scratch-gui/static/penguinmod',
                        to: 'penguinmod'
                    },
                    {
                        context: 'src-renderer-webpack/editor/gui/',
                        from: '*.html'
                    }
                ]
            })
        ],
        resolve: {
            alias: {
                'scratch-gui$': path.resolve(__dirname, 'node_modules/scratch-gui/src/index.js'),
                'scratch-render-fonts$': path.resolve(__dirname, 'node_modules/scratch-gui/src/lib/tw-scratch-render-fonts'),
            }
        }
    },

    {
        ...base,
        output: {
            path: path.resolve(__dirname, 'dist-renderer-webpack/editor/addons'),
            filename: 'index.js'
        },
        entry: './src-renderer-webpack/editor/addons/index.jsx',
        plugins: [
            new CopyWebpackPlugin({
                patterns: [
                    {
                        context: 'src-renderer-webpack/editor/addons/',
                        from: '*.html'
                    }
                ]
            })
        ]
    }
];
