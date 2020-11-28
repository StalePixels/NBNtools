#pragma printf = "%ld %lu %d %s %c %u"
#pragma output CLIB_EXIT_STACK_SIZE = 1

#include <z80.h>
#include <arch/zxn.h>
#include <intrinsic.h>
#include <arch/zxn/esxdos.h>

#include <ctype.h>
#include <errno.h>
#include <input.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>
#include <string.h>

#include "nbnget.h"
#include "help.h"
#include "../common/messages.h"
#include "../common/util.h"
#include "../common/uart.h"
#include "../common/net.h"

unsigned int prescalar;

// File Header
static uint32_t blocks = 0;
static uint32_t size = 0;
static uint8_t remainder = 0;
static unsigned char filename[128];

// For file Transfers
static unsigned char block[240];
static uint16_t checksum;

// for loops
uint32_t counter;

// Machine State
static unsigned long uart_clock[] = { CLK_28_0, CLK_28_1, CLK_28_2, CLK_28_3, CLK_28_4, CLK_28_5, CLK_28_6, CLK_28_7 };
static unsigned char old_cpu_speed;

// used by read and write...
unsigned char file_out;

// Runtime Function flags
uint8_t verbose = false;
static unsigned char defaultServer[] = "cdn.nextbestnetwork.com";
static unsigned char defaultPort[] = "48128";
static uint8_t customServer = 0;
static uint8_t customPort = 0;
static uint8_t fileArg = 1;
static bool resetWifi = false;

static void shutdown() {
    NET_Close();
    esxdos_f_close(file_out);

    zx_border(7);
    ZXN_NEXTREGA(REG_TURBO_MODE, old_cpu_speed);
}

static void showhelp() {
    printf("%s",help);
    printf("\nv%s by %s",version, credits);
}

int main(int argc, char** argv) {
    zx_cls(PAPER_WHITE);

    counter = 0;
    // Let's check some options out
    while(counter<argc) {
        counter=counter+1;
        if (stricmp(argv[counter], "-h") == 0) {
            // Dump the help file
            showhelp();
            exit(0);
        } else

        if (stricmp(argv[counter], "-v") == 0) {
            // make sure I'm not the last param...
            if(counter+1<argc) {
                verbose = true;
            } else {
                // Error
                showhelp();
                exit((int)err_missing_filename);
            }
        } else

        if (stricmp(argv[counter], "-s") == 0) {

            // make sure I'm not the last param...
            if(counter+2>argc) {
                // Error
                showhelp();
                exit((int)err_bad_server);
            }
            counter++;

            customServer = counter;
        } else

        if (stricmp(argv[counter], "-p") == 0) {

            // make sure I'm not the last param...
            if(counter+2>argc) {
                // Error
                showhelp();
                exit((int)err_bad_port);
            }
            counter++;

            customPort = counter;
        } else

        if (stricmp(argv[counter], "-r") == 0) {

            // make sure I'm not the last param...
            if(counter+2>argc) {
                // Error
                showhelp();
                exit((int)err_missing_filename);
            }

            resetWifi = true;
        } else

        if (argv[counter][0]=='-') {
            // Error
            showhelp();
            exit((int)err_missing_filename);
        } else

        if (counter+1 == argc) {
            // This is the last option
            fileArg = counter;
            break;
        } else {
            // Error
            showhelp();
            exit((int)err_missing_filename);
        }
    }

    // We need to restore this on exit...
    old_cpu_speed = ZXN_READ_REG(REG_TURBO_MODE);

    // Put Z80 in 28 MHz turbo mode.
    ZXN_NEXTREG(REG_TURBO_MODE, 3);

    atexit(shutdown);

    // Work out our real speed, based on video timing
    IO_NEXTREG_REG = REG_VIDEO_TIMING;
    prescalar = uart_clock[IO_NEXTREG_DAT] / 115200UL;

    // Set baud at 115,200
    IO_UART_BAUD_RATE = prescalar & 0x7f;                   // lower 7 bits
    IO_UART_BAUD_RATE = ((prescalar >> 7) & 0x7f) | 0x80;   // upper 7 bits

    if(resetWifi) {
        printf("Closing Existing connections...\n");
        NET_Close();
    }
    printf("Opening: NextBestNetwork");
    NET_Send("AT+CIPSTART=\"TCP\",\"", 19);

    if(customServer) {
        NET_Send(argv[customServer], strlen(argv[customServer]));
    } else {
        NET_Send(defaultServer, strlen(defaultServer));
    }

    NET_Send("\",", 2);
    if(customPort) {
        NET_Send(argv[customPort], strlen(argv[customPort]));
    } else {
        NET_Send(defaultPort, strlen(defaultPort));
    }
    NET_Send("\x0D\x0A", 2);
    errno = NET_GetOK(true);

    if(errno) {
        exit((int)err_failed_connection);
    }
    printf(" - DONE\n");

    errno = NET_Command("MODE=1", 6);
    if(errno) {
        exit((int)err_at_protocol);
    };

    NET_Command("SEND", 4);
    if(errno) {
        exit((int)err_at_protocol);
    };

    errno = 255;
    while (1) {
        errno--;
        unsigned char okflag = NET_GetUChar();

        if (okflag == '>') {
            goto get_file;
        }

        if (errno=0) {
            exit((int)err_failed_connection);
        }
    }

get_file:
    NET_Send("GET ",4);
    NET_Send(argv[fileArg], strlen(argv[fileArg]));
    NET_Send("\x0A", 1);

    errno = NET_GetUChar();
    if(errno!=2) {              // VALIDATE PROTOCOL VERSION
        if(errno&64) {          // And, check that the character was ASCII, Protocols only ever go up to V63,
                                //  so if we get back a bit7(64+) char, we know it's not a protocol header...
                                //
                                // Now generate an error, the first character of which is already in errno...
            printf("\n Server Said: %c", errno);
            NET_GetOK(true);
            exit((int)err_file_not_found);
        }

        exit((int)err_wrong_version);
    }
    counter = NET_GetUChar();
    size = (counter<<24);
    counter = NET_GetUChar();
    size = size + (counter<<16);
    counter = NET_GetUChar();
    size = size + (counter<<8);
    counter = NET_GetUChar();
    size = size + counter;

    counter = NET_GetUChar();
    blocks = (counter<<24);
    counter = NET_GetUChar();
    blocks = blocks + (counter<<16);
    counter = NET_GetUChar();
    blocks = blocks + (counter<<8);
    counter = NET_GetUChar();
    blocks = blocks + counter;

    counter = NET_GetUChar();
    remainder = (counter<<8);
    counter = NET_GetUChar();
    remainder = remainder + counter;


    // reset index for string
    counter = 0;
append_filename:
    filename[counter] = NET_GetUChar();
    if(filename[counter]==0) goto begin_transfer;
    counter++;
    goto append_filename;

begin_transfer:
    zx_cls(PAPER_WHITE);
    printf("\x16\x01\x01" "-=-NextBestNetwork Downloader-=-\n");
    printf("\nRemote Filename:\n %s\n\n", filename);
    printf("Size: %lu\n", size);
    printf("Blocks: %lu\n", blocks);

    errno = 0;
    // Open Write Output
//    file_out = esxdos_f_open(filename, ESXDOS_MODE_W | ESXDOS_MODE_CT);

    // Check
//    if (errno)
//    {
//        printf("Could not create:\n %s\n", filename);
//
//        exit(errno);
//    }
//
//    // FOR BLOCKS
//    for(;blocks>0;blocks--) {
//        // Get data
//        NET_Send("!", 1);
//        NET_Send("\x0D\x0A", 2);
//
//        NBN_GetBlock(240);
//
//        printf("\x16\x01\x07");
//        printf("Blocks: %lu left \n   ", blocks);
//        printf("\x16\x01\x08");
//    }
//
//    NET_Send("!", 1);
//    NET_Send("\x0D\x0A", 2);
//
//    printf("\x16\x01\x07");
//    printf("Blocks: %lu left \n   ", blocks);
//    printf("\x16\x01\x08");
//
//    NBN_GetBlock(remainder);

    printf(" Gracefully finished...\n");
    exit(0);
}
