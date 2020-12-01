//
// Created by D Rimron-Soutter on 30/03/2020.
//
#include <arch/zxn.h>
#include <stdlib.h>
#include <stdio.h>

#include "uart.h"
#include "util.h"
#include "messages.h"

static bool uartVerbose = false;

void UART_SetVerbose(bool status) __z88dk_fastcall {
    uartVerbose = status;
}

unsigned char UART_GetUChar() {
    zx_border(3);
    unsigned long checking;
    for(checking=0;checking<DEFAULT_TIMEOUT;checking++) {
        if (IO_UART_STATUS & IUS_RX_AVAIL) {  // Busy wait to send a single byte.
            zx_border(0);
            return IO_UART_RX;
        }
    }
    exit((int)err_timeout_byte);
}

void UART_GetUInt16(uint8_t* val) __z88dk_fastcall {
    *val = UART_GetUChar();
    ++val;
    *val = UART_GetUChar();
}

void UART_GetUInt32(uint8_t* val) {
    *val = UART_GetUChar();
    ++val;
    *val = UART_GetUChar();
    ++val;
    *val = UART_GetUChar();
    ++val;
    *val = UART_GetUChar();
}

void UART_Send(char command[], uint8_t len) {
    uint8_t command_letter = 0;

    for(;len!=0;len--) {
        UART_PutCh(command[command_letter++]);
    }
}

void UART_PutCh(char c) {
    while (IO_UART_STATUS & IUS_TX_BUSY);  // Busy wait to send a single byte.
    if(uartVerbose) printf("\x12\x31%c\x12\x30", c);
    IO_UART_TX = c;
}

uint8_t UART_WaitOK(bool localecho) {
    unsigned char cbuff[4];
repeat:
    cbuff[0] = cbuff[1];
    cbuff[1] = cbuff[2];
    cbuff[2] = cbuff[3];
    cbuff[3] = UART_GetUChar();

    if(localecho==true) printf("%c", cbuff[3]);

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

    if (cbuff[3] == 10 && cbuff[2] == 13 && cbuff[1] == 'K' && cbuff[0] == 'O') {
        return 0;
    } else if (cbuff[3] == 10 && cbuff[2] == 13 && cbuff[1] == 'R' && cbuff[0] == 'O') {
        return 254;
    }
    goto repeat;
}
