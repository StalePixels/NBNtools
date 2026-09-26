# NextBestNetwork CDN File Fetcher

## options
 -h      Show this help screen

 -s xxxx Alternative Server 
 
 -p xxxx Alternative Port
 
 -v      Verbose AT protocol log

 -q      Quiet, no progress bar

## requirements
Requires z88dk v2.
Has been tested with ESP AT firmware versions 1.4, 1.5 and 1.6. Feedback for other versions welcome.

## build
Uses `make`.

`make posix` builds a version for macOS with the system `cc`. The output is `BUILD-posix/nbnget`.
