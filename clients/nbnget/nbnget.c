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
#include "messages.h"
#include "help.h"

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
static bool verbose = false;
static unsigned char defaultServer[] = "cdn.nextbestnetwork.com";
static unsigned char defaultPort[] = "48128";
static uint8_t customServer = 0;
static uint8_t customPort = 0;
static uint8_t fileArg = 1;


void looper() {
    for(uint32_t i = 512; i>0;i--) {
        zx_border((uint8_t)i%7);
//        zx_border(7);
    }
}

unsigned char Net_GetUChar() {
    zx_border(3);
    unsigned long checking;
    for(checking=0;checking<131071UL;checking++) {
        if (IO_UART_STATUS & IUS_RX_AVAIL) {  // Busy wait to send a single byte.
            zx_border(0);
            return IO_UART_RX;
        }
    }
    exit((int)err_timeout_byte);
}

void Net_Send(char command[], uint8_t len) {
    uint8_t command_letter = 0;

    for(;len!=0;len--) {
        zx_border(4);
        while (IO_UART_STATUS & IUS_TX_BUSY);  // Busy wait to send a single byte.
        if(verbose) printf("\x12\x31%c\x12\x30", command[command_letter]);
        IO_UART_TX = command[command_letter++];
    }
}

uint8_t Net_WaitOK(bool localecho) {
    unsigned char cbuff[4];
repeat:
    cbuff[0] = cbuff[1];
    cbuff[1] = cbuff[2];
    cbuff[2] = cbuff[3];
    cbuff[3] = Net_GetUChar();

    if(localecho==true) printf("%c", cbuff[3]);

    if (cbuff[3] == 10 && cbuff[2] == 13 && cbuff[1] == 'K' && cbuff[0] == 'O') {
        return 0;
    } else if (cbuff[3] == 10 && cbuff[2] == 13 && cbuff[1] == 'R' && cbuff[0] == 'O') {
        return 254;
    }
    goto repeat;
}

int Net_Command(char command[], uint8_t len) {
    uint8_t command_letter = 0;

    Net_Send("AT+CIP", 6);
    Net_Send(command, len);
    Net_Send("\x0D\x0A", 2);

    return Net_WaitOK(false);
}

void Net_Close() {
    Net_Send("+++", 3);
    looper();

    Net_Command("MODE=0", 6);
    Net_Command("CLOSE", 5);
    looper();
}

void NBN_GetBlock(uint8_t blockSize) {
    uint16_t valid = 0;
    uint8_t retries = 0;

download_block:
    for(uint8_t byte = 0; byte<blockSize;byte++) {
        block[byte] = Net_GetUChar();
        valid = valid + block[byte];
    }

    uint8_t byte = Net_GetUChar();
    checksum = byte;
    checksum = checksum<<8;

    byte = Net_GetUChar();
    checksum = checksum + byte;

    if(checksum!=valid) {
        retries++;

        if(retries>3) {
            exit((int) err_transfer_error);
        }
        // Get data
        Net_Send("?", 1);
        Net_Send("\x0D\x0A", 2);

        zx_border(2);
        valid = 0;
        goto download_block;
    } else {
        zx_border(1);
        esxdos_f_write(file_out, block, blockSize);
    }
}

static void shutdown() {
    Net_Close();
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
//
//    if (argc == 1) {
//        // Error
//        showhelp();
//        exit((int)err_missing_filename);
//    }

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

    printf("Closing Existing connections...\n");

    Net_Close();

    printf("Opening: NextBestNetwork");

    Net_Send("AT+CIPSTART=\"TCP\",\"", 19);


    if(customServer) {
        Net_Send(argv[customServer], strlen(argv[customServer]));
    } else {
        Net_Send(defaultServer, strlen(defaultServer));
    }

    Net_Send("\",", 2);
    if(customPort) {
        Net_Send(argv[customPort], strlen(argv[customPort]));
    } else {
        Net_Send(defaultPort, strlen(defaultPort));
    }
    Net_Send("\x0D\x0A", 2);
    errno = Net_WaitOK(false);

    if(errno) {
        exit((int)err_failed_connection);
    }
    printf(" - DONE\n");

    errno = Net_Command("MODE=1", 6);
    if(errno) {
        exit((int)err_at_protocol);
    };

    Net_Command("SEND", 4);
    if(errno) {
        exit((int)err_at_protocol);
    };

    errno = 255;
    while (1) {
        errno--;
        unsigned char okflag = Net_GetUChar();

        if (okflag == '>') {
            goto get_file;
        }

        if (errno=0) {
            exit((int)err_failed_connection);
        }
    }

get_file:
    Net_Send("GET ",4);
    Net_Send(argv[fileArg], strlen(argv[fileArg]));
    Net_Send("\x0A", 1);

    errno = Net_GetUChar();
    if(errno!=1) {              // VALIDATE PROTOCOL VERSION
        if(errno&64) {          // And, check that the character was ASCII, Protocols only ever go up to V63,
                                //  so if we get back a bit7(64+) char, we know it's not a protocol header...
                                //
                                // Now generate an error, the first character of which is already in errno...
            printf("\n Server Said: %c", errno);
            Net_WaitOK(true);
            exit((int)err_file_not_found);
        }

        exit((int)err_wrong_version);
    }
    counter = Net_GetUChar();
    size = (counter<<24);
    counter = Net_GetUChar();
    size = size + (counter<<16);
    counter = Net_GetUChar();
    size = size + (counter<<8);
    counter = Net_GetUChar();
    size = size + counter;

    counter = Net_GetUChar();
    blocks = (counter<<24);
    counter = Net_GetUChar();
    blocks = blocks + (counter<<16);
    counter = Net_GetUChar();
    blocks = blocks + (counter<<8);
    counter = Net_GetUChar();
    blocks = blocks + counter;

    remainder = Net_GetUChar();

    // reset index for string
    counter = 0;
append_filename:
    filename[counter] = Net_GetUChar();
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
    file_out = esxdos_f_open(filename, ESXDOS_MODE_W | ESXDOS_MODE_CT);

    // Check
    if (errno)
    {
        printf("Could not create:\n %s\n", filename);

        exit(errno);
    }

    // FOR BLOCKS
    for(;blocks>0;blocks--) {
        // Get data
        Net_Send("!", 1);
        Net_Send("\x0D\x0A", 2);

        NBN_GetBlock(240);

        printf("\x16\x01\x07");
        printf("Blocks: %lu left \n   ", blocks);
        printf("\x16\x01\x08");
    }

    Net_Send("!", 1);
    Net_Send("\x0D\x0A", 2);

    printf("\x16\x01\x07");
    printf("Blocks: %lu left \n   ", blocks);
    printf("\x16\x01\x08");

    NBN_GetBlock(remainder);

    exit(0);
}
