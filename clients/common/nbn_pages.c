//
// The two 8K pages that NBN_GetBlock pages over the screen. Apart from nbn.c
// because allocating them is an M_P3DOS call, which a program that banks the
// rest of the NBN code keeps in main memory.
//

#ifdef __ZXNEXT
#include <arch/zxn/esxdos.h>
#endif
#include <stdbool.h>
#include "nbn.h"

uint8_t nbnBottom8KPage = 0, nbnTop8KPage = 0;

#ifndef __ZXNEXT
// The same size as the two 8K pages the Next build uses
static unsigned char nbnBlockMemory[16384];
unsigned char *nbnBlock = nbnBlockMemory;

bool NBN_Malloc() {
    return true;
}

void NBN_Free() {
}
#else
unsigned char *nbnBlock = 0x4000;

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
#endif
