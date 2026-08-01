// Karma config for `ng test`.
//
// The project previously had none, so `ng test` used the Angular builder's
// built-in defaults, which offer only the stock `Chrome`/`ChromeHeadless`
// launchers. Those cannot start in a container: Chromium's sandbox needs
// unprivileged user namespaces, which are disabled here (and on Ubuntu 23.10+
// generally, via AppArmor). The `ChromeHeadlessNoSandbox` launcher below is the
// documented workaround.
//
// Running headless on a box without the usual desktop libraries:
//
//   export CHROME_BIN=~/.cache/ms-playwright/chromium_headless_shell-1234/\
//     chrome-headless-shell-linux64/chrome-headless-shell
//   export LD_LIBRARY_PATH=/tmp/arcade-playwright-sysroot/usr/lib/x86_64-linux-gnu
//   npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox
//
// Playwright's `chrome-headless-shell` is the binary to prefer: the full
// `chrome` builds in the same cache still want libcups/libcairo/libpango, which
// the sysroot above does not carry, while the headless shell links cleanly.
// (Same LD_LIBRARY_PATH trick as tools/ui-pass in the lssvm2-starknet repo.)

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: {
      jasmine: {},
      clearContext: false, // leave the Jasmine spec runner visible in a browser
    },
    jasmineHtmlReporter: { suppressAll: true },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/amm-lite'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }],
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    },
    restartOnFileChange: true,
  });
};
