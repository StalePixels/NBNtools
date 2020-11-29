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

bool NBN_Malloc() {
    nbnBottom8KPage = esx_ide_bank_alloc(0);
    nbnTop8KPage = esx_ide_bank_alloc(0);

    printf ("GOT %d and %d\n", nbnBottom8KPage, nbnTop8KPage);

    if (!nbnBottom8KPage || !nbnTop8KPage) return false;

    return true;
}

void NBN_Free() {
    esx_ide_bank_free(0, nbnBottom8KPage);
    esx_ide_bank_free(0, nbnTop8KPage);
}

unsigned char NBN_GetStatus() {
    unsigned char status[4];
    status[0] = UART_GetUChar();
    status[1] = UART_GetUChar();
    status[2] = UART_GetUChar();
    status[3] = 0;


    if((status[0] == '!' || status[0] == '?') && status[1] == '\x0D' && status[2] == '\x0A') {
        return(status[0]);
    } else {
        printf("%s", status);
        UART_WaitOK(true);
        exit((int)err_nbn_protocol);
    }
}

bool NBN_GetBlock(uint16_t blockSize) {
    uint8_t nbnComputed = 0;

    ZXN_WRITE_MMU2(nbnBottom8KPage);
    ZXN_WRITE_MMU3(nbnTop8KPage);
    for(uint16_t nbnByte = 0; nbnByte < blockSize; nbnByte++) {
        nbnBlock[nbnByte] = NET_GetUChar();
        // #1. This is basically a glorious hack, keep adding bytes to an uint8, then...
        nbnComputed = nbnComputed + nbnBlock[nbnByte];
        zx_border(nbnBlock[nbnByte]%8);
    }
    ZXN_WRITE_MMU2(ULA_BOTTOM_PAGE);
    ZXN_WRITE_MMU3(ULA_TOP_PAGE);

    uint8_t nbnChecksum =  NET_GetUChar();

    // #2. ...only care about the final result. "Free" mod256 maths
    if(nbnChecksum == nbnComputed) {
        return true;
    }

    return false;
}

bool NBN_WriteBlock(uint8_t fileHandle, uint16_t blockSize) {
    errno = 0;

    ZXN_WRITE_MMU2(nbnBottom8KPage);
    ZXN_WRITE_MMU3(nbnTop8KPage);

    esxdos_f_write(fileHandle, nbnBlock, blockSize);

    ZXN_WRITE_MMU2(ULA_BOTTOM_PAGE);
    ZXN_WRITE_MMU3(ULA_TOP_PAGE);

    if(errno) {
        return false;
    }

    return true;
}