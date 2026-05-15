#!/usr/bin/env node
'use strict';
require('../dist/cli/index.js')
    .main()
    .then((code) => process.exit(code))
    .catch((err) => {
        process.stderr.write(`drama: ${err && err.stack ? err.stack : err}\n`);
        process.exit(1);
    });
