#pragma printf = "%ld %lu %d %s %c %u %x"
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

#include "help.h"
#include "../common/messages.h"
#include "../common/util.h"
#include "../common/uart.h"
#include "../common/net.h"
#include "../common/nbn.h"
#include "../common/ula.h"
#include "../common/spui_lite.h"

unsigned int prescalar;

// File Header
static uint32_t blocks = 0;
static uint32_t size = 0;
static uint16_t remainder = 0;
static unsigned char filename[128];

// For file Transfers
static unsigned char block[240];
static uint16_t checksum;

// for loops
uint32_t counter;

// Machine State
static unsigned long uart_clock[] = { CLK_28_0, CLK_28_1, CLK_28_2, CLK_28_3, CLK_28_4, CLK_28_5, CLK_28_6, CLK_28_7 };
static unsigned char old_cpu_speed;

// Filehandle to for saving downloads
unsigned char file_out;

// App state
uint8_t uartVerbose = false;

// App runtime config
static unsigned char defaultServer[] = "cdn.nextbestnetwork.com";
static unsigned char defaultPort[] = "48128";
static uint8_t customServer = 0;
static uint8_t customPort = 0;
static uint8_t fileArg = 1;
static bool verbose = 0;
static bool resetWifi = false;

// App state



static void shutdown() {
    NET_Close();
    esxdos_f_close(file_out);
    NBN_Free();

    zx_border(7);
    ZXN_NEXTREGA(REG_TURBO_MODE, old_cpu_speed);
}

static void help_and_exit(int exit_value) __z88dk_fastcall {
    printf("%s",help);
    printf("\nv%s by %s",version, credits);

    ZXN_NEXTREGA(REG_TURBO_MODE, old_cpu_speed);
    exit(exit_value);
}

int main(int argc, char** argv) {
    // We need to restore this on exit...
    old_cpu_speed = ZXN_READ_REG(REG_TURBO_MODE);

    // Put Z80 in 28 MHz turbo mode.
    ZXN_NEXTREG(REG_TURBO_MODE, 3);

    zx_cls(PAPER_WHITE);

    counter = 0;
    // Let's check some options out
    while(counter<argc) {
        counter=counter+1;
        if (stricmp(argv[counter], "-h") == 0) {
            // Dump the help file
            help_and_exit(0);
        } else

        if (stricmp(argv[counter], "-v") == 0) {
            // make sure I'm not the last param...  (this needs deduping!)
            if(counter+1<argc) {
                UART_SetVerbose(true);
            } else {
                // Error
                help_and_exit((int)err_missing_filename);
            }
        } else

        if (stricmp(argv[counter], "-s") == 0) {
            // make sure I'm not the last param...  (this needs deduping!)
            if(counter+2>argc) {
                // Error
                help_and_exit((int)err_bad_server);
            }
            counter++;

            customServer = counter;
        } else

        if (stricmp(argv[counter], "-p") == 0) {
            // make sure I'm not the last param...  (this needs deduping!)
            if(counter+2>argc) {
                // Error
                help_and_exit((int)err_bad_port);
            }
            counter++;

            customPort = counter;
        } else

        if (stricmp(argv[counter], "-r") == 0) {
            // make sure I'm not the last param...  (this needs deduping!)
            if(counter+2>argc) {
                // Error
                help_and_exit((int)err_missing_filename);
            }

            resetWifi = true;
        } else

        if (argv[counter][0]=='-') {
            // Error
            help_and_exit((int)err_missing_filename);
        } else

        if (counter+1 == argc) {
            // This is the last option
            fileArg = counter;
            break;
        } else {
            // Error
            help_and_exit((int)err_missing_filename);
        }
    }

    // Register a default shutown routine, to restore the settings we changed, and handle network, etc...
    atexit(shutdown);

    // Work out our real speed, based on video timing, and set the UART accordingly (move to common/uart later)
    IO_NEXTREG_REG = REG_VIDEO_TIMING;
    prescalar = uart_clock[IO_NEXTREG_DAT] / 115200UL;

    // Set baud at 115,200
    IO_UART_BAUD_RATE = prescalar & 0x7f;                   // lower 7 bits
    IO_UART_BAUD_RATE = ((prescalar >> 7) & 0x7f) | 0x80;   // upper 7 bits

    errno = 0;
    errno = NET_GetOK(verbose);

    if(errno || resetWifi) {
        printf("Closing Existing connections...\n");
        NET_Close();
    }

    printf("Opening: NextBestNetwork\n");

    NET_Connect((customServer ? argv[customServer] : defaultServer), (customPort ? argv[customPort] : defaultPort));

    errno = UART_WaitOK(false);

    if(errno) {
        exit((int)err_failed_connection);
    }
    printf("\nConnected!\n");

    NET_ModeSingle();

    NET_OpenSocket();

    errno = 255;                                        // Wait for the server to send the ">" prompt
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

    NBN_CheckVersionByte();
    NET_GetUInt32(&size);
    NET_GetUInt32(&blocks);
    NET_GetUInt16(&remainder);

    // reset index for string len mgmt
    counter = 0;
append_filename:
    filename[counter] = NET_GetUChar();
    if(filename[counter]==0) goto begin_transfer;
    counter++;
    goto append_filename;

begin_transfer:

    if(!NBN_Malloc()) {
        // DIE DUE TO NO MEMORY
        printf("NO MEMORY`N");
        exit(0);
    }

    errno = 0;
    // Open Write Output
    file_out = esxdos_f_open(filename, ESXDOS_MODE_W | ESXDOS_MODE_CT);
    // Check
    if (errno)
    {
        printf("Could not create:\n %s\n", filename);

        exit(errno);
    }

    zx_cls(PAPER_WHITE);

    printInk(INK_WHITE);
    printPaper(INK_BLACK);
    printBrightOn();
    printAtStr( 8, 6, " NextBestNetwork      ");

    SPUI_logo(8,22);
    printInk(INK_BLACK);
    printPaper(INK_WHITE);
    printAtStr( 9, 6, "                      ");
    SPUI_line(9, 6, SPUI_LINE_LEFT);
    SPUI_line(9, 27, SPUI_LINE_RIGHT);
    printf("\x16%c%c Name: %-14s ", 6, 10, filename);
    SPUI_line(10, 6, SPUI_LINE_LEFT);
    SPUI_line(10, 27, SPUI_LINE_RIGHT);
    printf("\x16%c%c Size: %8lu bytes ", 6, 11, size);
    SPUI_line(11, 6, SPUI_LINE_LEFT);
    SPUI_line(11, 27, SPUI_LINE_RIGHT);
    printAtStr(12, 6, "                      ");
    SPUI_line(12, 6, SPUI_LINE_LEFT);
    SPUI_line(12, 27, SPUI_LINE_RIGHT);
    printAtStr(13, 6, "                      ");
    SPUI_line(13, 6, SPUI_LINE_LEFT);
    SPUI_line(13, 27, SPUI_LINE_RIGHT);
    printAtStr(14, 6, "______________________");
    SPUI_line(14, 6, SPUI_LINE_LEFT_BOTTOM);
    SPUI_line(14, 27, SPUI_LINE_RIGHT_BOTTOM);


    printAt(13, 7);

    UART_SetVerbose(false);     // else is breaks the progress meter


    // FOR BLOCKS
    uint8_t retries = 3;

    uint8_t progress_style = 0; // slow
    uint8_t progress_block_size;
    uint16_t progress_parts = blocks + 1;
    uint16_t progress_part = 1;
    uint16_t progress = 0;
    char progressChar = ' ';

#define PROGRESS_WIDTH 20.0f

    float block_progress_percent = blocks / PROGRESS_WIDTH;

    for(;blocks>0;blocks--) {
        printInk(INK_BLACK);
        printPaper(INK_YELLOW);
        printFlashOn();

        // Send "Get next block" command
        NET_PutCh(NBN_BLOCK_SUCCESS);
        NET_Send("1\x0D\x0A", 3);

    receive_next_block:
        printf("%c", progressChar);
        if(!NBN_GetBlock(NBN_MAX_BLOCKSIZE)) {
            printf("\x1C");  // move cursor back one
            sprintf(&progressChar, "%d", retries);
            printPaper(INK_YELLOW);
            printInk(INK_RED);

            blocks++;
            retries--;
            if(!retries)  exit((int)err_transfer_error);

            UART_PutCh(NBN_BLOCK_FAIL);
            NET_Send("\x0D\x0A", 2);
            goto receive_next_block;
        }
        else {
            NBN_WriteBlock(file_out, NBN_MAX_BLOCKSIZE);

            printPaper(INK_GREEN);
            printFlashOff();
            printf("\x1C");  // move cursor back one
            if (progress_style) {
                for (uint8_t iter8 = progress_part; iter8 > 0; --iter8) {
                    printf("%c", progressChar);
                }
            } else {
                progress++;
                if (progress >= progress_parts * (progress_part / PROGRESS_WIDTH)) {
                    ++progress_part;
                    printf("%c", progressChar);
                }
            }
            progressChar = ' ';
            retries = 3;
            // Get data
            NET_PutCh(NBN_BLOCK_SUCCESS);
            NET_Send("\x0D\x0A", 2);
        }
    }
    NET_Send("!", 1);
    NET_Send("\x0D\x0A", 2);


    printInk(INK_BLACK);
    printPaper(INK_YELLOW);
    printFlashOn();
    retries = 3;

receive_last_block:
    printf("%c", progressChar);
    if(!NBN_GetBlock(remainder)) {
        printf("\x1C");  // move cursor back one
        sprintf(&progressChar, "%d", retries);
        printPaper(INK_YELLOW);
        printInk(INK_RED);

        blocks++;
        retries--;
        if(!retries)  exit((int)err_transfer_error);

        UART_PutCh(NBN_BLOCK_FAIL);
        NET_Send("\x0D\x0A", 2);
        goto receive_last_block;
    }
    else {
        NBN_WriteBlock(file_out, remainder);

        printPaper(INK_GREEN);
        printFlashOff();
        printf("\x1C");  // move cursor back one
        if (progress_style) {
            for (uint8_t iter8 = progress_part; iter8 > 0; --iter8) {
                printf("%c", progressChar);
            }
        } else {
            progress++;
            if (progress >= progress_parts * (progress_part / PROGRESS_WIDTH)) {
                ++progress_part;
                printf("%c", progressChar);
            }
        }
    }

    printAtStr(13, 7, " Transfer Complete! ");

    printBrightOff();
    printInk(INK_BLACK);
    printPaper(INK_WHITE);

    exit(0);
}
