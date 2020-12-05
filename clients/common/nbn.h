//
// Created by D Rimron-Soutter on 31/03/2020.
//

#ifndef NBNTOOLS_NBN_H
#define NBNTOOLS_NBN_H

#define NBN_PROTOCOL_VERSION    2

#define NBN_MAX_BLOCKSIZE       4096

#define NBN_BLOCK_SUCCESS               '!'
#define NBN_BLOCK_FAIL                  '<'

#define ULA_BOTTOM_PAGE         10
#define ULA_TOP_PAGE            11


#define NBN_GetUChar                    UART_GetUChar
#define NBN_GetUInt8                    UART_GetUChar
#define NBN_GetUInt16                   UART_GetUInt16
#define NBN_GetUInt32                   UART_GetUInt32

#include <stdlib.h>
#include <stdlib.h>
#include <stdbool.h>

// App state
typedef struct {
    uint16_t totalEntries;
    uint16_t currentPage;
    uint8_t currentPageSize;
    uint16_t totalPages;
} nbnDirectory_t;

// The two 8K pages that make up our "cache bank"
extern uint8_t nbnBottom8KPage, nbnTop8KPage;

extern unsigned char *nbnBlock;

// MemManager for the RAM we page over the ULA
bool NBN_Malloc();
void NBN_Free();
unsigned char NBN_GetStatus();

// THIS DOES ULA MEMORY PAGING, DO NOT RUN WITH INTERRUPTS ENABLED - JUST IN CASE!
bool NBN_GetBlock(uint16_t blockSize);
bool NBN_WriteBlock(uint8_t fileHandle, uint16_t blockSize);
bool NBN_GetDirectory(nbnDirectory_t *dir);


#endif //NBNTOOLS_NBN_H
