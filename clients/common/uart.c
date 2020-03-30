//
// Created by D Rimron-Soutter on 30/03/2020.
//
#include <arch/zxn.h>
#include <stdlib.h>

#include "uart.h"
#include "messages.h"

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
