//
// Created by D Rimron-Soutter on 31/03/2020.
//

#include <arch/zx.h>
#include <stdio.h>
#include <stdlib.h>
#include "nbn.h"
#include "uart.h"
#include "messages.h"

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

void NBN_GetBlock(unsigned char[] block) {
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

void NBN_SendBlock(unsigned char[] block, uint8_t length) {
    uint16_t checksum = 0;
    uint8_t retries = 0;
    uint8_t byte = 0;

upload_block:
    for(byte = 0; byte<length;byte++) {

        UART_Send(&block[byte],1);
        checksum = checksum + block[byte];
    }

    uint8_t checkpart;

//    printf("\x16\x01\x07");
    checkpart = (checksum >> 8) & 255;      UART_Send(&checkpart,1);
//    printf("Checksum: %u (%d)", checksum, checkpart);
    checkpart = (checksum     ) & 255;      UART_Send(&checkpart,1);
//    printf("(%d)     \n", checkpart);
//    printf("\x16\x01\x08");

    uint8_t status = NBN_GetStatus();

    if(status=='?') {
        for(byte = 0; byte<length;byte++) {
            printf("(%d)", block[byte]);
        }
        printf("Retrying\n ");
        retries++;
        checksum = 0;

        if(retries>3) {
            exit((int) err_transfer_error);
        }

        zx_border(2);
        goto upload_block;
    } else if(status=='!'){
        zx_border(1);
    }
}