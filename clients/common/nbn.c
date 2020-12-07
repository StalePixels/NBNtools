//
// Created by D Rimron-Soutter on 31/03/2020.
//

#include <arch/zxn.h>
#include <arch/zxn/esxdos.h>
#include <stdio.h>
#include <stdlib.h>
#include <errno.h>
#include <string.h>
#include "nbn.h"
#include "uart.h"
#include "messages.h"
#include "net.h"

uint8_t nbnBottom8KPage = 0, nbnTop8KPage = 0;
unsigned char *nbnBlock = 0x4000;
unsigned char nbnBuff[260];

bool NBN_Malloc() {
    nbnBottom8KPage = esx_ide_bank_alloc(0);
    nbnTop8KPage = esx_ide_bank_alloc(0);

    if (!nbnBottom8KPage || !nbnTop8KPage) return false;

    return true;
}

void NBN_Free() {
    if(nbnBottom8KPage) esx_ide_bank_free(0, nbnBottom8KPage);
    if(nbnTop8KPage)    esx_ide_bank_free(0, nbnTop8KPage);
}

unsigned char NBN_GetStatus() {
    unsigned char status[4];
    status[0] = UART_GetUChar();
    status[1] = UART_GetUChar();
    status[2] = UART_GetUChar();
    status[3] = 0;

    if((status[0] == NBN_BLOCK_SUCCESS || status[0] == NBN_BLOCK_FAIL) && status[1] == '\x0D' && status[2] == '\x0A') {
        return(status[0]);
    } else {
        printf("%s", status);
        UART_WaitOK(true);
        exit((int)err_nbn_protocol);
    }
}

bool NBN_GetBlock(uint16_t blockSize) __z88dk_fastcall {
    uint8_t nbnComputed = 0;

    NBN_PageIn();
    for(uint16_t nbnByte = 0; nbnByte < blockSize; nbnByte++) {
        nbnBlock[nbnByte] = NET_GetUChar();
        // #1. This is basically a glorious hack, keep adding bytes to an uint8, then...
        nbnComputed = nbnComputed + nbnBlock[nbnByte];
        zx_border(nbnBlock[nbnByte]%8);
    }
    NBN_PageOut();

    uint8_t nbnChecksum =  NET_GetUChar();

    // #2. ...only care about the final result. "Free" mod256 maths
    if(nbnChecksum == nbnComputed) {
        return true;
    }
    printf("%d vs %d\n\n", nbnComputed, nbnChecksum);
    return false;
}

bool NBN_CheckVersionByte(bool fatal) __z88dk_fastcall {
    errno = NET_GetUChar();
    bool pass = true;

    if(errno!=NBN_PROTOCOL_VERSION) {              // VALIDATE PROTOCOL VERSION
        if(errno&64) {          // And, check that the character was ASCII, Protocols only ever go up to V63,
            //  so if we get back a bit7(64+) char, we know it's not a protocol header...
            //
            // Now generate an error, the first character of which is already in errno...
            printf("\n Server Said: %c", errno);
            NET_WaitOK(true);
            if(fatal) {
                exit((int) err_nbn_protocol);
            }
            else {
                pass = false;
            }
        }
        if(fatal) {
            exit((int) err_wrong_version);
        }
        else {
            pass = false;
        }
    }

    return pass;
}

void NBN_ParseDirectoryHeader(nbnDirectory_t *dir)  __z88dk_fastcall  {
    NBN_CheckVersionByte(true);
    // Get the DIRHEADER
    // Copy the filename
    uint8_t dirLen = 0;
    uint8_t chr = NET_GetUInt8();
    while(chr) {
        dir->currentPath[dirLen++] = chr;
        chr = NET_GetUInt8();
    }
    // now add the NULL
    dir->currentPath[dirLen] = chr;
    NET_GetUInt16(&(dir->totalEntries));
    NET_GetUInt16(&(dir->currentPage));
    dir->currentPageSize = NET_GetUChar();
    NET_GetUInt16(&(dir->totalPages));
}

unsigned char NBN_ChangeDirectory(char *dir) __z88dk_fastcall {
    sprintf(nbnBuff, "CD %s\x0A\x0D", dir);
    NET_Send(nbnBuff, strlen(nbnBuff));

    return NBN_GetStatus();
}

void NBN_StatDirectory(nbnDirectory_t *dir)  __z88dk_fastcall  {
    sprintf(nbnBuff, "STAT %s\x0A\x0D", dir->currentPath);
    NET_Send(nbnBuff, strlen(nbnBuff));

    NBN_ParseDirectoryHeader(dir);
}

void NBN_GetDirectory(nbnDirectory_t *dir)  __z88dk_fastcall  {
    sprintf(nbnBuff, "DIR %d\x0A\x0D", dir->currentPage);
    NET_Send(nbnBuff, strlen(nbnBuff));

    // Get the DIRHEADER
    NBN_ParseDirectoryHeader(dir);
    uint16_t nbnBlockSize;
    NET_GetUInt16(&nbnBlockSize);

    if(!NBN_GetBlock(nbnBlockSize))
        exit((int)err_transfer_error);
}

bool NBN_WriteBlock(uint8_t fileHandle, uint16_t blockSize) {
    errno = 0;

    NBN_PageIn();

    esxdos_f_write(fileHandle, nbnBlock, blockSize);


    NBN_PageOut();

    if(errno) {
        return false;
    }

    return true;
}