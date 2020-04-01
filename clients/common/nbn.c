//
// Created by D Rimron-Soutter on 31/03/2020.
//

#include <arch/zx.h>
#include <stdio.h>
#include <stdlib.h>
#include "nbn.h"
#include "uart.h"
#include "messages.h"

void NBN_GetBlock(char[] block) {
    uint16_t valid = 0;
    uint8_t retries = 0;
    uint16_t checksum;

    download_block:
    for(uint8_t byte = 0; byte<NBN_blocksize;byte++) {
        block[byte] = UART_GetUChar();
        valid = valid + block[byte];
    }

    uint8_t byte = UART_GetUChar();
    checksum = byte;
    checksum = checksum<<8;

    byte = UART_GetUChar();
    checksum = checksum + byte;

    if(checksum!=valid) {
        retries++;

        if(retries>3) {
            exit((int) err_transfer_error);
        }
        // Get data
        UART_Send("?", 1);
        UART_Send("\x0D\x0A", 2);

        zx_border(2);
        valid = 0;
        goto download_block;
    } else {
        zx_border(1);
//        esxdos_f_write(file_in, block, NBN_blocksize);
    }
}

void NBN_SendBlock(char[] block) {
    uint16_t checksum = 0;
    uint8_t retries = 0;
    uint8_t byte = 0;

upload_block:
    for(byte = 0; byte<NBN_blocksize;byte++) {
        UART_Send(&block[byte],1);
        checksum = checksum + block[byte];
    }

    UART_Send(&(checksum & 255),1);
    UART_Send(&((checksum >> 8) & 255),1);

    byte = UART_GetUChar(true);

    printf(byte);

    if(byte=='!') {
        retries++;

        if(retries>3) {
            exit((int) err_transfer_error);
        }

        zx_border(2);
        checksum = 0;
        goto upload_block;
    } else {
        zx_border(1);
//        esxdos_f_write(file_in, block, NBN_blocksize);
    }
}