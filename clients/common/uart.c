//
// Created by D Rimron-Soutter on 30/03/2020.
//
#include <arch/zxn.h>
#include <stdlib.h>
#include <stdio.h>

#include "uart.h"
#include "util.h"
#include "messages.h"

unsigned char UART_GetUChar() {
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

void UART_Send(char command[], uint8_t len) {
    uint8_t command_letter = 0;

    for(;len!=0;len--) {
        zx_border(4);
        while (IO_UART_STATUS & IUS_TX_BUSY);  // Busy wait to send a single byte.
        if(verbose) printf("\x12\x31%c\x12\x30", command[command_letter]);
        IO_UART_TX = command[command_letter++];
    }
}

uint8_t UART_WaitOK(bool localecho) {
    unsigned char cbuff[4];
    repeat:
    cbuff[0] = cbuff[1];
    cbuff[1] = cbuff[2];
    cbuff[2] = cbuff[3];
    cbuff[3] = UART_GetUChar();

    if(localecho==true) printf("%c", cbuff[3]);
//    if(localecho==true) printf("%c(%d)", cbuff[3], cbuff[3]);

    if (cbuff[3] == 10 && cbuff[2] == 13 && cbuff[1] == 'K' && cbuff[0] == 'O') {
        return 0;
    } else if (cbuff[3] == 10 && cbuff[2] == 13 && cbuff[1] == 'R' && cbuff[0] == 'O') {
        return 254;
    }
    goto repeat;
}

uint8_t UART_GetStatus(bool localecho) {
    unsigned char cbuff[4];
    repeat:
    cbuff[0] = cbuff[1];
    cbuff[1] = cbuff[2];
    cbuff[2] = cbuff[3];
    cbuff[3] = UART_GetUChar();

    if(localecho==true) printf("%c", cbuff[3]);
//    if(localecho==true) printf("%c(%d)", cbuff[3], cbuff[3]);

    if (cbuff[3] == 10 && cbuff[2] == 13 && cbuff[1] == 'K' && cbuff[0] == 'O') {
        return 0;
    } else if (cbuff[3] == 10 && cbuff[2] == 13 && cbuff[1] == 'R' && cbuff[0] == 'O') {
        return 254;
    }
    goto repeat;
}
