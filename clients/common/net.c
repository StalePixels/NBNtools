//
// Created by D Rimron-Soutter on 01/04/2020.
//

#include "net.h"
#include "uart.h"

int NET_Command(char command[], uint8_t len) {
    uint8_t command_letter = 0;

    UART_Send("AT+CIP", 6);
    UART_Send(command, len);
    UART_Send("\x0D\x0A", 2);

    return UART_WaitOK(false);
}

void NET_Close() {
    UART_Send("+++", 3);
    looper(512);

    Net_Command("MODE=0", 6);
    Net_Command("CLOSE", 5);
    looper(512);
}