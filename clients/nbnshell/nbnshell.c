#pragma printf = "%ld %lu %d %s %c %u %f %X"
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
#include <input.h>
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

// for loops
uint32_t counter;

// Machine State
unsigned long uart_clock[] = { CLK_28_0, CLK_28_1, CLK_28_2, CLK_28_3, CLK_28_4, CLK_28_5, CLK_28_6, CLK_28_7 };
unsigned char old_cpu_speed;

// Filehandle to for saving downloads
unsigned char file_out;

// App state
uint8_t uartVerbose = false;

// App runtime config
unsigned char defaultServer[] = "cdn.nextbestnetwork.com";
unsigned char defaultPort[] = "48128";
uint8_t customServer = 0;
uint8_t customPort = 0;
bool resetWifi = false;

unsigned char directoryPath[254] = "/";
unsigned char commandBuffer[254] = "";
//unsigned char historyBuffer[254] = "";
nbnDirectory_t dirState;

uint8_t commandLen;

// UI Line buffer
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

void shellPrintStatus() {
    printPaper(INK_BLACK); printInk(INK_WHITE); printBrightOn();
    printAt(1,1); printf("CWD: %-45.45s %12s", directoryPath, commandBuffer);
    printPaper(INK_WHITE); printInk(INK_BLACK); printBrightOff();
}

#define REPEAT_START    30
#define REPEAT_AGAIN    10
#define WAIT_FOR_SCANLINE(line)         while (ZXN_READ_REG(REG_ACTIVE_VIDEO_LINE_L) == line); \
                                        while (ZXN_READ_REG(REG_ACTIVE_VIDEO_LINE_L) != line)

bool fake_cursor_inverted = true;
uint8_t fake_cursor_tick = REPEAT_START;
void fake_cursor(void) {
    WAIT_FOR_SCANLINE(239);
    fake_cursor_tick--;
    if(!fake_cursor_tick) {
        fake_cursor_tick = REPEAT_START;

        if(fake_cursor_inverted) {
            printf("_");
        }
        else {
            printf(" ");
        }
        printf("\x1C");  // move cursor back one
        fake_cursor_inverted = !fake_cursor_inverted;
    }
}

int8_t chricmp(unsigned char a, unsigned char b) {
    if((a>64 && a<91)) a=a+32;
    if((b>64 && b<91)) b=b+32;
    return a==b;
}

uint8_t key_repeat_counter = REPEAT_START;
uint8_t last_key = 0;
uint8_t next_key = 0;
uint8_t get_key(void) {
    // Stop holding the previous key
    while(chricmp(next_key, last_key)) {
        next_key = in_inkey();

        if(!next_key) goto ready_next_key;

        fake_cursor();
        key_repeat_counter--;
        if(!key_repeat_counter) {
            // pretend they raised their finger for a moment, and then put it back
            next_key = 0;
            key_repeat_counter = REPEAT_AGAIN;

            goto get_next_key;
        }
    }

    ready_next_key:
    key_repeat_counter = REPEAT_START;
    get_next_key:

    // Now wait for a new key
    while(!next_key) {
        // And if we faked a finger_raise, this will act like it's put down again
        next_key = in_inkey();
        fake_cursor();
    }

    // Remember they key so we don't repeat it
    last_key = next_key;

    return next_key;
}

uint8_t idx;
void wipeWorkspace() {
    printAt(2,1);

    for (idx = 2 ;idx < 22; idx++) {
        printf("%64s", "");
    }
}


#define SHELL_MODE_COMMAND  0
#define SHELL_MODE_DIR      1
uint8_t shellMode;
void shellGetCommand() {
    printPaper(INK_WHITE); printInk(INK_BLACK); printBrightOn();
    printAt(24,1); printf("> %62s", " ");

    commandLen = 0;
    commandBuffer[0] = 0;

command_next_key:
    printAt(24,3+commandLen);
    uint8_t c = 0;

    while(c != 13) {

        if (c > 31 && c < 127 && commandLen < 254) {
            printf("%c", c);
            commandBuffer[commandLen] = c;
            ++commandLen;
            commandBuffer[commandLen] = 0;
        }
        else if(c==12 && commandLen>0) {
            printf(" \x1C\x1C \x1C");   // overprint the cursor with a space, then move back two places,
                                        // print another space, and back one final backwards action
            --commandLen;
            commandBuffer[commandLen] = 0;
        }

        c = get_key();
    }
    printPaper(INK_WHITE); printInk(INK_BLACK); printBrightOff();
}

void shellProcessCommand() {
    char* command = commandBuffer;

    // Ignore blank strings space
    while(isspace((unsigned char)*command)) command++;
    if(*command == 0) return;

    wipeWorkspace();
//    strcpy(historyBuffer, commandBuffer);
reparse:
    printPaper(INK_BLACK); printInk(INK_WHITE);
    printAt(2,1); printf("EXECing ");
    printPaper(INK_WHITE); printInk(INK_BLACK); printBrightOn();
    printf("%-54.54s", commandBuffer, dirState.currentPage);
    printPaper(INK_BLACK); printInk(INK_WHITE);
    printf("  ");
    printPaper(INK_WHITE); printInk(INK_BLACK); printBrightOff();

    command = strtok(commandBuffer, " ");
    if (!*command) return;
    char* arg = strtok(NULL, "");
    /*
     * only handle the commands if in the middle of a DIR listing
     */
    if(shellMode == SHELL_MODE_DIR) {
        if (!stricmp(command, "Q")) {
            shellMode = SHELL_MODE_COMMAND;
            printAt(20, 0);
            printf("%64s", "");
            return;
        } else if (!stricmp(command, "N") && dirState.currentPage < dirState.totalPages) {
            sprintf(commandBuffer, "DIR %d", dirState.currentPage + 1);
            goto reparse;
        }
    }
    /*
     * This has some special logic, as you can rewind a completed directory listing
     */
    if (!stricmp(command, "P") && dirState.currentPage > 1) {
        sprintf(commandBuffer, "DIR %d", dirState.currentPage - 1);
        goto reparse;
    }
    /*
     * At all times we can quit, but Q only works as a shortcut if nothing above took it, based on mode
     */
    if(!stricmp(command, "Q")|| !stricmp(command, "EXIT")|| !stricmp(command, "QUIT") || !stricmp(command, "LOGOUT")) {
        zx_cls(INK_WHITE);
        exit(0);
    }
    /*
     * MACRO EXPANSION
     */
    if(!stricmp(command, ".")||!stricmp(command, "CAT")|| !stricmp(command, "LS")) {
        if(arg) {
            sprintf(commandBuffer, "DIR %s", arg);
        }
        else {
            strcpy(commandBuffer, "DIR");
        }
        goto reparse;
    }
    /*
     * The rest of these are our default command set, and can be run at any time - even in pagination
     */
    else if(!stricmp(command, "DIR")) {
        dirState.currentPage =  atoi(arg);
        if(!dirState.currentPage) dirState.currentPage = 1;

        NBN_GetDirectory(&dirState);
        sprintf(commandBuffer, "Page: %d/%d  ", dirState.currentPage, dirState.totalPages);
        shellPrintStatus();
        // THE DIR LISTING IS IN THE NBNBLOCK currently, so now to display that... we can use nbnBuff as a staging area
        nbnDirectoryEntry_t *entry = nbnBlock;
        nbnDirectoryEntry_t *copy = nbnBuff;
        printAt(3, 0);
        for (idx = 0; idx < dirState.currentPageSize; idx++) {
            NBN_PageIn();
            memcpy(nbnBuff, entry, 6 + strlen(entry->name));
            NBN_PageOut();

            printf(" %-54.54s ", ((nbnDirectoryEntry_t *) &nbnBuff)->name);
            switch (((nbnDirectoryEntry_t *) &nbnBuff)->type) {
                case 0:
                    printf(" <DIR> \n");
                    break;
                case 1:
                    if (((nbnDirectoryEntry_t *) &nbnBuff)->size < 1024) {
                        printf(" %4luB\n", ((nbnDirectoryEntry_t *) &nbnBuff)->size);
                        break;
                    }
                    if (((nbnDirectoryEntry_t *) &nbnBuff)->size < 1024 * 1024) {
                        printf("%4.1fK\n", (((nbnDirectoryEntry_t *) &nbnBuff)->size) / 1024.0);
                        break;
                    }
                    if (((nbnDirectoryEntry_t *) &nbnBuff)->size < 1024 * 1024 * 1024) {
                        printf("%4.1fM\n", (((nbnDirectoryEntry_t *) &nbnBuff)->size) / 1048576.0);
                        break;
                    }
            }
            // Gnarly pointer maths is gnarly
            entry = (uint16_t) entry + 6 + strlen(((nbnDirectoryEntry_t *) &nbnBuff)->name);
        }
        printAtStr(20, 0, "    ");
        if (dirState.currentPage > 1) {
            shellMode = SHELL_MODE_DIR;
            printf("P:Previous Page");
        }
        else {
            printf("               ");
        }

        if (dirState.currentPage < dirState.totalPages) {
            shellMode = SHELL_MODE_DIR;
            printf("    Q:Terminate DIR Listing   N:Next Page");
        }
        else {
            shellMode = SHELL_MODE_COMMAND;
            printf("               DIRECTORY LISTING COMPLETE");
        }
        return;
    }
    else if(!stricmp(command, "CD")) {
        if(NBN_ChangeDirectory((unsigned char *)arg)=='!') {
            //   Directory exists, handle the action
            strcpy(dirState.currentPath, arg);
            printAtStr(4, 4, "Change Directory successful");
            NBN_ParseDirectoryHeader(&dirState);
        }
        else {
            printPaper(INK_RED); printInk(INK_BLACK); printBrightOn(); printFlashOn();
            printAtStr(4,5,  "ERROR: ");
            printFlashOff(); printBrightOff();
            printf("Change Directory FAILED! ");
            printPaper(INK_CYAN); printInk(INK_BLACK); printBrightOn();
            printf(" (Does it exist?)");
            printPaper(INK_WHITE);  printBrightOff();
        }

        strcpy(commandBuffer, "CONNECTED");
        shellPrintStatus();

        return;
    }
    else if(!stricmp(command, "GET")) {
        uint32_t size, blocks;
        uint16_t remainder;

        sprintf(commandBuffer, "GET %s\x0A\x0D", arg);
        NET_Send(commandBuffer, strlen(commandBuffer));

        bool OK = NBN_CheckVersionByte(false);
        if(!OK) return;
        NET_GetUInt32(&size);
        NET_GetUInt32(&blocks);
        NET_GetUInt16(&remainder);

        // reset index for string len mgmt
        counter = 0;
        append_filename:
        nbnBuff[counter] = NET_GetUChar();
        if(nbnBuff[counter]==0) goto begin_transfer;
        counter++;
        goto append_filename;

        begin_transfer:
        errno = 0;
        // Open Write Output
        file_out = esxdos_f_open(nbnBuff, ESXDOS_MODE_W | ESXDOS_MODE_CT);
        // Check
        if (errno)
        {
            printf("Could not create:\n %s\n", nbnBuff);

            exit(errno);
        }
        printf("\x16%c%cName: %-54.54s", 3, 4, nbnBuff);
        printf("\x16%c%cSize: %-8lu bytes", 3, 6, size);

        // FOR BLOCKS
        uint8_t retries = 3;

        for(;blocks>0;blocks--) {
            printf("\x16%c%cParts Remaining: %lu ", 3, 8, blocks);

            // Send "Get next block" command
            NET_PutCh(NBN_BLOCK_SUCCESS);
            NET_Send("1\x0D\x0A", 3);

            receive_next_block:
            if(!NBN_GetBlock(NBN_MAX_BLOCKSIZE)) {
                printf("\x16%c%c   Retry(%d)part: %lu ", 3, 8, retries, blocks);

                blocks++;
                retries--;
                if(!retries)  exit((int)err_transfer_error);

                UART_PutCh(NBN_BLOCK_FAIL);
                NET_Send("\x0D\x0A", 2);
                goto receive_next_block;
            }
            else {
                NBN_WriteBlock(file_out, NBN_MAX_BLOCKSIZE);
                retries = 3;
                // Get data
                NET_PutCh(NBN_BLOCK_SUCCESS);
                NET_Send("\x0D\x0A", 2);
            }
        }
        NET_Send("!", 1);
        NET_Send("\x0D\x0A", 2);

        retries = 3;

        receive_last_block:
        printf("\x16%c%cBytes Remaining: %d ", 3, 8, remainder);
        if(!NBN_GetBlock(remainder)) {
            printf("\x16%c%c Retry(%d) bytes: %d ", 3, 8, retries, remainder);

            blocks++;
            retries--;
            if(!retries)  exit((int)err_transfer_error);

            UART_PutCh(NBN_BLOCK_FAIL);
            NET_Send("\x0D\x0A", 2);
            goto receive_last_block;
        }
        else {
            NBN_WriteBlock(file_out, remainder);
            printf("\x16%c%cFile transfer complete! ", 3, 8);
            NET_PutCh(NBN_BLOCK_SUCCESS);
            NET_Send("\x0D\x0A", 2);
        }

        strcpy(commandBuffer, "COMPLETE!");
        shellPrintStatus();

        return;
    }
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
        /*
         * Straight Forward switches
         */
        if (stricmp(argv[counter], "-h") == 0) {
            help_and_exit(0);
        }
        else if (stricmp(argv[counter], "-v") == 0) {
            UART_SetVerbose(true);
        }
        else if (stricmp(argv[counter], "-r") == 0) {
            resetWifi = true;
        }
        /*
         * Switches with options
         */
        else if (stricmp(argv[counter], "-s") == 0) {
            if(counter+1>argc) {
                // Error
                help_and_exit((int)err_invalid_option);
            }
            counter++;
            customServer = counter;
        }
        else if (stricmp(argv[counter], "-p") == 0) {
            if(counter+1>argc) {
                // Error
                help_and_exit((int)err_invalid_option);
            }
            counter++;

            customPort = counter;
        }
        /* Unknown switch */
        else if (argv[counter][0]=='-') {
            // Error
            help_and_exit((int)err_invalid_option);
        }
    }

    // Register a default shutdown routine, to restore the settings we changed,
    //  this will also close any network, files, underpants, etc we may have left laying open etc...
    atexit(shutdown);

    // Work out our real speed, based on video timing, and set the UART accordingly (move to common/uart later)
    IO_NEXTREG_REG = REG_VIDEO_TIMING;
    prescalar = uart_clock[IO_NEXTREG_DAT] / 115200UL;

    // Set baud at 115,200
    IO_UART_BAUD_RATE = prescalar & 0x7f;                   // lower 7 bits
    IO_UART_BAUD_RATE = ((prescalar >> 7) & 0x7f) | 0x80;   // upper 7 bits

    errno = 0;
    errno = NET_GetOK(true); // We always want localecho here, because it shows up hung wifi modules that way...

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
    while (1){
        errno--;
        unsigned char okflag = NET_GetUChar();

        if (okflag == '>') {
            goto ready;
        }

        if (errno=0) {
            exit((int)err_failed_connection);
        }
    }

    // Disable verbose logging, as we're into "GUI" mode now...
    UART_SetVerbose(false);     // else is breaks the progress meter

ready:
    zx_cls(PAPER_WHITE);

    printPaper(INK_BLACK); printInk(INK_WHITE); printBrightOn();
    printAt(23,1); printf("%-64s", " NextBestNetwork Interactive Shell");
    SPUI_triangle(23,27, PAPER_BLACK  | INK_RED    | BRIGHT);
    SPUI_triangle(23,28, PAPER_RED    | INK_YELLOW | BRIGHT);
    SPUI_triangle(23,29, PAPER_YELLOW | INK_GREEN  | BRIGHT);
    SPUI_triangle(23,30, PAPER_GREEN  | INK_CYAN   | BRIGHT);
    SPUI_triangle(23,31, PAPER_CYAN   | INK_BLACK  | BRIGHT);
    commandBuffer[0] = 0;
    shellPrintStatus();

    // Set base config
    dirState.currentPath = (unsigned char *) &directoryPath;
    dirState.totalEntries = 1;
    dirState.currentPage = 1;
    dirState.currentPageSize = 0;
    dirState.totalPages = 1;
    strcpy(commandBuffer, "CONNECTED");
    shellPrintStatus();

    if(!NBN_Malloc()) {
        // DIE DUE TO NO MEMORY
        printf("NO MEMORY");
        exit(0);
    }

    uint8_t shellMode = SHELL_MODE_COMMAND;
get_command:
    shellGetCommand();
    shellProcessCommand();

    goto get_command;
}
