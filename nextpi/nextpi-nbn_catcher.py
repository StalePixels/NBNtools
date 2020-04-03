#!/usr/bin/env python
import sys
sys.path.append('/opt/nextpi/bin')

from pylib.help import help
import argparse

import os
import sys
import tty
import termios
import select
from datetime import datetime
# import time

# usleep = lambda x: time.sleep(x/1000000.0)
# msleep = lambda x: time.sleep(x/1000.0)

default_timeout = 1000
stdin = sys.stdin.fileno()
logfile = open("/ram/nbn_catcher.log", "w")
old_settings = termios.tcgetattr(stdin)


def log(data):
    logfile.write(data)
    logfile.flush()


def out(data):
    os.write(sys.stdout.fileno(), data)
    # sys.stdout.flush()


def exit(exit_code):
    termios.tcsetattr(stdin, termios.TCSADRAIN, old_settings)
    os.system("stty echo")
    logfile.close()
    sys.exit(exit_code)


def get_byte():
    class TimeOut(Exception):
        pass

    timeout = default_timeout
    try:
        # Make sure we have a byte to read...
        while sys.stdin not in select.select([sys.stdin], [], [], 0)[0]:
            timeout = timeout - 1
            # msleep(2)
            if timeout is 0:
                raise TimeOut
        # Read the byte we know, for sure, is there...
        byte = sys.stdin.read(1)
    except TimeOut:
        log("ERR - get_byte timed out\n")
        send_bytes("ERR - Timed out")
        exit(255)

    return ord(byte)


def version_check(req):
    # Version check
    ver = get_byte()
    if ver != req:
        sys.stderr.write("Version error (" + ver.__str__() + " != " + req.__str__() + ")")
        exit(254)
    return ver


def get_int(bytelen):
    val = 0
    # Version check
    while bytelen:
        byte = get_byte()
        val = (val << 8) + byte
        # log(" Byte: "+byte.__str__()+" Value now: "+val.__str__()+". ")
        bytelen = bytelen - 1
    # log(" Final Value: "+val.__str__()+"\n")
    return val


def get_block(blocklen):
    block = [None] * blocklen
    bytecount = 0
    computed = 0
    retries = 3

    # First we ask for a new block
    while retries > 0:
        if retries == 3:
            send_bytes("!\x0D\x0A")
        else:
            send_bytes("?\x0D\x0A")
        while bytecount < blocklen:
            block[bytecount] = get_byte()
            computed = computed + block[bytecount]
            if computed > 65535:
                computed = computed - 65535
            bytecount = bytecount + 1

        checksum = get_int(2)

        if checksum == computed:
            return bytearray(block)

        log(" ERR (transmitted " + checksum.__str__() + " vs computed " + computed.__str__() + ")\n")

        retries = retries - 1
        computed = 0
        bytecount = 0

    # while bytecount < blocklen:
    #     log("("+block[bytecount].__str__()+")")
    #     bytecount = bytecount + 1

    send_bytes("ERR - Transission failure (exceeded retries)\n")
    exit(252)


def send_bytes(string):
    sys.stderr.write(string)


def main():
    (iflag, oflag, cflag, lflag, ispeed, ospeed, cc) \
        = termios.tcgetattr(stdin)
    lflag &= ~termios.ECHO
    new_attr = [iflag, oflag, cflag, lflag, ispeed, ospeed, cc]
    termios.tcsetattr(stdin, termios.TCSANOW, new_attr)

    parser = argparse.ArgumentParser(description='NBN File catcher')

    # parser.add_argument('--format', '-f', type=str,  dest='format', default=None,
    #                     help='Format of interface with Next, no default',
    #                     choices=['EventStream'],
    #                     nargs='?')

    args = parser.parse_args()

    if hasattr(args, 'help'):
        help()
        return

    log("\n"+datetime.now().strftime("%H:%M:%S")+" - Starting transfer\n")
    send_bytes("OK\x0A")

    tty.setraw(stdin)                        # Get stream ready for binary
    ver = version_check(1)                      # Validate
    log(" VER: "+ver.__str__())
    size = get_int(4)
    log(" SIZ: "+size.__str__())
    blocks = get_int(4)
    log(" BLK: "+blocks.__str__())
    remainder = get_int(1)
    log(" REM: "+remainder.__str__())

    if (blocks*240)+remainder != size:
        send_bytes("ERR - (blocks*240)+remainder ("+((blocks*240)+remainder).__str__()+") != size ("+size.__str__()+")n")
        exit(253)
    else:
        log("\nHeader validated, awaiting filename")

    filename = ""
    char = get_byte()
    while char != 0:
        filename = filename + chr(char)
        char = get_byte()

    log("\nFilename: "+filename)
    log(" Ready to start blocks\n")

    while blocks:
        block = get_block(240)
        out(block)
        # log(" OK (" + blocks.__str__() + ")\n")
        blocks = blocks - 1

    block = get_block(remainder)
    out(block)


# Confirm we are done
    send_bytes("!\x0D\x0A")

    #LOG log(" REMAINDER OK (" + remainder.__str__() + ")\n")
    log("\n"+datetime.now().strftime("%H:%M:%S")+" - Compeleted transfer\n")
    exit(0)


if __name__ == "__main__":
    main()