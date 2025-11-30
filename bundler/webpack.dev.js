const path = require("path");
const { merge } = require("webpack-merge");
const commonConfiguration = require("./webpack.common.js");
const portFinderSync = require("portfinder-sync");

const infoColor = (_message) => {
  return `\u001b[1m\u001b[34m${_message}\u001b[39m\u001b[22m`;
};

module.exports = merge(commonConfiguration, {
  stats: "errors-warnings",
  mode: "development",
  devServer: {
    host: "local-ip",
    port: portFinderSync.getPort(8080),
    open: true,

    server: {
      type: "http",
    },

    allowedHosts: "all",
    hot: false,
    watchFiles: ["src/**", "static/**"],
    static: {
      watch: true,
      directory: path.join(__dirname, "../static"),
    },
    client: {
      logging: "none",
      overlay: true,
      progress: false,
    },

    onListening: function (devServer) {
      if (!devServer) {
        throw new Error("webpack-dev-server is not defined");
      }

      const port = devServer.options.port;

      const https = devServer.options.server?.type === "https" ? "s" : "";

      const domain = `http${https}://localhost:${port}`;

      console.log(
        `Project running at:\n  - ${infoColor(domain)}\n  - ${infoColor(
          domain
        )}`
      );
    },
  },
});
